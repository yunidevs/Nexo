
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { AppConfig } from "../config.js";
import { createAuthController } from "../controllers/auth.controller.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { createRedisRateLimitStore } from "../lib/rate-limit-store.js";
import type { AuthService } from "../modules/auth/auth.service.js";

function createAuthRateLimit() {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        store: createRedisRateLimitStore(15 * 60 * 1000),
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
            res.status(429).json({
                exito: false,
                error: {
                    codigo: "DEMASIADAS_SOLICITUDES",
                    mensaje:
                        "Se alcanzó el límite de intentos. Vuelve a intentarlo más tarde.",
                },
            });
        },
    });
}

export const createAuthRoutes = (
    config: AppConfig,
    authService: AuthService,
) => {
    const router = Router();
    const controller = createAuthController(authService, config);

    router.post("/registro", createAuthRateLimit(), controller.registrar);
    router.post(
        "/iniciar-sesion",
        createAuthRateLimit(),
        controller.iniciarSesion,
    );
    router.post(
        "/solicitar-recuperacion",
        createAuthRateLimit(),
        controller.solicitarRecuperacion,
    );
    router.post(
        "/restablecer-contrasena",
        createAuthRateLimit(),
        controller.restablecerContrasena,
    );
    router.use(createAuthMiddleware(
        config.jwtSecret,
        (id, empresaId) => authService.validarSesion(id, empresaId),
    ));
    router.get("/perfil", controller.perfil);
    router.post("/cerrar-sesion", controller.cerrarSesion);

    return router;
};
