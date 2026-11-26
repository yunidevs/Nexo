# Operación de NexoERP

Guía de ejecución local y producción **sin contenedores**: procesos Node
nativos + PostgreSQL + Redis opcional.

## Requisitos

- Node.js 22+
- npm (workspaces)
- PostgreSQL 14+ (local, Supabase u otro)
- Redis 6+ (opcional; solo para cache/sesiones/rate-limit distribuido)

## Desarrollo

```bash
npm install
cp apps/backend/.env.example apps/backend/.env   # ajustar valores
npm run db:migrate --workspace servidor
npm run dev:web    # frontend en http://localhost:3000
npm run dev:api    # backend en http://localhost:4000
```

`docker-compose.yml` solo levanta PostgreSQL de desarrollo si se desea
(`docker compose up db`); el resto de la pila no requiere Docker.

## Procesos

| Proceso | Comando | Puerto |
| --- | --- | --- |
| API HTTP | `npm run dev --workspace servidor` / `npm start --workspace servidor` | 4000 |
| Web | `npm run dev --workspace web` / `npm run build` + `npm start --workspace web` | 3000 |
| Worker | `npm run worker --workspace servidor` / `npm run start:worker --workspace servidor` | — |

El **worker** (`apps/backend/src/worker.ts`) ejecuta tareas programadas en
un proceso separado: hoy libera pedidos de marketplace vencidos cada 60 s
usando el mismo `MarketplaceService` que la API (sin duplicar reglas).
Con `REDIS_URL` activo además consume la cola BullMQ `emails` (correos
transaccionales con reintentos, fuera del request HTTP); si Redis está
configurado pero no responde, el worker omite la cola y los correos se
envían por SMTP síncrono desde el API. En producción se agenda con el
scheduler del SO (cron, systemd timer, Task Scheduler) o PM2. Mientras el
worker no esté corriendo, los endpoints de checkout/estado siguen
liberando pedidos vencidos de forma perezosa como fallback.

## Health checks

- `GET /api/salud` — **liveness**: el proceso responde. No toca dependencias.
- `GET /api/listo` — **readiness**: ejecuta `SELECT 1` en PostgreSQL y hace
  `PING` a Redis si `REDIS_URL` está definida. Devuelve 503 si la base de
  datos no responde. Los balanceadores deben usar esta ruta.

## Redis (opcional)

Configurar `REDIS_URL=redis://host:6379` en `apps/backend/.env`.

`src/lib/redis.ts` es un cliente RESP mínimo sin dependencias (`GET`,
`SET ... EX`, `DEL`, `PING`) que se activa solo con `REDIS_URL`. Si Redis no
está configurado o no responde, la API sigue funcionando con sus fallbacks
en memoria — Redis nunca es una dependencia dura.

Usos ya implementados (activos solo con `REDIS_URL`; sin Redis cae a
memoria/local como antes):

- `sesion:{userId}:{empresaId}` — caché de validación de sesión (TTL 5 min,
  invalidada al cambiar rol/estado de usuario).
- `rl:{clave}` — rate limiting distribuido con INCR + PEXPIRE en auth,
  cuenta de clientes y consultas públicas de pedidos.
- `dash:resumen:{empresaId}` (30 s) y `dash:stats:{empresaId}:{periodo}:{fecha}`
  (5 min) — caché del dashboard.
- `catalogo:{filtros}` — caché del catálogo público (60 s).
- Cola BullMQ `emails` — correos transaccionales (recuperación de
  contraseña ERP y de cuenta de comprador) procesados por el worker con
  3 reintentos exponenciales. Sin Redis o si la cola falla, envío SMTP
  síncrono como antes.

Usos previstos (siguientes fases):

- `idem:{clave}` — idempotencia de checkout/webhooks.
- `lock:pedido:{id}` — locks distribuidos.
- Invalidación por tags del caché de catálogo al editar productos.

Si se requiere pub/sub o colas completas, reemplazar el cliente interno por
`ioredis`/`BullMQ` sin cambiar la API pública del módulo.

## Base de datos

- Migraciones: `npm run db:migrate --workspace servidor` (dev) /
  `npm run db:deploy --workspace servidor` (prod).
- La migración `20261122030000_indices_busqueda_trgm` crea índices GIN con
  `pg_trgm` para las búsquedas `ILIKE '%texto%'`. Son índices no
  administrados por Prisma (no declarables en `schema.prisma`): si
  `migrate dev` reporta drift, resolver con `migrate resolve`, no borrarlos.

## Variables de entorno relevantes

Ver `apps/backend/src/config.ts` (validación Zod). Además de las existentes:

- `REDIS_URL` — opcional, activa el cliente Redis.
- `PORT` — puerto del API (default 4000).

## CI

`.github/workflows/ci.yml` corre en push/PR a `main`:

- Backend: `npm ci`, `prisma generate`, `tsc --noEmit`, `npm test`.
- Frontend: `npm ci`, `tsc --noEmit`, `eslint`, `next build`.

No usa Docker ni servicios externos; los tests usan dobles de servicio.

## Build y despliegue

```bash
npm run build                 # prisma generate + tsc backend + next build
npm start --workspace servidor   # node dist/server.js
npm start --workspace web        # next start
npm run start:worker --workspace servidor
```

Recomendado en producción: PM2/systemd para API + worker, `DATABASE_URL`
apuntando a Supabase con pooler o `connection_limit` ajustado, y HTTPS con
cookies `secure` (el JWT ya usa `sameSite` según entorno).
