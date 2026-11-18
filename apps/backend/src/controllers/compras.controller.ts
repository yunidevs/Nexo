import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type { PurchaseService } from "../modules/compras/compras.service.js";

const filtrosSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
});

const compraSchema = z
    .object({
        proveedorId: z.string().uuid(),
        fechaCompra: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .refine((valor) => {
                const fecha = new Date(`${valor}T00:00:00.000Z`);
                return (
                    !Number.isNaN(fecha.getTime()) &&
                    fecha.toISOString().slice(0, 10) === valor
                );
            })
            .transform((valor) => new Date(`${valor}T00:00:00.000Z`)),
        detalles: z
            .array(
                z
                    .object({
                        productoId: z.string().uuid(),
                        cantidad: z.number().int().min(1).max(2_147_483_647),
                        costoUnitario: z
                            .number()
                            .finite()
                            .nonnegative()
                            .max(9_999_999_999.99)
                            .refine(
                                (valor) =>
                                    Math.abs(
                                        valor * 100 - Math.round(valor * 100),
                                    ) < 1e-8,
                                "El costo admite hasta dos decimales.",
                            ),
                    })
                    .strict(),
            )
            .min(1)
            .max(100)
            .refine(
                (detalles) =>
                    new Set(detalles.map(({ productoId }) => productoId)).size ===
                    detalles.length,
                "No repitas productos en la compra.",
            ),
    })
    .strict();

const pagoSchema = z
    .object({
        monto: z
            .number()
            .finite()
            .positive()
            .max(9_999_999_999.99)
            .refine(
                (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-8,
                "El importe admite hasta dos decimales.",
            ),
        metodo: z.enum(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"]),
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
            "El identificador de la compra no es válido.",
            400,
        );
    }
    return resultado.data;
};

export const createPurchaseController = (service: PurchaseService) => {
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
        const resultado = compraSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Revisa el proveedor, la fecha y los productos de la compra.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        const compra = await service.crear(
            usuario.empresaId,
            usuario.id,
            resultado.data,
        );
        res.status(201).json({
            exito: true,
            datos: { compra },
            mensaje: "La compra se creó correctamente.",
        });
    };

    const recibir: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const compra = await service.recibir(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
        );
        res.json({
            exito: true,
            datos: { compra },
            mensaje: "La mercancía se recibió y el inventario se actualizó.",
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
        const compra = await service.registrarPago(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
            resultado.data,
        );
        res.status(201).json({
            exito: true,
            datos: { compra },
            mensaje: "El pago se registró correctamente.",
        });
    };

    return { listar, crear, recibir, registrarPago };
};
