"use client";

import Image from "next/image";
import Link from "next/link";
import {
    ArrowRight,
    BadgeCheck,
    PackageSearch,
    ShieldCheck,
    Store,
    Truck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ImagenProducto } from "@/app/components/marketplace/imagen-producto";
import { apiRequest } from "@/app/lib/api";
import {
    construirConsultaCatalogo,
    esCategoriasPublicas,
    esRespuestaCatalogo,
    formatearImporte,
    type CategoriaPublica,
    type ProductoCatalogo,
} from "@/app/lib/marketplace";

/**
 * Secciones comerciales exclusivas de la experiencia móvil de la portada.
 * Solo se renderizan por debajo de `lg`; consumen el catálogo público real
 * (categorías, destacados y recientes) y omiten cualquier sección sin
 * datos, para no inventar contenido.
 */

function TarjetaProducto({ producto }: { producto: ProductoCatalogo }) {
    return (
        <Link
            href={`/marketplace/producto/${producto.id}`}
            className="group flex w-[168px] shrink-0 snap-start flex-col overflow-hidden rounded-[16px] border border-[#25382A]/10 bg-[#FBFAF6] transition duration-300 hover:-translate-y-0.5 hover:border-[#25382A]/25 hover:shadow-[0_16px_34px_-22px_rgba(37,56,42,.65)]"
        >
            <span className="relative aspect-[4/3] w-full overflow-hidden bg-[#EAE6D8]">
                {producto.imagenUrl ? (
                    producto.imagenUrl.startsWith("/") ? (
                        <Image
                            src={producto.imagenUrl}
                            alt={producto.nombre}
                            fill
                            sizes="168px"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            loading="lazy"
                        />
                    ) : (
                        <ImagenProducto
                            url={producto.imagenUrl}
                            alt={producto.nombre}
                            sizes="168px"
                            className="object-cover"
                            tamanoIcono="size-6"
                        />
                    )
                ) : (
                    <span className="grid h-full place-items-center text-[#7E8177]">
                        <Store className="size-7" aria-hidden="true" />
                    </span>
                )}
            </span>
            <span className="flex flex-1 flex-col gap-1 p-3">
                <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-[#252723]">
                    {producto.nombre}
                </span>
                <span className="truncate text-[10.5px] text-[#7E8177]">
                    {producto.categoria ?? "General"} · {producto.empresa.nombre}
                </span>
                <span className="mt-auto pt-1 text-[13px] font-semibold tracking-[-0.01em] text-[#25382A]">
                    {formatearImporte(producto.precioVenta)}
                </span>
            </span>
        </Link>
    );
}

const BENEFICIOS = [
    {
        icono: ShieldCheck,
        titulo: "Pago seguro",
        detalle: "Comprás con PayPal: tu dinero queda protegido.",
    },
    {
        icono: PackageSearch,
        titulo: "Seguimiento real",
        detalle: "Cada pedido muestra su recorrido hasta la entrega.",
    },
    {
        icono: Truck,
        titulo: "Envío a todo el país",
        detalle: "Recibí tus compras donde estés.",
    },
    {
        icono: BadgeCheck,
        titulo: "Tienda verificada",
        detalle: "Comprás directamente a proveedores del ERP.",
    },
];

const PASOS = [
    {
        numero: "1",
        titulo: "Elegí tus productos",
        detalle: "Explorá el catálogo de tiendas activas.",
    },
    {
        numero: "2",
        titulo: "Pagá con PayPal",
        detalle: "Checkout rápido, con o sin cuenta.",
    },
    {
        numero: "3",
        titulo: "Seguí tu pedido",
        detalle: "Estado y cronología actualizados en tiempo real.",
    },
    {
        numero: "4",
        titulo: "Recibí tu compra",
        detalle: "Entregas coordinadas por cada vendedor.",
    },
];

export function SeccionesMoviles() {
    const [categorias, setCategorias] = useState<CategoriaPublica[]>([]);
    const [destacados, setDestacados] = useState<ProductoCatalogo[]>([]);
    const [recientes, setRecientes] = useState<ProductoCatalogo[]>([]);

    useEffect(() => {
        let cancelado = false;

        async function cargar() {
            const consultas: Promise<void>[] = [];

            consultas.push(
                apiRequest("/marketplace/catalogo/categorias")
                    .then((datos) => {
                        const lista =
                            typeof datos === "object" &&
                            datos !== null &&
                            "categorias" in datos
                                ? datos.categorias
                                : null;
                        if (!cancelado && esCategoriasPublicas(lista)) {
                            setCategorias(lista.slice(0, 10));
                        }
                    })
                    .catch(() => undefined),
            );

            for (const [orden, aplicar] of [
                ["populares", setDestacados],
                ["recientes", setRecientes],
            ] as const) {
                consultas.push(
                    apiRequest(
                        `/marketplace/catalogo${construirConsultaCatalogo({
                            orden,
                            porPagina: 10,
                        })}`,
                    )
                        .then((datos) => {
                            if (
                                !cancelado &&
                                esRespuestaCatalogo(datos) &&
                                datos.catalogo.productos.length > 0
                            ) {
                                aplicar(datos.catalogo.productos);
                            }
                        })
                        .catch(() => undefined),
                );
            }

            await Promise.all(consultas);
        }

        void cargar();
        return () => {
            cancelado = true;
        };
    }, []);

    return (
        <div className="mt-10 flex flex-col gap-10 lg:hidden">
            {/* Categorías visuales */}
            {categorias.length > 0 && (
                <section aria-labelledby="movil-categorias">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#697A52]">
                                <span className="h-px w-6 bg-[#25382A]/30" />
                                Categorías
                            </p>
                            <h2
                                id="movil-categorias"
                                className="mt-2 font-serif text-[1.5rem] leading-tight text-[#25382A]"
                            >
                                Explorá por rubro
                            </h2>
                        </div>
                        <Link
                            href="/marketplace/categorias"
                            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#25382A]"
                        >
                            Ver todas
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                    </div>
                    <div className="mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {categorias.map((categoria) => (
                            <Link
                                key={categoria.nombre}
                                href={`/marketplace/productos?categoria=${encodeURIComponent(categoria.nombre)}`}
                                className="flex shrink-0 snap-start items-center gap-2 rounded-full border border-[#25382A]/15 bg-[#FBFAF6] py-2.5 pl-3.5 pr-4 text-[12.5px] font-medium text-[#252723] transition-colors hover:border-[#25382A]/40 hover:bg-[#25382A]/5"
                            >
                                {categoria.nombre}
                                <span className="rounded-full bg-[#D9E8A5]/60 px-2 py-0.5 text-[10px] font-semibold text-[#25382A]">
                                    {categoria.cantidad}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Productos destacados — carrusel táctil */}
            {destacados.length > 0 && (
                <section aria-labelledby="movil-destacados">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#697A52]">
                                <span className="h-px w-6 bg-[#25382A]/30" />
                                Destacados
                            </p>
                            <h2
                                id="movil-destacados"
                                className="mt-2 font-serif text-[1.5rem] leading-tight text-[#25382A]"
                            >
                                Los más elegidos
                            </h2>
                        </div>
                        <Link
                            href="/marketplace/productos?orden=populares"
                            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#25382A]"
                        >
                            Ver más
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                    </div>
                    <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {destacados.map((producto) => (
                            <TarjetaProducto
                                key={producto.id}
                                producto={producto}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Productos recientes */}
            {recientes.length > 0 && (
                <section aria-labelledby="movil-recientes">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#697A52]">
                                <span className="h-px w-6 bg-[#25382A]/30" />
                                Recién llegados
                            </p>
                            <h2
                                id="movil-recientes"
                                className="mt-2 font-serif text-[1.5rem] leading-tight text-[#25382A]"
                            >
                                Novedades del catálogo
                            </h2>
                        </div>
                        <Link
                            href="/marketplace/productos?orden=recientes"
                            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#25382A]"
                        >
                            Ver más
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        {recientes.slice(0, 4).map((producto) => (
                            <TarjetaProducto
                                key={producto.id}
                                producto={producto}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Beneficios de comprar */}
            <section aria-labelledby="movil-beneficios">
                <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#697A52]">
                    <span className="h-px w-6 bg-[#25382A]/30" />
                    Por qué comprar acá
                </p>
                <h2
                    id="movil-beneficios"
                    className="mt-2 font-serif text-[1.5rem] leading-tight text-[#25382A]"
                >
                    Comprar es simple y seguro
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-3">
                    {BENEFICIOS.map((beneficio) => {
                        const Icono = beneficio.icono;
                        return (
                            <li
                                key={beneficio.titulo}
                                className="rounded-[14px] border border-[#25382A]/10 bg-[#FBFAF6] p-3.5"
                            >
                                <Icono
                                    className="size-5 text-[#697A52]"
                                    aria-hidden="true"
                                />
                                <h3 className="mt-2.5 text-[12.5px] font-semibold text-[#25382A]">
                                    {beneficio.titulo}
                                </h3>
                                <p className="mt-1 text-[11px] leading-[1.5] text-[#7E8177]">
                                    {beneficio.detalle}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            </section>

            {/* Proceso de compra y entrega */}
            <section aria-labelledby="movil-proceso">
                <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#697A52]">
                    <span className="h-px w-6 bg-[#25382A]/30" />
                    Cómo funciona
                </p>
                <h2
                    id="movil-proceso"
                    className="mt-2 font-serif text-[1.5rem] leading-tight text-[#25382A]"
                >
                    De la compra a tu puerta
                </h2>
                <ol className="mt-4 space-y-0">
                    {PASOS.map((paso, indice) => (
                        <li
                            key={paso.numero}
                            className="relative flex gap-4 pb-6 last:pb-0"
                        >
                            {indice < PASOS.length - 1 && (
                                <span
                                    aria-hidden="true"
                                    className="absolute left-[15px] top-8 h-[calc(100%-28px)] w-px bg-[#25382A]/15"
                                />
                            )}
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#25382A] text-[11px] font-bold text-[#F4F1E8]">
                                {paso.numero}
                            </span>
                            <div className="pt-1">
                                <h3 className="text-[13.5px] font-semibold text-[#25382A]">
                                    {paso.titulo}
                                </h3>
                                <p className="mt-0.5 text-[12px] leading-[1.55] text-[#7E8177]">
                                    {paso.detalle}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            {/* Acceso al seguimiento */}
            <section className="rounded-[18px] border border-[#25382A]/12 bg-[#FBFAF6] p-5">
                <PackageSearch
                    className="size-6 text-[#697A52]"
                    aria-hidden="true"
                />
                <h2 className="mt-3 font-serif text-[1.35rem] leading-tight text-[#25382A]">
                    ¿Ya compraste? Seguí tu pedido
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[#55584F]">
                    Con el número de pedido y tu token privado ves el estado
                    actual y el historial completo de entregas.
                </p>
                <Link
                    href="/seguimiento-pedido"
                    className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-[#25382A] px-5 py-3 text-[13px] font-semibold text-[#F4F1E8] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#314A37]"
                >
                    Consultar seguimiento
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </section>

            {/* CTA final */}
            <section className="relative overflow-hidden rounded-[22px] bg-[#D9E8A5] px-6 py-8 text-center">
                <h2 className="font-serif text-[1.6rem] leading-tight tracking-[-0.01em] text-[#25382A]">
                    Tu próxima compra está a un toque.
                </h2>
                <p className="mx-auto mt-2 max-w-[34ch] text-[12.5px] leading-[1.6] text-[#25382A]/70">
                    Miles de productos publicados por proveedores del ecosistema
                    Nexo.
                </p>
                <Link
                    href="/marketplace/productos"
                    className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[#25382A] px-6 py-3.5 text-[13.5px] font-semibold text-[#F4F1E8] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#314A37]"
                >
                    Explorar productos
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </section>
        </div>
    );
}
