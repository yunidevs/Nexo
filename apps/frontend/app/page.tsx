import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DashboardPreview } from "@/app/components/dashboard-preview";
import { HeroMovil } from "@/app/components/landing/hero-movil";
import { Navegacion } from "@/app/components/landing/navegacion";
import { NavMovil } from "@/app/components/landing/nav-movil";
import { ProductosMarketplace } from "@/app/components/landing/productos-marketplace";
import { SeccionesMoviles } from "@/app/components/landing/secciones-movil";

export const metadata: Metadata = {
    title: {
        absolute: "Nexo ERP — Ecosistema empresarial y comercial",
    },
    description:
        "Nexo ERP integra la gestión de tu empresa con un marketplace de productos y proveedores: inventario, ventas, clientes y nuevas oportunidades comerciales desde una sola plataforma.",
};

const MODULOS = [
    {
        numero: "01",
        titulo: "Gestión empresarial",
        detalle: "Clientes, proveedores y usuarios.",
    },
    {
        numero: "02",
        titulo: "Inventario y operaciones",
        detalle: "Stock, compras y movimientos.",
    },
    {
        numero: "03",
        titulo: "Ventas y comercio",
        detalle: "Cobros, reportes y marketplace.",
    },
];

export default function Home() {
    return (
        <main
            id="inicio"
            className="landing-page relative flex min-h-[100svh] flex-col overflow-x-clip bg-[#F4F1E8] pb-20 text-[#252723] selection:bg-[#D9E8A5] selection:text-[#25382A] lg:pb-0"
        >
            {/* Materia orgánica: un único lavado de lima, muy difuso. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-52 -right-48 size-[38rem] rounded-full bg-[#D9E8A5]/35 blur-[140px]"
            />

            <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[1400px] flex-col px-5 sm:px-8 lg:px-10">
                <Navegacion />

                <HeroMovil />

                <section className="landing-bloque mt-8 grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] items-center gap-8 lg:mt-0 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-10 xl:gap-14">
                    {/* Columna de mensaje comercial */}
                    <div className="flex min-w-0 flex-col justify-center">
                        <p className="landing-entrada landing-entrada-1 flex items-center gap-3 text-[10px] font-medium tracking-[0.2em] text-[#697A52] uppercase">
                            <span className="h-px w-7 bg-[#25382A]/30" />
                            Ecosistema empresarial y comercial
                        </p>

                        <h1 className="landing-entrada landing-entrada-2 landing-titular landing-h1 font-serif font-normal leading-[1.04] tracking-[-0.012em] text-[#25382A]">
                            Tu negocio
                            <br />
                            evoluciona cuando
                            <br />
                            todo está conectado.
                        </h1>

                        <p
                            id="nosotros"
                            className="landing-ancla landing-entrada landing-entrada-3 landing-bajada max-w-[46ch] text-[13.5px] leading-[1.7] text-[#55584F]"
                        >
                            Gestiona tu empresa, conecta con proveedores y descubre
                            nuevas oportunidades comerciales desde una sola
                            plataforma.
                        </p>

                        <div className="landing-entrada landing-entrada-4 landing-acciones flex flex-wrap items-center gap-2.5">
                            <Link
                                href="/auth/register"
                                className="group inline-flex items-center gap-2 rounded-[8px] bg-[#25382A] px-5 py-3 text-[12.5px] font-semibold text-[#F4F1E8] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#314A37] hover:shadow-[0_16px_32px_-16px_rgba(37,56,42,.85)]"
                            >
                                Explorar la plataforma
                                <ArrowRight
                                    className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                                    aria-hidden="true"
                                />
                            </Link>
                            <Link
                                href="/marketplace"
                                className="inline-flex items-center rounded-[8px] border border-[#25382A]/22 px-5 py-3 text-[12.5px] font-semibold text-[#25382A] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[#25382A]/45 hover:bg-[#25382A]/5"
                            >
                                Descubrir Marketplace
                            </Link>
                        </div>

                        <ul
                            id="funcionalidades"
                            className="landing-ancla landing-entrada landing-entrada-5 landing-modulos grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-4 border-t border-[#25382A]/12 sm:grid-cols-[repeat(3,minmax(0,1fr))]"
                        >
                            {MODULOS.map((modulo) => (
                                <li key={modulo.numero}>
                                    <span className="text-[9.5px] font-semibold tracking-[0.18em] text-[#697A52]">
                                        {modulo.numero}
                                    </span>
                                    <h2 className="mt-1.5 text-[12.5px] font-semibold tracking-[-0.01em] text-[#25382A]">
                                        {modulo.titulo}
                                    </h2>
                                    <p className="mt-1 text-[11px] leading-[1.55] text-[#7E8177]">
                                        {modulo.detalle}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Mockup del ERP: en móvil cede el espacio al hero comercial */}
                    <div className="landing-entrada landing-entrada-3 hidden h-full max-h-[600px] min-h-[300px] min-w-0 sm:min-h-[380px] lg:block lg:min-h-0">
                        <DashboardPreview />
                    </div>
                </section>

                {/* Franja del marketplace */}
                <section
                    aria-labelledby="titulo-marketplace"
                    className="min-w-0 shrink-0 border-t border-[#25382A]/12"
                >
                    <div className="landing-banda grid min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)] lg:gap-10">
                        <div className="flex flex-col gap-3.5">
                            <div>
                                <p className="flex items-center gap-3 text-[10px] font-medium tracking-[0.2em] text-[#697A52] uppercase">
                                    <span className="h-px w-6 bg-[#25382A]/30" />
                                    Nexo Marketplace
                                </p>
                                <h2
                                    id="titulo-marketplace"
                                    className="landing-titulo-banda mt-2 font-serif leading-[1.12] tracking-[-0.01em] text-[#25382A]"
                                >
                                    Un mercado. Infinitas oportunidades.
                                </h2>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
                                <p className="max-w-[36ch] text-[11.5px] leading-[1.6] text-[#7E8177]">
                                    Conecta compradores y proveedores.
                                </p>
                                <Link
                                    href="/marketplace/productos"
                                    className="group inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-[#25382A]"
                                >
                                    Explorar todos los productos
                                    <ArrowRight
                                        className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </div>
                        </div>

                        <ProductosMarketplace />
                    </div>
                </section>

                <SeccionesMoviles />
            </div>

            <NavMovil />
        </main>
    );
}
