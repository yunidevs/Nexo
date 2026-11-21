
import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../errors/app-error.js";
import {
    type DatosCrearCliente,
    type DatosActualizarCliente,
    type CustomerService,
} from "../modules/clientes/clientes.service.js";

// ============================================================
// VALIDACIONES
// ============================================================

const correoOpcional = z.union([
    z.literal(""),
    z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((valor) => valor.toLowerCase()),
]);

const createCustomerSchema = z
    .object({
        nombre: z.string().trim().min(2).max(80),
        apellido: z.string().trim().max(80).optional().default(""),
        documento: z.string().trim().max(40).optional().default(""),
        telefono: z.string().trim().max(40).optional().default(""),
        correo: correoOpcional.optional().default(""),
        direccion: z.string().trim().max(300).optional().default(""),
    })
    .strict();

const updateCustomerSchema = z
    .object({
        nombre: z.string().trim().min(2).max(80).optional(),
        apellido: z.string().trim().max(80).optional(),
        documento: z.string().trim().max(40).optional(),
        telefono: z.string().trim().max(40).optional(),
        correo: correoOpcional.optional(),
        direccion: z.string().trim().max(300).optional(),
    })
    .strict()
    .refine((datos) => Object.keys(datos).length > 0);

const customerStatusSchema = z
    .object({
        activo: z.boolean(),
    })
    .strict();

const customerFiltersSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    buscar: z.string().trim().max(100).default(""),
    activo: z.enum(["true", "false"]).optional(),
});

const historyFiltersSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

// Validar identificador del cliente
const validateId = (value: string | string[] | undefined): string => {
    const resultado = z
        .string()
        .uuid()
        .safeParse(typeof value === "string" ? value : "");

    if (!resultado.success) {
        throw new AppError(
            "IDENTIFICADOR_INVALIDO",
            "El identificador del cliente no es válido.",
            400,
        );
    }

    return resultado.data;
};

const requireIdentity = (
    usuario: { id: string; empresaId: string } | undefined,
): { id: string; empresaId: string } => {
    if (!usuario) {
        throw new AppError(
            "NO_AUTENTICADO",
            "Debes iniciar sesión para continuar.",
            401,
        );
    }

    return usuario;
};

// ============================================================
// CONTROLADORES
// ============================================================

const createCustomerHandlers = (customerService: CustomerService) => {

    // ========================================================
    // LISTAR CLIENTES
    // ========================================================

    const listar: RequestHandler = async (req, res) => {
        const filtros = customerFiltersSchema.safeParse(req.query);

        if (!filtros.success) {
            throw new AppError(
                "FILTROS_INVALIDOS",
                "Revisa la página, el límite y los filtros de búsqueda.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const resultado = await customerService.listar({
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

    // ========================================================
    // CREAR CLIENTE
    // ========================================================

    const crear: RequestHandler = async (req, res) => {
        const resultado = createCustomerSchema.safeParse(req.body);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El nombre es obligatorio y los datos del cliente deben ser válidos.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const datos: DatosCrearCliente = resultado.data;

        const cliente = await customerService.crear(
            usuario.empresaId,
            usuario.id,
            datos,
        );

        res.status(201).json({
            exito: true,
            datos: { cliente },
            mensaje: "El cliente se creó correctamente.",
        });
    };

    // ========================================================
    // OBTENER CLIENTE
    // ========================================================

    const obtener: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const cliente = await customerService.obtener(
            usuario.empresaId,
            validateId(req.params.id),
        );

        res.json({
            exito: true,
            datos: { cliente },
        });
    };

    // ========================================================
    // ACTUALIZAR CLIENTE
    // ========================================================

    const actualizar: RequestHandler = async (req, res) => {
        const resultado = updateCustomerSchema.safeParse(req.body);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica al menos un campo válido para actualizar el cliente.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const datos = Object.fromEntries(
            Object.entries(resultado.data).filter(
                ([, valor]) => valor !== undefined,
            ),
        ) as DatosActualizarCliente;

        const cliente = await customerService.actualizar(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
            datos,
        );

        res.json({
            exito: true,
            datos: { cliente },
            mensaje: "El cliente se actualizó correctamente.",
        });
    };

    // ========================================================
    // CAMBIAR ESTADO
    // ========================================================

    const cambiarEstado: RequestHandler = async (req, res) => {
        const resultado = customerStatusSchema.safeParse(req.body);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El estado debe indicar si el cliente está activo.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const cliente = await customerService.cambiarEstado(
            usuario.empresaId,
            usuario.id,
            validateId(req.params.id),
            resultado.data.activo,
        );

        res.json({
            exito: true,
            datos: { cliente },
            mensaje: resultado.data.activo
                ? "El cliente se activó correctamente."
                : "El cliente se desactivó correctamente.",
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
        const resultado = await customerService.listarOperaciones(
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

    const actividadComercial: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const resultado = await customerService.obtenerActividadComercial(
            usuario.empresaId,
            validateId(req.params.id),
        );

        res.json({
            exito: true,
            datos: resultado,
        });
    };

    const listarDuplicados: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const resultado = await customerService.detectarDuplicados(
            usuario.empresaId,
        );

        res.json({
            exito: true,
            datos: resultado,
        });
    };

    return {
        listar,
        crear,
        obtener,
        actualizar,
        cambiarEstado,
        historial,
        actividadComercial,
        listarDuplicados,
    };
};

// ============================================================
// EXPORTACIÓN
// ============================================================

export const createCustomerController = createCustomerHandlers;
