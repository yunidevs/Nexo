"use client";

import {
    CircleAlert,
    CreditCard,
    LoaderCircle,
    Plus,
    ReceiptText,
    X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import { EncabezadoPagina } from "@/app/components/encabezado-pagina";

type MetodoPago =
    | "EFECTIVO"
    | "TARJETA"
    | "TRANSFERENCIA"
    | "OTRO"
    | "MERCADO_PAGO"
    | "PAYPAL"
    | "DLOCAL_GO";

interface Cliente {
    id: string;
    nombre: string;
    apellido: string | null;
}

interface Producto {
    id: string;
    sku: string;
    nombre: string;
    precioVenta: number | string;
    stock: number;
}

interface ExistenciaProducto {
    id: string;
    stock: number;
}

interface Detalle {
    id: string;
    cantidad: number;
    precioUnitario: number | string;
    subtotal: number | string;
    producto: { id: string; sku: string; nombre: string };
}

interface Pago {
    id: string;
    metodo: MetodoPago;
    monto: number | string;
    creadaEn: string;
}

interface Venta {
    id: string;
    estado: "CONFIRMADA" | "CANCELADA";
    subtotal: number | string;
    descuento: number | string;
    costoEnvio: number | string;
    tasaImpuesto: number | string;
    impuesto: number | string;
    total: number | string;
    creadaEn: string;
    cliente: Cliente;
    detalles: Detalle[];
    pagos: Pago[];
}

interface LineaFormulario {
    productoId: string;
    cantidad: string;
}

const metodoEtiqueta: Record<MetodoPago, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    OTRO: "Otro",
    MERCADO_PAGO: "Mercado Pago",
    PAYPAL: "PayPal",
    DLOCAL_GO: "dLocal Go",
};
const metodosPagoManual: MetodoPago[] = [
    "EFECTIVO",
    "TARJETA",
    "TRANSFERENCIA",
    "OTRO",
];

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

function esCliente(valor: unknown): valor is Cliente {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.nombre === "string" &&
        (typeof valor.apellido === "string" || valor.apellido === null)
    );
}

function esProducto(valor: unknown): valor is Producto {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.sku === "string" &&
        typeof valor.nombre === "string" &&
        (typeof valor.precioVenta === "number" ||
            typeof valor.precioVenta === "string")
    );
}

function esExistenciaProducto(valor: unknown): valor is ExistenciaProducto {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.stock === "number"
    );
}

function esDetalle(valor: unknown): valor is Detalle {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.cantidad === "number" &&
        (typeof valor.precioUnitario === "number" ||
            typeof valor.precioUnitario === "string") &&
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
        [
            "EFECTIVO",
            "TARJETA",
            "TRANSFERENCIA",
            "OTRO",
            "MERCADO_PAGO",
            "PAYPAL",
            "DLOCAL_GO",
        ].includes(String(valor.metodo)) &&
        (typeof valor.monto === "number" ||
            typeof valor.monto === "string") &&
        typeof valor.creadaEn === "string"
    );
}

function esVenta(valor: unknown): valor is Venta {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        (valor.estado === "CONFIRMADA" || valor.estado === "CANCELADA") &&
        (typeof valor.subtotal === "number" ||
            typeof valor.subtotal === "string") &&
        (typeof valor.descuento === "number" ||
            typeof valor.descuento === "string") &&
        (typeof valor.costoEnvio === "number" ||
            typeof valor.costoEnvio === "string") &&
        (typeof valor.tasaImpuesto === "number" ||
            typeof valor.tasaImpuesto === "string") &&
        (typeof valor.impuesto === "number" ||
            typeof valor.impuesto === "string") &&
        (typeof valor.total === "number" || typeof valor.total === "string") &&
        typeof valor.creadaEn === "string" &&
        esCliente(valor.cliente) &&
        Array.isArray(valor.detalles) &&
        valor.detalles.every(esDetalle) &&
        Array.isArray(valor.pagos) &&
        valor.pagos.every(esPago)
    );
}

function dinero(valor: number | string) {
    return new Intl.NumberFormat("es", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(valor));
}

function fechaLegible(valor: string) {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "Fecha no disponible";
    return new Intl.DateTimeFormat("es", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(fecha);
}

function esEmpresaConImpuesto(
    valor: unknown,
): valor is { tasaImpuesto: number | string } {
    return (
        esObjeto(valor) &&
        (typeof valor.tasaImpuesto === "number" ||
            typeof valor.tasaImpuesto === "string")
    );
}

function clienteNombre(cliente: Cliente) {
    return `${cliente.nombre} ${cliente.apellido ?? ""}`.trim();
}

export default function VentasPage() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [tasaImpuesto, setTasaImpuesto] = useState(0);
    const [clienteId, setClienteId] = useState("");
    const [descuento, setDescuento] = useState("0");
    const [pagoInicial, setPagoInicial] = useState("");
    const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
    const [lineas, setLineas] = useState<LineaFormulario[]>([
        { productoId: "", cantidad: "1" },
    ]);
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
    const [ventaPago, setVentaPago] = useState("");
    const [montoPago, setMontoPago] = useState("");
    const [metodoPagoAdicional, setMetodoPagoAdicional] =
        useState<MetodoPago>("EFECTIVO");
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [guardandoPago, setGuardandoPago] = useState(false);
    const [cancelandoVentaId, setCancelandoVentaId] = useState("");
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");

    const cargarDatos = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [
                resultadoVentas,
                resultadoClientes,
                resultadoProductos,
                resultadoExistencias,
                empresa,
            ] =
                await Promise.all([
                    apiRequest("/ventas?limite=100"),
                    apiRequest("/clientes?limite=100&activo=true"),
                    apiRequest("/productos?limite=100&activo=true"),
                    apiRequest("/inventario/productos?limite=100"),
                    apiRequest("/empresa"),
                ]);
            if (
                !esResultado(resultadoVentas, esVenta) ||
                !esResultado(resultadoClientes, esCliente) ||
                !esResultado(resultadoProductos, esProducto) ||
                !esResultado(resultadoExistencias, esExistenciaProducto) ||
                !esObjeto(empresa) ||
                !esEmpresaConImpuesto(empresa.empresa)
            ) {
                throw new Error("La API devolvió datos de ventas no válidos.");
            }

            setVentas(resultadoVentas.datos);
            setClientes(resultadoClientes.datos);
            const existencias = new Map(
                resultadoExistencias.datos.map(({ id, stock }) => [
                    id,
                    stock,
                ]),
            );
            setProductos(
                resultadoProductos.datos
                    .map((producto) => ({
                        ...producto,
                        stock: existencias.get(producto.id) ?? 0,
                    }))
                    .filter(({ stock }) => stock > 0),
            );
            setTasaImpuesto(Number(empresa.empresa.tasaImpuesto));
            setClienteId((actual) =>
                resultadoClientes.datos.some(({ id }) => id === actual)
                    ? actual
                    : resultadoClientes.datos[0]?.id ?? "",
            );
            setLineas((actuales) =>
                actuales.map((linea) => {
                    if (
                        resultadoProductos.datos.some(
                            ({ id }) =>
                                id === linea.productoId &&
                                (existencias.get(id) ?? 0) > 0,
                        )
                    ) {
                        return linea;
                    }
                    return {
                        productoId:
                            resultadoProductos.datos.find(
                                ({ id }) => (existencias.get(id) ?? 0) > 0,
                            )?.id ?? "",
                        cantidad: "1",
                    };
                }),
            );
        } catch (cargaError) {
            setError(
                cargaError instanceof Error
                    ? cargaError.message
                    : "No se pudieron cargar las ventas.",
            );
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        const tarea = window.setTimeout(() => void cargarDatos(), 0);
        return () => window.clearTimeout(tarea);
    }, [cargarDatos]);

    const subtotal = lineas.reduce((suma, linea) => {
        const producto = productos.find(({ id }) => id === linea.productoId);
        return (
            suma +
            (producto ? Number(producto.precioVenta) : 0) *
                (Number(linea.cantidad) || 0)
        );
    }, 0);
    const descuentoNumero = Number(descuento) || 0;
    const baseImponible = Math.max(0, subtotal - descuentoNumero);
    const impuesto = Math.round(baseImponible * tasaImpuesto) / 100;
    const total = baseImponible + impuesto;
    const pagoNumero = Number(pagoInicial) || 0;

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

    async function crearVenta(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");
        setMensaje("");
        try {
            await apiRequest("/ventas", "POST", {
                clienteId,
                descuento: descuentoNumero,
                detalles: lineas.map((linea) => ({
                    productoId: linea.productoId,
                    cantidad: Number(linea.cantidad),
                })),
                ...(pagoNumero > 0
                    ? {
                          pagoInicial: {
                              monto: pagoNumero,
                              metodo: metodoPago,
                          },
                      }
                    : {}),
            });
            setMostrarFormulario(false);
            setDescuento("0");
            setPagoInicial("");
            setMensaje("Venta registrada y existencias actualizadas.");
            await cargarDatos();
        } catch (registroError) {
            setError(
                registroError instanceof Error
                    ? registroError.message
                    : "No se pudo registrar la venta.",
            );
        } finally {
            setGuardando(false);
        }
    }

    async function registrarPago(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!ventaPago) return;
        setGuardandoPago(true);
        setError("");
        setMensaje("");
        try {
            await apiRequest(`/ventas/${ventaPago}/pagos`, "POST", {
                monto: Number(montoPago),
                metodo: metodoPagoAdicional,
            });
            setVentaPago("");
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

    async function cancelarVenta(venta: Venta) {
        const confirmado = window.confirm(
            "La venta quedará cancelada y las existencias regresarán al inventario. Los pagos registrados se conservarán como historial. ¿Deseas continuar?",
        );
        if (!confirmado) return;

        setCancelandoVentaId(venta.id);
        setError("");
        setMensaje("");
        try {
            await apiRequest(`/ventas/${venta.id}/cancelar`, "POST");
            if (ventaPago === venta.id) {
                setVentaPago("");
                setMontoPago("");
            }
            setMensaje("Venta cancelada y existencias devueltas al inventario.");
            await cargarDatos();
        } catch (cancelacionError) {
            setError(
                cancelacionError instanceof Error
                    ? cancelacionError.message
                    : "No se pudo cancelar la venta.",
            );
        } finally {
            setCancelandoVentaId("");
        }
    }

    return (
        <div className="mx-auto w-full max-w-7xl">
            <EncabezadoPagina
                kicker="Gestión"
                titulo="Ventas"
                descripcion="Registra ventas, pagos y actualiza las existencias automáticamente."
                acciones={
                    <button
                        type="button"
                        onClick={() => {
                            setError("");
                            setMostrarFormulario((actual) => !actual);
                        }}
                        disabled={!clientes.length || !productos.length}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-3.5 text-[13px] font-semibold text-on-accent transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {mostrarFormulario ? (
                            <X className="size-4" />
                        ) : (
                            <Plus className="size-4" />
                        )}
                        {mostrarFormulario ? "Cancelar" : "Crear venta"}
                    </button>
                }
            />

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
                <p
                    role="status"
                    className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-200"
                >
                    {mensaje}
                </p>
            )}

            {mostrarFormulario && (
                <form
                    onSubmit={(evento) => void crearVenta(evento)}
                    className="mt-7 rounded-xl border border-white/[0.08] bg-surface-raised p-5 sm:p-6"
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2 text-xs font-medium text-slate-300">
                            Cliente
                            <select
                                required
                                value={clienteId}
                                onChange={(evento) =>
                                    setClienteId(evento.target.value)
                                }
                                className="rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                            >
                                {clientes.map((cliente) => (
                                    <option key={cliente.id} value={cliente.id}>
                                        {clienteNombre(cliente)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="grid gap-2 text-xs font-medium text-slate-300">
                            Descuento (importe)
                            <input
                                type="number"
                                min="0"
                                max={subtotal}
                                step="0.01"
                                value={descuento}
                                onChange={(evento) =>
                                    setDescuento(evento.target.value)
                                }
                                className="rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                            />
                        </label>
                    </div>

                    <div className="mt-6 space-y-3">
                        <div className="grid gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:grid-cols-[minmax(0,1fr)_110px_140px_130px_36px]">
                            <span>Producto</span>
                            <span>Cantidad</span>
                            <span>Precio unitario</span>
                            <span className="text-right">Subtotal</span>
                            <span />
                        </div>
                        {lineas.map((linea, indice) => {
                            const producto = productos.find(
                                ({ id }) => id === linea.productoId,
                            );
                            return (
                                <div
                                    key={indice}
                                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_140px_130px_36px]"
                                >
                                    <select
                                        required
                                        value={linea.productoId}
                                        onChange={(evento) =>
                                            actualizarLinea(indice, {
                                                productoId: evento.target.value,
                                            })
                                        }
                                        className="min-w-0 rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                                    >
                                        {productos.map((opcion) => (
                                            <option
                                                key={opcion.id}
                                                value={opcion.id}
                                                disabled={lineas.some(
                                                    (otra, posicion) =>
                                                        posicion !== indice &&
                                                        otra.productoId ===
                                                            opcion.id,
                                                )}
                                            >
                                                {opcion.sku} — {opcion.nombre} (stock{" "}
                                                {opcion.stock})
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        max={producto?.stock}
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
                                    <p className="self-center text-sm text-slate-300">
                                        {producto
                                            ? dinero(producto.precioVenta)
                                            : "—"}
                                    </p>
                                    <p className="self-center text-right text-sm text-slate-200">
                                        {dinero(
                                            (producto
                                                ? Number(producto.precioVenta)
                                                : 0) *
                                                (Number(linea.cantidad) || 0),
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
                            );
                        })}
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

                    <div className="mt-5 grid gap-4 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
                        <div className="space-y-2 text-sm">
                            <p className="flex justify-between text-slate-400">
                                Subtotal <span>{dinero(subtotal)}</span>
                            </p>
                            <p className="flex justify-between text-slate-400">
                                Descuento <span>-{dinero(descuentoNumero)}</span>
                            </p>
                            <p className="flex justify-between text-slate-400">
                                Impuesto ({dinero(tasaImpuesto)}%){" "}
                                <span>{dinero(impuesto)}</span>
                            </p>
                            <p className="flex justify-between border-t border-white/[0.07] pt-2 text-base font-semibold text-foreground">
                                Total <span>{dinero(total)}</span>
                            </p>
                        </div>
                        <div className="grid content-start gap-3 sm:pl-6">
                            <p className="text-xs font-semibold text-slate-300">
                                Pago inicial (opcional)
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    type="number"
                                    min="0"
                                    max={total}
                                    step="0.01"
                                    value={pagoInicial}
                                    onChange={(evento) =>
                                        setPagoInicial(evento.target.value)
                                    }
                                    placeholder="Importe"
                                    aria-label="Importe de pago inicial"
                                    className="rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground"
                                />
                                <select
                                    value={metodoPago}
                                    onChange={(evento) =>
                                        setMetodoPago(
                                            evento.target.value as MetodoPago,
                                        )
                                    }
                                    disabled={pagoNumero <= 0}
                                    aria-label="Método de pago"
                                    className="rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-foreground disabled:opacity-50"
                                >
                                    {metodosPagoManual.map((valor) => (
                                        <option key={valor} value={valor}>
                                            {metodoEtiqueta[valor]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={
                                    guardando ||
                                    !clienteId ||
                                    subtotal <= 0 ||
                                    descuentoNumero > subtotal ||
                                    pagoNumero > total ||
                                    lineas.some((linea) => {
                                        const producto = productos.find(
                                            ({ id }) =>
                                                id === linea.productoId,
                                        );
                                        return (
                                            !producto ||
                                            Number(linea.cantidad) < 1 ||
                                            Number(linea.cantidad) >
                                                producto.stock
                                        );
                                    })
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                            >
                                {guardando && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                Registrar venta
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {(!clientes.length || !productos.length) && !cargando && (
                <p className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
                    Para registrar ventas necesitas clientes activos y
                    productos con existencias.
                </p>
            )}

            <section className="mt-7 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-raised">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">
                            Historial de ventas
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Consulta importes, productos y pagos registrados.
                        </p>
                    </div>
                    <ReceiptText className="size-5 text-indigo-300" />
                </div>
                {cargando ? (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">
                        Cargando ventas...
                    </p>
                ) : ventas.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <p className="text-sm font-medium text-slate-300">
                            Aún no hay ventas registradas
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            Las ventas aparecerán aquí al registrarlas.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-white/[0.06]">
                        {ventas.map((venta) => {
                            const abonado = venta.pagos.reduce(
                                (suma, pago) => suma + Number(pago.monto),
                                0,
                            );
                            const saldo = Math.max(
                                0,
                                Number(venta.total) - abonado,
                            );
                            return (
                                <li
                                    key={venta.id}
                                    className="px-5 py-4 sm:px-6"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold text-foreground">
                                                    {clienteNombre(venta.cliente)}
                                                </p>
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                        venta.estado ===
                                                        "CANCELADA"
                                                            ? "bg-rose-400/10 text-rose-300"
                                                            : saldo <= 0
                                                            ? "bg-emerald-400/10 text-emerald-300"
                                                            : "bg-amber-400/10 text-amber-300"
                                                    }`}
                                                >
                                                    {venta.estado === "CANCELADA"
                                                        ? "Cancelada"
                                                        : saldo <= 0
                                                          ? "Pagada"
                                                          : "Saldo pendiente"}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {fechaLegible(venta.creadaEn)} ·{" "}
                                                {venta.detalles
                                                    .map(
                                                        ({
                                                            cantidad,
                                                            producto,
                                                        }) =>
                                                            `${cantidad} × ${producto.nombre}`,
                                                    )
                                                    .join(", ")}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-foreground">
                                                {dinero(venta.total)}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Pagado {dinero(abonado)} · Saldo{" "}
                                                {dinero(saldo)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                            <span>
                                                Subtotal {dinero(venta.subtotal)}
                                            </span>
                                            <span>
                                                Descuento -{dinero(venta.descuento)}
                                            </span>
                                            {Number(venta.costoEnvio) > 0 && (
                                                <span>
                                                    Envío {dinero(venta.costoEnvio)}
                                                </span>
                                            )}
                                            <span>
                                                Impuesto ({dinero(venta.tasaImpuesto)}%):{" "}
                                                {dinero(venta.impuesto)}
                                            </span>
                                            {venta.pagos.map((pago) => (
                                                <span key={pago.id}>
                                                    {metodoEtiqueta[pago.metodo]}{" "}
                                                    {dinero(pago.monto)}
                                                </span>
                                            ))}
                                        </div>
                                        {venta.estado === "CONFIRMADA" &&
                                            saldo > 0 &&
                                            (ventaPago === venta.id ? (
                                                <form
                                                    onSubmit={(evento) =>
                                                        void registrarPago(evento)
                                                    }
                                                    className="flex flex-wrap items-center gap-2"
                                                >
                                                    <input
                                                        required
                                                        type="number"
                                                        min="0.01"
                                                        max={saldo}
                                                        step="0.01"
                                                        value={montoPago}
                                                        onChange={(evento) =>
                                                            setMontoPago(
                                                                evento.target.value,
                                                            )
                                                        }
                                                        aria-label="Importe del pago"
                                                        placeholder="Importe"
                                                        className="w-28 rounded-lg border border-white/10 bg-surface px-2.5 py-2 text-xs text-foreground"
                                                    />
                                                    <select
                                                        value={metodoPagoAdicional}
                                                        onChange={(evento) =>
                                                            setMetodoPagoAdicional(
                                                                evento.target
                                                                    .value as MetodoPago,
                                                            )
                                                        }
                                                        aria-label="Método de pago"
                                                        className="rounded-lg border border-white/10 bg-surface px-2.5 py-2 text-xs text-foreground"
                                                    >
                                                        {metodosPagoManual.map(
                                                            (valor) => (
                                                                <option
                                                                    key={valor}
                                                                    value={valor}
                                                                >
                                                                    {
                                                                        metodoEtiqueta[
                                                                            valor
                                                                        ]
                                                                    }
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <button
                                                        type="submit"
                                                        disabled={
                                                            guardandoPago ||
                                                            Number(montoPago) >
                                                                saldo
                                                        }
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                                    >
                                                        {guardandoPago ? (
                                                            <LoaderCircle className="size-3.5 animate-spin" />
                                                        ) : (
                                                            <CreditCard className="size-3.5" />
                                                        )}
                                                        Guardar pago
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setVentaPago("");
                                                            setMontoPago("");
                                                        }}
                                                        aria-label="Cancelar pago"
                                                        className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-foreground"
                                                    >
                                                        <X className="size-4" />
                                                    </button>
                                                </form>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={
                                                        guardandoPago ||
                                                        ventaPago !== ""
                                                    }
                                                    onClick={() => {
                                                        setVentaPago(venta.id);
                                                        setMontoPago(
                                                            String(saldo.toFixed(2)),
                                                        );
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/20 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-400/[0.08] disabled:opacity-50"
                                                >
                                                    <CreditCard className="size-3.5" />
                                                    Registrar pago
                                                </button>
                                            ))}
                                        {venta.estado === "CONFIRMADA" && (
                                            <button
                                                type="button"
                                                disabled={cancelandoVentaId !== ""}
                                                onClick={() =>
                                                    void cancelarVenta(venta)
                                                }
                                                className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-400/[0.08] disabled:opacity-50"
                                            >
                                                {cancelandoVentaId === venta.id
                                                    ? "Cancelando…"
                                                    : "Cancelar venta"}
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
