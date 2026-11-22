import { Prisma, Rol, type PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { AppError } from "../../errors/app-error.js";
import { redisDel } from "../../lib/redis.js";

const hashRounds = 12;

export interface DatosCrearUsuario {
    nombre: string;
    apellido: string;
    correo: string;
    contrasena: string;
    rol: Rol;
}

export type DatosActualizarUsuario = Partial<
    Pick<DatosCrearUsuario, "nombre" | "apellido" | "correo">
>;

export interface FiltrosUsuarios {
    empresaId: string;
    buscar: string;
    activo?: boolean;
    pagina: number;
    limite: number;
}

const camposPublicos = {
    id: true,
    nombre: true,
    apellido: true,
    correo: true,
    rol: true,
    activo: true,
    creadaEn: true,
    actualizadaEn: true,
} satisfies Prisma.UsuarioSelect;

export type UsuarioPublico = Prisma.UsuarioGetPayload<{
    select: typeof camposPublicos;
}>;

export interface ResultadoUsuarios {
    datos: UsuarioPublico[];
    paginacion: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

export interface UserService {
    listar(filtros: FiltrosUsuarios): Promise<ResultadoUsuarios>;
    obtener(empresaId: string, id: string): Promise<UsuarioPublico>;
    crear(
        empresaId: string,
        datos: DatosCrearUsuario,
    ): Promise<UsuarioPublico>;
    actualizar(
        empresaId: string,
        id: string,
        datos: DatosActualizarUsuario,
    ): Promise<UsuarioPublico>;
    cambiarRol(
        empresaId: string,
        id: string,
        rol: Rol,
    ): Promise<UsuarioPublico>;
    cambiarEstado(
        empresaId: string,
        id: string,
        activo: boolean,
    ): Promise<UsuarioPublico>;
}

const usuarioNotFound = () =>
    new AppError("USUARIO_NO_ENCONTRADO", "El usuario solicitado no existe.", 404);

const correoRegistrado = () =>
    new AppError(
        "CORREO_REGISTRADO",
        "Ya existe una cuenta con este correo.",
        409,
    );

const ultimoAdministrador = () =>
    new AppError(
        "ULTIMO_ADMINISTRADOR",
        "La empresa debe conservar al menos un administrador activo.",
        409,
    );

const esCorreoDuplicado = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002";

export const listarUsuarios = async (
    prisma: PrismaClient,
    filtros: FiltrosUsuarios,
): Promise<ResultadoUsuarios> => {
    const where: Prisma.UsuarioWhereInput = {
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
                          apellido: {
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
                  ],
              }
            : {}),
    };

    const [datos, total] = await Promise.all([
        prisma.usuario.findMany({
            where,
            select: camposPublicos,
            orderBy: [{ apellido: "asc" }, { nombre: "asc" }, { id: "asc" }],
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        }),
        prisma.usuario.count({ where }),
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

export const obtenerUsuario = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
): Promise<UsuarioPublico> => {
    const usuario = await prisma.usuario.findFirst({
        where: { id, empresaId },
        select: camposPublicos,
    });

    if (!usuario) {
        throw usuarioNotFound();
    }

    return usuario;
};

export const crearUsuario = async (
    prisma: PrismaClient,
    empresaId: string,
    datos: DatosCrearUsuario,
): Promise<UsuarioPublico> => {
    const contrasenaHash = await hash(datos.contrasena, hashRounds);

    try {
        return await prisma.usuario.create({
            data: {
                empresaId,
                nombre: datos.nombre,
                apellido: datos.apellido,
                correo: datos.correo,
                contrasenaHash,
                rol: datos.rol,
            },
            select: camposPublicos,
        });
    } catch (error) {
        if (esCorreoDuplicado(error)) {
            throw correoRegistrado();
        }

        throw error;
    }
};

export const actualizarUsuario = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
    datos: DatosActualizarUsuario,
): Promise<UsuarioPublico> => {
    try {
        const resultado = await prisma.usuario.updateMany({
            where: { id, empresaId },
            data: datos,
        });

        if (resultado.count !== 1) {
            throw usuarioNotFound();
        }

        return await obtenerUsuario(prisma, empresaId, id);
    } catch (error) {
        if (esCorreoDuplicado(error)) {
            throw correoRegistrado();
        }

        throw error;
    }
};

const cambiarRolOEstado = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
    cambio: { rol: Rol } | { activo: boolean },
): Promise<UsuarioPublico> =>
    prisma.$transaction(
        async (transaction) => {
            const usuario = await transaction.usuario.findFirst({
                where: { id, empresaId },
                select: { id: true, rol: true, activo: true },
            });

            if (!usuario) {
                throw usuarioNotFound();
            }

            const quitaAdministradorActivo =
                usuario.rol === Rol.ADMINISTRADOR &&
                usuario.activo &&
                (("rol" in cambio && cambio.rol !== Rol.ADMINISTRADOR) ||
                    ("activo" in cambio && !cambio.activo));

            if (quitaAdministradorActivo) {
                const otrosAdministradores = await transaction.usuario.count({
                    where: {
                        empresaId,
                        rol: Rol.ADMINISTRADOR,
                        activo: true,
                        id: { not: id },
                    },
                });

                if (otrosAdministradores === 0) {
                    throw ultimoAdministrador();
                }
            }

            await transaction.usuario.update({
                where: { id },
                data: cambio,
                select: { id: true },
            });

            const usuarioActualizado = await transaction.usuario.findFirst({
                where: { id, empresaId },
                select: camposPublicos,
            });

            if (!usuarioActualizado) {
                throw usuarioNotFound();
            }

            return usuarioActualizado;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).then(async (actualizado) => {
        // Invalida la sesión cacheada en Redis para que el cambio de
        // rol/estado tenga efecto inmediato en la próxima petición.
        await redisDel(`sesion:${id}:${empresaId}`);
        return actualizado;
    });

export const cambiarRolUsuario = (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
    rol: Rol,
): Promise<UsuarioPublico> => cambiarRolOEstado(prisma, empresaId, id, { rol });

export const cambiarEstadoUsuario = (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
    activo: boolean,
): Promise<UsuarioPublico> =>
    cambiarRolOEstado(prisma, empresaId, id, { activo });

export const createUserService = (prisma: PrismaClient): UserService => ({
    listar: (filtros) => listarUsuarios(prisma, filtros),
    obtener: (empresaId, id) => obtenerUsuario(prisma, empresaId, id),
    crear: (empresaId, datos) => crearUsuario(prisma, empresaId, datos),
    actualizar: (empresaId, id, datos) =>
        actualizarUsuario(prisma, empresaId, id, datos),
    cambiarRol: (empresaId, id, rol) =>
        cambiarRolUsuario(prisma, empresaId, id, rol),
    cambiarEstado: (empresaId, id, activo) =>
        cambiarEstadoUsuario(prisma, empresaId, id, activo),
});
