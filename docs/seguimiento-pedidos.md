# Seguimiento de pedidos

## Modelo

- `PedidoMarketplace`: pedido multi-empresa con `estado`
  (`EstadoPedidoMarketplace`), `expiraEn` (reservas de stock pendientes de
  pago), `paypalCaptureId` para idempotencia y `cuentaClienteId` opcional.
- `SeguimientoPedido`: historial inmutable de eventos por pedido
  (`estado`, `detalle`, `observaciones`, `usuarioId`). Cada transición
  relevante inserta un evento; el detalle del pedido devuelve la línea de
  tiempo ordenada.

## Estados

`PENDIENTE_PAGO` → `PAGO_CONFIRMADO` → `PREPARANDO` → `DESPACHADO` /
`ENVIADO` / `EN_TRANSITO` / `EN_REPARTO` → `ENTREGADO`; salidas:
`CANCELADO`, `REEMBOLSO_PENDIENTE` → `REEMBOLSADO`.

## Consulta pública

- Token firmado (`generarTokenSeguimiento`) que viaja como `?t=` — no
  expone ids predecibles.
- Página `/marketplace/seguimiento/[id]` (stepper + timeline) y alias
  `/seguimiento-pedido` (número + token).
- Polling cada 15 s solo con la pestaña visible; se detiene en estados
  finales (`ENTREGADO`, `CANCELADO`, `REEMBOLSADO`).
- Rate limit en consultas públicas de pedido/seguimiento.

## Administración

- `GET /api/marketplace/pedidos` — lista de pedidos de la empresa.
- `PATCH /api/marketplace/pedidos/:id/estado` — transición manual con
  registro de evento y observaciones.
- `POST /api/marketplace/pedidos/:id/reembolso` — reembolso PayPal con
  verificación de importe/moneda e idempotencia por `paypalRefundId`.

## Liberación de reservas

- Worker (`src/worker.ts`, tarea `pedidos-vencidos`, cada 60 s) cancela
  pedidos `PENDIENTE_PAGO` vencidos y libera `stockReservado`.
- Fallback perezoso: `liberarPedidosVencidos()` sigue invocándose en los
  endpoints de checkout/estado mientras el worker no esté desplegado.
