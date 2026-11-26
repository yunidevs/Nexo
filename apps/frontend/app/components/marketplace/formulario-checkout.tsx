"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCarrito, type LineaCarrito } from "@/app/components/marketplace/carrito";
import { apiRequest } from "@/app/lib/api";
import { obtenerCuenta } from "@/app/lib/cuenta";
import {
    esTiendaMarketplace,
    formatearImporte,
} from "@/app/lib/marketplace";

interface FormularioCheckoutProps {
    tiendaSlug: string;
    lineas: LineaCarrito[];
    onCancelar: () => void;
    /** Se invoca al obtener el enlace de pago, antes de redirigir a PayPal. */
    onPagoIniciado: () => void;
}

interface Comprador {
    nombre: string;
    correo: string;
    telefono: string;
    departamento: string;
    localidad: string;
    direccion: string;
    codigoPostal: string;
    notaEntrega: string;
}

const compradorInicial: Comprador = {
    nombre: "",
    correo: "",
    telefono: "",
    departamento: "",
    localidad: "",
    direccion: "",
    codigoPostal: "",
    notaEntrega: "",
};

export function FormularioCheckout({
    tiendaSlug,
    lineas,
    onCancelar,
    onPagoIniciado,
}: FormularioCheckoutProps) {
    const { limpiarTienda } = useCarrito();
    const [tasaImpuesto, setTasaImpuesto] = useState<number | null>(null);
    const [costoEnvio, setCostoEnvio] = useState<number | null>(null);
    const [comision, setComision] = useState<number | null>(null);
    const [errorTienda, setErrorTienda] = useState("");
    const [comprador, setComprador] = useState(compradorInicial);
    const [pagando, setPagando] = useState(false);
    const [error, setError] = useState("");
    const claveIdempotencia = useRef<string | null>(null);
    const [correoCuenta, setCorreoCuenta] = useState("");

    useEffect(() => {
        let cancelada = false;
        void obtenerCuenta().then((cuenta) => {
            if (cancelada || !cuenta) return;
            setCorreoCuenta(cuenta.correo);
            setComprador((actual) => ({
                ...actual,
                nombre:
                    actual.nombre ||
                    [cuenta.nombre, cuenta.apellido]
                        .filter(Boolean)
                        .join(" "),
                correo: actual.correo || cuenta.correo,
                telefono: actual.telefono || cuenta.telefono || "",
            }));
        });
        return () => {
            cancelada = true;
        };
    }, []);

    useEffect(() => {
        let cancelada = false;
        async function cargarTienda() {
            setErrorTienda("");
            try {
                const resultado = (await apiRequest(
                    `/marketplace/tiendas/${encodeURIComponent(tiendaSlug)}`,
                )) as { tienda?: unknown } | null;
                if (!esTiendaMarketplace(resultado?.tienda)) {
                    throw new Error(
                        "La API devolvió los datos de la tienda no válidos.",
                    );
                }
                const tienda = resultado.tienda;
                if (!cancelada) {
                    setTasaImpuesto(Number(tienda.tasaImpuesto));
                    setCostoEnvio(Number(tienda.costoEnvio));
                    setComision(Number(tienda.comisionPorcentaje));
                }
            } catch (error) {
                if (!cancelada) {
                    setErrorTienda(
                        error instanceof Error
                            ? error.message
                            : "No se pudo cargar el detalle de la tienda.",
                    );
                }
            }
        }
        void cargarTienda();
        return () => {
            cancelada = true;
        };
    }, [tiendaSlug]);

    const subtotal = useMemo(
        () =>
            lineas.reduce(
                (suma, linea) => suma + linea.precioVenta * linea.cantidad,
                0,
            ),
        [lineas],
    );
    const impuesto =
        tasaImpuesto !== null
            ? Math.round(subtotal * tasaImpuesto) / 100
            : null;
    const total =
        impuesto !== null && costoEnvio !== null
            ? subtotal + impuesto + costoEnvio
            : null;

    async function iniciarPago(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (total === null || lineas.length === 0) return;
        setPagando(true);
        setError("");
        try {
            claveIdempotencia.current ??= crypto.randomUUID();
            const resultado = await apiRequest("/marketplace/checkout", "POST", {
                tiendaSlug,
                ...comprador,
                detalles: lineas.map((linea) => ({
                    productoId: linea.productoId,
                    cantidad: linea.cantidad,
                })),
            }, { "Idempotency-Key": claveIdempotencia.current });
            if (
                typeof resultado !== "object" ||
                resultado === null ||
                typeof (resultado as { urlPago?: unknown }).urlPago !==
                    "string" ||
                typeof (resultado as { pedidoId?: unknown }).pedidoId !==
                    "string"
            ) {
                throw new Error(
                    "La API devolvió un enlace de pago no válido.",
                );
            }
            claveIdempotencia.current = null;
            limpiarTienda(tiendaSlug);
            onPagoIniciado();
            window.location.assign(
                (resultado as { urlPago: string }).urlPago,
            );
        } catch (errorPago) {
            setError(
                errorPago instanceof Error
                    ? errorPago.message
                    : "No se pudo iniciar el pago.",
            );
            setPagando(false);
        }
    }

    return (
        <form
            onSubmit={(evento) => void iniciarPago(evento)}
            className="mt-3 rounded-[12px] border border-mp-border bg-mp-surface p-4"
        >
            <button
                type="button"
                onClick={onCancelar}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-mp-primary transition-colors duration-300 hover:text-mp-olive-ink"
            >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Volver al carrito
            </button>
            <div className="mt-2 space-y-1.5 text-sm">
                <p className="flex justify-between text-mp-text-soft">
                    Subtotal <span>{formatearImporte(subtotal)}</span>
                </p>
                {impuesto !== null ? (
                    <p className="flex justify-between text-mp-text-soft">
                        Impuestos <span>{formatearImporte(impuesto)}</span>
                    </p>
                ) : null}
                {costoEnvio !== null ? (
                    <p className="flex justify-between text-mp-text-soft">
                        Envío{" "}
                        <span>
                            {costoEnvio === 0
                                ? "Sin costo"
                                : formatearImporte(costoEnvio)}
                        </span>
                    </p>
                ) : null}
                {total !== null ? (
                    <p className="flex justify-between border-t border-mp-border pt-1.5 font-semibold text-mp-text">
                        Total <span>{formatearImporte(total)}</span>
                    </p>
                ) : null}
                {comision !== null ? (
                    <p className="text-[11px] text-mp-text-soft">
                        La plataforma retiene una comisión del {comision}% del
                        pago.
                    </p>
                ) : null}
            </div>

            {errorTienda ? (
                <p role="alert" className="mt-2 text-xs text-mp-error">
                    {errorTienda} Los totales se confirman al continuar.
                </p>
            ) : null}

            {correoCuenta ? (
                <p className="mt-3 rounded-[9px] bg-mp-primary/10 px-3 py-2 text-[11px] text-mp-primary">
                    Comprando con tu cuenta de comprador ({correoCuenta}).
                    El pedido quedará asociado a tu historial.
                </p>
            ) : null}

            <div className="mt-3 grid gap-2.5">
                <label className="grid gap-1 text-xs text-mp-text-soft">
                    Nombre completo
                    <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={comprador.nombre}
                        onChange={(evento) =>
                            setComprador({ ...comprador, nombre: evento.target.value })
                        }
                        className="h-10 rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13.5px] text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                    />
                </label>
                <label className="grid gap-1 text-xs text-mp-text-soft">
                    Email
                    <input
                        required
                        type="email"
                        maxLength={100}
                        value={comprador.correo}
                        onChange={(evento) =>
                            setComprador({ ...comprador, correo: evento.target.value })
                        }
                        className="h-10 rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13.5px] text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                    />
                </label>
                <label className="grid gap-1 text-xs text-mp-text-soft">
                    Teléfono (con código de país)
                    <input
                        required
                        minLength={7}
                        maxLength={40}
                        placeholder="Ej.: 598 95 123 456"
                        value={comprador.telefono}
                        onChange={(evento) =>
                            setComprador({
                                ...comprador,
                                telefono: evento.target.value,
                            })
                        }
                        className="h-10 rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13.5px] text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                    />
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                    <label className="grid gap-1 text-xs text-mp-text-soft">
                        Departamento
                        <input
                            required
                            minLength={1}
                            maxLength={80}
                            value={comprador.departamento}
                            onChange={(evento) =>
                                setComprador({
                                    ...comprador,
                                    departamento: evento.target.value,
                                })
                            }
                            className="h-10 rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13.5px] text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                        />
                    </label>
                    <label className="grid gap-1 text-xs text-mp-text-soft">
                        Localidad
                        <input
                            required
                            minLength={2}
                            maxLength={120}
                            value={comprador.localidad}
                            onChange={(evento) =>
                                setComprador({
                                    ...comprador,
                                    localidad: evento.target.value,
                                })
                            }
                            className="h-10 rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13.5px] text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                        />
                    </label>
                </div>
                <label className="grid gap-1 text-xs text-mp-text-soft">
                    Dirección de entrega
                    <input
                        required
                        minLength={5}
                        maxLength={300}
                        value={comprador.direccion}
                        onChange={(evento) =>
                            setComprador({ ...comprador, direccion: evento.target.value })
                        }
                        className="h-10 rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13.5px] text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                    />
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                    <label className="grid gap-1 text-xs text-mp-text-soft">
                        Código postal (opcional)
                        <input
                            maxLength={20}
                            value={comprador.codigoPostal}
                            onChange={(evento) =>
                                setComprador({
                                    ...comprador,
                                    codigoPostal: evento.target.value,
                                })
                            }
                            className="h-10 rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13.5px] text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                        />
                    </label>
                    <label className="grid gap-1 text-xs text-mp-text-soft">
                        Nota de entrega (opcional)
                        <input
                            maxLength={500}
                            value={comprador.notaEntrega}
                            onChange={(evento) =>
                                setComprador({
                                    ...comprador,
                                    notaEntrega: evento.target.value,
                                })
                            }
                            className="h-10 rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13.5px] text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                        />
                    </label>
                </div>
            </div>

            {error ? (
                <p role="alert" className="mt-2.5 text-xs text-mp-error">
                    {error}
                </p>
            ) : null}

            <button
                type="submit"
                disabled={pagando || total === null}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-mp-primary px-4 text-[13px] font-semibold text-mp-on-accent transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-mp-primary-hover disabled:opacity-50"
            >
                {pagando ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Ir al checkout seguro
            </button>
            <p className="mt-2 text-center text-[11px] leading-4 text-mp-text-soft">
                Paga de forma segura en PayPal. Al confirmar, el pedido se
                envía al vendedor.
            </p>
        </form>
    );
}
