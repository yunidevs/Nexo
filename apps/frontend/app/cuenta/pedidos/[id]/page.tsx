"use client";

import {
    ArrowLeft,
    LoaderCircle,
    Package,
    Store,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import type { PedidoCuenta } from "@/app/lib/cuenta";
import {
    botonSecundario,
    contenedor,
    tarjeta,
} from "@/app/components/marketplace/estilos";
import { useCuentaCliente } from "../../use-cuenta";

const ETIQUETAS_ESTADO: Record<string, string> = {
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

const ESTADOS_FINALES = new Set([
    "ENTREGADO",
    "CANCELADO",
    "REEMBOLSADO",
    "DEVUELTO",
]);

function formatoFechaHora(valor: string) {
    return new Intl.DateTimeFormat("es-UY", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(valor));
}

function formatoImporte(valor: string | number) {
    return new Intl.NumberFormat("es-UY", {
        style: "currency",
        currency: "UYU",
        minimumFractionDigits: 2,
    }).format(Number(valor));
}

function esPedidoCuenta(valor: unknown): valor is PedidoCuenta {
    if (typeof valor !== "object" || valor === null) return false;
    const pedido = valor as Record<string, unknown>;
    return (
        typeof pedido.id === "string" &&
        typeof pedido.estado === "string" &&
        typeof pedido.tienda === "string" &&
        Array.isArray(pedido.detalles) &&
        Array.isArray(pedido.historial)
    );
}

export default function PedidoCuentaDetallePage() {
    const { id } = useParams<{ id: string }>();
    const { cuenta, cargando: cargandoCuenta } = useCuentaCliente();
    const [pedido, setPedido] = useState<PedidoCuenta | null>(null);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        if (!cuenta || !id) return;
        let cancelada = false;
        async function cargar() {
            try {
                const resultado: unknown = await apiRequest(
                    `/cuenta-clientes/pedidos/${id}`,
                );
                if (cancelada) return;
                const datos =
                    typeof resultado === "object" &&
                    resultado !== null &&
                    "pedido" in resultado
                        ? (resultado as { pedido: unknown }).pedido
                        : null;
                if (!esPedidoCuenta(datos)) {
                    throw new Error("La respuesta del pedido no es válida.");
                }
                setPedido(datos);
            } catch (fallo) {
                if (!cancelada) {
                    setError(
                        fallo instanceof Error
                            ? fallo.message
                            : "No se pudo cargar el pedido.",
                    );
                }
            } finally {
                if (!cancelada) setCargando(false);
            }
        }
        void cargar();
        return () => {
            cancelada = true;
        };
    }, [cuenta, id]);

    if (cargandoCuenta || cargando) {
        return (
            <main className={`${contenedor} py-12`}>
                <p className="inline-flex items-center gap-2 text-sm text-mp-text-soft">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando tu pedido...
                </p>
            </main>
        );
    }

    if (error || !pedido) {
        return (
            <main className={`${contenedor} py-12 text-center`}>
                <p className="text-sm text-mp-error">{error || "Pedido no encontrado."}</p>
                <Link
                    href="/cuenta/pedidos"
                    className={`${botonSecundario} mt-6 h-10 px-5 text-[13px]`}
                >
                    Volver a mis pedidos
                </Link>
            </main>
        );
    }

    const eventos = [...pedido.historial].reverse(); // cronología ascendente

    return (
        <main className={`${contenedor} py-6 sm:py-8`}>
            <Link
                href="/cuenta/pedidos"
                className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-mp-text-soft transition-colors hover:text-mp-primary"
            >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Mis pedidos
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-mp-text-faint">
                        Pedido #{pedido.id.slice(0, 8).toUpperCase()}
                    </p>
                    <h1 className="mt-2 font-serif text-[1.8rem] leading-tight text-mp-primary">
                        {ESTADOS_FINALES.has(pedido.estado)
                            ? ETIQUETAS_ESTADO[pedido.estado]
                            : "Tu pedido está en camino"}
                    </h1>
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-mp-text-soft">
                        <Store className="size-3.5" aria-hidden="true" />
                        {pedido.tienda} · {formatoFechaHora(pedido.creadaEn)}
                    </p>
                </div>
                <span className="rounded-full bg-mp-primary/10 px-3 py-1.5 text-[12px] font-semibold text-mp-primary">
                    {ETIQUETAS_ESTADO[pedido.estado] ?? pedido.estado}
                </span>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                {/* Línea de tiempo */}
                <section className={`${tarjeta} p-6 sm:p-8`}>
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mp-text-soft">
                        Recorrido del pedido
                    </h2>
                    <ol className="mt-6 space-y-6">
                        {eventos.map((evento, indice) => {
                            const esUltimo = indice === eventos.length - 1;
                            return (
                                <li key={indice} className="relative pl-8">
                                    <span
                                        className={`absolute left-0 top-1 size-3 rounded-full ring-4 ${
                                            esUltimo
                                                ? "bg-mp-primary ring-mp-primary/15"
                                                : "bg-mp-border ring-mp-elevated"
                                        }`}
                                        aria-hidden="true"
                                    />
                                    {indice < eventos.length - 1 && (
                                        <span
                                            className="absolute left-[5px] top-4 h-full w-px bg-mp-border"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                        <p
                                            className={`text-sm font-semibold ${
                                                esUltimo
                                                    ? "text-mp-primary"
                                                    : "text-mp-text-soft"
                                            }`}
                                        >
                                            {ETIQUETAS_ESTADO[
                                                evento.estado
                                            ] ?? evento.estado}
                                        </p>
                                        <time
                                            className="text-[11px] text-mp-text-faint"
                                            dateTime={evento.fecha}
                                        >
                                            {formatoFechaHora(evento.fecha)}
                                        </time>
                                    </div>
                                    <p className="mt-1 text-[13px] leading-6 text-mp-text-soft">
                                        {evento.detalle}
                                    </p>
                                    {evento.observaciones && (
                                        <p className="mt-2 rounded-[10px] border border-mp-border/60 bg-mp-bg/60 px-3 py-2 text-[12px] italic text-mp-text-soft">
                                            “{evento.observaciones}”
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </section>

                {/* Resumen */}
                <div className="space-y-6">
                    <section className={`${tarjeta} p-6`}>
                        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mp-text-soft">
                            <Package className="size-4" aria-hidden="true" />
                            Productos
                        </h2>
                        <ul className="mt-4 space-y-2.5">
                            {pedido.detalles.map((detalle, indice) => (
                                <li
                                    key={indice}
                                    className="flex items-center justify-between gap-3 text-sm"
                                >
                                    <span className="text-mp-text">
                                        {detalle.cantidad} × {detalle.nombre}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-4 space-y-1.5 border-t border-mp-border/60 pt-4 text-[13px]">
                            <p className="flex justify-between text-mp-text-soft">
                                <span>Total</span>
                                <span className="font-semibold text-mp-text">
                                    {formatoImporte(pedido.total)}
                                </span>
                            </p>
                            {pedido.pagadaEn && (
                                <p className="text-[12px] text-mp-text-faint">
                                    Pagado el {formatoFechaHora(pedido.pagadaEn)}
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
