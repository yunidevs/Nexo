"use client";

import {
    Boxes,
    Download,
    FileText,
    LoaderCircle,
    Package,
    Search,
    ShoppingCart,
    Truck,
    Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { usePerfilWorkspace } from "@/app/components/workspace-shell";
import { apiRequest } from "@/app/lib/api";
import { EncabezadoPagina } from "@/app/components/encabezado-pagina";

type TipoReporte =
    | "ventas"
    | "compras"
    | "inventario"
    | "productos"
    | "clientes"
    | "proveedores"
    | "vendedores";

interface Paginacion {
    totalPaginas: number;
}

interface ResultadoPaginado<T> {
    datos: T[];
    paginacion: Paginacion;
}

interface FilaReporte {
    id: string;
    fecha: string;
    celdas: Array<string | number>;
    busqueda: string;
    importe?: number;
    cantidad?: number;
    actividad?: Array<{ fecha: string; importe: number }>;
}

interface DefinicionReporte {
    id: TipoReporte;
    nombre: string;
    descripcion: string;
    icono: LucideIcon;
    columnas: string[];
    filtrarPorFecha: boolean;
}

interface Venta {
    id: string;
    estado: "CONFIRMADA" | "CANCELADA";
    total: string | number;
    creadaEn: string;
    cliente: { nombre: string; apellido: string };
    usuario: { id: string; nombre: string; apellido: string };
    detalles: Array<{ cantidad: number }>;
}

interface Compra {
    id: string;
    estado: string;
    total: string | number;
    fechaCompra: string;
    creadaEn: string;
    proveedor: { nombre: string };
    usuario: { nombre: string; apellido: string };
    detalles: Array<{ cantidad: number }>;
}

interface ProductoInventario {
    id: string;
    sku: string;
    nombre: string;
    stock: number;
    stockMinimo: number;
    categoria: string | null;
    activo: boolean;
}

interface Producto {
    id: string;
    sku: string;
    nombre: string;
    precioVenta: string | number;
    costo: string | number;
    categoria: string | null;
    activo: boolean;
    creadaEn: string;
}

interface Cliente {
    id: string;
    nombre: string;
    apellido: string | null;
    documento: string | null;
    telefono: string | null;
    correo: string | null;
    activo: boolean;
    creadaEn: string;
}

interface Proveedor {
    id: string;
    nombre: string;
    documento: string | null;
    telefono: string | null;
    correo: string | null;
    activo: boolean;
    creadaEn: string;
}

interface Usuario {
    id: string;
    nombre: string;
    apellido: string;
    correo: string;
    rol: string;
    activo: boolean;
    creadaEn: string;
}

const reportes: DefinicionReporte[] = [
    {
        id: "ventas",
        nombre: "Ventas",
        descripcion: "Operaciones de venta registradas y sus importes.",
        icono: ShoppingCart,
        columnas: ["N.º de venta", "Fecha", "Cliente", "Vendedor", "Artículos", "Total"],
        filtrarPorFecha: true,
    },
    {
        id: "compras",
        nombre: "Compras",
        descripcion: "Órdenes de compra, proveedores e importes.",
        icono: Truck,
        columnas: ["N.º de compra", "Fecha", "Proveedor", "Registró", "Estado", "Artículos", "Total"],
        filtrarPorFecha: true,
    },
    {
        id: "inventario",
        nombre: "Inventario",
        descripcion: "Existencias actuales y alertas de stock mínimo.",
        icono: Boxes,
        columnas: ["SKU", "Producto", "Categoría", "Existencias", "Stock mínimo", "Estado"],
        filtrarPorFecha: false,
    },
    {
        id: "productos",
        nombre: "Productos",
        descripcion: "Catálogo, precios y estado de los productos.",
        icono: Package,
        columnas: ["SKU", "Producto", "Categoría", "Costo", "Precio de venta", "Estado"],
        filtrarPorFecha: false,
    },
    {
        id: "clientes",
        nombre: "Clientes",
        descripcion: "Directorio de clientes registrados.",
        icono: Users,
        columnas: ["Cliente", "Documento", "Teléfono", "Correo", "Estado", "Alta"],
        filtrarPorFecha: false,
    },
    {
        id: "proveedores",
        nombre: "Proveedores",
        descripcion: "Directorio de proveedores registrados.",
        icono: Truck,
        columnas: ["Proveedor", "Documento", "Teléfono", "Correo", "Estado", "Alta"],
        filtrarPorFecha: false,
    },
    {
        id: "vendedores",
        nombre: "Vendedores",
        descripcion: "Actividad de ventas acumulada por vendedor.",
        icono: Users,
        columnas: ["Vendedor", "Correo", "Ventas", "Total vendido", "Estado"],
        filtrarPorFecha: true,
    },
];

const filasVacias: FilaReporte[] = [];

function esRegistro(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null;
}

function esTexto(valor: unknown): valor is string {
    return typeof valor === "string";
}

function esImporte(valor: unknown): valor is string | number {
    return (
        (typeof valor === "string" || typeof valor === "number") &&
        Number.isFinite(Number(valor))
    );
}

function esResultadoPaginado<T>(
    valor: unknown,
    validar: (elemento: unknown) => elemento is T,
): valor is ResultadoPaginado<T> {
    return (
        esRegistro(valor) &&
        Array.isArray(valor.datos) &&
        valor.datos.every(validar) &&
        esRegistro(valor.paginacion) &&
        typeof valor.paginacion.totalPaginas === "number" &&
        Number.isInteger(valor.paginacion.totalPaginas) &&
        valor.paginacion.totalPaginas >= 0
    );
}

function esVenta(valor: unknown): valor is Venta {
    return (
        esRegistro(valor) &&
        esTexto(valor.id) &&
        (valor.estado === "CONFIRMADA" || valor.estado === "CANCELADA") &&
        esImporte(valor.total) &&
        esTexto(valor.creadaEn) &&
        esRegistro(valor.cliente) &&
        esTexto(valor.cliente.nombre) &&
        esTexto(valor.cliente.apellido) &&
        esRegistro(valor.usuario) &&
        esTexto(valor.usuario.id) &&
        esTexto(valor.usuario.nombre) &&
        esTexto(valor.usuario.apellido) &&
        Array.isArray(valor.detalles) &&
        valor.detalles.every(
            (detalle) =>
                esRegistro(detalle) && typeof detalle.cantidad === "number",
        )
    );
}

function esCompra(valor: unknown): valor is Compra {
    return (
        esRegistro(valor) &&
        esTexto(valor.id) &&
        esTexto(valor.estado) &&
        esImporte(valor.total) &&
        esTexto(valor.fechaCompra) &&
        esTexto(valor.creadaEn) &&
        esRegistro(valor.proveedor) &&
        esTexto(valor.proveedor.nombre) &&
        esRegistro(valor.usuario) &&
        esTexto(valor.usuario.nombre) &&
        esTexto(valor.usuario.apellido) &&
        Array.isArray(valor.detalles) &&
        valor.detalles.every(
            (detalle) =>
                esRegistro(detalle) && typeof detalle.cantidad === "number",
        )
    );
}

function esProductoInventario(valor: unknown): valor is ProductoInventario {
    return (
        esRegistro(valor) &&
        esTexto(valor.id) &&
        esTexto(valor.sku) &&
        esTexto(valor.nombre) &&
        typeof valor.stock === "number" &&
        typeof valor.stockMinimo === "number" &&
        (esTexto(valor.categoria) || valor.categoria === null) &&
        typeof valor.activo === "boolean"
    );
}

function esProducto(valor: unknown): valor is Producto {
    return (
        esRegistro(valor) &&
        esTexto(valor.id) &&
        esTexto(valor.sku) &&
        esTexto(valor.nombre) &&
        esImporte(valor.precioVenta) &&
        esImporte(valor.costo) &&
        (esTexto(valor.categoria) || valor.categoria === null) &&
        typeof valor.activo === "boolean" &&
        esTexto(valor.creadaEn)
    );
}

function esCliente(valor: unknown): valor is Cliente {
    return (
        esRegistro(valor) &&
        esTexto(valor.id) &&
        esTexto(valor.nombre) &&
        (esTexto(valor.apellido) || valor.apellido === null) &&
        (esTexto(valor.documento) || valor.documento === null) &&
        (esTexto(valor.telefono) || valor.telefono === null) &&
        (esTexto(valor.correo) || valor.correo === null) &&
        typeof valor.activo === "boolean" &&
        esTexto(valor.creadaEn)
    );
}

function esProveedor(valor: unknown): valor is Proveedor {
    return (
        esRegistro(valor) &&
        esTexto(valor.id) &&
        esTexto(valor.nombre) &&
        (esTexto(valor.documento) || valor.documento === null) &&
        (esTexto(valor.telefono) || valor.telefono === null) &&
        (esTexto(valor.correo) || valor.correo === null) &&
        typeof valor.activo === "boolean" &&
        esTexto(valor.creadaEn)
    );
}

function esUsuario(valor: unknown): valor is Usuario {
    return (
        esRegistro(valor) &&
        esTexto(valor.id) &&
        esTexto(valor.nombre) &&
        esTexto(valor.apellido) &&
        esTexto(valor.correo) &&
        esTexto(valor.rol) &&
        typeof valor.activo === "boolean" &&
        esTexto(valor.creadaEn)
    );
}

async function cargarTodasLasPaginas<T>(
    ruta: string,
    validar: (elemento: unknown) => elemento is T,
): Promise<T[]> {
    const cargarPagina = async (pagina: number) => {
        const resultado = await apiRequest(
            `${ruta}?pagina=${pagina}&limite=100`,
        );
        if (!esResultadoPaginado(resultado, validar)) {
            throw new Error("La API devolvió datos de reporte no válidos.");
        }
        return resultado;
    };

    const primera = await cargarPagina(1);
    const todos = [...primera.datos];
    const lote = 5;

    for (
        let inicio = 2;
        inicio <= primera.paginacion.totalPaginas;
        inicio += lote
    ) {
        const paginas = Array.from(
            { length: Math.min(lote, primera.paginacion.totalPaginas - inicio + 1) },
            (_, indice) => inicio + indice,
        );
        const resultados = await Promise.all(paginas.map(cargarPagina));
        for (const resultado of resultados) todos.push(...resultado.datos);
    }

    return todos;
}

function nombreCompleto(nombre: string, apellido: string | null) {
    return [nombre, apellido].filter(Boolean).join(" ");
}

function aFila(
    id: string,
    fecha: string,
    celdas: Array<string | number>,
): FilaReporte {
    return {
        id,
        fecha,
        celdas,
        busqueda: celdas.join(" ").toLocaleLowerCase("es"),
    };
}

function formatearImporte(valor: number | string) {
    return new Intl.NumberFormat("es", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(valor));
}

function fechaLegible(valor: string) {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "—";
    return new Intl.DateTimeFormat("es", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(fecha);
}

function estado(activo: boolean) {
    return activo ? "Activo" : "Inactivo";
}

async function cargarReporte(tipo: TipoReporte): Promise<FilaReporte[]> {
    if (tipo === "ventas") {
        const ventas = (await cargarTodasLasPaginas("/ventas", esVenta)).filter(
            (venta) => venta.estado === "CONFIRMADA",
        );
        return ventas.map((venta) => {
            const cliente = nombreCompleto(
                venta.cliente.nombre,
                venta.cliente.apellido,
            );
            const vendedor = nombreCompleto(
                venta.usuario.nombre,
                venta.usuario.apellido,
            );
            return {
                ...aFila(venta.id, venta.creadaEn, [
                    venta.id.slice(0, 8).toUpperCase(),
                    fechaLegible(venta.creadaEn),
                    cliente,
                    vendedor,
                    venta.detalles.reduce(
                        (total, detalle) => total + detalle.cantidad,
                        0,
                    ),
                    formatearImporte(venta.total),
                ]),
                importe: Number(venta.total),
            };
        });
    }

    if (tipo === "compras") {
        const compras = await cargarTodasLasPaginas("/compras", esCompra);
        return compras.map((compra) => {
            const registrador = nombreCompleto(
                compra.usuario.nombre,
                compra.usuario.apellido,
            );
            return {
                ...aFila(compra.id, compra.fechaCompra, [
                    compra.id.slice(0, 8).toUpperCase(),
                    fechaLegible(compra.fechaCompra),
                    compra.proveedor.nombre,
                    registrador,
                    compra.estado === "RECIBIDA" ? "Recibida" : "Pendiente",
                    compra.detalles.reduce(
                        (total, detalle) => total + detalle.cantidad,
                        0,
                    ),
                    formatearImporte(compra.total),
                ]),
                importe: Number(compra.total),
            };
        });
    }

    if (tipo === "inventario") {
        const productos = await cargarTodasLasPaginas(
            "/inventario/productos",
            esProductoInventario,
        );
        return productos.map((producto) =>
            aFila(producto.id, "", [
                producto.sku,
                producto.nombre,
                producto.categoria ?? "Sin categoría",
                producto.stock,
                producto.stockMinimo,
                producto.stock <= producto.stockMinimo ? "Stock bajo" : "Disponible",
            ]),
        );
    }

    if (tipo === "productos") {
        const productos = await cargarTodasLasPaginas("/productos", esProducto);
        return productos.map((producto) =>
            aFila(producto.id, producto.creadaEn, [
                producto.sku,
                producto.nombre,
                producto.categoria ?? "Sin categoría",
                formatearImporte(producto.costo),
                formatearImporte(producto.precioVenta),
                estado(producto.activo),
            ]),
        );
    }

    if (tipo === "clientes") {
        const clientes = await cargarTodasLasPaginas("/clientes", esCliente);
        return clientes.map((cliente) =>
            aFila(cliente.id, cliente.creadaEn, [
                nombreCompleto(cliente.nombre, cliente.apellido),
                cliente.documento ?? "—",
                cliente.telefono ?? "—",
                cliente.correo ?? "—",
                estado(cliente.activo),
                fechaLegible(cliente.creadaEn),
            ]),
        );
    }

    if (tipo === "proveedores") {
        const proveedores = await cargarTodasLasPaginas(
            "/proveedores",
            esProveedor,
        );
        return proveedores.map((proveedor) =>
            aFila(proveedor.id, proveedor.creadaEn, [
                proveedor.nombre,
                proveedor.documento ?? "—",
                proveedor.telefono ?? "—",
                proveedor.correo ?? "—",
                estado(proveedor.activo),
                fechaLegible(proveedor.creadaEn),
            ]),
        );
    }

    const [usuarios, ventasRegistradas] = await Promise.all([
        cargarTodasLasPaginas("/usuarios", esUsuario),
        cargarTodasLasPaginas("/ventas", esVenta),
    ]);
    const ventas = ventasRegistradas.filter(
        (venta) => venta.estado === "CONFIRMADA",
    );
    const vendedores = usuarios.filter(
        (usuario) => usuario.rol === "VENDEDOR",
    );
    const ventasPorVendedor = new Map<
        string,
        Array<{ fecha: string; importe: number }>
    >();
    for (const venta of ventas) {
        const actual = ventasPorVendedor.get(venta.usuario.id) ?? [];
        actual.push({ fecha: venta.creadaEn, importe: Number(venta.total) });
        ventasPorVendedor.set(venta.usuario.id, actual);
    }
    return vendedores.map((vendedor) => {
        const nombre = nombreCompleto(vendedor.nombre, vendedor.apellido);
        const actividad = ventasPorVendedor.get(vendedor.id) ?? [];
        const totalVendido = actividad.reduce(
            (total, venta) => total + venta.importe,
            0,
        );
        return {
            ...aFila(vendedor.id, vendedor.creadaEn, [
                nombre,
                vendedor.correo,
                actividad.length,
                formatearImporte(totalVendido),
                estado(vendedor.activo),
            ]),
            importe: totalVendido,
            cantidad: actividad.length,
            actividad,
        };
    });
}

function protegerValorCsv(valor: string | number) {
    const texto = String(valor);
    const seguro = /^[\s\u0000-\u001f]*[=+\-@]/.test(texto)
        ? `'${texto}`
        : texto;
    return `"${seguro.replaceAll('"', '""')}"`;
}

function descargarCsv(nombre: string, columnas: string[], filas: FilaReporte[]) {
    const contenido = [
        columnas,
        ...filas.map((fila) => fila.celdas),
    ]
        .map((fila) => fila.map(protegerValorCsv).join(","))
        .join("\r\n");
    const archivo = new Blob(["\uFEFF", contenido], {
        type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `reporte-${nombre.toLocaleLowerCase("es")}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
}

export default function ReportesPage() {
    const perfil = usePerfilWorkspace();
    const [tipo, setTipo] = useState<TipoReporte>("ventas");
    const [resultadoReporte, setResultadoReporte] = useState<{
        tipo: TipoReporte;
        filas: FilaReporte[];
        error: string;
    } | null>(null);
    const [busqueda, setBusqueda] = useState("");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");

    const reportesVisibles = useMemo(
        () =>
            reportes.filter(
                (reporte) =>
                    reporte.id !== "vendedores" ||
                    perfil?.rol === "ADMINISTRADOR",
            ),
        [perfil?.rol],
    );
    const reporteActual =
        reportesVisibles.find((reporte) => reporte.id === tipo) ??
        reportesVisibles[0];

    useEffect(() => {
        let cancelada = false;

        void cargarReporte(tipo)
            .then((resultado) => {
                if (!cancelada) {
                    setResultadoReporte({
                        tipo,
                        filas: resultado,
                        error: "",
                    });
                }
            })
            .catch((errorCarga: unknown) => {
                if (!cancelada) {
                    setResultadoReporte({
                        tipo,
                        filas: [],
                        error:
                            errorCarga instanceof Error
                                ? errorCarga.message
                                : "No se pudo cargar el reporte.",
                    });
                }
            });

        return () => {
            cancelada = true;
        };
    }, [tipo]);

    const cargando = resultadoReporte?.tipo !== tipo;
    const error =
        resultadoReporte?.tipo === tipo ? resultadoReporte.error : "";
    const filas =
        resultadoReporte?.tipo === tipo
            ? resultadoReporte.filas
            : filasVacias;

    const filasFiltradas = useMemo(() => {
        const termino = busqueda.trim().toLocaleLowerCase("es");
        const desde = fechaDesde
            ? new Date(`${fechaDesde}T00:00:00`).getTime()
            : Number.NEGATIVE_INFINITY;
        const hasta = fechaHasta
            ? new Date(`${fechaHasta}T23:59:59.999`).getTime()
            : Number.POSITIVE_INFINITY;

        return filas
            .map((fila) => {
                if (tipo !== "vendedores" || !fila.actividad) return fila;
                const actividad = fila.actividad.filter((venta) => {
                    const instante = new Date(venta.fecha).getTime();
                    return (
                        Number.isFinite(instante) &&
                        instante >= desde &&
                        instante <= hasta
                    );
                });
                const importe = actividad.reduce(
                    (total, venta) => total + venta.importe,
                    0,
                );
                const celdas = [...fila.celdas];
                celdas[2] = actividad.length;
                celdas[3] = formatearImporte(importe);
                return {
                    ...fila,
                    celdas,
                    importe,
                    cantidad: actividad.length,
                };
            })
            .filter((fila) => {
            const coincideBusqueda =
                !termino || fila.busqueda.includes(termino);
            if (!reporteActual.filtrarPorFecha) return coincideBusqueda;
            if (tipo === "vendedores") return coincideBusqueda;
            const instante = new Date(fila.fecha).getTime();
            return (
                coincideBusqueda &&
                Number.isFinite(instante) &&
                instante >= desde &&
                instante <= hasta
            );
            });
    }, [
        busqueda,
        fechaDesde,
        fechaHasta,
        filas,
        reporteActual.filtrarPorFecha,
        tipo,
    ]);

    const importeTotal = filasFiltradas.reduce(
        (total, fila) => total + (fila.importe ?? 0),
        0,
    );
    const totalUnidades = filasFiltradas.reduce(
        (total, fila) => total + (fila.cantidad ?? 0),
        0,
    );
    const IconoReporte = reporteActual.icono;

    return (
        <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6">
            <EncabezadoPagina
                kicker="Análisis del negocio"
                titulo="Reportes"
                descripcion="Consulta la actividad y los datos de tu empresa."
                acciones={
                    <button
                        type="button"
                        onClick={() =>
                            descargarCsv(
                                reporteActual.nombre,
                                reporteActual.columnas,
                                filasFiltradas,
                            )
                        }
                        disabled={cargando || Boolean(error) || filasFiltradas.length === 0}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-[13px] font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Download className="size-4" />
                        Exportar CSV
                    </button>
                }
            />

            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                {reportesVisibles.map((reporte) => {
                    const Icono = reporte.icono;
                    const seleccionado = reporte.id === tipo;
                    return (
                        <button
                            key={reporte.id}
                            type="button"
                            onClick={() => {
                                setTipo(reporte.id);
                                setBusqueda("");
                                setFechaDesde("");
                                setFechaHasta("");
                            }}
                            aria-pressed={seleccionado}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition ${
                                seleccionado
                                    ? "border-indigo-400/30 bg-indigo-500/15 text-indigo-200"
                                    : "border-white/[0.08] bg-surface-raised text-slate-400 hover:border-white/15 hover:text-slate-200"
                            }`}
                        >
                            <Icono className="size-4" />
                            {reporte.nombre}
                        </button>
                    );
                })}
            </div>

            <section className="mt-4 rounded-xl border border-white/[0.08] bg-surface-raised">
                <div className="flex flex-col gap-5 border-b border-white/[0.07] p-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-300">
                            <IconoReporte className="size-5" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                Reporte de {reporteActual.nombre.toLocaleLowerCase("es")}
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                {reporteActual.descripcion}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        {reporteActual.filtrarPorFecha && (
                            <>
                                <label className="flex items-center gap-2 text-xs text-slate-400">
                                    Desde
                                    <input
                                        type="date"
                                        value={fechaDesde}
                                        max={fechaHasta || undefined}
                                        onChange={(evento) =>
                                            setFechaDesde(evento.target.value)
                                        }
                                        className="h-9 rounded-lg border border-white/10 bg-surface px-2 text-xs text-slate-200 outline-none focus:border-indigo-400/50"
                                    />
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-400">
                                    Hasta
                                    <input
                                        type="date"
                                        value={fechaHasta}
                                        min={fechaDesde || undefined}
                                        onChange={(evento) =>
                                            setFechaHasta(evento.target.value)
                                        }
                                        className="h-9 rounded-lg border border-white/10 bg-surface px-2 text-xs text-slate-200 outline-none focus:border-indigo-400/50"
                                    />
                                </label>
                            </>
                        )}
                        <label className="relative block sm:w-56">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                            <input
                                type="search"
                                value={busqueda}
                                onChange={(evento) => setBusqueda(evento.target.value)}
                                placeholder="Buscar en el reporte"
                                aria-label="Buscar en el reporte"
                                className="h-9 w-full rounded-lg border border-white/10 bg-surface pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400/50"
                            />
                        </label>
                    </div>
                </div>

                <div className="grid gap-3 border-b border-white/[0.07] p-5 sm:grid-cols-3">
                    <article className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                        <p className="text-xs text-slate-500">Registros</p>
                        <p className="mt-2 text-xl font-semibold text-foreground">
                            {cargando ? "—" : filasFiltradas.length.toLocaleString("es")}
                        </p>
                    </article>
                    {(tipo === "ventas" ||
                        tipo === "compras" ||
                        tipo === "vendedores") && (
                        <article className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                            <p className="text-xs text-slate-500">
                                {tipo === "ventas"
                                    ? "Total vendido"
                                    : tipo === "compras"
                                      ? "Total comprado"
                                      : "Importe vendido"}
                            </p>
                            <p className="mt-2 text-xl font-semibold text-foreground">
                                {cargando ? "—" : formatearImporte(importeTotal)}
                            </p>
                        </article>
                    )}
                    {tipo === "inventario" && (
                        <article className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                            <p className="text-xs text-slate-500">Unidades en existencia</p>
                            <p className="mt-2 text-xl font-semibold text-foreground">
                                {cargando
                                    ? "—"
                                    : filasFiltradas
                                          .reduce(
                                              (total, fila) =>
                                                  total + Number(fila.celdas[3]),
                                              0,
                                          )
                                          .toLocaleString("es")}
                            </p>
                        </article>
                    )}
                    {tipo === "vendedores" && (
                        <article className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                            <p className="text-xs text-slate-500">Ventas registradas</p>
                            <p className="mt-2 text-xl font-semibold text-foreground">
                                {cargando ? "—" : totalUnidades.toLocaleString("es")}
                            </p>
                        </article>
                    )}
                    <article className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                        <p className="text-xs text-slate-500">Datos actualizados</p>
                        <p className="mt-2 text-sm font-medium text-slate-200">
                            {cargando ? "Cargando…" : new Date().toLocaleString("es")}
                        </p>
                    </article>
                </div>

                {error ? (
                    <div
                        role="alert"
                        className="m-5 flex items-start gap-3 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200"
                    >
                        <FileText className="mt-0.5 size-4 shrink-0" />
                        <div>
                            <p className="font-medium">No se pudo cargar el reporte</p>
                            <p className="mt-1 text-xs text-rose-200/75">{error}</p>
                        </div>
                    </div>
                ) : (
                <div
                    className="overflow-x-auto"
                    role="region"
                    aria-label="Tabla del reporte; desplazamiento horizontal"
                    tabIndex={0}
                >
                    <p className="px-5 py-2 text-xs text-slate-400 sm:hidden">
                        Desliza horizontalmente para ver todas las columnas.
                    </p>
                    <table className="w-full min-w-[760px] text-left text-xs">
                            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.1em] text-slate-500">
                                <tr>
                                    {reporteActual.columnas.map((columna) => (
                                        <th
                                            key={columna}
                                            scope="col"
                                            className="px-5 py-3 font-semibold"
                                        >
                                            {columna}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.05]">
                                {cargando ? (
                                    <tr>
                                        <td
                                            colSpan={reporteActual.columnas.length}
                                            className="px-5 py-12 text-center text-slate-500"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Cargando datos del reporte…
                                            </span>
                                        </td>
                                    </tr>
                                ) : filasFiltradas.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={reporteActual.columnas.length}
                                            className="px-5 py-12 text-center text-slate-500"
                                        >
                                            No hay registros para los filtros seleccionados.
                                        </td>
                                    </tr>
                                ) : (
                                    filasFiltradas.map((fila) => (
                                        <tr
                                            key={fila.id}
                                            className="text-slate-300 transition hover:bg-white/[0.025]"
                                        >
                                            {fila.celdas.map((celda, indice) => (
                                                <td
                                                    key={`${fila.id}-${indice}`}
                                                    className="max-w-64 truncate px-5 py-3.5"
                                                    title={String(celda)}
                                                >
                                                    {celda}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
