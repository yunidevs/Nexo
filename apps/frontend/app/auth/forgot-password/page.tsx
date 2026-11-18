"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/app/lib/api";

export default function RecuperarContrasenaPage() {
    const [correo, setCorreo] = useState("");
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);
    const [solicitudEnviada, setSolicitudEnviada] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        const correoNormalizado = correo.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)) {
            setError("Introduce un correo electrónico válido.");
            return;
        }

        setCargando(true);
        try {
            await apiRequest("/autenticacion/solicitar-recuperacion", "POST", {
                correo: correoNormalizado,
            });
            setSolicitudEnviada(true);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "No se pudo procesar la solicitud.",
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
                        <Mail className="size-5" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-[-0.035em] text-foreground">
                        Recupera tu contraseña
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500">
                        Te enviaremos un enlace para crear una nueva contraseña.
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

                    {solicitudEnviada ? (
                        <div
                            role="status"
                            className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4"
                        >
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                            <p className="text-xs leading-5 text-emerald-300">
                                Si existe una cuenta asociada a ese correo,
                                recibirás instrucciones para recuperar tu
                                contraseña.
                            </p>
                        </div>
                    ) : (
                        <>
                            <label
                                htmlFor="correo-recuperacion"
                                className="mb-2 block text-xs font-medium text-zinc-300"
                            >
                                Correo electrónico
                            </label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                                <input
                                    id="correo-recuperacion"
                                    type="email"
                                    autoComplete="email"
                                    maxLength={254}
                                    required
                                    value={correo}
                                    onChange={(event) => {
                                        setCorreo(event.target.value);
                                        setError("");
                                    }}
                                    placeholder="tu@empresa.com"
                                    className={`h-11 w-full rounded-xl border bg-white/2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-zinc-700 ${
                                        error
                                            ? "border-red-500/70 focus:border-red-400"
                                            : "border-white/8 focus:border-indigo-400/60 focus:bg-white/4"
                                    }`}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={cargando}
                                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {cargando ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Enviando instrucciones...
                                    </>
                                ) : (
                                    "Enviar enlace de recuperación"
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
