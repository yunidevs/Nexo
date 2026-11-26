# Arquitectura de NexoERP

NexoERP es un monolito modular: un único repositorio npm workspaces con dos
aplicaciones que comparten el contrato implícito de la API REST.

```
apps/
  backend/    API Express 5 + Prisma 6 + PostgreSQL (TypeScript, ESM)
  frontend/   Next.js 16 App Router + Tailwind CSS 4 (TypeScript)
docs/         Documentación del proyecto
```

## Backend (`apps/backend`)

Capas por módulo en `src/modules/<dominio>/`:

- `routes/` — definición de endpoints Express y validación Zod de entrada.
- `controllers/` — traducción HTTP ↔ servicio (status codes, envelope).
- `services/` (o `*.service.ts`) — lógica de negocio y acceso a datos vía Prisma.
- `middleware/` — autenticación JWT en cookie, rate limiting, manejo de errores.
- `app.ts` — composición: `createApp(config, ...dependencias)` con inyección
  para tests; monta rutas y middleware globales (helmet, cors, cookies).
- `server.ts` — entrypoint HTTP.
- `worker.ts` — entrypoint de tareas programadas (ver `operacion.md`).

### Convenciones de API

Toda respuesta usa el mismo envelope:

```json
{ "exito": true, "datos": { }, "mensaje": "opcional" }
{ "exito": false, "error": { "codigo": "...", "mensaje": "..." } }
```

- Autenticación ERP: cookie HttpOnly `nexo_token` con JWT (`Usuario`, roles
  ADMIN/VENDEDOR/ALMACENERO).
- Autenticación de comprador del marketplace: cookie `nexo_cliente` con JWT
  propio (`tipo: "cliente"`), cuenta global `CuentaCliente`.
- Multi-tenancy: todo dato de negocio lleva `empresaId`; los servicios lo
  filtran siempre. Nunca confiar en ids sin empresa.

### Estado actual y dirección

- Pagos: PayPal Orders API con verificación de firma en webhooks e
  idempotencia por `paypalCaptureId`.
- Marketplace: checkout con reserva de stock (`stockReservado`), pedidos
  multi-estado con `SeguimientoPedido`, comisión configurable.
- Tareas programadas: `worker.ts` (pedidos vencidos cada 60 s). El barrido
  perezoso dentro de requests se mantiene como fallback.
- Cache/opcional: `src/lib/redis.ts`, cliente RESP mínimo sin dependencias,
  activo solo con `REDIS_URL`.

## Frontend (`apps/frontend`)

Next.js 16 App Router, React 19, Tailwind v4, componentes mayormente
`"use client"` con estado local. Páginas públicas del marketplace
(`app/marketplace/*`), zona de comprador (`app/cuenta/*`), panel ERP
(`app/(workspace)/*` aprox.) y landing (`app/page.tsx`).

## Infraestructura (sin contenedores)

- PostgreSQL local o Supabase vía `DATABASE_URL` (ver `operacion.md`).
- Redis opcional vía `REDIS_URL`.
- CI: `.github/workflows/ci.yml` (typecheck, lint, tests, build).
- Despliegue: procesos Node nativos (PM2, systemd, Task Scheduler, etc.).
