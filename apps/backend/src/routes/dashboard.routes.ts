import { Router } from "express";
import type { AppConfig } from "../config.js";
import { createDashboardController } from "../controllers/dashboard.controller.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { DashboardService } from "../modules/dashboard/dashboard.service.js";

export function createDashboardRoutes(
    config: AppConfig,
    service: DashboardService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createDashboardController(service);
    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
    );
    router.get("/estadisticas", controller.obtenerEstadisticas);
    router.get("/", controller.obtenerResumen);
    return router;
}
