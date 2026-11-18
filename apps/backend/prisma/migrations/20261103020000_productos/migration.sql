CREATE TABLE "productos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "precio_venta" DECIMAL(12,2) NOT NULL,
    "costo" DECIMAL(12,2) NOT NULL,
    "stock_minimo" INTEGER NOT NULL,
    "categoria" VARCHAR(100),
    "imagen_url" VARCHAR(2048),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "productos_empresa_id_sku_key"
    ON "productos"("empresa_id", "sku");
CREATE INDEX "productos_empresa_id_creada_en_idx"
    ON "productos"("empresa_id", "creada_en");
CREATE INDEX "productos_empresa_id_activo_idx"
    ON "productos"("empresa_id", "activo");
CREATE INDEX "productos_empresa_id_categoria_idx"
    ON "productos"("empresa_id", "categoria");

ALTER TABLE "productos"
    ADD CONSTRAINT "productos_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
