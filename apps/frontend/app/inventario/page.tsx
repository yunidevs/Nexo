"use client";

import {
    AlertTriangle,
    Boxes,
    Clock3,
    LoaderCircle,
    Package,
    Plus,
    Search,
    X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";

type TipoMovimiento = "ENTRADA" | "SALIDA" | "AJUSTE" | "DEVOLUCION";
type Pestaña = "productos" | "movimientos" | "alertas";

interface Producto {
    id: string;
    sku: string;
    nombre: string;
    stock: number;
    stockMinimo: number;
    categoria: string | null;
}

interface Movimiento {
    id: string;
    tipo: TipoMovimiento;
    cantidad: number;
    stockAnterior: number;
    stockNuevo: number;
    motivo: string;
    creadaEn: string;
    producto: { id: string; sku: string; nombre: string };
    usuario: { nombre: string; apellido: string } | null;
}

interface Resultado<T> {
    datos: T[];
    paginacion: { total: number; totalPaginas: number };
}

const tipoEtiqueta: Record<TipoMovimiento, string> = {
    ENTRADA: "Entrada",
    SALIDA: "Salida",
    AJUSTE: "Ajuste",
    DEVOLUCION: "Devolución",
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null;
}

function esProducto(valor: unknown): valor is Producto {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.sku === "string" &&
        typeof valor.nombre === "string" &&
        typeof valor.stock === "number" &&
        typeof valor.stockMinimo === "number" &&
        (typeof valor.categoria === "string" || valor.categoria === null)
    );
}

function esMovimiento(valor: unknown): valor is Movimiento {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        ["ENTRADA", "SALIDA", "AJUSTE", "DEVOLUCION"].includes(String(valor.tipo)) &&
        typeof valor.cantidad === "number" &&
        typeof valor.stockAnterior === "number" &&
        typeof valor.stockNuevo === "number" &&
        typeof valor.motivo === "string" &&
        typeof valor.creadaEn === "string" &&
        esObjeto(valor.producto) &&
        typeof valor.producto.id === "string" &&
        typeof valor.producto.sku === "string" &&
        typeof valor.producto.nombre === "string" &&
        (valor.usuario === null || esObjeto(valor.usuario))
    );
}

function esResultado<T>(
    valor: unknown,
    validar: (elemento: unknown) => elemento is T,
): valor is Resultado<T> {
    return (
        esObjeto(valor) &&
        Array.isArray(valor.datos) &&
        valor.datos.every(validar) &&
        esObjeto(valor.paginacion) &&
        typeof valor.paginacion.total === "number" &&
        typeof valor.paginacion.totalPaginas === "number"
    );
}

function fecha(valor: string) {
    return new Intl.DateTimeFormat("es", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(valor));
}

export default function InventarioPage() {
    const [pestaña, setPestaña] = useState<Pestaña>("productos");
    const [productos, setProductos] = useState<Producto[]>([]);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [totalProductos, setTotalProductos] = useState(0);
    const [totalMovimientos, setTotalMovimientos] = useState(0);
    const [productosStockBajo, setProductosStockBajo] = useState<Producto[]>([]);
    const [totalStockBajo, setTotalStockBajo] = useState(0);
    const [busqueda, setBusqueda] = useState("");
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
    const [tipo, setTipo] = useState<TipoMovimiento>("ENTRADA");
    const [productoId, setProductoId] = useState("");
    const [cantidad, setCantidad] = useState("");
    const [motivo, setMotivo] = useState("");
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");

    const cargarDatos = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const parametros = new URLSearchParams({ limite: "100", buscar: busqueda });
            const [resultadoProductos, resultadoStockBajo, resultadoMovimientos] = await Promise.all([
                apiRequest(`/inventario/productos?${parametros.toString()}`),
                apiRequest(`/inventario/productos?${new URLSearchParams({ limite: "100", bajoStock: "true" }).toString()}`),
                apiRequest("/inventario/movimientos?limite=100"),
            ]);
            if (
                !esResultado(resultadoProductos, esProducto) ||
                !esResultado(resultadoStockBajo, esProducto) ||
                !esResultado(resultadoMovimientos, esMovimiento)
            ) {
                throw new Error("La API devolvió datos de inventario no válidos.");
            }
            setProductos(resultadoProductos.datos);
            setTotalProductos(resultadoProductos.paginacion.total);
            setProductosStockBajo(resultadoStockBajo.datos);
            setTotalStockBajo(resultadoStockBajo.paginacion.total);
            setMovimientos(resultadoMovimientos.datos);
            setTotalMovimientos(resultadoMovimientos.paginacion.total);
            setProductoId((actual) =>
                resultadoProductos.datos.some((producto) => producto.id === actual)
                    ? actual
                    : resultadoProductos.datos[0]?.id ?? "",
            );
        } catch (cargaError) {
            setError(
                cargaError instanceof Error
                    ? cargaError.message
                    : "No se pudo cargar el inventario.",
            );
        } finally {
            setCargando(false);
        }
    }, [busqueda]);

    useEffect(() => {
        const temporizador = window.setTimeout(() => void cargarDatos(), 250);
        return () => window.clearTimeout(temporizador);
    }, [cargarDatos]);

    const productosVisibles =
        pestaña === "alertas" ? productosStockBajo : productos;

    async function registrar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");
        setMensaje("");
        try {
            await apiRequest("/inventario/movimientos", "POST", {
                productoId,
                tipo,
                cantidad: Number(cantidad),
                motivo: motivo.trim(),
            });
            setMostrarFormulario(false);
            setCantidad("");
            setMotivo("");
            setMensaje("Movimiento registrado correctamente.");
            await cargarDatos();
        } catch (registroError) {
            setError(
                registroError instanceof Error
                    ? registroError.message
                    : "No se pudo registrar el movimiento.",
            );
        } finally {
            setGuardando(false);
        }
    }

    return (
            <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
                            Gestión
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                            Inventario
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Controla existencias, movimientos y alertas de stock bajo.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setError("");
                            setMostrarFormulario(true);
                        }}
                        disabled={productos.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Plus className="size-4" />
                        Registrar movimiento
                    </button>
                </header>

                <section className="mt-7 grid gap-3 sm:grid-cols-3">
                    <Resumen icono={Package} etiqueta="Productos" valor={totalProductos} />
                    <Resumen
                        icono={AlertTriangle}
                        etiqueta="Stock bajo"
                        valor={totalStockBajo}
                        advertencia
                    />
                    <Resumen icono={Clock3} etiqueta="Movimientos" valor={totalMovimientos} />
                </section>

                {error && (
                    <p role="alert" className="mt-5 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </p>
                )}
                {mensaje && (
                    <p role="status" className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                        {mensaje}
                    </p>
                )}

                <section className="mt-7 overflow-hidden rounded-xl border border-white/[0.08] bg-surface">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-4">
                        <div className="flex gap-1">
                            {([
                                ["productos", "Existencias"],
                                ["movimientos", "Historial"],
                                ["alertas", `Stock bajo${totalStockBajo ? ` (${totalStockBajo})` : ""}`],
                            ] as const).map(([id, etiqueta]) => (
                                <button
                                    type="button"
                                    key={id}
                                    onClick={() => setPestaña(id)}
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                                        pestaña === id
                                            ? "bg-indigo-500/15 text-indigo-200"
                                            : "text-slate-400 hover:bg-white/[0.04] hover:text-foreground"
                                    }`}
                                >
                                    {etiqueta}
                                </button>
                            ))}
                        </div>
                        {pestaña !== "movimientos" && (
                            <label className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-slate-400 focus-within:border-indigo-400/50">
                                <Search className="size-4 shrink-0" />
                                <input
                                    value={busqueda}
                                    onChange={(evento) => setBusqueda(evento.target.value)}
                                    placeholder="Buscar producto..."
                                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-slate-600"
                                />
                            </label>
                        )}
                    </div>

                    {cargando ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-400">
                            <LoaderCircle className="size-4 animate-spin" /> Cargando inventario...
                        </div>
                    ) : pestaña === "movimientos" ? (
                        <div
                            className="overflow-x-auto"
                            role="region"
                            aria-label="Movimientos de inventario; desplazamiento horizontal"
                            tabIndex={0}
                        >
                            <p className="px-5 py-2 text-xs text-slate-400 sm:hidden">
                                Desliza horizontalmente para ver todas las columnas.
                            </p>
                            <table className="w-full min-w-[720px] text-left text-sm">
                                <thead className="text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3 font-medium">Fecha</th>
                                        <th className="px-5 py-3 font-medium">Producto</th>
                                        <th className="px-5 py-3 font-medium">Tipo</th>
                                        <th className="px-5 py-3 font-medium">Variación</th>
                                        <th className="px-5 py-3 font-medium">Stock resultante</th>
                                        <th className="px-5 py-3 font-medium">Motivo / usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {movimientos.map((movimiento) => (
                                        <tr key={movimiento.id} className="text-slate-300">
                                            <td className="px-5 py-4 text-slate-400">{fecha(movimiento.creadaEn)}</td>
                                            <td className="px-5 py-4">
                                                <p className="font-medium text-foreground">{movimiento.producto.nombre}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">{movimiento.producto.sku}</p>
                                            </td>
                                            <td className="px-5 py-4">{tipoEtiqueta[movimiento.tipo]}</td>
                                            <td className={`px-5 py-4 font-semibold ${movimiento.cantidad < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                                                {movimiento.cantidad > 0 ? "+" : ""}{movimiento.cantidad}
                                            </td>
                                            <td className="px-5 py-4">{movimiento.stockAnterior} → {movimiento.stockNuevo}</td>
                                            <td className="px-5 py-4">
                                                <p>{movimiento.motivo}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {movimiento.usuario
                                                        ? `${movimiento.usuario.nombre} ${movimiento.usuario.apellido}`
                                                        : "Usuario eliminado"}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}
                                    {movimientos.length === 0 && <FilaVacia>Sin movimientos registrados.</FilaVacia>}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div
                            className="overflow-x-auto"
                            role="region"
                            aria-label="Productos de inventario; desplazamiento horizontal"
                            tabIndex={0}
                        >
                            <p className="px-5 py-2 text-xs text-slate-400 sm:hidden">
                                Desliza horizontalmente para ver todas las columnas.
                            </p>
                            <table className="w-full min-w-[640px] text-left text-sm">
                                <thead className="text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3 font-medium">Producto</th>
                                        <th className="px-5 py-3 font-medium">Categoría</th>
                                        <th className="px-5 py-3 font-medium">Existencias</th>
                                        <th className="px-5 py-3 font-medium">Mínimo</th>
                                        <th className="px-5 py-3 font-medium">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {productosVisibles.map((producto) => {
                                        const bajo = producto.stock <= producto.stockMinimo;
                                        return (
                                            <tr key={producto.id} className="text-slate-300">
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-foreground">{producto.nombre}</p>
                                                    <p className="mt-0.5 text-xs text-slate-500">{producto.sku}</p>
                                                </td>
                                                <td className="px-5 py-4">{producto.categoria ?? "Sin categoría"}</td>
                                                <td className={`px-5 py-4 text-base font-semibold ${bajo ? "text-amber-300" : "text-foreground"}`}>{producto.stock}</td>
                                                <td className="px-5 py-4">{producto.stockMinimo}</td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bajo ? "bg-amber-400/10 text-amber-200" : "bg-emerald-400/10 text-emerald-200"}`}>
                                                        {bajo && <AlertTriangle className="size-3" />}
                                                        {bajo ? "Stock bajo" : "Disponible"}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {productosVisibles.length === 0 && (
                                        <FilaVacia>
                                            {pestaña === "alertas" ? "No hay productos con stock bajo." : "No hay productos para mostrar."}
                                        </FilaVacia>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {mostrarFormulario && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="titulo-movimiento"
                            className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">Control de existencias</p>
                                    <h2 id="titulo-movimiento" className="mt-2 text-xl font-semibold text-foreground">Registrar movimiento</h2>
                                </div>
                                <button type="button" onClick={() => setMostrarFormulario(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-foreground" aria-label="Cerrar formulario"><X className="size-4" /></button>
                            </div>
                            <form onSubmit={registrar} className="mt-6 space-y-4">
                                <label className="block text-sm text-slate-300">
                                    Tipo de movimiento
                                    <select value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoMovimiento)} className="mt-2 w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-foreground outline-none focus:border-indigo-400">
                                        <option value="ENTRADA">Entrada</option>
                                        <option value="SALIDA">Salida</option>
                                        <option value="AJUSTE">Ajuste de stock (+/-)</option>
                                        <option value="DEVOLUCION">Devolución</option>
                                    </select>
                                </label>
                                <label className="block text-sm text-slate-300">
                                    Producto
                                    <select required value={productoId} onChange={(evento) => setProductoId(evento.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-foreground outline-none focus:border-indigo-400">
                                        {productos.map((producto) => <option key={producto.id} value={producto.id}>{producto.sku} · {producto.nombre} (stock: {producto.stock})</option>)}
                                    </select>
                                </label>
                                <label className="block text-sm text-slate-300">
                                    {tipo === "AJUSTE" ? "Variación de unidades (+/-)" : "Unidades"}
                                    <input required type="number" step="1" min={tipo === "AJUSTE" ? -2147483647 : 1} max="2147483647" value={cantidad} onChange={(evento) => setCantidad(evento.target.value)} placeholder={tipo === "AJUSTE" ? "Ej. -2 o 5" : "Ej. 10"} className="mt-2 w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-foreground outline-none placeholder:text-slate-600 focus:border-indigo-400" />
                                </label>
                                <label className="block text-sm text-slate-300">
                                    Motivo
                                    <input required minLength={2} maxLength={300} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} placeholder="Compra, venta, conteo físico..." className="mt-2 w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-foreground outline-none placeholder:text-slate-600 focus:border-indigo-400" />
                                </label>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setMostrarFormulario(false)} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]">Cancelar</button>
                                    <button type="submit" disabled={guardando || !productoId} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50">
                                        {guardando && <LoaderCircle className="size-4 animate-spin" />} Guardar movimiento
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </main>
    );
}

function Resumen({
    icono: Icono,
    etiqueta,
    valor,
    advertencia = false,
}: {
    icono: typeof Boxes;
    etiqueta: string;
    valor: number;
    advertencia?: boolean;
}) {
    return (
        <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-surface p-4">
            <span className={`grid size-10 place-items-center rounded-lg ${advertencia ? "bg-amber-400/10 text-amber-300" : "bg-indigo-400/10 text-indigo-300"}`}>
                <Icono className="size-5" />
            </span>
            <div>
                <p className="text-xs text-slate-400">{etiqueta}</p>
                <p className="mt-0.5 text-2xl font-semibold text-foreground">{valor}</p>
            </div>
        </div>
    );
}

function FilaVacia({ children }: { children: string }) {
    return (
        <tr>
            <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">{children}</td>
        </tr>
    );
}
