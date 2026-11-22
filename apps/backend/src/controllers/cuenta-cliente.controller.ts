import type { RequestHandler } from "express";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import { AppError } from "../errors/app-error.js";
import { sessionDurationSeconds } from "../modules/auth/auth.service.js";
import type { ClienteCuentaService } from "../modules/cuenta-cliente/cuenta-cliente.service.js";

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

const telefonoSchema = z.string().trim().min(7).max(40);

const registroSchema = z.object({
    nombre: z.string().trim().min(2).max(80),
    apellido: z.string().trim().min(2).max(80).optional(),
    correo: correoSchema,
    contrasena: passwordSchema,
    telefono: telefonoSchema.optional(),
});

const loginSchema = z.object({
    correo: correoSchema,
    contrasena: z.string().min(1).max(72),
});

const recuperacionSchema = z.object({ correo: correoSchema });

const restablecerSchema = z.object({
    token: z.string().min(32).max(128),
    contrasena: passwordSchema,
});

const perfilSchema = z
    .object({
        nombre: z.string().trim().min(2).max(80).optional(),
        apellido: z
            .string()
            .trim()
            .min(2)
            .max(80)
            .nullable()
            .optional(),
        telefono: telefonoSchema.nullable().optional(),
        direccion: z.string().trim().max(600).nullable().optional(),
    })
    .strict();

const validateId = (value: string | string[] | undefined) => {
    const resultado = z
        .string()
        .uuid()
        .safeParse(typeof value === "string" ? value : "");
    if (!resultado.success) {
        throw new AppError(
            "IDENTIFICADOR_INVALIDO",
            "El identificador no es válido.",
            400,
        );
    }
    return resultado.data;
};

const requireCuenta = (
    cuenta: { id: string; correo: string } | undefined,
) => {
    if (!cuenta) {
        throw new AppError(
            "NO_AUTENTICADO",
            "Debes iniciar sesión para continuar.",
            401,
        );
    }
    return cuenta;
};

// ============================================================
// CONTROLADORES
// ============================================================

export const createClienteCuentaController = (
    service: ClienteCuentaService,
    config: AppConfig,
) => {
    const esProduccion = config.environment === "production";
    const cookieOptions = {
        httpOnly: true,
        secure: esProduccion,
        sameSite: (esProduccion ? "none" : "lax") as "none" | "lax",
        path: "/api",
        maxAge: sessionDurationSeconds * 1000,
    };

    const registrar: RequestHandler = async (req, res, next) => {
        try {
            const resultado = registroSchema.safeParse(req.body);
            if (!resultado.success) {
                throw new AppError(
                    "DATOS_INVALIDOS",
                    "Revisa tus datos y los requisitos de contraseña (mínimo 8 caracteres, mayúscula, minúscula y un símbolo).",
                    400,
                );
            }
            const cuenta = await service.registrar(resultado.data);
            const token = await service.createToken(cuenta);
            res.cookie("nexo_cliente", token, cookieOptions);
            res.status(201).json({
                exito: true,
                datos: { cuenta },
                mensaje: "Tu cuenta se creó correctamente.",
            });
        } catch (error) {
            next(error);
        }
    };

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
            const cuenta = await service.iniciarSesion(resultado.data);
            const token = await service.createToken(cuenta);
            res.cookie("nexo_cliente", token, cookieOptions);
            res.json({
                exito: true,
                datos: { cuenta },
                mensaje: "Inicio de sesión correcto.",
            });
        } catch (error) {
            next(error);
        }
    };

    const cerrarSesion: RequestHandler = (_req, res) => {
        res.clearCookie("nexo_cliente", { path: "/api" });
        res.json({ exito: true, datos: {}, mensaje: "Sesión cerrada." });
    };

    const solicitarRecuperacion: RequestHandler = async (req, res, next) => {
        try {
            const resultado = recuperacionSchema.safeParse(req.body);
            if (!resultado.success) {
                throw new AppError(
                    "DATOS_INVALIDOS",
                    "Introduce un correo electrónico válido.",
                    400,
                );
            }
            await service.solicitarRecuperacion(resultado.data.correo);
            res.json({
                exito: true,
                datos: {},
                mensaje:
                    "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.",
            });
        } catch (error) {
            next(error);
        }
    };

    const restablecerContrasena: RequestHandler = async (req, res, next) => {
        try {
            const resultado = restablecerSchema.safeParse(req.body);
            if (!resultado.success) {
                throw new AppError(
                    "DATOS_INVALIDOS",
                    "El enlace o la contraseña no son válidos.",
                    400,
                );
            }
            await service.restablecerContrasena(resultado.data);
            res.json({
                exito: true,
                datos: {},
                mensaje: "Tu contraseña se actualizó correctamente.",
            });
        } catch (error) {
            next(error);
        }
    };

    const perfil: RequestHandler = async (req, res, next) => {
        try {
            const cuenta = requireCuenta(req.cuentaCliente);
            const perfil = await service.obtenerPerfil(cuenta.id);
            res.json({ exito: true, datos: { cuenta: perfil } });
        } catch (error) {
            next(error);
        }
    };

    const actualizarPerfil: RequestHandler = async (req, res, next) => {
        try {
            const cuenta = requireCuenta(req.cuentaCliente);
            const resultado = perfilSchema.safeParse(req.body);
            if (!resultado.success) {
                throw new AppError(
                    "DATOS_INVALIDOS",
                    "Revisa los datos del perfil.",
                    400,
                );
            }
            const actualizada = await service.actualizarPerfil(
                cuenta.id,
                resultado.data,
            );
            res.json({
                exito: true,
                datos: { cuenta: actualizada },
                mensaje: "Tu perfil se actualizó.",
            });
        } catch (error) {
            next(error);
        }
    };

    const vincularHistorial: RequestHandler = async (req, res, next) => {
        try {
            const cuenta = requireCuenta(req.cuentaCliente);
            const vinculos = await service.vincularHistorial(cuenta.id);
            res.json({
                exito: true,
                datos: vinculos,
                mensaje: "Se asociaron tus compras anteriores.",
            });
        } catch (error) {
            next(error);
        }
    };

    const listarPedidos: RequestHandler = async (req, res, next) => {
        try {
            const cuenta = requireCuenta(req.cuentaCliente);
            const pedidos = await service.listarPedidos(cuenta.id);
            res.json({ exito: true, datos: { pedidos } });
        } catch (error) {
            next(error);
        }
    };

    const obtenerPedido: RequestHandler = async (req, res, next) => {
        try {
            const cuenta = requireCuenta(req.cuentaCliente);
            const pedido = await service.obtenerPedido(
                cuenta.id,
                validateId(req.params.id),
            );
            res.json({ exito: true, datos: { pedido } });
        } catch (error) {
            next(error);
        }
    };

    return {
        registrar,
        iniciarSesion,
        cerrarSesion,
        solicitarRecuperacion,
        restablecerContrasena,
        perfil,
        actualizarPerfil,
        vincularHistorial,
        listarPedidos,
        obtenerPedido,
    };
};
