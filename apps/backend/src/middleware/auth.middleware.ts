import type { RequestHandler } from "express";
import { jwtVerify } from "jose";
import { AppError } from "../errors/app-error.js";

export interface UsuarioEnSesion {
    id: string;
    empresaId: string;
    rol: string;
}

export function createAuthMiddleware(
    jwtSecret: string,
    validarSesion: (
        id: string, 
        empresaId: string
    ) => Promise<string | null>,
): RequestHandler {
    const secret = new TextEncoder().encode(jwtSecret);

    return async (req, _res, next) => {
        const token = req.cookies?.nexo_sesion;

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
            typeof payload.sub !== "string" ||
            typeof payload.empresaId !== "string" ||
            typeof payload.rol !== "string"
        ) {
            throw new AppError(
                "SESION_INVALIDA",
                "La sesión no es válida o ha expirado.",
                401,
            );
        }

        const rolActual = await validarSesion(payload.sub, payload.empresaId);
        if (!rolActual) {
            throw new AppError(
                "SESION_INVALIDA",
                "La sesión ya no es válida.",
                401,
            );
        }

        req.usuario = {
            id: payload.sub,
            empresaId: payload.empresaId,
            rol: rolActual,
        };
        next();
    };
}

declare global {
    namespace Express {
        interface Request {
            usuario?: UsuarioEnSesion;
        }
    }
}
