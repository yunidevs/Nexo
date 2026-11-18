"use client";

import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
    LockKeyhole,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { apiRequest } from "@/app/lib/api";

function suscribirseALaUbicacion(callback: () => void) {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
}

function obtenerTokenDeLaUbicacion() {
    return new URLSearchParams(window.location.search).get("token");
}

export default function RestablecerContrasenaPage() {
    const token = useSyncExternalStore(
        suscribirseALaUbicacion,
        obtenerTokenDeLaUbicacion,
        () => undefined,
    );
    const [contrasena, setContrasena] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);
    const [completado, setCompletado] = useState(false);
    const [mostrarContrasena, setMostrarContrasena] = useState(false);

    function validarContrasena(): string | undefined {
        if (contrasena.length < 8) {
            return "La contraseña debe tener al menos 8 caracteres.";
        }
        if (contrasena.length > 72) {
            return "La contraseña no puede superar los 72 caracteres.";
        }
        if (!/[A-ZÁÉÍÓÚÜÑ]/.test(contrasena)) {
            return "Incluye al menos una letra mayúscula.";
        }
        if (!/[a-záéíóúüñ]/.test(contrasena)) {
            return "Incluye al menos una letra minúscula.";
        }
        if (!/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(contrasena)) {
            return "Incluye al menos un carácter especial.";
        }
        if (contrasena !== confirmacion) {
            return "Las contraseñas no coinciden.";
        }
        return undefined;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const errorValidacion = validarContrasena();
        if (errorValidacion) {
            setError(errorValidacion);
            return;
        }
        if (!token) {
            setError("El enlace de recuperación no es válido. Solicita uno nuevo.");
            return;
        }

        setError("");
        setCargando(true);
        try {
            await apiRequest("/autenticacion/restablecer-contrasena", "POST", {
                token,
                contrasena,
            });
            setCompletado(true);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "No se pudo actualizar la contraseña.",
            );
        } finally {
            setCargando(false);
        }
    }

    return (
        <main className="erp-root relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10 text-slate-100 selection:bg-indigo-500/30">
            <div className="pointer-events-none absolute -left-40 -top-64 size-136 rounded-full bg-indigo-600/9 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-56 -right-40 size-120 rounded-full bg-blue-500/6 blur-[110px]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)] bg-size-[64px_64px] opacity-[0.035]" />

            <div className="relative w-full max-w-110 animate-aparecer">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
                        <LockKeyhole className="size-5" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-[-0.035em] text-foreground">
                        Crea una nueva contraseña
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500">
                        Elige una contraseña segura para proteger tu cuenta.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="rounded-2xl border border-white/8 bg-surface-raised/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7"
                >
                    {error && (
                        <div
                            role="alert"
                            className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] p-3.5"
                        >
                            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                            <p className="text-xs leading-5 text-red-300">{error}</p>
                        </div>
                    )}

                    {completado ? (
                        <div className="text-center">
                            <div
                                role="status"
                                className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4 text-left"
                            >
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                                <p className="text-xs leading-5 text-emerald-300">
                                    Tu contraseña se actualizó correctamente.
                                </p>
                            </div>
                            <Link
                                href="/auth/login"
                                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-500 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-400"
                            >
                                Ir al inicio de sesión
                            </Link>
                        </div>
                    ) : !token ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-4">
                            <p className="text-xs leading-5 text-amber-200">
                                {token === undefined
                                    ? "Estamos validando el enlace..."
                                    : "Este enlace no es válido. Solicita uno nuevo para continuar."}
                            </p>
                            {token !== undefined && (
                                <Link
                                    href="/auth/forgot-password"
                                    className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                                >
                                    Solicitar otro enlace
                                </Link>
                            )}
                        </div>
                    ) : (
                        <>
                            <label
                                htmlFor="nueva-contrasena"
                                className="mb-2 block text-xs font-medium text-zinc-300"
                            >
                                Nueva contraseña
                            </label>
                            <div className="relative">
                                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                                <input
                                    id="nueva-contrasena"
                                    type={mostrarContrasena ? "text" : "password"}
                                    autoComplete="new-password"
                                    maxLength={72}
                                    required
                                    value={contrasena}
                                    onChange={(event) => {
                                        setContrasena(event.target.value);
                                        setError("");
                                    }}
                                    placeholder="8 caracteres, mayúscula, minúscula y símbolo"
                                    className="h-11 w-full rounded-xl border border-white/8 bg-white/2.5 pl-10 pr-11 text-sm text-foreground outline-none transition-all placeholder:text-zinc-700 focus:border-indigo-400/60 focus:bg-white/4"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setMostrarContrasena(!mostrarContrasena)
                                    }
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-300"
                                    aria-label={
                                        mostrarContrasena
                                            ? "Ocultar contraseña"
                                            : "Mostrar contraseña"
                                    }
                                >
                                    {mostrarContrasena ? (
                                        <EyeOff className="size-4" />
                                    ) : (
                                        <Eye className="size-4" />
                                    )}
                                </button>
                            </div>

                            <label
                                htmlFor="confirmar-contrasena"
                                className="mb-2 mt-4 block text-xs font-medium text-zinc-300"
                            >
                                Confirma la nueva contraseña
                            </label>
                            <input
                                id="confirmar-contrasena"
                                type="password"
                                autoComplete="new-password"
                                maxLength={72}
                                required
                                value={confirmacion}
                                onChange={(event) => {
                                    setConfirmacion(event.target.value);
                                    setError("");
                                }}
                                placeholder="Repite la contraseña"
                                className="h-11 w-full rounded-xl border border-white/8 bg-white/2.5 px-3 text-sm text-foreground outline-none transition-all placeholder:text-zinc-700 focus:border-indigo-400/60 focus:bg-white/4"
                            />

                            <button
                                type="submit"
                                disabled={cargando}
                                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {cargando ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Actualizando contraseña...
                                    </>
                                ) : (
                                    "Guardar nueva contraseña"
                                )}
                            </button>
                        </>
                    )}

                    <div className="mt-6 border-t border-white/6 pt-5 text-center">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center gap-2 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                        >
                            <ArrowLeft className="size-3.5" />
                            Volver al inicio de sesión
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
