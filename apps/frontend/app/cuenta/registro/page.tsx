"use client";

import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Eye,
    EyeOff,
    LoaderCircle,
    LockKeyhole,
    Mail,
    User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import {
    botonPrimario,
    campo,
    contenedor,
    eyebrow,
    tarjeta,
} from "@/app/components/marketplace/estilos";

interface Formulario {
    nombre: string;
    correo: string;
    contrasena: string;
}

export default function RegistroCuentaPage() {
    const router = useRouter();
    const [formulario, setFormulario] = useState<Formulario>({
        nombre: "",
        correo: "",
        contrasena: "",
    });
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);
    const [mostrarContrasena, setMostrarContrasena] = useState(false);

    function actualizar(campo: keyof Formulario, valor: string) {
        setFormulario((previo) => ({ ...previo, [campo]: valor }));
        setError("");
    }

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setCargando(true);
        setError("");
        try {
            await apiRequest("/cuenta-clientes/registro", "POST", {
                nombre: formulario.nombre.trim(),
                correo: formulario.correo.trim().toLowerCase(),
                contrasena: formulario.contrasena,
            });
            // Vincula compras de invitado hechas con el mismo correo.
            void apiRequest("/cuenta-clientes/vincular-historial", "POST").catch(
                () => undefined,
            );
            router.push("/cuenta/pedidos");
        } catch (fallo) {
            setError(
                fallo instanceof Error
                    ? fallo.message
                    : "No se pudo crear la cuenta.",
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
                <h1 className="mt-3 font-serif text-[1.9rem] leading-tight text-mp-primary">
                    Creá tu cuenta
                </h1>
                <p className="mt-2 text-sm leading-6 text-mp-text-soft">
                    Seguí tus pedidos, guardá tus datos y comprá más rápido en
                    todas las tiendas del marketplace.
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
                        Nombre completo
                        <span className="relative">
                            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mp-text-faint" />
                            <input
                                required
                                minLength={2}
                                maxLength={80}
                                value={formulario.nombre}
                                onChange={(evento) =>
                                    actualizar("nombre", evento.target.value)
                                }
                                placeholder="Tu nombre"
                                autoComplete="name"
                                className={`${campo} pl-9`}
                            />
                        </span>
                    </label>

                    <label className="mt-4 grid gap-1.5 text-[13px] font-medium text-mp-text">
                        Correo electrónico
                        <span className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mp-text-faint" />
                            <input
                                required
                                type="email"
                                maxLength={254}
                                value={formulario.correo}
                                onChange={(evento) =>
                                    actualizar("correo", evento.target.value)
                                }
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
                                minLength={8}
                                maxLength={72}
                                value={formulario.contrasena}
                                onChange={(evento) =>
                                    actualizar(
                                        "contrasena",
                                        evento.target.value,
                                    )
                                }
                                placeholder="Mínimo 8 caracteres"
                                autoComplete="new-password"
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
                        <span className="text-[11px] font-normal text-mp-text-faint">
                            Usá mayúsculas, minúsculas y un símbolo.
                        </span>
                    </label>

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
                        {cargando ? "Creando cuenta..." : "Crear cuenta"}
                    </button>

                    <p className="mt-5 text-center text-[12px] text-mp-text-soft">
                        ¿Ya tenés cuenta?{" "}
                        <Link
                            href="/cuenta/ingresar"
                            className="font-semibold text-mp-primary hover:text-mp-olive-ink"
                        >
                            Iniciá sesión
                        </Link>
                    </p>
                </form>
            </div>
        </main>
    );
}
