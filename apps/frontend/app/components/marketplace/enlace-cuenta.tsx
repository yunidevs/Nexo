"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleUserRound } from "lucide-react";
import { obtenerCuenta, type CuentaCliente } from "@/app/lib/cuenta";

/**
 * Acesso al área privada del comprador. Muestra "Mi cuenta" cuando hay
 * sesión de cliente y "Ingresar" cuando no la hay. La sesión empresarial
 * (ERP) usa otra cookie y no interfiere.
 */
export function EnlaceCuenta() {
    const [cuenta, setCuenta] = useState<CuentaCliente | null>(null);
    const [revisada, setRevisada] = useState(false);

    useEffect(() => {
        let cancelada = false;
        void obtenerCuenta().then((actual) => {
            if (!cancelada) {
                setCuenta(actual);
                setRevisada(true);
            }
        });
        return () => {
            cancelada = true;
        };
    }, []);

    if (!revisada) {
        return <span className="hidden size-9 lg:block" aria-hidden="true" />;
    }

    return cuenta ? (
        <Link
            href="/cuenta/pedidos"
            title={`Mi cuenta (${cuenta.nombre})`}
            aria-label="Mi cuenta"
            className="hidden items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-mp-text-soft transition-colors hover:text-mp-primary lg:inline-flex"
        >
            <CircleUserRound className="size-4" aria-hidden="true" />
            Mi cuenta
        </Link>
    ) : (
        <Link
            href="/cuenta/ingresar"
            title="Ingresar a tu cuenta de comprador"
            aria-label="Ingresar a tu cuenta de comprador"
            className="grid size-9 place-items-center rounded-full text-mp-text-soft transition-colors duration-300 hover:bg-mp-primary/10 hover:text-mp-primary"
        >
            <CircleUserRound className="size-5" aria-hidden="true" />
        </Link>
    );
}
