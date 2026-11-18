
import { Rol } from "@prisma/client";
import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../errors/app-error.js";
import {
    type DatosActualizarUsuario,
    type DatosCrearUsuario,
    type UserService,
} from "../modules/usuarios/usuarios.service.js";

// ============================================================
// VALIDACIONES
// ============================================================

// Validación de contraseña
const passwordSchema = z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-ZÁÉÍÓÚÜÑ]/)
    .regex(/[a-záéíóúüñ]/)
    .regex(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/);

// Validación de correo electrónico
const correoSchema = z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((valor) => valor.toLowerCase());

// Crear usuario
const createUserSchema = z
    .object({
        nombre: z.string().trim().min(2).max(80),
        apellido: z.string().trim().min(2).max(80),
        correo: correoSchema,
        contrasena: passwordSchema,
        rol: z.nativeEnum(Rol),
    })
    .strict();

// Actualizar usuario
const updateUserSchema = z
    .object({
        nombre: z.string().trim().min(2).max(80).optional(),
        apellido: z.string().trim().min(2).max(80).optional(),
        correo: correoSchema.optional(),
    })
    .strict()
    .refine((datos) => Object.keys(datos).length > 0);

// Cambiar rol
const roleSchema = z
    .object({
        rol: z.nativeEnum(Rol),
    })
    .strict();

// Cambiar estado
const statusSchema = z
    .object({
        activo: z.boolean(),
    })
    .strict();

// Filtros de búsqueda
const userFiltersSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    buscar: z.string().trim().max(100).default(""),
    activo: z.enum(["true", "false"]).optional(),
});

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

// Validar identificador del usuario
const validateId = (value: string | string[] | undefined): string => {
    const resultado = z
        .string()
        .uuid()
        .safeParse(typeof value === "string" ? value : "");

    if (!resultado.success) {
        throw new AppError(
            "IDENTIFICADOR_INVALIDO",
            "El identificador del usuario no es válido.",
            400,
        );
    }

    return resultado.data;
};

// Verificar empresa autenticada
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

// ============================================================
// CONTROLADORES
// ============================================================

const createUserHandlers = (userService: UserService) => {

    // ========================================================
    // LISTAR USUARIOS
    // ========================================================

    const listar: RequestHandler = async (req, res) => {
        const filtros = userFiltersSchema.safeParse(req.query);

        if (!filtros.success) {
            throw new AppError(
                "FILTROS_INVALIDOS",
                "Revisa la página, el límite y los filtros de búsqueda.",
                400,
            );
        }

        const resultado = await userService.listar({
            empresaId: requireCompanyId(req.usuario?.empresaId),
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
    // CREAR USUARIO
    // ========================================================

    const crear: RequestHandler = async (req, res) => {
        const resultado = createUserSchema.safeParse(req.body);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Revisa los datos y los requisitos de contraseña del usuario.",
                400,
            );
        }

        const usuario = await userService.crear(
            requireCompanyId(req.usuario?.empresaId),
            resultado.data satisfies DatosCrearUsuario,
        );

        res.status(201).json({
            exito: true,
            datos: { usuario },
            mensaje: "El usuario se creó correctamente.",
        });
    };

    // ========================================================
    // OBTENER USUARIO
    // ========================================================

    const obtener: RequestHandler = async (req, res) => {
        const usuario = await userService.obtener(
            requireCompanyId(req.usuario?.empresaId),
            validateId(req.params.id),
        );

        res.json({
            exito: true,
            datos: { usuario },
        });
    };

    // ========================================================
    // ACTUALIZAR USUARIO
    // ========================================================

    const actualizar: RequestHandler = async (req, res) => {
        const resultado = updateUserSchema.safeParse(req.body);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica al menos un campo válido para actualizar el usuario.",
                400,
            );
        }

        const datos = Object.fromEntries(
            Object.entries(resultado.data).filter(
                ([, valor]) => valor !== undefined,
            ),
        ) as DatosActualizarUsuario;

        const usuario = await userService.actualizar(
            requireCompanyId(req.usuario?.empresaId),
            validateId(req.params.id),
            datos,
        );

        res.json({
            exito: true,
            datos: { usuario },
            mensaje: "El usuario se actualizó correctamente.",
        });
    };

    // ========================================================
    // CAMBIAR ROL
    // ========================================================

    const cambiarRol: RequestHandler = async (req, res) => {
        const resultado = roleSchema.safeParse(req.body);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Selecciona un rol válido.",
                400,
            );
        }

        if (req.params.id === req.usuario?.id) {
            throw new AppError(
                "USUARIO_PROPIO",
                "No puedes cambiar tu propio rol.",
                409,
            );
        }

        const usuario = await userService.cambiarRol(
            requireCompanyId(req.usuario?.empresaId),
            validateId(req.params.id),
            resultado.data.rol,
        );

        res.json({
            exito: true,
            datos: { usuario },
            mensaje: "El rol del usuario se actualizó correctamente.",
        });
    };

    // ========================================================
    // CAMBIAR ESTADO
    // ========================================================

    const cambiarEstado: RequestHandler = async (req, res) => {
        const resultado = statusSchema.safeParse(req.body);

        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El estado debe indicar si el usuario está activo.",
                400,
            );
        }

        if (req.params.id === req.usuario?.id && !resultado.data.activo) {
            throw new AppError(
                "USUARIO_PROPIO",
                "No puedes desactivar tu propia cuenta.",
                409,
            );
        }

        const usuario = await userService.cambiarEstado(
            requireCompanyId(req.usuario?.empresaId),
            validateId(req.params.id),
            resultado.data.activo,
        );

        res.json({
            exito: true,
            datos: { usuario },
            mensaje: resultado.data.activo
                ? "El usuario se activó correctamente."
                : "El usuario se desactivó correctamente.",
        });
    };

    // ========================================================
    // EXPORTAR CONTROLADORES
    // ========================================================

    return {
        listar,
        crear,
        obtener,
        actualizar,
        cambiarRol,
        cambiarEstado,
    };
};

// ============================================================
// EXPORTACIÓN
// ============================================================

export const createUserController = createUserHandlers;
