"use client";

import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    LoaderCircle,
    Mail,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import {
    botonPrimario,
    campo,
    contenedor,
    eyebrow,
    tarjeta,
} from "@/app/components/marketplace/estilos";

export default function RecuperarCuentaPage() {
    const [correo, setCorreo] = useState("");
    const [error, setError] = useState("");
    const [enviado, setEnviado] = useState(false);
    const [cargando, setCargando] = useState(false);

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setCargando(true);
        setError("");
        try {
            await apiRequest("/cuenta-clientes/solicitar-recuperacion", "POST", {
                correo: correo.trim().toLowerCase(),
            });
            setEnviado(true);
        } catch (fallo) {
            setError(
                fallo instanceof Error
                    ? fallo.message
                    : "No se pudo procesar la solicitud.",
            );
        } finally {
            setCargando(false);
        }
    }

    return (
        <main className={`${contenedor} py-8 sm:py-10`}>
            <div className="mx-auto w-full max-w-md">
                <Link
                    href="/cuenta/ingresar"
                    className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-mp-text-soft transition-colors hover:text-mp-primary"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Volver a iniciar sesión
                </Link>

                <p className={eyebrow}>Compradores</p>
                <h1 className="mt-3 font-serif text-[1.9rem] leading-tight text-mp-text">
                    Recuperar contraseña
                </h1>
                <p className="mt-2 text-sm leading-6 text-mp-text-soft">
                    Te enviamos un enlace para crear una nueva contraseña.
                </p>

                <div className={`${tarjeta} mt-6 p-6 sm:p-7`}>
                    {enviado ? (
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mp-primary" />
                            <div>
                                <p className="text-sm font-medium text-mp-text">
                                    Revisá tu correo
                                </p>
                                <p className="mt-1 text-[13px] leading-6 text-mp-text-soft">
                                    Si el correo está registrado, vas a recibir
                                    un enlace válido por una hora.
                                </p>
                                <Link
                                    href="/cuenta/ingresar"
                                    className={`${botonPrimario} mt-5 h-10 px-4 text-[13px]`}
                                >
                                    Volver a iniciar sesión
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={(evento) => void enviar(evento)}>
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
                                        onChange={(evento) =>
                                            setCorreo(evento.target.value)
                                        }
                                        placeholder="tu@correo.com"
                                        autoComplete="email"
                                        className={`${campo} pl-9`}
                                    />
                                </span>
                            </label>
                            <button
                                type="submit"
                                disabled={cargando}
                                className={`${botonPrimario} mt-6 h-11 w-full`}
                            >
                                {cargando && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                {cargando
                                    ? "Enviando..."
                                    : "Enviar enlace de recuperación"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
