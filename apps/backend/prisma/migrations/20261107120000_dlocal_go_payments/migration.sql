ALTER TYPE "MetodoPago" ADD VALUE 'DLOCAL_GO';

ALTER TABLE "pedidos_marketplace"
    ADD COLUMN "dlocal_go_payment_id" VARCHAR(100),
    ADD COLUMN "dlocal_go_refund_id" VARCHAR(100);

CREATE UNIQUE INDEX "pedidos_marketplace_dlocal_go_payment_id_key"
    ON "pedidos_marketplace"("dlocal_go_payment_id");
CREATE UNIQUE INDEX "pedidos_marketplace_dlocal_go_refund_id_key"
    ON "pedidos_marketplace"("dlocal_go_refund_id");
