
import { Rol, type PrismaClient } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT } from "jose";

import { AppError } from "../../errors/app-error.js";
import { enviarCorreo } from "../../lib/correo.js";
import { redisGet, redisSet } from "../../lib/redis.js";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const hashRounds = 12;
const resetTokenDurationMs = 60 * 60 * 1000;

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;",
        };
        return entities[character] ?? character;
    });
}

export const sessionDurationSeconds = 60 * 60 * 8;

const rolesPermitidos = new Set(Object.values(Rol));

// ============================================================
// TIPOS
// ============================================================

export interface DatosRegistro {
    nombreEmpresa: string;
    nombre: string;
    apellido: string;
    correo: string;
    contrasena: string;
}

export interface DatosInicioSesion {
    correo: string;
    contrasena: string;
}

export interface DatosRestablecerContrasena {
    token: string;
    contrasena: string;
}

export interface ConfiguracionRecuperacion {
    mailtrapSmtpHost?: string;
    mailtrapSmtpPort?: number;
    mailtrapSmtpUser?: string;
    mailtrapSmtpPass?: string;
    mailtrapFromEmail?: string;
    mailtrapFromName?: string;
    frontendUrl?: string;
}

export interface UsuarioAutenticado {
    id: string;
    empresaId: string;
    nombre: string;
    apellido: string;
    correo: string;
    rol: Rol;
}

export interface PerfilUsuario extends UsuarioAutenticado {
    empresa: string;
}

export interface AuthService {
    registrar(datos: DatosRegistro): Promise<UsuarioAutenticado>;
    iniciarSesion(datos: DatosInicioSesion): Promise<UsuarioAutenticado>;
    solicitarRecuperacion(correo: string): Promise<void>;
    restablecerContrasena(datos: DatosRestablecerContrasena): Promise<void>;
    validarSesion(id: string, empresaId: string): Promise<Rol | null>;
    obtenerPerfil(id: string, empresaId: string): Promise<PerfilUsuario>;
    createToken(usuario: UsuarioAutenticado): Promise<string>;
}

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

// Convierte un registro de Prisma en un usuario autenticado.
export const toAuthenticatedUser = (usuario: UsuarioAutenticado): UsuarioAutenticado => {
    if (!rolesPermitidos.has(usuario.rol)) {
        throw new Error("El usuario tiene asignado un rol no reconocido.");
    }

    return {
        id: usuario.id,
        empresaId: usuario.empresaId,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
    };
};

// ============================================================
// REGISTRO
// ============================================================

export const registrar = async (
    prisma: PrismaClient,
    datos: DatosRegistro,
): Promise<UsuarioAutenticado> => {
    const contrasenaHash = await hash(datos.contrasena, hashRounds);

    try {
        const usuario = await prisma.usuario.create({
            data: {
                nombre: datos.nombre,
                apellido: datos.apellido,
                correo: datos.correo,
                contrasenaHash,
                rol: Rol.ADMINISTRADOR,
                empresa: {
                    create: {
                        nombre: datos.nombreEmpresa,
                    },
                },
            },
            select: {
                id: true,
                empresaId: true,
                nombre: true,
                apellido: true,
                correo: true,
                rol: true,
            },
        });

        return toAuthenticatedUser(usuario);
    } catch (error) {
        if (
            error instanceof Error &&
            "code" in error &&
            error.code === "P2002"
        ) {
            throw new AppError(
                "CORREO_REGISTRADO",
                "Ya existe una cuenta con este correo.",
                409,
            );
        }

        throw error;
    }
};

// ============================================================
// INICIO DE SESIÓN
// ============================================================

export const iniciarSesion = async (
    prisma: PrismaClient,
    datos: DatosInicioSesion,
): Promise<UsuarioAutenticado> => {
    const usuario = await prisma.usuario.findUnique({
        where: {
            correo: datos.correo,
        },
    });

    if (
        !usuario ||
        !usuario.activo ||
        !(await compare(datos.contrasena, usuario.contrasenaHash))
    ) {
        throw new AppError(
            "CREDENCIALES_INVALIDAS",
            "El correo o la contraseña son incorrectos.",
            401,
        );
    }

    return toAuthenticatedUser(usuario);
};

export const solicitarRecuperacion = async (
    prisma: PrismaClient,
    correo: string,
    config: ConfiguracionRecuperacion,
): Promise<void> => {
    if (
        !config.mailtrapSmtpHost ||
        !config.mailtrapSmtpPort ||
        !config.mailtrapSmtpUser ||
        !config.mailtrapSmtpPass ||
        !config.mailtrapFromEmail ||
        !config.frontendUrl
    ) {
        throw new AppError(
            "RECUPERACION_NO_CONFIGURADA",
            "La recuperación de contraseña no está configurada en el servidor.",
            503,
        );
    }

    const usuario = await prisma.usuario.findUnique({
        where: { correo },
        select: { id: true, nombre: true, correo: true, activo: true },
    });

    if (!usuario || !usuario.activo) {
        return;
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + resetTokenDurationMs);

    await prisma.passwordResetToken.upsert({
        where: { userId: usuario.id },
        create: { userId: usuario.id, tokenHash, expiresAt },
        update: { tokenHash, expiresAt, createdAt: new Date() },
    });

    const resetUrl = new URL("/auth/reset-password", config.frontendUrl);
    resetUrl.searchParams.set("token", token);
    const link = resetUrl.toString();
    const nombreHtml = escapeHtml(usuario.nombre);

    // Con REDIS_URL el correo se encola en BullMQ y lo envía el worker;
    // sin Redis se envía de forma síncrona (comportamiento original).
    await enviarCorreo(config, {
        destinatario: usuario.correo,
        asunto: "Recupera tu contraseña de NexoERP",
        texto: `Hola ${usuario.nombre}, usa este enlace para crear una nueva contraseña: ${link}\n\nEl enlace vence en una hora. Si no solicitaste este cambio, ignora este correo.`,
        html: `<p>Hola ${nombreHtml},</p><p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de NexoERP.</p><p><a href="${link.replaceAll("&", "&amp;")}">Crear nueva contraseña</a></p><p>El enlace vence en una hora. Si no solicitaste este cambio, ignora este correo.</p>`,
    });
};

export const restablecerContrasena = async (
    prisma: PrismaClient,
    datos: DatosRestablecerContrasena,
): Promise<void> => {
    const tokenHash = createHash("sha256").update(datos.token).digest("hex");
    const token = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { userId: true, expiresAt: true },
    });

    if (!token || token.expiresAt <= new Date()) {
        throw new AppError(
            "ENLACE_RECUPERACION_INVALIDO",
            "El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.",
            400,
        );
    }

    const contrasenaHash = await hash(datos.contrasena, hashRounds);

    await prisma.$transaction(async (transaction) => {
        const tokenConsumido = await transaction.passwordResetToken.deleteMany({
            where: { tokenHash, expiresAt: { gt: new Date() } },
        });

        if (tokenConsumido.count !== 1) {
            throw new AppError(
                "ENLACE_RECUPERACION_INVALIDO",
                "El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.",
                400,
            );
        }

        const usuarioActualizado = await transaction.usuario.updateMany({
            where: { id: token.userId, activo: true },
            data: { contrasenaHash },
        });

        if (usuarioActualizado.count !== 1) {
            throw new AppError(
                "ENLACE_RECUPERACION_INVALIDO",
                "El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.",
                400,
            );
        }
    });
};

// ============================================================
// OBTENER PERFIL
// ============================================================

export const obtenerPerfil = async (
    prisma: PrismaClient,
    id: string,
    empresaId: string,
): Promise<PerfilUsuario> => {
    const usuario = await prisma.usuario.findFirst({
        where: {
            id,
            empresaId,
            activo: true,
        },
        select: {
            id: true,
            empresaId: true,
            nombre: true,
            apellido: true,
            correo: true,
            rol: true,
            empresa: {
                select: {
                    nombre: true,
                },
            },
        },
    });

    if (!usuario) {
        throw new AppError(
            "SESION_INVALIDA",
            "La sesión ya no es válida.",
            401,
        );
    }

    return {
        id: usuario.id,
        empresaId: usuario.empresaId,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        empresa: usuario.empresa.nombre,
    };
};

export const validarSesion = async (
    prisma: PrismaClient,
    id: string,
    empresaId: string,
): Promise<Rol | null> => {
    const usuario = await prisma.usuario.findFirst({
        where: {
            id,
            empresaId,
            activo: true,
        },
        select: { rol: true },
    });

    return usuario?.rol ?? null;
};

// ============================================================
// CREAR TOKEN JWT
// ============================================================

export const createToken = async (
    usuario: UsuarioAutenticado,
    jwtSecret: string,
): Promise<string> => {
    const secret = new TextEncoder().encode(jwtSecret);

    return new SignJWT({
        empresaId: usuario.empresaId,
        rol: usuario.rol,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(usuario.id)
        .setIssuedAt()
        .setExpirationTime(`${sessionDurationSeconds}s`)
        .sign(secret);
};

export const createAuthService = (
    prisma: PrismaClient,
    jwtSecret: string,
    recoveryConfig: ConfiguracionRecuperacion = {},
): AuthService => ({
    registrar: (datos) => registrar(prisma, datos),
    iniciarSesion: (datos) => iniciarSesion(prisma, datos),
    solicitarRecuperacion: (correo) =>
        solicitarRecuperacion(prisma, correo, recoveryConfig),
    restablecerContrasena: (datos) => restablecerContrasena(prisma, datos),
    validarSesion: async (id, empresaId) => {
        // Caché Redis opcional: evita una query a la base de datos en cada
        // request autenticado. Solo se cachean sesiones válidas (TTL 5 min);
        // los cambios de rol/estado invalidan la clave en usuarios.service.
        // Sin REDIS_URL configurada, redisGet devuelve null y se consulta
        // siempre la base de datos (comportamiento original).
        const clave = `sesion:${id}:${empresaId}`;
        const cacheada = await redisGet(clave);
        if (cacheada && rolesPermitidos.has(cacheada as Rol)) {
            return cacheada as Rol;
        }

        const rol = await validarSesion(prisma, id, empresaId);
        if (rol) {
            await redisSet(clave, rol, 300);
        }
        return rol;
    },
    obtenerPerfil: (id, empresaId) => obtenerPerfil(prisma, id, empresaId),
    createToken: (usuario) => createToken(usuario, jwtSecret),
});
