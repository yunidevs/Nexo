# Dashboard analítico

## Datos

`GET /api/dashboard/resumen` (y variantes por período) agrega en SQL sobre
los datos reales de la empresa:

- Ventas del día/semana/mes y comparativo con período anterior.
- Pedidos de marketplace por estado.
- Stock crítico y valor de inventario.
- series diarias para gráficos.

Aislamiento por `empresaId` en todas las consultas; zona horaria configurable
con `DASHBOARD_TIMEZONE` (default `America/Montevideo`).

## Rendimiento

- Las agregaciones corren en paralelo server-side (`dashboard.service.ts`).
- `Cache-Control: max-age=30` cachea en el navegador.
- **Pendiente (plan de escalado)**: caché server-side en Redis
  (`dash:resumen:{empresaId}`, TTL 30 s; `dash:stats:{empresaId}:{periodo}`,
  TTL 5 min) y tabla de rollup diario para histórico.

## Frontend

`app/(workspace)/dashboard` consume el endpoint y renderiza KPIs + gráficos
con la paleta y componentes existentes. Períodos diario/semanal/mensual con
comparativo porcentual.
