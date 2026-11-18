import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type { SalesService } from "../modules/ventas/ventas.service.js";

const filtrosSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
});

const importe = z
    .number()
    .finite()
    .nonnegative()
    .max(9_999_999_999.99)
    .refine(
        (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-8,
        "El importe admite hasta dos decimales.",
    );

const pagoSchema = z
    .object({
        monto: importe.refine((valor) => valor > 0),
        metodo: z.enum(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"]),
    })
    .strict();

const ventaSchema = z
    .object({
        clienteId: z.string().uuid(),
        descuento: importe,
        detalles: z
            .array(
                z
                    .object({
                        productoId: z.string().uuid(),
                        cantidad: z.number().int().min(1).max(2_147_483_647),
                    })
                    .strict(),
            )
            .min(1)
            .max(100)
            .refine(
                (detalles) =>
                    new Set(detalles.map(({ productoId }) => productoId)).size ===
                    detalles.length,
                "No repitas productos en la venta.",
            ),
        pagoInicial: pagoSchema.optional(),
    })
    .strict();

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

const validateId = (value: string | string[] | undefined) => {
    const resultado = z
        .string()
        .uuid()
        .safeParse(typeof value === "string" ? value : "");
    if (!resultado.success) {
        throw new AppError(
            "IDENTIFICADOR_INVALIDO",
            "El identificador de la venta no es válido.",
            400,
        );
    }
    return resultado.data;
};

export const createSalesController = (service: SalesService) => {
    const listar: RequestHandler = async (req, res) => {
        const filtros = filtrosSchema.safeParse(req.query);
        if (!filtros.success) {
            throw new AppError(
                "FILTROS_INVALIDOS",
                "Revisa la página y el límite de resultados.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        const resultado = await service.listar({
            empresaId: usuario.empresaId,
            ...filtros.data,
        });
        res.json({
            exito: true,
            datos: resultado.datos,
            paginacion: resultado.paginacion,
        });
    };

    const crear: RequestHandler = async (req, res) => {
        const resultado = ventaSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Revisa el cliente, el descuento, los productos y el pago inicial.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        const venta = await service.crear(
            usuario.empresaId,
            usuario.id,
            resultado.data,
        );
        res.status(201).json({
            exito: true,
            datos: { venta },
            mensaje: "La venta se registró y el inventario se actualizó.",
        });
    };

    const registrarPago: RequestHandler = async (req, res) => {
        const resultado = pagoSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica un monto positivo y un método de pago válido.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        const venta = await service.registrarPago(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
            resultado.data,
        );
        res.status(201).json({
            exito: true,
            datos: { venta },
            mensaje: "El pago se registró correctamente.",
        });
    };

    const cancelar: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const venta = await service.cancelar(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
        );
        res.json({
            exito: true,
            datos: { venta },
            mensaje: "La venta se canceló y el inventario se revirtió.",
        });
    };

    return { listar, crear, registrarPago, cancelar };
};
