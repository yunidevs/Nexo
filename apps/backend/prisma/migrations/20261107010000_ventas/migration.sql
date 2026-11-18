CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO');

ALTER TABLE "empresas"
    ADD COLUMN "tasa_impuesto" DECIMAL(5,2) NOT NULL DEFAULT 0;

CREATE TABLE "ventas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "usuario_id" UUID,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL,
    "tasa_impuesto" DECIMAL(5,2) NOT NULL,
    "impuesto" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "detalles_ventas" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "detalles_ventas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pagos_ventas" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "usuario_id" UUID,
    "metodo" "MetodoPago" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_ventas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ventas_empresa_id_creada_en_idx" ON "ventas"("empresa_id", "creada_en");
CREATE INDEX "ventas_cliente_id_creada_en_idx" ON "ventas"("cliente_id", "creada_en");
CREATE INDEX "detalles_ventas_venta_id_idx" ON "detalles_ventas"("venta_id");
CREATE INDEX "detalles_ventas_producto_id_idx" ON "detalles_ventas"("producto_id");
CREATE INDEX "pagos_ventas_venta_id_creada_en_idx" ON "pagos_ventas"("venta_id", "creada_en");

ALTER TABLE "ventas"
    ADD CONSTRAINT "ventas_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventas"
    ADD CONSTRAINT "ventas_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ventas"
    ADD CONSTRAINT "ventas_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "detalles_ventas"
    ADD CONSTRAINT "detalles_ventas_venta_id_fkey"
    FOREIGN KEY ("venta_id") REFERENCES "ventas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "detalles_ventas"
    ADD CONSTRAINT "detalles_ventas_producto_id_fkey"
    FOREIGN KEY ("producto_id") REFERENCES "productos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagos_ventas"
    ADD CONSTRAINT "pagos_ventas_venta_id_fkey"
    FOREIGN KEY ("venta_id") REFERENCES "ventas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagos_ventas"
    ADD CONSTRAINT "pagos_ventas_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
