# Clientes

## Dos conceptos distintos

| Concepto | Modelo | Alcance | Acceso |
| --- | --- | --- | --- |
| Cliente comercial | `Cliente` | Por empresa (`empresaId`) | Solo ERP |
| Cuenta de comprador | `CuentaCliente` | Global (marketplace) | Login propio |

`Cliente` es el directorio comercial de cada empresa: se crea desde el ERP o
automáticamente al confirmar un pago del marketplace (`origen: MARKETPLACE`).
No tiene credenciales.

`CuentaCliente` es la identidad global del comprador en el marketplace:
correo único, nombre, hash bcrypt, teléfono opcional. Es independiente de
cualquier empresa y puede comprar en varias tiendas.

## Vinculación

- `Cliente.cuentaClienteId` (nullable): vincula el cliente comercial con la
  cuenta global cuando se conoce.
- `PedidoMarketplace.cuentaClienteId` (nullable): propiedad directa del
  pedido; se asigna en el checkout si hay sesión de comprador y al capturar
  el pago si el `Cliente` generado coincide.
- `POST /api/cuenta-clientes/vincular-historial`: tras login, vincula
  pedidos y `Cliente` cuyo correo verificado coincida con la cuenta.

## Autenticación

- Cookie `nexo_cliente` HttpOnly con JWT `tipo: "cliente"` (firma con
  `JWT_ACCESS_SECRET`). Middleware `auth-cliente.middleware.ts` con variante
  estricta y **opcional** para el checkout.
- Rate limit (10 req/15 min) en registro, login y recuperación.
- Recuperación de contraseña por correo (Mailtrap) con token hasheado en
  `TokenRecuperacionCuentaCliente`.

## Checkout dual

`POST /api/marketplace/checkout` acepta sesión opcional de cliente:

- Con sesión: el pedido guarda `cuentaClienteId` y el formulario del
  frontend precarga nombre/correo/teléfono.
- Sin sesión (invitado): flujo idéntico al original; los pedidos se vinculan
  después por correo verificado.

## Endpoints (`/api/cuenta-clientes`)

- `POST /registro`, `POST /login`, `POST /logout`
- `POST /recuperar`, `POST /restablecer`
- `GET /perfil`, `PUT /perfil`
- `GET /pedidos`, `GET /pedidos/:id` (con línea de tiempo)
- `POST /vincular-historial`
