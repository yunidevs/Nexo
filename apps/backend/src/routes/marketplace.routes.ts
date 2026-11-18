import { Router, type RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { createMarketplaceController } from "../controllers/marketplace.controller.js";
import { AppError } from "../errors/app-error.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { MarketplaceService } from "../modules/marketplace/marketplace.service.js";

const authorizeMarketplaceAdmin: RequestHandler = (req, _res, next) => {
    if (req.usuario?.rol !== "ADMINISTRADOR") {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "Solo un administrador puede configurar la tienda.",
                403,
            ),
        );
        return;
    }
    next();
};

const authorizeMarketplaceSeller: RequestHandler = (req, _res, next) => {
    if (
        req.usuario?.rol !== "ADMINISTRADOR" &&
        req.usuario?.rol !== "VENDEDOR"
    ) {
        next(
            new AppError(
                "PERMISO_DENEGADO",
                "No tienes permiso para gestionar pedidos del marketplace.",
                403,
            ),
        );
        return;
    }
    next();
};

export function createMarketplaceRoutes(
    config: AppConfig,
    service: MarketplaceService,
    authService: AuthService,
) {
    const router = Router();
    const controller = createMarketplaceController(service);

    router.get("/tiendas", controller.listarTiendas);
    router.get("/tiendas/:slug", controller.obtenerTienda);
    router.get("/catalogo", controller.listarCatalogo);
    router.get("/catalogo/categorias", controller.listarCategorias);
    router.get("/catalogo/:id", controller.obtenerProducto);
    router.get("/pedidos/:id/estado", controller.obtenerPedidoPublico);
    router.post(
        "/verificacion-telefono/codigo",
        controller.solicitarCodigoVerificacion,
    );
    router.post(
        "/verificacion-telefono/validar",
        controller.verificarTelefono,
    );
    router.post("/checkout", controller.crearCheckout);
    router.post("/pedidos/:id/capturar", controller.capturarPedido);
    router.post("/pedidos/:id/cancelar", controller.cancelarPedido);
    router.post("/webhook", controller.notificarPago);

    router.use(
        "/gestion",
        createAuthMiddleware(
            config.jwtSecret,
            (id, empresaId) => authService.validarSesion(id, empresaId),
        ),
    );
    router.get("/gestion", controller.obtenerConfiguracion);
    router.patch(
        "/gestion",
        authorizeMarketplaceAdmin,
        controller.actualizarConfiguracion,
    );
    router.get("/gestion/tienda", controller.obtenerEstadoTienda);
    router.patch(
        "/gestion/tienda",
        authorizeMarketplaceAdmin,
        controller.actualizarConexionTienda,
    );
    router.patch(
        "/gestion/productos/:id/publicacion",
        authorizeMarketplaceSeller,
        controller.publicarProducto,
    );
    router.get(
        "/gestion/pedidos",
        authorizeMarketplaceSeller,
        controller.listarPedidos,
    );
    router.patch(
        "/gestion/pedidos/:id/estado",
        authorizeMarketplaceSeller,
        controller.actualizarEstadoPedido,
    );
    router.post(
        "/gestion/pedidos/:id/reembolsar",
        authorizeMarketplaceSeller,
        controller.reembolsarPedido,
    );

    return router;
}
