"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Store } from "lucide-react";
import { TarjetaProducto } from "@/app/components/marketplace/tarjeta-producto";
import {
    botonPrimario,
    contenedor,
    eyebrow,
    miga,
} from "@/app/components/marketplace/estilos";
import { apiRequest } from "@/app/lib/api";
import {
    categoriasDeTienda,
    construirConsultaCatalogo,
    esRespuestaTienda,
    formatearImporte,
    type ProductoCatalogo,
    type TiendaMarketplace,
} from "@/app/lib/marketplace";

export default function PaginaTiendaMarketplace({
    params,
}: PageProps<"/marketplace/tienda/[slug]">) {
    const { slug } = use(params);
    const [tienda, setTienda] = useState<TiendaMarketplace | null>(null);
    const [noEncontrada, setNoEncontrada] = useState(false);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let cancelada = false;
        async function cargarTienda() {
            setCargando(true);
            setNoEncontrada(false);
            setError("");
            try {
                const datos = await apiRequest(
                    `/marketplace/tiendas/${encodeURIComponent(slug)}`,
                );
                if (cancelada) return;
                if (esRespuestaTienda(datos)) {
                    setTienda(datos.tienda);
                } else {
                    throw new Error(
                        "La API devolvió los datos de la tienda no válidos.",
                    );
                }
            } catch (errorCarga) {
                if (cancelada) return;
                if (
                    errorCarga instanceof Error &&
                    "status" in errorCarga &&
                    (errorCarga as { status?: number }).status === 404
                ) {
                    setNoEncontrada(true);
                } else {
                    setError(
                        errorCarga instanceof Error
                            ? errorCarga.message
                            : "No se pudo cargar la tienda.",
                    );
                }
            } finally {
                if (!cancelada) setCargando(false);
            }
        }
        void cargarTienda();
        return () => {
            cancelada = true;
        };
    }, [slug]);

    // Los productos de la respuesta de la tienda no traen la empresa anidada:
    // se completa con los datos de la propia tienda para reutilizar la tarjeta.
    const productos: ProductoCatalogo[] | null = tienda
        ? tienda.productos.map((producto) => ({
              ...producto,
              empresa: {
                  id: tienda.id,
                  nombre: tienda.nombre,
                  slug: tienda.slug,
              },
          }))
        : null;
    const categorias = tienda ? categoriasDeTienda(tienda) : [];

    return (
        <main>
            <div className="border-b border-mp-border/80 bg-mp-surface/60">
                <div className={`${contenedor} py-6 sm:py-8`}>
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
                        <Link href="/marketplace/empresas" className={miga}>
                            Empresas
                        </Link>
                        <span aria-hidden="true" className="text-mp-text-faint">
                            /
                        </span>
                        <span className="text-[11.5px] font-medium text-mp-primary">
                            {tienda?.nombre ?? "Tienda"}
                        </span>
                    </nav>

                    {cargando ? (
                        <div
                            aria-hidden="true"
                            className="mt-5 h-20 animate-pulse rounded-[16px] bg-mp-warm"
                        />
                    ) : tienda ? (
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                            <span
                                aria-hidden="true"
                                className="grid size-14 shrink-0 place-items-center rounded-full bg-mp-chip text-mp-primary"
                            >
                                <Store className="size-6" strokeWidth={1.4} />
                            </span>
                            <div className="min-w-0">
                                <p className={eyebrow}>
                                    <span
                                        aria-hidden="true"
                                        className="h-px w-6 bg-mp-olive/40"
                                    />
                                    Tienda
                                </p>
                                <h1 className="mt-1.5 font-serif text-[2rem] leading-[1.1] tracking-[-0.015em] text-mp-primary sm:text-[2.4rem]">
                                    {tienda.nombre}
                                </h1>
                                <p className="mt-1.5 text-[12.5px] text-mp-text-soft">
                                    {productos?.length ?? 0}{" "}
                                    {productos?.length === 1
                                        ? "producto publicado"
                                        : "productos publicados"}{" "}
                                    · Envío{" "}
                                    {Number(tienda.costoEnvio) === 0
                                        ? "sin costo"
                                        : formatearImporte(tienda.costoEnvio)}
                                </p>
                            </div>
                            {categorias.length > 0 ? (
                                <ul
                                    aria-label="Categorías de la tienda"
                                    className="flex flex-wrap gap-1.5 lg:ml-auto"
                                >
                                    {categorias.map((categoria) => (
                                        <li key={categoria.nombre}>
                                            <Link
                                                href={`/marketplace/productos${construirConsultaCatalogo({ empresa: tienda.slug, categoria: categoria.nombre })}`}
                                                className="inline-flex items-center rounded-full border border-mp-border bg-mp-elevated px-3 py-1.5 text-[11.5px] font-medium text-mp-text-soft transition-colors duration-300 hover:border-mp-primary/40 hover:text-mp-primary"
                                            >
                                                {categoria.nombre}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className={`${contenedor} py-8 sm:py-10`}>
                {error ? (
                    <p
                        role="alert"
                        className="rounded-[12px] border border-mp-error/25 bg-mp-error/5 p-4 text-[13px] text-mp-error"
                    >
                        {error}
                    </p>
                ) : null}

                {noEncontrada ? (
                    <div className="rounded-[16px] border border-mp-border bg-mp-elevated px-6 py-14 text-center">
                        <h2 className="font-serif text-[1.35rem] text-mp-primary">
                            Esta tienda no existe o ya no está publicada
                        </h2>
                        <Link
                            href="/marketplace/empresas"
                            className={`${botonPrimario} mt-5`}
                        >
                            Ver todas las empresas
                        </Link>
                    </div>
                ) : productos && productos.length > 0 ? (
                    <div className="mp-cuadricula grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                        {productos.map((producto) => (
                            <TarjetaProducto
                                key={producto.id}
                                producto={producto}
                            />
                        ))}
                    </div>
                ) : productos && productos.length === 0 ? (
                    <div className="rounded-[16px] border border-mp-border bg-mp-elevated px-6 py-14 text-center">
                        <h2 className="font-serif text-[1.35rem] text-mp-primary">
                            Esta tienda todavía no publicó productos
                        </h2>
                        <Link
                            href="/marketplace/productos"
                            className={`${botonPrimario} mt-5`}
                        >
                            Explorar otros productos
                        </Link>
                    </div>
                ) : null}
            </div>
        </main>
    );
}
