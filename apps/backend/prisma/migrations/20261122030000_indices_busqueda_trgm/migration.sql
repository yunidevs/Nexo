-- Índices trigram (pg_trgm) para acelerar las búsquedas ILIKE '%texto%'
-- del ERP y del catálogo público del marketplace.
--
-- Son índices NO administrados por Prisma: schema.prisma no puede declarar
-- índices GIN/trgm. `prisma migrate deploy` los aplica normalmente; si
-- `prisma migrate dev` reporta drift por ellos, resolver con
-- `prisma migrate resolve` en lugar de eliminarlos.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- clientes: nombre, apellido, documento, correo, telefono
CREATE INDEX IF NOT EXISTS "idx_trgm_clientes_nombre"
    ON "clientes" USING gin ("nombre" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_clientes_apellido"
    ON "clientes" USING gin ("apellido" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_clientes_documento"
    ON "clientes" USING gin ("documento" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_clientes_correo"
    ON "clientes" USING gin ("correo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_clientes_telefono"
    ON "clientes" USING gin ("telefono" gin_trgm_ops);

-- productos: sku, nombre, categoria
CREATE INDEX IF NOT EXISTS "idx_trgm_productos_sku"
    ON "productos" USING gin ("sku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_productos_nombre"
    ON "productos" USING gin ("nombre" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_productos_categoria"
    ON "productos" USING gin ("categoria" gin_trgm_ops);

-- proveedores: nombre, documento, correo, telefono
CREATE INDEX IF NOT EXISTS "idx_trgm_proveedores_nombre"
    ON "proveedores" USING gin ("nombre" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_proveedores_documento"
    ON "proveedores" USING gin ("documento" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_proveedores_correo"
    ON "proveedores" USING gin ("correo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_proveedores_telefono"
    ON "proveedores" USING gin ("telefono" gin_trgm_ops);

-- categorias: nombre, descripcion
CREATE INDEX IF NOT EXISTS "idx_trgm_categorias_nombre"
    ON "categorias" USING gin ("nombre" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_categorias_descripcion"
    ON "categorias" USING gin ("descripcion" gin_trgm_ops);

-- usuarios: nombre, apellido, correo
CREATE INDEX IF NOT EXISTS "idx_trgm_usuarios_nombre"
    ON "usuarios" USING gin ("nombre" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_usuarios_apellido"
    ON "usuarios" USING gin ("apellido" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_trgm_usuarios_correo"
    ON "usuarios" USING gin ("correo" gin_trgm_ops);

-- empresas: nombre (búsqueda de empresa dentro del catálogo público)
CREATE INDEX IF NOT EXISTS "idx_trgm_empresas_nombre"
    ON "empresas" USING gin ("nombre" gin_trgm_ops);
