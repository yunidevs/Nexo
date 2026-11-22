-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "cuenta_cliente_id" UUID;

-- AlterTable
ALTER TABLE "pedidos_marketplace" ADD COLUMN     "cuenta_cliente_id" UUID;

-- CreateTable
CREATE TABLE "cuentas_clientes" (
    "id" UUID NOT NULL,
    "correo" VARCHAR(254) NOT NULL,
    "correo_normalizado" VARCHAR(254) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "apellido" VARCHAR(80),
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "telefono" VARCHAR(40),
    "telefono_normalizado" VARCHAR(20),
    "direccion" VARCHAR(600),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_recuperacion_cuenta_cliente" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_cuenta_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_clientes_correo_key" ON "cuentas_clientes"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_clientes_correo_normalizado_key" ON "cuentas_clientes"("correo_normalizado");

-- CreateIndex
CREATE INDEX "cuentas_clientes_correo_normalizado_idx" ON "cuentas_clientes"("correo_normalizado");

-- CreateIndex
CREATE INDEX "cuentas_clientes_telefono_normalizado_idx" ON "cuentas_clientes"("telefono_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacion_cuenta_cliente_cuenta_id_key" ON "tokens_recuperacion_cuenta_cliente"("cuenta_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacion_cuenta_cliente_token_hash_key" ON "tokens_recuperacion_cuenta_cliente"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_recuperacion_cuenta_cliente_expira_en_idx" ON "tokens_recuperacion_cuenta_cliente"("expira_en");

-- CreateIndex
CREATE INDEX "clientes_cuenta_cliente_id_idx" ON "clientes"("cuenta_cliente_id");

-- CreateIndex
CREATE INDEX "pedidos_marketplace_cuenta_cliente_id_creada_en_idx" ON "pedidos_marketplace"("cuenta_cliente_id", "creada_en");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_cuenta_cliente_id_fkey" FOREIGN KEY ("cuenta_cliente_id") REFERENCES "cuentas_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_recuperacion_cuenta_cliente" ADD CONSTRAINT "tokens_recuperacion_cuenta_cliente_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_marketplace" ADD CONSTRAINT "pedidos_marketplace_cuenta_cliente_id_fkey" FOREIGN KEY ("cuenta_cliente_id") REFERENCES "cuentas_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
