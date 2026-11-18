"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { useState } from "react";

/**
 * El campo imagenUrl lo carga cada empresa: puede apuntar a una página web en
 * lugar de a un archivo de imagen, o el recurso puede dejar de existir. Se
 * aceptan solo URLs http(s); el marcador queda detrás de la imagen, de modo
 * que se ve mientras carga y en reemplazo si la imagen falla al cargar.
 */
export function esUrlImagenValida(url: string): boolean {
    return /^https?:\/\//i.test(url);
}

interface ImagenProductoProps {
    url: string | null;
    alt: string;
    sizes?: string;
    priority?: boolean;
    className?: string;
    /** Tamaño del icono del marcador (clases de Tailwind). */
    tamanoIcono?: string;
    /** Texto opcional que acompaña al marcador cuando no hay fotografía. */
    textoSinImagen?: string;
}

function Marcador({
    tamanoIcono,
    textoSinImagen,
}: {
    tamanoIcono: string;
    textoSinImagen?: string;
}) {
    return (
        <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center"
        >
            <span className="flex flex-col items-center gap-2">
                <Package
                    className={`${tamanoIcono} text-mp-olive/45`}
                    strokeWidth={1.15}
                />
                {textoSinImagen ? (
                    <span className="text-[10px] font-medium tracking-[0.14em] text-mp-text-faint/80 uppercase">
                        {textoSinImagen}
                    </span>
                ) : null}
            </span>
        </span>
    );
}

export function ImagenProducto({
    url,
    alt,
    sizes = "25vw",
    priority = false,
    className = "object-cover",
    tamanoIcono = "size-12",
    textoSinImagen,
}: ImagenProductoProps) {
    const [falloCarga, setFalloCarga] = useState(false);

    if (url === null || !esUrlImagenValida(url) || falloCarga) {
        return (
            <Marcador
                tamanoIcono={tamanoIcono}
                textoSinImagen={textoSinImagen}
            />
        );
    }

    return (
        <>
            <Marcador tamanoIcono={tamanoIcono} />
            <Image
                src={url}
                alt={alt}
                fill
                sizes={sizes}
                priority={priority}
                unoptimized
                onError={() => setFalloCarga(true)}
                className={className}
            />
        </>
    );
}
