import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type { CompanyService } from "../modules/empresas/empresas.service.js";

const sitioWebSchema = z
    .string()
    .trim()
    .max(2048)
    .refine((value) => {
        if (!value) return true;

        try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    });

const updateCompanySchema = z
    .object({
        nombre: z.string().trim().min(2).max(120),
        sitioWeb: sitioWebSchema,
        tasaImpuesto: z
            .number()
            .finite()
            .min(0)
            .max(100)
            .refine(
                (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-8,
                "La tasa admite hasta dos decimales.",
            ),
    })
    .strict();

const requireCompanyId = (empresaId: string | undefined): string => {
    if (!empresaId) {
        throw new AppError(
            "NO_AUTENTICADO",
            "Debes iniciar sesión para continuar.",
            401,
        );
    }

    return empresaId;
};

export const createCompanyController = (companyService: CompanyService) => {
    const obtener: RequestHandler = async (req, res) => {
        const empresa = await companyService.obtener(
            requireCompanyId(req.usuario?.empresaId),
        );

        res.json({
            exito: true,
            datos: {
                empresa: {
                    id: empresa.id,
                    nombre: empresa.nombre,
                    sitioWeb: empresa.sitioWeb,
                    tasaImpuesto: empresa.tasaImpuesto,
                    creadaEn: empresa.creadaEn,
                    actualizadaEn: empresa.actualizadaEn,
                    cantidadUsuarios: empresa._count.usuarios,
                },
            },
        });
    };

    const actualizar: RequestHandler = async (req, res) => {
        const resultado = updateCompanySchema.safeParse(req.body);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica un nombre, sitio web y tasa de impuesto válidos.",
                400,
            );
        }

        const empresa = await companyService.actualizar(
            requireCompanyId(req.usuario?.empresaId),
            {
                nombre: resultado.data.nombre,
                sitioWeb: resultado.data.sitioWeb || null,
                tasaImpuesto: resultado.data.tasaImpuesto,
            },
        );

        res.json({
            exito: true,
            datos: {
                empresa: {
                    id: empresa.id,
                    nombre: empresa.nombre,
                    sitioWeb: empresa.sitioWeb,
                    tasaImpuesto: empresa.tasaImpuesto,
                    creadaEn: empresa.creadaEn,
                    actualizadaEn: empresa.actualizadaEn,
                    cantidadUsuarios: empresa._count.usuarios,
                },
            },
            mensaje: "La configuración de la empresa se actualizó correctamente.",
        });
    };

    return { obtener, actualizar };
};
