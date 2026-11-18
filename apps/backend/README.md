# API NexoERP

## Requisitos

- Node.js 20 o superior.
- npm.

## Configuración

Desde `apps/backend`, copia `.env.example` a `.env`. Sustituye
`TU_PASSWORD_SUPABASE` por la contraseña de la base de datos y establece
`JWT_ACCESS_SECRET` con un valor aleatorio de al menos 32 caracteres. Si la
contraseña contiene caracteres especiales, codifícala para URL (por ejemplo,
`@` como `%40`). No compartas ni subas el archivo `.env`.
Para probar la recuperación mediante el Sandbox de Mailtrap, configura
`MAILTRAP_SMTP_USER` y `MAILTRAP_SMTP_PASS` con las credenciales SMTP del
Sandbox. `MAILTRAP_SMTP_HOST` y `MAILTRAP_SMTP_PORT` son opcionales (por
defecto `sandbox.smtp.mailtrap.io` y `2525`); también debes configurar
`MAILTRAP_FROM_EMAIL`. `MAILTRAP_FROM_NAME` y `FRONTEND_URL` son opcionales
(por defecto `NexoERP` y `http://localhost:3000`). El Sandbox captura los
mensajes en su bandeja de pruebas: no los entrega a la dirección real del
destinatario.
En producción, `JWT_ACCESS_SECRET` es obligatorio y no se usa el valor
predeterminado local.

```bash
npm --workspace servidor run db:generate
npm --workspace servidor run db:deploy
npm run dev:api
npm run dev:web
```

La conexión usa el host `db.hylozwndjpbkptoyvelo.supabase.co`, el puerto `5432`,
la base `postgres`, el usuario `postgres` y SSL obligatorio. Prisma utiliza
`DATABASE_URL`. La API escucha por defecto en `http://localhost:4000` y el
frontend en `http://localhost:3000`.

## Estructura del backend

- `prisma/`: esquema y migraciones de la base de datos.
- `src/routes/`: definición y montaje de las rutas HTTP.
- `src/controllers/`: validación de solicitudes y respuestas HTTP.
- `src/modules/`: lógica de negocio y acceso a datos por módulo.
- `src/middleware/`: autenticación y manejo de errores compartidos.
- `src/app.ts`: configuración de Express; `src/server.ts`: arranque y cierre.

## Rutas disponibles

- `GET /` mantiene la respuesta inicial del servidor.
- `GET /api/salud` comprueba que la API esté operativa.
- `POST /api/autenticacion/registro` crea una empresa y su administrador.
- `POST /api/autenticacion/iniciar-sesion` inicia una sesión.
- `POST /api/autenticacion/solicitar-recuperacion` envía un enlace de
  recuperación cuando el correo pertenece a una cuenta activa.
- `POST /api/autenticacion/restablecer-contrasena` consume el enlace y actualiza
  la contraseña.
- `GET /api/autenticacion/perfil` devuelve el perfil autenticado.
- `POST /api/autenticacion/cerrar-sesion` cierra la sesión del navegador.
- `GET /api/empresa` devuelve la información de la empresa autenticada y el
  número de usuarios que pertenecen a ella.
- `PATCH /api/empresa` permite a un administrador actualizar el nombre y el
  sitio web comercial de su empresa. El sitio web debe usar HTTP o HTTPS.
- `/api/clientes` ofrece listar, filtrar, paginar, crear, editar y
  activar/desactivar clientes. Solo está disponible para administradores y
  vendedores, y todas las consultas se limitan a la empresa del token.
- `/api/productos` ofrece listar, filtrar, paginar, crear, consultar, editar y
  activar/desactivar productos. Incluye SKU, precio de venta, costo, stock
  mínimo, categoría e imagen por URL; los SKU son únicos por empresa. Está
  disponible para administradores, vendedores y almaceneros, y todas las
  consultas se limitan a la empresa del token.
- `/api/inventario/productos` lista existencias y permite filtrar productos
  bajo el stock mínimo; `/api/inventario/movimientos` consulta el historial y
  registra entradas, salidas, ajustes y devoluciones. Cada movimiento conserva
  cantidad, motivo, usuario y existencias antes/después. Las salidas no pueden
  dejar existencias negativas y las actualizaciones de stock se registran en
  una transacción.
- `/api/compras` permite registrar y consultar compras; `POST
  /api/compras/:id/pagos` registra pagos parciales al proveedor con los métodos
  efectivo, tarjeta, transferencia u otros. No se puede abonar más que el saldo
  pendiente.
- `/api/ventas` permite registrar y consultar ventas; `POST
  /api/ventas/:id/pagos` registra pagos parciales de clientes con los mismos
  métodos y valida el saldo pendiente. `POST /api/ventas/:id/cancelar` cancela
  una venta confirmada y registra la devolución de existencias; las ventas
  canceladas no admiten pagos ni se incluyen en los totales del dashboard.
- `/api/usuarios` permite a los administradores listar, crear, consultar,
  modificar, activar/desactivar usuarios y asignarles un rol. Las cuentas
  pertenecen siempre a la empresa del administrador autenticado y cada empresa
  debe conservar al menos un administrador activo.

Los roles disponibles son administrador (gestiona usuarios y clientes),
vendedor (gestiona clientes y productos) y almacenero (gestiona productos).
Los cambios de rol se aplican también a las sesiones existentes.

La sesión utiliza una cookie JWT `HttpOnly`, `SameSite=Lax`, con vencimiento de
8 horas. Las cuentas desactivadas pierden acceso inmediatamente, incluso con
un token vigente. El registro y el inicio de sesión permiten hasta 10 intentos
por dirección IP en cada endpoint, cada 15 minutos. Los errores utilizan el
formato `{ exito: false, error: { codigo, mensaje } }`. Las peticiones HTTP
se registran sin cuerpos, credenciales ni tokens.
Los enlaces de recuperación vencen en una hora, solo se puede usar el enlace
más reciente y la base de datos conserva únicamente el hash del token.

Los reportes todavía no están implementados.

## Crear el primer usuario

1. Configura `apps/backend/.env` con la URL y contraseña de Supabase y un
   secreto JWT local.
2. Desde la raíz del proyecto, genera Prisma y aplica las migraciones:
   `npm --workspace servidor run db:generate` y
   `npm --workspace servidor run db:deploy`.
3. Inicia backend y frontend en terminales separadas con `npm run dev:api` y
   `npm run dev:web`.
4. Abre `http://localhost:3000/auth/register` y completa el formulario. El
   registro crea una empresa y su primer usuario, con rol de administrador.

El registro también está disponible en
`POST http://localhost:4000/api/autenticacion/registro` con los campos
`nombreEmpresa`, `nombre`, `apellido`, `correo` y `contrasena`.

## Verificación

```bash
npm test
npm run build
```
