"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    CircleUserRound,
    LayoutGrid,
    Menu,
    ShoppingBag,
    X,
} from "lucide-react";
import { useState } from "react";
import { Buscador } from "@/app/components/marketplace/buscador";
import { PanelCarrito } from "@/app/components/marketplace/panel-carrito";
import { useCarrito } from "@/app/components/marketplace/carrito";
import { MarcaNexo } from "@/app/components/landing/marca";
import { EnlaceCuenta } from "@/app/components/marketplace/enlace-cuenta";
import { construirConsultaCatalogo } from "@/app/lib/marketplace";

const enlaces = [
    { href: "/marketplace", etiqueta: "Inicio" },
    { href: "/marketplace/categorias", etiqueta: "Categorías" },
    { href: "/marketplace/productos", etiqueta: "Productos" },
    { href: "/marketplace/empresas", etiqueta: "Empresas" },
];

function esActivo(pathname: string, href: string): boolean {
    if (href === "/marketplace") {
        return (
            pathname === "/marketplace" ||
            pathname === "/marketplace/" ||
            // Detalle de producto y resultado de compra pertenecen al inicio.
            pathname.startsWith("/marketplace/producto/") ||
            pathname === "/marketplace/resultado"
        );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function EncabezadoMarketplace() {
    const pathname = usePathname();
    const router = useRouter();
    const { cantidadArticulos } = useCarrito();
    const [carritoAbierto, setCarritoAbierto] = useState(false);
    const [menuAbierto, setMenuAbierto] = useState(false);

    const cerrarMenu = () => setMenuAbierto(false);

    function buscar(valor: string) {
        router.push(
            `/marketplace/productos${construirConsultaCatalogo({ q: valor })}`,
        );
    }

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-mp-border/70 bg-mp-surface/85 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:gap-5 sm:px-6 lg:px-8">
                    <Link
                        href="/marketplace"
                        className="group flex shrink-0 items-center gap-2.5"
                        aria-label="Nexo Marketplace, inicio"
                    >
                        <MarcaNexo className="size-8 text-mp-primary transition-transform duration-500 group-hover:rotate-[-4deg]" />
                        <span className="flex items-baseline gap-1.5">
                            <span className="text-[15px] font-bold tracking-[-0.035em] text-mp-primary">
                                NEXO
                            </span>
                            <span className="text-[13px] font-medium tracking-[-0.01em] text-mp-olive">
                                Marketplace
                            </span>
                        </span>
                    </Link>

                    <nav
                        aria-label="Navegación principal"
                        className="ml-3 hidden items-center gap-6 lg:flex"
                    >
                        {enlaces.map((enlace) => {
                            const activo = esActivo(pathname, enlace.href);
                            return (
                                <Link
                                    key={enlace.href}
                                    href={enlace.href}
                                    aria-current={activo ? "page" : undefined}
                                    className={`mp-enlace text-[12.5px] font-medium transition-colors duration-300 ${
                                        activo
                                            ? "text-mp-primary"
                                            : "text-mp-text-soft hover:text-mp-primary"
                                    }`}
                                >
                                    {enlace.etiqueta}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="ml-auto hidden w-full max-w-[19rem] xl:block">
                        <Buscador compacto onBuscar={buscar} />
                    </div>

                    <div className="ml-auto flex items-center gap-1 xl:ml-2">
                        <Link
                            href="/dashboard"
                            title="Abrir el panel de gestión (ERP)"
                            className="mp-enlace hidden items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-mp-text-soft transition-colors duration-300 hover:text-mp-primary lg:inline-flex"
                        >
                            <LayoutGrid
                                className="size-4"
                                aria-hidden="true"
                            />
                            ERP
                        </Link>

                        <Link
                            href="/auth/login"
                            title="Acceso para empresas"
                            aria-label="Acceso para empresas"
                            className="grid size-9 place-items-center rounded-full text-mp-text-soft transition-colors duration-300 hover:bg-mp-primary/10 hover:text-mp-primary"
                        >
                            <CircleUserRound
                                className="size-5"
                                aria-hidden="true"
                            />
                        </Link>

                        <EnlaceCuenta />

                        <button
                            type="button"
                            onClick={() => setCarritoAbierto(true)}
                            aria-label={`Abrir carrito, ${cantidadArticulos} artículos`}
                            className="relative grid size-9 place-items-center rounded-full text-mp-text-soft transition-colors duration-300 hover:bg-mp-primary/10 hover:text-mp-primary"
                        >
                            <ShoppingBag className="size-5" aria-hidden="true" />
                            {cantidadArticulos > 0 ? (
                                <span className="mp-insignia absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-mp-accent px-1 text-[10px] font-bold leading-4 text-mp-primary ring-2 ring-mp-surface">
                                    {cantidadArticulos > 99
                                        ? "99+"
                                        : cantidadArticulos}
                                </span>
                            ) : null}
                        </button>

                        <button
                            type="button"
                            onClick={() => setMenuAbierto((abierto) => !abierto)}
                            aria-expanded={menuAbierto}
                            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
                            className="grid size-9 place-items-center rounded-full text-mp-primary transition-colors duration-300 hover:bg-mp-primary/10 lg:hidden"
                        >
                            {menuAbierto ? (
                                <X className="size-5" aria-hidden="true" />
                            ) : (
                                <Menu className="size-5" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Buscador en tablet y móvil (el escritorio lo lleva en la
                    barra principal). */}
                <div className="mx-auto max-w-[1400px] px-4 pb-2.5 sm:px-6 lg:px-8">
                    <Buscador compacto onBuscar={buscar} />
                </div>

                {menuAbierto ? (
                    <nav
                        aria-label="Navegación móvil"
                        className="border-t border-mp-border/70 bg-mp-surface px-4 py-4 lg:hidden"
                    >
                        <ul className="space-y-0.5">
                            {enlaces.map((enlace) => {
                                const activo = esActivo(pathname, enlace.href);
                                return (
                                    <li key={enlace.href}>
                                        <Link
                                            href={enlace.href}
                                            onClick={cerrarMenu}
                                            aria-current={
                                                activo ? "page" : undefined
                                            }
                                            className={`flex items-center justify-between rounded-[10px] px-3 py-2 text-[14px] transition-colors duration-300 ${
                                                activo
                                                    ? "bg-mp-chip font-semibold text-mp-primary"
                                                    : "font-medium text-mp-text-soft hover:bg-mp-primary/10 hover:text-mp-primary"
                                            }`}
                                        >
                                            {enlace.etiqueta}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="mt-4 flex flex-col gap-2 border-t border-mp-border/70 pt-4">
                            <Link
                                href="/dashboard"
                                onClick={cerrarMenu}
                                className="inline-flex items-center gap-2 rounded-[10px] border border-mp-primary/20 px-4 py-2.5 text-[13px] font-semibold text-mp-primary transition-colors duration-300 hover:bg-mp-primary/10"
                            >
                                <LayoutGrid className="size-4" aria-hidden="true" />
                                Ir al panel de gestión (ERP)
                            </Link>
                            <Link
                                href="/auth/login"
                                onClick={cerrarMenu}
                                className="inline-flex items-center rounded-[10px] px-4 py-2.5 text-[13px] font-medium text-mp-text-soft transition-colors duration-300 hover:text-mp-primary"
                            >
                                Acceso para empresas
                            </Link>
                            <Link
                                href="/cuenta/ingresar"
                                onClick={cerrarMenu}
                                className="inline-flex items-center rounded-[10px] px-4 py-2.5 text-[13px] font-medium text-mp-text-soft transition-colors duration-300 hover:text-mp-primary"
                            >
                                Ingresar o crear cuenta de comprador
                            </Link>
                        </div>
                    </nav>
                ) : null}
            </header>

            <PanelCarrito
                abierto={carritoAbierto}
                onCerrar={() => setCarritoAbierto(false)}
            />
        </>
    );
}
