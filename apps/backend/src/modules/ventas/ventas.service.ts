import {
    EstadoVenta,
    MetodoPago,
    Prisma,
    TipoMovimientoInventario,
    type PrismaClient,
} from "@prisma/client";
import { AppError } from "../../errors/app-error.js";

export interface FiltrosVentas {
    empresaId: string;
    pagina: number;
    limite: number;
}

export interface DetalleVentaInput {
    productoId: string;
    cantidad: number;
}

export interface PagoInicialInput {
    monto: number;
    metodo: MetodoPago;
}

export interface DatosCrearVenta {
    clienteId: string;
    descuento: number;
    detalles: DetalleVentaInput[];
    costoEnvio?: number | undefined;
    pagoInicial?: PagoInicialInput | undefined;
}

export interface DatosRegistrarPago {
    monto: number;
    metodo: MetodoPago;
}

const camposVenta = {
    id: true,
    subtotal: true,
    descuento: true,
    costoEnvio: true,
    tasaImpuesto: true,
    impuesto: true,
    total: true,
    estado: true,
    creadaEn: true,
    canceladaEn: true,
    canceladaPor: {
        select: { id: true, nombre: true, apellido: true },
    },
    cliente: {
        select: {
            id: true,
            nombre: true,
            apellido: true,
        },
    },
    usuario: { select: { id: true, nombre: true, apellido: true } },
    detalles: {
        select: {
            id: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true,
            producto: { select: { id: true, sku: true, nombre: true } },
        },
    },
    pagos: {
        select: {
            id: true,
            metodo: true,
            monto: true,
            creadaEn: true,
            usuario: { select: { nombre: true, apellido: true } },
        },
        orderBy: { creadaEn: "asc" },
    },
} satisfies Prisma.VentaSelect;

export type VentaPublica = Prisma.VentaGetPayload<{
    select: typeof camposVenta;
}>;

const ventaNotFound = () =>
    new AppError("VENTA_NO_ENCONTRADA", "La venta no existe.", 404);

const calcularTotal = (
    subtotal: Prisma.Decimal,
    descuento: Prisma.Decimal,
    tasaImpuesto: Prisma.Decimal,
) => {
    const baseImponible = subtotal.sub(descuento);
    const impuesto = baseImponible
        .mul(tasaImpuesto)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { impuesto, total: baseImponible.add(impuesto) };
};

const listarVentas = async (prisma: PrismaClient, filtros: FiltrosVentas) => {
    const where: Prisma.VentaWhereInput = { empresaId: filtros.empresaId };
    const [datos, total] = await Promise.all([
        prisma.venta.findMany({
            where,
            select: camposVenta,
            orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        }),
        prisma.venta.count({ where }),
    ]);

    return {
        datos,
        paginacion: {
            pagina: filtros.pagina,
            limite: filtros.limite,
            total,
            totalPaginas: Math.ceil(total / filtros.limite),
        },
    };
};

const crearVenta = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    datos: DatosCrearVenta,
): Promise<VentaPublica> =>
    prisma.$transaction(async (tx) => {
        const [empresa, cliente] = await Promise.all([
            tx.empresa.findUnique({
                where: { id: empresaId },
                select: { tasaImpuesto: true },
            }),
            tx.cliente.findFirst({
                where: { id: datos.clienteId, empresaId, activo: true },
                select: { id: true },
            }),
        ]);
        if (!empresa) {
            throw new AppError(
                "EMPRESA_NO_ENCONTRADA",
                "La empresa no existe.",
                404,
            );
        }
        if (!cliente) {
            throw new AppError(
                "CLIENTE_NO_ENCONTRADO",
                "El cliente no existe o está inactivo.",
                404,
            );
        }

        const idsProductos = datos.detalles.map(({ productoId }) => productoId);
        const productos = await tx.producto.findMany({
            where: { id: { in: idsProductos }, empresaId, activo: true },
            select: {
                id: true,
                sku: true,
                nombre: true,
                precioVenta: true,
                stock: true,
                stockReservado: true,
            },
        });
        if (productos.length !== new Set(idsProductos).size) {
            throw new AppError(
                "PRODUCTO_NO_ENCONTRADO",
                "Uno o más productos no existen o están inactivos.",
                404,
            );
        }

        const porId = new Map(productos.map((producto) => [producto.id, producto]));
        const detalles = datos.detalles.map((detalle) => {
            const producto = porId.get(detalle.productoId);
            if (!producto) {
                throw new AppError(
                    "PRODUCTO_NO_ENCONTRADO",
                    "Uno o más productos no existen o están inactivos.",
                    404,
                );
            }
            const subtotal = producto.precioVenta.mul(detalle.cantidad);
            return {
                producto,
                cantidad: detalle.cantidad,
                precioUnitario: producto.precioVenta,
                subtotal,
            };
        });
        const subtotal = detalles.reduce(
            (suma, detalle) => suma.add(detalle.subtotal),
            new Prisma.Decimal(0),
        );
        const importeMaximo = new Prisma.Decimal("9999999999.99");
        if (
            subtotal.greaterThan(importeMaximo) ||
            detalles.some((detalle) =>
                detalle.subtotal.greaterThan(importeMaximo),
            )
        ) {
            throw new AppError(
                "SUBTOTAL_INVALIDO",
                "El subtotal de la venta supera el máximo permitido.",
                400,
            );
        }
        const descuento = new Prisma.Decimal(datos.descuento);
        if (descuento.greaterThan(subtotal)) {
            throw new AppError(
                "DESCUENTO_INVALIDO",
                "El descuento no puede superar el subtotal.",
                400,
            );
        }
        const { impuesto, total } = calcularTotal(
            subtotal,
            descuento,
            empresa.tasaImpuesto,
        );
        const costoEnvio = new Prisma.Decimal(datos.costoEnvio ?? 0);
        const totalConEnvio = total.add(costoEnvio);
        if (
            costoEnvio.greaterThan(importeMaximo) ||
            totalConEnvio.greaterThan(importeMaximo)
        ) {
            throw new AppError(
                "TOTAL_INVALIDO",
                "El total de la venta supera el máximo permitido.",
                400,
            );
        }
        if (
            datos.pagoInicial &&
            new Prisma.Decimal(datos.pagoInicial.monto).greaterThan(totalConEnvio)
        ) {
            throw new AppError(
                "PAGO_INVALIDO",
                "El pago inicial no puede superar el total de la venta.",
                400,
            );
        }

        for (const detalle of detalles) {
            if (
                detalle.producto.stock - detalle.producto.stockReservado <
                detalle.cantidad
            ) {
                throw new AppError(
                    "STOCK_INSUFICIENTE",
                    `No hay existencias suficientes de ${detalle.producto.nombre}.`,
                    409,
                );
            }
            const stockNuevo = detalle.producto.stock - detalle.cantidad;
            const actualizado = await tx.producto.updateMany({
                where: {
                    id: detalle.producto.id,
                    empresaId,
                    stock: detalle.producto.stock,
                    stockReservado: detalle.producto.stockReservado,
                    activo: true,
                },
                data: { stock: { decrement: detalle.cantidad } },
            });
            if (actualizado.count !== 1) {
                throw new AppError(
                    "STOCK_MODIFICADO",
                    `El stock de ${detalle.producto.nombre} cambió mientras registrabas la venta. Actualiza e inténtalo nuevamente.`,
                    409,
                );
            }
            await tx.movimientoInventario.create({
                data: {
                    empresaId,
                    productoId: detalle.producto.id,
                    usuarioId,
                    tipo: TipoMovimientoInventario.SALIDA,
                    cantidad: -detalle.cantidad,
                    stockAnterior: detalle.producto.stock,
                    stockNuevo,
                    motivo: "Salida por venta",
                },
            });
        }

        const venta = await tx.venta.create({
            data: {
                empresaId,
                clienteId: cliente.id,
                usuarioId,
                subtotal,
                descuento,
                costoEnvio,
                tasaImpuesto: empresa.tasaImpuesto,
                impuesto,
                total: totalConEnvio,
                detalles: {
                    create: detalles.map((detalle) => ({
                        productoId: detalle.producto.id,
                        cantidad: detalle.cantidad,
                        precioUnitario: detalle.precioUnitario,
                        subtotal: detalle.subtotal,
                    })),
                },
                ...(datos.pagoInicial
                    ? {
                          pagos: {
                              create: {
                                  usuarioId,
                                  metodo: datos.pagoInicial.metodo,
                                  monto: new Prisma.Decimal(
                                      datos.pagoInicial.monto,
                                  ),
                              },
                          },
                      }
                    : {}),
            },
            select: { id: true },
        });

        return tx.venta.findUniqueOrThrow({
            where: { id: venta.id },
            select: camposVenta,
        });
    });

const registrarPago = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    ventaId: string,
    datos: DatosRegistrarPago,
): Promise<VentaPublica> =>
    prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "ventas" WHERE "id" = ${ventaId}::uuid AND "empresa_id" = ${empresaId}::uuid FOR UPDATE`,
        );
        const venta = await tx.venta.findFirst({
            where: { id: ventaId, empresaId },
            select: {
                id: true,
                estado: true,
                total: true,
                pagos: { select: { monto: true } },
            },
        });
        if (!venta) throw ventaNotFound();
        if (venta.estado !== EstadoVenta.CONFIRMADA) {
            throw new AppError(
                "VENTA_CANCELADA",
                "No se pueden registrar pagos para una venta cancelada.",
                409,
            );
        }

        const abonado = venta.pagos.reduce(
            (suma, pago) => suma.add(pago.monto),
            new Prisma.Decimal(0),
        );
        const saldo = venta.total.sub(abonado);
        const monto = new Prisma.Decimal(datos.monto);
        if (monto.greaterThan(saldo)) {
            throw new AppError(
                "PAGO_SUPERA_SALDO",
                "El pago no puede superar el saldo pendiente.",
                400,
            );
        }

        await tx.pagoVenta.create({
            data: {
                ventaId: venta.id,
                usuarioId,
                metodo: datos.metodo,
                monto,
            },
        });
        return tx.venta.findUniqueOrThrow({
            where: { id: venta.id },
            select: camposVenta,
        });
    });

const cancelarVenta = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    ventaId: string,
): Promise<VentaPublica> =>
    prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "ventas" WHERE "id" = ${ventaId}::uuid AND "empresa_id" = ${empresaId}::uuid FOR UPDATE`,
        );
        const venta = await tx.venta.findFirst({
            where: { id: ventaId, empresaId },
            select: {
                id: true,
                estado: true,
                detalles: {
                    select: {
                        cantidad: true,
                        productoId: true,
                        producto: { select: { nombre: true } },
                    },
                },
                pedidoMarketplace: { select: { id: true } },
            },
        });
        if (!venta) throw ventaNotFound();
        if (venta.pedidoMarketplace) {
            throw new AppError(
                "REEMBOLSO_MARKETPLACE_REQUERIDO",
                "Los pedidos del marketplace deben reembolsarse desde su gestión para devolver el pago y las existencias.",
                409,
            );
        }
        if (venta.estado !== EstadoVenta.CONFIRMADA) {
            throw new AppError(
                "VENTA_YA_CANCELADA",
                "Esta venta ya fue cancelada.",
                409,
            );
        }

        const canceladaEn = new Date();
        const actualizada = await tx.venta.updateMany({
            where: {
                id: venta.id,
                empresaId,
                estado: EstadoVenta.CONFIRMADA,
            },
            data: {
                estado: EstadoVenta.CANCELADA,
                canceladaEn,
                canceladaPorId: usuarioId,
            },
        });
        if (actualizada.count !== 1) {
            throw new AppError(
                "VENTA_MODIFICADA",
                "La venta cambió mientras se cancelaba. Actualiza e inténtalo nuevamente.",
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
                    "Un producto de esta venta ya no está disponible.",
                    409,
                );
            }

            const stockNuevo = producto.stock + detalle.cantidad;
            if (stockNuevo > 2_147_483_647) {
                throw new AppError(
                    "STOCK_INVALIDO",
                    "La devolución supera el máximo de existencias permitido.",
                    409,
                );
            }
            const resultado = await tx.producto.updateMany({
                where: { id: producto.id, empresaId, stock: producto.stock },
                data: { stock: { increment: detalle.cantidad } },
            });
            if (resultado.count !== 1) {
                throw new AppError(
                    "STOCK_MODIFICADO",
                    "El stock cambió mientras se cancelaba la venta. Actualiza e inténtalo nuevamente.",
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
                    motivo: `Cancelación de venta ${venta.id.slice(0, 8)}: ${detalle.producto.nombre}`.slice(
                        0,
                        300,
                    ),
                },
            });
        }

        return tx.venta.findUniqueOrThrow({
            where: { id: venta.id },
            select: camposVenta,
        });
    });

export interface SalesService {
    listar(filtros: FiltrosVentas): ReturnType<typeof listarVentas>;
    crear(
        empresaId: string,
        usuarioId: string,
        datos: DatosCrearVenta,
    ): Promise<VentaPublica>;
    registrarPago(
        empresaId: string,
        usuarioId: string,
        ventaId: string,
        datos: DatosRegistrarPago,
    ): Promise<VentaPublica>;
    cancelar(
        empresaId: string,
        usuarioId: string,
        ventaId: string,
    ): Promise<VentaPublica>;
}

export const createSalesService = (prisma: PrismaClient): SalesService => ({
    listar: (filtros) => listarVentas(prisma, filtros),
    crear: (empresaId, usuarioId, datos) =>
        crearVenta(prisma, empresaId, usuarioId, datos),
    registrarPago: (empresaId, usuarioId, ventaId, datos) =>
        registrarPago(prisma, empresaId, usuarioId, ventaId, datos),
    cancelar: (empresaId, usuarioId, ventaId) =>
        cancelarVenta(prisma, empresaId, usuarioId, ventaId),
});
