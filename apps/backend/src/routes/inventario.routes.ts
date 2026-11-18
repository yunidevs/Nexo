import { Router } from "express";
import type { AppConfig } from "../config.js";
import { createInventoryController } from "../controllers/inventario.controller.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { InventoryService } from "../modules/inventario/inventario.service.js";

export function createInventoryRoutes(
    config: AppConfig,
    service: InventoryService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createInventoryController(service);
    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
    );
    router.get("/productos", controller.listarProductos);
    router.get("/movimientos", controller.listarMovimientos);
    router.post("/movimientos", controller.registrarMovimiento);
    return router;
}
