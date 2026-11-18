import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createSupplierController } from "../controllers/proveedores.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { SupplierService } from "../modules/proveedores/proveedores.service.js";

const authorizeSupplierAccess: RequestHandler = (req, _res, next) => {
    const rol = req.usuario?.rol;
    if (rol !== "ADMINISTRADOR" && rol !== "VENDEDOR") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "No tienes permiso para administrar proveedores.",
                403,
            ),
        );
        return;
    }

    next();
};

export function createSupplierRoutes(
    config: AppConfig,
    supplierService: SupplierService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createSupplierController(supplierService);

    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
        authorizeSupplierAccess,
    );
    router.get("/", controller.listar);
    router.post("/", controller.crear);
    router.get("/:id/historial", controller.historial);
    router.post("/:id/compras", controller.registrarCompra);
    router.get("/:id", controller.obtener);
    router.patch("/:id", controller.actualizar);
    router.patch("/:id/estado", controller.cambiarEstado);

    return router;
}
