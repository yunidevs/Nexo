"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PackageSearch } from "lucide-react";

export default function SeguimientoPedidoPage() {
    const router = useRouter();
    const [pedido, setPedido] = useState("");
    const [token, setToken] = useState("");
    const [error, setError] = useState("");

    function consultar(evento: React.FormEvent) {
        evento.preventDefault();
        const id = pedido.trim();
        const clave = token.trim();
        if (!id || !clave) {
            setError("Ingresá el número de pedido y el token de seguimiento.");
            return;
        }
        router.push(
            `/marketplace/seguimiento/${encodeURIComponent(id)}?t=${encodeURIComponent(clave)}`,
        );
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-mp-bg px-5 text-mp-text">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-mp-border bg-mp-elevated p-8 shadow-sm">
                    <PackageSearch className="size-10 text-mp-primary" aria-hidden="true" />
                    <h1 className="mt-4 font-serif text-2xl">Seguimiento de pedido</h1>
                    <p className="mt-2 text-sm text-mp-text-soft">
                        Ingresá el número de pedido y el token privado que recibiste al
                        comprar para ver el estado de tu entrega.
                    </p>

                    <form onSubmit={consultar} className="mt-6 space-y-4">
                        <div>
                            <label
                                htmlFor="pedido"
                                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-mp-text-soft"
                            >
                                Número de pedido
                            </label>
                            <input
                                id="pedido"
                                type="text"
                                value={pedido}
                                onChange={(e) => setPedido(e.target.value)}
                                placeholder="Ej.: f3355dbd-24e1-456b-b8db-69cdb9e69739"
                                autoComplete="off"
                                className="w-full rounded-xl border border-mp-border bg-mp-bg px-4 py-3 text-sm outline-none transition-colors focus:border-mp-primary"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="token"
                                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-mp-text-soft"
                            >
                                Token de seguimiento
                            </label>
                            <input
                                id="token"
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Token privado"
                                autoComplete="off"
                                className="w-full rounded-xl border border-mp-border bg-mp-bg px-4 py-3 text-sm outline-none transition-colors focus:border-mp-primary"
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-mp-error" role="alert">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="w-full rounded-xl bg-mp-primary px-4 py-3 text-sm font-semibold text-mp-on-accent transition-opacity hover:opacity-90"
                        >
                            Consultar pedido
                        </button>
                    </form>
                </div>

                <p className="mt-6 text-center text-sm text-mp-text-soft">
                    ¿Tenés cuenta de comprador?{" "}
                    <Link href="/cuenta/pedidos" className="font-medium text-mp-primary hover:underline">
                        Ingresá a Mi cuenta
                    </Link>
                </p>
            </div>
        </main>
    );
}
