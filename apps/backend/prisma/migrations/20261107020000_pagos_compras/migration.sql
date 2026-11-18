CREATE TABLE "pagos_compras" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "usuario_id" UUID,
    "metodo" "MetodoPago" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_compras_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pagos_compras_compra_id_creada_en_idx"
    ON "pagos_compras"("compra_id", "creada_en");

ALTER TABLE "pagos_compras"
    ADD CONSTRAINT "pagos_compras_compra_id_fkey"
    FOREIGN KEY ("compra_id") REFERENCES "compras"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pagos_compras"
    ADD CONSTRAINT "pagos_compras_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
