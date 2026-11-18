import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type {
    CategoryService,
    DatosActualizarCategoria,
    DatosCrearCategoria,
} from "../modules/categorias/categorias.service.js";

const descripcionOpcional = z.union([
    z.literal("").transform(() => null),
    z.string().trim().max(300).transform((valor) => valor || null),
]);

const createCategorySchema = z
    .object({
        nombre: z.string().trim().min(2).max(80),
        descripcion: descripcionOpcional.optional(),
    })
    .strict();

const updateCategorySchema = z
    .object({
        nombre: z.string().trim().min(2).max(80).optional(),
        descripcion: descripcionOpcional.optional(),
    })
    .strict()
    .refine((datos) => Object.keys(datos).length > 0);

const categoryStatusSchema = z.object({ activo: z.boolean() }).strict();

const categoryFiltersSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    buscar: z.string().trim().max(100).default(""),
    activo: z.enum(["true", "false"]).optional(),
});

const validateId = (value: string | string[] | undefined): string => {
    const resultado = z
        .string()
        .uuid()
        .safeParse(typeof value === "string" ? value : "");

    if (!resultado.success) {
        throw new AppError(
            "IDENTIFICADOR_INVALIDO",
            "El identificador de la categoría no es válido.",
            400,
        );
    }

    return resultado.data;
};

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

export const createCategoryController = (categoryService: CategoryService) => {
    const listar: RequestHandler = async (req, res) => {
        const filtros = categoryFiltersSchema.safeParse(req.query);
        if (!filtros.success) {
            throw new AppError(
                "FILTROS_INVALIDOS",
                "Revisa la página, el límite y los filtros de búsqueda.",
                400,
            );
        }

        const resultado = await categoryService.listar({
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

    const crear: RequestHandler = async (req, res) => {
        const resultado = createCategorySchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El nombre es obligatorio y los datos de la categoría deben ser válidos.",
                400,
            );
        }

        const datos: DatosCrearCategoria = resultado.data;
        const categoria = await categoryService.crear(
            requireCompanyId(req.usuario?.empresaId),
            datos,
        );
        res.status(201).json({
            exito: true,
            datos: { categoria },
            mensaje: "La categoría se creó correctamente.",
        });
    };

    const obtener: RequestHandler = async (req, res) => {
        const categoria = await categoryService.obtener(
            requireCompanyId(req.usuario?.empresaId),
            validateId(req.params.id),
        );
        res.json({ exito: true, datos: { categoria } });
    };

    const actualizar: RequestHandler = async (req, res) => {
        const resultado = updateCategorySchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica al menos un campo válido para actualizar la categoría.",
                400,
            );
        }

        const datos = Object.fromEntries(
            Object.entries(resultado.data).filter(
                ([, valor]) => valor !== undefined,
            ),
        ) as DatosActualizarCategoria;
        const categoria = await categoryService.actualizar(
            requireCompanyId(req.usuario?.empresaId),
            validateId(req.params.id),
            datos,
        );
        res.json({
            exito: true,
            datos: { categoria },
            mensaje: "La categoría se actualizó correctamente.",
        });
    };

    const cambiarEstado: RequestHandler = async (req, res) => {
        const resultado = categoryStatusSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El estado debe indicar si la categoría está activa.",
                400,
            );
        }

        const categoria = await categoryService.cambiarEstado(
            requireCompanyId(req.usuario?.empresaId),
            validateId(req.params.id),
            resultado.data.activo,
        );
        res.json({
            exito: true,
            datos: { categoria },
            mensaje: resultado.data.activo
                ? "La categoría se activó correctamente."
                : "La categoría se desactivó correctamente.",
        });
    };

    return { listar, crear, obtener, actualizar, cambiarEstado };
};
