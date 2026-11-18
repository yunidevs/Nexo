import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createUserController } from "../controllers/usuarios.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { UserService } from "../modules/usuarios/usuarios.service.js";

const authorizeUserManagement: RequestHandler = (req, _res, next) => {
    if (req.usuario?.rol !== "ADMINISTRADOR") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "Solo un administrador puede gestionar los usuarios.",
                403,
            ),
        );
        return;
    }

    next();
};

export function createUserRoutes(
    config: AppConfig,
    userService: UserService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createUserController(userService);

    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
        authorizeUserManagement,
    );
    router.get("/", controller.listar);
    router.post("/", controller.crear);
    router.get("/:id", controller.obtener);
    router.patch("/:id", controller.actualizar);
    router.patch("/:id/rol", controller.cambiarRol);
    router.patch("/:id/estado", controller.cambiarEstado);

    return router;
}
