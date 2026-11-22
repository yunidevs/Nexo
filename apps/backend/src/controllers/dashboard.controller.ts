import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type { UsuarioEnSesion } from "../middleware/auth.middleware.js";
import type { DashboardService } from "../modules/dashboard/dashboard.service.js";

const estadisticasSchema = z
    .object({
        periodo: z.enum(["dia", "semana", "mes"]).default("dia"),
        fecha: z
            .string()
            .regex(
                /^\d{4}-\d{2}-\d{2}$/,
                "La fecha debe tener el formato AAAA-MM-DD.",
            )
            .refine((valor) => {
                const anio = Number(valor.slice(0, 4));
                const mes = Number(valor.slice(5, 7));
                const dia = Number(valor.slice(8, 10));
                const control = new Date(Date.UTC(anio, mes - 1, dia));
                return (
                    control.getUTCFullYear() === anio &&
                    control.getUTCMonth() === mes - 1 &&
                    control.getUTCDate() === dia
                );
            }, "La fecha indicada no existe en el calendario.")
            .optional(),
    })
    .strict();

const requireIdentity = (usuario: UsuarioEnSesion | undefined) => {
    if (!usuario) {
        throw new AppError(
            "NO_AUTENTICADO",
            "Debes iniciar sesión para continuar.",
            401,
        );
    }
    return usuario;
};

export const createDashboardController = (service: DashboardService) => {
    const obtenerResumen: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const resumen = await service.obtenerResumen(usuario.empresaId);

        res.set("Cache-Control", "private, max-age=30");
        res.json({
            exito: true,
            datos: resumen,
        });
    };

    const obtenerEstadisticas: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const resultado = estadisticasSchema.safeParse(req.query);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                resultado.error.issues[0]?.message ??
                    "Los parámetros del período no son válidos.",
                400,
            );
        }

        const estadisticas = await service.obtenerEstadisticas(
            usuario.empresaId,
            resultado.data.periodo,
            resultado.data.fecha,
        );

        res.set("Cache-Control", "private, max-age=30");
        res.json({
            exito: true,
            datos: estadisticas,
        });
    };

    return { obtenerResumen, obtenerEstadisticas };
};
