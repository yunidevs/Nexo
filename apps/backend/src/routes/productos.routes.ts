import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createProductController } from "../controllers/productos.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { ProductService } from "../modules/productos/productos.service.js";

const authorizeProductAccess: RequestHandler = (req, _res, next) => {
    const rol = req.usuario?.rol;
    if (rol !== "ADMINISTRADOR" && rol !== "VENDEDOR" && rol !== "ALMACENERO") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "No tienes permiso para administrar productos.",
                403,
            ),
        );
        return;
    }

    next();
};

const authorizeProductDeletion: RequestHandler = (req, _res, next) => {
    if (req.usuario?.rol !== "ADMINISTRADOR") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "Solo un administrador puede eliminar productos.",
                403,
            ),
        );
        return;
    }

    next();
};

export function createProductRoutes(
    config: AppConfig,
    productService: ProductService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createProductController(productService);

    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
        authorizeProductAccess,
    );
    router.get("/", controller.listar);
    router.post("/", controller.crear);
    router.get("/:id", controller.obtener);
    router.patch("/:id", controller.actualizar);
    router.patch("/:id/estado", controller.cambiarEstado);
    router.delete("/:id", authorizeProductDeletion, controller.eliminar);

    return router;
}
