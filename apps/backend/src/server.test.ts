import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { EstadoVenta, Prisma, Rol } from "@prisma/client";
import { SignJWT } from "jose";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { AppError } from "./errors/app-error.js";
import type {
    DatosActualizarCliente,
    FiltrosClientes,
    ResultadoClientes,
    CustomerService,
} from "./modules/clientes/clientes.service.js";
import type {
    DatosActualizarUsuario,
    DatosCrearUsuario,
    FiltrosUsuarios,
    ResultadoUsuarios,
    UserService,
} from "./modules/usuarios/usuarios.service.js";
import type {
    CompanyService,
    DatosActualizarEmpresa,
    EmpresaPublica,
} from "./modules/empresas/empresas.service.js";
import type {
    CategoryService,
    DatosActualizarCategoria,
    DatosCrearCategoria,
    FiltrosCategorias,
    ResultadoCategorias,
} from "./modules/categorias/categorias.service.js";
import type {
    DashboardService,
    DashboardResumen,
    EstadisticasDashboard,
} from "./modules/dashboard/dashboard.service.js";
import type {
    DatosCrearVenta,
    DatosRegistrarPago,
    SalesService,
    VentaPublica,
} from "./modules/ventas/ventas.service.js";

const usuarioPrueba = {
    id: "usuario-1",
    empresaId: "empresa-1",
    nombre: "Ada",
    apellido: "Lovelace",
    correo: "ada@example.com",
    rol: "ADMINISTRADOR" as const,
};
const registros: string[] = [];
const perfilesConsultados: Array<{ id: string; empresaId: string }> = [];
const iniciosSesion: Array<{ correo: string; contrasena: string }> = [];
const solicitudesRecuperacion: string[] = [];
const restablecimientos: Array<{ token: string; contrasena: string }> = [];
let falloCorreoRecuperacion = false;
let falloInicioSesion: Error | undefined;
let sesionActiva = true;
const rolesPorSesion = new Map<string, Rol>([
    [usuarioPrueba.id, Rol.ADMINISTRADOR],
    ["usuario-vendedor", Rol.VENDEDOR],
    ["usuario-almacenero", Rol.ALMACENERO],
]);
const filtrosClientesRecibidos: FiltrosClientes[] = [];
const filtrosCategoriasRecibidos: FiltrosCategorias[] = [];
const clientesCreados: Array<{ empresaId: string; nombre: string }> = [];
const categoriasCreadas: Array<{ empresaId: string; datos: DatosCrearCategoria }> = [];
const actualizacionesClientes: Array<{
    empresaId: string;
    id: string;
    datos: DatosActualizarCliente;
}> = [];
const actualizacionesCategorias: Array<{
    empresaId: string;
    id: string;
    datos: DatosActualizarCategoria;
}> = [];
const estadosClientes: Array<{
    empresaId: string;
    id: string;
    activo: boolean;
}> = [];
const estadosCategorias: Array<{
    empresaId: string;
    id: string;
    activo: boolean;
}> = [];
const filtrosUsuariosRecibidos: FiltrosUsuarios[] = [];
const usuariosCreados: Array<{
    empresaId: string;
    datos: DatosCrearUsuario;
}> = [];
const actualizacionesUsuarios: Array<{
    empresaId: string;
    id: string;
    datos: DatosActualizarUsuario;
}> = [];
const cambiosRolUsuarios: Array<{
    empresaId: string;
    id: string;
    rol: DatosCrearUsuario["rol"];
}> = [];
const cambiosEstadoUsuarios: Array<{
    empresaId: string;
    id: string;
    activo: boolean;
}> = [];
const empresasConsultadas: string[] = [];
const actualizacionesEmpresas: Array<{
    empresaId: string;
    datos: DatosActualizarEmpresa;
}> = [];
const empresaPrueba: EmpresaPublica = {
    id: usuarioPrueba.empresaId,
    nombre: "Empresa de prueba",
    sitioWeb: "https://ejemplo.com",
    tasaImpuesto: new Prisma.Decimal(18),
    creadaEn: new Date("2026-01-01T00:00:00.000Z"),
    actualizadaEn: new Date("2026-01-01T00:00:00.000Z"),
    _count: { usuarios: 2 },
};
const servicioEmpresasPrueba: CompanyService = {
    async obtener(empresaId) {
        empresasConsultadas.push(empresaId);
        return empresaPrueba;
    },
    async actualizar(empresaId, datos) {
        actualizacionesEmpresas.push({ empresaId, datos });
        return {
            ...empresaPrueba,
            ...datos,
            tasaImpuesto: new Prisma.Decimal(datos.tasaImpuesto),
        };
    },
};
const usuarioGestionPrueba = {
    id: "c04e55bc-b7a5-47c6-824a-e9b267eeb728",
    nombre: "Grace",
    apellido: "Hopper",
    correo: "grace@example.com",
    rol: Rol.VENDEDOR,
    activo: true,
    creadaEn: new Date("2026-01-01T00:00:00.000Z"),
    actualizadaEn: new Date("2026-01-01T00:00:00.000Z"),
};
const servicioUsuariosPrueba: UserService = {
    async listar(filtros): Promise<ResultadoUsuarios> {
        filtrosUsuariosRecibidos.push(filtros);
        return {
            datos: [usuarioGestionPrueba],
            paginacion: {
                pagina: filtros.pagina,
                limite: filtros.limite,
                total: 1,
                totalPaginas: 1,
            },
        };
    },
    async obtener(empresaId, id) {
        assert.equal(empresaId, usuarioPrueba.empresaId);
        assert.equal(id, usuarioGestionPrueba.id);
        return usuarioGestionPrueba;
    },
    async crear(empresaId, datos) {
        usuariosCreados.push({ empresaId, datos });
        return usuarioGestionPrueba;
    },
    async actualizar(empresaId, id, datos) {
        actualizacionesUsuarios.push({ empresaId, id, datos });
        return usuarioGestionPrueba;
    },
    async cambiarRol(empresaId, id, rol) {
        cambiosRolUsuarios.push({ empresaId, id, rol });
        return { ...usuarioGestionPrueba, rol };
    },
    async cambiarEstado(empresaId, id, activo) {
        cambiosEstadoUsuarios.push({ empresaId, id, activo });
        return { ...usuarioGestionPrueba, activo };
    },
};
const clientePrueba = {
    id: "40d1ae8e-3a8e-4f95-b67b-3024ed15ed72",
    nombre: "Ada Lovelace",
    apellido: "",
    documento: "",
    telefono: "",
    correo: "ada@example.com",
    direccion: "",
    activo: true,
    origen: "MANUAL",
    posibleDuplicado: false,
    creadaEn: new Date("2026-01-01T00:00:00.000Z"),
    actualizadaEn: new Date("2026-01-01T00:00:00.000Z"),
} as any;

const servicioClientesPrueba: CustomerService = {
    async listar(filtros): Promise<ResultadoClientes> {
        filtrosClientesRecibidos.push(filtros);
        return {
            datos: [clientePrueba],
            paginacion: {
                pagina: filtros.pagina,
                limite: filtros.limite,
                total: 1,
                totalPaginas: 1,
            },
        };
    },
    async obtener(_empresaId, id) {
        assert.equal(id, clientePrueba.id);
        return clientePrueba;
    },
    async crear(empresaId, _usuarioId, datos) {
        clientesCreados.push({ empresaId, nombre: datos.nombre });
        return clientePrueba;
    },
    async actualizar(empresaId, _usuarioId, id, datos) {
        actualizacionesClientes.push({ empresaId, id, datos });
        return clientePrueba;
    },
    async cambiarEstado(empresaId, _usuarioId, id, activo) {
        estadosClientes.push({ empresaId, id, activo });
        return { ...clientePrueba, activo };
    },
    async listarOperaciones(empresaId, clienteId, pagina, limite) {
        assert.equal(empresaId, usuarioPrueba.empresaId);
        assert.equal(clienteId, clientePrueba.id);
        return {
            datos: [],
            paginacion: {
                pagina,
                limite,
                total: 0,
                totalPaginas: 0,
            },
        };
    },
    async obtenerActividadComercial(_empresaId, _clienteId) {
        return {
            totales: {
                totalComprado: new Prisma.Decimal(0),
                cantidadPedidos: 0,
                ticketPromedio: new Prisma.Decimal(0),
                ultimaCompra: null,
                pedidosCompletados: 0,
                pedidosPendientes: 0,
            },
            pedidosRecientes: [],
        };
    },
    async detectarDuplicados(_empresaId) {
        return [];
    },
    async resolverClienteCompra(_tx, _empresaId, _datos) {
        return { id: clientePrueba.id };
    },
};

const categoriaPrueba = {
    id: "6d53d0f3-8177-4bd2-ae9d-5959f83b67d9",
    nombre: "Tecnología",
    descripcion: "Dispositivos y accesorios",
    activo: true,
    creadaEn: new Date("2026-01-02T00:00:00.000Z"),
    actualizadaEn: new Date("2026-01-02T00:00:00.000Z"),
};

const servicioCategoriasPrueba: CategoryService = {
    async listar(filtros): Promise<ResultadoCategorias> {
        filtrosCategoriasRecibidos.push(filtros);
        return {
            datos: [categoriaPrueba],
            paginacion: {
                pagina: filtros.pagina,
                limite: filtros.limite,
                total: 1,
                totalPaginas: 1,
            },
        };
    },
    async obtener(empresaId, id) {
        assert.equal(empresaId, usuarioPrueba.empresaId);
        assert.equal(id, categoriaPrueba.id);
        return categoriaPrueba;
    },
    async crear(empresaId, datos) {
        categoriasCreadas.push({ empresaId, datos });
        return categoriaPrueba;
    },
    async actualizar(empresaId, id, datos) {
        actualizacionesCategorias.push({ empresaId, id, datos });
        return categoriaPrueba;
    },
    async cambiarEstado(empresaId, id, activo) {
        estadosCategorias.push({ empresaId, id, activo });
        return { ...categoriaPrueba, activo };
    },
};

const dashboardPrueba: DashboardResumen = {
    ventasHoy: { total: "125.50", cantidad: 2 },
    ventasMes: { total: "825.50", cantidad: 8 },
    ingresosMes: "700",
    productosStockBajo: { total: 1, productos: [] },
    clientesNuevos: 3,
    comprasRecientes: [],
    productosMasVendidos: [],
};
const empresasDashboardConsultadas: string[] = [];
const periodosEstadisticasConsultados: Array<{
    empresaId: string;
    periodo: string;
    fecha?: string;
}> = [];
const estadisticasPrueba: EstadisticasDashboard = {
    periodo: "semana",
    zonaHoraria: "America/Montevideo",
    desde: "2026-11-16T03:00:00.000Z",
    hasta: "2026-11-23T03:00:00.000Z",
    anterior: {
        desde: "2026-11-09T03:00:00.000Z",
        hasta: "2026-11-16T03:00:00.000Z",
    },
    cubos: [
        {
            clave: "2026-11-16T00:00:00",
            etiqueta: "lun 16",
            desde: "2026-11-16T03:00:00.000Z",
            hasta: "2026-11-17T03:00:00.000Z",
            metricas: {
                ventas: "100.00",
                pedidos: 1,
                unidades: 2,
                ingresos: "100.00",
            },
        },
    ],
    totales: {
        ventas: "100.00",
        pedidos: 1,
        unidades: 2,
        ingresos: "100.00",
    },
    comparacion: {
        ventas: { actual: "100.00", anterior: "50.00", variacion: 100 },
        pedidos: { actual: "1", anterior: "1", variacion: 0 },
        unidades: { actual: "2", anterior: "0", variacion: null },
        ingresos: { actual: "100.00", anterior: "50.00", variacion: 100 },
    },
    estadoPedidos: { abiertos: 1, completados: 0, incidencias: 0 },
    generadoEn: "2026-11-21T12:00:00.000Z",
};
const servicioDashboardPrueba: DashboardService = {
    async obtenerResumen(empresaId) {
        empresasDashboardConsultadas.push(empresaId);
        return dashboardPrueba;
    },
    async obtenerEstadisticas(empresaId, periodo, fecha) {
        periodosEstadisticasConsultados.push({
            empresaId,
            periodo,
            ...(fecha ? { fecha } : {}),
        });
        return estadisticasPrueba;
    },
};
const ventaPrueba: VentaPublica = {
    id: "c04e55bc-b7a5-47c6-824a-e9b267eeb728",
    estado: EstadoVenta.CONFIRMADA,
    subtotal: new Prisma.Decimal("100"),
    descuento: new Prisma.Decimal("5"),
    costoEnvio: new Prisma.Decimal("0"),
    tasaImpuesto: new Prisma.Decimal("18"),
    impuesto: new Prisma.Decimal("17.1"),
    total: new Prisma.Decimal("112.1"),
    creadaEn: new Date("2026-01-01T00:00:00.000Z"),
    canceladaEn: null,
    canceladaPor: null,
    cliente: {
        id: "40d1ae8e-3a8e-4f95-b67b-3024ed15ed72",
        nombre: "Ada",
        apellido: "Lovelace",
    },
    usuario: {
        id: usuarioPrueba.id,
        nombre: "Ada",
        apellido: "Lovelace",
    },
    detalles: [],
    pagos: [],
};
const ventasCreadas: Array<{
    empresaId: string;
    usuarioId: string;
    datos: DatosCrearVenta;
}> = [];
const pagosVentaRegistrados: Array<{
    empresaId: string;
    usuarioId: string;
    ventaId: string;
    datos: DatosRegistrarPago;
}> = [];
const ventasCanceladas: Array<{
    empresaId: string;
    usuarioId: string;
    ventaId: string;
}> = [];
const servicioVentasPrueba: SalesService = {
    async listar(filtros) {
        return {
            datos: [],
            paginacion: {
                pagina: filtros.pagina,
                limite: filtros.limite,
                total: 0,
                totalPaginas: 0,
            },
        };
    },
    async crear(empresaId, usuarioId, datos) {
        ventasCreadas.push({ empresaId, usuarioId, datos });
        return ventaPrueba;
    },
    async registrarPago(empresaId, usuarioId, ventaId, datos) {
        pagosVentaRegistrados.push({ empresaId, usuarioId, ventaId, datos });
        return ventaPrueba;
    },
    async cancelar(empresaId, usuarioId, ventaId) {
        ventasCanceladas.push({ empresaId, usuarioId, ventaId });
        return ventaPrueba;
    },
};

const app = createApp({
    config: {
    environment: "test",
    port: 4000,
    corsOrigin: "http://localhost:3000",
    jwtSecret: "secreto-de-prueba-de-32-caracteres-minimo",
    paypalClientId: "",
    paypalClientSecret: "",
    paypalBaseUrl: "https://api-m.sandbox.paypal.com",
    paypalWebhookId: "",
    paypalCurrency: "USD",
    paypalExchangeRate: 0,
    whatsappAccessToken: "",
    whatsappPhoneNumberId: "",
    whatsappApiVersion: "v23.0",
    whatsappOtpTemplate: "",
    whatsappOtpTemplateLang: "es",
    dashboardTimezone: "America/Montevideo",
    },
    authService: {
    async registrar(datos) {
        registros.push(datos.correo);
        return usuarioPrueba;
    },
    async iniciarSesion() {
        if (falloInicioSesion) {
            throw falloInicioSesion;
        }

        iniciosSesion.push({
            correo: "ada@example.com",
            contrasena: "ClaveSegura!123",
        });
        return usuarioPrueba;
    },
    async solicitarRecuperacion(correo) {
        solicitudesRecuperacion.push(correo);
        if (falloCorreoRecuperacion) {
            throw new AppError(
                "EMAIL_NO_DISPONIBLE",
                "No se pudo enviar el correo.",
                502,
            );
        }
    },
    async restablecerContrasena(datos) {
        restablecimientos.push(datos);
    },
    async validarSesion(id) {
        if (!sesionActiva) return null;
        return rolesPorSesion.get(id) ?? Rol.ADMINISTRADOR;
    },
    async obtenerPerfil(id, empresaId) {
        perfilesConsultados.push({ id, empresaId });
        return { ...usuarioPrueba, empresa: "Empresa de prueba" };
    },
    async createToken() {
        return createTestToken();
    },
    },
    customerService: servicioClientesPrueba,
    userService: servicioUsuariosPrueba,
    companyService: servicioEmpresasPrueba,
    categoryService: servicioCategoriasPrueba,
    salesService: servicioVentasPrueba,
    dashboardService: servicioDashboardPrueba,
});

let servidor: Server;
let urlBase: string;
const secretoPrueba = "secreto-de-prueba-de-32-caracteres-minimo";

function createTestToken(
    empresaId = usuarioPrueba.empresaId,
    rol: "ADMINISTRADOR" | "VENDEDOR" | "ALMACENERO" = usuarioPrueba.rol,
    id = usuarioPrueba.id,
) {
    return new SignJWT({ empresaId, rol })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(id)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(secretoPrueba));
}

before(async () => {
    servidor = app.listen(0);
    await new Promise<void>((resolver) => servidor.once("listening", resolver));
    const direccion = servidor.address();
    assert.ok(direccion && typeof direccion !== "string");
    urlBase = `http://127.0.0.1:${direccion.port}`;
});

after(async () => {
    await new Promise<void>((resolver, rechazar) => {
        servidor.close((error) => (error ? rechazar(error) : resolver()));
    });
});

it("entrega el resumen del dashboard de la empresa autenticada", async () => {
    const token = await createTestToken();
    const respuesta = await fetch(`${urlBase}/api/dashboard`, {
        headers: { cookie: `nexo_sesion=${token}` },
    });

    assert.equal(respuesta.status, 200);
    assert.deepEqual(empresasDashboardConsultadas, [usuarioPrueba.empresaId]);
    assert.deepEqual((await respuesta.json()).datos, dashboardPrueba);

    const sinSesion = await fetch(`${urlBase}/api/dashboard`);
    assert.equal(sinSesion.status, 401);
});

it("entrega estadísticas por período usando la empresa de la sesión", async () => {
    const token = await createTestToken();
    periodosEstadisticasConsultados.length = 0;

    const respuesta = await fetch(
        `${urlBase}/api/dashboard/estadisticas?periodo=semana&fecha=2026-11-21`,
        { headers: { cookie: `nexo_sesion=${token}` } },
    );

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("cache-control"), "private, max-age=30");
    assert.deepEqual(periodosEstadisticasConsultados, [
        {
            empresaId: usuarioPrueba.empresaId,
            periodo: "semana",
            fecha: "2026-11-21",
        },
    ]);
    assert.deepEqual((await respuesta.json()).datos, estadisticasPrueba);

    const periodoInvalido = await fetch(
        `${urlBase}/api/dashboard/estadisticas?periodo=anual`,
        { headers: { cookie: `nexo_sesion=${token}` } },
    );
    assert.equal(periodoInvalido.status, 400);

    const fechaInvalida = await fetch(
        `${urlBase}/api/dashboard/estadisticas?periodo=dia&fecha=2026-02-31`,
        { headers: { cookie: `nexo_sesion=${token}` } },
    );
    assert.equal(fechaInvalida.status, 400);

    const sinSesion = await fetch(
        `${urlBase}/api/dashboard/estadisticas?periodo=dia`,
    );
    assert.equal(sinSesion.status, 401);
});

it("registra ventas y pagos con identidad autenticada y valida su entrada", async () => {
    const token = await createTestToken();
    const datosVenta: DatosCrearVenta = {
        clienteId: "40d1ae8e-3a8e-4f95-b67b-3024ed15ed72",
        descuento: 5,
        detalles: [
            {
                productoId: "c04e55bc-b7a5-47c6-824a-e9b267eeb728",
                cantidad: 2,
            },
        ],
        pagoInicial: { monto: 10, metodo: "EFECTIVO" },
    };
    const respuestaInvalida = await fetch(`${urlBase}/api/ventas`, {
        method: "POST",
        headers: {
            cookie: `nexo_sesion=${token}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({ ...datosVenta, empresaId: "otra-empresa" }),
    });
    assert.equal(respuestaInvalida.status, 400);
    assert.equal(ventasCreadas.length, 0);

    const respuesta = await fetch(`${urlBase}/api/ventas`, {
        method: "POST",
        headers: {
            cookie: `nexo_sesion=${token}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(datosVenta),
    });
    assert.equal(respuesta.status, 201);
    assert.deepEqual(ventasCreadas.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        usuarioId: usuarioPrueba.id,
        datos: datosVenta,
    });

    const respuestaPago = await fetch(
        `${urlBase}/api/ventas/${ventaPrueba.id}/pagos`,
        {
            method: "POST",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                monto: 25.5,
                metodo: "TRANSFERENCIA",
            }),
        },
    );
    assert.equal(respuestaPago.status, 201);
    assert.deepEqual(pagosVentaRegistrados.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        usuarioId: usuarioPrueba.id,
        ventaId: ventaPrueba.id,
        datos: { monto: 25.5, metodo: "TRANSFERENCIA" },
    });

    const pagoInvalido = await fetch(
        `${urlBase}/api/ventas/${ventaPrueba.id}/pagos`,
        {
            method: "POST",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({ monto: 0, metodo: "EFECTIVO" }),
        },
    );
    assert.equal(pagoInvalido.status, 400);

    const respuestaCancelacion = await fetch(
        `${urlBase}/api/ventas/${ventaPrueba.id}/cancelar`,
        {
            method: "POST",
            headers: { cookie: `nexo_sesion=${token}` },
        },
    );
    assert.equal(respuestaCancelacion.status, 200);
    assert.deepEqual(ventasCanceladas.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        usuarioId: usuarioPrueba.id,
        ventaId: ventaPrueba.id,
    });

    const tokenAlmacenero = await createTestToken(
        usuarioPrueba.empresaId,
        "ALMACENERO",
        "usuario-almacenero",
    );
    const denegada = await fetch(`${urlBase}/api/ventas`, {
        headers: { cookie: `nexo_sesion=${tokenAlmacenero}` },
    });
    assert.equal(denegada.status, 403);
});

it("actualiza clientes usando siempre el tenant autenticado", async () => {
    const token = await createTestToken();
    const respuesta = await fetch(
        `${urlBase}/api/clientes/${clientePrueba.id}`,
        {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                nombre: "Ada Byron",
                empresaId: "otra-empresa",
            }),
        },
    );

    assert.equal(respuesta.status, 400);
    assert.equal(actualizacionesClientes.length, 0);

    const respuestaValida = await fetch(
        `${urlBase}/api/clientes/${clientePrueba.id}`,
        {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({ nombre: "Ada Byron" }),
        },
    );

    assert.equal(respuestaValida.status, 200);
    assert.deepEqual(actualizacionesClientes.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        id: clientePrueba.id,
        datos: { nombre: "Ada Byron" },
    });

    it("consulta la empresa del tenant autenticado y muestra sus miembros", async () => {
        const token = await createTestToken();
        const respuesta = await fetch(`${urlBase}/api/empresa`, {
            headers: { cookie: `nexo_sesion=${token}` },
        });

        assert.equal(respuesta.status, 200);
        assert.deepEqual(empresasConsultadas.at(-1), usuarioPrueba.empresaId);
        assert.deepEqual((await respuesta.json()).datos.empresa, {
            id: usuarioPrueba.empresaId,
            nombre: empresaPrueba.nombre,
            sitioWeb: empresaPrueba.sitioWeb,
            tasaImpuesto: "18",
            creadaEn: empresaPrueba.creadaEn.toISOString(),
            actualizadaEn: empresaPrueba.actualizadaEn.toISOString(),
            cantidadUsuarios: 2,
        });
    });

    it("actualiza datos comerciales solo con el tenant autenticado y un administrador", async () => {
        const token = await createTestToken();
        const datos = {
            nombre: "Empresa renovada",
            sitioWeb: "https://empresa.example",
            empresaId: "otra-empresa",
        };
        const respuestaInvalida = await fetch(`${urlBase}/api/empresa`, {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(datos),
        });

        assert.equal(respuestaInvalida.status, 400);
        assert.equal(actualizacionesEmpresas.length, 0);

        const respuesta = await fetch(`${urlBase}/api/empresa`, {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                nombre: datos.nombre,
                sitioWeb: datos.sitioWeb,
                tasaImpuesto: 18,
            }),
        });

        assert.equal(respuesta.status, 200);
        assert.deepEqual(actualizacionesEmpresas.at(-1), {
            empresaId: usuarioPrueba.empresaId,
            datos: {
                nombre: datos.nombre,
                sitioWeb: datos.sitioWeb,
                tasaImpuesto: 18,
            },
        });

        const urlInvalida = await fetch(`${urlBase}/api/empresa`, {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                nombre: datos.nombre,
                sitioWeb: "javascript:alert(1)",
                tasaImpuesto: 18,
            }),
        });
        assert.equal(urlInvalida.status, 400);

        const tokenVendedor = await createTestToken(
            usuarioPrueba.empresaId,
            "VENDEDOR",
            "usuario-vendedor",
        );
        const respuestaVendedor = await fetch(`${urlBase}/api/empresa`, {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${tokenVendedor}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                nombre: datos.nombre,
                sitioWeb: datos.sitioWeb,
                tasaImpuesto: 18,
            }),
        });
        assert.equal(respuestaVendedor.status, 403);
        assert.equal(actualizacionesEmpresas.length, 1);
    });
});

it("desactiva clientes sin eliminarlos", async () => {
    const token = await createTestToken();
    const respuesta = await fetch(
        `${urlBase}/api/clientes/${clientePrueba.id}/estado`,
        {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({ activo: false }),
        },
    );

    assert.equal(respuesta.status, 200);
    assert.deepEqual(estadosClientes.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        id: clientePrueba.id,
        activo: false,
    });
});

it("consulta, crea y desactiva categorías por empresa", async () => {
    const token = await createTestToken();
    const headers = { cookie: `nexo_sesion=${token}` };

    const respuestaLista = await fetch(
        `${urlBase}/api/categorias?pagina=1&limite=10&buscar=tecnologia&activo=true`,
        { headers },
    );

    assert.equal(respuestaLista.status, 200);
    assert.deepEqual(filtrosCategoriasRecibidos.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        pagina: 1,
        limite: 10,
        buscar: "tecnologia",
        activo: true,
    });

    const respuestaCreacion = await fetch(`${urlBase}/api/categorias`, {
        method: "POST",
        headers: {
            ...headers,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            nombre: "Tecnología",
            descripcion: "Dispositivos y accesorios",
        }),
    });

    assert.equal(respuestaCreacion.status, 201);
    assert.equal(categoriasCreadas.at(-1)?.empresaId, usuarioPrueba.empresaId);
    assert.equal(categoriasCreadas.at(-1)?.datos.nombre, "Tecnología");

    const respuestaActualizacion = await fetch(
        `${urlBase}/api/categorias/${categoriaPrueba.id}`,
        {
            method: "PATCH",
            headers: {
                ...headers,
                "content-type": "application/json",
            },
            body: JSON.stringify({ nombre: "Electrónica" }),
        },
    );

    assert.equal(respuestaActualizacion.status, 200);
    assert.deepEqual(actualizacionesCategorias.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        id: categoriaPrueba.id,
        datos: { nombre: "Electrónica" },
    });

    const respuestaEstado = await fetch(
        `${urlBase}/api/categorias/${categoriaPrueba.id}/estado`,
        {
            method: "PATCH",
            headers: {
                ...headers,
                "content-type": "application/json",
            },
            body: JSON.stringify({ activo: false }),
        },
    );

    assert.equal(respuestaEstado.status, 200);
    assert.deepEqual(estadosCategorias.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        id: categoriaPrueba.id,
        activo: false,
    });
});

it("crea usuarios en la empresa autenticada y rechaza campos de tenant", async () => {
    const token = await createTestToken();
    const datos = {
        nombre: "Grace",
        apellido: "Hopper",
        correo: "grace@example.com",
        contrasena: "ClaveSegura!123",
        rol: "VENDEDOR",
        empresaId: "otra-empresa",
    };
    const respuestaInvalida = await fetch(`${urlBase}/api/usuarios`, {
        method: "POST",
        headers: {
            cookie: `nexo_sesion=${token}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(datos),
    });

    assert.equal(respuestaInvalida.status, 400);
    assert.equal(usuariosCreados.length, 0);

    const { empresaId: _empresaId, ...datosValidos } = datos;
    const respuesta = await fetch(`${urlBase}/api/usuarios`, {
        method: "POST",
        headers: {
            cookie: `nexo_sesion=${token}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(datosValidos),
    });

    assert.equal(respuesta.status, 201);
    assert.equal(usuariosCreados.at(-1)?.empresaId, usuarioPrueba.empresaId);
    assert.equal(usuariosCreados.at(-1)?.datos.correo, "grace@example.com");
});

it("consulta y modifica usuarios dentro de la empresa autenticada", async () => {
    const token = await createTestToken();
    const headers = { cookie: `nexo_sesion=${token}` };
    const respuestaLista = await fetch(
        `${urlBase}/api/usuarios?pagina=2&limite=5&buscar=grace&activo=false`,
        { headers },
    );

    assert.equal(respuestaLista.status, 200);
    assert.deepEqual(filtrosUsuariosRecibidos.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        pagina: 2,
        limite: 5,
        buscar: "grace",
        activo: false,
    });

    const respuestaDetalle = await fetch(
        `${urlBase}/api/usuarios/${usuarioGestionPrueba.id}`,
        { headers },
    );
    assert.equal(respuestaDetalle.status, 200);

    const respuestaActualizacion = await fetch(
        `${urlBase}/api/usuarios/${usuarioGestionPrueba.id}`,
        {
            method: "PATCH",
            headers: {
                ...headers,
                "content-type": "application/json",
            },
            body: JSON.stringify({ correo: "GRACE.HOPPER@example.com" }),
        },
    );

    assert.equal(respuestaActualizacion.status, 200);
    assert.deepEqual(actualizacionesUsuarios.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        id: usuarioGestionPrueba.id,
        datos: { correo: "grace.hopper@example.com" },
    });
});

it("limita la consulta y el cambio de rol al administrador autenticado", async () => {
    const idVendedor = "usuario-vendedor";
    const tokenVendedor = await createTestToken(
        usuarioPrueba.empresaId,
        "ADMINISTRADOR",
        idVendedor,
    );
    const respuestaVendedor = await fetch(`${urlBase}/api/usuarios`, {
        headers: { cookie: `nexo_sesion=${tokenVendedor}` },
    });

    assert.equal(respuestaVendedor.status, 403);

    const tokenAdmin = await createTestToken();
    const respuesta = await fetch(
        `${urlBase}/api/usuarios/${usuarioGestionPrueba.id}/rol`,
        {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${tokenAdmin}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({ rol: "ALMACENERO" }),
        },
    );

    assert.equal(respuesta.status, 200);
    assert.deepEqual(cambiosRolUsuarios.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        id: usuarioGestionPrueba.id,
        rol: "ALMACENERO",
    });
});

it("activa y desactiva usuarios sin aceptar un tenant de la solicitud", async () => {
    const token = await createTestToken();
    const respuesta = await fetch(
        `${urlBase}/api/usuarios/${usuarioGestionPrueba.id}/estado`,
        {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({ activo: false, empresaId: "otra-empresa" }),
        },
    );

    assert.equal(respuesta.status, 400);

    const respuestaValida = await fetch(
        `${urlBase}/api/usuarios/${usuarioGestionPrueba.id}/estado`,
        {
            method: "PATCH",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({ activo: false }),
        },
    );

    assert.equal(respuestaValida.status, 200);
    assert.deepEqual(cambiosEstadoUsuarios.at(-1), {
        empresaId: usuarioPrueba.empresaId,
        id: usuarioGestionPrueba.id,
        activo: false,
    });
});

describe("API base", () => {
    it("conserva la respuesta de la ruta raíz existente", async () => {
        const respuesta = await fetch(`${urlBase}/`);

        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), {
            mensaje: "API NexoERP funcionando",
        });
    });

    it("expone un endpoint de salud con el formato estándar", async () => {
        const respuesta = await fetch(`${urlBase}/api/salud`);

        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), {
            exito: true,
            datos: { estado: "operativo" },
            mensaje: "API NexoERP funcionando.",
        });
    });

    it("devuelve errores estándar para rutas inexistentes", async () => {
        const respuesta = await fetch(`${urlBase}/api/no-existe`);

        assert.equal(respuesta.status, 404);
        assert.deepEqual(await respuesta.json(), {
            exito: false,
            error: {
                codigo: "RUTA_NO_ENCONTRADA",
                mensaje: "No existe la ruta GET /api/no-existe.",
            },
        });
    });

    it("rechaza cuerpos JSON malformados con un error controlado", async () => {
        const respuesta = await fetch(`${urlBase}/api/no-existe`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
        });

        assert.equal(respuesta.status, 400);
        assert.deepEqual(await respuesta.json(), {
            exito: false,
            error: {
                codigo: "JSON_INVALIDO",
                mensaje: "El cuerpo de la solicitud no contiene JSON válido.",
            },
        });
    });

    it("requiere una clave de idempotencia válida para iniciar checkout", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/marketplace/checkout`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    tiendaSlug: "erfely",
                    nombre: "Yunier Lima",
                    correo: "yunierlr02@gmail.com",
                    telefono: "095227806",
                    departamento: "4",
                    localidad: "Montevideo",
                    direccion: "Cmdte braga",
                    codigoPostal: "",
                    notaEntrega: "",
                    detalles: [
                        {
                            productoId:
                                "0c62fe74-9569-456f-ade3-135b463fd1a2",
                            cantidad: 1,
                        },
                    ],
                }),
            },
        );

        assert.equal(respuesta.status, 400);
        assert.deepEqual(await respuesta.json(), {
            exito: false,
            error: {
                codigo: "CLAVE_IDEMPOTENCIA_INVALIDA",
                mensaje:
                    "El encabezado Idempotency-Key debe contener un UUID válido.",
            },
        });
    });

    it("valida la configuración al iniciar", () => {
        assert.deepEqual(
            loadConfig({
                NODE_ENV: "test",
                PORT: "4321",
                CORS_ORIGIN: "http://localhost:3000",
                DATABASE_URL: "postgresql://nexo:local@localhost:5432/nexo",
                JWT_ACCESS_SECRET: secretoPrueba,
            }),
            {
                environment: "test",
                port: 4321,
                corsOrigin: "http://localhost:3000",
                jwtSecret: secretoPrueba,
                mailtrapSmtpHost: "sandbox.smtp.mailtrap.io",
                mailtrapSmtpPort: 2525,
                mailtrapSmtpUser: "",
                mailtrapSmtpPass: "",
                mailtrapFromEmail: "",
                mailtrapFromName: "NexoERP",
                frontendUrl: "http://localhost:3000",
                paypalClientId: "",
                paypalClientSecret: "",
                paypalBaseUrl: "https://api-m.sandbox.paypal.com",
                paypalWebhookId: "",
                paypalCurrency: "USD",
                paypalExchangeRate: 0,
                marketplaceCommissionPercent: 2,
                whatsappAccessToken: "",
                whatsappPhoneNumberId: "",
                whatsappApiVersion: "v23.0",
                whatsappOtpTemplate: "",
                whatsappOtpTemplateLang: "es",
                dashboardTimezone: "America/Montevideo",
            },
        );

        assert.deepEqual(
            loadConfig({}),
            {
                environment: "development",
                port: 4000,
                corsOrigin: "http://localhost:3000",
                jwtSecret: "desarrollo-secreto-local-de-32-caracteres",
                mailtrapSmtpHost: "sandbox.smtp.mailtrap.io",
                mailtrapSmtpPort: 2525,
                mailtrapSmtpUser: "",
                mailtrapSmtpPass: "",
                mailtrapFromEmail: "",
                mailtrapFromName: "NexoERP",
                frontendUrl: "http://localhost:3000",
                paypalClientId: "",
                paypalClientSecret: "",
                paypalBaseUrl: "https://api-m.sandbox.paypal.com",
                paypalWebhookId: "",
                paypalCurrency: "USD",
                paypalExchangeRate: 0,
                marketplaceCommissionPercent: 2,
                whatsappAccessToken: "",
                whatsappPhoneNumberId: "",
                whatsappApiVersion: "v23.0",
                whatsappOtpTemplate: "",
                whatsappOtpTemplateLang: "es",
                dashboardTimezone: "America/Montevideo",
            },
        );

        const legacyConfig = loadConfig({
            PUERTO_SERVIDOR: "4321",
            CORS_ORIGEN: "http://localhost:3000",
            JWT_ACCESS_SECRETO: secretoPrueba,
        });
        assert.equal(legacyConfig.port, 4321);
        assert.equal(legacyConfig.corsOrigin, "http://localhost:3000");
        assert.equal(legacyConfig.jwtSecret, secretoPrueba);

        const smtpConfig = loadConfig({
            NODE_ENV: "test",
            JWT_ACCESS_SECRET: secretoPrueba,
            MAILTRAP_SMTP_USER: "sandbox-user",
            MAILTRAP_SMTP_PASS: "sandbox-pass",
            MAILTRAP_FROM_EMAIL: "from@example.com",
        });
        assert.equal(smtpConfig.mailtrapSmtpHost, "sandbox.smtp.mailtrap.io");
        assert.equal(smtpConfig.mailtrapSmtpPort, 2525);
        assert.equal(smtpConfig.mailtrapSmtpUser, "sandbox-user");
        assert.equal(smtpConfig.mailtrapSmtpPass, "sandbox-pass");
        assert.equal(smtpConfig.mailtrapFromEmail, "from@example.com");

        const paypalLiveConfig = loadConfig({
            NODE_ENV: "test",
            JWT_ACCESS_SECRET: secretoPrueba,
            PAYPAL_CLIENT_ID: "test-client-id",
            PAYPAL_CLIENT_SECRET: "test-client-secret",
            PAYPAL_BASE_URL: "https://api-m.paypal.com",
            PAYPAL_WEBHOOK_ID: "WH-TEST-123",
            PAYPAL_CURRENCY: "USD",
            PAYPAL_EXCHANGE_RATE: "40.5",
        });
        assert.equal(
            paypalLiveConfig.paypalBaseUrl,
            "https://api-m.paypal.com",
        );
        assert.equal(paypalLiveConfig.paypalCurrency, "USD");
        assert.equal(paypalLiveConfig.paypalExchangeRate, 40.5);
        assert.equal(paypalLiveConfig.paypalWebhookId, "WH-TEST-123");
        assert.throws(
            () =>
                loadConfig({
                    NODE_ENV: "test",
                    JWT_ACCESS_SECRET: secretoPrueba,
                    PAYPAL_BASE_URL: "http://api-m.paypal.com",
                }),
            /PAYPAL_BASE_URL/,
        );
        assert.throws(
            () =>
                loadConfig({
                    NODE_ENV: "test",
                    JWT_ACCESS_SECRET: secretoPrueba,
                    PAYPAL_EXCHANGE_RATE: "no-numerico",
                }),
            /PAYPAL_EXCHANGE_RATE/,
        );
        assert.throws(
            () =>
                loadConfig({
                    NODE_ENV: "test",
                    JWT_ACCESS_SECRET: secretoPrueba,
                    PAYPAL_CURRENCY: "UYU",
                }),
            /PAYPAL_CURRENCY/,
        );

        assert.throws(
            () =>
                loadConfig({
                    NODE_ENV: "invalid",
                    PORT: "0",
                    CORS_ORIGIN: "not-a-url",
                    DATABASE_URL: "postgresql://nexo:local@localhost:5432/nexo",
                    JWT_ACCESS_SECRET: "corto",
                }),
            /Configuración inválida/,
        );

        assert.throws(
            () =>
                loadConfig({
                    NODE_ENV: "production",
                    DATABASE_URL: "postgresql://localhost:5432/nexo",
                }),
            /JWT_ACCESS_SECRET/,
        );

        assert.equal(
            loadConfig({
                NODE_ENV: "production",
                DATABASE_URL: "postgresql://localhost:5432/nexo",
                JWT_ACCESS_SECRET: secretoPrueba,
            }).jwtSecret,
            secretoPrueba,
        );

        assert.throws(
            () =>
                loadConfig({
                    NODE_ENV: "test",
                    JWT_ACCESS_SECRET: secretoPrueba,
                    MARKETPLACE_COMMISSION_PERCENT: "2.123",
                }),
            /MARKETPLACE_COMMISSION_PERCENT/,
        );
    });

    it("rechaza el registro cuando faltan datos obligatorios", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/registro`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ correo: "no-es-un-correo" }),
            },
        );

        assert.equal(respuesta.status, 400);
        assert.deepEqual(await respuesta.json(), {
            exito: false,
            error: {
                codigo: "DATOS_INVALIDOS",
                mensaje:
                    "Revisa el nombre de la empresa, tus datos y los requisitos de contraseña.",
            },
        });
        assert.equal(registros.length, 0);
    });

    it("crea la cuenta mediante la API y entrega una cookie no legible por JavaScript", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/registro`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    nombreEmpresa: "Empresa Ada",
                    nombre: "Ada",
                    apellido: "Lovelace",
                    correo: "ADA@example.com",
                    contrasena: "ClaveSegura!123",
                }),
            },
        );

        assert.equal(respuesta.status, 201);
        const cookie = respuesta.headers.get("set-cookie");
        assert.equal(cookie?.includes("HttpOnly"), true);
        assert.equal(cookie?.includes("Path=/api"), true);
        assert.deepEqual(await respuesta.json(), {
            exito: true,
            datos: { usuario: usuarioPrueba },
            mensaje: "La cuenta y la empresa se crearon correctamente.",
        });
        assert.equal(registros.at(-1), "ada@example.com");
    });

    it("inicia sesión con correo normalizado y crea una cookie HttpOnly", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/iniciar-sesion`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    correo: "ADA@example.com",
                    contrasena: "ClaveSegura!123",
                }),
            },
        );

        assert.equal(respuesta.status, 200);
        assert.equal(
            respuesta.headers.get("set-cookie")?.includes("HttpOnly"),
            true,
        );
        assert.deepEqual(iniciosSesion.at(-1), {
            correo: "ada@example.com",
            contrasena: "ClaveSegura!123",
        });
    });

    it("solicita recuperación sin revelar si el correo está registrado", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/solicitar-recuperacion`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ correo: "ADA@example.com" }),
            },
        );

        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), {
            exito: true,
            mensaje:
                "Si existe una cuenta asociada a ese correo, recibirás instrucciones para recuperar tu contraseña.",
        });
        assert.equal(solicitudesRecuperacion.at(-1), "ada@example.com");
    });

    it("rechaza datos inválidos en la solicitud de recuperación", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/solicitar-recuperacion`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ correo: "no-es-un-correo" }),
            },
        );

        assert.equal(respuesta.status, 400);
        assert.equal(solicitudesRecuperacion.length, 1);
    });

    it("no revela fallos de entrega que permitan descubrir cuentas existentes", async () => {
        falloCorreoRecuperacion = true;
        try {
            const respuesta = await fetch(
                `${urlBase}/api/autenticacion/solicitar-recuperacion`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ correo: "ada@example.com" }),
                },
            );

            assert.equal(respuesta.status, 200);
            assert.deepEqual(await respuesta.json(), {
                exito: true,
                mensaje:
                    "Si existe una cuenta asociada a ese correo, recibirás instrucciones para recuperar tu contraseña.",
            });
        } finally {
            falloCorreoRecuperacion = false;
        }
    });

    it("restablece contraseña solo con un token y contraseña válidos", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/restablecer-contrasena`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    token: "a".repeat(43),
                    contrasena: "NuevaClaveSegura!123",
                }),
            },
        );

        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), {
            exito: true,
            mensaje: "La contraseña se actualizó correctamente.",
        });
        assert.deepEqual(restablecimientos.at(-1), {
            token: "a".repeat(43),
            contrasena: "NuevaClaveSegura!123",
        });
    });

    it("rechaza contraseñas que no cumplen los requisitos al restablecer", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/restablecer-contrasena`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    token: "a".repeat(43),
                    contrasena: "debil",
                }),
            },
        );

        assert.equal(respuesta.status, 400);
        assert.equal(restablecimientos.length, 1);
    });

    it("devuelve 503 cuando PostgreSQL no está disponible", async () => {
        falloInicioSesion = new Prisma.PrismaClientInitializationError(
            "Can't reach database server at localhost:5432",
            "test",
            "P1001",
        );

        try {
            const respuesta = await fetch(
                `${urlBase}/api/autenticacion/iniciar-sesion`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        correo: "ada@example.com",
                        contrasena: "ClaveSegura!123",
                    }),
                },
            );

            assert.equal(respuesta.status, 503);
            assert.deepEqual(await respuesta.json(), {
                exito: false,
                error: {
                    codigo: "BASE_DE_DATOS_NO_DISPONIBLE",
                    mensaje:
                        "No se pudo conectar con la base de datos. Comprueba que PostgreSQL esté iniciado y vuelve a intentarlo.",
                },
            });
        } finally {
            falloInicioSesion = undefined;
        }
    });

    it("protege el perfil si no hay una sesión", async () => {
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/perfil`,
        );

        assert.equal(respuesta.status, 401);
        assert.deepEqual(await respuesta.json(), {
            exito: false,
            error: {
                codigo: "NO_AUTENTICADO",
                mensaje: "Debes iniciar sesión para continuar.",
            },
        });
    });

    it("valida la sesión y limita el perfil al identificador de empresa del token", async () => {
        const token = await new SignJWT({
            empresaId: usuarioPrueba.empresaId,
            rol: usuarioPrueba.rol,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(usuarioPrueba.id)
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode(secretoPrueba));
        const respuesta = await fetch(
            `${urlBase}/api/autenticacion/perfil`,
            { headers: { cookie: `nexo_sesion=${token}` } },
        );

        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), {
            exito: true,
            datos: {
                usuario: {
                    ...usuarioPrueba,
                    empresa: "Empresa de prueba",
                },
            },
        });
        assert.deepEqual(perfilesConsultados.at(-1), {
            id: usuarioPrueba.id,
            empresaId: usuarioPrueba.empresaId,
        });
    });

    it("revoca inmediatamente las sesiones de cuentas desactivadas", async () => {
        const token = await createTestToken();
        sesionActiva = false;

        try {
            const respuesta = await fetch(`${urlBase}/api/clientes`, {
                headers: { cookie: `nexo_sesion=${token}` },
            });

            assert.equal(respuesta.status, 401);
            assert.deepEqual(await respuesta.json(), {
                exito: false,
                error: {
                    codigo: "SESION_INVALIDA",
                    mensaje: "La sesión ya no es válida.",
                },
            });
        } finally {
            sesionActiva = true;
        }
    });

    it("requiere sesión para consultar clientes", async () => {
        const respuesta = await fetch(`${urlBase}/api/clientes`);

        assert.equal(respuesta.status, 401);
    });

    it("lista clientes usando la empresa de la sesión y aplica filtros paginados", async () => {
        const token = await createTestToken();
        const respuesta = await fetch(
            `${urlBase}/api/clientes?pagina=2&limite=5&buscar=ada&empresaId=otra-empresa`,
            { headers: { cookie: `nexo_sesion=${token}` } },
        );

        assert.equal(respuesta.status, 200);
        assert.deepEqual(filtrosClientesRecibidos.at(-1), {
            empresaId: usuarioPrueba.empresaId,
            pagina: 2,
            limite: 5,
            buscar: "ada",
        });
        assert.deepEqual(await respuesta.json(), {
            exito: true,
            datos: [{
                ...clientePrueba,
                creadaEn: clientePrueba.creadaEn.toISOString(),
                actualizadaEn: clientePrueba.actualizadaEn.toISOString(),
            }],
            paginacion: {
                pagina: 2,
                limite: 5,
                total: 1,
                totalPaginas: 1,
            },
        });
    });

    it("crea clientes dentro de la empresa de la sesión e ignora empresaId enviado", async () => {
        const token = await createTestToken();
        const respuesta = await fetch(`${urlBase}/api/clientes`, {
            method: "POST",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                nombre: "Ada Lovelace",
                correo: "ADA@example.com",
                empresaId: "otra-empresa",
            }),
        });

        assert.equal(respuesta.status, 400);
        assert.equal(clientesCreados.length, 0);

        const respuestaValida = await fetch(`${urlBase}/api/clientes`, {
            method: "POST",
            headers: {
                cookie: `nexo_sesion=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                nombre: "Ada Lovelace",
                correo: "ADA@example.com",
            }),
        });

        assert.equal(respuestaValida.status, 201);
        assert.deepEqual(clientesCreados.at(-1), {
            empresaId: usuarioPrueba.empresaId,
            nombre: "Ada Lovelace",
        });
    });

    it("impide al rol de almacenero acceder al módulo de clientes", async () => {
        rolesPorSesion.set(usuarioPrueba.id, Rol.ALMACENERO);
        const token = await createTestToken(
            usuarioPrueba.empresaId,
            "ALMACENERO",
        );
        const respuesta = await fetch(`${urlBase}/api/clientes`, {
            headers: { cookie: `nexo_sesion=${token}` },
        });

        assert.equal(respuesta.status, 403);
        assert.deepEqual(await respuesta.json(), {
            exito: false,
            error: {
                codigo: "PERMISO_DENEGADO",
                mensaje: "No tienes permiso para administrar clientes.",
            },
        });
        rolesPorSesion.set(usuarioPrueba.id, Rol.ADMINISTRADOR);
    });

    it("rechaza filtros fuera de los límites de paginación", async () => {
        const token = await createTestToken();
        const respuesta = await fetch(
            `${urlBase}/api/clientes?pagina=0&limite=500`,
            { headers: { cookie: `nexo_sesion=${token}` } },
        );

        assert.equal(respuesta.status, 400);
        assert.deepEqual(await respuesta.json(), {
            exito: false,
            error: {
                codigo: "FILTROS_INVALIDOS",
                mensaje:
                    "Revisa la página, el límite y los filtros de búsqueda.",
            },
        });
    });

    it("limita los intentos de inicio de sesión por dirección IP", async () => {
        let respuesta: Response | undefined;

        for (let intento = 0; intento < 11; intento += 1) {
            respuesta = await fetch(
                `${urlBase}/api/autenticacion/iniciar-sesion`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        correo: "ada@example.com",
                        contrasena: "ClaveSegura!123",
                    }),
                },
            );
        }

        assert.equal(respuesta?.status, 429);
        assert.deepEqual(await respuesta?.json(), {
            exito: false,
            error: {
                codigo: "DEMASIADAS_SOLICITUDES",
                mensaje:
                    "Se alcanzó el límite de intentos. Vuelve a intentarlo más tarde.",
            },
        });
    });
});
