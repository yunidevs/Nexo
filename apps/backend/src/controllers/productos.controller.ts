import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type {
    DatosActualizarProducto,
    DatosCrearProducto,
    ProductService,
} from "../modules/productos/productos.service.js";

const campoTextoOpcional = (max: number) =>
    z.union([
        z.literal("").transform(() => null),
        z.string().trim().max(max).transform((valor) => valor || null),
    ]);

const imagenOpcional = z.union([
    z.literal("").transform(() => null),
    z
        .string()
        .trim()
        .max(2048)
        .url()
        .refine((valor) => /^https?:\/\//i.test(valor))
        .transform((valor) => valor || null),
]);

const precio = z
    .number()
    .finite()
    .nonnegative()
    .max(9_999_999_999.99)
    .refine(
        (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-8,
        "El valor admite hasta dos decimales.",
    );

const createProductSchema = z
    .object({
        sku: z.string().trim().min(1).max(80).transform((valor) => valor.toUpperCase()),
        nombre: z.string().trim().min(2).max(120),
        precioVenta: precio,
        costo: precio,
        stockMinimo: z.number().int().min(0).max(2_147_483_647),
        categoria: campoTextoOpcional(100).optional(),
        imagenUrl: imagenOpcional.optional(),
    })
    .strict();

const updateProductSchema = z
    .object({
        sku: z.string().trim().min(1).max(80).transform((valor) => valor.toUpperCase()).optional(),
        nombre: z.string().trim().min(2).max(120).optional(),
        precioVenta: precio.optional(),
        costo: precio.optional(),
        stockMinimo: z.number().int().min(0).max(2_147_483_647).optional(),
        categoria: campoTextoOpcional(100).optional(),
        imagenUrl: imagenOpcional.optional(),
    })
    .strict()
    .refine((datos) => Object.keys(datos).length > 0);

const productStatusSchema = z.object({ activo: z.boolean() }).strict();
const productFiltersSchema = z.object({
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
            "El identificador del producto no es válido.",
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

export const createProductController = (productService: ProductService) => {
    const listar: RequestHandler = async (req, res) => {
        const filtros = productFiltersSchema.safeParse(req.query);
        if (!filtros.success) {
            throw new AppError(
                "FILTROS_INVALIDOS",
                "Revisa la página, el límite y los filtros de búsqueda.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const resultado = await productService.listar({
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
        const resultado = createProductSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Revisa el SKU, nombre, precios, stock mínimo, categoría e imagen del producto.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const producto = await productService.crear(
            usuario.empresaId,
            resultado.data satisfies DatosCrearProducto,
        );

        res.status(201).json({
            exito: true,
            datos: { producto },
            mensaje: "El producto se creó correctamente.",
        });
    };

    const obtener: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const producto = await productService.obtener(
            usuario.empresaId,
            validateId(req.params.id),
        );
        res.json({ exito: true, datos: { producto } });
    };

    const actualizar: RequestHandler = async (req, res) => {
        const resultado = updateProductSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica al menos un campo válido para actualizar el producto.",
                400,
            );
        }

        const datos = Object.fromEntries(
            Object.entries(resultado.data).filter(
                ([, valor]) => valor !== undefined,
            ),
        ) as DatosActualizarProducto;
        const usuario = requireIdentity(req.usuario);
        const producto = await productService.actualizar(
            usuario.empresaId,
            validateId(req.params.id),
            datos,
        );

        res.json({
            exito: true,
            datos: { producto },
            mensaje: "El producto se actualizó correctamente.",
        });
    };

    const cambiarEstado: RequestHandler = async (req, res) => {
        const resultado = productStatusSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El estado debe indicar si el producto está activo.",
                400,
            );
        }

        const usuario = requireIdentity(req.usuario);
        const producto = await productService.cambiarEstado(
            usuario.empresaId,
            validateId(req.params.id),
            resultado.data.activo,
        );

        res.json({
            exito: true,
            datos: { producto },
            mensaje: resultado.data.activo
                ? "El producto se activó correctamente."
                : "El producto se desactivó correctamente.",
        });
    };

    const eliminar: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const resultado = await productService.eliminar(
            usuario.empresaId,
            validateId(req.params.id),
        );

        res.json({
            exito: true,
            datos: resultado,
            mensaje:
                resultado.modo === "eliminado"
                    ? "El producto se eliminó correctamente."
                    : `El producto se archivó porque conserva ${resultado.dependencias.join(", ")}.`,
        });
    };

    return { listar, crear, obtener, actualizar, cambiarEstado, eliminar };
};
