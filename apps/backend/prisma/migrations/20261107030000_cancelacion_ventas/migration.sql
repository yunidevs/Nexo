CREATE TYPE "EstadoVenta" AS ENUM ('CONFIRMADA', 'CANCELADA');

ALTER TABLE "ventas"
    ADD COLUMN "estado" "EstadoVenta" NOT NULL DEFAULT 'CONFIRMADA',
    ADD COLUMN "cancelada_en" TIMESTAMP(3),
    ADD COLUMN "cancelada_por_id" UUID;

CREATE INDEX "ventas_empresa_id_estado_creada_en_idx"
    ON "ventas"("empresa_id", "estado", "creada_en");

ALTER TABLE "ventas"
    ADD CONSTRAINT "ventas_cancelada_por_id_fkey"
    FOREIGN KEY ("cancelada_por_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
