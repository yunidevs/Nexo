CREATE TYPE "TipoOperacionProveedor" AS ENUM (
    'CREADO',
    'ACTUALIZADO',
    'DESACTIVADO',
    'ACTIVADO',
    'COMPRA_REGISTRADA'
);

CREATE TABLE "proveedores" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "documento" VARCHAR(40),
    "telefono" VARCHAR(40),
    "correo" VARCHAR(254),
    "direccion" VARCHAR(300),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operaciones_proveedores" (
    "id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo" "TipoOperacionProveedor" NOT NULL,
    "detalle" VARCHAR(500) NOT NULL,
    "fecha_compra" TIMESTAMP(3),
    "total" DECIMAL(12,2),
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_proveedores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proveedores_empresa_id_creada_en_idx"
    ON "proveedores"("empresa_id", "creada_en");
CREATE INDEX "proveedores_empresa_id_activo_idx"
    ON "proveedores"("empresa_id", "activo");
CREATE INDEX "operaciones_proveedores_proveedor_id_creada_en_idx"
    ON "operaciones_proveedores"("proveedor_id", "creada_en");
CREATE INDEX "operaciones_proveedores_usuario_id_idx"
    ON "operaciones_proveedores"("usuario_id");

ALTER TABLE "proveedores"
    ADD CONSTRAINT "proveedores_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operaciones_proveedores"
    ADD CONSTRAINT "operaciones_proveedores_proveedor_id_fkey"
    FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operaciones_proveedores"
    ADD CONSTRAINT "operaciones_proveedores_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
