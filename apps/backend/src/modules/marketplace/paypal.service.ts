import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors/app-error.js";

const MAX_INTENTOS_TOKEN = 1;

const moneySchema = z.object({
    currency_code: z.string().length(3),
    value: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
});

const linkSchema = z.object({
    href: z.string().url(),
    rel: z.string().min(1),
    method: z.string().min(1),
});

const captureSchema = z.object({
    id: z.string().min(1).max(100),
    status: z.string(),
    amount: moneySchema.optional(),
    custom_id: z.string().optional(),
    invoice_id: z.string().optional(),
    supplementary_data: z
        .object({
            related_ids: z
                .object({
                    order_id: z.string().optional(),
                    capture_id: z.string().optional(),
                })
                .optional(),
        })
        .optional(),
});

const purchaseUnitSchema = z.object({
    reference_id: z.string().optional(),
    custom_id: z.string().optional(),
    amount: moneySchema.optional(),
    payments: z
        .object({
            captures: z.array(captureSchema).optional(),
        })
        .optional(),
});

const orderSchema = z.object({
    id: z.string().regex(/^[A-Z0-9]{1,36}$/),
    status: z.string(),
    links: z.array(linkSchema).optional(),
    purchase_units: z.array(purchaseUnitSchema).optional(),
});

const refundSchema = z.object({
    id: z.string().min(1).max(100),
    status: z.enum(["CANCELLED", "FAILED", "PENDING", "COMPLETED"]),
    amount: moneySchema.optional(),
});

const tokenSchema = z.object({
    access_token: z.string().min(1),
    token_type: z.string().min(1),
    expires_in: z.number().int().positive(),
});

const verificationSchema = z.object({
    verification_status: z.enum(["SUCCESS", "FAILURE"]),
});

export type PayPalOrder = z.infer<typeof orderSchema>;
export type PayPalCapture = z.infer<typeof captureSchema>;
export type PayPalRefund = z.infer<typeof refundSchema>;

export interface PayPalWebhookHeaders {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
}

export interface CrearOrdenPayPalInput {
    pedidoId: string;
    importe: string;
    moneda: string;
    descripcion: string;
    returnUrl: string;
    cancelUrl: string;
}

export interface OrdenPayPalCreada {
    orden: PayPalOrder;
    redirectUrl: string;
}

export interface PayPalService {
    configurado: boolean;
    crearOrden(input: CrearOrdenPayPalInput): Promise<OrdenPayPalCreada>;
    obtenerOrden(id: string): Promise<PayPalOrder>;
    capturarOrden(id: string): Promise<PayPalOrder>;
    reembolsarCaptura(
        captureId: string,
        input: {
            importe: string;
            moneda: string;
            invoiceId: string;
            idempotencyKey: string;
        },
    ): Promise<PayPalRefund>;
    obtenerReembolso(id: string): Promise<PayPalRefund>;
    verificarFirmaWebhook(
        evento: unknown,
        headers: PayPalWebhookHeaders,
    ): Promise<boolean>;
}

export class PayPalRequestError extends AppError {
    readonly externalStateUnknown: boolean;
    readonly paypalCode: string | undefined;
    readonly paypalIssues: string[];

    constructor(
        mensaje: string,
        externalStateUnknown: boolean,
        options?: {
            statusCode?: number;
            paypalCode?: string;
            paypalIssues?: string[];
        },
    ) {
        super("PAYPAL_ERROR", mensaje, options?.statusCode ?? 502);
        this.externalStateUnknown = externalStateUnknown;
        this.paypalCode = options?.paypalCode;
        this.paypalIssues = options?.paypalIssues ?? [];
    }
}

export function paypalConfigurado(config: AppConfig): boolean {
    return Boolean(
        config.paypalClientId &&
            config.paypalClientSecret &&
            config.paypalBaseUrl &&
            config.paypalWebhookId &&
            config.paypalExchangeRate > 0,
    );
}

export function requirePayPalConfig(
    config: AppConfig,
): asserts config is AppConfig & {
    paypalClientId: string;
    paypalClientSecret: string;
    paypalBaseUrl: string;
    paypalWebhookId: string;
    paypalExchangeRate: number;
} {
    if (!paypalConfigurado(config)) {
        throw new AppError(
            "PAYPAL_NO_CONFIGURADO",
            "El marketplace todavía no tiene configuradas las credenciales de PayPal.",
            503,
        );
    }
}

/**
 * Convierte el total comercial (UYU) al importe que se cobra en PayPal.
 * La tasa representa cuántos UYU equivalen a una unidad de la moneda PayPal.
 */
export function decimalesPayPal(moneda: string): number {
    return ["JPY", "HUF", "TWD"].includes(moneda) ? 0 : 2;
}

export function formatearImportePayPal(
    importe: Prisma.Decimal,
    moneda: string,
): string {
    return importe.toFixed(decimalesPayPal(moneda));
}

export function convertirImportePayPal(
    total: Prisma.Decimal,
    tasa: number,
    moneda: string,
): Prisma.Decimal {
    if (!Number.isFinite(tasa) || tasa <= 0) {
        throw new AppError(
            "PAYPAL_TASA_INVALIDA",
            "La tasa de cambio de PayPal no está configurada correctamente.",
            503,
        );
    }
    const decimales = decimalesPayPal(moneda);
    const importe = total
        .div(new Prisma.Decimal(tasa))
        .toDecimalPlaces(decimales, Prisma.Decimal.ROUND_HALF_UP);
    if (importe.lessThan(decimales === 0 ? "1" : "0.01")) {
        throw new AppError(
            "TOTAL_INVALIDO",
            "El importe de la compra es demasiado bajo para procesarse con PayPal.",
            400,
        );
    }
    return importe;
}

function sanitizarMensaje(mensaje: string): string {
    return mensaje
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[correo]")
        .replace(
            /\b(authorization|client[_-]?secret|secret|access[_-]?token|token)\s*[:=]\s*[^,\s]+/gi,
            "$1=[redactado]",
        )
        .slice(0, 240);
}

function extraerErrorPayPal(body: unknown): {
    codigo?: string;
    mensaje?: string;
    debugId?: string;
    issues: string[];
} {
    if (typeof body !== "object" || body === null) {
        return { issues: [] };
    }
    const record = body as Record<string, unknown>;
    const detalles = Array.isArray(record.details) ? record.details : [];
    const issues = detalles
        .map((detalle) => {
            if (typeof detalle !== "object" || detalle === null) return null;
            const item = detalle as Record<string, unknown>;
            return typeof item.issue === "string" ? item.issue : null;
        })
        .filter((issue): issue is string => issue !== null);
    const primerDetalle = detalles.find(
        (detalle): detalle is Record<string, unknown> =>
            typeof detalle === "object" && detalle !== null,
    );
    const descripcionDetalle =
        primerDetalle && typeof primerDetalle.description === "string"
            ? primerDetalle.description
            : undefined;
    const codigo =
        typeof record.name === "string"
            ? record.name
            : typeof record.error === "string"
              ? record.error
              : undefined;
    const mensaje =
        descripcionDetalle ??
        (typeof record.message === "string" ? record.message : undefined);
    const debugId =
        typeof record.debug_id === "string" ? record.debug_id : undefined;
    return {
        ...(codigo ? { codigo } : {}),
        ...(mensaje ? { mensaje } : {}),
        ...(debugId ? { debugId } : {}),
        issues,
    };
}

function esErrorDeRed(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.name === "AbortError" ||
            error.name === "TimeoutError" ||
            error.name === "TypeError")
    );
}

export function validarUrlAprobacionPayPal(valor: string): URL {
    const url = new URL(valor);
    if (
        url.protocol !== "https:" ||
        !(url.hostname === "paypal.com" ||
            url.hostname.endsWith(".paypal.com"))
    ) {
        throw new PayPalRequestError(
            "PayPal devolvió un enlace de aprobación no válido.",
            true,
        );
    }
    return url;
}

export function obtenerEnlaceAprobacion(order: PayPalOrder): string | null {
    const link = order.links?.find(
        (candidato) =>
            candidato.rel === "payer-action" || candidato.rel === "approve",
    );
    return link?.href ?? null;
}

function cantidad(valor: string): Prisma.Decimal {
    return new Prisma.Decimal(valor);
}

export function validarImporteOrden(
    order: PayPalOrder,
    esperado: { importe: Prisma.Decimal; moneda: string; pedidoId: string },
): void {
    const unidad = order.purchase_units?.[0];
    const importe = unidad?.amount;
    const referencia = unidad?.custom_id ?? unidad?.reference_id;
    const coincideImporte = importe
        ? cantidad(importe.value).equals(esperado.importe)
        : false;
    if (
        !unidad ||
        !importe ||
        importe.currency_code !== esperado.moneda ||
        !coincideImporte ||
        referencia !== esperado.pedidoId
    ) {
        console.error(
            JSON.stringify({
                nivel: "error",
                mensaje: "paypal_orden_no_coincide",
                pedidoId: esperado.pedidoId,
                orderId: order.id,
                coincideReferencia: referencia === esperado.pedidoId,
                coincideMoneda: importe?.currency_code === esperado.moneda,
                coincideImporte,
            }),
        );
        throw new PayPalRequestError(
            "La orden devuelta por PayPal no coincide con el pedido.",
            true,
        );
    }
}

export function validarCapturaOrden(
    order: PayPalOrder,
    esperado: {
        pedidoId: string;
        orderId: string;
        importe: Prisma.Decimal;
        moneda: string;
    },
): { captura: PayPalCapture; estado: "COMPLETED" | "PENDING" } | null {
    if (order.id !== esperado.orderId) {
        throw new PayPalRequestError(
            "PayPal devolvió una orden distinta a la solicitada.",
            true,
        );
    }
    const unidad = order.purchase_units?.[0];
    const referencia = unidad?.custom_id ?? unidad?.reference_id;
    const captura = unidad?.payments?.captures?.[0];
    if (
        !unidad ||
        referencia !== esperado.pedidoId ||
        !captura ||
        !captura.amount ||
        captura.amount.currency_code !== esperado.moneda ||
        !cantidad(captura.amount.value).equals(esperado.importe)
    ) {
        console.error(
            JSON.stringify({
                nivel: "error",
                mensaje: "paypal_captura_no_coincide",
                pedidoId: esperado.pedidoId,
                orderId: order.id,
                captureId: captura?.id,
                estadoCaptura: captura?.status,
            }),
        );
        throw new PayPalRequestError(
            "La captura devuelta por PayPal no coincide con el pedido.",
            true,
        );
    }
    if (captura.status === "COMPLETED") {
        return { captura, estado: "COMPLETED" };
    }
    if (captura.status === "PENDING") {
        return { captura, estado: "PENDING" };
    }
    return null;
}

export function createPayPalService(
    config: AppConfig,
    fetcher: typeof fetch = fetch,
): PayPalService {
    const baseUrl = config.paypalBaseUrl.replace(/\/+$/, "");
    let tokenCache: { valor: string; expiraEn: number } | null = null;
    let tokenEnCurso: Promise<string> | null = null;

    const obtenerToken = async (forzar = false): Promise<string> => {
        if (
            !forzar &&
            tokenCache &&
            tokenCache.expiraEn > Date.now() + 5_000
        ) {
            return tokenCache.valor;
        }
        if (!forzar && tokenEnCurso) return tokenEnCurso;

        const solicitud = (async () => {
            const credenciales = Buffer.from(
                `${config.paypalClientId}:${config.paypalClientSecret}`,
            ).toString("base64");
            let response: Response;
            try {
                response = await fetcher(`${baseUrl}/v1/oauth2/token`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Authorization: `Basic ${credenciales}`,
                    },
                    body: "grant_type=client_credentials",
                    signal: AbortSignal.timeout(15_000),
                });
            } catch (error) {
                console.error(
                    JSON.stringify({
                        nivel: "error",
                        mensaje: "paypal_oauth_sin_respuesta",
                        causa: esErrorDeRed(error) ? "timeout_o_red" : "desconocida",
                    }),
                );
                throw new PayPalRequestError(
                    "No se pudo conectar con PayPal para autenticar la aplicación.",
                    true,
                );
            }

            const texto = await response.text();
            let body: unknown;
            try {
                body = JSON.parse(texto);
            } catch {
                body = undefined;
            }
            if (!response.ok) {
                const detalle = extraerErrorPayPal(body);
                console.error(
                    JSON.stringify({
                        nivel: "error",
                        mensaje: "paypal_oauth_rechazado",
                        estadoHttp: response.status,
                        codigo: detalle.codigo,
                        debugId: detalle.debugId,
                    }),
                );
                throw new PayPalRequestError(
                    `PayPal rechazó la autenticación (HTTP ${response.status}).`,
                    false,
                    { statusCode: 502, ...(detalle.codigo ? { paypalCode: detalle.codigo } : {}) },
                );
            }
            const parsed = tokenSchema.safeParse(body);
            if (!parsed.success) {
                console.error(
                    JSON.stringify({
                        nivel: "error",
                        mensaje: "paypal_oauth_respuesta_invalida",
                    }),
                );
                throw new PayPalRequestError(
                    "PayPal devolvió una autenticación incompleta.",
                    true,
                );
            }
            tokenCache = {
                valor: parsed.data.access_token,
                expiraEn: Date.now() + parsed.data.expires_in * 1000,
            };
            return parsed.data.access_token;
        })();

        tokenEnCurso = solicitud;
        try {
            return await solicitud;
        } finally {
            tokenEnCurso = null;
        }
    };

    const solicitar = async <T>(
        path: string,
        init: RequestInit,
        schema: z.ZodType<T>,
        operacion: string,
    ): Promise<T> => {
        let intento = 0;
        while (intento <= MAX_INTENTOS_TOKEN) {
            let token: string;
            try {
                token = await obtenerToken(intento > 0);
            } catch (error) {
                throw error;
            }

            let response: Response;
            try {
                response = await fetcher(`${baseUrl}${path}`, {
                    ...init,
                    signal: init.signal ?? AbortSignal.timeout(15_000),
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        ...init.headers,
                    },
                });
            } catch (error) {
                const aborted =
                    error instanceof Error &&
                    (error.name === "AbortError" ||
                        error.name === "TimeoutError");
                console.error(
                    JSON.stringify({
                        nivel: "error",
                        mensaje: "paypal_sin_respuesta",
                        operacion,
                        causa: aborted ? "timeout" : "network_error",
                    }),
                );
                throw new PayPalRequestError(
                    aborted
                        ? `PayPal agotó el tiempo de espera al ${operacion}.`
                        : `No se pudo conectar con PayPal al ${operacion}.`,
                    true,
                );
            }

            if (response.status === 401 && intento < MAX_INTENTOS_TOKEN) {
                intento += 1;
                tokenCache = null;
                continue;
            }

            const texto = await response.text();
            let body: unknown;
            try {
                body = JSON.parse(texto);
            } catch {
                body = undefined;
            }

            if (!response.ok) {
                const detalle = extraerErrorPayPal(body);
                const mensajeSeguro = detalle.mensaje
                    ? sanitizarMensaje(detalle.mensaje)
                    : "";
                console.error(
                    JSON.stringify({
                        nivel: "error",
                        mensaje: "paypal_respuesta_no_exitosa",
                        operacion,
                        path,
                        estadoHttp: response.status,
                        codigo: detalle.codigo?.slice(0, 80),
                        issues: detalle.issues.slice(0, 5),
                        debugId: detalle.debugId,
                        formatoRespuesta: body === undefined ? "no_json" : "json",
                    }),
                );
                const codigo = detalle.codigo
                    ? `; código ${detalle.codigo.slice(0, 80)}`
                    : "";
                throw new PayPalRequestError(
                    `PayPal rechazó ${operacion} (HTTP ${response.status}${codigo}). ${mensajeSeguro}`,
                    response.status >= 500,
                    {
                        statusCode:
                            response.status >= 400 && response.status < 500
                                ? response.status
                                : 502,
                        ...(detalle.codigo
                            ? { paypalCode: detalle.codigo }
                            : {}),
                        paypalIssues: detalle.issues,
                    },
                );
            }

            if (body === undefined) {
                console.error(
                    JSON.stringify({
                        nivel: "error",
                        mensaje: "paypal_respuesta_invalida",
                        operacion,
                        estadoHttp: response.status,
                    }),
                );
                throw new PayPalRequestError(
                    `PayPal devolvió una respuesta no JSON al ${operacion}.`,
                    true,
                );
            }
            const parsed = schema.safeParse(body);
            if (!parsed.success) {
                console.error(
                    JSON.stringify({
                        nivel: "error",
                        mensaje: "paypal_respuesta_incompleta",
                        operacion,
                        estadoHttp: response.status,
                        camposInvalidos: parsed.error.issues.map((issue) =>
                            issue.path.join("."),
                        ),
                    }),
                );
                throw new PayPalRequestError(
                    `PayPal devolvió datos incompletos al ${operacion}.`,
                    true,
                );
            }
            return parsed.data;
        }

        throw new PayPalRequestError(
            `PayPal no pudo autenticar la solicitud de ${operacion}.`,
            true,
        );
    };

    const service: PayPalService = {
        configurado: paypalConfigurado(config),

        async crearOrden(input) {
            requirePayPalConfig(config);
            const order = await solicitar(
                "/v2/checkout/orders",
                {
                    method: "POST",
                    headers: {
                        "PayPal-Request-Id": `nexo-order-${input.pedidoId}`,
                        Prefer: "return=representation",
                    },
                    body: JSON.stringify({
                        intent: "CAPTURE",
                        purchase_units: [
                            {
                                reference_id: input.pedidoId,
                                custom_id: input.pedidoId,
                                invoice_id: input.pedidoId,
                                description: input.descripcion.slice(0, 127),
                                amount: {
                                    currency_code: input.moneda,
                                    value: input.importe,
                                },
                            },
                        ],
                        payment_source: {
                            paypal: {
                                experience_context: {
                                    brand_name: "NexoERP",
                                    locale: "es-UY",
                                    landing_page: "LOGIN",
                                    shipping_preference: "NO_SHIPPING",
                                    user_action: "PAY_NOW",
                                    return_url: input.returnUrl,
                                    cancel_url: input.cancelUrl,
                                },
                            },
                        },
                    }),
                },
                orderSchema,
                "crear la orden de pago",
            );

            const redirectUrl = obtenerEnlaceAprobacion(order);
            if (!redirectUrl) {
                throw new PayPalRequestError(
                    "PayPal no devolvió el enlace de aprobación del comprador.",
                    true,
                );
            }
            validarUrlAprobacionPayPal(redirectUrl);
            validarImporteOrden(order, {
                importe: cantidad(input.importe),
                moneda: input.moneda,
                pedidoId: input.pedidoId,
            });
            return { orden: order, redirectUrl };
        },

        async obtenerOrden(id) {
            requirePayPalConfig(config);
            if (!/^[A-Z0-9]{1,36}$/.test(id)) {
                throw new AppError(
                    "ORDEN_PAYPAL_INVALIDA",
                    "El identificador de la orden de PayPal no es válido.",
                    400,
                );
            }
            return solicitar(
                `/v2/checkout/orders/${encodeURIComponent(id)}`,
                { method: "GET" },
                orderSchema,
                "consultar la orden de pago",
            );
        },

        async capturarOrden(id) {
            requirePayPalConfig(config);
            if (!/^[A-Z0-9]{1,36}$/.test(id)) {
                throw new AppError(
                    "ORDEN_PAYPAL_INVALIDA",
                    "El identificador de la orden de PayPal no es válido.",
                    400,
                );
            }
            return solicitar(
                `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
                {
                    method: "POST",
                    headers: {
                        "PayPal-Request-Id": `nexo-capture-${id}`,
                        Prefer: "return=representation",
                    },
                    body: JSON.stringify({}),
                },
                orderSchema,
                "capturar el pago",
            );
        },

        async reembolsarCaptura(captureId, input) {
            requirePayPalConfig(config);
            if (!/^[A-Z0-9]{1,36}$/.test(captureId)) {
                throw new AppError(
                    "CAPTURA_PAYPAL_INVALIDA",
                    "El identificador de la captura de PayPal no es válido.",
                    400,
                );
            }
            return solicitar(
                `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
                {
                    method: "POST",
                    headers: {
                        "PayPal-Request-Id": input.idempotencyKey,
                    },
                    body: JSON.stringify({
                        amount: {
                            currency_code: input.moneda,
                            value: input.importe,
                        },
                        invoice_id: input.invoiceId,
                    }),
                },
                refundSchema,
                "crear el reembolso",
            );
        },

        async obtenerReembolso(id) {
            requirePayPalConfig(config);
            if (!/^[A-Z0-9]{1,36}$/.test(id)) {
                throw new AppError(
                    "REEMBOLSO_PAYPAL_INVALIDO",
                    "El identificador del reembolso de PayPal no es válido.",
                    400,
                );
            }
            return solicitar(
                `/v2/payments/refunds/${encodeURIComponent(id)}`,
                { method: "GET" },
                refundSchema,
                "consultar el reembolso",
            );
        },

        async verificarFirmaWebhook(evento, headers) {
            if (!config.paypalWebhookId) {
                throw new AppError(
                    "PAYPAL_WEBHOOK_NO_CONFIGURADO",
                    "El identificador del webhook de PayPal no está configurado.",
                    503,
                );
            }
            const respuesta = await solicitar(
                "/v1/notifications/verify-webhook-signature",
                {
                    method: "POST",
                    body: JSON.stringify({
                        auth_algo: headers.authAlgo,
                        cert_url: headers.certUrl,
                        transmission_id: headers.transmissionId,
                        transmission_sig: headers.transmissionSig,
                        transmission_time: headers.transmissionTime,
                        webhook_id: config.paypalWebhookId,
                        webhook_event: evento,
                    }),
                },
                verificationSchema,
                "verificar la firma del webhook",
            );
            return respuesta.verification_status === "SUCCESS";
        },
    };

    return service;
}
