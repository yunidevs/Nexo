import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createSalesController } from "../controllers/ventas.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { SalesService } from "../modules/ventas/ventas.service.js";

const authorizeSalesAccess: RequestHandler = (req, _res, next) => {
    const rol = req.usuario?.rol;
    if (rol !== "ADMINISTRADOR" && rol !== "VENDEDOR") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "No tienes permiso para administrar ventas.",
                403,
            ),
        );
        return;
    }

    next();
};

export function createSalesRoutes(
    config: AppConfig,
    service: SalesService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createSalesController(service);
    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
        authorizeSalesAccess,
    );
    router.get("/", controller.listar);
    router.post("/", controller.crear);
    router.post("/:id/pagos", controller.registrarPago);
    router.post("/:id/cancelar", controller.cancelar);
    return router;
}
