"use client";

import {
    AlertCircle,
    ArrowLeft,
    Eye,
    EyeOff,
    LoaderCircle,
    LockKeyhole,
    Mail,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import {
    botonPrimario,
    campo,
    contenedor,
    eyebrow,
    tarjeta,
} from "@/app/components/marketplace/estilos";

function FormularioIngreso() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [correo, setCorreo] = useState("");
    const [contrasena, setContrasena] = useState("");
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);
    const [mostrarContrasena, setMostrarContrasena] = useState(false);

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setCargando(true);
        setError("");
        try {
            await apiRequest("/cuenta-clientes/iniciar-sesion", "POST", {
                correo: correo.trim().toLowerCase(),
                contrasena,
            });
            // Vincula compras de invitado hechas con el mismo correo.
            void apiRequest("/cuenta-clientes/vincular-historial", "POST").catch(
                () => undefined,
            );
            const destino = searchParams.get("volver");
            router.push(
                destino?.startsWith("/") && !destino.startsWith("//")
                    ? destino
                    : "/cuenta/pedidos",
            );
        } catch (fallo) {
            setError(
                fallo instanceof Error
                    ? fallo.message
                    : "No se pudo iniciar sesión.",
            );
            setCargando(false);
        }
    }

    return (
        <main className={`${contenedor} py-8 sm:py-10`}>
            <div className="mx-auto w-full max-w-md">
                <Link
                    href="/marketplace"
                    className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-mp-text-soft transition-colors hover:text-mp-primary"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Volver al marketplace
                </Link>

                <p className={eyebrow}>Compradores</p>
                <h1 className="mt-3 font-serif text-[1.9rem] leading-tight text-mp-text">
                    Iniciá sesión
                </h1>
                <p className="mt-2 text-sm leading-6 text-mp-text-soft">
                    Accedé a tu cuenta para ver tus pedidos y comprar más
                    rápido.
                </p>

                <form
                    onSubmit={(evento) => void enviar(evento)}
                    className={`${tarjeta} mt-6 p-6 sm:p-7`}
                >
                    {error && (
                        <p
                            role="alert"
                            className="mb-4 flex items-start gap-2 rounded-[10px] border border-mp-error/20 bg-mp-error/5 p-3 text-[13px] text-mp-error"
                        >
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            {error}
                        </p>
                    )}

                    <label className="grid gap-1.5 text-[13px] font-medium text-mp-text">
                        Correo electrónico
                        <span className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mp-text-faint" />
                            <input
                                required
                                type="email"
                                maxLength={254}
                                value={correo}
                                onChange={(evento) => setCorreo(evento.target.value)}
                                placeholder="tu@correo.com"
                                autoComplete="email"
                                className={`${campo} pl-9`}
                            />
                        </span>
                    </label>

                    <label className="mt-4 grid gap-1.5 text-[13px] font-medium text-mp-text">
                        Contraseña
                        <span className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mp-text-faint" />
                            <input
                                required
                                type={mostrarContrasena ? "text" : "password"}
                                maxLength={72}
                                value={contrasena}
                                onChange={(evento) =>
                                    setContrasena(evento.target.value)
                                }
                                placeholder="••••••••"
                                autoComplete="current-password"
                                className={`${campo} pl-9 pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setMostrarContrasena(!mostrarContrasena)
                                }
                                aria-label={
                                    mostrarContrasena
                                        ? "Ocultar contraseña"
                                        : "Mostrar contraseña"
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-mp-text-faint transition-colors hover:text-mp-text"
                            >
                                {mostrarContrasena ? (
                                    <EyeOff className="size-4" />
                                ) : (
                                    <Eye className="size-4" />
                                )}
                            </button>
                        </span>
                    </label>

                    <div className="mt-3 text-right">
                        <Link
                            href="/cuenta/recuperar"
                            className="text-[12px] font-medium text-mp-primary hover:text-mp-olive-ink"
                        >
                            ¿Olvidaste tu contraseña?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={cargando}
                        className={`${botonPrimario} mt-6 h-11 w-full`}
                    >
                        {cargando && (
                            <LoaderCircle className="size-4 animate-spin" />
                        )}
                        {cargando ? "Ingresando..." : "Iniciar sesión"}
                    </button>

                    <p className="mt-5 text-center text-[12px] text-mp-text-soft">
                        ¿No tenés cuenta?{" "}
                        <Link
                            href="/cuenta/registro"
                            className="font-semibold text-mp-primary hover:text-mp-olive-ink"
                        >
                            Registrate gratis
                        </Link>
                    </p>
                </form>
            </div>
        </main>
    );
}

export default function IngresarCuentaPage() {
    return (
        <Suspense>
            <FormularioIngreso />
        </Suspense>
    );
}
