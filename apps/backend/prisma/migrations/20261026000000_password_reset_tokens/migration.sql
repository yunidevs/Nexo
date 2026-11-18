CREATE TABLE "tokens_recuperacion_contrasena" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_contrasena_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_recuperacion_contrasena_usuario_id_key"
ON "tokens_recuperacion_contrasena"("usuario_id");

CREATE UNIQUE INDEX "tokens_recuperacion_contrasena_token_hash_key"
ON "tokens_recuperacion_contrasena"("token_hash");

CREATE INDEX "tokens_recuperacion_contrasena_expira_en_idx"
ON "tokens_recuperacion_contrasena"("expira_en");

ALTER TABLE "tokens_recuperacion_contrasena"
ADD CONSTRAINT "tokens_recuperacion_contrasena_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
