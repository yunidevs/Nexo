"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";

const rutasWorkspace = new Set([
    "/dashboard",
    "/clientes",
    "/productos",
    "/inventario",
    "/categorias",
    "/proveedores",
    "/compras",
    "/ventas",
    "/reportes",
    "/empresa",
    "/usuarios",
    "/marketplace/gestion",
]);

export function AppFrame({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const esRutaWorkspace = Array.from(rutasWorkspace).some(
        (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
    );

    return esRutaWorkspace ? (
        <WorkspaceShell>{children}</WorkspaceShell>
    ) : (
        children
    );
}
