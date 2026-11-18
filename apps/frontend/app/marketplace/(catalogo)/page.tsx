"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { useEffect, useState } from "react";

import { TarjetaEmpresa } from "@/app/components/marketplace/tarjeta-empresa";
import { TarjetaProducto } from "@/app/components/marketplace/tarjeta-producto";
import { iconoCategoria } from "@/app/components/marketplace/icono-categoria";
import { useRevealSecciones } from "@/app/components/marketplace/reveal";
import {
    botonPrimario,
    botonSecundario,
    botonTexto,
    contenedor,
    eyebrow,
    tituloSeccion,
} from "@/app/components/marketplace/estilos";
import { apiRequest } from "@/app/lib/api";
import {
    construirConsultaCatalogo,
    esCategoriasPublicas,
    esRespuestaCatalogo,
    esTiendaMarketplace,
    type CategoriaPublica,
    type ProductoCatalogo,
    type TiendaMarketplace,
} from "@/app/lib/marketplace";

const CANTIDAD_PRODUCTOS = 8;
const CANTIDAD_NOVEDADES = 4;
const CANTIDAD_CATEGORIAS = 6;
const CANTIDAD_TIENDAS = 3;

function esListaTiendas(
    valor: unknown,
): valor is { tiendas: TiendaMarketplace[] } {
    return (
        typeof valor === "object" &&
        valor !== null &&
        Array.isArray((valor as { tiendas?: unknown }).tiendas) &&
        (valor as { tiendas: unknown[] }).tiendas.every(esTiendaMarketplace)
    );
}

const beneficios = [
    {
        titulo: "Varias tiendas, un solo lugar",
        texto: "Descubrí productos de diferentes empresas desde un mismo catálogo.",
    },
    {
        titulo: "Variedad para elegir",
        texto: "Explorá distintas categorías y compará opciones.",
    },
    {
        titulo: "Una compra sencilla",
        texto: "Encontrá lo que buscás y gestioná tus compras desde tu cuenta.",
    },
    {
        titulo: "Seguimiento de pedidos",
        texto: "Consultá el estado de tus compras desde la plataforma.",
    },
] as const;

export default function PaginaInicioMarketplace() {
    const [populares, setPopulares] = useState<ProductoCatalogo[] | null>(
        null,
    );
    const [novedades, setNovedades] = useState<ProductoCatalogo[] | null>(
        null,
    );
    const [totalProductos, setTotalProductos] = useState<number | null>(null);
    const [tiendas, setTiendas] = useState<TiendaMarketplace[] | null>(null);
    const [categorias, setCategorias] = useState<CategoriaPublica[] | null>(
        null,
    );
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(true);

    useRevealSecciones();

    useEffect(() => {
        let cancelada = false;

        async function cargarInicio() {
            const [
                resultadoPopulares,
                resultadoNovedades,
                resultadoTiendas,
                resultadoCategorias,
            ] = await Promise.allSettled([
                apiRequest(
                    `/marketplace/catalogo${construirConsultaCatalogo({
                        orden: "populares",
                        porPagina: CANTIDAD_PRODUCTOS,
                    })}`,
                ),
                apiRequest(
                    `/marketplace/catalogo${construirConsultaCatalogo({
                        orden: "recientes",
                        porPagina: CANTIDAD_PRODUCTOS,
                    })}`,
                ),
                apiRequest("/marketplace/tiendas"),
                apiRequest("/marketplace/catalogo/categorias"),
            ]);

            if (cancelada) return;

            if (resultadoPopulares.status === "rejected") {
                const motivo = resultadoPopulares.reason;
                setError(
                    motivo instanceof Error
                        ? motivo.message
                        : "No se pudo cargar el marketplace.",
                );
            } else {
                const datos = resultadoPopulares.value;
                if (esRespuestaCatalogo(datos)) {
                    setPopulares(datos.catalogo.productos);
                    setTotalProductos(datos.catalogo.total);
                }
            }

            if (resultadoNovedades.status === "fulfilled") {
                const datos = resultadoNovedades.value;
                if (esRespuestaCatalogo(datos)) {
                    setNovedades(
                        datos.catalogo.productos.slice(
                            0,
                            CANTIDAD_NOVEDADES,
                        ),
                    );
                }
            }

            if (resultadoTiendas.status === "fulfilled") {
                const datos = resultadoTiendas.value;
                if (esListaTiendas(datos)) {
                    setTiendas(
                        datos.tiendas.filter(
                            (tienda) => tienda.productos.length > 0,
                        ),
                    );
                }
            }

            if (resultadoCategorias.status === "fulfilled") {
                const datos = resultadoCategorias.value;
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
                }
            }

            if (!cancelada) setCargando(false);
        }

        void cargarInicio();

        return () => {
            cancelada = true;
        };
    }, []);

    return (
        <main className="bg-mp-bg text-mp-text">
            {/* Hero comercial: compacto, para no apartar al visitante del
                catálogo. */}
            <section className="overflow-x-clip border-b border-mp-border/80 bg-mp-surface/60">
                <div
                    className={`${contenedor} grid items-center gap-8 py-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 lg:py-12`}
                >
                    <div>
                        <p className={eyebrow}>
                            <span
                                aria-hidden="true"
                                className="h-px w-7 bg-mp-olive/40"
                            />
                            Nexo Marketplace
                        </p>

                        <h1 className="mt-4 font-serif text-[2.35rem] leading-[1.04] font-normal tracking-[-0.015em] text-mp-primary sm:text-[3rem] lg:text-[3.45rem]">
                            Todo lo que buscás.
                            <br />
                            En un solo lugar.
                        </h1>

                        <p className="mt-4 max-w-[46ch] text-[13.5px] leading-[1.7] text-mp-text-soft">
                            Descubrí productos, conectá con proveedores y
                            encontrá nuevas oportunidades comerciales.
                        </p>

                        <div className="mt-6 flex flex-wrap items-center gap-2.5">
                            <Link href="/marketplace/productos" className={botonPrimario}>
                                Explorar catálogo
                                <ArrowRight
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                            </Link>
                            <Link
                                href="/marketplace/empresas"
                                className={botonSecundario}
                            >
                                Ver tiendas
                            </Link>
                        </div>

                        {totalProductos !== null ? (
                            <p className="mt-5 flex items-center gap-2 text-[11.5px] text-mp-text-faint">
                                <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-mp-sage"
                                />
                                <span className="font-semibold text-mp-primary">
                                    {totalProductos.toLocaleString("es-UY")}
                                </span>{" "}
                                {totalProductos === 1
                                    ? "producto disponible"
                                    : "productos disponibles"}{" "}
                                en el marketplace
                            </p>
                        ) : null}
                    </div>

                    <div>
                        <div className="relative">
                            <div
                                aria-hidden="true"
                                className="absolute -top-10 -right-8 size-64 rounded-full bg-mp-accent/50 blur-3xl"
                            />
                            <div className="relative overflow-hidden rounded-[26px] border border-mp-border bg-mp-warm">
                                <div className="relative aspect-[4/3] sm:aspect-[16/9]">
                                    <Image
                                        src="/marketplace/hero-lifestyle.jpg"
                                        alt="Selección de productos para el día a día"
                                        fill
                                        priority
                                        sizes="(max-width: 1024px) 100vw, 48vw"
                                        className="object-cover"
                                    />
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-0 bg-linear-to-t from-mp-primary/45 via-transparent to-transparent"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-mp-elevated px-5 py-4">
                                    <div>
                                        <p className="text-[10px] font-semibold tracking-[0.18em] text-mp-olive-ink uppercase">
                                            Catálogo en vivo
                                        </p>
                                        <p className="mt-1 font-serif text-[1.15rem] leading-tight text-mp-primary">
                                            Productos de distintas tiendas
                                        </p>
                                    </div>
                                    <Link
                                        href="/marketplace/productos"
                                        className={botonTexto}
                                    >
                                        Explorar
                                        <ArrowRight
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className={contenedor}>
                {error && (
                    <p
                        role="alert"
                        className="mt-8 rounded-[12px] border border-mp-error/25 bg-mp-error/5 p-4 text-[13px] text-mp-error"
                    >
                        {error}
                    </p>
                )}

                {/* Categorías: índice editorial */}
                {categorias && categorias.length > 0 && (
                    <section
                        key="categorias"
                        aria-labelledby="titulo-categorias"
                        data-mp-reveal
                        className="py-12 sm:py-14"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className={eyebrow}>
                                    <span
                                        aria-hidden="true"
                                        className="h-px w-6 bg-mp-olive/40"
                                    />
                                    Encontrá lo que necesitás
                                </p>
                                <h2
                                    id="titulo-categorias"
                                    className={`${tituloSeccion} mt-2`}
                                >
                                    Comprar por categoría
                                </h2>
                            </div>
                            <Link
                                href="/marketplace/categorias"
                                className={botonTexto}
                            >
                                Ver todas
                                <ArrowRight
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                            </Link>
                        </div>

                        <ul className="mt-7 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
                            {categorias
                                .slice(0, CANTIDAD_CATEGORIAS)
                                .map((categoria) => {
                                    const Icono = iconoCategoria(
                                        categoria.nombre,
                                    );
                                    return (
                                        <li key={categoria.nombre}>
                                            <Link
                                                href={`/marketplace/productos${construirConsultaCatalogo(
                                                    {
                                                        categoria:
                                                            categoria.nombre,
                                                    },
                                                )}`}
                                                className="group flex items-center gap-3.5 border-b border-mp-border py-4"
                                            >
                                                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mp-chip text-mp-olive-ink transition-all duration-300 group-hover:bg-mp-accent group-hover:text-mp-primary">
                                                    <Icono
                                                        className="size-4"
                                                        strokeWidth={1.6}
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-serif text-[1.2rem] leading-tight text-mp-primary">
                                                        {categoria.nombre}
                                                    </span>
                                                    <span className="mt-0.5 block text-[11.5px] text-mp-text-faint">
                                                        {categoria.cantidad}{" "}
                                                        {categoria.cantidad === 1
                                                            ? "producto"
                                                            : "productos"}
                                                    </span>
                                                </span>
                                                <ArrowRight
                                                    className="size-4 shrink-0 text-mp-text-faint transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-mp-primary"
                                                    aria-hidden="true"
                                                />
                                            </Link>
                                        </li>
                                    );
                                })}
                        </ul>
                    </section>
                )}

                {/* Productos destacados: catálogo global */}
                <section
                    key="productos"
                    aria-labelledby="titulo-productos"
                    data-mp-reveal
                    className="border-t border-mp-border/80 py-12 sm:py-14"
                >
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className={eyebrow}>
                                <span
                                    aria-hidden="true"
                                    className="h-px w-6 bg-mp-olive/40"
                                />
                                Selección del marketplace
                            </p>
                            <h2
                                id="titulo-productos"
                                className={`${tituloSeccion} mt-2`}
                            >
                                Productos que te pueden gustar
                            </h2>
                            <p className="mt-2 max-w-[52ch] text-[13px] leading-6 text-mp-text-soft">
                                Descubrí artículos publicados por todas nuestras
                                tiendas.
                            </p>
                        </div>
                        <Link
                            href="/marketplace/productos"
                            className={botonTexto}
                        >
                            Ver catálogo
                            <ArrowRight
                                className="size-3.5"
                                aria-hidden="true"
                            />
                        </Link>
                    </div>

                    {cargando ? (
                        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, indice) => (
                                <div
                                    key={indice}
                                    className="min-h-[19rem] animate-pulse rounded-[16px] border border-mp-border bg-mp-warm"
                                />
                            ))}
                        </div>
                    ) : populares && populares.length > 0 ? (
                        <div className="mp-cuadricula mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                            {populares.map((producto) => (
                                <TarjetaProducto
                                    key={producto.id}
                                    producto={producto}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="mt-8 rounded-[16px] border border-dashed border-mp-border bg-mp-elevated px-6 py-14 text-center">
                            <p className="font-serif text-[1.35rem] text-mp-primary">
                                Todavía no hay productos publicados
                            </p>
                            <p className="mt-1.5 text-[13px] text-mp-text-soft">
                                Volvé pronto para descubrir nuevos productos.
                            </p>
                        </div>
                    )}
                </section>

                {/* Novedades */}
                {novedades && novedades.length > 0 && (
                    <section
                        key="novedades"
                        aria-labelledby="titulo-novedades"
                        data-mp-reveal
                        className="border-t border-mp-border/80 py-12 sm:py-14"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className={eyebrow}>
                                    <span
                                        aria-hidden="true"
                                        className="h-px w-6 bg-mp-olive/40"
                                    />
                                    Recién publicados
                                </p>
                                <h2
                                    id="titulo-novedades"
                                    className={`${tituloSeccion} mt-2`}
                                >
                                    Novedades del catálogo
                                </h2>
                            </div>
                            <Link
                                href="/marketplace/productos?orden=recientes"
                                className={botonTexto}
                            >
                                Ver todas
                                <ArrowRight
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                            </Link>
                        </div>

                        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {novedades.map((producto) => (
                                <li key={producto.id}>
                                    <TarjetaProducto
                                        producto={producto}
                                    />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Tiendas */}
                {tiendas && tiendas.length > 0 && (
                    <section
                        key="tiendas"
                        aria-labelledby="titulo-tiendas"
                        data-mp-reveal
                        className="border-t border-mp-border/80 py-12 sm:py-14"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className={eyebrow}>
                                    <span
                                        aria-hidden="true"
                                        className="h-px w-6 bg-mp-olive/40"
                                    />
                                    Nuestros vendedores
                                </p>
                                <h2
                                    id="titulo-tiendas"
                                    className={`${tituloSeccion} mt-2`}
                                >
                                    Explorá nuestras tiendas
                                </h2>
                                <p className="mt-2 max-w-[52ch] text-[13px] leading-6 text-mp-text-soft">
                                    Conocé las empresas detrás de los productos.
                                </p>
                            </div>
                            <Link
                                href="/marketplace/empresas"
                                className={botonTexto}
                            >
                                Ver todas
                                <ArrowRight
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                            </Link>
                        </div>

                        <div className="mp-cuadricula mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {tiendas.slice(0, CANTIDAD_TIENDAS).map((tienda) => (
                                <TarjetaEmpresa
                                    key={tienda.id}
                                    tienda={tienda}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Beneficios */}
                <section
                    key="beneficios"
                    aria-labelledby="titulo-beneficios"
                    data-mp-reveal
                    className="border-t border-mp-border/80 py-12 sm:py-14"
                >
                    <h2 id="titulo-beneficios" className="sr-only">
                        Beneficios del marketplace
                    </h2>
                    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {beneficios.map((beneficio, indice) => (
                            <li key={beneficio.titulo}>
                                <span className="text-[10px] font-semibold tracking-[0.2em] text-mp-olive-ink">
                                    0{indice + 1}
                                </span>
                                <h3 className="mt-2 font-serif text-[1.2rem] leading-tight text-mp-primary">
                                    {beneficio.titulo}
                                </h3>
                                <p className="mt-1.5 text-[12.5px] leading-[1.6] text-mp-text-soft">
                                    {beneficio.texto}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            {/* Banda comercial */}
            <section className="bg-mp-surface">
                <div
                    className={`${contenedor} flex flex-col gap-5 py-12 md:flex-row md:items-center md:justify-between`}
                >
                    <div className="max-w-xl">
                        <p className={eyebrow}>
                            <span
                                aria-hidden="true"
                                className="h-px w-6 bg-mp-olive/40"
                            />
                            Smart shopping
                        </p>
                        <h2 className="mt-2 font-serif text-[1.8rem] leading-[1.15] tracking-[-0.01em] text-mp-primary sm:text-[2.25rem]">
                            Una tienda para cada necesidad.
                        </h2>
                        <p className="mt-2.5 text-[13px] leading-6 text-mp-text-soft">
                            Explorá las empresas que forman parte de Nexo
                            Marketplace.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Link href="/marketplace/empresas" className={botonPrimario}>
                            Descubrir tiendas
                            <ArrowRight
                                className="size-3.5"
                                aria-hidden="true"
                            />
                        </Link>
                        <span className="inline-flex items-center gap-2 text-[12px] text-mp-text-faint">
                            <Store className="size-4" aria-hidden="true" />
                            Publican las empresas desde su ERP
                        </span>
                    </div>
                </div>
            </section>
        </main>
    );
}
