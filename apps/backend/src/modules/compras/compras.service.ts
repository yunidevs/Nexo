import {
    EstadoCompra,
    MetodoPago,
    Prisma,
    TipoMovimientoInventario,
    TipoOperacionProveedor,
    type PrismaClient,
} from "@prisma/client";
import { AppError } from "../../errors/app-error.js";

export interface FiltrosCompras {
    empresaId: string;
    pagina: number;
    limite: number;
}

export interface DetalleCompraInput {
    productoId: string;
    cantidad: number;
    costoUnitario: number;
}

export interface DatosCrearCompra {
    proveedorId: string;
    fechaCompra: Date;
    detalles: DetalleCompraInput[];
}

const camposCompra = {
    id: true,
    estado: true,
    total: true,
    fechaCompra: true,
    creadaEn: true,
    recibidaEn: true,
    proveedor: { select: { id: true, nombre: true } },
    usuario: { select: { nombre: true, apellido: true } },
    detalles: {
        select: {
            id: true,
            cantidad: true,
            costoUnitario: true,
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
} satisfies Prisma.CompraSelect;

export type CompraPublica = Prisma.CompraGetPayload<{
    select: typeof camposCompra;
}>;

export interface DatosRegistrarPagoCompra {
    monto: number;
    metodo: MetodoPago;
}

const compraNotFound = () =>
    new AppError("COMPRA_NO_ENCONTRADA", "La compra no existe.", 404);

const crearCompra = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    datos: DatosCrearCompra,
): Promise<CompraPublica> =>
    prisma.$transaction(async (tx) => {
        const proveedor = await tx.proveedor.findFirst({
            where: { id: datos.proveedorId, empresaId, activo: true },
            select: { id: true },
        });
        if (!proveedor) {
            throw new AppError(
                "PROVEEDOR_NO_ENCONTRADO",
                "El proveedor no existe o está inactivo.",
                404,
            );
        }

        const idsProductos = datos.detalles.map(({ productoId }) => productoId);
        const productos = await tx.producto.findMany({
            where: { id: { in: idsProductos }, empresaId, activo: true },
            select: { id: true },
        });
        if (productos.length !== new Set(idsProductos).size) {
            throw new AppError(
                "PRODUCTO_NO_ENCONTRADO",
                "Uno o más productos no existen o están inactivos.",
                404,
            );
        }

        const detalles = datos.detalles.map((detalle) => {
            const subtotal = new Prisma.Decimal(detalle.costoUnitario).mul(
                detalle.cantidad,
            );
            return {
                ...detalle,
                costoUnitario: new Prisma.Decimal(detalle.costoUnitario),
                subtotal,
            };
        });
        const total = detalles.reduce(
            (suma, detalle) => suma.add(detalle.subtotal),
            new Prisma.Decimal(0),
        );
        if (total.greaterThan("9999999999.99")) {
            throw new AppError(
                "TOTAL_INVALIDO",
                "El total de la compra supera el máximo permitido.",
                400,
            );
        }

        return tx.compra.create({
            data: {
                empresaId,
                proveedorId: proveedor.id,
                usuarioId,
                fechaCompra: datos.fechaCompra,
                total,
                detalles: { create: detalles },
            },
            select: camposCompra,
        });
    });

const listarCompras = async (
    prisma: PrismaClient,
    filtros: FiltrosCompras,
) => {
    const where: Prisma.CompraWhereInput = { empresaId: filtros.empresaId };
    const [datos, total] = await Promise.all([
        prisma.compra.findMany({
            where,
            select: camposCompra,
            orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        }),
        prisma.compra.count({ where }),
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

const recibirCompra = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    compraId: string,
): Promise<CompraPublica> =>
    prisma.$transaction(async (tx) => {
        const compra = await tx.compra.findFirst({
            where: { id: compraId, empresaId },
            select: {
                id: true,
                estado: true,
                total: true,
                fechaCompra: true,
                proveedorId: true,
                detalles: {
                    select: {
                        cantidad: true,
                        productoId: true,
                        producto: { select: { nombre: true } },
                    },
                },
            },
        });
        if (!compra) throw compraNotFound();
        if (compra.estado !== EstadoCompra.PENDIENTE) {
            throw new AppError(
                "COMPRA_YA_RECIBIDA",
                "Esta compra ya fue recibida.",
                409,
            );
        }

        const actualizada = await tx.compra.updateMany({
            where: { id: compra.id, empresaId, estado: EstadoCompra.PENDIENTE },
            data: { estado: EstadoCompra.RECIBIDA, recibidaEn: new Date() },
        });
        if (actualizada.count !== 1) {
            throw new AppError(
                "COMPRA_MODIFICADA",
                "La compra cambió mientras se registraba la recepción. Actualiza e inténtalo nuevamente.",
                409,
            );
        }

        for (const detalle of compra.detalles) {
            const producto = await tx.producto.findFirst({
                where: { id: detalle.productoId, empresaId },
                select: { id: true, stock: true },
            });
            if (!producto) {
                throw new AppError(
                    "PRODUCTO_NO_ENCONTRADO",
                    "Un producto de esta compra ya no está disponible.",
                    409,
                );
            }

            const stockNuevo = producto.stock + detalle.cantidad;
            if (stockNuevo > 2_147_483_647) {
                throw new AppError(
                    "STOCK_INVALIDO",
                    "La recepción supera el máximo de existencias permitido.",
                    400,
                );
            }
            const resultado = await tx.producto.updateMany({
                where: { id: producto.id, empresaId, stock: producto.stock },
                data: { stock: { increment: detalle.cantidad } },
            });
            if (resultado.count !== 1) {
                throw new AppError(
                    "STOCK_MODIFICADO",
                    "El stock cambió mientras se registraba la recepción. Actualiza e inténtalo nuevamente.",
                    409,
                );
            }

            await tx.movimientoInventario.create({
                data: {
                    empresaId,
                    productoId: producto.id,
                    usuarioId,
                    tipo: TipoMovimientoInventario.ENTRADA,
                    cantidad: detalle.cantidad,
                    stockAnterior: producto.stock,
                    stockNuevo,
                    motivo: `Recepción de compra ${compra.id.slice(0, 8)}: ${detalle.producto.nombre}`.slice(
                        0,
                        300,
                    ),
                },
            });
        }

        await tx.operacionProveedor.create({
            data: {
                proveedorId: compra.proveedorId,
                usuarioId,
                tipo: TipoOperacionProveedor.COMPRA_REGISTRADA,
                detalle: `Compra ${compra.id.slice(0, 8)} recibida.`,
                fechaCompra: compra.fechaCompra,
                total: compra.total,
            },
        });

        return tx.compra.findUniqueOrThrow({
            where: { id: compra.id },
            select: camposCompra,
        });
    });

const registrarPagoCompra = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    compraId: string,
    datos: DatosRegistrarPagoCompra,
): Promise<CompraPublica> =>
    prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "compras" WHERE "id" = ${compraId}::uuid AND "empresa_id" = ${empresaId}::uuid FOR UPDATE`,
        );
        const compra = await tx.compra.findFirst({
            where: { id: compraId, empresaId },
            select: {
                id: true,
                total: true,
                pagos: { select: { monto: true } },
            },
        });
        if (!compra) {
            throw new AppError("COMPRA_NO_ENCONTRADA", "La compra no existe.", 404);
        }

        const abonado = compra.pagos.reduce(
            (suma, pago) => suma.add(pago.monto),
            new Prisma.Decimal(0),
        );
        const monto = new Prisma.Decimal(datos.monto);
        if (monto.greaterThan(compra.total.sub(abonado))) {
            throw new AppError(
                "PAGO_SUPERA_SALDO",
                "El pago no puede superar el saldo pendiente de la compra.",
                400,
            );
        }

        await tx.pagoCompra.create({
            data: {
                compraId: compra.id,
                usuarioId,
                metodo: datos.metodo,
                monto,
            },
        });
        return tx.compra.findUniqueOrThrow({
            where: { id: compra.id },
            select: camposCompra,
        });
    });

export interface PurchaseService {
    listar(filtros: FiltrosCompras): ReturnType<typeof listarCompras>;
    crear(
        empresaId: string,
        usuarioId: string,
        datos: DatosCrearCompra,
    ): Promise<CompraPublica>;
    recibir(
        empresaId: string,
        usuarioId: string,
        compraId: string,
    ): Promise<CompraPublica>;
    registrarPago(
        empresaId: string,
        usuarioId: string,
        compraId: string,
        datos: DatosRegistrarPagoCompra,
    ): Promise<CompraPublica>;
}

export const createPurchaseService = (
    prisma: PrismaClient,
): PurchaseService => ({
    listar: (filtros) => listarCompras(prisma, filtros),
    crear: (empresaId, usuarioId, datos) =>
        crearCompra(prisma, empresaId, usuarioId, datos),
    recibir: (empresaId, usuarioId, compraId) =>
        recibirCompra(prisma, empresaId, usuarioId, compraId),
    registrarPago: (empresaId, usuarioId, compraId, datos) =>
        registrarPagoCompra(prisma, empresaId, usuarioId, compraId, datos),
});
