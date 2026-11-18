"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { iconoCategoria } from "@/app/components/marketplace/icono-categoria";
import { imagenCategoria } from "@/app/components/marketplace/imagen-categoria";
import {
    contenedor,
    eyebrow,
    miga,
    tituloSeccion,
} from "@/app/components/marketplace/estilos";
import { apiRequest } from "@/app/lib/api";
import {
    construirConsultaCatalogo,
    esCategoriasPublicas,
    type CategoriaPublica,
} from "@/app/lib/marketplace";

export default function PaginaCategoriasMarketplace() {
    const [categorias, setCategorias] = useState<CategoriaPublica[] | null>(
        null,
    );
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelada = false;
        async function cargarCategorias() {
            try {
                const datos = await apiRequest(
                    "/marketplace/catalogo/categorias",
                );
                if (cancelada) return;
                if (
                    typeof datos === "object" &&
                    datos !== null &&
                    esCategoriasPublicas(
                        (datos as { categorias?: unknown }).categorias,
                    )
                ) {
                    setCategorias(
                        (datos as { categorias: CategoriaPublica[] })
                            .categorias,
                    );
                } else {
                    throw new Error(
                        "La API devolvió las categorías con un formato no válido.",
                    );
                }
            } catch (errorCarga) {
                if (cancelada) return;
                setError(
                    errorCarga instanceof Error
                        ? errorCarga.message
                        : "No se pudo cargar el catálogo.",
                );
            }
        }
        void cargarCategorias();
        return () => {
            cancelada = true;
        };
    }, []);

    return (
        <main>
            <div className="border-b border-mp-border/80 bg-mp-surface/60">
                <div className={`${contenedor} py-8 sm:py-10`}>
                    <nav
                        aria-label="Ruta de navegación"
                        className="flex items-center gap-1.5"
                    >
                        <Link href="/marketplace" className={miga}>
                            Inicio
                        </Link>
                        <span aria-hidden="true" className="text-mp-text-faint">
                            /
                        </span>
                        <span className="text-[11.5px] font-medium text-mp-primary">
                            Categorías
                        </span>
                    </nav>

                    <p className={`${eyebrow} mt-5`}>
                        <span
                            aria-hidden="true"
                            className="h-px w-6 bg-mp-olive/40"
                        />
                        Catálogo
                    </p>
                    <h1 className={`${tituloSeccion} mt-2`}>Categorías</h1>
                    <p className="mt-2 max-w-[58ch] text-[13px] leading-6 text-mp-text-soft">
                        Explorá el catálogo según lo que buscás.
                    </p>
                </div>
            </div>

            <div className={`${contenedor} py-10 sm:py-12`}>
                {error ? (
                    <p
                        role="alert"
                        className="rounded-[12px] border border-mp-error/25 bg-mp-error/5 p-4 text-[13px] text-mp-error"
                    >
                        {error}
                    </p>
                ) : null}

                {categorias === null && !error ? (
                    <div
                        aria-hidden="true"
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
                    >
                        {Array.from({ length: 8 }).map((_, indice) => (
                            <div
                                key={indice}
                                className="h-44 animate-pulse rounded-[16px] border border-mp-border bg-mp-warm"
                            />
                        ))}
                    </div>
                ) : null}

                {categorias && categorias.length > 0 ? (
                    <ul className="mp-cuadricula grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                        {categorias.map((categoria) => {
                            const Icono = iconoCategoria(categoria.nombre);
                            const imagen = imagenCategoria(categoria.nombre);
                            return (
                                <li key={categoria.nombre}>
                                    <Link
                                        href={`/marketplace/productos${construirConsultaCatalogo({ categoria: categoria.nombre })}`}
                                        className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-mp-border bg-mp-elevated transition-all duration-300 ease-out hover:-translate-y-1 hover:border-mp-primary/25 hover:shadow-[0_24px_46px_-30px_rgba(37,56,42,0.7)]"
                                    >
                                        <div className="relative aspect-[16/11] overflow-hidden bg-mp-warm">
                                            {imagen ? (
                                                <>
                                                    <Image
                                                        src={imagen}
                                                        alt=""
                                                        fill
                                                        sizes="(max-width: 640px) 50vw, 25vw"
                                                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                                                    />
                                                    <div
                                                        aria-hidden="true"
                                                        className="absolute inset-0 bg-linear-to-t from-mp-primary/70 via-mp-primary/10 to-transparent"
                                                    />
                                                </>
                                            ) : (
                                                <div
                                                    aria-hidden="true"
                                                    className="absolute inset-0 bg-linear-to-br from-mp-chip via-mp-surface to-mp-warm"
                                                />
                                            )}
                                            <span
                                                aria-hidden="true"
                                                className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-mp-elevated/90 text-mp-primary backdrop-blur"
                                            >
                                                <Icono
                                                    className="size-4"
                                                    strokeWidth={1.6}
                                                />
                                            </span>
                                        </div>
                                        <div className="flex flex-1 flex-col p-4">
                                            <span className="font-serif text-[1.15rem] leading-tight text-mp-primary">
                                                {categoria.nombre}
                                            </span>
                                            <span className="mt-0.5 text-[11.5px] text-mp-text-faint">
                                                {categoria.cantidad}{" "}
                                                {categoria.cantidad === 1
                                                    ? "producto"
                                                    : "productos"}
                                            </span>
                                            <span className="mt-auto inline-flex items-center gap-1.5 pt-3.5 text-[12.5px] font-semibold text-mp-primary">
                                                Ver productos
                                                <ArrowRight
                                                    className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                ) : categorias && categorias.length === 0 ? (
                    <div className="rounded-[16px] border border-mp-border bg-mp-elevated px-6 py-14 text-center">
                        <h2 className="font-serif text-[1.35rem] text-mp-primary">
                            Todavía no hay categorías publicadas
                        </h2>
                        <p className="mt-2 text-[13px] text-mp-text-soft">
                            Cuando las empresas publiquen productos, sus
                            categorías aparecerán acá.
                        </p>
                    </div>
                ) : null}
            </div>
        </main>
    );
}
