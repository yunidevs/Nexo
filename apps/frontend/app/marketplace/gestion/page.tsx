"use client";

import {
    CheckCircle2,
    ChevronDown,
    CircleAlert,
    History,
    LoaderCircle,
    MapPin,
    PackageCheck,
    RotateCcw,
    Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import { EncabezadoPagina } from "@/app/components/encabezado-pagina";

type EstadoPedido =
    | "PENDIENTE_PAGO"
    | "PAGO_RECHAZADO"
    | "PAGO_CONFIRMADO"
    | "PREPARANDO"
    | "DESPACHADO"
    | "ENVIADO"
    | "EN_TRANSITO"
    | "EN_REPARTO"
    | "ENTREGADO"
    | "CANCELADO"
    | "INCIDENCIA"
    | "ENTREGA_FALLIDA"
    | "DEVUELTO"
    | "REEMBOLSADO"
    | "REEMBOLSO_PENDIENTE";

interface DetallePedido {
    id: string;
    sku: string;
    nombre: string;
    cantidad: number;
    precioUnitario: number | string;
    subtotal: number | string;
}

interface PedidoMarketplace {
    id: string;
    estado: EstadoPedido;
    nombreComprador: string;
    correoComprador: string;
    telefonoComprador: string;
    departamento: string;
    localidad: string;
    direccion: string;
    codigoPostal: string | null;
    notaEntrega: string | null;
    subtotal: number | string;
    impuesto: number | string;
    costoEnvio: number | string;
    total: number | string;
    comision: number | string;
    creadaEn: string;
    pagadaEn: string | null;
    detalles: DetallePedido[];
}

const estadosValidos: EstadoPedido[] = [
    "PENDIENTE_PAGO",
    "PAGO_RECHAZADO",
    "PAGO_CONFIRMADO",
    "PREPARANDO",
    "DESPACHADO",
    "ENVIADO",
    "EN_TRANSITO",
    "EN_REPARTO",
    "ENTREGADO",
    "CANCELADO",
    "INCIDENCIA",
    "ENTREGA_FALLIDA",
    "DEVUELTO",
    "REEMBOLSADO",
    "REEMBOLSO_PENDIENTE",
];

const etiquetasEstado: Record<EstadoPedido, string> = {
    PENDIENTE_PAGO: "Pago pendiente",
    PAGO_RECHAZADO: "Pago rechazado",
    PAGO_CONFIRMADO: "Pago confirmado",
    PREPARANDO: "Preparando",
    DESPACHADO: "Despachado",
    ENVIADO: "Enviado",
    EN_TRANSITO: "En tránsito",
    EN_REPARTO: "En reparto",
    ENTREGADO: "Entregado",
    CANCELADO: "Cancelado",
    INCIDENCIA: "Incidencia",
    ENTREGA_FALLIDA: "Entrega fallida",
    DEVUELTO: "Devuelto",
    REEMBOLSADO: "Reembolsado",
    REEMBOLSO_PENDIENTE: "Reembolso pendiente",
};

// Espejo de la máquina de estados del backend. ENVIADO es un alias heredado
// de DESPACHADO y no se ofrece como destino para pedidos nuevos.
const transicionesPosibles: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
    PAGO_CONFIRMADO: ["PREPARANDO", "CANCELADO", "INCIDENCIA"],
    PREPARANDO: ["DESPACHADO", "CANCELADO", "INCIDENCIA"],
    DESPACHADO: ["EN_TRANSITO", "ENTREGADO", "INCIDENCIA"],
    ENVIADO: ["EN_TRANSITO", "ENTREGADO", "INCIDENCIA"],
    EN_TRANSITO: ["EN_REPARTO", "ENTREGA_FALLIDA", "INCIDENCIA"],
    EN_REPARTO: ["ENTREGADO", "ENTREGA_FALLIDA", "INCIDENCIA"],
    ENTREGA_FALLIDA: ["EN_REPARTO", "DEVUELTO", "INCIDENCIA"],
    INCIDENCIA: [
        "PREPARANDO",
        "DESPACHADO",
        "EN_TRANSITO",
        "EN_REPARTO",
        "ENTREGADO",
        "CANCELADO",
    ],
};

const etiquetasAccion: Record<EstadoPedido, string> = {
    PENDIENTE_PAGO: "Pendiente de pago",
    PAGO_RECHAZADO: "Pago rechazado",
    PAGO_CONFIRMADO: "Pago confirmado",
    PREPARANDO: "Preparar pedido",
    DESPACHADO: "Despachar pedido",
    ENVIADO: "Marcar enviado",
    EN_TRANSITO: "En tránsito",
    EN_REPARTO: "En reparto",
    ENTREGADO: "Marcar entregado",
    CANCELADO: "Cancelar pedido",
    INCIDENCIA: "Reportar incidencia",
    ENTREGA_FALLIDA: "Entrega fallida",
    DEVUELTO: "Marcar devuelto",
    REEMBOLSADO: "Reembolsado",
    REEMBOLSO_PENDIENTE: "Reembolso pendiente",
};

const iconosAccion: Partial<Record<EstadoPedido, typeof Truck>> = {
    PREPARANDO: PackageCheck,
    DESPACHADO: Truck,
    EN_TRANSITO: Truck,
    EN_REPARTO: MapPin,
    ENTREGADO: CheckCircle2,
    CANCELADO: CircleAlert,
    INCIDENCIA: CircleAlert,
    ENTREGA_FALLIDA: CircleAlert,
    DEVUELTO: RotateCcw,
};

interface EventoHistorial {
    estado: EstadoPedido;
    detalle: string;
    observaciones: string | null;
    fecha: string;
    responsable?: string | null;
}

interface HistorialPedido {
    historial: EventoHistorial[];
}

function esHistorial(valor: unknown): valor is HistorialPedido {
    return (
        esObjeto(valor) &&
        Array.isArray(valor.historial) &&
        valor.historial.every(
            (evento) =>
                esObjeto(evento) &&
                typeof evento.estado === "string" &&
                typeof evento.detalle === "string" &&
                typeof evento.fecha === "string" &&
                (typeof evento.observaciones === "string" ||
                    evento.observaciones === null),
        )
    );
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null;
}

function esDetalle(valor: unknown): valor is DetallePedido {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.sku === "string" &&
        typeof valor.nombre === "string" &&
        typeof valor.cantidad === "number" &&
        (typeof valor.precioUnitario === "number" ||
            typeof valor.precioUnitario === "string") &&
        (typeof valor.subtotal === "number" ||
            typeof valor.subtotal === "string")
    );
}

function esPedido(valor: unknown): valor is PedidoMarketplace {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.estado === "string" &&
        estadosValidos.some((estado) => estado === valor.estado) &&
        typeof valor.nombreComprador === "string" &&
        typeof valor.correoComprador === "string" &&
        typeof valor.telefonoComprador === "string" &&
        typeof valor.departamento === "string" &&
        typeof valor.localidad === "string" &&
        typeof valor.direccion === "string" &&
        (typeof valor.codigoPostal === "string" ||
            valor.codigoPostal === null) &&
        (typeof valor.notaEntrega === "string" ||
            valor.notaEntrega === null) &&
        (typeof valor.subtotal === "number" ||
            typeof valor.subtotal === "string") &&
        (typeof valor.impuesto === "number" ||
            typeof valor.impuesto === "string") &&
        (typeof valor.costoEnvio === "number" ||
            typeof valor.costoEnvio === "string") &&
        (typeof valor.total === "number" ||
            typeof valor.total === "string") &&
        (typeof valor.comision === "number" ||
            typeof valor.comision === "string") &&
        typeof valor.creadaEn === "string" &&
        (typeof valor.pagadaEn === "string" || valor.pagadaEn === null) &&
        Array.isArray(valor.detalles) &&
        valor.detalles.every(esDetalle)
    );
}

function dinero(valor: number | string) {
    return new Intl.NumberFormat("es-UY", {
        style: "currency",
        currency: "UYU",
        minimumFractionDigits: 2,
    }).format(Number(valor));
}

export default function GestionMarketplacePage() {
    const [pedidos, setPedidos] = useState<PedidoMarketplace[]>([]);
    const [cargando, setCargando] = useState(true);
    const [actualizandoId, setActualizandoId] = useState("");
    const [reembolsandoId, setReembolsandoId] = useState("");
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [observaciones, setObservaciones] = useState<Record<string, string>>(
        {},
    );
    const [historiales, setHistoriales] = useState<
        Record<string, EventoHistorial[]>
    >({});
    const [historialCargandoId, setHistorialCargandoId] = useState("");
    const [historialAbiertoId, setHistorialAbiertoId] = useState("");

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const resultado = await apiRequest("/marketplace/gestion/pedidos");
            if (
                !esObjeto(resultado) ||
                !Array.isArray(resultado.pedidos) ||
                !resultado.pedidos.every(esPedido)
            ) {
                throw new Error(
                    "La API devolvió una lista de pedidos no válida.",
                );
            }
            setPedidos(resultado.pedidos);
        } catch (cargaError) {
            setError(
                cargaError instanceof Error
                    ? cargaError.message
                    : "No se pudieron cargar los pedidos.",
            );
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        const tarea = window.setTimeout(() => void cargar(), 0);
        return () => window.clearTimeout(tarea);
    }, [cargar]);

    async function cambiarEstadoPedido(
        pedido: PedidoMarketplace,
        estado: EstadoPedido,
    ) {
        setActualizandoId(pedido.id);
        setError("");
        setMensaje("");
        try {
            const observacion = observaciones[pedido.id]?.trim();
            await apiRequest(
                `/marketplace/gestion/pedidos/${pedido.id}/estado`,
                "PATCH",
                observacion ? { estado, observaciones: observacion } : { estado },
            );
            setMensaje("El estado del pedido se actualizó.");
            setObservaciones((previas) => {
                const siguientes = { ...previas };
                delete siguientes[pedido.id];
                return siguientes;
            });
            setHistoriales((previos) => {
                const siguientes = { ...previos };
                delete siguientes[pedido.id];
                return siguientes;
            });
            await cargar();
        } catch (actualizacionError) {
            setError(
                actualizacionError instanceof Error
                    ? actualizacionError.message
                    : "No se pudo actualizar el pedido.",
            );
        } finally {
            setActualizandoId("");
        }
    }

    async function alternarHistorial(pedido: PedidoMarketplace) {
        if (historialAbiertoId === pedido.id) {
            setHistorialAbiertoId("");
            return;
        }
        setHistorialAbiertoId(pedido.id);
        if (historiales[pedido.id]) return;

        setHistorialCargandoId(pedido.id);
        setError("");
        try {
            const resultado: unknown = await apiRequest(
                `/marketplace/gestion/pedidos/${pedido.id}/historial`,
            );
            if (!esHistorial(resultado)) {
                throw new Error(
                    "La API devolvió un historial de pedido no válido.",
                );
            }
            setHistoriales((previos) => ({
                ...previos,
                [pedido.id]: resultado.historial,
            }));
        } catch (historialError) {
            setError(
                historialError instanceof Error
                    ? historialError.message
                    : "No se pudo cargar el historial del pedido.",
            );
            setHistorialAbiertoId("");
        } finally {
            setHistorialCargandoId("");
        }
    }

    async function reembolsarPedido(pedido: PedidoMarketplace) {
        const confirmado = window.confirm(
            "Se devolverá el pago al comprador y las existencias volverán al inventario. ¿Deseas continuar?",
        );
        if (!confirmado) return;

        setReembolsandoId(pedido.id);
        setError("");
        setMensaje("");
        try {
            await apiRequest(
                `/marketplace/gestion/pedidos/${pedido.id}/reembolsar`,
                "POST",
            );
            setMensaje("El pago se reembolsó y el pedido quedó cancelado.");
            await cargar();
        } catch (reembolsoError) {
            setError(
                reembolsoError instanceof Error
                    ? reembolsoError.message
                    : "No se pudo reembolsar el pedido.",
            );
        } finally {
            setReembolsandoId("");
        }
    }

    return (
        <div className="mx-auto w-full max-w-7xl">
            <EncabezadoPagina
                kicker="Ventas online"
                titulo="Pedidos del marketplace"
                descripcion="Coordina el envío directamente con cada comprador."
                acciones={
                    <button
                        type="button"
                        onClick={() => void cargar()}
                        disabled={cargando}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3.5 text-[13px] text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
                    >
                        {cargando && (
                            <LoaderCircle className="size-4 animate-spin" />
                        )}
                        Actualizar
                    </button>
                }
            />

            {error && (
                <p
                    role="alert"
                    className="mt-6 flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-sm text-rose-200"
                >
                    <CircleAlert className="size-4 shrink-0" />
                    {error}
                </p>
            )}
            {mensaje && (
                <p
                    role="status"
                    className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 text-sm text-emerald-200"
                >
                    {mensaje}
                </p>
            )}

            {cargando && pedidos.length === 0 ? (
                <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-400">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando pedidos...
                </p>
            ) : pedidos.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-10 text-center">
                    <PackageCheck className="mx-auto size-8 text-slate-500" />
                    <p className="mt-3 text-sm font-medium text-slate-300">
                        Aún no hay pedidos
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Los pedidos pagados aparecerán aquí.
                    </p>
                </div>
            ) : (
                <ul className="mt-4 space-y-4">
                    {pedidos.map((pedido) => (
                        <li
                            key={pedido.id}
                            className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-semibold text-foreground">
                                            {pedido.nombreComprador}
                                        </h2>
                                        <span className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-[11px] font-medium text-indigo-200">
                                            {etiquetasEstado[pedido.estado]}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Pedido {pedido.id.slice(0, 8)} ·{" "}
                                        {new Intl.DateTimeFormat("es-UY", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        }).format(new Date(pedido.creadaEn))}
                                    </p>
                                </div>
                                <p className="text-lg font-semibold text-foreground">
                                    {dinero(pedido.total)}
                                </p>
                            </div>

                            <div className="mt-5 grid gap-5 border-t border-white/[0.06] pt-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Artículos
                                    </h3>
                                    <ul className="mt-3 space-y-2">
                                        {pedido.detalles.map((detalle) => (
                                            <li
                                                key={detalle.id}
                                                className="flex justify-between gap-4 text-sm"
                                            >
                                                <span className="text-slate-300">
                                                    {detalle.cantidad} ×{" "}
                                                    {detalle.nombre}
                                                </span>
                                                <span className="shrink-0 text-slate-400">
                                                    {dinero(detalle.subtotal)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-4 text-xs text-slate-500">
                                        Envío {dinero(pedido.costoEnvio)} ·
                                        Comisión de plataforma{" "}
                                        {dinero(pedido.comision)}
                                    </p>
                                </section>
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Entrega y contacto
                                    </h3>
                                    <address className="mt-3 space-y-1 text-sm not-italic text-slate-300">
                                        <p>
                                            {pedido.direccion}, {pedido.localidad}
                                        </p>
                                        <p>
                                            {pedido.departamento}
                                            {pedido.codigoPostal
                                                ? ` · CP ${pedido.codigoPostal}`
                                                : ""}
                                        </p>
                                        <p>{pedido.telefonoComprador}</p>
                                        <p>{pedido.correoComprador}</p>
                                    </address>
                                    {pedido.notaEntrega && (
                                        <p className="mt-3 text-xs text-slate-500">
                                            Referencias: {pedido.notaEntrega}
                                        </p>
                                    )}
                                </section>
                            </div>

                            {pedido.estado === "REEMBOLSO_PENDIENTE" && (
                                <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-sm text-amber-200">
                                    El pago requiere revisión y reembolso. No
                                    despaches este pedido.
                                </p>
                            )}
                            {((transicionesPosibles[pedido.estado]?.length ??
                                0) > 0 ||
                                pedido.estado === "PAGO_CONFIRMADO" ||
                                pedido.estado === "PREPARANDO" ||
                                pedido.estado ===
                                    "REEMBOLSO_PENDIENTE") && (
                                <div className="mt-5 space-y-3">
                                    {(transicionesPosibles[pedido.estado]
                                        ?.length ?? 0) > 0 && (
                                        <input
                                            type="text"
                                            value={
                                                observaciones[pedido.id] ?? ""
                                            }
                                            onChange={(evento) =>
                                                setObservaciones(
                                                    (previas) => ({
                                                        ...previas,
                                                        [pedido.id]:
                                                            evento.target
                                                                .value,
                                                    }),
                                                )
                                            }
                                            placeholder="Observación para el comprador (opcional)"
                                            maxLength={1000}
                                            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-400/50 focus:outline-none"
                                        />
                                    )}
                                    <div className="flex flex-wrap justify-end gap-2">
                                    {(pedido.estado === "PAGO_CONFIRMADO" ||
                                        pedido.estado === "PREPARANDO" ||
                                        pedido.estado ===
                                            "REEMBOLSO_PENDIENTE") && (
                                        <button
                                            type="button"
                                            disabled={
                                                reembolsandoId === pedido.id
                                            }
                                            onClick={() =>
                                                void reembolsarPedido(pedido)
                                            }
                                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-400/20 px-4 text-sm font-medium text-rose-200 hover:bg-rose-400/[0.07] disabled:opacity-50"
                                        >
                                            {reembolsandoId === pedido.id && (
                                                <LoaderCircle className="size-4 animate-spin" />
                                            )}
                                            {pedido.estado ===
                                            "REEMBOLSO_PENDIENTE"
                                                ? "Reintentar reembolso"
                                                : "Reembolsar y cancelar"}
                                        </button>
                                    )}
                                    {(transicionesPosibles[pedido.estado] ??
                                        []
                                    ).map((destino) => {
                                        const Icono =
                                            iconosAccion[destino] ?? Truck;
                                        const negativo = [
                                            "CANCELADO",
                                            "DEVUELTO",
                                            "ENTREGA_FALLIDA",
                                            "INCIDENCIA",
                                        ].includes(destino);
                                        return (
                                            <button
                                                key={destino}
                                                type="button"
                                                disabled={
                                                    actualizandoId ===
                                                    pedido.id
                                                }
                                                onClick={() =>
                                                    void cambiarEstadoPedido(
                                                        pedido,
                                                        destino,
                                                    )
                                                }
                                                className={
                                                    negativo
                                                        ? "inline-flex h-10 items-center gap-2 rounded-lg border border-amber-400/20 px-4 text-sm font-medium text-amber-200 hover:bg-amber-400/[0.07] disabled:opacity-50"
                                                        : "inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                                }
                                            >
                                                {actualizandoId ===
                                                pedido.id ? (
                                                    <LoaderCircle className="size-4 animate-spin" />
                                                ) : (
                                                    <Icono className="size-4" />
                                                )}
                                                {etiquetasAccion[destino]}
                                            </button>
                                        );
                                    })}
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 border-t border-white/[0.06] pt-4">
                                <button
                                    type="button"
                                    onClick={() =>
                                        void alternarHistorial(pedido)
                                    }
                                    className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                                >
                                    <History className="size-4" />
                                    {historialAbiertoId === pedido.id
                                        ? "Ocultar historial"
                                        : "Ver historial de estados"}
                                    <ChevronDown
                                        className={`size-4 transition-transform ${
                                            historialAbiertoId === pedido.id
                                                ? "rotate-180"
                                                : ""
                                        }`}
                                    />
                                </button>
                                {historialAbiertoId === pedido.id && (
                                    <div className="mt-4">
                                        {historialCargandoId === pedido.id ? (
                                            <p className="inline-flex items-center gap-2 text-sm text-slate-400">
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Cargando historial...
                                            </p>
                                        ) : (
                                            <ul className="space-y-3">
                                                {(
                                                    historiales[pedido.id] ?? []
                                                ).map((evento, indice) => (
                                                    <li
                                                        key={indice}
                                                        className="flex gap-3 text-sm"
                                                    >
                                                        <span
                                                            className={`mt-1.5 size-2 shrink-0 rounded-full ${
                                                                indice === 0
                                                                    ? "bg-indigo-400"
                                                                    : "bg-slate-600"
                                                            }`}
                                                        />
                                                        <div>
                                                            <p className="font-medium text-slate-200">
                                                                {etiquetasEstado[
                                                                    evento.estado
                                                                ] ??
                                                                    evento.estado.replace(
                                                                        /_/g,
                                                                        " ",
                                                                    )}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {evento.detalle}
                                                            </p>
                                                            {evento.observaciones && (
                                                                <p className="mt-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-xs italic text-slate-400">
                                                                    “
                                                                    {
                                                                        evento.observaciones
                                                                    }
                                                                    ”
                                                                </p>
                                                            )}
                                                            <p className="mt-0.5 text-[11px] text-slate-600">
                                                                {new Intl.DateTimeFormat(
                                                                    "es-UY",
                                                                    {
                                                                        dateStyle:
                                                                            "medium",
                                                                        timeStyle:
                                                                            "short",
                                                                    },
                                                                ).format(
                                                                    new Date(
                                                                        evento.fecha,
                                                                    ),
                                                                )}
                                                                {evento.responsable
                                                                    ? ` · ${evento.responsable}`
                                                                    : ""}
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                                {(
                                                    historiales[pedido.id] ?? []
                                                ).length === 0 && (
                                                    <li className="text-sm text-slate-500">
                                                        Este pedido aún no
                                                        tiene eventos
                                                        registrados.
                                                    </li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
