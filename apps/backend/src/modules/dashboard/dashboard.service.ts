import { EstadoVenta, Prisma, type PrismaClient } from "@prisma/client";

export interface ProductoStockBajo {
    id: string;
    sku: string;
    nombre: string;
    stock: number;
    stockMinimo: number;
}

export interface CompraReciente {
    id: string;
    estado: string;
    total: string;
    creadaEn: Date;
    proveedor: { nombre: string };
}

export interface ProductoMasVendido {
    id: string;
    sku: string;
    nombre: string;
    cantidad: number;
}

export interface DashboardResumen {
    ventasHoy: { total: string; cantidad: number };
    ventasMes: { total: string; cantidad: number };
    ingresosMes: string;
    productosStockBajo: { total: number; productos: ProductoStockBajo[] };
    clientesNuevos: number;
    comprasRecientes: CompraReciente[];
    productosMasVendidos: ProductoMasVendido[];
}

export interface DashboardService {
    obtenerResumen(empresaId: string): Promise<DashboardResumen>;
}

const obtenerResumen = async (
    prisma: PrismaClient,
    empresaId: string,
): Promise<DashboardResumen> => {
    const ahora = new Date();
    const inicioHoy = new Date(
        Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
    );
    const inicioManana = new Date(inicioHoy.getTime() + 24 * 60 * 60 * 1000);
    const inicioMes = new Date(
        Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1),
    );
    const filtroVentasHoy: Prisma.VentaWhereInput = {
        empresaId,
        estado: EstadoVenta.CONFIRMADA,
        creadaEn: { gte: inicioHoy, lt: inicioManana },
    };
    const filtroVentasMes: Prisma.VentaWhereInput = {
        empresaId,
        estado: EstadoVenta.CONFIRMADA,
        creadaEn: { gte: inicioMes },
    };
    const filtroStockBajo: Prisma.ProductoWhereInput = {
        empresaId,
        activo: true,
        stock: { lte: prisma.producto.fields.stockMinimo },
    };

    const [
        agregadoHoy,
        cantidadVentasHoy,
        agregadoMes,
        cantidadVentasMes,
        agregadoIngresosMes,
        totalProductosStockBajo,
        productosStockBajo,
        clientesNuevos,
        comprasRecientes,
        productosAgrupados,
    ] = await Promise.all([
        prisma.venta.aggregate({
            where: filtroVentasHoy,
            _sum: { total: true },
        }),
        prisma.venta.count({ where: filtroVentasHoy }),
        prisma.venta.aggregate({
            where: filtroVentasMes,
            _sum: { total: true },
        }),
        prisma.venta.count({ where: filtroVentasMes }),
        prisma.pagoVenta.aggregate({
            where: {
                creadaEn: { gte: inicioMes },
                venta: { empresaId, estado: EstadoVenta.CONFIRMADA },
            },
            _sum: { monto: true },
        }),
        prisma.producto.count({ where: filtroStockBajo }),
        prisma.producto.findMany({
            where: filtroStockBajo,
            select: {
                id: true,
                sku: true,
                nombre: true,
                stock: true,
                stockMinimo: true,
            },
            orderBy: [{ stock: "asc" }, { nombre: "asc" }],
            take: 5,
        }),
        prisma.cliente.count({
            where: { empresaId, creadaEn: { gte: inicioMes } },
        }),
        prisma.compra.findMany({
            where: { empresaId },
            select: {
                id: true,
                estado: true,
                total: true,
                creadaEn: true,
                proveedor: { select: { nombre: true } },
            },
            orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
            take: 5,
        }),
        prisma.detalleVenta.groupBy({
            by: ["productoId"],
            where: { venta: filtroVentasMes },
            _sum: { cantidad: true },
            orderBy: { _sum: { cantidad: "desc" } },
            take: 5,
        }),
    ]);

    const idsProductos = productosAgrupados.map(({ productoId }) => productoId);
    const productos = idsProductos.length
        ? await prisma.producto.findMany({
              where: { empresaId, id: { in: idsProductos } },
              select: { id: true, sku: true, nombre: true },
          })
        : [];
    const productosPorId = new Map(
        productos.map((producto) => [producto.id, producto]),
    );

    return {
        ventasHoy: {
            total: agregadoHoy._sum.total?.toString() ?? "0",
            cantidad: cantidadVentasHoy,
        },
        ventasMes: {
            total: agregadoMes._sum.total?.toString() ?? "0",
            cantidad: cantidadVentasMes,
        },
        ingresosMes: agregadoIngresosMes._sum.monto?.toString() ?? "0",
        productosStockBajo: {
            total: totalProductosStockBajo,
            productos: productosStockBajo,
        },
        clientesNuevos,
        comprasRecientes: comprasRecientes.map((compra) => ({
            ...compra,
            total: compra.total.toString(),
        })),
        productosMasVendidos: productosAgrupados.flatMap((producto) => {
            const datos = productosPorId.get(producto.productoId);
            return datos
                ? [
                      {
                          ...datos,
                          cantidad: producto._sum.cantidad ?? 0,
                      },
                  ]
                : [];
        }),
    };
};

export const createDashboardService = (
    prisma: PrismaClient,
): DashboardService => ({
    obtenerResumen: (empresaId) => obtenerResumen(prisma, empresaId),
});
