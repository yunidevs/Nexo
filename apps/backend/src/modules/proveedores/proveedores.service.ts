import {
    Prisma,
    TipoOperacionProveedor,
    type PrismaClient,
} from "@prisma/client";
import { AppError } from "../../errors/app-error.js";

export interface DatosCrearProveedor {
    nombre: string;
    documento?: string | null | undefined;
    telefono?: string | null | undefined;
    correo?: string | null | undefined;
    direccion?: string | null | undefined;
}

export type DatosActualizarProveedor = Partial<DatosCrearProveedor>;

export interface FiltrosProveedores {
    empresaId: string;
    buscar: string;
    activo?: boolean;
    pagina: number;
    limite: number;
}

export interface DatosCompraProveedor {
    fechaCompra: Date;
    detalle: string;
    total: number;
}

const camposPublicos = {
    id: true,
    nombre: true,
    documento: true,
    telefono: true,
    correo: true,
    direccion: true,
    activo: true,
    creadaEn: true,
    actualizadaEn: true,
} satisfies Prisma.ProveedorSelect;

const camposOperacion = {
    id: true,
    tipo: true,
    detalle: true,
    fechaCompra: true,
    total: true,
    creadaEn: true,
    usuario: {
        select: { nombre: true, apellido: true },
    },
} satisfies Prisma.OperacionProveedorSelect;

export type ProveedorPublico = Prisma.ProveedorGetPayload<{
    select: typeof camposPublicos;
}>;

export type OperacionProveedorPublica = Prisma.OperacionProveedorGetPayload<{
    select: typeof camposOperacion;
}>;

export interface ResultadoProveedores {
    datos: ProveedorPublico[];
    paginacion: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

export interface ResultadoOperacionesProveedor {
    datos: OperacionProveedorPublica[];
    paginacion: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

export interface SupplierService {
    listar(filtros: FiltrosProveedores): Promise<ResultadoProveedores>;
    obtener(empresaId: string, id: string): Promise<ProveedorPublico>;
    crear(
        empresaId: string,
        usuarioId: string,
        datos: DatosCrearProveedor,
    ): Promise<ProveedorPublico>;
    actualizar(
        empresaId: string,
        usuarioId: string,
        id: string,
        datos: DatosActualizarProveedor,
    ): Promise<ProveedorPublico>;
    cambiarEstado(
        empresaId: string,
        usuarioId: string,
        id: string,
        activo: boolean,
    ): Promise<ProveedorPublico>;
    listarOperaciones(
        empresaId: string,
        proveedorId: string,
        pagina: number,
        limite: number,
    ): Promise<ResultadoOperacionesProveedor>;
    registrarCompra(
        empresaId: string,
        usuarioId: string,
        proveedorId: string,
        datos: DatosCompraProveedor,
    ): Promise<OperacionProveedorPublica>;
}

const supplierNotFound = () =>
    new AppError(
        "PROVEEDOR_NO_ENCONTRADO",
        "El proveedor solicitado no existe.",
        404,
    );

const ensureSupplierExists = async (
    prisma: PrismaClient | Prisma.TransactionClient,
    empresaId: string,
    id: string,
): Promise<void> => {
    const proveedor = await prisma.proveedor.findFirst({
        where: { id, empresaId },
        select: { id: true },
    });

    if (!proveedor) throw supplierNotFound();
};

const registrarOperacion = (
    tx: Prisma.TransactionClient,
    datos: {
        proveedorId: string;
        usuarioId: string;
        tipo: TipoOperacionProveedor;
        detalle: string;
        fechaCompra?: Date;
        total?: Prisma.Decimal;
    },
) =>
    tx.operacionProveedor.create({
        data: datos,
    });

export const listarProveedores = async (
    prisma: PrismaClient,
    filtros: FiltrosProveedores,
): Promise<ResultadoProveedores> => {
    const where: Prisma.ProveedorWhereInput = {
        empresaId: filtros.empresaId,
        ...(filtros.activo === undefined
            ? {}
            : { activo: filtros.activo }),
        ...(filtros.buscar
            ? {
                  OR: [
                      {
                          nombre: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                      {
                          documento: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                      {
                          correo: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                      {
                          telefono: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                  ],
              }
            : {}),
    };

    const [datos, total] = await Promise.all([
        prisma.proveedor.findMany({
            where,
            select: camposPublicos,
            orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        }),
        prisma.proveedor.count({ where }),
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

export const obtenerProveedor = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
): Promise<ProveedorPublico> => {
    const proveedor = await prisma.proveedor.findFirst({
        where: { id, empresaId },
        select: camposPublicos,
    });

    if (!proveedor) throw supplierNotFound();
    return proveedor;
};

export const crearProveedor = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    datos: DatosCrearProveedor,
): Promise<ProveedorPublico> =>
    prisma.$transaction(async (tx) => {
        const proveedor = await tx.proveedor.create({
            data: {
                nombre: datos.nombre,
                documento: datos.documento ?? null,
                telefono: datos.telefono ?? null,
                correo: datos.correo ?? null,
                direccion: datos.direccion ?? null,
                empresaId,
            },
            select: camposPublicos,
        });

        await registrarOperacion(tx, {
            proveedorId: proveedor.id,
            usuarioId,
            tipo: TipoOperacionProveedor.CREADO,
            detalle: `Proveedor creado: ${proveedor.nombre}.`,
        });

        return proveedor;
    });

export const actualizarProveedor = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    id: string,
    datos: DatosActualizarProveedor,
): Promise<ProveedorPublico> =>
    prisma.$transaction(async (tx) => {
        const existente = await tx.proveedor.findFirst({
            where: { id, empresaId },
            select: camposPublicos,
        });

        if (!existente) throw supplierNotFound();

        const camposActualizados = Object.entries(datos).filter(
            ([campo, valor]) =>
                existente[campo as keyof typeof existente] !== valor,
        );

        if (camposActualizados.length === 0) return existente;

        const datosActualizados: Prisma.ProveedorUpdateInput = {};

        if (datos.nombre !== undefined) datosActualizados.nombre = datos.nombre;
        if (datos.documento !== undefined)
            datosActualizados.documento = datos.documento ?? null;
        if (datos.telefono !== undefined)
            datosActualizados.telefono = datos.telefono ?? null;
        if (datos.correo !== undefined)
            datosActualizados.correo = datos.correo ?? null;
        if (datos.direccion !== undefined)
            datosActualizados.direccion = datos.direccion ?? null;

        const proveedor = await tx.proveedor.update({
            where: { id },
            data: datosActualizados,
            select: camposPublicos,
        });

        await registrarOperacion(tx, {
            proveedorId: id,
            usuarioId,
            tipo: TipoOperacionProveedor.ACTUALIZADO,
            detalle: `Proveedor actualizado. Campos modificados: ${camposActualizados
                .map(([campo]) => campo)
                .join(", ")}.`,
        });

        return proveedor;
    });

export const cambiarEstadoProveedor = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    id: string,
    activo: boolean,
): Promise<ProveedorPublico> =>
    prisma.$transaction(async (tx) => {
        const existente = await tx.proveedor.findFirst({
            where: { id, empresaId },
            select: { id: true, nombre: true, activo: true },
        });

        if (!existente) throw supplierNotFound();
        if (existente.activo === activo) {
            return tx.proveedor.findUniqueOrThrow({
                where: { id },
                select: camposPublicos,
            });
        }

        const proveedor = await tx.proveedor.update({
            where: { id },
            data: { activo },
            select: camposPublicos,
        });

        await registrarOperacion(tx, {
            proveedorId: id,
            usuarioId,
            tipo: activo
                ? TipoOperacionProveedor.ACTIVADO
                : TipoOperacionProveedor.DESACTIVADO,
            detalle: activo
                ? "Proveedor reactivado."
                : "Proveedor desactivado.",
        });

        return proveedor;
    });

export const listarOperacionesProveedor = async (
    prisma: PrismaClient,
    empresaId: string,
    proveedorId: string,
    pagina: number,
    limite: number,
): Promise<ResultadoOperacionesProveedor> => {
    await ensureSupplierExists(prisma, empresaId, proveedorId);
    const where: Prisma.OperacionProveedorWhereInput = { proveedorId };

    const [datos, total] = await Promise.all([
        prisma.operacionProveedor.findMany({
            where,
            select: camposOperacion,
            orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
            skip: (pagina - 1) * limite,
            take: limite,
        }),
        prisma.operacionProveedor.count({ where }),
    ]);

    return {
        datos,
        paginacion: {
            pagina,
            limite,
            total,
            totalPaginas: Math.ceil(total / limite),
        },
    };
};

export const registrarCompraProveedor = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    proveedorId: string,
    datos: DatosCompraProveedor,
): Promise<OperacionProveedorPublica> =>
    prisma.$transaction(async (tx) => {
        await ensureSupplierExists(tx, empresaId, proveedorId);
        const compra = await registrarOperacion(tx, {
            proveedorId,
            usuarioId,
            tipo: TipoOperacionProveedor.COMPRA_REGISTRADA,
            detalle: datos.detalle,
            fechaCompra: datos.fechaCompra,
            total: new Prisma.Decimal(datos.total),
        });

        return tx.operacionProveedor.findUniqueOrThrow({
            where: { id: compra.id },
            select: camposOperacion,
        });
    });

export const createSupplierService = (
    prisma: PrismaClient,
): SupplierService => ({
    listar: (filtros) => listarProveedores(prisma, filtros),
    obtener: (empresaId, id) => obtenerProveedor(prisma, empresaId, id),
    crear: (empresaId, usuarioId, datos) =>
        crearProveedor(prisma, empresaId, usuarioId, datos),
    actualizar: (empresaId, usuarioId, id, datos) =>
        actualizarProveedor(prisma, empresaId, usuarioId, id, datos),
    cambiarEstado: (empresaId, usuarioId, id, activo) =>
        cambiarEstadoProveedor(prisma, empresaId, usuarioId, id, activo),
    listarOperaciones: (empresaId, proveedorId, pagina, limite) =>
        listarOperacionesProveedor(prisma, empresaId, proveedorId, pagina, limite),
    registrarCompra: (empresaId, usuarioId, proveedorId, datos) =>
        registrarCompraProveedor(prisma, empresaId, usuarioId, proveedorId, datos),
});
