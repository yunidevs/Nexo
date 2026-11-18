"use client";

import {
    Check,
    CircleAlert,
    CreditCard,
    LoaderCircle,
    Plus,
    ShoppingCart,
    X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";

interface Proveedor {
    id: string;
    nombre: string;
}

interface Producto {
    id: string;
    sku: string;
    nombre: string;
    costo: number;
}

interface Detalle {
    id: string;
    cantidad: number;
    costoUnitario: number | string;
    subtotal: number | string;
    producto: { id: string; sku: string; nombre: string };
}

type MetodoPago =
    | "EFECTIVO"
    | "TARJETA"
    | "TRANSFERENCIA"
    | "OTRO";

interface Pago {
    id: string;
    metodo: MetodoPago;
    monto: number | string;
    creadaEn: string;
}

interface Compra {
    id: string;
    estado: "PENDIENTE" | "RECIBIDA";
    total: number | string;
    fechaCompra: string;
    creadaEn: string;
    recibidaEn: string | null;
    proveedor: Proveedor;
    detalles: Detalle[];
    pagos: Pago[];
}

interface LineaFormulario {
    productoId: string;
    cantidad: string;
    costoUnitario: string;
}

const metodoEtiqueta: Record<MetodoPago, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    OTRO: "Otros",
};

function esMetodoPago(valor: string): valor is MetodoPago {
    return Object.hasOwn(metodoEtiqueta, valor);
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null;
}

function esResultado<T>(
    valor: unknown,
    validar: (elemento: unknown) => elemento is T,
): valor is { datos: T[] } {
    return (
        esObjeto(valor) &&
        Array.isArray(valor.datos) &&
        valor.datos.every(validar)
    );
}

function esProveedor(valor: unknown): valor is Proveedor {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.nombre === "string"
    );
}

function esProducto(valor: unknown): valor is Producto {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.sku === "string" &&
        typeof valor.nombre === "string" &&
        (typeof valor.costo === "number" || typeof valor.costo === "string")
    );
}

function esDetalle(valor: unknown): valor is Detalle {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.cantidad === "number" &&
        (typeof valor.costoUnitario === "number" ||
            typeof valor.costoUnitario === "string") &&
        (typeof valor.subtotal === "number" ||
            typeof valor.subtotal === "string") &&
        esObjeto(valor.producto) &&
        typeof valor.producto.id === "string" &&
        typeof valor.producto.sku === "string" &&
        typeof valor.producto.nombre === "string"
    );
}

function esPago(valor: unknown): valor is Pago {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"].includes(
            String(valor.metodo),
        ) &&
        (typeof valor.monto === "number" ||
            typeof valor.monto === "string") &&
        typeof valor.creadaEn === "string"
    );
}

function esCompra(valor: unknown): valor is Compra {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        (valor.estado === "PENDIENTE" || valor.estado === "RECIBIDA") &&
        (typeof valor.total === "number" || typeof valor.total === "string") &&
        typeof valor.fechaCompra === "string" &&
        typeof valor.creadaEn === "string" &&
        (typeof valor.recibidaEn === "string" || valor.recibidaEn === null) &&
        esProveedor(valor.proveedor) &&
        Array.isArray(valor.detalles) &&
        valor.detalles.every(esDetalle) &&
        Array.isArray(valor.pagos) &&
        valor.pagos.every(esPago)
    );
}

function hoyLocal() {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
}

function importe(valor: number | string) {
    return new Intl.NumberFormat("es", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(valor));
}

function fechaLegible(valor: string) {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "Fecha no disponible";
    return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(fecha);
}

export default function ComprasPage() {
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [compras, setCompras] = useState<Compra[]>([]);
    const [proveedorId, setProveedorId] = useState("");
    const [fechaCompra, setFechaCompra] = useState(hoyLocal);
    const [lineas, setLineas] = useState<LineaFormulario[]>([
        { productoId: "", cantidad: "1", costoUnitario: "0" },
    ]);
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [recibiendo, setRecibiendo] = useState<string | null>(null);
    const [compraPago, setCompraPago] = useState("");
    const [montoPago, setMontoPago] = useState("");
    const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
    const [guardandoPago, setGuardandoPago] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");

    const cargarDatos = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [resultadoCompras, resultadoProveedores, resultadoProductos] =
                await Promise.all([
                    apiRequest("/compras?limite=100"),
                    apiRequest("/proveedores?limite=100&activo=true"),
                    apiRequest("/productos?limite=100&activo=true"),
                ]);
            if (
                !esResultado(resultadoCompras, esCompra) ||
                !esResultado(resultadoProveedores, esProveedor) ||
                !esResultado(resultadoProductos, esProducto)
            ) {
                throw new Error("La API devolvió datos de compras no válidos.");
            }

            setCompras(resultadoCompras.datos);
            setProveedores(resultadoProveedores.datos);
            setProductos(resultadoProductos.datos);
            setProveedorId((actual) =>
                resultadoProveedores.datos.some(({ id }) => id === actual)
                    ? actual
                    : resultadoProveedores.datos[0]?.id ?? "",
            );
            setLineas((actuales) =>
                actuales.map((linea) => {
                    if (
                        resultadoProductos.datos.some(
                            ({ id }) => id === linea.productoId,
                        )
                    ) {
                        return linea;
                    }
                    const producto = resultadoProductos.datos[0];
                    return producto
                        ? {
                              ...linea,
                              productoId: producto.id,
                              costoUnitario: String(producto.costo),
                          }
                        : linea;
                }),
            );
        } catch (cargaError) {
            setError(
                cargaError instanceof Error
                    ? cargaError.message
                    : "No se pudieron cargar las compras.",
            );
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        const tarea = window.setTimeout(() => void cargarDatos(), 0);
        return () => window.clearTimeout(tarea);
    }, [cargarDatos]);

    const total = lineas.reduce(
        (suma, linea) =>
            suma +
            (Number(linea.cantidad) || 0) *
                (Number(linea.costoUnitario) || 0),
        0,
    );

    function actualizarLinea(
        indice: number,
        cambios: Partial<LineaFormulario>,
    ) {
        setLineas((actuales) =>
            actuales.map((linea, posicion) =>
                posicion === indice ? { ...linea, ...cambios } : linea,
            ),
        );
    }

    async function crearCompra(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");
        setMensaje("");
        try {
            await apiRequest("/compras", "POST", {
                proveedorId,
                fechaCompra,
                detalles: lineas.map((linea) => ({
                    productoId: linea.productoId,
                    cantidad: Number(linea.cantidad),
                    costoUnitario: Number(linea.costoUnitario),
                })),
            });
            setMostrarFormulario(false);
            setFechaCompra(hoyLocal());
            setMensaje("Compra creada. Recibe la mercancía para actualizar el inventario.");
            await cargarDatos();
        } catch (registroError) {
            setError(
                registroError instanceof Error
                    ? registroError.message
                    : "No se pudo crear la compra.",
            );
        } finally {
            setGuardando(false);
        }
    }

    async function recibirCompra(compraId: string) {
        setRecibiendo(compraId);
        setError("");
        setMensaje("");
        try {
            await apiRequest(`/compras/${compraId}/recibir`, "POST");
            setMensaje("Mercancía recibida e inventario actualizado.");
            await cargarDatos();
        } catch (recepcionError) {
            setError(
                recepcionError instanceof Error
                    ? recepcionError.message
                    : "No se pudo recibir la compra.",
            );
        } finally {
            setRecibiendo(null);
        }
    }

    async function registrarPago(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!compraPago) return;
        setGuardandoPago(true);
        setError("");
        setMensaje("");
        try {
            await apiRequest(`/compras/${compraPago}/pagos`, "POST", {
                monto: Number(montoPago),
                metodo: metodoPago,
            });
            setCompraPago("");
            setMontoPago("");
            setMensaje("El pago se registró correctamente.");
            await cargarDatos();
        } catch (pagoError) {
            setError(
                pagoError instanceof Error
                    ? pagoError.message
                    : "No se pudo registrar el pago.",
            );
        } finally {
            setGuardandoPago(false);
        }
    }

    return (
            <div className="mx-auto w-full max-w-7xl">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
                            Gestión
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                            Compras
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Registra pedidos a proveedores y recibe mercancía en inventario.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setError("");
                            setMostrarFormulario((actual) => !actual);
                        }}
                        disabled={!proveedores.length || !productos.length}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {mostrarFormulario ? (
                            <X className="size-4" />
                        ) : (
                            <Plus className="size-4" />
                        )}
                        {mostrarFormulario ? "Cancelar" : "Crear compra"}
                    </button>
                </header>

                {error && (
                    <div
                        role="alert"
                        className="mt-6 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
                    >
                        <CircleAlert className="mt-0.5 size-4 shrink-0" />
                        {error}
                    </div>
                )}
                {mensaje && (
                    <div
                        role="status"
                        className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-200"
                    >
                        {mensaje}
                    </div>
                )}

                {mostrarFormulario && (
                    <form
                        onSubmit={(evento) => void crearCompra(evento)}
                        className="mt-7 rounded-xl border border-white/[0.08] bg-surface-raised p-5 sm:p-6"
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-2 text-xs font-medium text-slate-300">
                                Proveedor
                                <select
                                    required
                                    value={proveedorId}
                                    onChange={(evento) =>
                                        setProveedorId(evento.target.value)
                                    }
                                    className="rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                                >
                                    {proveedores.map((proveedor) => (
                                        <option
                                            key={proveedor.id}
                                            value={proveedor.id}
                                        >
                                            {proveedor.nombre}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-2 text-xs font-medium text-slate-300">
                                Fecha de compra
                                <input
                                    required
                                    type="date"
                                    value={fechaCompra}
                                    onChange={(evento) =>
                                        setFechaCompra(evento.target.value)
                                    }
                                    className="rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                                />
                            </label>
                        </div>

                        <div className="mt-6 space-y-3">
                            <div className="grid gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:grid-cols-[minmax(0,1fr)_100px_140px_130px_36px]">
                                <span>Producto</span>
                                <span>Cantidad</span>
                                <span>Costo unitario</span>
                                <span className="text-right">Subtotal</span>
                                <span />
                            </div>
                            {lineas.map((linea, indice) => (
                                <div
                                    key={indice}
                                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_140px_130px_36px]"
                                >
                                    <select
                                        required
                                        value={linea.productoId}
                                        onChange={(evento) => {
                                            const producto = productos.find(
                                                ({ id }) =>
                                                    id === evento.target.value,
                                            );
                                            actualizarLinea(indice, {
                                                productoId: evento.target.value,
                                                costoUnitario: producto
                                                    ? String(producto.costo)
                                                    : "0",
                                            });
                                        }}
                                        className="min-w-0 rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                                    >
                                        {productos.map((producto) => (
                                            <option
                                                key={producto.id}
                                                value={producto.id}
                                                disabled={lineas.some(
                                                    (otra, posicion) =>
                                                        posicion !== indice &&
                                                        otra.productoId ===
                                                            producto.id,
                                                )}
                                            >
                                                {producto.sku} — {producto.nombre}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={linea.cantidad}
                                        onChange={(evento) =>
                                            actualizarLinea(indice, {
                                                cantidad: evento.target.value,
                                            })
                                        }
                                        aria-label="Cantidad"
                                        className="rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                                    />
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={linea.costoUnitario}
                                        onChange={(evento) =>
                                            actualizarLinea(indice, {
                                                costoUnitario:
                                                    evento.target.value,
                                            })
                                        }
                                        aria-label="Costo unitario"
                                        className="rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                                    />
                                    <p className="self-center text-right text-sm text-slate-200">
                                        {importe(
                                            (Number(linea.cantidad) || 0) *
                                                (Number(
                                                    linea.costoUnitario,
                                                ) || 0),
                                        )}
                                    </p>
                                    <button
                                        type="button"
                                        disabled={lineas.length === 1}
                                        aria-label="Quitar producto"
                                        onClick={() =>
                                            setLineas((actuales) =>
                                                actuales.filter(
                                                    (_, posicion) =>
                                                        posicion !== indice,
                                                ),
                                            )
                                        }
                                        className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-foreground disabled:opacity-30"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                disabled={lineas.length >= productos.length}
                                onClick={() =>
                                    setLineas((actuales) => {
                                        const producto = productos.find(
                                            ({ id }) =>
                                                !actuales.some(
                                                    (linea) =>
                                                        linea.productoId === id,
                                                ),
                                        );
                                        return producto
                                            ? [
                                                  ...actuales,
                                                  {
                                                      productoId: producto.id,
                                                      cantidad: "1",
                                                      costoUnitario: String(
                                                          producto.costo,
                                                      ),
                                                  },
                                              ]
                                            : actuales;
                                    })
                                }
                                className="inline-flex items-center gap-1.5 py-2 text-xs font-medium text-indigo-300 hover:text-indigo-200 disabled:opacity-50"
                            >
                                <Plus className="size-3.5" />
                                Agregar producto
                            </button>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
                            <p className="text-sm text-slate-400">
                                Total de compra{" "}
                                <strong className="ml-2 text-xl text-foreground">
                                    {importe(total)}
                                </strong>
                            </p>
                            <button
                                type="submit"
                                disabled={
                                    guardando ||
                                    !proveedorId ||
                                    lineas.some(
                                        (linea) =>
                                            !linea.productoId ||
                                            Number(linea.cantidad) < 1 ||
                                            Number(linea.costoUnitario) < 0,
                                    )
                                }
                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                            >
                                {guardando && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                Guardar compra pendiente
                            </button>
                        </div>
                    </form>
                )}

                {(!proveedores.length || !productos.length) && !cargando && (
                    <p className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
                        Para crear compras necesitas al menos un proveedor y un
                        producto activo.
                    </p>
                )}

                <section className="mt-7 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-raised">
                    <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">
                                Registro de compras
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Recibir una compra aumenta las existencias y registra el movimiento.
                            </p>
                        </div>
                        <ShoppingCart className="size-5 text-indigo-300" />
                    </div>
                    {cargando ? (
                        <p className="px-5 py-10 text-center text-sm text-slate-500">
                            Cargando compras...
                        </p>
                    ) : compras.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <p className="text-sm font-medium text-slate-300">
                                Aún no hay compras registradas
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Crea una compra para asociar productos y proveedor.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-white/[0.06]">
                            {compras.map((compra) => {
                                const abonado = compra.pagos.reduce(
                                    (suma, pago) => suma + Number(pago.monto),
                                    0,
                                );
                                const saldo = Math.max(
                                    0,
                                    Number(compra.total) - abonado,
                                );
                                return (
                                <li
                                    key={compra.id}
                                    className="flex flex-col gap-3 px-5 py-4"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-foreground">
                                                {compra.proveedor.nombre}
                                            </p>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    compra.estado === "RECIBIDA"
                                                        ? "bg-emerald-400/10 text-emerald-300"
                                                        : "bg-amber-400/10 text-amber-300"
                                                }`}
                                            >
                                                {compra.estado === "RECIBIDA"
                                                    ? "Recibida"
                                                    : "Pendiente"}
                                            </span>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    saldo <= 0
                                                        ? "bg-emerald-400/10 text-emerald-300"
                                                        : "bg-amber-400/10 text-amber-300"
                                                }`}
                                            >
                                                {saldo <= 0 ? "Pagada" : "Saldo pendiente"}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {fechaLegible(compra.fechaCompra)} ·{" "}
                                            {compra.detalles
                                                .map(
                                                    ({ producto, cantidad }) =>
                                                        `${cantidad} × ${producto.nombre}`,
                                                )
                                                .join(", ")}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-foreground">
                                            {importe(compra.total)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Pagado {importe(abonado)} · Saldo{" "}
                                            {importe(saldo)}
                                        </p>
                                    </div>
                                    {compra.estado === "PENDIENTE" && (
                                        <button
                                            type="button"
                                            disabled={recibiendo !== null}
                                            onClick={() =>
                                                void recibirCompra(compra.id)
                                            }
                                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/[0.08] disabled:opacity-50"
                                        >
                                            {recibiendo === compra.id ? (
                                                <LoaderCircle className="size-3.5 animate-spin" />
                                            ) : (
                                                <Check className="size-3.5" />
                                            )}
                                            Recibir mercancía
                                        </button>
                                    )}
                                    </div>
                                    {(compra.pagos.length > 0 || saldo > 0) && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                                {compra.pagos.map((pago) => (
                                                    <span key={pago.id}>
                                                        {metodoEtiqueta[pago.metodo]}{" "}
                                                        {importe(pago.monto)}
                                                    </span>
                                                ))}
                                            </div>
                                            {saldo > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCompraPago(compra.id);
                                                        setMontoPago(saldo.toFixed(2));
                                                        setError("");
                                                    }}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/20 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-400/[0.08]"
                                                >
                                                    <CreditCard className="size-3.5" />
                                                    Registrar pago
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {compraPago === compra.id && saldo > 0 && (
                                        <form
                                            onSubmit={(evento) =>
                                                void registrarPago(evento)
                                            }
                                            className="grid gap-3 rounded-lg border border-white/[0.07] bg-surface p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
                                        >
                                            <label className="grid gap-1.5 text-xs text-slate-400">
                                                Monto (saldo {importe(saldo)})
                                                <input
                                                    required
                                                    type="number"
                                                    min="0.01"
                                                    max={saldo}
                                                    step="0.01"
                                                    value={montoPago}
                                                    onChange={(evento) =>
                                                        setMontoPago(evento.target.value)
                                                    }
                                                    className="rounded-lg border border-white/10 bg-surface-raised px-3 py-2 text-sm text-foreground"
                                                />
                                            </label>
                                            <label className="grid gap-1.5 text-xs text-slate-400">
                                                Método
                                                <select
                                                    value={metodoPago}
                                                    onChange={(evento) => {
                                                        const valor =
                                                            evento.target.value;
                                                        if (esMetodoPago(valor)) {
                                                            setMetodoPago(valor);
                                                        }
                                                    }}
                                                    className="rounded-lg border border-white/10 bg-surface-raised px-3 py-2 text-sm text-foreground"
                                                >
                                                    {Object.entries(metodoEtiqueta).map(
                                                        ([valor, etiqueta]) => (
                                                            <option key={valor} value={valor}>
                                                                {etiqueta}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </label>
                                            <button
                                                type="submit"
                                                disabled={
                                                    guardandoPago ||
                                                    Number(montoPago) <= 0 ||
                                                    Number(montoPago) > saldo
                                                }
                                                className="self-end rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                            >
                                                {guardandoPago ? "Guardando..." : "Guardar pago"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCompraPago("")}
                                                className="self-end rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.05]"
                                            >
                                                Cancelar
                                            </button>
                                        </form>
                                    )}
                                </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
    );
}
