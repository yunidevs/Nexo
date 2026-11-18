# NexoERP

Plataforma de gestión empresarial en desarrollo. El MVP actual ofrece registro
de empresas, configuración de información comercial, gestión de usuarios y
clientes con datos aislados por empresa. Usa Next.js, Express, TypeScript,
PostgreSQL y Prisma.

## Requisitos

- Node.js 20 o superior.
- npm.
- Una base de datos PostgreSQL en Supabase.

## Puesta en marcha

1. Copia `apps/backend/.env.example` a `apps/backend/.env`. Reemplaza
   `TU_PASSWORD` con la contraseña de la base de datos y establece
   `JWT_ACCESS_SECRET` con un secreto aleatorio de al menos 32 caracteres.
   Codifica para URL cualquier carácter especial de la contraseña y no
   compartas ni subas el archivo `.env`.
2. Desde la raíz, instala las dependencias y prepara la base:

```bash
npm install
npm --workspace servidor run db:generate
npm --workspace servidor run db:deploy
```

La conexión se realiza por SSL al host `db.hylozwndjpbkptoyvelo.supabase.co`,
puerto `5432`, base `postgres` y usuario `postgres`.

3. Inicia backend y frontend en terminales separadas:
```bash
npm run dev:api
npm run dev:web
```

La interfaz estará en `http://localhost:3000` y la API en
`http://localhost:4000`. El primer registro crea una empresa y su cuenta de
administrador. Desde el dashboard se puede gestionar el directorio de clientes.
Para crear ese primer usuario, abre `http://localhost:3000/auth/register` y
completa el formulario.

## Funcionalidades del MVP

- Registro de una empresa y su administrador.
- Inicio y cierre de sesión con cookie `HttpOnly`.
- Perfil de usuario asociado a su empresa.
- Configuración del nombre y sitio web de la empresa; administración de los
  miembros y sus roles dentro de cada organización.
- Clientes: crear, consultar, buscar, paginar, editar y activar/desactivar.
- Compras: asociar un proveedor, agregar productos, registrar el total y recibir
  mercancía con actualización transaccional del inventario.
- Ventas: asociar clientes, calcular subtotal, descuento e impuesto global,
  registrar pagos parciales y descontar las existencias.
- Marketplace público opcional por empresa: publicación de productos,
  checkout de invitado con entrega local y gestión de pedidos.
- Pagos de marketplace centralizados con PayPal Orders API (servidor a
  servidor) y checkout alojado por PayPal; las liquidaciones a vendedores son
  manuales. La comisión de plataforma predeterminada es 2 % del total pagado,
  incluidos impuestos y envío. Cada checkout pertenece a una sola tienda y cada
  tienda define su tarifa fija de envío.
- Validación de datos y control de acceso por rol en la API.

Reportes y auditoría están pendientes; no están expuestos como
flujos funcionales en este MVP.

### Configurar PayPal para el marketplace

1. Copia `apps/backend/.env.example` como `apps/backend/.env` y establece en el
   backend `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`. Nunca expongas estas
   credenciales al frontend ni las subas al repositorio.
2. Usa `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com` para probar y cambia
   a `https://api-m.paypal.com` únicamente cuando la cuenta de producción esté
   habilitada. No se requiere cambiar código para alternar entre ambos entornos.
3. Crea un webhook en PayPal que apunte a una URL pública HTTPS terminada en
   `/api/marketplace/webhook` y configura `PAYPAL_WEBHOOK_ID`. El backend valida
   cada notificación con la API oficial
   `POST /v1/notifications/verify-webhook-signature`, registra el identificador
   del evento para procesarlo una sola vez y consulta/valida el pago antes de
   marcarlo como confirmado.
4. PayPal no admite `UYU`. El marketplace conserva sus importes en pesos
   uruguayos, pero cobra en `PAYPAL_CURRENCY` aplicando `PAYPAL_EXCHANGE_RATE`
   (cantidad de UYU por cada unidad de la moneda de cobro). El importe y la
   moneda cobrados se guardan en el pedido y se comparan con la captura.
5. Configura `MARKETPLACE_COMMISSION_PERCENT` si corresponde (por defecto 2,
   admite hasta dos decimales) y despliega la migración con
   `npm --workspace servidor run db:deploy`.

El comprador se redirige al checkout alojado de PayPal; al volver, el backend
captura la orden y solo entonces marca el pedido como pagado. La plataforma
recibe los pagos en su cuenta principal y los vendedores se liquidan manualmente;
la comisión y el importe del vendedor quedan registrados en el pedido, pero no se
crean transferencias ni splits. Sin credenciales de PayPal, la aplicación puede
iniciarse y el resto del ERP sigue disponible, pero no se pueden activar nuevas
tiendas ni completar pagos. Valida el flujo en sandbox antes de habilitar
credenciales de producción.

Limitaciones de pagos divididos: PayPal Orders API no reparte un pago entre
varios vendedores. Para transferir automáticamente la parte de cada vendedor se
requiere PayPal Multiparty Payments (Marketplace/Commerce Platform), que exige
dar de alta a cada vendedor como receptor, permisos OAuth por vendedor y la
aprobación de PayPal. Este proyecto no simula esas transferencias: registra la
comisión de la plataforma y deja la liquidación al vendedor como proceso manual.

## Verificación

```bash
npm test
npm run lint
npm run build
```

La sesión se entrega en una cookie `HttpOnly`; las contraseñas se almacenan
hasheadas. No uses los valores de `.env.example` fuera del entorno local.
