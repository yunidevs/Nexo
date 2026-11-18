CREATE TYPE "EstadoCompra" AS ENUM ('PENDIENTE', 'RECIBIDA');

CREATE TABLE "compras" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "usuario_id" UUID,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'PENDIENTE',
    "total" DECIMAL(12,2) NOT NULL,
    "fecha_compra" DATE NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibida_en" TIMESTAMP(3),

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "detalles_compras" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "detalles_compras_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compras_empresa_id_creada_en_idx" ON "compras"("empresa_id", "creada_en");
CREATE INDEX "compras_proveedor_id_creada_en_idx" ON "compras"("proveedor_id", "creada_en");
CREATE INDEX "detalles_compras_compra_id_idx" ON "detalles_compras"("compra_id");
CREATE INDEX "detalles_compras_producto_id_idx" ON "detalles_compras"("producto_id");

ALTER TABLE "compras"
    ADD CONSTRAINT "compras_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras"
    ADD CONSTRAINT "compras_proveedor_id_fkey"
    FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras"
    ADD CONSTRAINT "compras_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "detalles_compras"
    ADD CONSTRAINT "detalles_compras_compra_id_fkey"
    FOREIGN KEY ("compra_id") REFERENCES "compras"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "detalles_compras"
    ADD CONSTRAINT "detalles_compras_producto_id_fkey"
    FOREIGN KEY ("producto_id") REFERENCES "productos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
