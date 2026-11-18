import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type {
    DatosActualizarProveedor,
    DatosCrearProveedor,
    SupplierService,
} from "../modules/proveedores/proveedores.service.js";

const campoOpcional = (max: number) =>
    z.union([
        z.literal("").transform(() => null),
        z.string().trim().max(max).transform((valor) => valor || null),
    ]);

const correoOpcional = z.union([
    z.literal("").transform(() => null),
    z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((valor) => valor.toLowerCase()),
]);

const createSupplierSchema = z
    .object({
        nombre: z.string().trim().min(2).max(120),
        documento: campoOpcional(40).optional(),
        telefono: campoOpcional(40).optional(),
        correo: correoOpcional.optional(),
        direccion: campoOpcional(300).optional(),
    })
    .strict();

const updateSupplierSchema = z
    .object({
        nombre: z.string().trim().min(2).max(120).optional(),
        documento: campoOpcional(40).optional(),
        telefono: campoOpcional(40).optional(),
        correo: correoOpcional.optional(),
        direccion: campoOpcional(300).optional(),
    })
    .strict()
    .refine((datos) => Object.keys(datos).length > 0);

const supplierStatusSchema = z
    .object({ activo: z.boolean() })
    .strict();

const supplierFiltersSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    buscar: z.string().trim().max(100).default(""),
    activo: z.enum(["true", "false"]).optional(),
});

const historyFiltersSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
});

const purchaseSchema = z
    .object({
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
        detalle: z.string().trim().min(2).max(500),
        total: z
            .number()
            .finite()
            .positive()
            .max(9_999_999_999.99)
            .refine(
                (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-8,
                "El total admite hasta dos decimales.",
            ),
    })
    .strict();

const validateId = (value: string | string[] | undefined): string => {
    const resultado = z
        .string()
        .uuid()
        .safeParse(typeof value === "string" ? value : "");

    if (!resultado.success) {
        throw new AppError(
            "IDENTIFICADOR_INVALIDO",
            "El identificador del proveedor no es válido.",
            400,
        );
    }

    return resultado.data;
};

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

export const createSupplierController = (supplierService: SupplierService) => {
    const listar: RequestHandler = async (req, res) => {
        const filtros = supplierFiltersSchema.safeParse(req.query);
        if (!filtros.success) {
            throw new AppError(
                "FILTROS_INVALIDOS",
                "Revisa la página, el límite y los filtros de búsqueda.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const resultado = await supplierService.listar({
            empresaId: usuario.empresaId,
            pagina: filtros.data.pagina,
            limite: filtros.data.limite,
            buscar: filtros.data.buscar,
            ...(filtros.data.activo === undefined
                ? {}
                : { activo: filtros.data.activo === "true" }),
        });

        res.json({
            exito: true,
            datos: resultado.datos,
            paginacion: resultado.paginacion,
        });
    };

    const crear: RequestHandler = async (req, res) => {
        const resultado = createSupplierSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El nombre es obligatorio y los datos del proveedor deben ser válidos.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const datos: DatosCrearProveedor = resultado.data;
        const proveedor = await supplierService.crear(
            usuario.empresaId,
            usuario.id,
            datos,
        );

        res.status(201).json({
            exito: true,
            datos: { proveedor },
            mensaje: "El proveedor se creó correctamente.",
        });
    };

    const obtener: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const proveedor = await supplierService.obtener(
            usuario.empresaId,
            validateId(req.params.id),
        );
        res.json({ exito: true, datos: { proveedor } });
    };

    const actualizar: RequestHandler = async (req, res) => {
        const resultado = updateSupplierSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica al menos un campo válido para actualizar el proveedor.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const datos = Object.fromEntries(
            Object.entries(resultado.data).filter(
                ([, valor]) => valor !== undefined,
            ),
        ) as DatosActualizarProveedor;
        const proveedor = await supplierService.actualizar(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
            datos,
        );

        res.json({
            exito: true,
            datos: { proveedor },
            mensaje: "El proveedor se actualizó correctamente.",
        });
    };

    const cambiarEstado: RequestHandler = async (req, res) => {
        const resultado = supplierStatusSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El estado debe indicar si el proveedor está activo.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const proveedor = await supplierService.cambiarEstado(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
            resultado.data.activo,
        );

        res.json({
            exito: true,
            datos: { proveedor },
            mensaje: resultado.data.activo
                ? "El proveedor se activó correctamente."
                : "El proveedor se desactivó correctamente.",
        });
    };

    const historial: RequestHandler = async (req, res) => {
        const filtros = historyFiltersSchema.safeParse(req.query);
        if (!filtros.success) {
            throw new AppError(
                "FILTROS_INVALIDOS",
                "Revisa la página y el límite del historial.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const resultado = await supplierService.listarOperaciones(
            usuario.empresaId,
            validateId(req.params.id),
            filtros.data.pagina,
            filtros.data.limite,
        );

        res.json({
            exito: true,
            datos: resultado.datos,
            paginacion: resultado.paginacion,
        });
    };

    const registrarCompra: RequestHandler = async (req, res) => {
        const resultado = purchaseSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica una fecha válida, una descripción y un total positivo de hasta dos decimales.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const operacion = await supplierService.registrarCompra(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
            resultado.data,
        );

        res.status(201).json({
            exito: true,
            datos: { operacion },
            mensaje: "La compra se registró correctamente.",
        });
    };

    return {
        listar,
        crear,
        obtener,
        actualizar,
        cambiarEstado,
        historial,
        registrarCompra,
    };
};
