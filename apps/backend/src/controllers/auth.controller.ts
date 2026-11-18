
import type { RequestHandler } from "express";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import { AppError } from "../errors/app-error.js";
import {
    sessionDurationSeconds,
    type AuthService,
} from "../modules/auth/auth.service.js";

// ============================================================
// VALIDACIONES
// ============================================================

const passwordSchema = z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-ZÁÉÍÓÚÜÑ]/)
    .regex(/[a-záéíóúüñ]/)
    .regex(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/);

const correoSchema = z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((valor) => valor.toLowerCase());

const registrationSchema = z.object({
    nombreEmpresa: z.string().trim().min(2).max(120),
    nombre: z.string().trim().min(2).max(80),
    apellido: z.string().trim().min(2).max(80),
    correo: correoSchema,
    contrasena: passwordSchema,
});

const loginSchema = z.object({
    correo: correoSchema,
    contrasena: z.string().min(1).max(72),
});

const recoveryRequestSchema = z.object({
    correo: correoSchema,
});

const passwordResetSchema = z.object({
    token: z.string().min(32).max(128),
    contrasena: passwordSchema,
});

// ============================================================
// CONTROLADORES
// ============================================================

export const createAuthController = (
    authService: AuthService,
    config: AppConfig,
) => {

    // Configuración de cookies
    const cookieOptions = {
        httpOnly: true,
        secure: config.environment === "production",
        sameSite: "lax" as const,
        path: "/api",
        maxAge: sessionDurationSeconds * 1000,
    };

    // ========================================================
    // REGISTRAR USUARIO
    // ========================================================

    const registrar: RequestHandler = async (req, res, next) => {
        try {
            const resultado = registrationSchema.safeParse(req.body);

            if (!resultado.success) {
                throw new AppError(
                    "DATOS_INVALIDOS",
                    "Revisa el nombre de la empresa, tus datos y los requisitos de contraseña.",
                    400,
                );
            }

            const usuario = await authService.registrar(resultado.data);
            const token = await authService.createToken(usuario);

            res.cookie("nexo_sesion", token, cookieOptions);

            res.status(201).json({
                exito: true,
                datos: { usuario },
                mensaje: "La cuenta y la empresa se crearon correctamente.",
            });

        } catch (error) {
            next(error);
        }
    };

    // ========================================================
    // INICIAR SESIÓN
    // ========================================================

    const iniciarSesion: RequestHandler = async (req, res, next) => {
        try {
            const resultado = loginSchema.safeParse(req.body);

            if (!resultado.success) {
                throw new AppError(
                    "DATOS_INVALIDOS",
                    "Introduce un correo electrónico y una contraseña válidos.",
                    400,
                );
            }

            const usuario = await authService.iniciarSesion(resultado.data);
            const token = await authService.createToken(usuario);

            res.cookie("nexo_sesion", token, cookieOptions);

            res.json({
                exito: true,
                datos: { usuario },
                mensaje: "Inicio de sesión correcto.",
            });

        } catch (error) {
            next(error);
        }
    };

    // ========================================================
    // SOLICITAR RECUPERACIÓN DE CONTRASEÑA
    // ========================================================

    const solicitarRecuperacion: RequestHandler = async (req, res, next) => {
        try {
            const resultado = recoveryRequestSchema.safeParse(req.body);

            if (!resultado.success) {
                throw new AppError(
                    "DATOS_INVALIDOS",
                    "Introduce un correo electrónico válido.",
                    400,
                );
            }

            try {
                await authService.solicitarRecuperacion(resultado.data.correo);

            } catch (error) {
                if (
                    !(error instanceof AppError) ||
                    error.codigo !== "EMAIL_NO_DISPONIBLE"
                ) {
                    throw error;
                }
            }

            res.json({
                exito: true,
                mensaje:
                    "Si existe una cuenta asociada a ese correo, recibirás instrucciones para recuperar tu contraseña.",
            });

        } catch (error) {
            next(error);
        }
    };

    // ========================================================
    // RESTABLECER CONTRASEÑA
    // ========================================================

    const restablecerContrasena: RequestHandler = async (req, res, next) => {
        try {
            const resultado = passwordResetSchema.safeParse(req.body);

            if (!resultado.success) {
                throw new AppError(
                    "DATOS_INVALIDOS",
                    "Revisa el enlace y los requisitos de la nueva contraseña.",
                    400,
                );
            }

            await authService.restablecerContrasena(resultado.data);

            res.json({
                exito: true,
                mensaje: "La contraseña se actualizó correctamente.",
            });

        } catch (error) {
            next(error);
        }
    };

    // ========================================================
    // OBTENER PERFIL
    // ========================================================

    const perfil: RequestHandler = async (req, res, next) => {
        try {
            const usuario = req.usuario;

            if (!usuario) {
                throw new AppError(
                    "NO_AUTENTICADO",
                    "Debes iniciar sesión para continuar.",
                    401,
                );
            }

            const perfilUsuario = await authService.obtenerPerfil(
                usuario.id,
                usuario.empresaId,
            );

            res.json({
                exito: true,
                datos: { usuario: perfilUsuario },
            });

        } catch (error) {
            next(error);
        }
    };

    // ========================================================
    // CERRAR SESIÓN
    // ========================================================

    const cerrarSesion: RequestHandler = (_req, res, next) => {
        try {
            res.clearCookie("nexo_sesion", {
                httpOnly: cookieOptions.httpOnly,
                secure: cookieOptions.secure,
                sameSite: cookieOptions.sameSite,
                path: cookieOptions.path,
            });

            res.json({
                exito: true,
                mensaje: "La sesión se cerró correctamente.",
            });

        } catch (error) {
            next(error);
        }
    };

    // ========================================================
    // EXPORTAR CONTROLADORES
    // ========================================================

    return {
        registrar,
        iniciarSesion,
        solicitarRecuperacion,
        restablecerContrasena,
        perfil,
        cerrarSesion,
    };
};
