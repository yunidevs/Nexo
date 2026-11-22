
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import helmet from "helmet";

import { loadConfig, type AppConfig } from "./config.js";
import { prisma } from "./database.js";
import { redisPing, redisUrl } from "./lib/redis.js";
import { AppError } from "./errors/app-error.js";
import { errorHandler } from "./middleware/error-handler.js";
import {
    createAuthService,
    type AuthService,
} from "./modules/auth/auth.service.js";
import {
    createCustomerService,
    type CustomerService,
} from "./modules/clientes/clientes.service.js";
import {
    createUserService,
    type UserService,
} from "./modules/usuarios/usuarios.service.js";
import {
    createCompanyService,
    type CompanyService,
} from "./modules/empresas/empresas.service.js";
import {
    createSupplierService,
    type SupplierService,
} from "./modules/proveedores/proveedores.service.js";
import {
    createProductService,
    type ProductService,
} from "./modules/productos/productos.service.js";
import {
    createCategoryService,
    type CategoryService,
} from "./modules/categorias/categorias.service.js";
import { createAuthRoutes } from "./routes/auth.routes.js";
import { createCustomerRoutes } from "./routes/clientes.routes.js";
import { createCompanyRoutes } from "./routes/empresas.routes.js";
import { createUserRoutes } from "./routes/usuarios.routes.js";
import { createSupplierRoutes } from "./routes/proveedores.routes.js";
import { createProductRoutes } from "./routes/productos.routes.js";
import {
    createInventoryService,
    type InventoryService,
} from "./modules/inventario/inventario.service.js";
import { createInventoryRoutes } from "./routes/inventario.routes.js";
import { createCategoryRoutes } from "./routes/categorias.routes.js";
import {
    createPurchaseService,
    type PurchaseService,
} from "./modules/compras/compras.service.js";
import { createPurchaseRoutes } from "./routes/compras.routes.js";
import {
    createSalesService,
    type SalesService,
} from "./modules/ventas/ventas.service.js";
import { createSalesRoutes } from "./routes/ventas.routes.js";
import {
    createDashboardService,
    type DashboardService,
} from "./modules/dashboard/dashboard.service.js";
import { createDashboardRoutes } from "./routes/dashboard.routes.js";
import {
    createMarketplaceService,
    type MarketplaceService,
} from "./modules/marketplace/marketplace.service.js";
import { createMarketplaceRoutes } from "./routes/marketplace.routes.js";
import {
    createClienteCuentaService,
    type ClienteCuentaService,
} from "./modules/cuenta-cliente/cuenta-cliente.service.js";
import { createClienteCuentaRoutes } from "./routes/cuenta-cliente.routes.js";

/**
 * Dependencias inyectables de la aplicación. Todas son opcionales: si no se
 * proporcionan, se construyen con los valores por defecto (Prisma real +
 * config cargada del entorno). Los tests pasan dobles de servicio por nombre,
 * lo que evita el error clásico de argumentos posicionales en desorden.
 */
export interface AppDependencies {
    config?: AppConfig;
    authService?: AuthService;
    customerService?: CustomerService;
    userService?: UserService;
    companyService?: CompanyService;
    supplierService?: SupplierService;
    productService?: ProductService;
    inventoryService?: InventoryService;
    categoryService?: CategoryService;
    purchaseService?: PurchaseService;
    salesService?: SalesService;
    dashboardService?: DashboardService;
    marketplaceService?: MarketplaceService;
    clienteCuentaService?: ClienteCuentaService;
}

export const createApp = (deps: AppDependencies = {}) => {
    const config = deps.config ?? loadConfig();
    const authService =
        deps.authService ??
        createAuthService(prisma, config.jwtSecret, config);
    const customerService =
        deps.customerService ?? createCustomerService(prisma);
    const userService = deps.userService ?? createUserService(prisma);
    const companyService =
        deps.companyService ?? createCompanyService(prisma);
    const supplierService =
        deps.supplierService ?? createSupplierService(prisma);
    const productService =
        deps.productService ?? createProductService(prisma);
    const inventoryService =
        deps.inventoryService ?? createInventoryService(prisma);
    const categoryService =
        deps.categoryService ?? createCategoryService(prisma);
    const purchaseService =
        deps.purchaseService ?? createPurchaseService(prisma);
    const salesService = deps.salesService ?? createSalesService(prisma);
    const dashboardService =
        deps.dashboardService ??
        createDashboardService(prisma, config.dashboardTimezone);
    const marketplaceService =
        deps.marketplaceService ?? createMarketplaceService(prisma, config);
    const clienteCuentaService =
        deps.clienteCuentaService ??
        createClienteCuentaService(prisma, config.jwtSecret, config);

    const app = express();
    
    app.set("trust proxy", 1);

    app.disable("x-powered-by");

    app.use(helmet());
    app.use(cors({ origin: config.corsOrigin, credentials: true }));
    app.use(cookieParser());
    app.use(
        express.json({
            limit: "1mb",
            verify: (request, _response, body) => {
                if (request.url?.startsWith("/api/marketplace/webhook")) {
                    Object.assign(request, { rawBody: Buffer.from(body) });
                }
            },
        }),
    );

    // Registro de peticiones HTTP
    const logRequest: RequestHandler = (req, res, next) => {
        const inicio = performance.now();

        res.on("finish", () => {
            console.info(
                JSON.stringify({
                    nivel: "info",
                    mensaje: "peticion_http",
                    metodo: req.method,
                    ruta: req.path,
                    estado: res.statusCode,
                    duracionMs: Math.round(performance.now() - inicio),
                }),
            );
        });

        next();
    };

    app.use(logRequest);

    // Rutas generales
    app.get("/", (_req, res) => {
        res.json({ mensaje: "API NexoERP funcionando" });
    });

    app.get("/api/salud", (_req, res) => {
        res.json({
            exito: true,
            datos: { estado: "operativo" },
            mensaje: "API NexoERP funcionando.",
        });
    });

    // Readiness real: verifica que la API pueda consultar la base de datos.
    // Los balanceadores y orchestradores deben usar esta ruta; si Postgres
    // no responde, devuelve 503 para dejar de enviar tráfico a la instancia.
    app.get("/api/listo", async (_req, res, next) => {
        try {
            const [baseDatos, redis] = await Promise.all([
                prisma.$queryRaw`SELECT 1`.then(() => "conectada"),
                redisUrl()
                    ? redisPing().then((ok) =>
                          ok ? "conectado" : "no_disponible",
                      )
                    : Promise.resolve("no_configurado"),
            ]);
            res.json({
                exito: true,
                datos: { estado: "listo", baseDatos, redis },
                mensaje: "La API está lista para recibir tráfico.",
            });
        } catch {
            next(
                new AppError(
                    "SERVICIO_NO_DISPONIBLE",
                    "La API no puede conectar con la base de datos.",
                    503,
                ),
            );
        }
    });

    // Rutas de la aplicación
    app.use("/api/autenticacion", createAuthRoutes(config, authService));
    app.use(
        "/api/clientes",
        createCustomerRoutes(config, customerService, authService),
    );
    app.use(
        "/api/usuarios",
        createUserRoutes(config, userService, authService),
    );
    app.use(
        "/api/empresa",
        createCompanyRoutes(config, companyService, authService),
    );
    app.use(
        "/api/proveedores",
        createSupplierRoutes(config, supplierService, authService),
    );
    app.use(
        "/api/productos",
        createProductRoutes(config, productService, authService),
    );
    app.use(
        "/api/inventario",
        createInventoryRoutes(config, inventoryService, authService),
    );
    app.use(
        "/api/categorias",
        createCategoryRoutes(config, categoryService, authService),
    );
    app.use(
        "/api/compras",
        createPurchaseRoutes(config, purchaseService, authService),
    );
    app.use(
        "/api/ventas",
        createSalesRoutes(config, salesService, authService),
    );
    app.use(
        "/api/dashboard",
        createDashboardRoutes(config, dashboardService, authService),
    );
    app.use(
        "/api/marketplace",
        createMarketplaceRoutes(
            config,
            marketplaceService,
            authService,
            clienteCuentaService,
        ),
    );
    app.use(
        "/api/cuenta-clientes",
        createClienteCuentaRoutes(config, clienteCuentaService),
    );

    // Ruta no encontrada
    app.use((req, _res, next) => {
        next(
            new AppError(
                "RUTA_NO_ENCONTRADA",
                `No existe la ruta ${req.method} ${req.path}.`,
                404,
            ),
        );
    });

    // Manejo centralizado de errores
    app.use(errorHandler);

    return app;
};
