"use client";

import {
    CircleAlert,
    LoaderCircle,
    PackageCheck,
    Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";

type EstadoPedido =
    | "PENDIENTE_PAGO"
    | "PAGO_CONFIRMADO"
    | "PREPARANDO"
    | "ENVIADO"
    | "ENTREGADO"
    | "CANCELADO"
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
    "PAGO_CONFIRMADO",
    "PREPARANDO",
    "ENVIADO",
    "ENTREGADO",
    "CANCELADO",
    "REEMBOLSADO",
    "REEMBOLSO_PENDIENTE",
];

const etiquetasEstado: Record<EstadoPedido, string> = {
    PENDIENTE_PAGO: "Pago pendiente",
    PAGO_CONFIRMADO: "Pago confirmado",
    PREPARANDO: "Preparando",
    ENVIADO: "Enviado",
    ENTREGADO: "Entregado",
    CANCELADO: "Cancelado",
    REEMBOLSADO: "Reembolsado",
    REEMBOLSO_PENDIENTE: "Reembolso pendiente",
};

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

    async function avanzarPedido(
        pedido: PedidoMarketplace,
        estado: "PREPARANDO" | "ENVIADO" | "ENTREGADO",
    ) {
        setActualizandoId(pedido.id);
        setError("");
        setMensaje("");
        try {
            await apiRequest(
                `/marketplace/gestion/pedidos/${pedido.id}/estado`,
                "PATCH",
                { estado },
            );
            setMensaje("El estado del pedido se actualizó.");
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
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
                        Ventas online
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                        Pedidos del marketplace
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Coordina el envío directamente con cada comprador.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void cargar()}
                    disabled={cargando}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
                >
                    {cargando && (
                        <LoaderCircle className="size-4 animate-spin" />
                    )}
                    Actualizar
                </button>
            </header>

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
                <p className="mt-10 inline-flex items-center gap-2 text-sm text-slate-400">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando pedidos...
                </p>
            ) : pedidos.length === 0 ? (
                <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-12 text-center">
                    <PackageCheck className="mx-auto size-8 text-slate-500" />
                    <p className="mt-3 text-sm font-medium text-slate-300">
                        Aún no hay pedidos
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Los pedidos pagados aparecerán aquí.
                    </p>
                </div>
            ) : (
                <ul className="mt-7 space-y-4">
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
                            {(pedido.estado === "PAGO_CONFIRMADO" ||
                                pedido.estado === "PREPARANDO" ||
                                pedido.estado === "ENVIADO" ||
                                pedido.estado === "REEMBOLSO_PENDIENTE") && (
                                <div className="mt-5 flex flex-wrap justify-end gap-2">
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
                                    {pedido.estado === "PAGO_CONFIRMADO" ? (
                                        <button
                                            type="button"
                                            disabled={
                                                actualizandoId === pedido.id
                                            }
                                            onClick={() =>
                                                void avanzarPedido(
                                                    pedido,
                                                    "PREPARANDO",
                                                )
                                            }
                                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                        >
                                            <PackageCheck className="size-4" />
                                            Preparar pedido
                                        </button>
                                    ) : pedido.estado === "PREPARANDO" ? (
                                        <button
                                            type="button"
                                            disabled={
                                                actualizandoId === pedido.id
                                            }
                                            onClick={() =>
                                                void avanzarPedido(
                                                    pedido,
                                                    "ENVIADO",
                                                )
                                            }
                                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                        >
                                            <Truck className="size-4" />
                                            Marcar enviado
                                        </button>
                                    ) : pedido.estado === "ENVIADO" ? (
                                        <button
                                            type="button"
                                            disabled={
                                                actualizandoId === pedido.id
                                            }
                                            onClick={() =>
                                                void avanzarPedido(
                                                    pedido,
                                                    "ENTREGADO",
                                                )
                                            }
                                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                        >
                                            <PackageCheck className="size-4" />
                                            Marcar entregado
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
