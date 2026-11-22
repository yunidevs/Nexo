-- Historial de seguimiento de pedidos del marketplace.
-- Aditiva: amplía el enum de estados (conserva ENVIADO para pedidos
-- históricos) y crea la tabla de eventos sin borrar datos existentes.

ALTER TYPE "EstadoPedidoMarketplace" ADD VALUE IF NOT EXISTS 'PAGO_RECHAZADO';
ALTER TYPE "EstadoPedidoMarketplace" ADD VALUE IF NOT EXISTS 'DESPACHADO';
ALTER TYPE "EstadoPedidoMarketplace" ADD VALUE IF NOT EXISTS 'EN_TRANSITO';
ALTER TYPE "EstadoPedidoMarketplace" ADD VALUE IF NOT EXISTS 'EN_REPARTO';
ALTER TYPE "EstadoPedidoMarketplace" ADD VALUE IF NOT EXISTS 'INCIDENCIA';
ALTER TYPE "EstadoPedidoMarketplace" ADD VALUE IF NOT EXISTS 'ENTREGA_FALLIDA';
ALTER TYPE "EstadoPedidoMarketplace" ADD VALUE IF NOT EXISTS 'DEVUELTO';

CREATE TABLE IF NOT EXISTS "seguimiento_pedidos" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "estado" "EstadoPedidoMarketplace" NOT NULL,
    "detalle" VARCHAR(500) NOT NULL,
    "observaciones" VARCHAR(1000),
    "usuario_id" UUID,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguimiento_pedidos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seguimiento_pedidos_pedido_id_creada_en_idx"
    ON "seguimiento_pedidos"("pedido_id", "creada_en");
CREATE INDEX IF NOT EXISTS "seguimiento_pedidos_usuario_id_idx"
    ON "seguimiento_pedidos"("usuario_id");

ALTER TABLE "seguimiento_pedidos"
    ADD CONSTRAINT "seguimiento_pedidos_pedido_id_fkey"
    FOREIGN KEY ("pedido_id") REFERENCES "pedidos_marketplace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seguimiento_pedidos"
    ADD CONSTRAINT "seguimiento_pedidos_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Punto de partida para los pedidos que ya existían: un único evento con su
-- estado actual. No se inventan transiciones intermedias.
INSERT INTO "seguimiento_pedidos" (
    "id",
    "pedido_id",
    "estado",
    "detalle",
    "creada_en"
)
SELECT
    gen_random_uuid(),
    pedido."id",
    pedido."estado",
    'Estado registrado antes de habilitar el historial de seguimiento.',
    pedido."actualizada_en"
FROM "pedidos_marketplace" AS pedido
WHERE NOT EXISTS (
    SELECT 1
    FROM "seguimiento_pedidos" AS evento
    WHERE evento."pedido_id" = pedido."id"
);
