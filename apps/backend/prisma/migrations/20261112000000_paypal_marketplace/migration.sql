ALTER TYPE "MetodoPago" ADD VALUE 'PAYPAL';

ALTER TABLE "pedidos_marketplace"
    RENAME COLUMN "dlocal_go_payment_id" TO "paypal_order_id";

ALTER TABLE "pedidos_marketplace"
    RENAME COLUMN "dlocal_go_redirect_url" TO "paypal_redirect_url";

ALTER TABLE "pedidos_marketplace"
    RENAME COLUMN "dlocal_go_refund_id" TO "paypal_refund_id";

ALTER INDEX "pedidos_marketplace_dlocal_go_payment_id_key"
    RENAME TO "pedidos_marketplace_paypal_order_id_key";

ALTER INDEX "pedidos_marketplace_dlocal_go_refund_id_key"
    RENAME TO "pedidos_marketplace_paypal_refund_id_key";

ALTER TABLE "pedidos_marketplace"
    ADD COLUMN "paypal_capture_id" VARCHAR(100),
    ADD COLUMN "paypal_amount" DECIMAL(12,2),
    ADD COLUMN "paypal_currency" VARCHAR(3);

CREATE UNIQUE INDEX "pedidos_marketplace_paypal_capture_id_key"
    ON "pedidos_marketplace"("paypal_capture_id");

CREATE TYPE "EstadoEventoWebhookPayPal" AS ENUM (
    'PROCESANDO',
    'PROCESADO',
    'IGNORADO'
);

CREATE TABLE "paypal_webhook_events" (
    "id" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(100) NOT NULL,
    "estado" "EstadoEventoWebhookPayPal" NOT NULL DEFAULT 'PROCESANDO',
    "pedido_id" UUID,
    "recibido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado_en" TIMESTAMP(3),

    CONSTRAINT "paypal_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "paypal_webhook_events_estado_recibido_en_idx"
    ON "paypal_webhook_events"("estado", "recibido_en");
