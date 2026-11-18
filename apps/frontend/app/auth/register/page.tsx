"use client";

import {
    AlertCircle,
    ArrowLeft,
    Building2,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
    LockKeyhole,
    Mail,
    UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/app/lib/api";

interface DatosRegistro {
    nombreEmpresa: string;
    nombre: string;
    apellido: string;
    correo: string;
    contraseña: string;
}

interface ErroresRegistro {
    nombreEmpresa?: string;
    nombre?: string;
    apellido?: string;
    correo?: string;
    contraseña?: string;
    general?: string;
}

export default function FormularioRegistro() {
    const router = useRouter();
    const [datos, setDatos] = useState<DatosRegistro>({
        nombreEmpresa: "",
        nombre: "",
        apellido: "",
        correo: "",
        contraseña: "",
    });

    const [errores, setErrores] = useState<ErroresRegistro>({});

    const [mostrarContraseña, setMostrarContraseña] = useState(false);

    const [cargando, setCargando] = useState(false);

    const [exito, setExito] = useState(false);

    function isValidEmail(correo: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
    }

    function validateForm(): boolean {
        const nuevosErrores: ErroresRegistro = {};

        if (!datos.nombreEmpresa.trim()) {
            nuevosErrores.nombreEmpresa = "El nombre de la empresa es obligatorio.";
        } else if (datos.nombreEmpresa.trim().length < 2) {
            nuevosErrores.nombreEmpresa =
                "El nombre de la empresa debe tener al menos 2 caracteres.";
        }

        if (!datos.nombre.trim()) {
            nuevosErrores.nombre = "El nombre es obligatorio.";
        } else if (datos.nombre.trim().length < 2) {
            nuevosErrores.nombre =
                "El nombre debe tener al menos 2 caracteres.";
        }

        if (!datos.apellido.trim()) {
            nuevosErrores.apellido = "El apellido es obligatorio.";
        } else if (datos.apellido.trim().length < 2) {
            nuevosErrores.apellido =
                "El apellido debe tener al menos 2 caracteres.";
        }

        if (!datos.correo.trim()) {
            nuevosErrores.correo = "El correo es obligatorio.";
        } else if (!isValidEmail(datos.correo)) {
            nuevosErrores.correo = "Introduce un correo electrónico válido.";
        }

        if (!datos.contraseña) {
            nuevosErrores.contraseña = "La contraseña es obligatoria.";
        } else if (datos.contraseña.length < 8) {
            nuevosErrores.contraseña =
                "La contraseña debe tener al menos 8 caracteres.";
        } else if (datos.contraseña.length > 72) {
            nuevosErrores.contraseña =
                "La contraseña no puede superar los 72 caracteres.";
        } else if (!/[A-ZÁÉÍÓÚÜÑ]/.test(datos.contraseña)) {
            nuevosErrores.contraseña =
                "Incluye al menos una letra mayúscula.";
        } else if (!/[a-záéíóúüñ]/.test(datos.contraseña)) {
            nuevosErrores.contraseña =
                "Incluye al menos una letra minúscula.";
        } else if (!/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(datos.contraseña)) {
            nuevosErrores.contraseña =
                "Incluye al menos un carácter especial.";
        }

        setErrores(nuevosErrores);

        return Object.keys(nuevosErrores).length === 0;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setExito(false);

        if (!validateForm()) {
            return;
        }

        setCargando(true);
        try {
            await apiRequest("/autenticacion/registro", "POST", {
                nombreEmpresa: datos.nombreEmpresa.trim(),
                nombre: datos.nombre.trim(),
                apellido: datos.apellido.trim(),
                correo: datos.correo.trim().toLowerCase(),
                contrasena: datos.contraseña,
            });
            setExito(true);
            router.push("/dashboard");
        } catch (error) {
            setErrores({
                general:
                    error instanceof Error
                        ? error.message
                        : "No se pudo crear la cuenta.",
            });
        } finally {
            setCargando(false);
        }
    }

    function updateField(campo: keyof DatosRegistro, valor: string) {
        setDatos((datosAnteriores) => ({
            ...datosAnteriores,
            [campo]: valor,
        }));

        if (errores[campo]) {
            setErrores((erroresAnteriores) => ({
                ...erroresAnteriores,
                [campo]: undefined,
                general: undefined,
            }));
        }
    }

    return (
        <main className="erp-root relative flex justify-center items-center min-h-screen overflow-hidden bg-background text-slate-100 selection:bg-indigo-500/30">
            <div className="pointer-events-none absolute -left-40 -top-64 size-136 rounded-full bg-indigo-600/9 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-56 -right-40 size-120 rounded-full bg-blue-500/6 blur-[110px]" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)] bg-size-[64px_64px]" />
            <Link
                href="/marketplace"
                className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-zinc-400 backdrop-blur transition-colors hover:border-white/20 hover:text-zinc-200 sm:left-6 sm:top-6"
            >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Volver al inicio
            </Link>
            <div className="w-full max-w-125 animate-aparecer">
                {/* ENCABEZADO */}

                <div className="mb-7 text-center">

                    <h1 className="text-3xl font-bold tracking-[-0.035em] text-foreground">
                        Registra tu empresa
                    </h1>

                    <p className="mt-2 text-sm text-zinc-500">
                        Comienza a gestionar tu empresa desde un solo lugar.
                    </p>
                </div>

                {/* FORMULARIO */}

                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="rounded-2xl border border-white/8 bg-surface-raised/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7"
                >
                    {errores.general && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] p-3.5">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                            <p className="text-xs leading-5 text-red-300">
                                {errores.general}
                            </p>
                        </div>
                    )}

                    {/* ÉXITO */}

                    {exito && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-3.5">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />

                            <p className="text-xs leading-5 text-emerald-300">
                                Cuenta creada correctamente. Abriendo tu
                                espacio de trabajo...
                            </p>
                        </div>
                    )}

                    {/* NOMBRE + APELLIDO */}

                    <div className="mb-4">
                        <CampoEntrada
                            etiqueta="Nombre de la empresa"
                            tipo="text"
                            valor={datos.nombreEmpresa}
                            placeholder="Mi empresa"
                            error={errores.nombreEmpresa}
                            icono={<Building2 className="h-4 w-4" />}
                            onChange={(valor) =>
                                updateField("nombreEmpresa", valor)
                            }
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <CampoEntrada
                            etiqueta="Nombre"
                            tipo="text"
                            valor={datos.nombre}
                            placeholder="Yunier"
                            error={errores.nombre}
                            icono={<UserRound className="h-4 w-4" />}
                            onChange={(valor) =>
                                updateField("nombre", valor)
                            }
                        />

                        <CampoEntrada
                            etiqueta="Apellido"
                            tipo="text"
                            valor={datos.apellido}
                            placeholder="Lima"
                            error={errores.apellido}
                            icono={<UserRound className="h-4 w-4" />}
                            onChange={(valor) =>
                                updateField("apellido", valor)
                            }
                        />
                    </div>

                    {/* CORREO */}

                    <div className="mt-4">
                        <CampoEntrada
                            etiqueta="Correo electrónico"
                            tipo="email"
                            valor={datos.correo}
                            placeholder="tu@empresa.com"
                            error={errores.correo}
                            icono={<Mail className="h-4 w-4" />}
                            onChange={(valor) =>
                                updateField("correo", valor)
                            }
                        />
                    </div>

                    {/* CONTRASEÑA */}

                    <div className="mt-4">
                        <label
                            htmlFor="contraseña-registro"
                            className="mb-2 block text-xs font-medium text-zinc-300"
                        >
                            Contraseña
                        </label>

                        <div className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

                            <input
                                id="contraseña-registro"
                                type={mostrarContraseña ? "text" : "password"}
                                maxLength={72}
                                value={datos.contraseña}
                                placeholder="8 caracteres, mayúscula, minúscula y símbolo"
                                onChange={(evento) =>
                                    updateField(
                                        "contraseña",
                                        evento.target.value,
                                    )
                                }
                                className={`h-11 w-full rounded-xl border bg-white/2.5 pl-10 pr-11 text-sm text-foreground outline-none transition-all placeholder:text-zinc-700 ${
                                    errores.contraseña
                                        ? "border-red-500/70 bg-red-500/3 focus:border-red-400"
                                        : "border-white/8 focus:border-indigo-400/60 focus:bg-white/4"
                                }`}
                            />

                            <button
                                type="button"
                                onClick={() =>
                                    setMostrarContraseña(!mostrarContraseña)
                                }
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-300"
                                aria-label={
                                    mostrarContraseña
                                        ? "Ocultar contraseña"
                                        : "Mostrar contraseña"
                                }
                            >
                                {mostrarContraseña ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>

                        {errores.contraseña && (
                            <p className="mt-1.5 text-[11px] text-red-400">
                                {errores.contraseña}
                            </p>
                        )}

                        {datos.contraseña && (
                            <ul className="mt-2 space-y-1 text-[11px]">
                                {[
                                    {
                                        valido: datos.contraseña.length >= 8,
                                        texto: "Al menos 8 caracteres",
                                    },
                                    {
                                        valido: /[A-ZÁÉÍÓÚÜÑ]/.test(datos.contraseña),
                                        texto: "Una letra mayúscula",
                                    },
                                    {
                                        valido: /[a-záéíóúüñ]/.test(datos.contraseña),
                                        texto: "Una letra minúscula",
                                    },
                                    {
                                        valido: /[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(datos.contraseña),
                                        texto: "Un carácter especial (por ejemplo, !@#)",
                                    },
                                ].map((requisito) => (
                                    <li
                                        key={requisito.texto}
                                        className={requisito.valido ? "text-emerald-400" : "text-zinc-500"}
                                    >
                                        {requisito.valido ? "✓" : "○"} {requisito.texto}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* TÉRMINOS */}

                    <p className="mt-5 text-[10px] leading-4 text-zinc-600">
                        Al crear una cuenta aceptas nuestros términos de uso y
                        política de privacidad.
                    </p>

                    {/* BOTÓN */}

                    <button
                        type="submit"
                        disabled={cargando || exito}
                        className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {cargando ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Creando cuenta...
                            </>
                        ) : exito ? (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Cuenta creada
                            </>
                        ) : (
                            "Crear cuenta"
                        )}
                    </button>

                    {/* LOGIN */}

                    <div className="mt-6 border-t border-white/6 pt-5 text-center">
                        <p className="text-xs text-zinc-500">
                            ¿Ya tienes una cuenta?{" "}
                            <Link
                                href="/auth/login"
                                className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                            >
                                Iniciar sesión
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </main>
    );
}

/* =============================================================
   CAMPO REUTILIZABLE
   ============================================================= */

interface CampoEntradaProps {
    etiqueta: string;
    tipo: string;
    valor: string;
    placeholder: string;
    error?: string;
    icono: React.ReactNode;
    onChange: (valor: string) => void;
}

function CampoEntrada({
    etiqueta,
    tipo,
    valor,
    placeholder,
    error,
    icono,
    onChange,
}: CampoEntradaProps) {
    const identificador = etiqueta.toLowerCase().replace(/\s+/g, "-");

    return (
        <div>
            <label
                htmlFor={identificador}
                className="mb-2 block text-xs font-medium text-zinc-300"
            >
                {etiqueta}
            </label>

            <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
                    {icono}
                </div>

                <input
                    id={identificador}
                    type={tipo}
                    value={valor}
                    placeholder={placeholder}
                    onChange={(evento) => onChange(evento.target.value)}
                    className={`h-11 w-full rounded-xl border bg-white/2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-zinc-700 ${
                        error
                            ? "border-red-500/70 bg-red-500/3 focus:border-red-400"
                            : "border-white/8 focus:border-indigo-400/60 focus:bg-white/4"
                    }`}
                />
            </div>

            {error && (
                <p className="mt-1.5 text-[11px] text-red-400">{error}</p>
            )}
        </div>
    );
}
