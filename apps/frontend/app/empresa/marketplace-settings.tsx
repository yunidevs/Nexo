"use client";

import {
    CircleAlert,
    ExternalLink,
    LoaderCircle,
    Store,
    TriangleAlert,
    X,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";

interface ConfiguracionMarketplace {
    tiendaActiva: boolean;
    tiendaSlug: string | null;
    costoEnvio: number | string;
    paypalConfigurado: boolean;
    comisionPorcentaje: number | string;
}

interface EstadoConexionTienda {
    configuracion: ConfiguracionMarketplace;
    pedidosPendientes: number;
    productosPublicados: number;
}

type AccionConexion = "desconectar" | "republicar";

function esConfiguracionMarketplace(
    valor: unknown,
): valor is ConfiguracionMarketplace {
    return (
        typeof valor === "object" &&
        valor !== null &&
        "tiendaActiva" in valor &&
        typeof valor.tiendaActiva === "boolean" &&
        "tiendaSlug" in valor &&
        (typeof valor.tiendaSlug === "string" || valor.tiendaSlug === null) &&
        "costoEnvio" in valor &&
        (typeof valor.costoEnvio === "number" ||
            typeof valor.costoEnvio === "string") &&
        "paypalConfigurado" in valor &&
        typeof valor.paypalConfigurado === "boolean" &&
        "comisionPorcentaje" in valor &&
        (typeof valor.comisionPorcentaje === "number" ||
            typeof valor.comisionPorcentaje === "string")
    );
}

function esEstadoConexionTienda(
    valor: unknown,
): valor is EstadoConexionTienda {
    return (
        typeof valor === "object" &&
        valor !== null &&
        "configuracion" in valor &&
        esConfiguracionMarketplace(valor.configuracion) &&
        "pedidosPendientes" in valor &&
        typeof valor.pedidosPendientes === "number" &&
        "productosPublicados" in valor &&
        typeof valor.productosPublicados === "number"
    );
}

export function MarketplaceSettings({
    esAdministrador,
}: {
    esAdministrador: boolean;
}) {
    const [estado, setEstado] = useState<EstadoConexionTienda | null>(null);
    const [configuracion, setConfiguracion] =
        useState<ConfiguracionMarketplace | null>(null);
    const [tiendaActiva, setTiendaActiva] = useState(false);
    const [slug, setSlug] = useState("");
    const [costoEnvio, setCostoEnvio] = useState("0");
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [accion, setAccion] = useState<AccionConexion | null>(null);
    const [procesandoConexion, setProcesandoConexion] = useState(false);
    const [errorConexion, setErrorConexion] = useState("");

    const aplicarEstado = useCallback((nuevo: EstadoConexionTienda) => {
        setEstado(nuevo);
        setConfiguracion(nuevo.configuracion);
        setTiendaActiva(nuevo.configuracion.tiendaActiva);
        setSlug(nuevo.configuracion.tiendaSlug ?? "");
        setCostoEnvio(String(nuevo.configuracion.costoEnvio));
    }, []);

    const recargar = useCallback(async () => {
        const resultado = await apiRequest("/marketplace/gestion/tienda");
        if (!esEstadoConexionTienda(resultado)) {
            throw new Error(
                "La API devolvió un estado de tienda no válido.",
            );
        }
        aplicarEstado(resultado);
        setError("");
    }, [aplicarEstado]);

    useEffect(() => {
        let cancelada = false;

        async function cargarEstado() {
            try {
                const resultado = await apiRequest(
                    "/marketplace/gestion/tienda",
                );
                if (cancelada) return;
                if (!esEstadoConexionTienda(resultado)) {
                    throw new Error(
                        "La API devolvió un estado de tienda no válido.",
                    );
                }
                aplicarEstado(resultado);
                setError("");
            } catch (cargaError) {
                if (!cancelada) {
                    setError(
                        cargaError instanceof Error
                            ? cargaError.message
                            : "No se pudo cargar la configuración del marketplace.",
                    );
                }
            } finally {
                if (!cancelada) setCargando(false);
            }
        }

        void cargarEstado();

        return () => {
            cancelada = true;
        };
    }, [aplicarEstado]);

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");
        setMensaje("");
        try {
            const resultado = await apiRequest("/marketplace/gestion", "PATCH", {
                activa: tiendaActiva,
                slug: slug.trim().toLowerCase(),
                costoEnvio: Number(costoEnvio),
            });
            if (
                typeof resultado !== "object" ||
                resultado === null ||
                !("configuracion" in resultado) ||
                !esConfiguracionMarketplace(resultado.configuracion)
            ) {
                throw new Error(
                    "La API devolvió una configuración de tienda no válida.",
                );
            }
            const guardada = resultado.configuracion;
            setConfiguracion(guardada);
            setSlug(guardada.tiendaSlug ?? "");
            setTiendaActiva(guardada.tiendaActiva);
            setMensaje("La configuración de la tienda se guardó.");
            // El estado de conexión puede haber cambiado con el guardado.
            await recargar();
        } catch (guardadoError) {
            setError(
                guardadoError instanceof Error
                    ? guardadoError.message
                    : "No se pudo guardar la tienda.",
            );
        } finally {
            setGuardando(false);
        }
    }

    function abrirConfirmacion(accionElegida: AccionConexion) {
        setAccion(accionElegida);
        setErrorConexion("");
    }

    function cerrarConfirmacion() {
        if (procesandoConexion) return;
        setAccion(null);
        setErrorConexion("");
    }

    async function confirmarConexion() {
        if (!accion) return;

        setProcesandoConexion(true);
        setErrorConexion("");

        try {
            const resultado = await apiRequest(
                "/marketplace/gestion/tienda",
                "PATCH",
                { conectada: accion === "republicar" },
            );
            if (!esEstadoConexionTienda(resultado)) {
                throw new Error(
                    "La API devolvió un estado de tienda no válido.",
                );
            }

            aplicarEstado(resultado);
            setAccion(null);
            setMensaje(
                accion === "desconectar"
                    ? "La tienda se desconectó del marketplace. Sus productos ya no están disponibles para la venta."
                    : `La tienda volvió a publicarse. ${resultado.productosPublicados} ${
                          resultado.productosPublicados === 1
                              ? "producto vuelve"
                              : "productos vuelven"
                      } a estar visible en el marketplace.`,
            );        } catch (conexionError) {
            setErrorConexion(
                conexionError instanceof Error
                    ? conexionError.message
                    : "No se pudo cambiar el estado de la tienda.",
            );
        } finally {
            setProcesandoConexion(false);
        }
    }

    const publicada = configuracion?.tiendaActiva ?? false;
    const tieneDireccion = Boolean(configuracion?.tiendaSlug);
    const desconectada = !publicada && tieneDireccion;
    const estadoTienda = publicada
        ? "Publicada"
        : desconectada
          ? "Desconectada"
          : "Sin publicar";

    return (
        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
            <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
                    <Store className="size-5" />
                </span>
                <div>
                    <h2 className="font-semibold text-foreground">
                        Tienda en el marketplace
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                        Publica productos para compradores y recibe los pagos
                        mediante PayPal. La comisión de plataforma actual
                        es {configuracion?.comisionPorcentaje ?? 2}%.
                    </p>
                </div>
            </div>

            {cargando ? (
                <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-400">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando la tienda...
                </p>
            ) : error && !configuracion ? (
                <p
                    role="alert"
                    className="mt-6 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3 text-sm text-rose-200"
                >
                    {error}
                </p>
            ) : configuracion ? (
                <>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-black/10 p-4">
                        <div>
                            <p className="text-sm font-medium text-foreground">
                                Cobro de la plataforma
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                {configuracion.paypalConfigurado
                                    ? "PayPal está configurado. Los cobros se reciben de forma centralizada y la liquidación a vendedores es manual."
                                    : "PayPal todavía no está configurado en el servidor; un administrador debe cargar sus credenciales en el entorno de despliegue."}
                            </p>
                        </div>
                    </div>

                    {/* Estado de la tienda en el marketplace */}
                    <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                    Estado de la tienda
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                            publicada
                                                ? "bg-emerald-500/10 text-emerald-300"
                                                : desconectada
                                                  ? "bg-amber-500/10 text-amber-300"
                                                  : "bg-slate-500/10 text-slate-400"
                                        }`}
                                    >
                                        {estadoTienda}
                                    </span>
                                    {publicada ? (
                                        <p className="text-xs text-slate-400">
                                            Tu tienda está visible en el
                                            marketplace y{" "}
                                            {estado?.productosPublicados ?? 0}{" "}
                                            {
                                                (estado?.productosPublicados ??
                                                    0) === 1
                                                    ? "producto aparece"
                                                    : "productos aparecen"
                                            }{" "}
                                            en el catálogo.
                                        </p>
                                    ) : desconectada ? (
                                        <p className="text-xs text-slate-400">
                                            La tienda no está disponible para
                                            la venta. Podés volver a
                                            publicarla cuando quieras.
                                        </p>
                                    ) : (
                                        <p className="text-xs text-slate-400">
                                            Configurá la dirección pública de
                                            la tienda para publicarla.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {esAdministrador &&
                                (publicada ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            abrirConfirmacion("desconectar")
                                        }
                                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-400/25 px-4 text-sm font-medium text-amber-200 transition hover:border-amber-400/50 hover:bg-amber-400/[0.07]"
                                    >
                                        <TriangleAlert className="size-4" />
                                        Desconectar del marketplace
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            abrirConfirmacion("republicar")
                                        }
                                        disabled={!tieneDireccion}
                                        title={
                                            tieneDireccion
                                                ? undefined
                                                : "Indicá la dirección pública de la tienda para poder publicarla."
                                        }
                                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-on-accent transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Store className="size-4" />
                                        Volver a publicar la tienda
                                    </button>
                                ))}
                        </div>

                        {!esAdministrador && (
                            <p className="mt-3 text-xs text-slate-500">
                                Solo un administrador puede desconectar o volver
                                a publicar la tienda.
                            </p>
                        )}
                    </div>

                    <form
                        onSubmit={(evento) => void guardar(evento)}
                        className="mt-5 grid gap-4 sm:grid-cols-2"
                    >
                        <label className="grid gap-2 text-sm text-slate-300">
                            Dirección pública de tienda
                            <input
                                required={tiendaActiva}
                                minLength={3}
                                maxLength={100}
                                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                value={slug}
                                onChange={(evento) =>
                                    setSlug(
                                        evento.target.value
                                            .toLowerCase()
                                            .replace(/[^a-z0-9-]/g, ""),
                                    )
                                }
                                placeholder="mi-empresa"
                                disabled={!esAdministrador || guardando}
                                className="h-11 rounded-lg border border-white/10 bg-background px-3 text-sm text-foreground outline-none focus:border-indigo-400/70 disabled:opacity-60"
                            />
                            <span className="text-xs text-slate-500">
                                nexoerp.com/marketplace · utiliza una dirección
                                corta, sin espacios.
                            </span>
                        </label>
                        <label className="grid content-start gap-2 text-sm text-slate-300">
                            Costo fijo de envío (UYU)
                            <input
                                required
                                type="number"
                                min="0"
                                max="9999999999.99"
                                step="0.01"
                                value={costoEnvio}
                                onChange={(evento) =>
                                    setCostoEnvio(evento.target.value)
                                }
                                disabled={!esAdministrador || guardando}
                                className="h-11 rounded-lg border border-white/10 bg-background px-3 text-sm text-foreground outline-none focus:border-indigo-400/70 disabled:opacity-60"
                            />
                            <span className="text-xs text-slate-500">
                                El vendedor coordina y realiza la entrega.
                            </span>
                        </label>
                        <label className="flex items-center gap-3 text-sm text-slate-300 sm:col-span-2">
                            <input
                                type="checkbox"
                                checked={tiendaActiva}
                                onChange={(evento) =>
                                    setTiendaActiva(evento.target.checked)
                                }
                                disabled={
                                    !esAdministrador ||
                                    guardando ||
                                    (!configuracion.paypalConfigurado &&
                                        !tiendaActiva)
                                }
                                className="size-4 accent-indigo-500"
                            />
                            Publicar mi tienda en el marketplace
                        </label>
                        {error && (
                            <p
                                role="alert"
                                className="text-sm text-rose-300 sm:col-span-2"
                            >
                                {error}
                            </p>
                        )}
                        {mensaje && (
                            <p
                                role="status"
                                className="text-sm text-emerald-300 sm:col-span-2"
                            >
                                {mensaje}
                            </p>
                        )}
                        {esAdministrador && (
                            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                >
                                    {guardando && (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    )}
                                    Guardar tienda
                                </button>
                                {configuracion.tiendaActiva &&
                                    configuracion.tiendaSlug && (
                                        <Link
                                            href={`/marketplace?tienda=${encodeURIComponent(configuracion.tiendaSlug)}`}
                                            target="_blank"
                                            className="inline-flex items-center gap-1.5 text-sm text-indigo-300 hover:text-indigo-200"
                                        >
                                            Ver mi tienda
                                            <ExternalLink className="size-3.5" />
                                        </Link>
                                    )}
                            </div>
                        )}
                    </form>

                    {!esAdministrador && (
                        <p className="mt-5 text-xs text-slate-500">
                            Solo un administrador puede configurar la tienda y
                            publicar la tienda.
                        </p>
                    )}
                    <p className="mt-5 text-xs leading-5 text-slate-500">
                        Después de publicar la tienda, marca qué productos
                        aparecerán en el catálogo desde la sección Productos.
                    </p>
                </>
            ) : null}

            {accion && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4"
                    role="presentation"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) {
                            cerrarConfirmacion();
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="conexion-tienda-title"
                        className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl"
                    >
                        <div className="flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                                    accion === "desconectar"
                                        ? "bg-amber-400/10 text-amber-300"
                                        : "bg-indigo-400/10 text-indigo-300"
                                }`}
                            >
                                {accion === "desconectar" ? (
                                    <TriangleAlert className="size-5" />
                                ) : (
                                    <Store className="size-5" />
                                )}
                            </span>
                            <div className="min-w-0 flex-1">
                                <h2
                                    id="conexion-tienda-title"
                                    className="text-xl font-semibold text-foreground"
                                >
                                    {accion === "desconectar"
                                        ? "Desconectar la tienda del marketplace"
                                        : "Volver a publicar la tienda"}
                                </h2>
                            </div>
                            <button
                                type="button"
                                aria-label="Cerrar confirmación"
                                onClick={cerrarConfirmacion}
                                disabled={procesandoConexion}
                                className="rounded-md p-1 text-slate-400 transition hover:bg-white/5 hover:text-foreground disabled:opacity-50"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {accion === "desconectar" ? (
                            <>
                                <p className="mt-4 text-sm leading-6 text-slate-300">
                                    Tu tienda dejará de estar disponible en el
                                    marketplace. Podés volver a publicarla en
                                    cualquier momento.
                                </p>
                                <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-400">
                                    <li className="flex gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-300"
                                        />
                                        Los productos de la tienda dejan de
                                        aparecer en el catálogo y en los
                                        resultados de búsqueda, y no pueden
                                        comprarse.
                                    </li>
                                    <li className="flex gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-300"
                                        />
                                        Tus productos, el inventario, los
                                        clientes, los proveedores y las ventas
                                        se conservan intactos.
                                    </li>
                                    <li className="flex gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-300"
                                        />
                                        Los pedidos ya realizados no se
                                        cancelan ni se modifican.
                                    </li>
                                </ul>
                            </>
                        ) : (
                            <>
                                <p className="mt-4 text-sm leading-6 text-slate-300">
                                    Tu tienda volverá a estar disponible en el
                                    marketplace bajo la dirección{" "}
                                    <span className="font-semibold text-foreground">
                                        {configuracion?.tiendaSlug}
                                    </span>
                                    .
                                </p>
                                <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-400">
                                    <li className="flex gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-300"
                                        />
                                        Vuelven a aparecer{" "}
                                        {estado?.productosPublicados ?? 0}{" "}
                                        {
                                            (estado?.productosPublicados ??
                                                0) === 1
                                                ? "producto"
                                                : "productos"
                                        }{" "}
                                        que ya estaban marcados para publicar.
                                    </li>
                                    <li className="flex gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-300"
                                        />
                                        Los productos que desactivaste o que
                                        nunca marcaste para publicar siguen
                                        ocultos.
                                    </li>
                                </ul>
                            </>
                        )}

                        {accion === "desconectar" &&
                            (estado?.pedidosPendientes ?? 0) > 0 && (
                                <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm leading-6 text-amber-200">
                                    Tenés {estado?.pedidosPendientes} pedidos
                                    en curso. No se cancelarán: seguís
                                    teniendo que prepararlos y enviarlos.
                                </p>
                            )}

                        {errorConexion && (
                            <p
                                role="alert"
                                className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-sm text-rose-200"
                            >
                                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                                {errorConexion}
                            </p>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={cerrarConfirmacion}
                                disabled={procesandoConexion}
                                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmarConexion()}
                                disabled={procesandoConexion}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-on-accent transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    accion === "desconectar"
                                        ? "bg-amber-500 hover:bg-amber-400"
                                        : "bg-indigo-500 hover:bg-indigo-400"
                                }`}
                            >
                                {procesandoConexion && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                {procesandoConexion
                                    ? "Procesando..."
                                    : accion === "desconectar"
                                      ? "Desconectar la tienda"
                                      : "Publicar la tienda"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </section>
    );
}
