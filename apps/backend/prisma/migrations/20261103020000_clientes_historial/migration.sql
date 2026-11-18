CREATE TYPE "TipoOperacionCliente" AS ENUM (
    'CREADO',
    'ACTUALIZADO',
    'DESACTIVADO',
    'ACTIVADO'
);

CREATE TABLE "operaciones_clientes" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo" "TipoOperacionCliente" NOT NULL,
    "detalle" VARCHAR(500) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_clientes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operaciones_clientes_cliente_id_creada_en_idx"
    ON "operaciones_clientes"("cliente_id", "creada_en");
CREATE INDEX "operaciones_clientes_usuario_id_idx"
    ON "operaciones_clientes"("usuario_id");

ALTER TABLE "operaciones_clientes"
    ADD CONSTRAINT "operaciones_clientes_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operaciones_clientes"
    ADD CONSTRAINT "operaciones_clientes_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
