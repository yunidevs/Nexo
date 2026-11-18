CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(300),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "categorias_empresa_id_creada_en_idx"
    ON "categorias"("empresa_id", "creada_en");
CREATE INDEX "categorias_empresa_id_activo_idx"
    ON "categorias"("empresa_id", "activo");

ALTER TABLE "categorias"
    ADD CONSTRAINT "categorias_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
