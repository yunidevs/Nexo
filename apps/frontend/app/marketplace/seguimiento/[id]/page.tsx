"use client";

import Link from "next/link";
import { 
    Package, 
    Truck, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    ChevronLeft,
    MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import { useParams, useSearchParams } from "next/navigation";

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

interface SeguimientoPedido {
    id: string;
    estado: EstadoPedido;
    nombreComprador: string;
    creadaEn: string;
    actualizadaEn: string;
    tienda: string;
    detalles: {
        nombre: string;
        cantidad: number;
    }[];
    historial: {
        estado: EstadoPedido;
        detalle: string;
        observaciones: string | null;
        fecha: string;
    }[];
}

const PASOS_SEGUIMIENTO = [
    { estado: "PAGO_CONFIRMADO", label: "Confirmado", icon: CheckCircle2 },
    { estado: "PREPARANDO", label: "Preparando", icon: Package },
    { estado: "DESPACHADO", label: "Despachado", icon: Truck },
    { estado: "EN_TRANSITO", label: "En camino", icon: Truck },
    { estado: "EN_REPARTO", label: "En reparto", icon: MapPin },
    { estado: "ENTREGADO", label: "Entregado", icon: CheckCircle2 },
];

export default function SeguimientoPedidoPage() {
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const token = searchParams.get("t");
    const [seguimiento, setSeguimiento] = useState<SeguimientoPedido | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const ESTADOS_FINALES = new Set([
            "ENTREGADO",
            "CANCELADO",
            "REEMBOLSADO",
            "DEVUELTO",
        ]);
        let detenido = false;
        let temporizador: ReturnType<typeof setTimeout> | null = null;

        async function cargarSeguimiento(silencioso = false) {
            if (!token) {
                if (!silencioso) {
                    setError("El enlace de seguimiento no es válido.");
                    setCargando(false);
                }
                return;
            }

            try {
                const respuesta: unknown = await apiRequest(
                    `/marketplace/pedidos/${id}/seguimiento?t=${token}`
                );
                const resultado =
                    typeof respuesta === "object" &&
                    respuesta !== null &&
                    "seguimiento" in respuesta
                        ? respuesta.seguimiento
                        : respuesta;
                if (
                    typeof resultado !== "object" ||
                    resultado === null ||
                    !("id" in resultado) ||
                    typeof resultado.id !== "string" ||
                    !("historial" in resultado) ||
                    !Array.isArray(resultado.historial)
                ) {
                    throw new Error("La respuesta del seguimiento no es válida.");
                }
                const datos = resultado as SeguimientoPedido;
                setSeguimiento(datos);
                setError("");
                if (ESTADOS_FINALES.has(datos.estado)) detenido = true;
            } catch (err) {
                if (!silencioso) {
                    setError(err instanceof Error ? err.message : "Error al cargar el seguimiento.");
                }
            } finally {
                if (!silencioso) setCargando(false);
            }
        }

        function programar() {
            if (detenido || document.hidden) return;
            temporizador = setTimeout(async () => {
                await cargarSeguimiento(true);
                programar();
            }, 15000);
        }

        function alCambiarVisibilidad() {
            if (document.hidden) {
                if (temporizador) clearTimeout(temporizador);
            } else {
                void cargarSeguimiento(true).then(programar);
            }
        }

        void cargarSeguimiento().then(programar);
        document.addEventListener("visibilitychange", alCambiarVisibilidad);

        return () => {
            detenido = true;
            if (temporizador) clearTimeout(temporizador);
            document.removeEventListener("visibilitychange", alCambiarVisibilidad);
        };
    }, [id, token]);

    if (cargando) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-mp-bg">
                <div className="size-8 animate-spin rounded-full border-2 border-mp-primary border-t-transparent" />
            </div>
        );
    }

    if (error || !seguimiento) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-mp-bg px-5">
                <div className="w-full max-w-md text-center">
                    <AlertCircle className="mx-auto size-12 text-mp-error" />
                    <h1 className="mt-4 text-xl font-semibold text-mp-text">Seguimiento no disponible</h1>
                    <p className="mt-2 text-mp-text-soft">{error || "No se encontró la información del pedido."}</p>
                    <Link href="/marketplace" className="mt-6 inline-flex items-center text-mp-primary hover:underline">
                        <ChevronLeft className="mr-1 size-4" /> Volver al marketplace
                    </Link>
                </div>
            </div>
        );
    }

    const estadoNormalizado =
        seguimiento.estado === "ENVIADO" ? "DESPACHADO" : seguimiento.estado;
    const indiceActual = PASOS_SEGUIMIENTO.findIndex(p => p.estado === estadoNormalizado);

    // Si el estado no está en el flujo principal (ej: INCIDENCIA), mostramos una alerta
    const esEstadoExcepcional = !PASOS_SEGUIMIENTO.some(p => p.estado === estadoNormalizado) &&
                                seguimiento.estado !== "PENDIENTE_PAGO";

    return (
        <main className="min-h-screen bg-mp-bg text-mp-text pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-mp-border bg-mp-bg/80 backdrop-blur-md">
                <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
                    <Link href="/marketplace" className="flex items-center text-mp-text-soft hover:text-mp-text">
                        <ChevronLeft className="mr-1 size-5" />
                        <span className="text-sm font-medium">Volver</span>
                    </Link>
                    <div className="text-center">
                        <h1 className="text-sm font-semibold uppercase tracking-wider text-mp-text-soft">Pedido</h1>
                        <p className="font-mono text-xs">#{seguimiento.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="w-12" /> {/* Spacer */}
                </div>
            </header>

            <div className="mx-auto max-w-2xl px-5 pt-8">
                {/* Status Card */}
                <div className="rounded-2xl border border-mp-border bg-mp-elevated p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="inline-block rounded-full bg-mp-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-mp-primary">
                                {seguimiento.tienda}
                            </span>
                            <h2 className="mt-3 text-2xl font-serif text-mp-text">
                                {seguimiento.estado === "ENTREGADO" ? "¡Pedido entregado!" : "Tu pedido está en camino"}
                            </h2>
                            <p className="mt-1 text-sm text-mp-text-soft">
                                {seguimiento.nombreComprador}, estamos gestionando tu entrega.
                            </p>
                        </div>
                        {esEstadoExcepcional && (
                            <div className="flex items-center rounded-lg bg-mp-error/10 px-3 py-2 text-mp-error">
                                <AlertCircle className="mr-2 size-5" />
                                <span className="text-xs font-bold uppercase tracking-tight">Incidencia</span>
                            </div>
                        )}
                    </div>

                    {/* Stepper */}
                    <div className="mt-10 relative flex justify-between">
                        <div className="absolute top-5 left-0 h-0.5 w-full bg-mp-border -z-0" />
                        <div 
                            className="absolute top-5 left-0 h-0.5 bg-mp-primary transition-all duration-500 -z-0" 
                            style={{ width: `${Math.max(0, (indiceActual / (PASOS_SEGUIMIENTO.length - 1)) * 100)}%` }}
                        />
                        
                        {PASOS_SEGUIMIENTO.map((paso, idx) => {
                            const Icon = paso.icon;
                            const completado = idx <= indiceActual;
                            const activo = idx === indiceActual;

                            return (
                                <div key={paso.estado} className="relative z-10 flex flex-col items-center">
                                    <div className={`flex size-10 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                                        completado ? "bg-mp-primary border-mp-primary text-mp-on-accent" : "bg-mp-elevated border-mp-border text-mp-text-soft"
                                    } ${activo ? "ring-4 ring-mp-primary/20" : ""}`}>
                                        <Icon className="size-5" />
                                    </div>
                                    <span className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${
                                        completado ? "text-mp-text" : "text-mp-text-soft"
                                    }`}>
                                        {paso.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* History */}
                <div className="mt-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-mp-text-soft mb-6 flex items-center">
                        <Clock className="mr-2 size-4" /> Historial de actualizaciones
                    </h3>
                    
                    <div className="space-y-8 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-mp-border">
                        {seguimiento.historial.map((evento, idx) => (
                            <div key={idx} className="relative pl-10">
                                <div className={`absolute left-0 top-1 size-7 rounded-full border-4 border-mp-bg flex items-center justify-center ${
                                    idx === 0 ? "bg-mp-primary" : "bg-mp-border"
                                }`}>
                                    <div className="size-1.5 rounded-full bg-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className={`text-sm font-bold ${idx === 0 ? "text-mp-text" : "text-mp-text-soft"}`}>
                                            {evento.estado.replace(/_/g, " ")}
                                        </h4>
                                        <span className="text-[11px] text-mp-text-soft/60">
                                            {new Intl.DateTimeFormat("es", { 
                                                dateStyle: "medium", 
                                                timeStyle: "short" 
                                            }).format(new Date(evento.fecha))}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-mp-text-soft leading-relaxed">
                                        {evento.detalle}
                                    </p>
                                    {evento.observaciones && (
                                        <div className="mt-2 rounded-lg bg-mp-surface p-3 text-xs italic text-mp-text-soft/80 border border-mp-border/50">
                                            &ldquo;{evento.observaciones}&rdquo;
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Details */}
                <div className="mt-12 rounded-2xl border border-mp-border bg-mp-elevated p-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-mp-text-soft mb-4">Resumen del pedido</h3>
                    <div className="space-y-4">
                        {seguimiento.detalles.map((detalle, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-mp-surface text-xs font-bold">
                                        {detalle.cantidad}x
                                    </div>
                                    <span className="font-medium">{detalle.nombre}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
