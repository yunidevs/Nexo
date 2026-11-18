"use client";

import Link from "next/link";
import { CircleCheck, CircleDashed, LoaderCircle, RefreshCw } from "lucide-react";
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

interface PedidoPublico {
    pedidoId: string;
    estado: EstadoPedido;
    total: string | number;
    tienda: string;
    creadaEn: string;
}

const etiquetasEstado: Record<EstadoPedido, string> = {
    PENDIENTE_PAGO: "Pago pendiente de confirmación",
    PAGO_CONFIRMADO: "Pago confirmado",
    PREPARANDO: "El vendedor está preparando tu pedido",
    ENVIADO: "El pedido fue enviado",
    ENTREGADO: "Pedido entregado",
    CANCELADO: "Pedido cancelado",
    REEMBOLSADO: "Pago reembolsado",
    REEMBOLSO_PENDIENTE: "Reembolso en proceso",
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null;
}

function esPedidoPublico(valor: unknown): valor is PedidoPublico {
    return (
        esObjeto(valor) &&
        typeof valor.pedidoId === "string" &&
        typeof valor.estado === "string" &&
        valor.estado in etiquetasEstado &&
        (typeof valor.total === "number" ||
            typeof valor.total === "string") &&
        typeof valor.tienda === "string" &&
        typeof valor.creadaEn === "string"
    );
}

function esResultadoPedido(
    valor: unknown,
): valor is { pedido: PedidoPublico } {
    return esObjeto(valor) && esPedidoPublico(valor.pedido);
}

function dinero(valor: string | number) {
    return new Intl.NumberFormat("es-UY", {
        style: "currency",
        currency: "UYU",
        minimumFractionDigits: 2,
    }).format(Number(valor));
}

export default function ResultadoMarketplacePage() {
    const [pedido, setPedido] = useState<PedidoPublico | null>(null);
    const [pedidoId, setPedidoId] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const cargarPedido = useCallback(async (id: string) => {
        setCargando(true);
        setError("");
        try {
            const resultado = await apiRequest(
                `/marketplace/pedidos/${id}/estado`,
            );
            if (!esResultadoPedido(resultado)) {
                throw new Error(
                    "La API devolvió el estado del pedido no válido.",
                );
            }
            setPedido(resultado.pedido);
        } catch (cargaError) {
            setError(
                cargaError instanceof Error
                    ? cargaError.message
                    : "No se pudo consultar el pedido.",
            );
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const parametros = new URLSearchParams(window.location.search);
            const id = parametros.get("pedido");
            const token = parametros.get("token");
            const cancelado = parametros.get("cancelado") === "1";
            if (!id) {
                setError("No se encontró el identificador del pedido.");
                setCargando(false);
                return;
            }
            setPedidoId(id);
            void (async () => {
                let accionError = "";
                if (token) {
                    try {
                        await apiRequest(
                            `/marketplace/pedidos/${id}/${cancelado ? "cancelar" : "capturar"}`,
                            "POST",
                            { orden: token },
                        );
                    } catch (pagoError) {
                        accionError =
                            pagoError instanceof Error
                                ? pagoError.message
                                : "No se pudo confirmar el pago con PayPal.";
                    }
                }
                await cargarPedido(id);
                if (accionError) setError(accionError);
            })();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [cargarPedido]);

    return (
        <main className="mp-root grid min-h-screen place-items-center bg-mp-bg px-5 py-10 text-mp-text">
            <section className="w-full max-w-lg rounded-[18px] border border-mp-border bg-mp-elevated p-7 text-center sm:p-9">
                {cargando ? (
                    <LoaderCircle className="mx-auto size-9 animate-spin text-mp-primary" />
                ) : pedido &&
                  (pedido.estado === "PAGO_CONFIRMADO" ||
                      pedido.estado === "PREPARANDO" ||
                      pedido.estado === "ENVIADO" ||
                      pedido.estado === "ENTREGADO") ? (
                    <CircleCheck className="mx-auto size-10 text-mp-success" />
                ) : (
                    <CircleDashed className="mx-auto size-10 text-mp-primary" />
                )}
                <h1 className="mt-5 font-serif text-[1.8rem] leading-tight tracking-[-0.01em] text-mp-primary">
                    Estado de tu compra
                </h1>
                {error && (
                    <p role="alert" className="mt-4 text-sm text-mp-error">
                        {error}
                    </p>
                )}
                {pedido ? (
                    <>
                        <p className="mt-3 text-sm text-mp-text-soft">
                            {etiquetasEstado[pedido.estado]}
                        </p>
                        <dl className="mt-6 space-y-3 border-y border-mp-border py-5 text-[13px]">
                            <div className="flex justify-between gap-4">
                                <dt className="text-mp-text-soft">Tienda</dt>
                                <dd className="text-mp-text">{pedido.tienda}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-mp-text-soft">Pedido</dt>
                                <dd className="font-mono text-xs text-mp-text">
                                    {pedido.pedidoId.slice(0, 8).toUpperCase()}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-mp-text-soft">Total</dt>
                                <dd className="font-semibold text-mp-text">
                                    {dinero(pedido.total)}
                                </dd>
                            </div>
                        </dl>
                        {pedido.estado === "PENDIENTE_PAGO" && (
                            <p className="mt-4 text-xs leading-5 text-mp-text-soft">
                                PayPal puede tardar unos instantes en
                                confirmar el pago. Actualiza el estado antes de
                                cerrar esta página.
                            </p>
                        )}
                    </>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {pedidoId && (
                        <button
                            type="button"
                            disabled={cargando}
                            onClick={() => void cargarPedido(pedidoId)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-mp-border px-4 text-sm font-medium text-mp-text transition hover:bg-mp-surface disabled:opacity-50"
                        >
                            <RefreshCw className="size-4" />
                            Actualizar
                        </button>
                    )}
                    <Link
                        href="/marketplace"
                        className="inline-flex h-10 items-center rounded-[10px] bg-mp-primary px-4 text-[13px] font-semibold text-mp-on-accent transition-all duration-300 hover:-translate-y-0.5 hover:bg-mp-primary-hover"
                    >
                        Volver al marketplace
                    </Link>
                </div>
            </section>
        </main>
    );
}
