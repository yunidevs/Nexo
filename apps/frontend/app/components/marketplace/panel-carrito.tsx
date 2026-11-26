"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { ImagenProducto } from "@/app/components/marketplace/imagen-producto";
import { useCarrito } from "@/app/components/marketplace/carrito";
import {
    FormularioCheckout,
} from "@/app/components/marketplace/formulario-checkout";
import { formatearImporte } from "@/app/lib/marketplace";

interface PanelCarritoProps {
    abierto: boolean;
    onCerrar: () => void;
}

export function PanelCarrito({ abierto, onCerrar }: PanelCarritoProps) {
    const { grupos, cantidadArticulos, cambiarCantidad, quitar } = useCarrito();
    const [grupoCheckout, setGrupoCheckout] = useState<string | null>(null);

    if (!abierto) return null;

    return (
        <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Carrito de compras"
        >
            <button
                type="button"
                aria-label="Cerrar carrito"
                onClick={onCerrar}
                className="absolute inset-0 h-full w-full cursor-default bg-mp-primary/40 backdrop-blur-[2px]"
            />
            <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-mp-surface shadow-[0_0_60px_-20px_rgba(37,56,42,0.55)]">
                <header className="flex items-center justify-between border-b border-mp-border px-5 py-3">
                    <h2 className="font-serif text-[1.25rem] leading-none tracking-[-0.01em] text-mp-primary">
                        Tu carrito
                        <span className="ml-2 align-middle text-[12.5px] font-normal text-mp-text-soft">
                            {cantidadArticulos}{" "}
                            {cantidadArticulos === 1
                                ? "artículo"
                                : "artículos"}
                        </span>
                    </h2>
                    <button
                        type="button"
                        onClick={onCerrar}
                        aria-label="Cerrar carrito"
                        className="grid size-9 place-items-center rounded-full text-mp-text-soft transition-colors duration-300 hover:bg-mp-primary/10 hover:text-mp-primary"
                    >
                        <X className="size-5" aria-hidden="true" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {grupos.length === 0 ? (
                        <div className="grid place-items-center py-16 text-center">
                            <span className="grid size-14 place-items-center rounded-full bg-mp-chip">
                                <ShoppingBag
                                    className="size-6 text-mp-olive"
                                    strokeWidth={1.25}
                                    aria-hidden="true"
                                />
                            </span>
                            <p className="mt-4 font-serif text-[1.25rem] text-mp-primary">
                                Tu carrito está vacío
                            </p>
                            <p className="mt-1.5 text-[13px] text-mp-text-soft">
                                Explorá el catálogo y agregá productos.
                            </p>
                            <Link
                                href="/marketplace/productos"
                                onClick={onCerrar}
                                className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-mp-primary px-4 text-[13px] font-semibold text-mp-on-accent transition-all duration-300 hover:-translate-y-0.5 hover:bg-mp-primary-hover"
                            >
                                Explorar productos
                            </Link>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {grupos.map((grupo) => (
                                <li
                                    key={grupo.tiendaSlug}
                                    className="overflow-hidden rounded-[14px] border border-mp-border bg-mp-elevated"
                                >
                                    <div className="flex items-center justify-between gap-2 border-b border-mp-border px-4 py-3">
                                        <p className="min-w-0 truncate font-serif text-[1.05rem] text-mp-primary">
                                            {grupo.tiendaNombre}
                                        </p>
                                        <span className="shrink-0 text-[12px] tabular-nums text-mp-text-soft">
                                            {formatearImporte(grupo.subtotal)}
                                        </span>
                                    </div>
                                    <ul className="divide-y divide-mp-border">
                                        {grupo.lineas.map((linea) => (
                                            <li
                                                key={linea.productoId}
                                                className="flex gap-3 px-4 py-3.5"
                                            >
                                                <div className="relative size-16 shrink-0 overflow-hidden rounded-[10px] bg-mp-warm">
                                                    <ImagenProducto
                                                        url={linea.imagenUrl}
                                                        alt=""
                                                        sizes="64px"
                                                        tamanoIcono="size-5"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-1 text-[13.5px] font-medium text-mp-text">
                                                        {linea.nombre}
                                                    </p>
                                                    <p className="mt-0.5 text-[12px] tabular-nums text-mp-text-soft">
                                                        {formatearImporte(
                                                            linea.precioVenta,
                                                        )}{" "}
                                                        × {linea.cantidad}
                                                    </p>
                                                    <div className="mt-2 flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                aria-label={`Quitar una unidad de ${linea.nombre}`}
                                                                onClick={() =>
                                                                    cambiarCantidad(
                                                                        linea.productoId,
                                                                        linea.cantidad - 1,
                                                                    )
                                                                }
                                                                className="grid size-7 place-items-center rounded-full border border-mp-border text-mp-text transition-colors duration-300 hover:border-mp-primary/40 hover:bg-mp-primary/10"
                                                            >
                                                                <Minus
                                                                    className="size-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                            </button>
                                                            <span
                                                                aria-label={`Cantidad de ${linea.nombre}`}
                                                                className="w-7 text-center text-[13px] font-medium tabular-nums text-mp-text"
                                                            >
                                                                {linea.cantidad}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                aria-label={`Agregar una unidad de ${linea.nombre}`}
                                                                disabled={
                                                                    linea.cantidad >=
                                                                    linea.stock
                                                                }
                                                                onClick={() =>
                                                                    cambiarCantidad(
                                                                        linea.productoId,
                                                                        linea.cantidad + 1,
                                                                    )
                                                                }
                                                                className="grid size-7 place-items-center rounded-full border border-mp-border text-mp-text transition-colors duration-300 hover:border-mp-primary/40 hover:bg-mp-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Plus
                                                                    className="size-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                            </button>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            aria-label={`Quitar ${linea.nombre} del carrito`}
                                                            onClick={() =>
                                                                quitar(linea.productoId)
                                                            }
                                                            className="grid size-7 place-items-center rounded-full text-mp-text-faint transition-colors duration-300 hover:bg-mp-error/10 hover:text-mp-error"
                                                        >
                                                            <Trash2
                                                                className="size-4"
                                                                aria-hidden="true"
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    {grupoCheckout === grupo.tiendaSlug ? (
                                        <FormularioCheckout
                                            tiendaSlug={grupo.tiendaSlug}
                                            lineas={grupo.lineas}
                                            onCancelar={() =>
                                                setGrupoCheckout(null)
                                            }
                                            onPagoIniciado={() => {
                                                setGrupoCheckout(null);
                                                onCerrar();
                                            }}
                                        />
                                    ) : (
                                        <div className="px-4 pb-4 pt-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setGrupoCheckout(
                                                        grupo.tiendaSlug,
                                                    )
                                                }
                                                className="h-11 w-full rounded-[10px] bg-mp-primary px-4 text-[13px] font-semibold text-mp-on-accent transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-mp-primary-hover hover:shadow-[0_14px_28px_-16px_rgba(37,56,42,0.75)]"
                                            >
                                                Finalizar compra ·{" "}
                                                {formatearImporte(
                                                    grupo.subtotal,
                                                )}
                                            </button>
                                            <p className="mt-2 text-center text-[11px] text-mp-text-faint">
                                                El checkout se realiza por
                                                tienda.
                                            </p>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </aside>
        </div>
    );
}
