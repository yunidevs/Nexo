import Link from "next/link";
import { MarcaNexo } from "@/app/components/landing/marca";

interface EnlacePie {
    href: string;
    etiqueta: string;
    externo?: boolean;
}

interface ColumnaPie {
    titulo: string;
    enlaces: EnlacePie[];
}

const columnas: ColumnaPie[] = [
    {
        titulo: "Comprar",
        enlaces: [
            { href: "/marketplace/productos", etiqueta: "Todos los productos" },
            { href: "/marketplace/categorias", etiqueta: "Categorías" },
            {
                href: "/marketplace/productos?orden=recientes",
                etiqueta: "Novedades",
            },
            {
                href: "/marketplace/productos?disponible=true",
                etiqueta: "Disponibles ahora",
            },
        ],
    },
    {
        titulo: "Empresas",
        enlaces: [
            { href: "/marketplace/empresas", etiqueta: "Todas las tiendas" },
            { href: "/auth/login", etiqueta: "Acceso para empresas" },
            { href: "/marketplace/gestion", etiqueta: "Gestión de tienda" },
        ],
    },
    {
        titulo: "Compras",
        enlaces: [
            { href: "/marketplace", etiqueta: "Inicio del marketplace" },
            { href: "/dashboard", etiqueta: "Panel de gestión (ERP)" },
            {
                href: "https://www.paypal.com",
                etiqueta: "Pagos con PayPal",
                externo: true,
            },
        ],
    },
];

export function PieMarketplace() {
    return (
        <footer className="mt-20 border-t border-mp-primary bg-mp-primary text-mp-on-accent">
            <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-8">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
                    <div className="max-w-sm">
                        <Link
                            href="/marketplace"
                            className="group flex items-center gap-2.5"
                            aria-label="Nexo Marketplace, inicio"
                        >
                            <MarcaNexo className="size-8 text-mp-on-accent transition-transform duration-500 group-hover:rotate-[-4deg]" />
                            <span className="flex items-baseline gap-1.5">
                                <span className="text-[15px] font-bold tracking-[-0.035em] text-mp-on-accent">
                                    NEXO
                                </span>
                                <span className="text-[13px] font-medium tracking-[-0.01em] text-mp-accent">
                                    Marketplace
                                </span>
                            </span>
                        </Link>
                        <p className="mt-5 font-serif text-[1.45rem] leading-[1.25] text-mp-accent">
                            Un mercado. Infinitas oportunidades.
                        </p>
                        <p className="mt-3 text-[13px] leading-6 text-mp-on-accent/70">
                            Productos de diferentes empresas en un solo lugar.
                            Explorá el catálogo, comprá de forma segura con
                            PayPal y seguí tu pedido hasta la entrega.
                        </p>
                    </div>

                    {columnas.map((columna) => (
                        <nav
                            key={columna.titulo}
                            aria-label={columna.titulo}
                            className="space-y-3"
                        >
                            <h2 className="text-[10px] font-semibold tracking-[0.2em] text-mp-accent uppercase">
                                {columna.titulo}
                            </h2>
                            <ul className="space-y-2">
                                {columna.enlaces.map((enlace) => (
                                    <li key={enlace.etiqueta}>
                                        <Link
                                            href={enlace.href}
                                            {...(enlace.externo
                                                ? {
                                                      target: "_blank",
                                                      rel: "noreferrer",
                                                  }
                                                : {})}
                                            className="mp-enlace text-[13px] text-mp-on-accent/75 transition-colors duration-300 hover:text-mp-accent"
                                        >
                                            {enlace.etiqueta}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ))}
                </div>

                <div className="mt-12 flex flex-col gap-2 border-t border-mp-on-accent/15 pt-6 text-[11.5px] text-mp-on-accent/55 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} Nexo Marketplace</p>
                    <p>
                        El estado de cada pedido se consulta desde el enlace de
                        confirmación de la compra.
                    </p>
                </div>
            </div>
        </footer>
    );
}
