"use client";

import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Eye,
    EyeOff,
    LoaderCircle,
    LockKeyhole,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import {
    botonPrimario,
    contenedor,
    eyebrow,
    tarjeta,
} from "@/app/components/marketplace/estilos";

function FormularioRestablecer() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";
    const [contrasena, setContrasena] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);
    const [mostrar, setMostrar] = useState(false);

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setError("");
        if (contrasena !== confirmacion) {
            setError("Las contraseñas no coinciden.");
            return;
        }
        setCargando(true);
        try {
            await apiRequest("/cuenta-clientes/restablecer", "POST", {
                token,
                contrasena,
            });
            router.push("/cuenta/ingresar");
        } catch (fallo) {
            setError(
                fallo instanceof Error
                    ? fallo.message
                    : "No se pudo restablecer la contraseña.",
            );
            setCargando(false);
        }
    }

    if (!token) {
        return (
            <main className={`${contenedor} py-8 sm:py-10`}>
                <div className="mx-auto w-full max-w-md text-center">
                    <AlertCircle className="mx-auto size-10 text-mp-error" />
                    <h1 className="mt-4 font-serif text-2xl text-mp-text">
                        Enlace no válido
                    </h1>
                    <p className="mt-2 text-sm text-mp-text-soft">
                        El enlace de recuperación está incompleto. Solicitá uno
                        nuevo.
                    </p>
                    <Link
                        href="/cuenta/recuperar"
                        className={`${botonPrimario} mt-6 h-10 px-5 text-[13px]`}
                    >
                        Recuperar contraseña
                    </Link>
                </div>
            </main>
        );
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
                    Nueva contraseña
                </h1>

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

                    {(["contrasena", "confirmacion"] as const).map((campo) => (
                        <label
                            key={campo}
                            className="mt-4 grid gap-1.5 text-[13px] font-medium text-mp-text first:mt-0"
                        >
                            {campo === "contrasena"
                                ? "Nueva contraseña"
                                : "Confirmar contraseña"}
                            <span className="relative">
                                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mp-text-faint" />
                                <input
                                    required
                                    type={mostrar ? "text" : "password"}
                                    minLength={8}
                                    maxLength={72}
                                    value={
                                        campo === "contrasena"
                                            ? contrasena
                                            : confirmacion
                                    }
                                    onChange={(evento) =>
                                        campo === "contrasena"
                                            ? setContrasena(evento.target.value)
                                            : setConfirmacion(
                                                  evento.target.value,
                                              )
                                    }
                                    autoComplete={
                                        campo === "contrasena"
                                            ? "new-password"
                                            : "new-password"
                                    }
                                    className={`${campo} pl-9 pr-10`}
                                />
                                {campo === "contrasena" && (
                                    <button
                                        type="button"
                                        onClick={() => setMostrar(!mostrar)}
                                        aria-label={
                                            mostrar
                                                ? "Ocultar contraseña"
                                                : "Mostrar contraseña"
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-mp-text-faint transition-colors hover:text-mp-text"
                                    >
                                        {mostrar ? (
                                            <EyeOff className="size-4" />
                                        ) : (
                                            <Eye className="size-4" />
                                        )}
                                    </button>
                                )}
                            </span>
                        </label>
                    ))}

                    <button
                        type="submit"
                        disabled={cargando}
                        className={`${botonPrimario} mt-6 h-11 w-full`}
                    >
                        {cargando ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="size-4" />
                        )}
                        {cargando
                            ? "Actualizando..."
                            : "Guardar nueva contraseña"}
                    </button>
                </form>
            </div>
        </main>
    );
}

export default function RestablecerCuentaPage() {
    return (
        <Suspense>
            <FormularioRestablecer />
        </Suspense>
    );
}
