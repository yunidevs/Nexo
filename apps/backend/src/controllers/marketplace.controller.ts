import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import type { MarketplaceService } from "../modules/marketplace/marketplace.service.js";

const slugSchema = z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const checkoutSchema = z
    .object({
        tiendaSlug: slugSchema,
        nombre: z.string().trim().min(2).max(100),
        correo: z.string().trim().email().max(100),
        telefono: z.string().trim().min(7).max(40),
        departamento: z.string().trim().min(1).max(80),
        localidad: z.string().trim().min(2).max(120),
        direccion: z.string().trim().min(5).max(300),
        codigoPostal: z.string().trim().max(20).optional(),
        notaEntrega: z.string().trim().max(500).optional(),
        detalles: z
            .array(
                z
                    .object({
                        productoId: z.string().uuid(),
                        cantidad: z.number().int().min(1).max(100),
                    })
                    .strict(),
            )
            .min(1)
            .max(30)
            .refine(
                (detalles) =>
                    new Set(detalles.map(({ productoId }) => productoId)).size ===
                    detalles.length,
                "No repitas productos en el pedido.",
            ),
    })
    .strict();

const tiendaSchema = z
    .object({
        activa: z.boolean(),
        slug: z.union([z.literal(""), slugSchema]),
        costoEnvio: z
            .number()
            .finite()
            .min(0)
            .max(9_999_999_999.99)
            .refine(
                (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-8,
                "El costo de envío admite hasta dos decimales.",
            ),
    })
    .strict();

const precioCatalogoSchema = z
    .string()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "El precio indicado no es válido.");

const catalogoQuerySchema = z
    .object({
        q: z.string().trim().max(120).optional(),
        categoria: z.string().trim().min(1).max(100).optional(),
        empresa: slugSchema.optional(),
        precioMin: precioCatalogoSchema.optional(),
        precioMax: precioCatalogoSchema.optional(),
        disponible: z.union([z.literal("true"), z.literal("false")]).optional(),
        orden: z
            .enum([
                "relevancia",
                "recientes",
                "populares",
                "precio-asc",
                "precio-desc",
                "nombre",
            ])
            .optional(),
        pagina: z
            .string()
            .regex(/^[1-9]\d{0,5}$/)
            .optional(),
        porPagina: z.enum(["8", "12", "24", "48"]).optional(),
    })
    .strict();

const publicacionSchema = z
    .object({ publicado: z.boolean() })
    .strict();

const conexionTiendaSchema = z
    .object({ conectada: z.boolean() })
    .strict();

const estadoPedidoSchema = z
    .object({
        estado: z.enum(["PREPARANDO", "ENVIADO", "ENTREGADO"]),
    })
    .strict();

const codigoVerificacionSchema = z
    .object({ telefono: z.string().trim().min(7).max(40) })
    .strict();

const validarTelefonoSchema = z
    .object({
        telefono: z.string().trim().min(7).max(40),
        codigo: z.string().trim().regex(/^\d{6}$/),
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
            "El identificador no es válido.",
            400,
        );
    }
    return resultado.data;
};

export const createMarketplaceController = (
    service: MarketplaceService,
) => {
    const listarTiendas: RequestHandler = async (_req, res) => {
        res.json({
            exito: true,
            datos: { tiendas: await service.listarTiendas() },
        });
    };

    const obtenerTienda: RequestHandler = async (req, res) => {
        const slug = slugSchema.safeParse(req.params.slug);
        if (!slug.success) {
            throw new AppError(
                "TIENDA_NO_ENCONTRADA",
                "La tienda no existe o no está publicada.",
                404,
            );
        }
        res.json({
            exito: true,
            datos: { tienda: await service.obtenerTienda(slug.data) },
        });
    };

    const listarCatalogo: RequestHandler = async (req, res) => {
        const resultado = catalogoQuerySchema.safeParse(req.query);
        if (!resultado.success) {
            throw new AppError(
                "FILTROS_CATALOGO_INVALIDOS",
                "Los filtros del catálogo no son válidos.",
                400,
            );
        }
        const consulta = resultado.data;
        const catalogo = await service.listarCatalogo({
            busqueda: consulta.q,
            categoria: consulta.categoria,
            empresaSlug: consulta.empresa,
            precioMin:
                consulta.precioMin === undefined
                    ? undefined
                    : Number(consulta.precioMin),
            precioMax:
                consulta.precioMax === undefined
                    ? undefined
                    : Number(consulta.precioMax),
            soloDisponibles: consulta.disponible === "true",
            orden: consulta.orden ?? "relevancia",
            pagina: Number(consulta.pagina ?? 1),
            porPagina: Number(consulta.porPagina ?? 12),
        });
        res.json({ exito: true, datos: { catalogo } });
    };

    const listarCategorias: RequestHandler = async (_req, res) => {
        res.json({
            exito: true,
            datos: {
                categorias: await service.listarCategoriasPublicas(),
            },
        });
    };

    const obtenerProducto: RequestHandler = async (req, res) => {
        const detalle = await service.obtenerProductoPublico(
            validateId(req.params.id),
        );
        res.json({ exito: true, datos: detalle });
    };

    const obtenerPedidoPublico: RequestHandler = async (req, res) => {
        const pedido = await service.obtenerPedidoPublico(
            validateId(req.params.id),
        );
        res.json({ exito: true, datos: { pedido } });
    };

    const solicitarCodigoVerificacion: RequestHandler = async (req, res) => {
        const resultado = codigoVerificacionSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Ingresa un número de teléfono válido.",
                400,
            );
        }
        const datos = await service.enviarCodigoVerificacionTelefono(
            resultado.data.telefono,
        );
        res.json({
            exito: true,
            datos,
            mensaje: "El código de verificación se envió por WhatsApp.",
        });
    };

    const verificarTelefono: RequestHandler = async (req, res) => {
        const resultado = validarTelefonoSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Ingresa el código de 6 dígitos que recibiste por WhatsApp.",
                400,
            );
        }
        await service.verificarTelefono(
            resultado.data.telefono,
            resultado.data.codigo,
        );
        res.json({
            exito: true,
            datos: { verificado: true },
            mensaje: "El teléfono quedó verificado.",
        });
    };

    const crearCheckout: RequestHandler = async (req, res) => {
        const resultado = checkoutSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Revisa los datos de contacto, envío y los productos del pedido.",
                400,
            );
        }
        const claveIdempotencia = z
            .string()
            .uuid()
            .safeParse(req.header("Idempotency-Key"));
        if (!claveIdempotencia.success) {
            throw new AppError(
                "CLAVE_IDEMPOTENCIA_INVALIDA",
                "El encabezado Idempotency-Key debe contener un UUID válido.",
                400,
            );
        }
        const checkout = await service.crearCheckout(
            resultado.data,
            claveIdempotencia.data,
        );
        res.status(201).json({
            exito: true,
            datos: checkout,
            mensaje: "El checkout se creó correctamente.",
        });
    };

    const notificarPago: RequestHandler = async (req, res) => {
        const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
        if (!rawBody) {
            throw new AppError(
                "NOTIFICACION_INVALIDA",
                "El cuerpo de la notificación de PayPal no está disponible.",
                400,
            );
        }
        let evento: unknown;
        try {
            evento = JSON.parse(rawBody.toString("utf8"));
        } catch {
            throw new AppError(
                "NOTIFICACION_INVALIDA",
                "El cuerpo de la notificación de PayPal no es válido.",
                400,
            );
        }
        const headers = {
            transmissionId: req.header("paypal-transmission-id") ?? "",
            transmissionTime: req.header("paypal-transmission-time") ?? "",
            certUrl: req.header("paypal-cert-url") ?? "",
            authAlgo: req.header("paypal-auth-algo") ?? "",
            transmissionSig: req.header("paypal-transmission-sig") ?? "",
        };
        if (
            !headers.transmissionId ||
            !headers.transmissionTime ||
            !headers.certUrl ||
            !headers.authAlgo ||
            !headers.transmissionSig
        ) {
            throw new AppError(
                "NOTIFICACION_INVALIDA",
                "La notificación de PayPal no incluye las cabeceras de firma requeridas.",
                400,
            );
        }
        await service.procesarNotificacion(evento, headers);
        res.sendStatus(200);
    };

    const capturarPedido: RequestHandler = async (req, res) => {
        const pedidoId = validateId(req.params.id);
        const orden = z
            .object({ orden: z.string().regex(/^[A-Z0-9]{1,36}$/) })
            .strict()
            .safeParse(req.body);
        if (!orden.success) {
            throw new AppError(
                "ORDEN_PAYPAL_INVALIDA",
                "El identificador de la orden de PayPal no es válido.",
                400,
            );
        }
        const estado = await service.capturarPedido(pedidoId, orden.data.orden);
        res.json({
            exito: true,
            datos: { id: pedidoId, estado },
            mensaje:
                estado === "PAGO_CONFIRMADO"
                    ? "PayPal confirmó el pago del pedido."
                    : estado === "REEMBOLSO_PENDIENTE"
                      ? "PayPal confirmó el pago, pero las existencias ya no estaban disponibles. El reembolso quedó en proceso."
                      : "El pago quedó pendiente de confirmación por PayPal.",
        });
    };

    const cancelarPedido: RequestHandler = async (req, res) => {
        const pedidoId = validateId(req.params.id);
        const orden = z
            .object({ orden: z.string().regex(/^[A-Z0-9]{1,36}$/) })
            .strict()
            .safeParse(req.body);
        if (!orden.success) {
            throw new AppError(
                "ORDEN_PAYPAL_INVALIDA",
                "El identificador de la orden de PayPal no es válido.",
                400,
            );
        }
        const estado = await service.cancelarPedido(pedidoId, orden.data.orden);
        res.json({
            exito: true,
            datos: { id: pedidoId, estado },
            mensaje:
                estado === "CANCELADO"
                    ? "El pedido se canceló y las existencias se liberaron."
                    : "El pedido ya no está pendiente de pago.",
        });
    };

    const obtenerConfiguracion: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        res.json({
            exito: true,
            datos: {
                configuracion: await service.obtenerConfiguracion(
                    usuario.empresaId,
                ),
            },
        });
    };

    const actualizarConfiguracion: RequestHandler = async (req, res) => {
        const resultado = tiendaSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica una dirección y un costo de envío válidos.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        const configuracion = await service.actualizarConfiguracion(
            usuario.empresaId,
            {
                activa: resultado.data.activa,
                slug: resultado.data.slug,
                costoEnvio: resultado.data.costoEnvio,
            },
        );
        res.json({
            exito: true,
            datos: { configuracion },
            mensaje: "La configuración de la tienda se guardó correctamente.",
        });
    };

    const obtenerEstadoTienda: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        res.json({
            exito: true,
            datos: await service.obtenerEstadoTienda(usuario.empresaId),
        });
    };

    const actualizarConexionTienda: RequestHandler = async (req, res) => {
        const resultado = conexionTiendaSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica si la tienda debe estar conectada al marketplace.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        const estado = await service.actualizarConexionTienda(
            usuario.empresaId,
            resultado.data.conectada,
        );
        res.json({
            exito: true,
            datos: estado,
            mensaje: resultado.data.conectada
                ? "La tienda se volvió a publicar en el marketplace."
                : "La tienda se desconectó del marketplace.",
        });
    };

    const publicarProducto: RequestHandler = async (req, res) => {
        const resultado = publicacionSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "Indica si el producto debe publicarse en el marketplace.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        const publicacion = await service.publicarProducto(
            usuario.empresaId,
            validateId(req.params.id),
            resultado.data.publicado,
        );
        res.json({
            exito: true,
            datos: {
                publicado: resultado.data.publicado,
                ...publicacion,
            },
            mensaje: !resultado.data.publicado
                ? "El producto dejó de publicarse en el marketplace."
                : publicacion.visible
                  ? "El producto se publicó en el marketplace."
                  : `El producto quedó marcado para publicarse, pero aún no aparecerá: ${publicacion.requisitosPendientes.join("; ")}.`,
        });
    };

    const listarPedidos: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        res.json({
            exito: true,
            datos: { pedidos: await service.listarPedidos(usuario.empresaId) },
        });
    };

    const actualizarEstadoPedido: RequestHandler = async (req, res) => {
        const resultado = estadoPedidoSchema.safeParse(req.body);
        if (!resultado.success) {
            throw new AppError(
                "DATOS_INVALIDOS",
                "El estado del pedido no es válido.",
                400,
            );
        }
        const usuario = requireIdentity(req.usuario);
        await service.actualizarEstadoPedido(
            usuario.empresaId,
            validateId(req.params.id),
            resultado.data.estado,
        );
        res.json({
            exito: true,
            datos: { id: req.params.id, estado: resultado.data.estado },
            mensaje: "El estado del pedido se actualizó.",
        });
    };

    const reembolsarPedido: RequestHandler = async (req, res) => {
        const usuario = requireIdentity(req.usuario);
        const id = validateId(req.params.id);
        const estado = await service.reembolsarPedido(
            usuario.empresaId,
            usuario.id,
            id,
        );
        res.json({
            exito: true,
            datos: { id, estado },
            mensaje:
                estado === "REEMBOLSADO"
                    ? "El pago se reembolsó y las existencias se devolvieron."
                    : "El reembolso quedó pendiente de confirmación por PayPal.",
        });
    };

    return {
        listarTiendas,
        obtenerTienda,
        listarCatalogo,
        listarCategorias,
        obtenerProducto,
        obtenerPedidoPublico,
        solicitarCodigoVerificacion,
        verificarTelefono,
        crearCheckout,
        capturarPedido,
        cancelarPedido,
        notificarPago,
        obtenerConfiguracion,
        actualizarConfiguracion,
        obtenerEstadoTienda,
        actualizarConexionTienda,
        publicarProducto,
        listarPedidos,
        actualizarEstadoPedido,
        reembolsarPedido,
    };
};
