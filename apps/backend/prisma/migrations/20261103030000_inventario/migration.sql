CREATE TYPE "TipoMovimientoInventario" AS ENUM (
    'ENTRADA',
    'SALIDA',
    'AJUSTE',
    'DEVOLUCION'
);

ALTER TABLE "productos"
    ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stock_anterior" INTEGER NOT NULL,
    "stock_nuevo" INTEGER NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimientos_inventario_empresa_id_creada_en_idx"
    ON "movimientos_inventario"("empresa_id", "creada_en");
CREATE INDEX "movimientos_inventario_producto_id_creada_en_idx"
    ON "movimientos_inventario"("producto_id", "creada_en");

ALTER TABLE "movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_producto_id_fkey"
    FOREIGN KEY ("producto_id") REFERENCES "productos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimientos_inventario"
    ADD CONSTRAINT "movimientos_inventario_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
