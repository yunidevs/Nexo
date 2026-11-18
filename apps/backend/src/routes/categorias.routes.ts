import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createCategoryController } from "../controllers/categorias.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { CategoryService } from "../modules/categorias/categorias.service.js";

const authorizeCategoryAccess: RequestHandler = (req, _res, next) => {
    const rol = req.usuario?.rol;
    if (
        rol !== "ADMINISTRADOR" &&
        rol !== "VENDEDOR" &&
        rol !== "ALMACENERO"
    ) {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "No tienes permiso para administrar categorías.",
                403,
            ),
        );
        return;
    }

    next();
};

export function createCategoryRoutes(
    config: AppConfig,
    categoryService: CategoryService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createCategoryController(categoryService);

    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
        authorizeCategoryAccess,
    );
    router.get("/", controller.listar);
    router.post("/", controller.crear);
    router.get("/:id", controller.obtener);
    router.patch("/:id", controller.actualizar);
    router.patch("/:id/estado", controller.cambiarEstado);

    return router;
}
