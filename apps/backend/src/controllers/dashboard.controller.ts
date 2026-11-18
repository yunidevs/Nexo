import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import type { DashboardService } from "../modules/dashboard/dashboard.service.js";

export const createDashboardController = (service: DashboardService) => {
    const obtenerResumen: RequestHandler = async (req, res) => {
        if (!req.usuario) {
            throw new AppError(
                "NO_AUTENTICADO",
                "Debes iniciar sesión para continuar.",
                401,
            );
        }

        const resumen = await service.obtenerResumen(req.usuario.empresaId);
        res.json({
            exito: true,
            datos: resumen,
        });
    };

    return { obtenerResumen };
};
