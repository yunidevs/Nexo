import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createPurchaseController } from "../controllers/compras.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { PurchaseService } from "../modules/compras/compras.service.js";

const authorizePurchaseAccess: RequestHandler = (req, _res, next) => {
    const rol = req.usuario?.rol;
    if (rol !== "ADMINISTRADOR" && rol !== "VENDEDOR") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "No tienes permiso para administrar compras.",
                403,
            ),
        );
        return;
    }

    next();
};

export function createPurchaseRoutes(
    config: AppConfig,
    service: PurchaseService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createPurchaseController(service);
    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
        authorizePurchaseAccess,
    );
    router.get("/", controller.listar);
    router.post("/", controller.crear);
    router.post("/:id/recibir", controller.recibir);
    router.post("/:id/pagos", controller.registrarPago);
    return router;
}
