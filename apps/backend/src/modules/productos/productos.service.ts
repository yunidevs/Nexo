import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";

export interface DatosCrearProducto {
    sku: string;
    nombre: string;
    precioVenta: number;
    costo: number;
    stockMinimo: number;
    categoria?: string | null | undefined;
    imagenUrl?: string | null | undefined;
}

export type DatosActualizarProducto = Partial<DatosCrearProducto>;

export interface FiltrosProductos {
    empresaId: string;
    buscar: string;
    activo?: boolean;
    pagina: number;
    limite: number;
}

const camposPublicos = {
    id: true,
    sku: true,
    nombre: true,
    precioVenta: true,
    costo: true,
    stockMinimo: true,
    categoria: true,
    imagenUrl: true,
    activo: true,
    publicadoMarketplace: true,
    creadaEn: true,
    actualizadaEn: true,
} satisfies Prisma.ProductoSelect;

export type ProductoPublico = Prisma.ProductoGetPayload<{
    select: typeof camposPublicos;
}>;

export interface ResultadoProductos {
    datos: ProductoPublico[];
    paginacion: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

/**
 * Resultado de eliminar un producto.
 *
 * - "eliminado": el producto no tenía historial comercial ni de inventario,
 *   así que se borró definitivamente de la base de datos.
 * - "archivado": el producto tiene ventas, compras, pedidos o movimientos
 *   asociados. Se conserva la fila (desactivada) para no destruir el
 *   historial comercial, pero deja de ofrecerse en ventas, compras,
 *   inventario y marketplace.
 */
export type ModoEliminacionProducto = "eliminado" | "archivado";

export interface ResultadoEliminarProducto {
    id: string;
    sku: string;
    nombre: string;
    modo: ModoEliminacionProducto;
    /** Relaciones que impidieron el borrado físico. */
    dependencias: string[];
}

export interface ProductService {
    listar(filtros: FiltrosProductos): Promise<ResultadoProductos>;
    obtener(empresaId: string, id: string): Promise<ProductoPublico>;
    crear(empresaId: string, datos: DatosCrearProducto): Promise<ProductoPublico>;
    actualizar(
        empresaId: string,
        id: string,
        datos: DatosActualizarProducto,
    ): Promise<ProductoPublico>;
    cambiarEstado(
        empresaId: string,
        id: string,
        activo: boolean,
    ): Promise<ProductoPublico>;
    eliminar(
        empresaId: string,
        id: string,
    ): Promise<ResultadoEliminarProducto>;
}

const productoNotFound = () =>
    new AppError(
        "PRODUCTO_NO_ENCONTRADO",
        "El producto solicitado no existe.",
        404,
    );

const skuDuplicado = () =>
    new AppError(
        "SKU_DUPLICADO",
        "Ya existe un producto con ese SKU en tu empresa.",
        409,
    );

const isUniqueConstraintError = (
    error: unknown,
): error is Prisma.PrismaClientKnownRequestError =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002";

const traducirSkuDuplicado = (error: unknown): never => {
    if (isUniqueConstraintError(error)) throw skuDuplicado();
    throw error;
};

export const listarProductos = async (
    prisma: PrismaClient,
    filtros: FiltrosProductos,
): Promise<ResultadoProductos> => {
    const where: Prisma.ProductoWhereInput = {
        empresaId: filtros.empresaId,
        ...(filtros.activo === undefined ? {} : { activo: filtros.activo }),
        ...(filtros.buscar
            ? {
                  OR: [
                      { sku: { contains: filtros.buscar, mode: "insensitive" } },
                      {
                          nombre: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                      {
                          categoria: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                  ],
              }
            : {}),
    };

    const [datos, total] = await Promise.all([
        prisma.producto.findMany({
            where,
            select: camposPublicos,
            orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
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

export const obtenerProducto = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
): Promise<ProductoPublico> => {
    const producto = await prisma.producto.findFirst({
        where: { id, empresaId },
        select: camposPublicos,
    });

    if (!producto) throw productoNotFound();
    return producto;
};

export const crearProducto = async (
    prisma: PrismaClient,
    empresaId: string,
    datos: DatosCrearProducto,
): Promise<ProductoPublico> => {
    try {
        return await prisma.producto.create({
            data: {
                sku: datos.sku,
                nombre: datos.nombre,
                precioVenta: new Prisma.Decimal(datos.precioVenta),
                costo: new Prisma.Decimal(datos.costo),
                stockMinimo: datos.stockMinimo,
                categoria: datos.categoria ?? null,
                imagenUrl: datos.imagenUrl ?? null,
                empresaId,
            },
            select: camposPublicos,
        });
    } catch (error) {
        traducirSkuDuplicado(error);
        throw new AppError(
            "PRODUCTO_NO_GUARDADO",
            "No se pudo guardar el producto.",
            500,
        );
    }
};

export const actualizarProducto = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
    datos: DatosActualizarProducto,
): Promise<ProductoPublico> => {
    const existente = await prisma.producto.findFirst({
        where: { id, empresaId },
        select: { id: true },
    });

    if (!existente) throw productoNotFound();

    const datosPersistencia: Record<string, string | number | null | Prisma.Decimal> = {};
    if (datos.sku !== undefined) datosPersistencia.sku = datos.sku;
    if (datos.nombre !== undefined) datosPersistencia.nombre = datos.nombre;
    if (datos.precioVenta !== undefined)
        datosPersistencia.precioVenta = new Prisma.Decimal(datos.precioVenta);
    if (datos.costo !== undefined)
        datosPersistencia.costo = new Prisma.Decimal(datos.costo);
    if (datos.stockMinimo !== undefined)
        datosPersistencia.stockMinimo = datos.stockMinimo;
    if (datos.categoria !== undefined)
        datosPersistencia.categoria = datos.categoria ?? null;
    if (datos.imagenUrl !== undefined)
        datosPersistencia.imagenUrl = datos.imagenUrl ?? null;

    try {
        return await prisma.producto.update({
            where: { id },
            data: datosPersistencia,
            select: camposPublicos,
        });
    } catch (error) {
        traducirSkuDuplicado(error);
        throw new AppError(
            "PRODUCTO_NO_GUARDADO",
            "No se pudo actualizar el producto.",
            500,
        );
    }
};

export const cambiarEstadoProducto = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
    activo: boolean,
): Promise<ProductoPublico> => {
    const existente = await prisma.producto.findFirst({
        where: { id, empresaId },
        select: { id: true, activo: true },
    });

    if (!existente) throw productoNotFound();
    if (existente.activo === activo) return obtenerProducto(prisma, empresaId, id);

    return prisma.producto.update({
        where: { id },
        data: { activo },
        select: camposPublicos,
    });
};

const esViolacionDeLlaveForanea = (
    error: unknown,
): error is Prisma.PrismaClientKnownRequestError =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003";

/**
 * Elimina un producto respetando el historial comercial.
 *
 * Los detalles de venta, compra y pedido, y los movimientos de inventario
 * apuntan al producto con borrado restringido o en cascada: borrarlo de
 * forma física destruiría datos que deben conservarse. Por eso el producto
 * solo se borra cuando no tiene ninguna relación y, en caso contrario, se
 * archiva (activo = false), que es el mecanismo de baja que ya usa el ERP:
 * deja de ofrecerse en ventas, compras, inventario y marketplace, pero
 * conserva la fila y todo su historial.
 */
export const eliminarProducto = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
): Promise<ResultadoEliminarProducto> => {
    const analisis = await prisma.$transaction(async (tx) => {
        // Se bloquea la fila del producto para que el análisis y la
        // eliminación se evalúen sobre el mismo estado.
        await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "productos" WHERE "id" = ${id}::uuid AND "empresa_id" = ${empresaId}::uuid FOR UPDATE`,
        );

        const producto = await tx.producto.findFirst({
            where: { id, empresaId },
            select: {
                id: true,
                sku: true,
                nombre: true,
                stockReservado: true,
            },
        });

        if (!producto) throw productoNotFound();

        const [ventas, compras, pedidos, movimientos] = await Promise.all([
            tx.detalleVenta.count({ where: { productoId: id } }),
            tx.detalleCompra.count({ where: { productoId: id } }),
            tx.detallePedidoMarketplace.count({ where: { productoId: id } }),
            tx.movimientoInventario.count({ where: { productoId: id } }),
        ]);

        const dependencias: string[] = [];
        if (ventas > 0) dependencias.push("ventas registradas");
        if (compras > 0) dependencias.push("compras registradas");
        if (pedidos > 0) dependencias.push("pedidos del marketplace");
        if (movimientos > 0) dependencias.push("movimientos de inventario");

        // Un producto con existencias reservadas tiene pedidos en curso:
        // no puede borrarse hasta que esos pedidos se resuelvan.
        if (producto.stockReservado > 0) {
            dependencias.push("existencias reservadas por pedidos en curso");
        }

        return { producto, dependencias };
    });

    const { producto, dependencias } = analisis;

    if (dependencias.length === 0) {
        try {
            const eliminado = await prisma.producto.deleteMany({
                where: { id, empresaId },
            });
            if (eliminado.count === 1) {
                return {
                    id: producto.id,
                    sku: producto.sku,
                    nombre: producto.nombre,
                    modo: "eliminado",
                    dependencias: [],
                };
            }
        } catch (error) {
            // Una venta o un pedido se registró entre el análisis y el
            // borrado: se conserva el historial y se archiva el producto.
            if (!esViolacionDeLlaveForanea(error)) throw error;
        }
    }

    const archivado = await prisma.producto.updateMany({
        where: { id, empresaId },
        data: { activo: false, publicadoMarketplace: false },
    });

    if (archivado.count !== 1) throw productoNotFound();

    return {
        id: producto.id,
        sku: producto.sku,
        nombre: producto.nombre,
        modo: "archivado",
        dependencias,
    };
};

export const createProductService = (prisma: PrismaClient): ProductService => ({
    listar: (filtros) => listarProductos(prisma, filtros),
    obtener: (empresaId, id) => obtenerProducto(prisma, empresaId, id),
    crear: (empresaId, datos) => crearProducto(prisma, empresaId, datos),
    actualizar: (empresaId, id, datos) =>
        actualizarProducto(prisma, empresaId, id, datos),
    cambiarEstado: (empresaId, id, activo) =>
        cambiarEstadoProducto(prisma, empresaId, id, activo),
    eliminar: (empresaId, id) => eliminarProducto(prisma, empresaId, id),
});
