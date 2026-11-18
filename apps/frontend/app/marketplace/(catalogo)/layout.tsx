import type { Metadata } from "next";
import { EncabezadoMarketplace } from "@/app/components/marketplace/encabezado";
import { PieMarketplace } from "@/app/components/marketplace/pie-marketplace";
import { ProveedorCarrito } from "@/app/components/marketplace/carrito";

export const metadata: Metadata = {
    title: {
        default: "Nexo Marketplace",
        absolute: "Nexo Marketplace",
        template: "%s | Nexo Marketplace",
    },
    description:
        "Descubrí productos de diferentes empresas en un solo lugar y comprá de forma segura con PayPal.",
};

export default function MarketplaceLayout({
    children,
}: LayoutProps<"/marketplace">) {
    return (
        <div className="mp-root flex min-h-screen flex-col bg-mp-bg text-mp-text">
            <ProveedorCarrito>
                <EncabezadoMarketplace />
                <div className="flex flex-1 flex-col">{children}</div>
                <PieMarketplace />
            </ProveedorCarrito>
        </div>
    );
}
