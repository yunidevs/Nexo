import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";

export interface DatosCrearCategoria {
    nombre: string;
    descripcion?: string | null | undefined;
}

export type DatosActualizarCategoria = Partial<DatosCrearCategoria>;

export interface FiltrosCategorias {
    empresaId: string;
    buscar: string;
    activo?: boolean;
    pagina: number;
    limite: number;
}

const camposPublicos = {
    id: true,
    nombre: true,
    descripcion: true,
    activo: true,
    creadaEn: true,
    actualizadaEn: true,
} satisfies Prisma.CategoriaSelect;

export type CategoriaPublica = Prisma.CategoriaGetPayload<{
    select: typeof camposPublicos;
}>;

export interface ResultadoCategorias {
    datos: CategoriaPublica[];
    paginacion: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

export interface CategoryService {
    listar(filtros: FiltrosCategorias): Promise<ResultadoCategorias>;
    obtener(empresaId: string, id: string): Promise<CategoriaPublica>;
    crear(empresaId: string, datos: DatosCrearCategoria): Promise<CategoriaPublica>;
    actualizar(
        empresaId: string,
        id: string,
        datos: DatosActualizarCategoria,
    ): Promise<CategoriaPublica>;
    cambiarEstado(
        empresaId: string,
        id: string,
        activo: boolean,
    ): Promise<CategoriaPublica>;
}

const categoriaNotFound = () =>
    new AppError(
        "CATEGORIA_NO_ENCONTRADA",
        "La categoría solicitada no existe.",
        404,
    );

const ensureCategoryExists = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
): Promise<void> => {
    const categoria = await prisma.categoria.findFirst({
        where: { id, empresaId },
        select: { id: true },
    });

    if (!categoria) throw categoriaNotFound();
};

export const listarCategorias = async (
    prisma: PrismaClient,
    filtros: FiltrosCategorias,
): Promise<ResultadoCategorias> => {
    const where: Prisma.CategoriaWhereInput = {
        empresaId: filtros.empresaId,
        ...(filtros.activo === undefined ? {} : { activo: filtros.activo }),
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
                          descripcion: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                  ],
              }
            : {}),
    };

    const [datos, total] = await Promise.all([
        prisma.categoria.findMany({
            where,
            select: camposPublicos,
            orderBy: [{ nombre: "asc" }, { id: "asc" }],
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        }),
        prisma.categoria.count({ where }),
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

export const obtenerCategoria = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
): Promise<CategoriaPublica> => {
    const categoria = await prisma.categoria.findFirst({
        where: { id, empresaId },
        select: camposPublicos,
    });

    if (!categoria) throw categoriaNotFound();
    return categoria;
};

export const crearCategoria = async (
    prisma: PrismaClient,
    empresaId: string,
    datos: DatosCrearCategoria,
): Promise<CategoriaPublica> =>
    prisma.categoria.create({
        data: {
            nombre: datos.nombre,
            descripcion: datos.descripcion ?? null,
            empresaId,
        },
        select: camposPublicos,
    });

export const actualizarCategoria = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
    datos: DatosActualizarCategoria,
): Promise<CategoriaPublica> => {
    await ensureCategoryExists(prisma, empresaId, id);

    const datosActualizados: Prisma.CategoriaUpdateInput = {};

    if (datos.nombre !== undefined) datosActualizados.nombre = datos.nombre;
    if (datos.descripcion !== undefined)
        datosActualizados.descripcion = datos.descripcion ?? null;

    return prisma.categoria.update({
        where: { id, empresaId },
        data: datosActualizados,
        select: camposPublicos,
    });
};

export const cambiarEstadoCategoria = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
    activo: boolean,
): Promise<CategoriaPublica> => {
    await ensureCategoryExists(prisma, empresaId, id);

    return prisma.categoria.update({
        where: { id, empresaId },
        data: { activo },
        select: camposPublicos,
    });
};

export const createCategoryService = (
    prisma: PrismaClient,
): CategoryService => ({
    listar: (filtros) => listarCategorias(prisma, filtros),
    obtener: (empresaId, id) => obtenerCategoria(prisma, empresaId, id),
    crear: (empresaId, datos) => crearCategoria(prisma, empresaId, datos),
    actualizar: (empresaId, id, datos) =>
        actualizarCategoria(prisma, empresaId, id, datos),
    cambiarEstado: (empresaId, id, activo) =>
        cambiarEstadoCategoria(prisma, empresaId, id, activo),
});
