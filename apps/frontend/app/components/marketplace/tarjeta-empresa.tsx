"use client";

import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import {
    categoriasDeTienda,
    formatearImporte,
    type TiendaMarketplace,
} from "@/app/lib/marketplace";

/**
 * La base de datos no guarda una imagen de la empresa, así que la portada de
 * la tarjeta es un degradado determinista elegido a partir del slug, con la
 * inicial del nombre. No representa una foto real de la empresa.
 */
const PORTADAS = [
    "bg-linear-to-br from-[#e4e8d8] to-[#cfd6bd]",
    "bg-linear-to-br from-[#ece4d2] to-[#dcd0b6]",
    "bg-linear-to-br from-[#e6e2d5] to-[#d3cdb9]",
    "bg-linear-to-br from-[#dee6df] to-[#c3d0c4]",
] as const;

function portadaDeTienda(slug: string): string {
    let suma = 0;
    for (let i = 0; i < slug.length; i++) {
        suma = (suma * 31 + slug.charCodeAt(i)) >>> 0;
    }
    return PORTADAS[suma % PORTADAS.length];
}

interface TarjetaEmpresaProps {
    tienda: TiendaMarketplace;
}

export function TarjetaEmpresa({ tienda }: TarjetaEmpresaProps) {
    const cantidad = tienda.productos.length;
    const categorias = categoriasDeTienda(tienda).slice(0, 3);
    const inicial = tienda.nombre.charAt(0).toUpperCase();
    const envio = Number(tienda.costoEnvio);

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-mp-border bg-mp-elevated transition-all duration-300 ease-out hover:-translate-y-1 hover:border-mp-primary/25 hover:shadow-[0_24px_46px_-30px_rgba(37,56,42,0.7)]">
            {/* Portada generada a partir del nombre (no es una foto real) */}
            <div
                aria-hidden="true"
                className={`relative flex h-28 items-center justify-center ${portadaDeTienda(tienda.slug)}`}
            >
                <span className="absolute inset-0 bg-linear-to-t from-mp-surface/45 to-transparent" />
                <Store
                    className="absolute right-4 top-4 size-9 text-mp-primary/12"
                    strokeWidth={1.25}
                />
                <span className="relative font-serif text-[3.25rem] leading-none font-normal tracking-[-0.02em] text-mp-primary/75">
                    {inicial}
                </span>
            </div>

            <div className="flex flex-1 flex-col p-5">
                <h3 className="font-serif text-[1.35rem] leading-tight tracking-[-0.01em] text-mp-primary">
                    {tienda.nombre}
                </h3>
                <p className="mt-1 text-[12px] text-mp-text-soft">
                    {cantidad}{" "}
                    {cantidad === 1
                        ? "producto publicado"
                        : "productos publicados"}
                </p>

                {categorias.length > 0 ? (
                    <ul
                        aria-label="Categorías de la tienda"
                        className="mt-4 flex flex-wrap gap-1.5"
                    >
                        {categorias.map((categoria) => (
                            <li
                                key={categoria.nombre}
                                className="rounded-full border border-mp-border bg-mp-surface px-2.5 py-1 text-[11px] font-medium text-mp-text-soft"
                            >
                                {categoria.nombre}
                            </li>
                        ))}
                    </ul>
                ) : null}

                <p className="mt-auto flex items-center gap-1.5 pt-5 text-[12px] text-mp-text-soft">
                    <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-mp-sage"
                    />
                    Envío {envio === 0 ? "sin costo" : formatearImporte(envio)}
                </p>

                <Link
                    href={`/marketplace/tienda/${tienda.slug}`}
                    className="group/boton mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-mp-primary/25 px-4 text-[12.5px] font-semibold text-mp-primary transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-mp-primary hover:text-mp-on-accent"
                >
                    Visitar tienda
                    <ArrowRight
                        className="size-3.5 transition-transform duration-300 group-hover/boton:translate-x-0.5"
                        aria-hidden="true"
                    />
                </Link>
            </div>
        </article>
    );
}
