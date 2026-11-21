-- Identidad de clientes y vínculo con el pedido. Aditiva: no borra columnas ni datos.
-- El índice de correo NO es único: los duplicados históricos se detectan y no se fusionan.

CREATE TYPE "OrigenCliente" AS ENUM ('MANUAL', 'MARKETPLACE');

ALTER TABLE "clientes"
    ALTER COLUMN "nombre" SET DATA TYPE VARCHAR(160),
    ALTER COLUMN "direccion" SET DATA TYPE VARCHAR(600);

ALTER TABLE "clientes"
    ADD COLUMN "correo_normalizado" VARCHAR(254),
    ADD COLUMN "telefono_normalizado" VARCHAR(20),
    ADD COLUMN "origen" "OrigenCliente" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "posible_duplicado" BOOLEAN NOT NULL DEFAULT false;

UPDATE "clientes"
SET "correo_normalizado" = lower(btrim("correo"))
WHERE "correo" IS NOT NULL
  AND btrim("correo") <> '';

UPDATE "clientes" AS cliente
SET "telefono_normalizado" = normalizado.valor
FROM (
    SELECT
        "id",
        CASE
            WHEN limpio ~ '^\d{7,20}$' THEN limpio
            ELSE NULL
        END AS valor
    FROM (
        SELECT
            "id",
            regexp_replace(
                regexp_replace(
                    regexp_replace(btrim("telefono"), '[\s().-]', '', 'g'),
                    '^\+',
                    ''
                ),
                '^00',
                ''
            ) AS limpio
        FROM "clientes"
        WHERE "telefono" IS NOT NULL
          AND btrim("telefono") <> ''
    ) AS digitos
) AS normalizado
WHERE cliente."id" = normalizado."id";

CREATE INDEX "clientes_empresa_id_correo_normalizado_idx"
    ON "clientes" ("empresa_id", "correo_normalizado");

CREATE INDEX "clientes_empresa_id_telefono_normalizado_idx"
    ON "clientes" ("empresa_id", "telefono_normalizado");

ALTER TABLE "pedidos_marketplace"
    ADD COLUMN "cliente_id" UUID;

ALTER TABLE "pedidos_marketplace"
    ADD CONSTRAINT "pedidos_marketplace_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "pedidos_marketplace_cliente_id_creada_en_idx"
    ON "pedidos_marketplace" ("cliente_id", "creada_en");
