import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createCompanyController } from "../controllers/empresas.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { CompanyService } from "../modules/empresas/empresas.service.js";

const authorizeCompanyManagement: RequestHandler = (req, _res, next) => {
    if (req.usuario?.rol !== "ADMINISTRADOR") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "Solo un administrador puede modificar la configuración de la empresa.",
                403,
            ),
        );
        return;
    }

    next();
};

export function createCompanyRoutes(
    config: AppConfig,
    companyService: CompanyService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createCompanyController(companyService);

    router.use(
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
    );
    router.get("/", controller.obtener);
    router.patch("/", authorizeCompanyManagement, controller.actualizar);

    return router;
}
