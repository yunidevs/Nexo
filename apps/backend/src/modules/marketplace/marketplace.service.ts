import {
    createHash,
    createHmac,
    randomInt,
    timingSafeEqual,
} from "node:crypto";
import {
    EstadoEventoWebhookPayPal,
    EstadoPedidoMarketplace,
    MetodoPago,
    Prisma,
    TipoMovimientoInventario,
    type PrismaClient,
} from "@prisma/client";
import { z } from "zod";
import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors/app-error.js";
import { redisGet, redisSet } from "../../lib/redis.js";
import {
    convertirImportePayPal,
    createPayPalService,
    formatearImportePayPal,
    obtenerEnlaceAprobacion,
    paypalConfigurado,
    PayPalRequestError,
    requirePayPalConfig,
    validarCapturaOrden,
    validarImporteOrden,
    validarUrlAprobacionPayPal,
    type PayPalCapture,
    type PayPalOrder,
    type PayPalRefund,
    type PayPalWebhookHeaders,
} from "./paypal.service.js";
import {
    createWhatsappService,
    requireWhatsappConfig,
} from "./whatsapp.service.js";
import { resolverClienteCompra } from "../clientes/clientes.service.js";
import { normalizarTelefono } from "../comun/telefono.js";
import {
    generarTokenSeguimiento,
    verificarTokenSeguimiento,
} from "../comun/crypto.js";

const IMPORTE_MAXIMO = new Prisma.Decimal("9999999999.99");
const VIGENCIA_PEDIDO_MS = 30 * 60 * 1000;
const VIGENCIA_CODIGO_MS = 10 * 60 * 1000;
const ESPERA_REENVIO_CODIGO_MS = 60 * 1000;
const LIMITE_CODIGOS_POR_HORA = 5;
const MAX_INTENTOS_CODIGO = 5;
const CAMPOS_PRODUCTO_TIENDA = {
    id: true,
    sku: true,
    nombre: true,
    precioVenta: true,
    categoria: true,
    imagenUrl: true,
    stock: true,
    stockReservado: true,
} satisfies Prisma.ProductoSelect;

const recursoEventoPayPalSchema = z
    .object({
        id: z.string().min(1).max(100).optional(),
        status: z.string().optional(),
        amount: z
            .object({
                value: z.string().optional(),
                currency_code: z.string().optional(),
            })
            .optional(),
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
    })
    .passthrough();

const eventoWebhookPayPalSchema = z.object({
    id: z.string().min(1).max(100),
    event_type: z.string().min(1).max(100),
    resource: recursoEventoPayPalSchema.optional(),
});

export interface ArticuloCheckout {
    productoId: string;
    cantidad: number;
}

export interface DatosCheckoutMarketplace {
    tiendaSlug: string;
    nombre: string;
    correo: string;
    telefono: string;
    departamento: string;
    localidad: string;
    direccion: string;
    codigoPostal?: string | undefined;
    notaEntrega?: string | undefined;
    detalles: ArticuloCheckout[];
}

export interface DatosTiendaMarketplace {
    activa: boolean;
    slug: string;
    costoEnvio: number;
}

export interface ProductoMarketplacePublico {
    id: string;
    sku: string;
    nombre: string;
    precioVenta: Prisma.Decimal;
    categoria: string | null;
    imagenUrl: string | null;
    stock: number;
}

export interface TiendaMarketplacePublica {
    id: string;
    nombre: string;
    slug: string;
    tasaImpuesto: Prisma.Decimal;
    costoEnvio: Prisma.Decimal;
    comisionPorcentaje: number;
    productos: ProductoMarketplacePublico[];
}

export interface ConfiguracionMarketplacePublica {
    tiendaActiva: boolean;
    tiendaSlug: string | null;
    costoEnvio: Prisma.Decimal;
    paypalConfigurado: boolean;
    comisionPorcentaje: number;
}

/**
 * Resultado de conectar o desconectar la tienda del marketplace.
 *
 * - pedidosPendientes: pedidos que siguen abiertos. La desconexión no los
 *   cancela ni los modifica: se informan para que el administrador sepa
 *   que debe atenderlos.
 * - productosPublicados: productos que la empresa marcó individualmente
 *   para el marketplace. Al reconectar la tienda vuelven a ser visibles
 *   solo los que mantienen esa marca; los demás siguen ocultos.
 */
export interface EstadoConexionTienda {
    configuracion: ConfiguracionMarketplacePublica;
    pedidosPendientes: number;
    productosPublicados: number;
}

export interface EstadoPagoMarketplace {
    pedidoId: string;
    estado: EstadoPedidoMarketplace;
    total: Prisma.Decimal;
    tienda: string;
    creadaEn: Date;
    trackingUrl?: string;
}

export interface SeguimientoPedidoPublico {
    id: string;
    estado: EstadoPedidoMarketplace;
    nombreComprador: string;
    creadaEn: Date;
    actualizadaEn: Date;
    tienda: string;
    detalles: {
        nombre: string;
        cantidad: number;
    }[];
    historial: {
        estado: EstadoPedidoMarketplace;
        detalle: string;
        observaciones: string | null;
        fecha: Date;
        /// Solo lo expone el historial administrativo; el seguimiento público
        /// no incluye el nombre del responsable.
        responsable?: string | null;
    }[];
}

export interface ResultadoPublicacionMarketplace {
    visible: boolean;
    requisitosPendientes: string[];
}

export interface CodigoVerificacionEnviado {
    telefono: string;
    expiraEn: string;
}


const camposPedidoMarketplace = {
    id: true,
    estado: true,
    nombreComprador: true,
    correoComprador: true,
    telefonoComprador: true,
    departamento: true,
    localidad: true,
    direccion: true,
    codigoPostal: true,
    notaEntrega: true,
    subtotal: true,
    impuesto: true,
    costoEnvio: true,
    total: true,
    comision: true,
    creadaEn: true,
    pagadaEn: true,
    ventaId: true,
    detalles: {
        select: {
            id: true,
            sku: true,
            nombre: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true,
        },
    },
} satisfies Prisma.PedidoMarketplaceSelect;

export type PedidoMarketplacePublico = Prisma.PedidoMarketplaceGetPayload<{
    select: typeof camposPedidoMarketplace;
}>;

export interface MarketplaceService {
    listarTiendas(): Promise<TiendaMarketplacePublica[]>;
    obtenerTienda(slug: string): Promise<TiendaMarketplacePublica>;
    listarCatalogo(
        filtros: FiltrosCatalogoMarketplace,
    ): Promise<ResultadoCatalogoMarketplace>;
    listarCategoriasPublicas(): Promise<CategoriaPublicaMarketplace[]>;
    obtenerProductoPublico(id: string): Promise<ProductoDetalleMarketplace>;
    obtenerPedidoPublico(id: string): Promise<EstadoPagoMarketplace>;
    obtenerSeguimientoPedidoPublico(
        id: string,
        token: string,
    ): Promise<SeguimientoPedidoPublico>;
    obtenerHistorialPedido(
        empresaId: string,
        pedidoId: string,
    ): Promise<SeguimientoPedidoPublico>;
    enviarCodigoVerificacionTelefono(
        telefono: string,
    ): Promise<CodigoVerificacionEnviado>;
    verificarTelefono(telefono: string, codigo: string): Promise<void>;
    crearCheckout(
        datos: DatosCheckoutMarketplace,
        idempotencyKey: string,
        cuentaClienteId?: string,
    ): Promise<{ pedidoId: string; urlPago: string }>;
    capturarPedido(
        pedidoId: string,
        paypalOrderId: string,
    ): Promise<EstadoPedidoMarketplace>;
    cancelarPedido(
        pedidoId: string,
        paypalOrderId: string,
    ): Promise<EstadoPedidoMarketplace>;
    obtenerConfiguracion(
        empresaId: string,
    ): Promise<ConfiguracionMarketplacePublica>;
    actualizarConfiguracion(
        empresaId: string,
        datos: DatosTiendaMarketplace,
    ): Promise<ConfiguracionMarketplacePublica>;
    actualizarConexionTienda(
        empresaId: string,
        conectada: boolean,
    ): Promise<EstadoConexionTienda>;
    obtenerEstadoTienda(empresaId: string): Promise<EstadoConexionTienda>;
    procesarNotificacion(
        evento: unknown,
        headers: PayPalWebhookHeaders,
    ): Promise<void>;
    publicarProducto(
        empresaId: string,
        productoId: string,
        publicado: boolean,
    ): Promise<ResultadoPublicacionMarketplace>;
    listarPedidos(empresaId: string): Promise<PedidoMarketplacePublico[]>;
    actualizarEstadoPedido(
        empresaId: string,
        pedidoId: string,
        estado: EstadoPedidoMarketplace,
        usuarioId?: string | null,
        observaciones?: string,
    ): Promise<void>;
    reembolsarPedido(
        empresaId: string,
        usuarioId: string | null,
        pedidoId: string,
    ): Promise<EstadoPedidoMarketplace>;
    liberarPedidosVencidos(): Promise<void>;
}

export function calcularComisionMarketplace(
    total: Prisma.Decimal,
    porcentaje: number,
): Prisma.Decimal {
    return total
        .mul(new Prisma.Decimal(porcentaje))
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Pedidos que siguen abiertos y que la desconexión no cancela. */
const ESTADOS_PEDIDO_ABIERTOS = [
    EstadoPedidoMarketplace.PENDIENTE_PAGO,
    EstadoPedidoMarketplace.PAGO_CONFIRMADO,
    EstadoPedidoMarketplace.PREPARANDO,
    EstadoPedidoMarketplace.DESPACHADO,
    EstadoPedidoMarketplace.ENVIADO,
    EstadoPedidoMarketplace.EN_TRANSITO,
    EstadoPedidoMarketplace.EN_REPARTO,
] as const;

/**
 * Resumen de la conexión de la tienda con el marketplace: pedidos que
 * quedan abiertos y productos marcados individualmente para publicar.
 */
async function resumenConexionTienda(
    prisma: PrismaClient,
    empresaId: string,
): Promise<{ pedidosPendientes: number; productosPublicados: number }> {
    const [pedidosPendientes, productosPublicados] = await Promise.all([
        prisma.pedidoMarketplace.count({
            where: { empresaId, estado: { in: [...ESTADOS_PEDIDO_ABIERTOS] } },
        }),
        prisma.producto.count({
            where: { empresaId, activo: true, publicadoMarketplace: true },
        }),
    ]);
    return { pedidosPendientes, productosPublicados };
}

function reservationLost(): AppError {
    return new AppError(
        "RESERVA_STOCK_PERDIDA",
        "No se pudo completar el pedido porque las existencias reservadas ya no están disponibles.",
        409,
    );
}

function mapearTienda(tienda: {
    id: string;
    nombre: string;
    tiendaSlug: string | null;
    tasaImpuesto: Prisma.Decimal;
    costoEnvio: Prisma.Decimal;
    productos: Array<{
        id: string;
        sku: string;
        nombre: string;
        precioVenta: Prisma.Decimal;
        categoria: string | null;
        imagenUrl: string | null;
        stock: number;
        stockReservado: number;
    }>;
}, comisionPorcentaje: number): TiendaMarketplacePublica {
    if (!tienda.tiendaSlug) {
        throw new AppError(
            "TIENDA_NO_ENCONTRADA",
            "La tienda no existe o no está publicada.",
            404,
        );
    }
    return {
        id: tienda.id,
        nombre: tienda.nombre,
        slug: tienda.tiendaSlug,
        tasaImpuesto: tienda.tasaImpuesto,
        costoEnvio: tienda.costoEnvio,
        comisionPorcentaje,
        productos: tienda.productos
            .map((producto) => ({
                id: producto.id,
                sku: producto.sku,
                nombre: producto.nombre,
                precioVenta: producto.precioVenta,
                categoria: producto.categoria,
                imagenUrl: producto.imagenUrl,
                stock: Math.max(0, producto.stock - producto.stockReservado),
            }))
    };
}

const camposTienda = {
    id: true,
    nombre: true,
    tiendaSlug: true,
    tasaImpuesto: true,
    costoEnvio: true,
    productos: {
        where: {
            activo: true,
            publicadoMarketplace: true,
        },
        select: CAMPOS_PRODUCTO_TIENDA,
        orderBy: { nombre: "asc" },
    },
} satisfies Prisma.EmpresaSelect;

async function cargarTiendaPublica(prisma: PrismaClient, slug?: string) {
    return prisma.empresa.findMany({
        where: {
            tiendaActiva: true,
            tiendaSlug: slug ? slug : { not: null },
        },
        select: camposTienda,
        orderBy: { nombre: "asc" },
    });
}

export type OrdenCatalogoMarketplace =
    | "relevancia"
    | "recientes"
    | "populares"
    | "precio-asc"
    | "precio-desc"
    | "nombre";

export interface FiltrosCatalogoMarketplace {
    busqueda?: string | undefined;
    categoria?: string | undefined;
    empresaSlug?: string | undefined;
    precioMin?: number | undefined;
    precioMax?: number | undefined;
    soloDisponibles: boolean;
    orden: OrdenCatalogoMarketplace;
    pagina: number;
    porPagina: number;
}

export interface ProductoCatalogoPublico {
    id: string;
    sku: string;
    nombre: string;
    precioVenta: Prisma.Decimal;
    categoria: string | null;
    imagenUrl: string | null;
    stock: number;
    empresa: { id: string; nombre: string; slug: string };
}

export interface ResultadoCatalogoMarketplace {
    productos: ProductoCatalogoPublico[];
    total: number;
    pagina: number;
    porPagina: number;
    totalPaginas: number;
}

export interface ProductoDetalleMarketplace {
    producto: ProductoCatalogoPublico;
    relacionados: ProductoCatalogoPublico[];
}

export interface CategoriaPublicaMarketplace {
    nombre: string;
    cantidad: number;
}

const CAMPOS_PRODUCTO_CATALOGO = {
    id: true,
    sku: true,
    nombre: true,
    precioVenta: true,
    categoria: true,
    imagenUrl: true,
    stock: true,
    stockReservado: true,
    empresa: { select: { id: true, nombre: true, tiendaSlug: true } },
} satisfies Prisma.ProductoSelect;

function mapearProductoCatalogo(producto: {
    id: string;
    sku: string;
    nombre: string;
    precioVenta: Prisma.Decimal;
    categoria: string | null;
    imagenUrl: string | null;
    stock: number;
    stockReservado: number;
    empresa: { id: string; nombre: string; tiendaSlug: string | null };
}): ProductoCatalogoPublico {
    if (!producto.empresa.tiendaSlug) {
        throw new AppError(
            "PRODUCTO_NO_DISPONIBLE",
            "El producto no está disponible en el marketplace.",
            404,
        );
    }
    return {
        id: producto.id,
        sku: producto.sku,
        nombre: producto.nombre,
        precioVenta: producto.precioVenta,
        categoria: producto.categoria,
        imagenUrl: producto.imagenUrl,
        stock: Math.max(0, producto.stock - producto.stockReservado),
        empresa: {
            id: producto.empresa.id,
            nombre: producto.empresa.nombre,
            slug: producto.empresa.tiendaSlug,
        },
    };
}

function condicionesCatalogo(
    filtros: FiltrosCatalogoMarketplace,
    prisma: PrismaClient,
): {
    where: Prisma.ProductoWhereInput;
    orderBy: Prisma.ProductoOrderByWithRelationInput[];
} {
    const where: Prisma.ProductoWhereInput = {
        activo: true,
        publicadoMarketplace: true,
        empresa: {
            tiendaActiva: true,
            tiendaSlug: filtros.empresaSlug ?? { not: null },
        },
    };
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
        const contiene = {
            contains: busqueda,
            mode: "insensitive" as const,
        };
        where.OR = [
            { nombre: contiene },
            { sku: contiene },
            { categoria: contiene },
            { empresa: { nombre: contiene } },
        ];
    }
    if (filtros.categoria) {
        where.categoria = filtros.categoria;
    }
    if (filtros.precioMin !== undefined || filtros.precioMax !== undefined) {
        where.precioVenta = {
            ...(filtros.precioMin !== undefined
                ? { gte: new Prisma.Decimal(filtros.precioMin) }
                : {}),
            ...(filtros.precioMax !== undefined
                ? { lte: new Prisma.Decimal(filtros.precioMax) }
                : {}),
        };
    }
    if (filtros.soloDisponibles) {
        where.stockReservado = { lt: prisma.producto.fields.stock };
    }
    const ordenamientos: Record<
        OrdenCatalogoMarketplace,
        Prisma.ProductoOrderByWithRelationInput[]
    > = {
        relevancia: [{ stock: "desc" }, { creadaEn: "desc" }, { id: "asc" }],
        recientes: [{ creadaEn: "desc" }, { id: "desc" }],
        populares: [{ detallesVenta: { _count: "desc" } }, { id: "asc" }],
        "precio-asc": [{ precioVenta: "asc" }, { id: "asc" }],
        "precio-desc": [{ precioVenta: "desc" }, { id: "asc" }],
        nombre: [{ nombre: "asc" }, { id: "asc" }],
    };
    return { where, orderBy: ordenamientos[filtros.orden] };
}

export const createMarketplaceService = (
    prisma: PrismaClient,
    config: AppConfig,
    fetcher: typeof fetch = fetch,
): MarketplaceService => {
    const paypal = createPayPalService(config, fetcher);
    const whatsapp = createWhatsappService(config, fetcher);

    // Las transacciones que confirman pagos o crean pedidos encadenan varias
    // consultas; contra una base remota el timeout interactivo por defecto de
    // Prisma (5 s) puede quedar corto y abortar la operación a mitad.
    const OPCIONES_TRANSACCION = {
        maxWait: 10_000,
        timeout: 30_000,
    } as const;

    // El código se guarda solo como HMAC para que un acceso a la base de
    // datos no exponga los códigos de 6 dígitos (fuerza bruta inviable).
    const hashCodigoVerificacion = (telefono: string, codigo: string) =>
        createHmac("sha256", config.jwtSecret)
            .update(`${telefono}:${codigo}`)
            .digest("hex");

    const liberarReservaPedido = async (
        pedidoId: string,
        estadoFinal: EstadoPedidoMarketplace,
    ) =>
        prisma.$transaction(async (tx) => {
            await tx.$queryRaw(
                Prisma.sql`SELECT "id" FROM "pedidos_marketplace" WHERE "id" = ${pedidoId}::uuid FOR UPDATE`,
            );
            const pedido = await tx.pedidoMarketplace.findUnique({
                where: { id: pedidoId },
                select: {
                    estado: true,
                    detalles: {
                        select: { productoId: true, cantidad: true },
                        orderBy: { productoId: "asc" },
                    },
                },
            });
            if (!pedido || pedido.estado !== EstadoPedidoMarketplace.PENDIENTE_PAGO) {
                return;
            }

            for (const detalle of pedido.detalles) {
                const actualizacion = await tx.producto.updateMany({
                    where: {
                        id: detalle.productoId,
                        stockReservado: { gte: detalle.cantidad },
                    },
                    data: { stockReservado: { decrement: detalle.cantidad } },
                });
                if (actualizacion.count !== 1) throw reservationLost();
            }
            await tx.pedidoMarketplace.update({
                where: { id: pedidoId },
                data: {
                    estado: estadoFinal,
                    ...(estadoFinal === EstadoPedidoMarketplace.CANCELADO
                        ? {
                              idempotencyKey: null,
                              idempotencyRequestHash: null,
                              paypalRedirectUrl: null,
                          }
                        : {}),
                },
            });
        });

    const liberarPedidosVencidos = async () => {
        const vencidos = await prisma.pedidoMarketplace.findMany({
            where: {
                estado: EstadoPedidoMarketplace.PENDIENTE_PAGO,
                paypalCaptureId: null,
                expiraEn: { lte: new Date() },
            },
            select: { id: true },
            orderBy: { expiraEn: "asc" },
            take: 100,
        });
        for (const pedido of vencidos) {
            await liberarReservaPedido(
                pedido.id,
                EstadoPedidoMarketplace.CANCELADO,
            );
        }
    };

    const registrarEventoSeguimiento = async (
        tx: Prisma.TransactionClient,
        pedidoId: string,
        estado: EstadoPedidoMarketplace,
        detalle: string,
        observaciones?: string,
        usuarioId?: string | null,
    ) => {
        await tx.seguimientoPedido.create({
            data: {
                pedidoId,
                estado,
                detalle,
                ...(observaciones ? { observaciones } : {}),
                ...(usuarioId ? { usuarioId } : {}),
            },
        });
    };

    const registrarPagoAprobado = async (
        pedidoId: string,
        captura: PayPalCapture,
        esperado: {
            orderId: string;
            importe: Prisma.Decimal;
            moneda: string;
        },
    ) => {
        const pedidoPrevio = await prisma.pedidoMarketplace.findUnique({
            where: { id: pedidoId },
            select: {
                estado: true,
                paypalOrderId: true,
                paypalAmount: true,
                paypalCurrency: true,
            },
        });
        if (!pedidoPrevio) {
            throw new AppError(
                "PEDIDO_NO_ENCONTRADO",
                "El pedido del marketplace no existe.",
                404,
            );
        }
        if (
            pedidoPrevio.paypalOrderId !== esperado.orderId ||
            !pedidoPrevio.paypalAmount ||
            !pedidoPrevio.paypalCurrency ||
            !pedidoPrevio.paypalAmount.equals(esperado.importe) ||
            pedidoPrevio.paypalCurrency !== esperado.moneda
        ) {
            throw new AppError(
                "PAGO_NO_COINCIDE",
                "El pago confirmado por PayPal no coincide con el pedido.",
                409,
            );
        }
        if (pedidoPrevio.estado === EstadoPedidoMarketplace.CANCELADO) {
            throw reservationLost();
        }
        if (pedidoPrevio.estado !== EstadoPedidoMarketplace.PENDIENTE_PAGO) {
            return;
        }

        try {
            await prisma.$transaction(async (tx) => {
                await tx.$queryRaw(
                    Prisma.sql`SELECT "id" FROM "pedidos_marketplace" WHERE "id" = ${pedidoId}::uuid FOR UPDATE`,
                );
                const pedido = await tx.pedidoMarketplace.findUnique({
                    where: { id: pedidoId },
                    include: {
                        empresa: { select: { nombre: true } },
                        detalles: {
                            orderBy: { productoId: "asc" },
                        },
                    },
                });
                if (!pedido) {
                    throw new AppError(
                        "PEDIDO_NO_ENCONTRADO",
                        "El pedido del marketplace no existe.",
                        404,
                    );
                }
                if (pedido.estado !== EstadoPedidoMarketplace.PENDIENTE_PAGO) {
                    return;
                }
                if (
                    pedido.paypalOrderId !== esperado.orderId ||
                    !pedido.paypalAmount ||
                    !pedido.paypalCurrency ||
                    !pedido.paypalAmount.equals(esperado.importe) ||
                    pedido.paypalCurrency !== esperado.moneda
                ) {
                    throw new AppError(
                        "PAGO_NO_COINCIDE",
                        "El pago confirmado por PayPal no coincide con el pedido.",
                        409,
                    );
                }

                const idsProductos = pedido.detalles.map(
                    ({ productoId }) => productoId,
                );
                await tx.$queryRaw(
                    Prisma.sql`SELECT "id" FROM "productos" WHERE "id" IN (${Prisma.join(idsProductos.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`,
                );

                const cliente = await resolverClienteCompra(tx, pedido.empresaId, {
                    nombre: pedido.nombreComprador,
                    correo: pedido.correoComprador,
                    telefono: pedido.telefonoComprador,
                    direccion: pedido.direccion,
                    localidad: pedido.localidad,
                    departamento: pedido.departamento,
                });

                if (pedido.cuentaClienteId) {
                    await tx.cliente.updateMany({
                        where: {
                            id: cliente.id,
                            cuentaClienteId: null,
                        },
                        data: { cuentaClienteId: pedido.cuentaClienteId },
                    });
                }

                for (const detalle of pedido.detalles) {
                    const producto = await tx.producto.findFirst({
                        where: {
                            id: detalle.productoId,
                            empresaId: pedido.empresaId,
                        },
                        select: { id: true, stock: true },
                    });
                    if (!producto || producto.stock < detalle.cantidad) {
                        throw reservationLost();
                    }
                    const stockNuevo = producto.stock - detalle.cantidad;
                    const actualizado = await tx.producto.updateMany({
                        where: {
                            id: producto.id,
                            stock: producto.stock,
                            stockReservado: { gte: detalle.cantidad },
                        },
                        data: {
                            stock: { decrement: detalle.cantidad },
                            stockReservado: { decrement: detalle.cantidad },
                        },
                    });
                    if (actualizado.count !== 1) throw reservationLost();
                    await tx.movimientoInventario.create({
                        data: {
                            empresaId: pedido.empresaId,
                            productoId: producto.id,
                            usuarioId: null,
                            tipo: TipoMovimientoInventario.SALIDA,
                            cantidad: -detalle.cantidad,
                            stockAnterior: producto.stock,
                            stockNuevo,
                            motivo: `Venta marketplace ${pedido.id}`,
                        },
                    });
                }

                const venta = await tx.venta.create({
                    data: {
                        empresaId: pedido.empresaId,
                        clienteId: cliente.id,
                        usuarioId: null,
                        subtotal: pedido.subtotal,
                        descuento: new Prisma.Decimal(0),
                        tasaImpuesto: pedido.tasaImpuesto,
                        impuesto: pedido.impuesto,
                        costoEnvio: pedido.costoEnvio,
                        total: pedido.total,
                        detalles: {
                            create: pedido.detalles.map((detalle) => ({
                                productoId: detalle.productoId,
                                cantidad: detalle.cantidad,
                                precioUnitario: detalle.precioUnitario,
                                subtotal: detalle.subtotal,
                            })),
                        },
                        pagos: {
                            create: {
                                usuarioId: null,
                                metodo: MetodoPago.PAYPAL,
                                monto: pedido.total,
                            },
                        },
                    },
                    select: { id: true },
                });
                await tx.pedidoMarketplace.update({
                    where: { id: pedido.id },
                    data: {
                        estado: EstadoPedidoMarketplace.PAGO_CONFIRMADO,
                        paypalOrderId: esperado.orderId,
                        paypalCaptureId: captura.id,
                        ventaId: venta.id,
                        clienteId: cliente.id,
                        pagadaEn: new Date(),
                    },
                });

                await registrarEventoSeguimiento(
                    tx,
                    pedido.id,
                    EstadoPedidoMarketplace.PAGO_CONFIRMADO,
                    "Pago confirmado exitosamente vía PayPal.",
                    `Orden PayPal: ${esperado.orderId}, Captura: ${captura.id}`,
                );
            }, OPCIONES_TRANSACCION);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                throw new AppError(
                    "PAGO_NO_COINCIDE",
                    "La captura de PayPal ya está asociada a otro pedido.",
                    409,
                );
            }
            throw error;
        }
    };

    const aplicarReembolsoConfirmado = async (
        pedidoId: string,
        empresaId: string,
        usuarioId: string | null,
    ): Promise<EstadoPedidoMarketplace> =>
        prisma.$transaction(async (tx) => {
            await tx.$queryRaw(
                Prisma.sql`SELECT "id" FROM "pedidos_marketplace" WHERE "id" = ${pedidoId}::uuid FOR UPDATE`,
            );
            const pedidoActual = await tx.pedidoMarketplace.findFirst({
                where: { id: pedidoId, empresaId },
                select: { estado: true, ventaId: true },
            });
            if (!pedidoActual) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido no existe en esta empresa.",
                    404,
                );
            }
            if (pedidoActual.estado === EstadoPedidoMarketplace.REEMBOLSADO) {
                return EstadoPedidoMarketplace.REEMBOLSADO;
            }
            if (
                pedidoActual.estado !==
                EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE
            ) {
                throw new AppError(
                    "PEDIDO_NO_REEMBOLSABLE",
                    "El pedido cambió de estado durante el reembolso.",
                    409,
                );
            }

            if (pedidoActual.ventaId) {
                await tx.$queryRaw(
                    Prisma.sql`SELECT "id" FROM "ventas" WHERE "id" = ${pedidoActual.ventaId}::uuid FOR UPDATE`,
                );
                const venta = await tx.venta.findUnique({
                    where: { id: pedidoActual.ventaId },
                    select: {
                        id: true,
                        estado: true,
                        detalles: {
                            select: {
                                cantidad: true,
                                productoId: true,
                                producto: {
                                    select: { nombre: true },
                                },
                            },
                            orderBy: { productoId: "asc" },
                        },
                    },
                });
                if (venta?.estado === "CONFIRMADA") {
                    const idsProductos = venta.detalles.map(
                        ({ productoId }) => productoId,
                    );
                    await tx.$queryRaw(
                        Prisma.sql`SELECT "id" FROM "productos" WHERE "id" IN (${Prisma.join(idsProductos.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`,
                    );
                    const canceladaEn = new Date();
                    const cancelacion = await tx.venta.updateMany({
                        where: {
                            id: venta.id,
                            empresaId,
                            estado: "CONFIRMADA",
                        },
                        data: {
                            estado: "CANCELADA",
                            canceladaEn,
                            canceladaPorId: usuarioId,
                        },
                    });
                    if (cancelacion.count !== 1) {
                        throw new AppError(
                            "VENTA_MODIFICADA",
                            "La venta cambió durante el reembolso. Reintenta la operación.",
                            409,
                        );
                    }
                    for (const detalle of venta.detalles) {
                        const producto = await tx.producto.findFirst({
                            where: { id: detalle.productoId, empresaId },
                            select: { id: true, stock: true },
                        });
                        if (!producto) {
                            throw new AppError(
                                "PRODUCTO_NO_ENCONTRADO",
                                "Un producto del pedido ya no está disponible.",
                                409,
                            );
                        }
                        const stockNuevo = producto.stock + detalle.cantidad;
                        if (stockNuevo > 2_147_483_647) {
                            throw new AppError(
                                "STOCK_INVALIDO",
                                "El reembolso supera el máximo de existencias permitido.",
                                409,
                            );
                        }
                        const actualizacion = await tx.producto.updateMany({
                            where: {
                                id: producto.id,
                                empresaId,
                                stock: producto.stock,
                            },
                            data: {
                                stock: { increment: detalle.cantidad },
                            },
                        });
                        if (actualizacion.count !== 1) {
                            throw new AppError(
                                "STOCK_MODIFICADO",
                                "El stock cambió durante el reembolso. Reintenta la operación.",
                                409,
                            );
                        }
                        await tx.movimientoInventario.create({
                            data: {
                                empresaId,
                                productoId: producto.id,
                                usuarioId,
                                tipo: TipoMovimientoInventario.DEVOLUCION,
                                cantidad: detalle.cantidad,
                                stockAnterior: producto.stock,
                                stockNuevo,
                                motivo: `Reembolso marketplace ${pedidoId}: ${detalle.producto.nombre}`,
                            },
                        });
                    }
                }
            }
            await tx.pedidoMarketplace.update({
                where: { id: pedidoId },
                data: { estado: EstadoPedidoMarketplace.REEMBOLSADO },
            });

            await registrarEventoSeguimiento(
                tx,
                pedidoId,
                EstadoPedidoMarketplace.REEMBOLSADO,
                "El pedido ha sido reembolsado exitosamente.",
                `Usuario: ${usuarioId ?? "Sistema"}`,
                usuarioId,
            );

            return EstadoPedidoMarketplace.REEMBOLSADO;
        }, OPCIONES_TRANSACCION);

    const reembolsarTrasPagoSinStock = async (
        pedidoId: string,
        empresaId: string,
        captureId: string,
    ) => {
        await liberarReservaPedido(
            pedidoId,
            EstadoPedidoMarketplace.CANCELADO,
        );
        await reembolsarCapturaNoAplicada(pedidoId, empresaId, captureId);
    };

    const reembolsarCapturaNoAplicada = async (
        pedidoId: string,
        empresaId: string,
        captureId: string,
    ) => {
        const actualizado = await prisma.pedidoMarketplace.updateMany({
            where: {
                id: pedidoId,
                estado: EstadoPedidoMarketplace.CANCELADO,
            },
            data: {
                estado: EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE,
                paypalCaptureId: captureId,
            },
        });
        if (actualizado.count === 1) {
            await service.reembolsarPedido(empresaId, null, pedidoId);
        }
    };

    const buscarPedidoPorOrden = (orderId: string) =>
        prisma.pedidoMarketplace.findUnique({
            where: { paypalOrderId: orderId },
            select: {
                id: true,
                empresaId: true,
                estado: true,
                expiraEn: true,
                paypalAmount: true,
                paypalCurrency: true,
                paypalCaptureId: true,
            },
        });

    const procesarEventoPayPal = async (
        evento: z.infer<typeof eventoWebhookPayPalSchema>,
    ): Promise<{ pedidoId?: string }> => {
        const recurso = evento.resource;
        if (!recurso) return {};

        if (
            evento.event_type === "PAYMENT.CAPTURE.COMPLETED" ||
            evento.event_type === "PAYMENT.CAPTURE.DENIED" ||
            evento.event_type === "PAYMENT.CAPTURE.DECLINED"
        ) {
            const orderId =
                recurso.supplementary_data?.related_ids?.order_id;
            if (!orderId || !recurso.id || !recurso.status) {
                throw new AppError(
                    "NOTIFICACION_INVALIDA",
                    "La notificación de captura de PayPal está incompleta.",
                    400,
                );
            }
            const pedido = await buscarPedidoPorOrden(orderId);
            if (!pedido) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido notificado por PayPal no existe.",
                    404,
                );
            }

            if (
                evento.event_type === "PAYMENT.CAPTURE.DENIED" ||
                evento.event_type === "PAYMENT.CAPTURE.DECLINED"
            ) {
                await liberarReservaPedido(
                    pedido.id,
                    EstadoPedidoMarketplace.CANCELADO,
                );
                return { pedidoId: pedido.id };
            }

            const importeNotificado = recurso.amount;
            if (
                recurso.status !== "COMPLETED" ||
                !importeNotificado?.value ||
                !importeNotificado.currency_code ||
                !pedido.paypalAmount ||
                !pedido.paypalCurrency ||
                importeNotificado.currency_code !== pedido.paypalCurrency ||
                !new Prisma.Decimal(importeNotificado.value).equals(
                    pedido.paypalAmount,
                )
            ) {
                throw new AppError(
                    "PAGO_NO_COINCIDE",
                    "La captura notificada por PayPal no coincide con el pedido.",
                    409,
                );
            }
            if (
                pedido.paypalCaptureId &&
                pedido.paypalCaptureId !== recurso.id
            ) {
                throw new AppError(
                    "PAGO_NO_COINCIDE",
                    "La captura notificada por PayPal ya está asociada a otro pago.",
                    409,
                );
            }

            const captura: PayPalCapture = {
                id: recurso.id,
                status: recurso.status,
                amount: {
                    currency_code: importeNotificado.currency_code,
                    value: importeNotificado.value,
                },
            };

            if (pedido.estado === EstadoPedidoMarketplace.PAGO_CONFIRMADO) {
                return { pedidoId: pedido.id };
            }
            if (pedido.estado === EstadoPedidoMarketplace.CANCELADO) {
                await reembolsarCapturaNoAplicada(
                    pedido.id,
                    pedido.empresaId,
                    recurso.id,
                );
                return { pedidoId: pedido.id };
            }
            if (pedido.estado !== EstadoPedidoMarketplace.PENDIENTE_PAGO) {
                return { pedidoId: pedido.id };
            }
            if (pedido.expiraEn.getTime() <= Date.now()) {
                await liberarReservaPedido(
                    pedido.id,
                    EstadoPedidoMarketplace.CANCELADO,
                );
                await reembolsarCapturaNoAplicada(
                    pedido.id,
                    pedido.empresaId,
                    recurso.id,
                );
                return { pedidoId: pedido.id };
            }

            try {
                await registrarPagoAprobado(pedido.id, captura, {
                    orderId,
                    importe: pedido.paypalAmount,
                    moneda: pedido.paypalCurrency,
                });
            } catch (error) {
                if (
                    error instanceof AppError &&
                    error.codigo === "RESERVA_STOCK_PERDIDA"
                ) {
                    await reembolsarTrasPagoSinStock(
                        pedido.id,
                        pedido.empresaId,
                        captura.id,
                    );
                    return { pedidoId: pedido.id };
                }
                throw error;
            }
            return { pedidoId: pedido.id };
        }

        if (
            evento.event_type === "PAYMENT.CAPTURE.REFUNDED" ||
            evento.event_type === "PAYMENT.CAPTURE.REVERSED"
        ) {
            const orderId =
                recurso.supplementary_data?.related_ids?.order_id;
            const captureId =
                recurso.supplementary_data?.related_ids?.capture_id;
            const pedido = await prisma.pedidoMarketplace.findFirst({
                where: {
                    OR: [
                        ...(orderId ? [{ paypalOrderId: orderId }] : []),
                        ...(captureId ? [{ paypalCaptureId: captureId }] : []),
                        ...(recurso.id
                            ? [
                                  { paypalCaptureId: recurso.id },
                                  { paypalRefundId: recurso.id },
                              ]
                            : []),
                    ],
                },
                select: {
                    id: true,
                    empresaId: true,
                    estado: true,
                    paypalAmount: true,
                    paypalCurrency: true,
                },
            });
            if (!pedido) return {};
            if (
                pedido.estado !==
                EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE
            ) {
                return { pedidoId: pedido.id };
            }
            if (
                recurso.amount?.value &&
                recurso.amount.currency_code &&
                pedido.paypalAmount &&
                pedido.paypalCurrency &&
                (recurso.amount.currency_code !== pedido.paypalCurrency ||
                    !new Prisma.Decimal(recurso.amount.value).equals(
                        pedido.paypalAmount,
                    ))
            ) {
                throw new AppError(
                    "REEMBOLSO_NO_COINCIDE",
                    "El reembolso notificado por PayPal no coincide con el pago del pedido.",
                    409,
                );
            }
            await aplicarReembolsoConfirmado(
                pedido.id,
                pedido.empresaId,
                null,
            );
            return { pedidoId: pedido.id };
        }

        return {};
    };

    const service: MarketplaceService = {
        async listarTiendas() {
            await liberarPedidosVencidos();
            const tiendas = await cargarTiendaPublica(prisma);
            return tiendas
                .map((tienda) =>
                    mapearTienda(
                        tienda,
                        config.marketplaceCommissionPercent ?? 2,
                    ),
                )
                .filter((tienda) => tienda.productos.length > 0);
        },

        async obtenerTienda(slug) {
            await liberarPedidosVencidos();
            const tiendas = await cargarTiendaPublica(prisma, slug);
            const tienda = tiendas[0];
            if (!tienda || !tienda.tiendaSlug) {
                throw new AppError(
                    "TIENDA_NO_ENCONTRADA",
                    "La tienda no existe o no está publicada.",
                    404,
                );
            }
            return mapearTienda(
                tienda,
                config.marketplaceCommissionPercent ?? 2,
            );
        },

        async listarCatalogo(filtros) {
            // Caché opcional en Redis (TTL 60 s): el catálogo público es la
            // lectura más frecuente y tolera datos de hace un minuto. Sin
            // REDIS_URL se consulta la base de datos como siempre.
            const claveCache = `catalogo:${JSON.stringify({
                busqueda: filtros.busqueda ?? null,
                categoria: filtros.categoria ?? null,
                empresaSlug: filtros.empresaSlug ?? null,
                precioMin: filtros.precioMin ?? null,
                precioMax: filtros.precioMax ?? null,
                soloDisponibles: filtros.soloDisponibles,
                orden: filtros.orden,
                pagina: filtros.pagina,
                porPagina: filtros.porPagina,
            })}`;
            const cacheada = await redisGet(claveCache);
            if (cacheada !== null) {
                try {
                    return JSON.parse(cacheada) as ResultadoCatalogoMarketplace;
                } catch {
                    // Entrada corrupta: se recalcula y se sobrescribe.
                }
            }

            const { where, orderBy } = condicionesCatalogo(filtros, prisma);
            const pagina = Math.max(1, Math.floor(filtros.pagina));
            const [productos, total] = await prisma.$transaction([
                prisma.producto.findMany({
                    where,
                    select: CAMPOS_PRODUCTO_CATALOGO,
                    orderBy,
                    skip: (pagina - 1) * filtros.porPagina,
                    take: filtros.porPagina,
                }),
                prisma.producto.count({ where }),
            ]);
            const resultado: ResultadoCatalogoMarketplace = {
                productos: productos.map(mapearProductoCatalogo),
                total,
                pagina,
                porPagina: filtros.porPagina,
                totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
            };
            await redisSet(claveCache, JSON.stringify(resultado), 60);
            return resultado;
        },

        async listarCategoriasPublicas() {
            const grupos = await prisma.producto.groupBy({
                by: ["categoria"],
                where: {
                    activo: true,
                    publicadoMarketplace: true,
                    categoria: { not: null },
                    empresa: { tiendaActiva: true, tiendaSlug: { not: null } },
                },
                _count: { _all: true },
                orderBy: { categoria: "asc" },
            });
            return grupos.flatMap((grupo) =>
                grupo.categoria === null
                    ? []
                    : [{ nombre: grupo.categoria, cantidad: grupo._count._all }],
            );
        },

        async obtenerProductoPublico(id) {
            const condiciones = condicionesCatalogo(
                {
                    soloDisponibles: false,
                    orden: "relevancia",
                    pagina: 1,
                    porPagina: 1,
                },
                prisma,
            );
            const producto = await prisma.producto.findFirst({
                where: { id, ...condiciones.where },
                select: CAMPOS_PRODUCTO_CATALOGO,
            });
            if (!producto) {
                throw new AppError(
                    "PRODUCTO_NO_DISPONIBLE",
                    "El producto no existe o ya no está publicado en el marketplace.",
                    404,
                );
            }
            const relacionados = await prisma.producto.findMany({
                where: {
                    ...condiciones.where,
                    id: { not: producto.id },
                    ...(producto.categoria
                        ? { categoria: producto.categoria }
                        : { empresaId: producto.empresa.id }),
                },
                select: CAMPOS_PRODUCTO_CATALOGO,
                orderBy: condiciones.orderBy,
                take: 4,
            });
            return {
                producto: mapearProductoCatalogo(producto),
                relacionados: relacionados.map(mapearProductoCatalogo),
            };
        },

        async obtenerPedidoPublico(id) {
            const pedido = await prisma.pedidoMarketplace.findUnique({
                where: { id },
                select: {
                    id: true,
                    estado: true,
                    total: true,
                    creadaEn: true,
                    empresa: { select: { nombre: true } },
                },
            });
            if (!pedido) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido no existe.",
                    404,
                );
            }
            const token = generarTokenSeguimiento(pedido.id, config.jwtSecret);
            return {
                pedidoId: pedido.id,
                estado: pedido.estado,
                total: pedido.total,
                tienda: pedido.empresa.nombre,
                creadaEn: pedido.creadaEn,
                trackingUrl: `/marketplace/seguimiento/${pedido.id}?t=${token}`,
            };
        },

        async obtenerSeguimientoPedidoPublico(id, token) {
            if (!verificarTokenSeguimiento(id, token, config.jwtSecret)) {
                throw new AppError(
                    "ACCESO_DENEGADO",
                    "El enlace de seguimiento no es válido o ha expirado.",
                    403,
                );
            }

            const pedido = await prisma.pedidoMarketplace.findUnique({
                where: { id },
                include: {
                    empresa: { select: { nombre: true } },
                    detalles: {
                        select: { nombre: true, cantidad: true },
                    },
                    historial: {
                        orderBy: { creadaEn: "desc" },
                    },
                },
            });

            if (!pedido) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido no existe.",
                    404,
                );
            }

            return {
                id: pedido.id,
                estado: pedido.estado,
                nombreComprador: pedido.nombreComprador,
                creadaEn: pedido.creadaEn,
                actualizadaEn: pedido.actualizadaEn,
                tienda: pedido.empresa.nombre,
                detalles: pedido.detalles,
                historial: pedido.historial.map((h) => ({
                    estado: h.estado,
                    detalle: h.detalle,
                    observaciones: h.observaciones,
                    fecha: h.creadaEn,
                })),
            };
        },

        async obtenerHistorialPedido(empresaId, pedidoId) {
            const pedido = await prisma.pedidoMarketplace.findFirst({
                where: { id: pedidoId, empresaId },
                include: {
                    empresa: { select: { nombre: true } },
                    detalles: {
                        select: { nombre: true, cantidad: true },
                    },
                    historial: {
                        orderBy: { creadaEn: "desc" },
                        include: {
                            usuario: {
                                select: { nombre: true, apellido: true },
                            },
                        },
                    },
                },
            });

            if (!pedido) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido no existe.",
                    404,
                );
            }

            return {
                id: pedido.id,
                estado: pedido.estado,
                nombreComprador: pedido.nombreComprador,
                creadaEn: pedido.creadaEn,
                actualizadaEn: pedido.actualizadaEn,
                tienda: pedido.empresa.nombre,
                detalles: pedido.detalles,
                historial: pedido.historial.map((h) => ({
                    estado: h.estado,
                    detalle: h.detalle,
                    observaciones: h.observaciones,
                    fecha: h.creadaEn,
                    responsable: h.usuario
                        ? `${h.usuario.nombre} ${h.usuario.apellido}`.trim()
                        : null,
                })),
            };
        },

        async enviarCodigoVerificacionTelefono(telefono) {
            requireWhatsappConfig(config);
            const destino = normalizarTelefono(telefono);
            const ahora = Date.now();
            const ultimo = await prisma.codigoVerificacionTelefono.findFirst({
                where: { telefono: destino },
                orderBy: { creadaEn: "desc" },
                select: { creadaEn: true },
            });
            if (
                ultimo &&
                ahora - ultimo.creadaEn.getTime() < ESPERA_REENVIO_CODIGO_MS
            ) {
                throw new AppError(
                    "CODIGO_EN_ESPERA",
                    "Espera un minuto antes de solicitar otro código.",
                    429,
                );
            }
            const enviadosRecientes =
                await prisma.codigoVerificacionTelefono.count({
                    where: {
                        telefono: destino,
                        creadaEn: { gte: new Date(ahora - 60 * 60 * 1000) },
                    },
                });
            if (enviadosRecientes >= LIMITE_CODIGOS_POR_HORA) {
                throw new AppError(
                    "CODIGO_LIMITE_ALCANZADO",
                    "Superaste el límite de códigos por hora. Inténtalo más tarde.",
                    429,
                );
            }
            const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
            const registro = await prisma.codigoVerificacionTelefono.create({
                data: {
                    telefono: destino,
                    codigoHash: hashCodigoVerificacion(destino, codigo),
                    expiraEn: new Date(ahora + VIGENCIA_CODIGO_MS),
                },
                select: { id: true, expiraEn: true },
            });
            try {
                await whatsapp.enviarCodigoVerificacion(destino, codigo);
            } catch (error) {
                // El código nunca llegó: se descarta para que no consuma el
                // límite de envíos por hora ni deje un código huérfano.
                await prisma.codigoVerificacionTelefono.delete({
                    where: { id: registro.id },
                });
                throw error;
            }
            return {
                telefono: destino,
                expiraEn: registro.expiraEn.toISOString(),
            };
        },

        async verificarTelefono(telefono, codigo) {
            const destino = normalizarTelefono(telefono);
            const registro = await prisma.codigoVerificacionTelefono.findFirst({
                where: { telefono: destino },
                orderBy: { creadaEn: "desc" },
                select: {
                    id: true,
                    codigoHash: true,
                    intentos: true,
                    expiraEn: true,
                },
            });
            if (!registro) {
                throw new AppError(
                    "CODIGO_NO_SOLICITADO",
                    "Primero solicita un código de verificación por WhatsApp.",
                    400,
                );
            }
            if (registro.expiraEn.getTime() <= Date.now()) {
                throw new AppError(
                    "CODIGO_EXPIRADO",
                    "El código ya expiró. Solicita uno nuevo.",
                    400,
                );
            }
            if (registro.intentos >= MAX_INTENTOS_CODIGO) {
                throw new AppError(
                    "CODIGO_BLOQUEADO",
                    "Demasiados intentos fallidos. Solicita un código nuevo.",
                    429,
                );
            }
            const calculado = Buffer.from(
                hashCodigoVerificacion(destino, codigo),
                "hex",
            );
            if (!timingSafeEqual(calculado, Buffer.from(registro.codigoHash, "hex"))) {
                await prisma.codigoVerificacionTelefono.update({
                    where: { id: registro.id },
                    data: { intentos: { increment: 1 } },
                });
                throw new AppError(
                    "CODIGO_INCORRECTO",
                    "El código ingresado no es correcto.",
                    400,
                );
            }
            await prisma.codigoVerificacionTelefono.update({
                where: { id: registro.id },
                data: { verificadoEn: new Date() },
            });
        },

        async crearCheckout(datos, idempotencyKey, cuentaClienteId) {
            await liberarPedidosVencidos();
            requirePayPalConfig(config);
            // El número de WhatsApp se registra como dato de contacto del
            // comprador, pero su verificación (OTP) ya no es requisito para
            // llegar al checkout de PayPal: PayPal gestiona su propia
            // autenticación y la confirmación real del pago queda a cargo de
            // la captura y los webhooks verificados.
            const monedaPayPal = config.paypalCurrency;
            const tasaPayPal = config.paypalExchangeRate;
            const frontendUrl = config.frontendUrl ?? "http://localhost:3000";
            const idempotencyRequestHash = createHash("sha256")
                .update(JSON.stringify(datos))
                .digest("hex");

            type PedidoCheckout = {
                id: string;
                estado: EstadoPedidoMarketplace;
                total: Prisma.Decimal;
                paypalOrderId: string | null;
                paypalRedirectUrl: string | null;
                paypalAmount: Prisma.Decimal | null;
                paypalCurrency: string | null;
                paypalCaptureId: string | null;
                idempotencyRequestHash: string | null;
            };

            const crearOrdenEnPayPal = async (
                pedido: PedidoCheckout,
            ): Promise<string> => {
                const importePayPal =
                    pedido.paypalAmount ??
                    convertirImportePayPal(
                        pedido.total,
                        tasaPayPal,
                        monedaPayPal,
                    );
                const retorno = `${frontendUrl}/marketplace/resultado?pedido=${encodeURIComponent(pedido.id)}`;
                const { orden, redirectUrl } = await paypal.crearOrden({
                    pedidoId: pedido.id,
                    importe: formatearImportePayPal(
                        importePayPal,
                        monedaPayPal,
                    ),
                    moneda: monedaPayPal,
                    descripcion: `Pedido marketplace ${pedido.id.slice(0, 8)}`,
                    returnUrl: retorno,
                    cancelUrl: `${retorno}&cancelado=1`,
                });
                await prisma.pedidoMarketplace.update({
                    where: { id: pedido.id },
                    data: {
                        paypalOrderId: orden.id,
                        paypalRedirectUrl: redirectUrl,
                        paypalAmount: importePayPal,
                        paypalCurrency: monedaPayPal,
                    },
                });
                return redirectUrl;
            };

            const cancelarSiNoSeCreoEnPayPal = async (
                pedidoId: string,
                error: unknown,
            ) => {
                if (
                    !(error instanceof PayPalRequestError) ||
                    !error.externalStateUnknown
                ) {
                    await liberarReservaPedido(
                        pedidoId,
                        EstadoPedidoMarketplace.CANCELADO,
                    );
                }
            };

            const reutilizarCheckout = async () => {
                const existente = await prisma.pedidoMarketplace.findUnique({
                    where: { idempotencyKey },
                    select: {
                        id: true,
                        estado: true,
                        total: true,
                        paypalOrderId: true,
                        paypalRedirectUrl: true,
                        paypalAmount: true,
                        paypalCurrency: true,
                        paypalCaptureId: true,
                        idempotencyRequestHash: true,
                    },
                });
                if (!existente) return null;
                if (existente.idempotencyRequestHash !== idempotencyRequestHash) {
                    throw new AppError(
                        "CLAVE_IDEMPOTENCIA_REUTILIZADA",
                        "La clave de idempotencia ya se usó con otros datos de checkout.",
                        409,
                    );
                }
                if (existente.estado !== EstadoPedidoMarketplace.PENDIENTE_PAGO) {
                    throw new AppError(
                        "CHECKOUT_EN_PROCESO",
                        "El checkout ya fue iniciado y está pendiente de confirmación. Consulta tu pedido antes de volver a intentarlo.",
                        409,
                    );
                }
                if (existente.paypalRedirectUrl) {
                    return {
                        pedidoId: existente.id,
                        urlPago: existente.paypalRedirectUrl,
                    };
                }
                try {
                    if (existente.paypalOrderId) {
                        const orden = await paypal.obtenerOrden(
                            existente.paypalOrderId,
                        );
                        const redirectUrl = obtenerEnlaceAprobacion(orden);
                        if (!redirectUrl) {
                            throw new PayPalRequestError(
                                "PayPal no devolvió el enlace de aprobación del comprador.",
                                true,
                            );
                        }
                        validarUrlAprobacionPayPal(redirectUrl);
                        const importePayPal =
                            existente.paypalAmount ??
                            convertirImportePayPal(
                                existente.total,
                                tasaPayPal,
                                monedaPayPal,
                            );
                        validarImporteOrden(orden, {
                            importe: importePayPal,
                            moneda:
                                existente.paypalCurrency ?? monedaPayPal,
                            pedidoId: existente.id,
                        });
                        await prisma.pedidoMarketplace.update({
                            where: { id: existente.id },
                            data: {
                                paypalRedirectUrl: redirectUrl,
                                paypalAmount: importePayPal,
                                paypalCurrency:
                                    existente.paypalCurrency ?? monedaPayPal,
                            },
                        });
                        return { pedidoId: existente.id, urlPago: redirectUrl };
                    }

                    const urlPago = await crearOrdenEnPayPal(existente);
                    return { pedidoId: existente.id, urlPago };
                } catch (error) {
                    await cancelarSiNoSeCreoEnPayPal(existente.id, error);
                    throw error;
                }
            };

            const checkoutExistente = await reutilizarCheckout();
            if (checkoutExistente) return checkoutExistente;

            const empresa = await prisma.empresa.findFirst({
                where: {
                    tiendaSlug: datos.tiendaSlug,
                    tiendaActiva: true,
                },
                select: {
                    id: true,
                    tasaImpuesto: true,
                    costoEnvio: true,
                },
            });
            if (!empresa) {
                throw new AppError(
                    "TIENDA_NO_DISPONIBLE",
                    "La tienda no está disponible para compras.",
                    404,
                );
            }
            const ids = datos.detalles.map(({ productoId }) => productoId);
            const ahora = new Date();
            const expiraEn = new Date(ahora.getTime() + VIGENCIA_PEDIDO_MS);

            let pedido: Prisma.PedidoMarketplaceGetPayload<{
                include: { detalles: true };
            }>;
            try {
                pedido = await prisma.$transaction(async (tx) => {
                    await tx.$queryRaw(
                        Prisma.sql`SELECT "id" FROM "productos" WHERE "empresa_id" = ${empresa.id}::uuid AND "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`,
                    );
                    const productos = await tx.producto.findMany({
                        where: {
                            id: { in: ids },
                            empresaId: empresa.id,
                            activo: true,
                            publicadoMarketplace: true,
                        },
                        select: {
                            id: true,
                            sku: true,
                            nombre: true,
                            precioVenta: true,
                            stock: true,
                            stockReservado: true,
                        },
                    });
                    if (
                        productos.length !== ids.length ||
                        new Set(ids).size !== ids.length
                    ) {
                        throw new AppError(
                            "PRODUCTO_NO_DISPONIBLE",
                            "Uno o más productos ya no están disponibles en esta tienda.",
                            409,
                        );
                    }
                    const porId = new Map(
                        productos.map((producto) => [producto.id, producto]),
                    );
                    const detalles = datos.detalles.map((articulo) => {
                        const producto = porId.get(articulo.productoId);
                        if (!producto) {
                            throw new AppError(
                                "PRODUCTO_NO_DISPONIBLE",
                                "Uno o más productos ya no están disponibles en esta tienda.",
                                409,
                            );
                        }
                        if (
                            producto.stock - producto.stockReservado <
                            articulo.cantidad
                        ) {
                            throw new AppError(
                                "STOCK_INSUFICIENTE",
                                `No hay existencias suficientes de ${producto.nombre}.`,
                                409,
                            );
                        }
                        return {
                            producto,
                            cantidad: articulo.cantidad,
                            subtotal: producto.precioVenta.mul(articulo.cantidad),
                        };
                    });
                    const subtotal = detalles.reduce(
                        (suma, detalle) => suma.add(detalle.subtotal),
                        new Prisma.Decimal(0),
                    );
                    const impuesto = subtotal
                        .mul(empresa.tasaImpuesto)
                        .div(100)
                        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
                    const total = subtotal.add(impuesto).add(empresa.costoEnvio);
                    const comision = calcularComisionMarketplace(
                        total,
                        config.marketplaceCommissionPercent ?? 2,
                    );
                    if (
                        total.greaterThan(IMPORTE_MAXIMO) ||
                        comision.greaterThan(IMPORTE_MAXIMO)
                    ) {
                        throw new AppError(
                            "TOTAL_INVALIDO",
                            "El importe de la compra supera el máximo permitido.",
                            400,
                        );
                    }
                    const importePayPal = convertirImportePayPal(
                        total,
                        tasaPayPal,
                        monedaPayPal,
                    );

                    for (const detalle of detalles) {
                        const reserva = await tx.producto.updateMany({
                            where: {
                                id: detalle.producto.id,
                                stock: detalle.producto.stock,
                                stockReservado: detalle.producto.stockReservado,
                            },
                            data: {
                                stockReservado: { increment: detalle.cantidad },
                            },
                        });
                        if (reserva.count !== 1) throw reservationLost();
                    }

                    return tx.pedidoMarketplace.create({
                        data: {
                            empresaId: empresa.id,
                            cuentaClienteId: cuentaClienteId ?? null,
                            nombreComprador: datos.nombre,
                            correoComprador: datos.correo,
                            telefonoComprador: datos.telefono,
                            departamento: datos.departamento,
                            localidad: datos.localidad,
                            direccion: datos.direccion,
                            codigoPostal: datos.codigoPostal ?? null,
                            notaEntrega: datos.notaEntrega ?? null,
                            subtotal,
                            tasaImpuesto: empresa.tasaImpuesto,
                            impuesto,
                            costoEnvio: empresa.costoEnvio,
                            total,
                            comision,
                            expiraEn,
                            idempotencyKey,
                            idempotencyRequestHash,
                            paypalAmount: importePayPal,
                            paypalCurrency: monedaPayPal,
                            detalles: {
                                create: detalles.map((detalle) => ({
                                    productoId: detalle.producto.id,
                                    sku: detalle.producto.sku,
                                    nombre: detalle.producto.nombre,
                                    cantidad: detalle.cantidad,
                                    precioUnitario: detalle.producto.precioVenta,
                                    subtotal: detalle.subtotal,
                                })),
                            },
                        },
                        include: { detalles: true },
                    });
                }, OPCIONES_TRANSACCION);
            } catch (error) {
                if (
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    error.code === "P2002"
                ) {
                    const checkoutConcurrente = await reutilizarCheckout();
                    if (checkoutConcurrente) return checkoutConcurrente;
                }
                throw error;
            }

            try {
                const urlPago = await crearOrdenEnPayPal(pedido);
                return { pedidoId: pedido.id, urlPago };
            } catch (error) {
                await cancelarSiNoSeCreoEnPayPal(pedido.id, error);
                throw error;
            }
        },

        async capturarPedido(pedidoId, paypalOrderId) {
            requirePayPalConfig(config);
            const pedido = await prisma.pedidoMarketplace.findUnique({
                where: { id: pedidoId },
                select: {
                    id: true,
                    empresaId: true,
                    estado: true,
                    expiraEn: true,
                    paypalOrderId: true,
                    paypalCaptureId: true,
                    paypalAmount: true,
                    paypalCurrency: true,
                },
            });
            if (!pedido) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido no existe.",
                    404,
                );
            }
            if (!pedido.paypalOrderId || pedido.paypalOrderId !== paypalOrderId) {
                throw new AppError(
                    "PAGO_NO_COINCIDE",
                    "La orden de PayPal no corresponde a este pedido.",
                    409,
                );
            }
            if (pedido.estado !== EstadoPedidoMarketplace.PENDIENTE_PAGO) {
                return pedido.estado;
            }
            if (!pedido.paypalAmount || !pedido.paypalCurrency) {
                throw new AppError(
                    "PAGO_NO_COINCIDE",
                    "El pedido no tiene un importe de PayPal registrado.",
                    409,
                );
            }
            if (pedido.expiraEn.getTime() <= Date.now()) {
                await liberarReservaPedido(
                    pedido.id,
                    EstadoPedidoMarketplace.CANCELADO,
                );
                return EstadoPedidoMarketplace.CANCELADO;
            }

            let orden: PayPalOrder;
            try {
                orden = await paypal.capturarOrden(paypalOrderId);
            } catch (error) {
                if (
                    !(error instanceof PayPalRequestError) ||
                    !error.paypalIssues.includes("ORDER_ALREADY_CAPTURED")
                ) {
                    throw error;
                }
                orden = await paypal.obtenerOrden(paypalOrderId);
            }

            const resultado = validarCapturaOrden(orden, {
                pedidoId: pedido.id,
                orderId: paypalOrderId,
                importe: pedido.paypalAmount,
                moneda: pedido.paypalCurrency,
            });
            if (!resultado) {
                throw new AppError(
                    "PAGO_RECHAZADO",
                    "PayPal no completó el cobro. No se marcó el pedido como pagado.",
                    409,
                );
            }
            if (resultado.estado === "PENDING") {
                await prisma.pedidoMarketplace.updateMany({
                    where: { id: pedido.id, paypalCaptureId: null },
                    data: { paypalCaptureId: resultado.captura.id },
                });
                return EstadoPedidoMarketplace.PENDIENTE_PAGO;
            }

            try {
                await registrarPagoAprobado(pedido.id, resultado.captura, {
                    orderId: paypalOrderId,
                    importe: pedido.paypalAmount,
                    moneda: pedido.paypalCurrency,
                });
            } catch (error) {
                if (
                    error instanceof AppError &&
                    error.codigo === "RESERVA_STOCK_PERDIDA"
                ) {
                    await reembolsarTrasPagoSinStock(
                        pedido.id,
                        pedido.empresaId,
                        resultado.captura.id,
                    );
                    return EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE;
                }
                throw error;
            }
            return EstadoPedidoMarketplace.PAGO_CONFIRMADO;
        },

        async cancelarPedido(pedidoId, paypalOrderId) {
            requirePayPalConfig(config);
            const pedido = await prisma.pedidoMarketplace.findUnique({
                where: { id: pedidoId },
                select: {
                    estado: true,
                    paypalOrderId: true,
                    paypalCaptureId: true,
                },
            });
            if (!pedido) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido no existe.",
                    404,
                );
            }
            if (!pedido.paypalOrderId || pedido.paypalOrderId !== paypalOrderId) {
                throw new AppError(
                    "PAGO_NO_COINCIDE",
                    "La orden de PayPal no corresponde a este pedido.",
                    409,
                );
            }
            if (pedido.estado !== EstadoPedidoMarketplace.PENDIENTE_PAGO) {
                return pedido.estado;
            }
            if (pedido.paypalCaptureId) {
                return EstadoPedidoMarketplace.PENDIENTE_PAGO;
            }

            const orden = await paypal.obtenerOrden(paypalOrderId);
            if (orden.status === "COMPLETED") {
                throw new AppError(
                    "PAGO_YA_CAPTURADO",
                    "PayPal ya registró el cobro de este pedido; no puede cancelarse.",
                    409,
                );
            }
            await liberarReservaPedido(
                pedidoId,
                EstadoPedidoMarketplace.CANCELADO,
            );
            return EstadoPedidoMarketplace.CANCELADO;
        },

        async obtenerConfiguracion(empresaId) {
            const empresa = await prisma.empresa.findUnique({
                where: { id: empresaId },
                select: {
                    tiendaActiva: true,
                    tiendaSlug: true,
                    costoEnvio: true,
                },
            });
            if (!empresa) {
                throw new AppError(
                    "EMPRESA_NO_ENCONTRADA",
                    "La empresa no existe.",
                    404,
                );
            }
            return {
                tiendaActiva: empresa.tiendaActiva,
                tiendaSlug: empresa.tiendaSlug,
                costoEnvio: empresa.costoEnvio,
                paypalConfigurado: paypal.configurado,
                comisionPorcentaje:
                    config.marketplaceCommissionPercent ?? 2,
            };
        },

        async actualizarConfiguracion(empresaId, datos) {
            if (datos.activa && !datos.slug) {
                throw new AppError(
                    "TIENDA_SLUG_REQUERIDO",
                    "Indica una dirección para la tienda antes de publicarla.",
                    400,
                );
            }
            if (datos.activa) {
                requirePayPalConfig(config);
            }
            try {
                await prisma.empresa.update({
                    where: { id: empresaId },
                    data: {
                        tiendaActiva: datos.activa,
                        tiendaSlug: datos.slug || null,
                        costoEnvio: new Prisma.Decimal(datos.costoEnvio),
                    },
                });
            } catch (error) {
                if (
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    error.code === "P2002"
                ) {
                    throw new AppError(
                        "TIENDA_SLUG_DUPLICADO",
                        "Esa dirección de tienda ya está ocupada.",
                        409,
                    );
                }
                throw error;
            }
            return service.obtenerConfiguracion(empresaId);
        },

        /**
         * Conecta o desconecta la tienda del marketplace.
         *
         * Desconectar deja de publicar la tienda y sus productos en los
         * listados públicos y bloquea los nuevos checkouts, pero no toca
         * los productos, el inventario, los clientes, los proveedores ni los
         * pedidos ya realizados: toda la información interna de la empresa
         * se conserva intacta. Como la publicación de cada producto es
         * individual (producto.publicadoMarketplace), al reconectar vuelven
         * a verse solo los productos que la empresa ya había marcado.
         */
        async obtenerEstadoTienda(empresaId) {
            const empresa = await prisma.empresa.findUnique({
                where: { id: empresaId },
                select: { id: true },
            });
            if (!empresa) {
                throw new AppError(
                    "EMPRESA_NO_ENCONTRADA",
                    "La empresa no existe.",
                    404,
                );
            }
            const { pedidosPendientes, productosPublicados } =
                await resumenConexionTienda(prisma, empresaId);
            return {
                configuracion: await service.obtenerConfiguracion(empresaId),
                pedidosPendientes,
                productosPublicados,
            };
        },

        async actualizarConexionTienda(empresaId, conectada) {
            const empresa = await prisma.empresa.findUnique({
                where: { id: empresaId },
                select: { tiendaActiva: true, tiendaSlug: true },
            });
            if (!empresa) {
                throw new AppError(
                    "EMPRESA_NO_ENCONTRADA",
                    "La empresa no existe.",
                    404,
                );
            }

            if (conectada) {
                if (!empresa.tiendaSlug) {
                    throw new AppError(
                        "TIENDA_SLUG_REQUERIDO",
                        "Indica una dirección para la tienda antes de publicarla.",
                        400,
                    );
                }
                requirePayPalConfig(config);
            }

            await prisma.$transaction(async (tx) => {
                await tx.empresa.updateMany({
                    where: { id: empresaId },
                    data: { tiendaActiva: conectada },
                });
            });

            const { pedidosPendientes, productosPublicados } =
                await resumenConexionTienda(prisma, empresaId);

            return {
                configuracion: await service.obtenerConfiguracion(empresaId),
                pedidosPendientes,
                productosPublicados,
            };
        },

        async procesarNotificacion(eventoRecibido, headers) {
            requirePayPalConfig(config);
            const notificacion =
                eventoWebhookPayPalSchema.safeParse(eventoRecibido);
            if (!notificacion.success) {
                throw new AppError(
                    "NOTIFICACION_INVALIDA",
                    "El cuerpo de la notificación de PayPal no es válido.",
                    400,
                );
            }
            const evento = notificacion.data;
            const firmaValida = await paypal.verificarFirmaWebhook(
                eventoRecibido,
                headers,
            );
            if (!firmaValida) {
                throw new AppError(
                    "FIRMA_WEBHOOK_INVALIDA",
                    "La firma de la notificación de PayPal no es válida.",
                    401,
                );
            }

            const existente = await prisma.eventoWebhookPayPal.findUnique({
                where: { id: evento.id },
                select: { estado: true },
            });
            if (existente) {
                if (
                    existente.estado !==
                    EstadoEventoWebhookPayPal.PROCESANDO
                ) {
                    return;
                }
            } else {
                try {
                    await prisma.eventoWebhookPayPal.create({
                        data: { id: evento.id, tipo: evento.event_type },
                    });
                } catch (error) {
                    if (
                        error instanceof Prisma.PrismaClientKnownRequestError &&
                        error.code === "P2002"
                    ) {
                        const actual =
                            await prisma.eventoWebhookPayPal.findUnique({
                                where: { id: evento.id },
                                select: { estado: true },
                            });
                        if (
                            actual?.estado !==
                            EstadoEventoWebhookPayPal.PROCESANDO
                        ) {
                            return;
                        }
                    } else {
                        throw error;
                    }
                }
            }

            try {
                const resultado = await procesarEventoPayPal(evento);
                await prisma.eventoWebhookPayPal.update({
                    where: { id: evento.id },
                    data: {
                        estado: resultado.pedidoId
                            ? EstadoEventoWebhookPayPal.PROCESADO
                            : EstadoEventoWebhookPayPal.IGNORADO,
                        pedidoId: resultado.pedidoId ?? null,
                        procesadoEn: new Date(),
                    },
                });
            } catch (error) {
                await prisma.eventoWebhookPayPal.deleteMany({
                    where: {
                        id: evento.id,
                        estado: EstadoEventoWebhookPayPal.PROCESANDO,
                    },
                });
                throw error;
            }
        },
        async publicarProducto(empresaId, productoId, publicado) {
            const productoExistente = await prisma.producto.findFirst({
                where: { id: productoId, empresaId },
                select: {
                    activo: true,
                    stock: true,
                    stockReservado: true,
                    empresa: {
                        select: {
                            tiendaActiva: true,
                            tiendaSlug: true,
                        },
                    },
                },
            });
            if (!productoExistente) {
                throw new AppError(
                    "PRODUCTO_NO_ENCONTRADO",
                    "El producto no existe en esta empresa.",
                    404,
                );
            }

            const producto = await prisma.producto.updateMany({
                where: { id: productoId, empresaId },
                data: { publicadoMarketplace: publicado },
            });
            if (producto.count !== 1) {
                throw new AppError(
                    "PRODUCTO_NO_ENCONTRADO",
                    "El producto no existe en esta empresa.",
                    404,
                );
            }
            if (!publicado) {
                return { visible: false, requisitosPendientes: [] };
            }

            const requisitosPendientes: string[] = [];
            if (!productoExistente.empresa.tiendaActiva) {
                requisitosPendientes.push(
                    "publicar la tienda desde Empresa > Marketplace",
                );
            }
            if (!productoExistente.empresa.tiendaSlug) {
                requisitosPendientes.push(
                    "configurar la dirección pública de la tienda",
                );
            }
            if (!paypal.configurado) {
                requisitosPendientes.push(
                    "configurar el cobro centralizado con PayPal",
                );
            }
            if (!productoExistente.activo) {
                requisitosPendientes.push("activar el producto");
            }
            return {
                visible: requisitosPendientes.length === 0,
                requisitosPendientes,
            };
        },

        async listarPedidos(empresaId) {
            return prisma.pedidoMarketplace.findMany({
                where: { empresaId },
                select: camposPedidoMarketplace,
                orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
                take: 100,
            });
        },

        async actualizarEstadoPedido(
            empresaId,
            pedidoId,
            estado,
            usuarioId,
            observaciones,
        ) {
            await prisma.$transaction(async (tx) => {
                const pedido = await tx.pedidoMarketplace.findFirst({
                    where: { id: pedidoId, empresaId },
                    select: { id: true, estado: true },
                });

                if (!pedido) {
                    throw new AppError(
                        "PEDIDO_NO_ENCONTRADO",
                        "El pedido no existe en esta empresa.",
                        404,
                    );
                }

                if (pedido.estado === estado) return;

                // Definimos las transiciones válidas según el flujo del prompt
                const transiciones: Record<string, EstadoPedidoMarketplace[]> = {
                    [EstadoPedidoMarketplace.PAGO_CONFIRMADO]: [
                        EstadoPedidoMarketplace.PREPARANDO,
                        EstadoPedidoMarketplace.CANCELADO,
                        EstadoPedidoMarketplace.INCIDENCIA,
                    ],
                    [EstadoPedidoMarketplace.PREPARANDO]: [
                        EstadoPedidoMarketplace.DESPACHADO,
                        EstadoPedidoMarketplace.CANCELADO,
                        EstadoPedidoMarketplace.INCIDENCIA,
                    ],
                    [EstadoPedidoMarketplace.DESPACHADO]: [
                        EstadoPedidoMarketplace.EN_TRANSITO,
                        EstadoPedidoMarketplace.ENTREGADO,
                        EstadoPedidoMarketplace.INCIDENCIA,
                    ],
                    // Los pedidos anteriores a la ampliación de estados siguen
                    // en ENVIADO: se permiten las mismas salidas que DESPACHADO.
                    [EstadoPedidoMarketplace.ENVIADO]: [
                        EstadoPedidoMarketplace.EN_TRANSITO,
                        EstadoPedidoMarketplace.ENTREGADO,
                        EstadoPedidoMarketplace.INCIDENCIA,
                    ],
                    [EstadoPedidoMarketplace.EN_TRANSITO]: [
                        EstadoPedidoMarketplace.EN_REPARTO,
                        EstadoPedidoMarketplace.ENTREGA_FALLIDA,
                        EstadoPedidoMarketplace.INCIDENCIA,
                    ],
                    [EstadoPedidoMarketplace.EN_REPARTO]: [
                        EstadoPedidoMarketplace.ENTREGADO,
                        EstadoPedidoMarketplace.ENTREGA_FALLIDA,
                        EstadoPedidoMarketplace.INCIDENCIA,
                    ],
                    [EstadoPedidoMarketplace.ENTREGA_FALLIDA]: [
                        EstadoPedidoMarketplace.EN_REPARTO,
                        EstadoPedidoMarketplace.DEVUELTO,
                        EstadoPedidoMarketplace.INCIDENCIA,
                    ],
                    [EstadoPedidoMarketplace.INCIDENCIA]: [
                        EstadoPedidoMarketplace.PREPARANDO,
                        EstadoPedidoMarketplace.DESPACHADO,
                        EstadoPedidoMarketplace.EN_TRANSITO,
                        EstadoPedidoMarketplace.EN_REPARTO,
                        EstadoPedidoMarketplace.ENTREGADO,
                        EstadoPedidoMarketplace.CANCELADO,
                    ],
                };

                const permitidos = transiciones[pedido.estado] || [];
                if (
                    estado !== EstadoPedidoMarketplace.INCIDENCIA &&
                    !permitidos.includes(estado)
                ) {
                    throw new AppError(
                        "ESTADO_PEDIDO_INVALIDO",
                        `No se permite cambiar el pedido de ${pedido.estado} a ${estado}.`,
                        400,
                    );
                }

                const actualizado = await tx.pedidoMarketplace.updateMany({
                    where: { id: pedidoId, empresaId, estado: pedido.estado },
                    data: { estado },
                });
                if (actualizado.count !== 1) {
                    throw new AppError(
                        "ESTADO_PEDIDO_INVALIDO",
                        "El pedido cambió de estado mientras se actualizaba. Vuelve a intentarlo.",
                        409,
                    );
                }

                await registrarEventoSeguimiento(
                    tx,
                    pedidoId,
                    estado,
                    `El pedido ha pasado de ${pedido.estado.replace(/_/g, " ")} a ${estado.replace(/_/g, " ")}.`,
                    observaciones,
                    usuarioId ?? null,
                );
            });
        },

        async reembolsarPedido(empresaId, usuarioId, pedidoId) {
            requirePayPalConfig(config);
            const pedido = await prisma.pedidoMarketplace.findFirst({
                where: { id: pedidoId, empresaId },
                select: {
                    id: true,
                    estado: true,
                    paypalCaptureId: true,
                    paypalRefundId: true,
                    paypalAmount: true,
                    paypalCurrency: true,
                },
            });
            if (!pedido) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido no existe en esta empresa.",
                    404,
                );
            }
            if (pedido.estado === EstadoPedidoMarketplace.REEMBOLSADO) {
                return EstadoPedidoMarketplace.REEMBOLSADO;
            }
            if (
                pedido.estado !== EstadoPedidoMarketplace.PAGO_CONFIRMADO &&
                pedido.estado !== EstadoPedidoMarketplace.PREPARANDO &&
                pedido.estado !==
                    EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE
            ) {
                throw new AppError(
                    "PEDIDO_NO_REEMBOLSABLE",
                    "Solo puedes reembolsar un pedido pagado que aún no fue enviado.",
                    409,
                );
            }
            if (
                !pedido.paypalCaptureId ||
                !pedido.paypalAmount ||
                !pedido.paypalCurrency
            ) {
                throw new AppError(
                    "PAGO_NO_ENCONTRADO",
                    "No se encontró la captura de PayPal para este pedido.",
                    409,
                );
            }

            if (pedido.estado !== EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE) {
                const marcado = await prisma.pedidoMarketplace.updateMany({
                    where: {
                        id: pedidoId,
                        empresaId,
                        estado: {
                            in: [
                                EstadoPedidoMarketplace.PAGO_CONFIRMADO,
                                EstadoPedidoMarketplace.PREPARANDO,
                            ],
                        },
                    },
                    data: {
                        estado: EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE,
                    },
                });
                if (marcado.count !== 1) {
                    throw new AppError(
                        "PEDIDO_NO_REEMBOLSABLE",
                        "El pedido cambió de estado y no pudo iniciarse el reembolso.",
                        409,
                    );
                }
            }

            const captureId = pedido.paypalCaptureId;
            const importe = pedido.paypalAmount;
            const moneda = pedido.paypalCurrency;
            const crearReembolso = (idempotencyKey: string) =>
                paypal.reembolsarCaptura(captureId, {
                    importe: formatearImportePayPal(importe, moneda),
                    moneda,
                    invoiceId: pedido.id,
                    idempotencyKey,
                });

            let reembolso: PayPalRefund;
            if (pedido.paypalRefundId) {
                reembolso = await paypal.obtenerReembolso(
                    pedido.paypalRefundId,
                );
                if (reembolso.id !== pedido.paypalRefundId) {
                    throw new AppError(
                        "REEMBOLSO_NO_COINCIDE",
                        "El reembolso de PayPal no coincide con el pedido.",
                        409,
                    );
                }
                if (
                    reembolso.status === "CANCELLED" ||
                    reembolso.status === "FAILED"
                ) {
                    reembolso = await crearReembolso(
                        `nexo-refund-${captureId}-${pedido.paypalRefundId}`,
                    );
                    await prisma.pedidoMarketplace.updateMany({
                        where: {
                            id: pedidoId,
                            empresaId,
                            estado: EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE,
                            paypalRefundId: pedido.paypalRefundId,
                        },
                        data: { paypalRefundId: reembolso.id },
                    });
                }
            } else {
                reembolso = await crearReembolso(
                    `nexo-refund-${captureId}`,
                );
                await prisma.pedidoMarketplace.updateMany({
                    where: {
                        id: pedidoId,
                        empresaId,
                        estado: EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE,
                        paypalRefundId: null,
                    },
                    data: { paypalRefundId: reembolso.id },
                });
            }
            if (
                reembolso.amount &&
                (reembolso.amount.currency_code !== moneda ||
                    !new Prisma.Decimal(reembolso.amount.value).equals(importe))
            ) {
                throw new AppError(
                    "REEMBOLSO_NO_COINCIDE",
                    "El importe del reembolso no coincide con el pago.",
                    409,
                );
            }
            if (reembolso.status !== "COMPLETED") {
                return EstadoPedidoMarketplace.REEMBOLSO_PENDIENTE;
            }

            return aplicarReembolsoConfirmado(
                pedidoId,
                empresaId,
                usuarioId,
            );
        },
        liberarPedidosVencidos,
    };

    return service;
};
