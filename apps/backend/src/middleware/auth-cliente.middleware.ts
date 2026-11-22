import type { RequestHandler } from "express";
import { jwtVerify } from "jose";
import { AppError } from "../errors/app-error.js";

export interface CuentaClienteEnSesion {
    id: string;
    correo: string;
}

/**
 * Autenticación de compradores del marketplace. Usa la cookie `nexo_cliente`
 * y un JWT con `tipo: "cliente"`, completamente separado de la sesión
 * empresarial (`nexo_sesion`).
 */
export function createClienteAuthMiddleware(
    jwtSecret: string,
    validarSesion: (id: string) => Promise<boolean>,
): RequestHandler {
    const secret = new TextEncoder().encode(jwtSecret);

    return async (req, _res, next) => {
        const token = req.cookies?.nexo_cliente;

        if (typeof token !== "string") {
            next(
                new AppError(
                    "NO_AUTENTICADO",
                    "Debes iniciar sesión para continuar.",
                    401,
                ),
            );
            return;
        }

        let payload;
        try {
            ({ payload } = await jwtVerify(token, secret));
        } catch {
            throw new AppError(
                "SESION_INVALIDA",
                "La sesión no es válida o ha expirado.",
                401,
            );
        }

        if (
            payload.tipo !== "cliente" ||
            typeof payload.sub !== "string" ||
            typeof payload.correo !== "string"
        ) {
            throw new AppError(
                "SESION_INVALIDA",
                "La sesión no es válida o ha expirado.",
                401,
            );
        }

        const sesionValida = await validarSesion(payload.sub);
        if (!sesionValida) {
            throw new AppError(
                "SESION_INVALIDA",
                "La sesión ya no es válida.",
                401,
            );
        }

        req.cuentaCliente = {
            id: payload.sub,
            correo: payload.correo,
        };
        next();
    };
}

/**
 * Variante no bloqueante: adjunta `req.cuentaCliente` solo si la cookie
 * `nexo_cliente` es válida. Permite que el checkout funcione igual para
 * compradores registrados e invitados.
 */
export function createClienteAuthOpcional(
    jwtSecret: string,
    validarSesion: (id: string) => Promise<boolean>,
): RequestHandler {
    const secret = new TextEncoder().encode(jwtSecret);

    return async (req, _res, next) => {
        const token = req.cookies?.nexo_cliente;
        if (typeof token !== "string") {
            next();
            return;
        }

        try {
            const { payload } = await jwtVerify(token, secret);
            if (
                payload.tipo === "cliente" &&
                typeof payload.sub === "string" &&
                typeof payload.correo === "string" &&
                (await validarSesion(payload.sub))
            ) {
                req.cuentaCliente = {
                    id: payload.sub,
                    correo: payload.correo,
                };
            }
        } catch {
            // Token inválido o expirado: se continúa como invitado.
        }
        next();
    };
}

declare global {
    namespace Express {
        interface Request {
            cuentaCliente?: CuentaClienteEnSesion;
        }
    }
}
