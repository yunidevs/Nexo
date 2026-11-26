"use client";

import {
    ChevronRight,
    LoaderCircle,
    PackageSearch,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import type { PedidoCuenta } from "@/app/lib/cuenta";
import {
    botonPrimario,
    botonSecundario,
    contenedor,
    eyebrow,
    tarjeta,
    tituloSeccion,
} from "@/app/components/marketplace/estilos";
import { useCuentaCliente } from "../use-cuenta";

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

const ORDEN_ESTADOS = [
    "PENDIENTE_PAGO",
    "PAGO_CONFIRMADO",
    "PREPARANDO",
    "DESPACHADO",
    "EN_TRANSITO",
    "EN_REPARTO",
    "ENTREGADO",
];

function esPedidoCuenta(valor: unknown): valor is PedidoCuenta {
    if (typeof valor !== "object" || valor === null) return false;
    const pedido = valor as Record<string, unknown>;
    return (
        typeof pedido.id === "string" &&
        typeof pedido.estado === "string" &&
        typeof pedido.tienda === "string" &&
        (typeof pedido.total === "string" ||
            typeof pedido.total === "number") &&
        typeof pedido.creadaEn === "string" &&
        Array.isArray(pedido.detalles) &&
        Array.isArray(pedido.historial)
    );
}

function formatoFecha(valor: string) {
    return new Intl.DateTimeFormat("es-UY", {
        dateStyle: "medium",
    }).format(new Date(valor));
}

function formatoImporte(valor: string | number) {
    return new Intl.NumberFormat("es-UY", {
        style: "currency",
        currency: "UYU",
        minimumFractionDigits: 2,
    }).format(Number(valor));
}

export default function PedidosCuentaPage() {
    const { cuenta, cargando: cargandoCuenta } = useCuentaCliente();
    const [pedidos, setPedidos] = useState<PedidoCuenta[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!cuenta) return;
        let cancelada = false;
        async function cargar() {
            try {
                const resultado: unknown = await apiRequest(
                    "/cuenta-clientes/pedidos",
                );
                if (cancelada) return;
                const lista =
                    typeof resultado === "object" &&
                    resultado !== null &&
                    "pedidos" in resultado
                        ? (resultado as { pedidos: unknown }).pedidos
                        : null;
                if (!Array.isArray(lista) || !lista.every(esPedidoCuenta)) {
                    throw new Error("La respuesta de pedidos no es válida.");
                }
                setPedidos(lista);
            } catch (fallo) {
                if (!cancelada) {
                    setError(
                        fallo instanceof Error
                            ? fallo.message
                            : "No se pudieron cargar tus pedidos.",
                    );
                }
            }
        }
        void cargar();
        return () => {
            cancelada = true;
        };
    }, [cuenta]);

    if (cargandoCuenta || (cuenta && pedidos === null && !error)) {
        return (
            <main className={`${contenedor} py-12`}>
                <p className="inline-flex items-center gap-2 text-sm text-mp-text-soft">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando tus pedidos...
                </p>
            </main>
        );
    }

    const activos = (pedidos ?? []).filter((pedido) =>
        ["ENTREGADO", "CANCELADO", "REEMBOLSADO", "DEVUELTO"].every(
            (final) => pedido.estado !== final,
        ),
    );
    const historial = (pedidos ?? []).filter(
        (pedido) => !activos.includes(pedido),
    );

    return (
        <main className={`${contenedor} py-6 sm:py-8`}>
            <p className={eyebrow}>Mi cuenta</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className={tituloSeccion}>Mis pedidos</h1>
                    <p className="mt-2 text-sm text-mp-text-soft">
                        Hola {cuenta?.nombre}, acá ves el estado de todas tus
                        compras.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/marketplace"
                        className={botonSecundario}
                    >
                        Seguir comprando
                    </Link>
                    <Link href="/cuenta/perfil" className={botonSecundario}>
                        Mi perfil
                    </Link>
                </div>
            </div>

            {error && (
                <p
                    role="alert"
                    className="mt-6 rounded-[12px] border border-mp-error/20 bg-mp-error/5 p-4 text-sm text-mp-error"
                >
                    {error}
                </p>
            )}

            {pedidos !== null && pedidos.length === 0 && (
                <div className="mt-8 rounded-[16px] border border-dashed border-mp-border bg-mp-elevated/50 px-6 py-14 text-center">
                    <PackageSearch className="mx-auto size-9 text-mp-text-faint" />
                    <p className="mt-4 font-serif text-xl text-mp-primary">
                        Todavía no tenés pedidos
                    </p>
                    <p className="mt-2 text-sm text-mp-text-soft">
                        Cuando compres en cualquier tienda del marketplace, tus
                        pedidos van a aparecer acá.
                    </p>
                    <Link
                        href="/marketplace"
                        className={`${botonPrimario} mt-6 h-11 px-6`}
                    >
                        Explorar productos
                    </Link>
                </div>
            )}

            {activos.length > 0 && (
                <section className="mt-8">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mp-text-soft">
                        En curso
                    </h2>
                    <ul className="mt-4 space-y-3">
                        {activos.map((pedido) => (
                            <TarjetaPedido key={pedido.id} pedido={pedido} />
                        ))}
                    </ul>
                </section>
            )}

            {historial.length > 0 && (
                <section className="mt-10">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mp-text-soft">
                        Historial
                    </h2>
                    <ul className="mt-4 space-y-3">
                        {historial.map((pedido) => (
                            <TarjetaPedido key={pedido.id} pedido={pedido} />
                        ))}
                    </ul>
                </section>
            )}
        </main>
    );
}

function TarjetaPedido({ pedido }: { pedido: PedidoCuenta }) {
    const indice = ORDEN_ESTADOS.indexOf(pedido.estado);
    return (
        <li>
            <Link
                href={`/cuenta/pedidos/${pedido.id}`}
                className={`${tarjeta} flex items-center gap-4 p-4 transition-colors hover:border-mp-primary/40 sm:p-5`}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-mp-text-faint">
                            #{pedido.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="rounded-full bg-mp-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-mp-primary">
                            {ETIQUETAS_ESTADO[pedido.estado] ?? pedido.estado}
                        </span>
                    </div>
                    <p className="mt-1.5 truncate text-sm font-medium text-mp-text">
                        {pedido.detalles
                            .map((d) => `${d.cantidad} × ${d.nombre}`)
                            .join(", ")}
                    </p>
                    <p className="mt-1 text-[12px] text-mp-text-soft">
                        {pedido.tienda} · {formatoFecha(pedido.creadaEn)}
                    </p>
                    {indice >= 0 && pedido.estado !== "ENTREGADO" && (
                        <div
                            className="mt-3 flex gap-1"
                            aria-hidden="true"
                        >
                            {ORDEN_ESTADOS.map((estado, i) => (
                                <span
                                    key={estado}
                                    className={`h-1 flex-1 rounded-full ${
                                        i <= indice
                                            ? "bg-mp-primary"
                                            : "bg-mp-border"
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-mp-text">
                        {formatoImporte(pedido.total)}
                    </span>
                    <ChevronRight className="size-4 text-mp-text-faint" />
                </div>
            </Link>
        </li>
    );
}
