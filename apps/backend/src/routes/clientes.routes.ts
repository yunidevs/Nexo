import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createCustomerController } from "../controllers/clientes.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { CustomerService } from "../modules/clientes/clientes.service.js";

const authorizeCustomerAccess: RequestHandler = (req, _res, next) => {
    const rol = req.usuario?.rol;
    if (rol !== "ADMINISTRADOR" && rol !== "VENDEDOR") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "No tienes permiso para administrar clientes.",
                403,
            ),
        );
        return;
    }

    next();
};

export function createCustomerRoutes(
    config: AppConfig,
    customerService: CustomerService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createCustomerController(customerService);

    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
        authorizeCustomerAccess,
    );
    router.get("/", controller.listar);
    router.post("/", controller.crear);
    router.get("/:id", controller.obtener);
    router.get("/:id/historial", controller.historial);
    router.patch("/:id", controller.actualizar);
    router.patch("/:id/estado", controller.cambiarEstado);

    return router;
}
