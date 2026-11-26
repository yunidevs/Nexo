"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    CircleUserRound,
    Home,
    PackageSearch,
    Store,
} from "lucide-react";

/**
 * Barra de navegación inferior fija, exclusiva de móvil (`lg:hidden`).
 * Da acceso directo al inicio, al catálogo, al seguimiento de pedidos y a
 * la cuenta de comprador sin depender del menú hamburguesa.
 */
const ENLACES = [
    { href: "/", etiqueta: "Inicio", icono: Home },
    { href: "/marketplace/productos", etiqueta: "Explorar", icono: Store },
    { href: "/seguimiento-pedido", etiqueta: "Seguimiento", icono: PackageSearch },
    { href: "/cuenta", etiqueta: "Cuenta", icono: CircleUserRound },
];

export function NavMovil() {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Navegación inferior"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-[#25382A]/12 bg-[#F9F7F0]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
            <ul className="mx-auto grid max-w-md grid-cols-4">
                {ENLACES.map(({ href, etiqueta, icono: Icono }) => {
                    const activo =
                        href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(href);
                    return (
                        <li key={href}>
                            <Link
                                href={href}
                                aria-current={activo ? "page" : undefined}
                                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                                    activo
                                        ? "text-[#25382A]"
                                        : "text-[#7E8177] hover:text-[#25382A]"
                                }`}
                            >
                                <Icono
                                    className="size-5"
                                    aria-hidden="true"
                                    strokeWidth={activo ? 2.4 : 1.8}
                                />
                                {etiqueta}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
