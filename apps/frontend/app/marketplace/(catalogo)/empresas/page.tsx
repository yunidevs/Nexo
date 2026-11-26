"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TarjetaEmpresa } from "@/app/components/marketplace/tarjeta-empresa";
import {
    contenedor,
    eyebrow,
    miga,
    tituloSeccion,
} from "@/app/components/marketplace/estilos";
import { apiRequest } from "@/app/lib/api";
import {
    esTiendaMarketplace,
    type TiendaMarketplace,
} from "@/app/lib/marketplace";

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

export default function PaginaEmpresasMarketplace() {
    const [tiendas, setTiendas] = useState<TiendaMarketplace[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelada = false;
        async function cargarTiendas() {
            try {
                const datos = await apiRequest("/marketplace/tiendas");
                if (cancelada) return;
                if (esListaTiendas(datos)) {
                    setTiendas(
                        datos.tiendas.filter(
                            (tienda) => tienda.productos.length > 0,
                        ),
                    );
                } else {
                    throw new Error(
                        "La API devolvió las tiendas con un formato no válido.",
                    );
                }
            } catch (errorCarga) {
                if (cancelada) return;
                setError(
                    errorCarga instanceof Error
                        ? errorCarga.message
                        : "No se pudo cargar el listado de empresas.",
                );
            }
        }
        void cargarTiendas();
        return () => {
            cancelada = true;
        };
    }, []);

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
                        <span className="text-[11.5px] font-medium text-mp-primary">
                            Empresas
                        </span>
                    </nav>

                    <p className={`${eyebrow} mt-4`}>
                        <span
                            aria-hidden="true"
                            className="h-px w-6 bg-mp-olive/40"
                        />
                        Vendedores
                    </p>
                    <h1 className={`${tituloSeccion} mt-1.5`}>
                        Empresas del marketplace
                    </h1>
                    <p className="mt-1.5 max-w-[58ch] text-[13px] leading-6 text-mp-text-soft">
                        Cada empresa publica y vende sus productos directamente.
                    </p>
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

                {tiendas === null && !error ? (
                    <div
                        aria-hidden="true"
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {Array.from({ length: 3 }).map((_, indice) => (
                            <div
                                key={indice}
                                className="h-56 animate-pulse rounded-[16px] border border-mp-border bg-mp-warm"
                            />
                        ))}
                    </div>
                ) : null}

                {tiendas && tiendas.length > 0 ? (
                    <div className="mp-cuadricula grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {tiendas.map((tienda) => (
                            <TarjetaEmpresa
                                key={tienda.id}
                                tienda={tienda}
                            />
                        ))}
                    </div>
                ) : tiendas && tiendas.length === 0 ? (
                    <div className="rounded-[16px] border border-mp-border bg-mp-elevated px-6 py-14 text-center">
                        <h2 className="font-serif text-[1.35rem] text-mp-primary">
                            Todavía no hay empresas publicando productos
                        </h2>
                        <p className="mt-2 text-[13px] text-mp-text-soft">
                            Cuando una empresa active su tienda, la vas a ver
                            acá.
                        </p>
                    </div>
                ) : null}
            </div>
        </main>
    );
}
