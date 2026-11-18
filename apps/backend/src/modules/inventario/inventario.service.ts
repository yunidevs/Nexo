import {
    Prisma,
    TipoMovimientoInventario,
    type PrismaClient,
} from "@prisma/client";
import { AppError } from "../../errors/app-error.js";

export interface FiltrosInventario {
    empresaId: string;
    buscar: string;
    pagina: number;
    limite: number;
    bajoStock?: boolean;
}

export interface FiltrosMovimientosInventario {
    empresaId: string;
    productoId?: string;
    pagina: number;
    limite: number;
}

export interface DatosMovimientoInventario {
    productoId: string;
    tipo: TipoMovimientoInventario;
    cantidad: number;
    motivo: string;
}

const camposProducto = {
    id: true,
    sku: true,
    nombre: true,
    stock: true,
    stockReservado: true,
    stockMinimo: true,
    categoria: true,
    activo: true,
} satisfies Prisma.ProductoSelect;

const camposMovimiento = {
    id: true,
    tipo: true,
    cantidad: true,
    stockAnterior: true,
    stockNuevo: true,
    motivo: true,
    creadaEn: true,
    producto: { select: { id: true, sku: true, nombre: true } },
    usuario: { select: { nombre: true, apellido: true } },
} satisfies Prisma.MovimientoInventarioSelect;

export type ProductoInventario = Prisma.ProductoGetPayload<{
    select: typeof camposProducto;
}>;
export type MovimientoInventarioPublico = Prisma.MovimientoInventarioGetPayload<{
    select: typeof camposMovimiento;
}>;

const productoNotFound = () =>
    new AppError("PRODUCTO_NO_ENCONTRADO", "El producto no existe.", 404);

const listarProductos = async (
    prisma: PrismaClient,
    filtros: FiltrosInventario,
) => {
    const where: Prisma.ProductoWhereInput = {
        empresaId: filtros.empresaId,
        activo: true,
        ...(filtros.bajoStock ? { stock: { lte: prisma.producto.fields.stockMinimo } } : {}),
        ...(filtros.buscar
            ? {
                  OR: [
                      { sku: { contains: filtros.buscar, mode: "insensitive" } },
                      { nombre: { contains: filtros.buscar, mode: "insensitive" } },
                      { categoria: { contains: filtros.buscar, mode: "insensitive" } },
                  ],
              }
            : {}),
    };

    const [datos, total] = await Promise.all([
        prisma.producto.findMany({
            where,
            select: camposProducto,
            orderBy: [{ stock: "asc" }, { nombre: "asc" }],
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        }),
        prisma.producto.count({ where }),
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

const listarMovimientos = async (
    prisma: PrismaClient,
    filtros: FiltrosMovimientosInventario,
) => {
    const where: Prisma.MovimientoInventarioWhereInput = {
        empresaId: filtros.empresaId,
        ...(filtros.productoId ? { productoId: filtros.productoId } : {}),
    };
    const [datos, total] = await Promise.all([
        prisma.movimientoInventario.findMany({
            where,
            select: camposMovimiento,
            orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        }),
        prisma.movimientoInventario.count({ where }),
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

const registrarMovimiento = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    datos: DatosMovimientoInventario,
): Promise<MovimientoInventarioPublico> =>
    prisma.$transaction(async (tx) => {
        const producto = await tx.producto.findFirst({
            where: { id: datos.productoId, empresaId, activo: true },
            select: { id: true, stock: true, stockReservado: true },
        });
        if (!producto) throw productoNotFound();

        const delta =
            datos.tipo === TipoMovimientoInventario.AJUSTE
                ? datos.cantidad
                : datos.tipo === TipoMovimientoInventario.SALIDA
                  ? -datos.cantidad
                  : datos.cantidad;
        const stockNuevo = producto.stock + delta;
        if (stockNuevo < producto.stockReservado) {
            throw new AppError(
                "STOCK_INSUFICIENTE",
                "La salida no puede consumir existencias reservadas para pedidos del marketplace.",
                409,
            );
        }
        if (stockNuevo > 2_147_483_647) {
            throw new AppError(
                "STOCK_INVALIDO",
                "El movimiento supera el máximo de existencias permitido.",
                400,
            );
        }

        const actualizado = await tx.producto.updateMany({
            where: {
                id: producto.id,
                empresaId,
                stock: producto.stock,
                stockReservado: producto.stockReservado,
            },
            data: { stock: { increment: delta } },
        });
        if (actualizado.count !== 1) {
            throw new AppError(
                "STOCK_MODIFICADO",
                "El stock cambió mientras registrabas el movimiento. Actualiza e inténtalo nuevamente.",
                409,
            );
        }

        return tx.movimientoInventario.create({
            data: {
                empresaId,
                productoId: producto.id,
                usuarioId,
                tipo: datos.tipo,
                cantidad: delta,
                stockAnterior: producto.stock,
                stockNuevo,
                motivo: datos.motivo,
            },
            select: camposMovimiento,
        });
    });

export interface InventoryService {
    listarProductos(filtros: FiltrosInventario): ReturnType<typeof listarProductos>;
    listarMovimientos(
        filtros: FiltrosMovimientosInventario,
    ): ReturnType<typeof listarMovimientos>;
    registrarMovimiento(
        empresaId: string,
        usuarioId: string,
        datos: DatosMovimientoInventario,
    ): Promise<MovimientoInventarioPublico>;
}

export const createInventoryService = (prisma: PrismaClient): InventoryService => ({
    listarProductos: (filtros) => listarProductos(prisma, filtros),
    listarMovimientos: (filtros) => listarMovimientos(prisma, filtros),
    registrarMovimiento: (empresaId, usuarioId, datos) =>
        registrarMovimiento(prisma, empresaId, usuarioId, datos),
});
