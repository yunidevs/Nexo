import type { Metadata } from "next";
import { EncabezadoMarketplace } from "@/app/components/marketplace/encabezado";
import { PieMarketplace } from "@/app/components/marketplace/pie-marketplace";
import { ProveedorCarrito } from "@/app/components/marketplace/carrito";

export const metadata: Metadata = {
    title: "Mi cuenta",
    description: "Administrá tu cuenta de comprador y tus pedidos.",
};

export default function CuentaLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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
