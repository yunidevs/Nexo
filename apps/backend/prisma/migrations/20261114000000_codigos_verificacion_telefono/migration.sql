-- CreateTable
CREATE TABLE "codigos_verificacion_telefono" (
    "id" UUID NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "codigo_hash" CHAR(64) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "verificado_en" TIMESTAMP(3),
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_verificacion_telefono_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigos_verificacion_telefono_telefono_creada_en_idx"
    ON "codigos_verificacion_telefono"("telefono", "creada_en");

-- CreateIndex
CREATE INDEX "codigos_verificacion_telefono_telefono_verificado_en_idx"
    ON "codigos_verificacion_telefono"("telefono", "verificado_en");
