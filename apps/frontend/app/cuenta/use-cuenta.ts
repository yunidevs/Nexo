"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { obtenerCuenta, type CuentaCliente } from "@/app/lib/cuenta";

/**
 * Carga la sesión del comprador. Si no hay sesión válida redirige al login
 * conservando la ruta actual para volver después.
 */
export function useCuentaCliente() {
    const router = useRouter();
    const [cuenta, setCuenta] = useState<CuentaCliente | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let cancelada = false;
        async function cargar() {
            const actual = await obtenerCuenta();
            if (cancelada) return;
            if (!actual) {
                const destino = `${window.location.pathname}${window.location.search}`;
                router.replace(
                    `/cuenta/ingresar?volver=${encodeURIComponent(destino)}`,
                );
                return;
            }
            setCuenta(actual);
            setCargando(false);
        }
        void cargar();
        return () => {
            cancelada = true;
        };
    }, [router]);

    return { cuenta, cargando };
}
