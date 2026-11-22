import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { AppConfig } from "../config.js";
import { createClienteCuentaController } from "../controllers/cuenta-cliente.controller.js";
import { createClienteAuthMiddleware } from "../middleware/auth-cliente.middleware.js";
import type { ClienteCuentaService } from "../modules/cuenta-cliente/cuenta-cliente.service.js";
import { createRedisRateLimitStore } from "../lib/rate-limit-store.js";

function createClienteRateLimit() {
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

export function createClienteCuentaRoutes(
    config: AppConfig,
    service: ClienteCuentaService,
) {
    const router = Router();
    const controller = createClienteCuentaController(service, config);

    router.post("/registro", createClienteRateLimit(), controller.registrar);
    router.post(
        "/iniciar-sesion",
        createClienteRateLimit(),
        controller.iniciarSesion,
    );
    router.post(
        "/solicitar-recuperacion",
        createClienteRateLimit(),
        controller.solicitarRecuperacion,
    );
    router.post(
        "/restablecer",
        createClienteRateLimit(),
        controller.restablecerContrasena,
    );
    router.post("/cerrar-sesion", controller.cerrarSesion);

    router.use(
        createClienteAuthMiddleware(config.jwtSecret, (id) =>
            service.validarSesion(id),
        ),
    );

    router.get("/perfil", controller.perfil);
    router.patch("/perfil", controller.actualizarPerfil);
    router.post("/vincular-historial", controller.vincularHistorial);
    router.get("/pedidos", controller.listarPedidos);
    router.get("/pedidos/:id", controller.obtenerPedido);

    return router;
}
