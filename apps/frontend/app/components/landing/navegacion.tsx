"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { MarcaNexo } from "@/app/components/landing/marca";

/**
 * Cabecera editorial de la portada. Reutiliza las rutas reales del
 * proyecto: el panel de gestión, el marketplace público, el acceso y el
 * registro. Los enlaces "Funcionalidades" y "Nosotros" apuntan a
 * secciones reales de la propia página.
 */
const ENLACES = [
    { etiqueta: "ERP", href: "/dashboard" },
    { etiqueta: "Marketplace", href: "/marketplace" },
    { etiqueta: "Funcionalidades", href: "#funcionalidades" },
    { etiqueta: "Nosotros", href: "#nosotros" },
];

export function Navegacion() {
    const [menuAbierto, setMenuAbierto] = useState(false);

    function cerrar() {
        setMenuAbierto(false);
    }

    return (
        <header className="relative z-30 shrink-0 border-b border-[#25382A]/10">
            <div className="flex h-16 items-center justify-between gap-6 lg:h-[68px]">
                <Link
                    href="/"
                    className="group flex shrink-0 items-center gap-2.5"
                    aria-label="Nexo, inicio"
                >
                    <MarcaNexo className="size-8 text-[#25382A] transition-transform duration-500 group-hover:rotate-[-4deg]" />
                    <span className="flex items-baseline gap-1.5">
                        <span className="text-[15px] font-bold tracking-[-0.035em] text-[#25382A]">
                            NEXO
                        </span>
                        <span className="text-[15px] font-medium tracking-[-0.02em] text-[#697A52]">
                            ERP
                        </span>
                    </span>
                    <span className="hidden h-4 w-px bg-[#25382A]/15 lg:block" />
                    <span className="hidden text-[11px] tracking-[0.02em] text-[#7E8177] lg:block">
                        Gestión y comercio
                    </span>
                </Link>

                <nav
                    className="hidden items-center gap-7 lg:flex"
                    aria-label="Navegación principal"
                >
                    {ENLACES.map((enlace) => (
                        <Link
                            key={enlace.etiqueta}
                            href={enlace.href}
                            className="landing-enlace text-[12.5px] font-medium text-[#55584F] transition-colors duration-300 hover:text-[#25382A]"
                        >
                            {enlace.etiqueta}
                        </Link>
                    ))}
                </nav>

                <div className="hidden shrink-0 items-center gap-5 lg:flex">
                    <span className="h-4 w-px bg-[#25382A]/15" />
                    <Link
                        href="/auth/login"
                        className="landing-enlace text-[12.5px] font-medium text-[#55584F] transition-colors duration-300 hover:text-[#25382A]"
                    >
                        Iniciar sesión
                    </Link>
                    <Link
                        href="/auth/register"
                        className="rounded-[8px] bg-[#25382A] px-4 py-2.5 text-[12.5px] font-semibold text-[#F9F7F0] transition-all duration-300 hover:bg-[#314a37] hover:shadow-[0_10px_24px_-12px_rgba(37,56,42,.65)]"
                    >
                        Crear cuenta
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => setMenuAbierto((abierto) => !abierto)}
                    className="grid size-10 place-items-center rounded-[8px] border border-[#25382A]/15 text-[#25382A] transition-colors hover:bg-[#25382A]/5 lg:hidden"
                    aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
                    aria-expanded={menuAbierto}
                    aria-controls="menu-movil"
                >
                    {menuAbierto ? (
                        <X className="size-4.5" aria-hidden="true" />
                    ) : (
                        <Menu className="size-4.5" aria-hidden="true" />
                    )}
                </button>
            </div>

            {menuAbierto && (
                <div
                    id="menu-movil"
                    className="landing-entrada absolute inset-x-0 top-full z-30 border-b border-[#25382A]/10 bg-[#F9F7F0] px-5 pb-6 pt-2 shadow-[0_24px_48px_-28px_rgba(37,56,42,.5)] lg:hidden"
                >
                    <nav
                        className="flex flex-col"
                        aria-label="Navegación móvil"
                    >
                        {ENLACES.map((enlace) => (
                            <Link
                                key={enlace.etiqueta}
                                href={enlace.href}
                                onClick={cerrar}
                                className="border-b border-[#25382A]/8 py-3.5 font-serif text-[1.35rem] text-[#25382A]"
                            >
                                {enlace.etiqueta}
                            </Link>
                        ))}
                        <Link
                            href="/marketplace/productos"
                            onClick={cerrar}
                            className="border-b border-[#25382A]/8 py-3.5 font-serif text-[1.35rem] text-[#25382A]"
                        >
                            Productos
                        </Link>
                        <Link
                            href="/seguimiento-pedido"
                            onClick={cerrar}
                            className="border-b border-[#25382A]/8 py-3.5 font-serif text-[1.35rem] text-[#25382A]"
                        >
                            Seguimiento de pedido
                        </Link>
                        <Link
                            href="/cuenta"
                            onClick={cerrar}
                            className="py-3.5 font-serif text-[1.35rem] text-[#25382A]"
                        >
                            Mi cuenta
                        </Link>
                    </nav>
                    <div className="mt-5 flex flex-col gap-2.5">
                        <Link
                            href="/auth/register"
                            onClick={cerrar}
                            className="rounded-[8px] bg-[#25382A] px-4 py-3 text-center text-[13px] font-semibold text-[#F9F7F0]"
                        >
                            Crear cuenta
                        </Link>
                        <Link
                            href="/auth/login"
                            onClick={cerrar}
                            className="rounded-[8px] border border-[#25382A]/20 px-4 py-3 text-center text-[13px] font-semibold text-[#25382A]"
                        >
                            Iniciar sesión
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}
