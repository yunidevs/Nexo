import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    EstadoEventoWebhookPayPal,
    EstadoPedidoMarketplace,
    Prisma,
    type PrismaClient,
} from "@prisma/client";
import { checkoutSchema } from "../../controllers/marketplace.controller.js";
import type { AppConfig } from "../../config.js";
import {
    calcularComisionMarketplace,
    createMarketplaceService,
} from "./marketplace.service.js";
import {
    convertirImportePayPal,
    createPayPalService,
    PayPalRequestError,
    type PayPalOrder,
    validarCapturaOrden,
} from "./paypal.service.js";

const PEDIDO_ID = "0c62fe74-9569-456f-ade3-135b463fd1a2";
const ORDEN_ID = "5O190127TN364715T";

const configPrueba: AppConfig = {
    environment: "test",
    port: 4000,
    corsOrigin: "http://localhost:3000",
    jwtSecret: "secreto-de-prueba-de-32-caracteres-minimo",
    paypalClientId: "client-id",
    paypalClientSecret: "client-secret",
    paypalBaseUrl: "https://api-m.sandbox.paypal.com",
    paypalWebhookId: "WH-TEST-123",
    paypalCurrency: "USD",
    paypalExchangeRate: 40,
    whatsappAccessToken: "",
    whatsappPhoneNumberId: "",
    whatsappApiVersion: "v23.0",
    whatsappOtpTemplate: "",
    whatsappOtpTemplateLang: "es",
};

const configWhatsappPrueba: AppConfig = {
    ...configPrueba,
    whatsappAccessToken: "token-whatsapp",
    whatsappPhoneNumberId: "1234567890",
};

function respuestaJson(cuerpo: unknown, status = 200): Response {
    return new Response(JSON.stringify(cuerpo), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function respuestaToken(): Response {
    return respuestaJson({
        access_token: "token-de-prueba",
        token_type: "Bearer",
        expires_in: 3600,
    });
}

function ordenPayPal(
    estado: string,
    captura?: {
        id: string;
        status: string;
        value: string;
        currency: string;
    },
): PayPalOrder {
    return {
        id: ORDEN_ID,
        status: estado,
        links: [
            {
                href: "https://www.sandbox.paypal.com/checkoutnow?token=ABC",
                rel: "payer-action",
                method: "GET",
            },
        ],
        purchase_units: [
            {
                reference_id: PEDIDO_ID,
                custom_id: PEDIDO_ID,
                amount: { currency_code: "USD", value: "25.00" },
                ...(captura
                    ? {
                          payments: {
                              captures: [
                                  {
                                      id: captura.id,
                                      status: captura.status,
                                      amount: {
                                          currency_code: captura.currency,
                                          value: captura.value,
                                      },
                                  },
                              ],
                          },
                      }
                    : {}),
            },
        ],
    };
}

describe("marketplace payment helpers", () => {
    it("accepts the checkout payload with a one-character department and blank optional fields", () => {
        const resultado = checkoutSchema.safeParse({
            tiendaSlug: "erfely",
            nombre: "Yunier Lima",
            correo: "yunierlr02@gmail.com",
            telefono: "095227806",
            departamento: "4",
            localidad: "Montevideo",
            direccion: "Cmdte braga",
            codigoPostal: "",
            notaEntrega: "",
            detalles: [
                {
                    productoId: PEDIDO_ID,
                    cantidad: 1,
                },
            ],
        });

        assert.equal(resultado.success, true);
    });

    it("calculates the platform fee in cents using half-up rounding", () => {
        assert.equal(
            calcularComisionMarketplace(
                new Prisma.Decimal("1234.56"),
                2,
            ).toFixed(2),
            "24.69",
        );
        assert.equal(
            calcularComisionMarketplace(
                new Prisma.Decimal("10.00"),
                2.5,
            ).toFixed(2),
            "0.25",
        );
    });

    it("converts the UYU total to the configured PayPal currency", () => {
        assert.equal(
            convertirImportePayPal(
                new Prisma.Decimal("1000.00"),
                40,
                "USD",
            ).toFixed(2),
            "25.00",
        );
        assert.equal(
            convertirImportePayPal(
                new Prisma.Decimal("1000.00"),
                40,
                "JPY",
            ).toFixed(0),
            "25",
        );
        assert.throws(
            () =>
                convertirImportePayPal(
                    new Prisma.Decimal("0.10"),
                    40,
                    "USD",
                ),
            (error: unknown) =>
                error instanceof Error &&
                error.message.includes("demasiado bajo"),
        );
    });

    it("creates the order at the documented endpoint with OAuth credentials", async () => {
        const llamadas: Array<{ url: string; init?: RequestInit }> = [];
        const fetcher: typeof fetch = async (input, init) => {
            const url = String(input);
            llamadas.push({ url, ...(init ? { init } : {}) });
            if (url.endsWith("/v1/oauth2/token")) return respuestaToken();
            return respuestaJson(
                ordenPayPal("PAYER_ACTION_REQUIRED"),
            );
        };
        const paypal = createPayPalService(configPrueba, fetcher);

        const { orden, redirectUrl } = await paypal.crearOrden({
            pedidoId: PEDIDO_ID,
            importe: "25.00",
            moneda: "USD",
            descripcion: "Pedido marketplace",
            returnUrl: "https://app.ejemplo.com/marketplace/resultado?pedido=1",
            cancelUrl:
                "https://app.ejemplo.com/marketplace/resultado?pedido=1&cancelado=1",
        });

        assert.equal(orden.id, ORDEN_ID);
        assert.equal(
            redirectUrl,
            "https://www.sandbox.paypal.com/checkoutnow?token=ABC",
        );

        const oauth = llamadas[0];
        assert.equal(
            oauth?.url,
            "https://api-m.sandbox.paypal.com/v1/oauth2/token",
        );
        assert.equal(oauth?.init?.method, "POST");
        assert.equal(
            new Headers(oauth?.init?.headers).get("authorization"),
            `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
        );

        const creacion = llamadas[1];
        assert.equal(
            creacion?.url,
            "https://api-m.sandbox.paypal.com/v2/checkout/orders",
        );
        assert.equal(creacion?.init?.method, "POST");
        const headers = new Headers(creacion?.init?.headers);
        assert.equal(headers.get("authorization"), "Bearer token-de-prueba");
        assert.equal(headers.get("paypal-request-id"), `nexo-order-${PEDIDO_ID}`);
        const cuerpo = JSON.parse(String(creacion?.init?.body)) as {
            intent: string;
            purchase_units: Array<{
                reference_id: string;
                amount: { currency_code: string; value: string };
            }>;
            payment_source: {
                paypal: {
                    experience_context: {
                        return_url: string;
                        cancel_url: string;
                    };
                };
            };
        };
        assert.equal(cuerpo.intent, "CAPTURE");
        assert.equal(cuerpo.purchase_units[0]?.reference_id, PEDIDO_ID);
        assert.deepEqual(cuerpo.purchase_units[0]?.amount, {
            currency_code: "USD",
            value: "25.00",
        });
        assert.ok(
            cuerpo.payment_source.paypal.experience_context.return_url.includes(
                "/marketplace/resultado",
            ),
        );
        assert.ok(
            cuerpo.payment_source.paypal.experience_context.cancel_url.includes(
                "cancelado=1",
            ),
        );
    });

    it("rejects an approval link that does not belong to PayPal", async () => {
        const fetcher: typeof fetch = async (input) => {
            if (String(input).endsWith("/v1/oauth2/token")) {
                return respuestaToken();
            }
            return respuestaJson({
                id: ORDEN_ID,
                status: "PAYER_ACTION_REQUIRED",
                links: [
                    {
                        href: "https://atacante.ejemplo.com/aprobar",
                        rel: "approve",
                        method: "GET",
                    },
                ],
                purchase_units: [
                    {
                        reference_id: PEDIDO_ID,
                        custom_id: PEDIDO_ID,
                        amount: { currency_code: "USD", value: "25.00" },
                    },
                ],
            });
        };
        const paypal = createPayPalService(configPrueba, fetcher);

        await assert.rejects(
            paypal.crearOrden({
                pedidoId: PEDIDO_ID,
                importe: "25.00",
                moneda: "USD",
                descripcion: "Pedido marketplace",
                returnUrl: "https://app.ejemplo.com/retorno",
                cancelUrl: "https://app.ejemplo.com/cancelar",
            }),
            (error: unknown) =>
                error instanceof PayPalRequestError &&
                error.message.includes("enlace de aprobación"),
        );
    });

    it("captures the order using the documented endpoint and validates the result", async () => {
        const llamadas: Array<{ url: string; init?: RequestInit }> = [];
        const fetcher: typeof fetch = async (input, init) => {
            const url = String(input);
            llamadas.push({ url, ...(init ? { init } : {}) });
            if (url.endsWith("/v1/oauth2/token")) return respuestaToken();
            return respuestaJson(
                ordenPayPal("COMPLETED", {
                    id: "CAP-123",
                    status: "COMPLETED",
                    value: "25.00",
                    currency: "USD",
                }),
            );
        };
        const paypal = createPayPalService(configPrueba, fetcher);

        const orden = await paypal.capturarOrden(ORDEN_ID);
        const resultado = validarCapturaOrden(orden, {
            pedidoId: PEDIDO_ID,
            orderId: ORDEN_ID,
            importe: new Prisma.Decimal("25.00"),
            moneda: "USD",
        });

        assert.equal(resultado?.estado, "COMPLETED");
        assert.equal(resultado?.captura.id, "CAP-123");
        const captura = llamadas[1];
        assert.equal(
            captura?.url,
            `https://api-m.sandbox.paypal.com/v2/checkout/orders/${ORDEN_ID}/capture`,
        );
        assert.equal(captura?.init?.method, "POST");
    });

    it("rejects a capture whose amount does not match the stored order", () => {
        const orden = ordenPayPal("COMPLETED", {
            id: "CAP-123",
            status: "COMPLETED",
            value: "24.00",
            currency: "USD",
        });
        assert.throws(
            () =>
                validarCapturaOrden(orden, {
                    pedidoId: PEDIDO_ID,
                    orderId: ORDEN_ID,
                    importe: new Prisma.Decimal("25.00"),
                    moneda: "USD",
                }),
            (error: unknown) =>
                error instanceof PayPalRequestError &&
                error.message.includes("no coincide"),
        );
    });

    it("verifies webhook signatures against the configured webhook id", async () => {
        let cuerpoVerificacion: Record<string, unknown> | undefined;
        const fetcher: typeof fetch = async (input, init) => {
            if (String(input).endsWith("/v1/oauth2/token")) {
                return respuestaToken();
            }
            cuerpoVerificacion = JSON.parse(
                String(init?.body),
            ) as Record<string, unknown>;
            return respuestaJson({ verification_status: "SUCCESS" });
        };
        const paypal = createPayPalService(configPrueba, fetcher);
        const evento = { id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED" };

        const valida = await paypal.verificarFirmaWebhook(evento, {
            transmissionId: "transmission-1",
            transmissionTime: "2026-11-12T12:00:00Z",
            certUrl: "https://api.paypal.com/cert.pem",
            authAlgo: "SHA256withRSA",
            transmissionSig: "firma",
        });

        assert.equal(valida, true);
        assert.equal(cuerpoVerificacion?.webhook_id, "WH-TEST-123");
        assert.equal(cuerpoVerificacion?.transmission_id, "transmission-1");
        assert.deepEqual(cuerpoVerificacion?.webhook_event, evento);
    });

    it("reports PayPal HTTP errors with sanitized logs and issue codes", async () => {
        const log: unknown[][] = [];
        const originalError = console.error;
        console.error = (...values: unknown[]) => log.push(values);
        try {
            const fetcher: typeof fetch = async (input) => {
                if (String(input).endsWith("/v1/oauth2/token")) {
                    return respuestaToken();
                }
                return respuestaJson(
                    {
                        name: "UNPROCESSABLE_ENTITY",
                        message: "The request could not be processed.",
                        details: [
                            {
                                issue: "ORDER_ALREADY_CAPTURED",
                                description:
                                    "Payer yunier@example.com already captured.",
                            },
                        ],
                        debug_id: "debug-123",
                    },
                    422,
                );
            };
            const paypal = createPayPalService(configPrueba, fetcher);

            await assert.rejects(
                paypal.capturarOrden(ORDEN_ID),
                (error: unknown) =>
                    error instanceof PayPalRequestError &&
                    error.message.includes("HTTP 422") &&
                    error.message.includes("UNPROCESSABLE_ENTITY") &&
                    error.paypalIssues.includes("ORDER_ALREADY_CAPTURED"),
            );
        } finally {
            console.error = originalError;
        }

        const logged = JSON.stringify(log);
        assert.ok(logged.includes("ORDER_ALREADY_CAPTURED"));
        assert.ok(!logged.includes("yunier@example.com"));
        assert.ok(!logged.includes("client-secret"));
    });

    it("keeps the payment outcome marked as uncertain after a network failure", async () => {
        const paypal = createPayPalService(configPrueba, async () => {
            throw new TypeError("fetch failed");
        });

        await assert.rejects(
            paypal.crearOrden({
                pedidoId: PEDIDO_ID,
                importe: "25.00",
                moneda: "USD",
                descripcion: "Pedido marketplace",
                returnUrl: "https://app.ejemplo.com/retorno",
                cancelUrl: "https://app.ejemplo.com/cancelar",
            }),
            (error: unknown) =>
                error instanceof PayPalRequestError &&
                error.externalStateUnknown === true,
        );
    });
    it("rejects a webhook whose PayPal signature is invalid", async () => {
        const fetcher: typeof fetch = async (input) => {
            if (String(input).endsWith("/v1/oauth2/token")) {
                return respuestaToken();
            }
            return respuestaJson({ verification_status: "FAILURE" });
        };
        const servicio = createMarketplaceService(
            {} as unknown as PrismaClient,
            configPrueba,
            fetcher,
        );

        await assert.rejects(
            servicio.procesarNotificacion(
                {
                    id: "WH-1",
                    event_type: "PAYMENT.CAPTURE.COMPLETED",
                },
                {
                    transmissionId: "transmission-1",
                    transmissionTime: "2026-11-12T12:00:00Z",
                    certUrl: "https://api.paypal.com/cert.pem",
                    authAlgo: "SHA256withRSA",
                    transmissionSig: "firma",
                },
            ),
            (error: unknown) =>
                typeof error === "object" &&
                error !== null &&
                "codigo" in error &&
                error.codigo === "FIRMA_WEBHOOK_INVALIDA",
        );
    });

    it("ignores a webhook event that was already processed", async () => {
        let actualizaciones = 0;
        const prisma = {
            eventoWebhookPayPal: {
                findUnique: async () => ({
                    estado: EstadoEventoWebhookPayPal.PROCESADO,
                }),
                create: async () => {
                    throw new Error("El evento duplicado no debe registrarse.");
                },
                update: async () => {
                    actualizaciones += 1;
                },
            },
        } as unknown as PrismaClient;
        const fetcher: typeof fetch = async (input) => {
            if (String(input).endsWith("/v1/oauth2/token")) {
                return respuestaToken();
            }
            return respuestaJson({ verification_status: "SUCCESS" });
        };
        const servicio = createMarketplaceService(
            prisma,
            configPrueba,
            fetcher,
        );

        await servicio.procesarNotificacion(
            {
                id: "WH-1",
                event_type: "PAYMENT.CAPTURE.COMPLETED",
            },
            {
                transmissionId: "transmission-1",
                transmissionTime: "2026-11-12T12:00:00Z",
                certUrl: "https://api.paypal.com/cert.pem",
                authAlgo: "SHA256withRSA",
                transmissionSig: "firma",
            },
        );

        assert.equal(actualizaciones, 0);
    });

    it("captures the payment and records the marketplace sale as paid", async () => {
        const pedido = {
            id: PEDIDO_ID,
            empresaId: "empresa-1",
            estado: EstadoPedidoMarketplace.PENDIENTE_PAGO,
            expiraEn: new Date(Date.now() + 60_000),
            paypalOrderId: ORDEN_ID,
            paypalCaptureId: null,
            paypalAmount: new Prisma.Decimal("25.00"),
            paypalCurrency: "USD",
            nombreComprador: "Comprador",
            correoComprador: "comprador@example.com",
            telefonoComprador: "099123456",
            departamento: "Montevideo",
            localidad: "Centro",
            direccion: "Calle 123",
            subtotal: new Prisma.Decimal("1000.00"),
            tasaImpuesto: new Prisma.Decimal("0"),
            impuesto: new Prisma.Decimal("0"),
            costoEnvio: new Prisma.Decimal("0"),
            total: new Prisma.Decimal("1000.00"),
            comision: new Prisma.Decimal("20.00"),
            empresa: { nombre: "Tienda de prueba" },
            detalles: [
                {
                    productoId: "producto-1",
                    cantidad: 1,
                    sku: "SKU-1",
                    nombre: "Producto",
                    precioUnitario: new Prisma.Decimal("1000.00"),
                    subtotal: new Prisma.Decimal("1000.00"),
                },
            ],
        };
        let pedidoActualizado: Record<string, unknown> | undefined;
        let ventaCreada: Record<string, unknown> | undefined;
        const tx = {
            $queryRaw: async () => [],
            pedidoMarketplace: {
                findUnique: async () => pedido,
                update: async (args: {
                    data: Record<string, unknown>;
                }) => {
                    pedidoActualizado = args.data;
                    return pedido;
                },
            },
            producto: {
                findFirst: async () => ({ id: "producto-1", stock: 5 }),
                updateMany: async () => ({ count: 1 }),
            },
            cliente: { create: async () => ({ id: "cliente-1" }) },
            movimientoInventario: { create: async () => ({}) },
            venta: {
                create: async (args: { data: Record<string, unknown> }) => {
                    ventaCreada = args.data;
                    return { id: "venta-1" };
                },
            },
        };
        const prisma = {
            pedidoMarketplace: {
                findUnique: async () => pedido,
                updateMany: async () => ({ count: 1 }),
            },
            $transaction: async (
                fn: (cliente: typeof tx) => Promise<unknown>,
            ) => fn(tx),
        } as unknown as PrismaClient;
        const fetcher: typeof fetch = async (input) => {
            if (String(input).endsWith("/v1/oauth2/token")) {
                return respuestaToken();
            }
            return respuestaJson(
                ordenPayPal("COMPLETED", {
                    id: "CAP-123",
                    status: "COMPLETED",
                    value: "25.00",
                    currency: "USD",
                }),
            );
        };
        const servicio = createMarketplaceService(
            prisma,
            configPrueba,
            fetcher,
        );

        const estado = await servicio.capturarPedido(PEDIDO_ID, ORDEN_ID);

        assert.equal(estado, EstadoPedidoMarketplace.PAGO_CONFIRMADO);
        assert.equal(
            pedidoActualizado?.estado,
            EstadoPedidoMarketplace.PAGO_CONFIRMADO,
        );
        assert.equal(pedidoActualizado?.ventaId, "venta-1");
        assert.equal(String(ventaCreada?.total), "1000");
        assert.equal(ventaCreada?.clienteId, "cliente-1");
        const pagos = ventaCreada?.pagos as
            | { create?: { metodo?: string } }
            | undefined;
        assert.equal(pagos?.create?.metodo, "PAYPAL");
    });

    it("does not capture again when the order is already paid", async () => {
        const prisma = {
            pedidoMarketplace: {
                findUnique: async () => ({
                    id: PEDIDO_ID,
                    empresaId: "empresa-1",
                    estado: EstadoPedidoMarketplace.PAGO_CONFIRMADO,
                    expiraEn: new Date(Date.now() + 60_000),
                    paypalOrderId: ORDEN_ID,
                    paypalCaptureId: "CAP-123",
                    paypalAmount: new Prisma.Decimal("25.00"),
                    paypalCurrency: "USD",
                }),
            },
        } as unknown as PrismaClient;
        const servicio = createMarketplaceService(
            prisma,
            configPrueba,
            async () => {
                throw new Error("No debe llamarse a PayPal.");
            },
        );

        const estado = await servicio.capturarPedido(PEDIDO_ID, ORDEN_ID);

        assert.equal(estado, EstadoPedidoMarketplace.PAGO_CONFIRMADO);
    });

    it("rejects a capture token that does not match the stored order", async () => {
        const prisma = {
            pedidoMarketplace: {
                findUnique: async () => ({
                    id: PEDIDO_ID,
                    empresaId: "empresa-1",
                    estado: EstadoPedidoMarketplace.PENDIENTE_PAGO,
                    expiraEn: new Date(Date.now() + 60_000),
                    paypalOrderId: ORDEN_ID,
                    paypalCaptureId: null,
                    paypalAmount: new Prisma.Decimal("25.00"),
                    paypalCurrency: "USD",
                }),
            },
        } as unknown as PrismaClient;
        const servicio = createMarketplaceService(
            prisma,
            configPrueba,
            async () => {
                throw new Error("No debe llamarse a PayPal.");
            },
        );

        await assert.rejects(
            servicio.capturarPedido(PEDIDO_ID, "OTRA-ORDEN"),
            (error: unknown) =>
                typeof error === "object" &&
                error !== null &&
                "codigo" in error &&
                error.codigo === "PAGO_NO_COINCIDE",
        );
    });
});

describe("marketplace public catalog", () => {
    it("lists published products without available stock as sold out", async () => {
        let consultaTiendas: Prisma.EmpresaFindManyArgs | undefined;
        const tienda = {
            id: "empresa-1",
            nombre: "Tienda de prueba",
            tiendaSlug: "tienda-prueba",
            tasaImpuesto: new Prisma.Decimal("0"),
            costoEnvio: new Prisma.Decimal("0"),
            productos: [
                {
                    id: "producto-1",
                    sku: "SKU-1",
                    nombre: "Producto agotado",
                    precioVenta: new Prisma.Decimal("100"),
                    categoria: null,
                    imagenUrl: null,
                    stock: 2,
                    stockReservado: 2,
                },
            ],
        };
        const prisma = {
            pedidoMarketplace: { findMany: async () => [] },
            empresa: {
                findMany: async (consulta: Prisma.EmpresaFindManyArgs) => {
                    consultaTiendas = consulta;
                    return [tienda];
                },
            },
        } as unknown as PrismaClient;

        const tiendas = await createMarketplaceService(
            prisma,
            configPrueba,
        ).listarTiendas();

        assert.equal(tiendas.length, 1);
        assert.equal(tiendas[0]?.productos.length, 1);
        assert.equal(tiendas[0]?.productos[0]?.stock, 0);
        assert.deepEqual(
            consultaTiendas?.where,
            {
                tiendaActiva: true,
                tiendaSlug: { not: null },
            },
        );
        const seleccionProductos = consultaTiendas?.select?.productos;
        assert.ok(
            typeof seleccionProductos === "object" &&
                seleccionProductos !== null &&
                "where" in seleccionProductos,
        );
        assert.deepEqual(seleccionProductos.where, {
            activo: true,
            publicadoMarketplace: true,
        });
    });
});

describe("marketplace catálogo global", () => {
    const productoPublicado = {
        id: "producto-2",
        sku: "SKU-2",
        nombre: "Termo acero",
        precioVenta: new Prisma.Decimal("250.00"),
        categoria: "Hogar",
        imagenUrl: null,
        stock: 5,
        stockReservado: 1,
        empresa: {
            id: "empresa-1",
            nombre: "Tienda de prueba",
            tiendaSlug: "tienda-prueba",
        },
    };

    function prismaCatalogo(
        productos: unknown[],
        capturar: (consulta: Prisma.ProductoFindManyArgs) => void,
    ): PrismaClient {
        return {
            producto: {
                fields: { stock: {} },
                findFirst: async () => null,
                findMany: async (consulta: Prisma.ProductoFindManyArgs) => {
                    capturar(consulta);
                    return productos;
                },
                count: async () => productos.length,
            },
            $transaction: async (
                operaciones: Array<Promise<unknown>> | unknown[],
            ) => Promise.all(operaciones as Promise<unknown>[]),
        } as unknown as PrismaClient;
    }

    it("lista el catálogo con filtros, orden y paginación aplicados", async () => {
        let consulta: Prisma.ProductoFindManyArgs | undefined;
        const servicio = createMarketplaceService(
            prismaCatalogo([productoPublicado], (c) => {
                consulta = c;
            }),
            configPrueba,
        );

        const catalogo = await servicio.listarCatalogo({
            busqueda: "termo",
            categoria: "Hogar",
            empresaSlug: "tienda-prueba",
            precioMin: 100,
            precioMax: 500,
            soloDisponibles: true,
            orden: "populares",
            pagina: 2,
            porPagina: 12,
        });

        assert.equal(catalogo.productos.length, 1);
        assert.equal(catalogo.total, 1);
        assert.equal(catalogo.pagina, 2);
        assert.equal(catalogo.porPagina, 12);
        assert.equal(catalogo.totalPaginas, 1);
        assert.equal(catalogo.productos[0]?.stock, 4);
        assert.deepEqual(catalogo.productos[0]?.empresa, {
            id: "empresa-1",
            nombre: "Tienda de prueba",
            slug: "tienda-prueba",
        });
        assert.ok(consulta);
        assert.deepEqual(consulta.where, {
            activo: true,
            publicadoMarketplace: true,
            empresa: {
                tiendaActiva: true,
                tiendaSlug: "tienda-prueba",
            },
            OR: [
                { nombre: { contains: "termo", mode: "insensitive" } },
                { sku: { contains: "termo", mode: "insensitive" } },
                { categoria: { contains: "termo", mode: "insensitive" } },
                {
                    empresa: {
                        nombre: { contains: "termo", mode: "insensitive" },
                    },
                },
            ],
            categoria: "Hogar",
            precioVenta: {
                gte: new Prisma.Decimal(100),
                lte: new Prisma.Decimal(500),
            },
            stockReservado: { lt: {} },
        });
        assert.ok((consulta.where.stockReservado as { lt: unknown }).lt);
        assert.deepEqual(consulta.orderBy, [
            { detallesVenta: { _count: "desc" } },
            { id: "asc" },
        ]);
        assert.equal(consulta.skip, 12);
        assert.equal(consulta.take, 12);
    });

    it("devuelve 404 cuando el producto no está publicado", async () => {
        const servicio = createMarketplaceService(
            prismaCatalogo([], () => {}),
            configPrueba,
        );
        await assert.rejects(
            () => servicio.obtenerProductoPublico(productoPublicado.id),
            { codigo: "PRODUCTO_NO_DISPONIBLE" },
        );
    });
});

interface RegistroCodigoPrueba {
    id: string;
    telefono: string;
    codigoHash: string;
    intentos: number;
    verificadoEn: Date | null;
    expiraEn: Date;
    creadaEn: Date;
}

function prismaCodigos(): {
    prisma: PrismaClient;
    registros: RegistroCodigoPrueba[];
} {
    const registros: RegistroCodigoPrueba[] = [];
    let secuencia = 0;
    const obtener = (id: string): RegistroCodigoPrueba => {
        const registro = registros.find((candidato) => candidato.id === id);
        if (!registro) throw new Error(`Registro ${id} no existe en la prueba.`);
        return registro;
    };
    const prisma = {
        codigoVerificacionTelefono: {
            findFirst: async (
                consulta: Prisma.CodigoVerificacionTelefonoFindFirstArgs,
            ) => {
                const telefono = consulta.where?.telefono;
                const coincidentes = registros.filter(
                    (registro) => registro.telefono === telefono,
                );
                return coincidentes[coincidentes.length - 1] ?? null;
            },
            count: async (
                consulta: Prisma.CodigoVerificacionTelefonoCountArgs,
            ) => {
                const telefono = consulta.where?.telefono;
                const desde =
                    (
                        consulta.where?.creadaEn as {
                            gte?: Date;
                        } | undefined
                    )?.gte?.getTime() ?? 0;
                return registros.filter(
                    (registro) =>
                        registro.telefono === telefono &&
                        registro.creadaEn.getTime() >= desde,
                ).length;
            },
            create: async ({
                data,
            }: {
                data: {
                    telefono: string;
                    codigoHash: string;
                    expiraEn: Date;
                };
            }) => {
                secuencia += 1;
                const registro: RegistroCodigoPrueba = {
                    id: `codigo-${secuencia}`,
                    telefono: data.telefono,
                    codigoHash: data.codigoHash,
                    intentos: 0,
                    verificadoEn: null,
                    expiraEn: data.expiraEn,
                    creadaEn: new Date(),
                };
                registros.push(registro);
                return registro;
            },
            update: async ({
                where,
                data,
            }: {
                where: { id: string };
                data: {
                    intentos?: { increment: number };
                    verificadoEn?: Date;
                };
            }) => {
                const registro = obtener(where.id);
                if (data.intentos) registro.intentos += data.intentos.increment;
                if (data.verificadoEn) registro.verificadoEn = data.verificadoEn;
                return registro;
            },
            delete: async ({ where }: { where: { id: string } }) => {
                const registro = obtener(where.id);
                registros.splice(registros.indexOf(registro), 1);
                return registro;
            },
        },
    } as unknown as PrismaClient;
    return { prisma, registros };
}

function fetcherWhatsapp(extraerCodigo: (cuerpo: string) => void): typeof fetch {
    return async (input, init) => {
        if (init?.method !== "POST" || !String(input).includes("/messages")) {
            throw new Error("La prueba solo espera envíos a WhatsApp.");
        }
        const cuerpo = String(init.body ?? "{}");
        extraerCodigo(cuerpo);
        return respuestaJson({ messages: [{ id: "wamid-1" }] });
    };
}

describe("verificación del teléfono por WhatsApp", () => {
    it("envía el código por WhatsApp, lo verifica y marca el teléfono como verificado", async () => {
        const { prisma, registros } = prismaCodigos();
        let codigoEnviado = "";
        const servicio = createMarketplaceService(
            prisma,
            configWhatsappPrueba,
            fetcherWhatsapp((cuerpo) => {
                codigoEnviado =
                    /\b(\d{6})\b/.exec(
                        (JSON.parse(cuerpo) as { text?: { body?: string } })
                            .text?.body ?? "",
                    )?.[1] ?? "";
            }),
        );

        const envio = await servicio.enviarCodigoVerificacionTelefono(
            "+598 (99) 123-456",
        );

        assert.equal(envio.telefono, "59899123456");
        assert.match(envio.expiraEn, /^\d{4}-\d{2}-\d{2}T/);
        assert.match(codigoEnviado, /^\d{6}$/);
        assert.equal(registros.length, 1);
        assert.equal(registros[0]?.verificadoEn, null);

        await servicio.verificarTelefono("598 99 123 456", codigoEnviado);

        assert.ok(registros[0]?.verificadoEn);
    });

    it("exige una espera entre envíos al mismo teléfono", async () => {
        const { prisma } = prismaCodigos();
        const servicio = createMarketplaceService(
            prisma,
            configWhatsappPrueba,
            fetcherWhatsapp(() => {}),
        );
        await servicio.enviarCodigoVerificacionTelefono("59899123456");

        await assert.rejects(
            () => servicio.enviarCodigoVerificacionTelefono("59899123456"),
            { codigo: "CODIGO_EN_ESPERA" },
        );
    });

    it("rechaza un teléfono sin código de país o demasiado corto", async () => {
        const servicio = createMarketplaceService(
            prismaCodigos().prisma,
            configWhatsappPrueba,
            fetcherWhatsapp(() => {}),
        );

        await assert.rejects(
            () => servicio.enviarCodigoVerificacionTelefono("abc"),
            { codigo: "TELEFONO_INVALIDO" },
        );
        await assert.rejects(
            () => servicio.verificarTelefono("+598*99123456", "123456"),
            { codigo: "TELEFONO_INVALIDO" },
        );
    });

    it("rechaza códigos incorrectos, agota los intentos y bloquea el código", async () => {
        const { prisma } = prismaCodigos();
        let codigoEnviado = "";
        const servicio = createMarketplaceService(
            prisma,
            configWhatsappPrueba,
            fetcherWhatsapp((cuerpo) => {
                codigoEnviado =
                    /\b(\d{6})\b/.exec(
                        (JSON.parse(cuerpo) as { text?: { body?: string } })
                            .text?.body ?? "",
                    )?.[1] ?? "";
            }),
        );
        await servicio.enviarCodigoVerificacionTelefono("59899123456");
        const codigoErroneo = codigoEnviado === "000000" ? "111111" : "000000";

        for (let intento = 0; intento < 5; intento += 1) {
            await assert.rejects(
                () => servicio.verificarTelefono("59899123456", codigoErroneo),
                { codigo: "CODIGO_INCORRECTO" },
            );
        }
        await assert.rejects(
            () => servicio.verificarTelefono("59899123456", codigoEnviado),
            { codigo: "CODIGO_BLOQUEADO" },
        );
    });

    it("rechaza un código expirado", async () => {
        const { prisma, registros } = prismaCodigos();
        let codigoEnviado = "";
        const servicio = createMarketplaceService(
            prisma,
            configWhatsappPrueba,
            fetcherWhatsapp((cuerpo) => {
                codigoEnviado =
                    /\b(\d{6})\b/.exec(
                        (JSON.parse(cuerpo) as { text?: { body?: string } })
                            .text?.body ?? "",
                    )?.[1] ?? "";
            }),
        );
        await servicio.enviarCodigoVerificacionTelefono("59899123456");
        const registro = registros[0];
        if (!registro) throw new Error("La prueba requiere un registro.");
        registro.expiraEn = new Date(Date.now() - 1000);

        await assert.rejects(
            () => servicio.verificarTelefono("59899123456", codigoEnviado),
            { codigo: "CODIGO_EXPIRADO" },
        );
    });

    it("falla con un mensaje claro cuando WhatsApp no está configurado", async () => {
        const servicio = createMarketplaceService(
            prismaCodigos().prisma,
            configPrueba,
            fetcherWhatsapp(() => {}),
        );

        await assert.rejects(
            () => servicio.enviarCodigoVerificacionTelefono("59899123456"),
            { codigo: "WHATSAPP_NO_CONFIGURADO" },
        );
    });
});
