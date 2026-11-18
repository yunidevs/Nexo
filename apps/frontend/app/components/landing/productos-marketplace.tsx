"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ImagenProducto } from "@/app/components/marketplace/imagen-producto";
import { apiRequest } from "@/app/lib/api";
import {
    construirConsultaCatalogo,
    esRespuestaCatalogo,
    formatearImporte,
    type ProductoCatalogo,
} from "@/app/lib/marketplace";

/**
 * Muestra del marketplace para la portada.
 *
 * Prioriza publicaciones reales del catálogo público y solo recurre a la
 * selección de muestra cuando no hay datos publicables (API inaccesible,
 * catálogo vacío o publicaciones sin fotografía utilizable). El contenido
 * de muestra se identifica de forma explícita para no presentarlo como
 * inventario real de la plataforma.
 */

const CANTIDAD = 3;

const MUESTRA = [
    {
        id: "muestra-hogar",
        nombre: "Sillón de línea Nordic",
        categoria: "Hogar",
        empresa: "Muestra",
        precio: 1290,
        imagen: "/marketplace/editorial-hogar.jpg",
    },
    {
        id: "muestra-tecnologia",
        nombre: "Auriculares over-ear",
        categoria: "Tecnología",
        empresa: "Muestra",
        precio: 349,
        imagen: "/marketplace/editorial-tecnologia.jpg",
    },
    {
        id: "muestra-moda",
        nombre: "Abrigo de invierno",
        categoria: "Moda",
        empresa: "Muestra",
        precio: 215,
        imagen: "/marketplace/editorial-moda.jpg",
    },
];

interface Tarjeta {
    id: string;
    nombre: string;
    categoria: string;
    empresa: string;
    precio: string | null;
    imagen: string | null;
    href: string;
    esMuestra: boolean;
}

/* Se calcula una sola vez: es el contenido de reserva mientras se
   resuelve el catálogo real. */
const TARJETAS_MUESTRA: Tarjeta[] = MUESTRA.map(aTarjetaMuestra);

/** Comprueba que una imagen remota se pueda mostrar antes de usarla. */
function imagenDisponible(url: string | null): Promise<boolean> {
    if (!url || !/^https?:\/\//i.test(url)) {
        return Promise.resolve(false);
    }

    return new Promise((resolver) => {
        // window.Image: el componente de next/image no es un constructor.
        const imagen = new window.Image();
        const finalizar = (carga: boolean) => {
            window.clearTimeout(limite);
            resolver(carga);
        };
        const limite = window.setTimeout(() => finalizar(false), 2500);

        imagen.onload = () => finalizar(true);
        imagen.onerror = () => finalizar(false);
        imagen.src = url;
    });
}

function aTarjeta(producto: ProductoCatalogo): Tarjeta {
    return {
        id: producto.id,
        nombre: producto.nombre,
        categoria: producto.categoria?.trim() || "General",
        empresa: producto.empresa.nombre,
        precio: formatearImporte(producto.precioVenta),
        imagen: producto.imagenUrl,
        href: `/marketplace/producto/${producto.id}`,
        esMuestra: false,
    };
}

function aTarjetaMuestra(
    entrada: (typeof MUESTRA)[number],
): Tarjeta {
    return {
        id: entrada.id,
        nombre: entrada.nombre,
        categoria: entrada.categoria,
        empresa: entrada.empresa,
        precio: formatearImporte(entrada.precio),
        imagen: entrada.imagen,
        href: "/marketplace/productos",
        esMuestra: true,
    };
}

function Miniatura({ url, alt }: { url: string | null; alt: string }) {
    if (url && url.startsWith("/")) {
        return (
            <Image
                src={url}
                alt={alt}
                fill
                sizes="64px"
                className="object-cover"
            />
        );
    }

    return (
        <ImagenProducto
            url={url}
            alt={alt}
            sizes="64px"
            className="object-cover"
            tamanoIcono="size-5"
        />
    );
}

export function ProductosMarketplace() {
    const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null);
    const [total, setTotal] = useState<number | null>(null);

    useEffect(() => {
        let cancelado = false;

        async function cargar() {
            let productos: ProductoCatalogo[] = [];

            try {
                const datos: unknown = await apiRequest(
                    `/marketplace/catalogo${construirConsultaCatalogo({
                        orden: "populares",
                        porPagina: 8,
                    })}`,
                );

                if (esRespuestaCatalogo(datos)) {
                    productos = datos.catalogo.productos;
                    if (!cancelado) {
                        setTotal(datos.catalogo.total);
                    }
                }
            } catch {
                /* Sin API disponible: se muestra la selección de muestra. */
            }

            const candidatas = await Promise.all(
                productos
                    .slice(0, 8)
                    .map(async (producto) => ({
                        producto,
                        carga: await imagenDisponible(producto.imagenUrl),
                    })),
            );

            const publicables = candidatas
                .filter((candidata) => candidata.carga)
                .map((candidata) => candidata.producto);

            const seleccionadas =
                publicables.length >= CANTIDAD
                    ? publicables.slice(0, CANTIDAD).map(aTarjeta)
                    : TARJETAS_MUESTRA;

            if (!cancelado) setTarjetas(seleccionadas);
        }

        void cargar();

        return () => {
            cancelado = true;
        };
    }, []);

    /* Mientras no se resuelve el catálogo se muestra la selección de
       muestra; el rótulo acompaña siempre a lo que se está viendo. */
    const esMuestra = tarjetas
        ? tarjetas.some((tarjeta) => tarjeta.esMuestra)
        : true;

    return (
        <div className="flex min-w-0 w-full flex-col gap-2.5 lg:w-[720px]">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:gap-3">
                {(tarjetas ?? TARJETAS_MUESTRA).map((tarjeta) => (
                    <Link
                        key={tarjeta.id}
                        href={tarjeta.href}
                        className="group flex items-center gap-3 rounded-[14px] border border-[#25382A]/10 bg-[#FBFAF6] p-2 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[#25382A]/25 hover:shadow-[0_16px_34px_-22px_rgba(37,56,42,.65)]"
                    >
                        <span className="relative size-16 shrink-0 overflow-hidden rounded-[10px] bg-[#EAE6D8]">
                            <Miniatura
                                url={tarjeta.imagen}
                                alt={tarjeta.nombre}
                            />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-medium text-[#252723]">
                                {tarjeta.nombre}
                            </span>
                            <span className="mt-0.5 block truncate text-[10.5px] text-[#7E8177]">
                                {tarjeta.categoria} · {tarjeta.empresa}
                            </span>
                            {tarjeta.precio && (
                                <span className="mt-1 block text-[12px] font-semibold tracking-[-0.01em] text-[#25382A]">
                                    {tarjeta.precio}
                                </span>
                            )}
                        </span>
                    </Link>
                ))}
            </div>

            <p className="text-[10.5px] leading-4 text-[#7E8177]">
                {esMuestra
                    ? "Selección de muestra del catálogo. Las publicaciones reales están en el marketplace."
                    : "Publicaciones reales del catálogo público de Nexo Marketplace."}
                {total !== null && !esMuestra && (
                    <>
                        {" "}
                        <span className="font-medium text-[#55584F]">
                            {total.toLocaleString("es-UY")}{" "}
                            {total === 1 ? "publicación" : "publicaciones"}
                        </span>{" "}
                        activas.
                    </>
                )}
            </p>
        </div>
    );
}
