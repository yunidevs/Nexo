
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import helmet from "helmet";

import { loadConfig, type AppConfig } from "./config.js";
import { prisma } from "./database.js";
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

export const createApp = (
    config: AppConfig = loadConfig(),
    authService: AuthService = createAuthService(prisma, config.jwtSecret, config),
    customerService: CustomerService = createCustomerService(prisma),
    userService: UserService = createUserService(prisma),
    companyService: CompanyService = createCompanyService(prisma),
    supplierService: SupplierService = createSupplierService(prisma),
    productService: ProductService = createProductService(prisma),
    inventoryService: InventoryService = createInventoryService(prisma),
    categoryService: CategoryService = createCategoryService(prisma),
    purchaseService: PurchaseService = createPurchaseService(prisma),
    salesService: SalesService = createSalesService(prisma),
    dashboardService: DashboardService = createDashboardService(prisma),
    marketplaceService: MarketplaceService = createMarketplaceService(
        prisma,
        config,
    ),
) => {
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
        createMarketplaceRoutes(config, marketplaceService, authService),
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
