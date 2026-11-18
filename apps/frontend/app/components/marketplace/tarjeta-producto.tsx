"use client";

import Link from "next/link";
import { Check, ShoppingCart, Store } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImagenProducto } from "@/app/components/marketplace/imagen-producto";
import { useCarrito } from "@/app/components/marketplace/carrito";
import { formatearImporte, type ProductoCatalogo } from "@/app/lib/marketplace";

interface TarjetaProductoProps {
    producto: ProductoCatalogo;
    /** Carga la fotografía con prioridad (primera tarjeta de la grilla). */
    prioritario?: boolean;
}

/** Texto de disponibilidad derivado del stock real de la publicación. */
function textoDisponibilidad(stock: number): string {
    if (stock <= 0) return "Agotado";
    if (stock <= 5) return `Últimas ${stock} unidades`;
    return "Disponible";
}

export function TarjetaProducto({
    producto,
    prioritario = false,
}: TarjetaProductoProps) {
    const { agregar } = useCarrito();
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

    function agregarAlCarrito() {
        if (producto.stock === 0) return;
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
            1,
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

    const disponible = producto.stock > 0;
    const disponibilidad = textoDisponibilidad(producto.stock);

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-mp-border bg-mp-elevated transition-all duration-300 ease-out hover:-translate-y-1 hover:border-mp-primary/25 hover:shadow-[0_24px_46px_-30px_rgba(37,56,42,0.7)]">
            <Link
                href={`/marketplace/producto/${producto.id}`}
                className="relative mx-auto block aspect-[4/3] w-full max-h-[220px] overflow-hidden"
                aria-label={`Ver detalle de ${producto.nombre}`}
            >
                <ImagenProducto
                    url={producto.imagenUrl}
                    alt={producto.nombre}
                    priority={prioritario}
                    sizes="(max-width: 420px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 280px"
                    className="object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    textoSinImagen="Sin imagen"
                />

                {!disponible ? (
                    <span className="absolute left-3 top-3 rounded-full bg-mp-surface/95 px-2.5 py-1 text-[10px] font-semibold tracking-[0.1em] text-mp-text-soft uppercase backdrop-blur">
                        Agotado
                    </span>
                ) : null}
            </Link>

            <div className="flex flex-1 flex-col p-4">
                {producto.categoria ? (
                    <p className="truncate text-[10px] font-semibold tracking-[0.16em] text-mp-olive-ink uppercase">
                        {producto.categoria}
                    </p>
                ) : (
                    <p className="truncate text-[10px] font-semibold tracking-[0.16em] text-mp-text-faint uppercase">
                        General
                    </p>
                )}

                <Link
                    href={`/marketplace/producto/${producto.id}`}
                    className="mt-1.5 line-clamp-2 text-[14px] leading-[1.35] font-semibold tracking-[-0.012em] text-mp-text transition-colors duration-300 hover:text-mp-primary"
                >
                    {producto.nombre}
                </Link>

                <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11.5px] text-mp-text-faint">
                    <Store className="size-3 shrink-0" aria-hidden="true" />
                    {producto.empresa.nombre}
                </p>

                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                    <div className="min-w-0">
                        <p className="text-[17px] font-semibold tracking-[-0.025em] text-mp-text">
                            {formatearImporte(producto.precioVenta)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-mp-text-faint">
                            <span
                                aria-hidden="true"
                                className={`size-1.5 rounded-full ${
                                    disponible
                                        ? "bg-mp-success"
                                        : "bg-mp-text-faint/50"
                                }`}
                            />
                            {disponibilidad}
                        </p>
                    </div>

                    <button
                        type="button"
                        disabled={!disponible}
                        onClick={agregarAlCarrito}
                        aria-label={
                            disponible
                                ? `Agregar ${producto.nombre} al carrito`
                                : `${producto.nombre} sin existencias`
                        }
                        className={`grid size-9.5 shrink-0 place-items-center rounded-full transition-all duration-300 ease-out ${
                            agregado
                                ? "scale-105 bg-mp-accent text-mp-primary"
                                : disponible
                                  ? "bg-mp-primary text-mp-on-accent hover:-translate-y-0.5 hover:bg-mp-primary-hover hover:shadow-[0_12px_22px_-12px_rgba(37,56,42,0.8)]"
                                  : "cursor-not-allowed bg-mp-warm text-mp-text-faint/60"
                        }`}
                    >
                        {agregado ? (
                            <Check className="size-4" aria-hidden="true" />
                        ) : (
                            <ShoppingCart
                                className="size-4"
                                aria-hidden="true"
                            />
                        )}
                    </button>
                </div>
            </div>
        </article>
    );
}
