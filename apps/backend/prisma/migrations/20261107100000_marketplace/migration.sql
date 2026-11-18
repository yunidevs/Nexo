ALTER TYPE "MetodoPago" ADD VALUE 'MERCADO_PAGO';

CREATE TYPE "EstadoPedidoMarketplace" AS ENUM (
    'PENDIENTE_PAGO',
    'PAGO_CONFIRMADO',
    'PREPARANDO',
    'ENVIADO',
    'ENTREGADO',
    'CANCELADO',
    'REEMBOLSADO',
    'REEMBOLSO_PENDIENTE'
);

ALTER TABLE "empresas"
    ADD COLUMN "tienda_activa" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "tienda_slug" VARCHAR(100),
    ADD COLUMN "costo_envio" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "empresas_tienda_slug_key" ON "empresas"("tienda_slug");

ALTER TABLE "productos"
    ADD COLUMN "publicado_marketplace" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "stock_reservado" INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT "productos_stock_reservado_check"
        CHECK ("stock_reservado" >= 0 AND "stock_reservado" <= "stock");

CREATE INDEX "productos_empresa_id_publicado_marketplace_activo_idx"
    ON "productos"("empresa_id", "publicado_marketplace", "activo");

ALTER TABLE "ventas"
    ADD COLUMN "costo_envio" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "cuentas_mercado_pago" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_mercado_pago_id" VARCHAR(80) NOT NULL,
    "access_token_cifrado" TEXT NOT NULL,
    "refresh_token_cifrado" TEXT NOT NULL,
    "vence_en" TIMESTAMP(3) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_mercado_pago_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "estados_oauth_marketplace" (
    "id" UUID NOT NULL,
    "estado_hash" VARCHAR(64) NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estados_oauth_marketplace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pedidos_marketplace" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "venta_id" UUID,
    "estado" "EstadoPedidoMarketplace" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "nombre_comprador" VARCHAR(160) NOT NULL,
    "correo_comprador" VARCHAR(254) NOT NULL,
    "telefono_comprador" VARCHAR(40) NOT NULL,
    "departamento" VARCHAR(80) NOT NULL,
    "localidad" VARCHAR(120) NOT NULL,
    "direccion" VARCHAR(300) NOT NULL,
    "codigo_postal" VARCHAR(20),
    "nota_entrega" VARCHAR(500),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tasa_impuesto" DECIMAL(5,2) NOT NULL,
    "impuesto" DECIMAL(12,2) NOT NULL,
    "costo_envio" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "comision" DECIMAL(12,2) NOT NULL,
    "preferencia_id" VARCHAR(100),
    "pago_mercado_pago_id" VARCHAR(100),
    "expira_en" TIMESTAMP(3) NOT NULL,
    "pagada_en" TIMESTAMP(3),
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_marketplace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "detalles_pedidos_marketplace" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "detalles_pedidos_marketplace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cuentas_mercado_pago_empresa_id_key"
    ON "cuentas_mercado_pago"("empresa_id");
CREATE UNIQUE INDEX "estados_oauth_marketplace_estado_hash_key"
    ON "estados_oauth_marketplace"("estado_hash");
CREATE INDEX "estados_oauth_marketplace_expira_en_idx"
    ON "estados_oauth_marketplace"("expira_en");
CREATE INDEX "estados_oauth_marketplace_empresa_id_idx"
    ON "estados_oauth_marketplace"("empresa_id");
CREATE INDEX "estados_oauth_marketplace_usuario_id_idx"
    ON "estados_oauth_marketplace"("usuario_id");
CREATE UNIQUE INDEX "pedidos_marketplace_venta_id_key"
    ON "pedidos_marketplace"("venta_id");
CREATE UNIQUE INDEX "pedidos_marketplace_preferencia_id_key"
    ON "pedidos_marketplace"("preferencia_id");
CREATE UNIQUE INDEX "pedidos_marketplace_pago_mercado_pago_id_key"
    ON "pedidos_marketplace"("pago_mercado_pago_id");
CREATE INDEX "pedidos_marketplace_empresa_id_estado_creada_en_idx"
    ON "pedidos_marketplace"("empresa_id", "estado", "creada_en");
CREATE INDEX "pedidos_marketplace_estado_expira_en_idx"
    ON "pedidos_marketplace"("estado", "expira_en");
CREATE INDEX "detalles_pedidos_marketplace_pedido_id_idx"
    ON "detalles_pedidos_marketplace"("pedido_id");
CREATE INDEX "detalles_pedidos_marketplace_producto_id_idx"
    ON "detalles_pedidos_marketplace"("producto_id");

ALTER TABLE "cuentas_mercado_pago"
    ADD CONSTRAINT "cuentas_mercado_pago_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "estados_oauth_marketplace"
    ADD CONSTRAINT "estados_oauth_marketplace_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "estados_oauth_marketplace"
    ADD CONSTRAINT "estados_oauth_marketplace_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedidos_marketplace"
    ADD CONSTRAINT "pedidos_marketplace_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedidos_marketplace"
    ADD CONSTRAINT "pedidos_marketplace_venta_id_fkey"
    FOREIGN KEY ("venta_id") REFERENCES "ventas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "detalles_pedidos_marketplace"
    ADD CONSTRAINT "detalles_pedidos_marketplace_pedido_id_fkey"
    FOREIGN KEY ("pedido_id") REFERENCES "pedidos_marketplace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "detalles_pedidos_marketplace"
    ADD CONSTRAINT "detalles_pedidos_marketplace_producto_id_fkey"
    FOREIGN KEY ("producto_id") REFERENCES "productos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
