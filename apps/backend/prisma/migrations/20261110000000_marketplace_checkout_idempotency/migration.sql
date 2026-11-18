ALTER TABLE "pedidos_marketplace"
    ADD COLUMN "dlocal_go_redirect_url" VARCHAR(2048),
    ADD COLUMN "idempotency_key" VARCHAR(100),
    ADD COLUMN "idempotency_request_hash" CHAR(64);

CREATE UNIQUE INDEX "pedidos_marketplace_idempotency_key_key"
    ON "pedidos_marketplace"("idempotency_key");
