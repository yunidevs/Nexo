"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import {
    Check,
    CircleUserRound,
    Minus,
    Plus,
    ShoppingCart,
} from "lucide-react";
import { TarjetaProducto } from "@/app/components/marketplace/tarjeta-producto";
import { ImagenProducto } from "@/app/components/marketplace/imagen-producto";
import { useCarrito } from "@/app/components/marketplace/carrito";
import {
    botonPrimario,
    botonSecundario,
    contenedor,
    eyebrow,
    miga,
} from "@/app/components/marketplace/estilos";
import { apiRequest } from "@/app/lib/api";
import {
    construirConsultaCatalogo,
    esRespuestaDetalleProducto,
    formatearImporte,
    type ProductoCatalogo,
} from "@/app/lib/marketplace";

export default function PaginaProductoMarketplace({
    params,
}: PageProps<"/marketplace/producto/[id]">) {
    const { id } = use(params);
    const { agregar } = useCarrito();
    const [producto, setProducto] = useState<ProductoCatalogo | null>(null);
    const [relacionados, setRelacionados] = useState<ProductoCatalogo[]>([]);
    const [noDisponible, setNoDisponible] = useState(false);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(true);
    const [cantidad, setCantidad] = useState(1);
    const [agregado, setAgregado] = useState(false);
    const temporizador = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (temporizador.current !== null) {
                window.clearTimeout(temporizador.current);
            }
        },
        [],
    );

    useEffect(() => {
        let cancelada = false;
        async function cargarDetalle() {
            setCargando(true);
            setNoDisponible(false);
            setError("");
            setCantidad(1);
            setProducto(null);
            setRelacionados([]);
            try {
                const resultado = await apiRequest(
                    `/marketplace/catalogo/${encodeURIComponent(id)}`,
                );
                if (cancelada) return;
                if (!esRespuestaDetalleProducto(resultado)) {
                    throw new Error(
                        "La API devolvió el producto con un formato no válido.",
                    );
                }
                setProducto(resultado.producto);
                setRelacionados(resultado.relacionados);
            } catch (errorCarga) {
                if (cancelada) return;
                if (
                    errorCarga instanceof Error &&
                    "status" in errorCarga &&
                    (errorCarga as { status?: number }).status === 404
                ) {
                    setNoDisponible(true);
                } else {
                    setError(
                        errorCarga instanceof Error
                            ? errorCarga.message
                            : "No se pudo cargar el producto.",
                    );
                }
            } finally {
                if (!cancelada) setCargando(false);
            }
        }
        void cargarDetalle();
        return () => {
            cancelada = true;
        };
    }, [id]);

    function agregarAlCarrito() {
        if (!producto || producto.stock === 0) return;
        agregar(
            {
                productoId: producto.id,
                sku: producto.sku,
                nombre: producto.nombre,
                precioVenta: Number(producto.precioVenta),
                imagenUrl: producto.imagenUrl,
                categoria: producto.categoria,
                stock: producto.stock,
                tiendaSlug: producto.empresa.slug,
                tiendaNombre: producto.empresa.nombre,
            },
            cantidad,
        );
        setAgregado(true);
        if (temporizador.current !== null) {
            window.clearTimeout(temporizador.current);
        }
        temporizador.current = window.setTimeout(
            () => setAgregado(false),
            1600,
        );
    }

    if (cargando) {
        return (
            <main>
                <div
                    className={`${contenedor} grid gap-8 py-10 sm:px-6 lg:grid-cols-2 lg:gap-14`}
                >
                    <div
                        aria-hidden="true"
                        className="aspect-square animate-pulse rounded-[26px] bg-mp-warm"
                    />
                    <div aria-hidden="true" className="space-y-4 py-2">
                        <div className="h-6 w-40 animate-pulse rounded-lg bg-mp-warm" />
                        <div className="h-10 w-full animate-pulse rounded-lg bg-mp-warm" />
                        <div className="h-8 w-32 animate-pulse rounded-lg bg-mp-warm" />
                        <div className="h-12 w-full animate-pulse rounded-xl bg-mp-warm" />
                    </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main>
                <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6">
                    <h1 className="font-serif text-[1.6rem] text-mp-primary">
                        No se pudo cargar el producto
                    </h1>
                    <p role="alert" className="mt-2 text-[13px] text-mp-error">
                        {error}
                    </p>
                    <Link
                        href="/marketplace/productos"
                        className={`${botonPrimario} mt-6`}
                    >
                        Explorar el catálogo
                    </Link>
                </div>
            </main>
        );
    }

    if (noDisponible || !producto) {
        return (
            <main>
                <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-6">
                    <h1 className="font-serif text-[1.6rem] text-mp-primary">
                        Este producto no existe o ya no está publicado
                    </h1>
                    <Link
                        href="/marketplace/productos"
                        className={`${botonPrimario} mt-6`}
                    >
                        Explorar el catálogo
                    </Link>
                </div>
            </main>
        );
    }

    const disponible = producto.stock > 0;
    const maxCantidad = Math.max(1, producto.stock);

    return (
        <main>
            <div className={`${contenedor} pt-6 sm:pt-8`}>
                <nav
                    aria-label="Ruta de navegación"
                    className="flex flex-wrap items-center gap-1.5"
                >
                    <Link href="/marketplace" className={miga}>
                        Inicio
                    </Link>
                    <span aria-hidden="true" className="text-mp-text-faint">
                        /
                    </span>
                    <Link href="/marketplace/productos" className={miga}>
                        Productos
                    </Link>
                    <span aria-hidden="true" className="text-mp-text-faint">
                        /
                    </span>
                    <span className="text-[11.5px] font-medium text-mp-primary">
                        {producto.nombre}
                    </span>
                </nav>
            </div>

            <div
                className={`${contenedor} grid gap-8 py-6 sm:py-8 lg:grid-cols-2 lg:gap-12`}
            >
                <div className="relative aspect-square overflow-hidden rounded-[26px] border border-mp-border bg-mp-warm">
                    <ImagenProducto
                        url={producto.imagenUrl}
                        alt={producto.nombre}
                        priority
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        tamanoIcono="size-16"
                        textoSinImagen="Sin imagen"
                        className="object-contain p-10"
                    />
                    {!disponible ? (
                        <span className="absolute left-4 top-4 rounded-full bg-mp-surface/95 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-mp-text-soft uppercase backdrop-blur">
                            Agotado
                        </span>
                    ) : null}
                </div>

                <div className="flex flex-col">
                    <Link
                        href={`/marketplace/tienda/${producto.empresa.slug}`}
                        className="inline-flex w-fit items-center gap-2 rounded-full border border-mp-border bg-mp-elevated px-3.5 py-1.5 text-[11.5px] font-medium text-mp-text-soft transition-colors duration-300 hover:border-mp-primary/40 hover:text-mp-primary"
                    >
                        <CircleUserRound
                            className="size-4"
                            aria-hidden="true"
                        />
                        Vendido por {producto.empresa.nombre}
                    </Link>

                    {producto.categoria ? (
                        <p className={`${eyebrow} mt-5`}>
                            <span
                                aria-hidden="true"
                                className="h-px w-6 bg-mp-olive/40"
                            />
                            {producto.categoria}
                        </p>
                    ) : null}

                    <h1 className="mt-2 font-serif text-[2.1rem] leading-[1.1] font-normal tracking-[-0.015em] text-mp-primary sm:text-[2.6rem]">
                        {producto.nombre}
                    </h1>

                    <p className="mt-4 text-[2rem] leading-none font-semibold tracking-[-0.03em] text-mp-text">
                        {formatearImporte(producto.precioVenta)}
                    </p>

                    <p
                        className={`mt-3 flex items-center gap-2 text-[12.5px] ${
                            disponible ? "text-mp-success" : "text-mp-text-soft"
                        }`}
                    >
                        <span
                            aria-hidden="true"
                            className={`size-1.5 rounded-full ${
                                disponible ? "bg-mp-success" : "bg-mp-text-faint"
                            }`}
                        />
                        {disponible
                            ? `Disponible · ${producto.stock} ${
                                  producto.stock === 1
                                      ? "unidad"
                                      : "unidades"
                              } en stock`
                            : "Sin existencias por el momento"}
                    </p>

                    <dl className="mt-7 grid gap-2.5 rounded-[16px] border border-mp-border bg-mp-elevated p-5 text-[13px]">
                        <div className="flex justify-between gap-4">
                            <dt className="text-mp-text-soft">SKU</dt>
                            <dd className="font-mono text-xs text-mp-text">
                                {producto.sku}
                            </dd>
                        </div>
                        {producto.categoria ? (
                            <div className="flex justify-between gap-4">
                                <dt className="text-mp-text-soft">
                                    Categoría
                                </dt>
                                <dd>
                                    <Link
                                        href={`/marketplace/productos${construirConsultaCatalogo({ categoria: producto.categoria })}`}
                                        className="font-medium text-mp-primary transition-colors duration-300 hover:text-mp-olive-ink"
                                    >
                                        {producto.categoria}
                                    </Link>
                                </dd>
                            </div>
                        ) : null}
                    </dl>

                    <div className="mt-7 flex flex-wrap items-center gap-3">
                        <div className="flex h-12 items-center rounded-[10px] border border-mp-border bg-mp-elevated">
                            <button
                                type="button"
                                aria-label="Disminuir cantidad"
                                disabled={cantidad <= 1}
                                onClick={() =>
                                    setCantidad((actual) => actual - 1)
                                }
                                className="grid size-12 place-items-center rounded-l-[10px] text-mp-text transition-colors duration-300 hover:bg-mp-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Minus className="size-4" aria-hidden="true" />
                            </button>
                            <span
                                aria-label={`Cantidad: ${cantidad}`}
                                className="w-10 text-center text-[13.5px] font-semibold tabular-nums text-mp-text"
                            >
                                {cantidad}
                            </span>
                            <button
                                type="button"
                                aria-label="Aumentar cantidad"
                                disabled={cantidad >= maxCantidad}
                                onClick={() =>
                                    setCantidad((actual) => actual + 1)
                                }
                                className="grid size-12 place-items-center rounded-r-[10px] text-mp-text transition-colors duration-300 hover:bg-mp-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                        <button
                            type="button"
                            disabled={!disponible}
                            onClick={agregarAlCarrito}
                            className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] px-6 text-[13px] font-semibold transition-all duration-300 ease-out disabled:cursor-not-allowed ${
                                agregado
                                    ? "bg-mp-accent text-mp-primary"
                                    : disponible
                                      ? `${botonPrimario} shadow-[0_14px_28px_-16px_rgba(37,56,42,0.75)]`
                                      : "bg-mp-warm text-mp-text-faint"
                            }`}
                        >
                            {agregado ? (
                                <>
                                    <Check
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Agregado al carrito
                                </>
                            ) : disponible ? (
                                <>
                                    <ShoppingCart
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    Agregar al carrito
                                </>
                            ) : (
                                "Sin existencias"
                            )}
                        </button>
                    </div>

                    <Link
                        href="/marketplace/productos"
                        className={`${botonSecundario} mt-3`}
                    >
                        Seguir explorando el catálogo
                    </Link>

                    <p className="mt-5 text-[11.5px] leading-5 text-mp-text-faint">
                        El pago se procesa de forma segura con PayPal al
                        finalizar la compra. El estado del pedido se puede
                        seguir desde el enlace de confirmación.
                    </p>
                </div>
            </div>

            {relacionados.length > 0 ? (
                <section
                    aria-labelledby="titulo-relacionados"
                    className="border-t border-mp-border/80 bg-mp-surface/60 py-10 sm:py-12"
                >
                    <div className={contenedor}>
                        <p className={eyebrow}>
                            <span
                                aria-hidden="true"
                                className="h-px w-6 bg-mp-olive/40"
                            />
                            Sugerencias
                        </p>
                        <h2
                            id="titulo-relacionados"
                            className="mt-2 font-serif text-[1.8rem] leading-[1.15] tracking-[-0.01em] text-mp-primary"
                        >
                            También te puede interesar
                        </h2>
                        <div className="mp-cuadricula mt-7 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                            {relacionados.map((relacionado) => (
                                <TarjetaProducto
                                    key={relacionado.id}
                                    producto={relacionado}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            ) : null}
        </main>
    );
}
