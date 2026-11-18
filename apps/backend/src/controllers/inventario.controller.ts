import { TipoMovimientoInventario } from "@prisma/client";
import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type { InventoryService } from "../modules/inventario/inventario.service.js";

const paginacionSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    buscar: z.string().trim().max(100).default(""),
    bajoStock: z.enum(["true", "false"]).optional(),
    productoId: z.string().uuid().optional(),
});

const movimientoSchema = z
    .object({
        productoId: z.string().uuid(),
        tipo: z.nativeEnum(TipoMovimientoInventario),
        cantidad: z.number().int().min(-2_147_483_647).max(2_147_483_647).refine((valor) => valor !== 0),
        motivo: z.string().trim().min(2).max(300),
    })
    .strict()
    .refine(
        ({ tipo, cantidad }) =>
            tipo === TipoMovimientoInventario.AJUSTE || cantidad > 0,
        { message: "La cantidad debe ser positiva para este movimiento." },
    );

const requireIdentity = (
    usuario: { id: string; empresaId: string } | undefined,
) => {
    if (!usuario) {
        throw new AppError(
            "NO_AUTENTICADO",
            "Debes iniciar sesión para continuar.",
            401,
        );
    }
    return usuario;
};

export const createInventoryController = (service: InventoryService) => {
    const listarProductos: RequestHandler = async (req, res) => {
        const filtros = paginacionSchema.safeParse(req.query);
        if (!filtros.success) {
            throw new AppError("FILTROS_INVALIDOS", "Los filtros no son válidos.", 400);
        }
        const usuario = requireIdentity(req.usuario);
        const resultado = await service.listarProductos({
            empresaId: usuario.empresaId,
            buscar: filtros.data.buscar,
            pagina: filtros.data.pagina,
            limite: filtros.data.limite,
            ...(filtros.data.bajoStock === undefined
                ? {}
                : { bajoStock: filtros.data.bajoStock === "true" }),
        });
        res.json({ exito: true, datos: resultado.datos, paginacion: resultado.paginacion });
    };

    const listarMovimientos: RequestHandler = async (req, res) => {
        const filtros = paginacionSchema.safeParse(req.query);
        if (!filtros.success) {
            throw new AppError("FILTROS_INVALIDOS", "Los filtros no son válidos.", 400);
        }
        const usuario = requireIdentity(req.usuario);
        const resultado = await service.listarMovimientos({
            empresaId: usuario.empresaId,
            pagina: filtros.data.pagina,
            limite: filtros.data.limite,
            ...(filtros.data.productoId
                ? { productoId: filtros.data.productoId }
                : {}),
        });
        res.json({ exito: true, datos: resultado.datos, paginacion: resultado.paginacion });
    };

    const registrarMovimiento: RequestHandler = async (req, res) => {
        const resultado = movimientoSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Revisa el producto, tipo, cantidad y motivo del movimiento.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        const movimiento = await service.registrarMovimiento(
            usuario.empresaId,
            usuario.id,
            resultado.data,
        );
        res.status(201).json({
            exito: true,
            datos: { movimiento },
            mensaje: "El movimiento de inventario se registró correctamente.",
        });
    };

    return { listarProductos, listarMovimientos, registrarMovimiento };
};
