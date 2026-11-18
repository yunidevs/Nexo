"use client";

import { Building2, ExternalLink, LoaderCircle, Users } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import { MarketplaceSettings } from "./marketplace-settings";
import { AparienciaSettings } from "./apariencia-settings";

interface Empresa {
    id: string;
    nombre: string;
    sitioWeb: string | null;
    tasaImpuesto: number | string;
    cantidadUsuarios: number;
}

function esEmpresa(valor: unknown): valor is Empresa {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "nombre" in valor &&
        typeof valor.nombre === "string" &&
        "sitioWeb" in valor &&
        (typeof valor.sitioWeb === "string" || valor.sitioWeb === null) &&
        "tasaImpuesto" in valor &&
        (typeof valor.tasaImpuesto === "number" ||
            typeof valor.tasaImpuesto === "string") &&
        "cantidadUsuarios" in valor &&
        typeof valor.cantidadUsuarios === "number"
    );
}

function contieneEmpresa(
    valor: unknown,
): valor is { empresa: Empresa } {
    return (
        typeof valor === "object" &&
        valor !== null &&
        "empresa" in valor &&
        esEmpresa(valor.empresa)
    );
}

export default function PaginaEmpresa() {
    const [empresa, setEmpresa] = useState<Empresa | null>(null);
    const [nombre, setNombre] = useState("");
    const [sitioWeb, setSitioWeb] = useState("");
    const [tasaImpuesto, setTasaImpuesto] = useState("0");
    const [esAdministrador, setEsAdministrador] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");

    useEffect(() => {
        let cancelada = false;

        async function cargar() {
            try {
                const [resultadoEmpresa, resultadoPerfil] = await Promise.all([
                    apiRequest("/empresa"),
                    apiRequest("/autenticacion/perfil"),
                ]);
                const datosEmpresa = contieneEmpresa(resultadoEmpresa)
                    ? resultadoEmpresa.empresa
                    : null;
                const usuario =
                    typeof resultadoPerfil === "object" &&
                    resultadoPerfil !== null &&
                    "usuario" in resultadoPerfil
                        ? resultadoPerfil.usuario
                        : null;

                if (!datosEmpresa) {
                    throw new Error("La API devolvió datos de empresa no válidos.");
                }

                if (
                    typeof usuario !== "object" ||
                    usuario === null ||
                    !("rol" in usuario) ||
                    typeof usuario.rol !== "string"
                ) {
                    throw new Error("La API devolvió un perfil no válido.");
                }

                if (!cancelada) {
                    setEmpresa(datosEmpresa);
                    setNombre(datosEmpresa.nombre);
                    setSitioWeb(datosEmpresa.sitioWeb ?? "");
                    setTasaImpuesto(String(datosEmpresa.tasaImpuesto));
                    setEsAdministrador(usuario.rol === "ADMINISTRADOR");
                }
            } catch (error) {
                if (!cancelada) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "No se pudo cargar la configuración de la empresa.",
                    );
                }
            } finally {
                if (!cancelada) setCargando(false);
            }
        }

        void cargar();

        return () => {
            cancelada = true;
        };
    }, []);

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");
        setMensaje("");

        try {
            const resultado = await apiRequest("/empresa", "PATCH", {
                nombre,
                sitioWeb,
                tasaImpuesto: Number(tasaImpuesto),
            });

            if (!contieneEmpresa(resultado)) {
                throw new Error("La API devolvió datos de empresa no válidos.");
            }

            setEmpresa(resultado.empresa);
            setNombre(resultado.empresa.nombre);
            setSitioWeb(resultado.empresa.sitioWeb ?? "");
            setTasaImpuesto(String(resultado.empresa.tasaImpuesto));
            setMensaje("La información de la empresa se guardó correctamente.");
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar la configuración.",
            );
        } finally {
            setGuardando(false);
        }
    }

    return (
            <div className="mx-auto w-full max-w-5xl">
                <section className="py-10">
                    <p className="text-sm font-medium text-indigo-300">
                        Perfil de organización
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                        Configuración de la empresa
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                        Mantén actualizados el nombre y la información comercial
                        de tu organización.
                    </p>

                    {cargando ? (
                        <p className="mt-10 inline-flex items-center gap-2 text-sm text-slate-400">
                            <LoaderCircle className="size-4 animate-spin" />
                            Cargando la empresa...
                        </p>
                    ) : error && !empresa ? (
                        <p
                            role="alert"
                            className="mt-8 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200"
                        >
                            {error}
                        </p>
                    ) : empresa ? (
                        <>
                        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                            <form
                                onSubmit={(evento) => void guardar(evento)}
                                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
                                        <Building2 className="size-5" />
                                    </span>
                                    <div>
                                        <h2 className="font-semibold text-foreground">
                                            Información comercial
                                        </h2>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Visible para los miembros de tu empresa.
                                        </p>
                                    </div>
                                </div>

                                <label className="mt-8 block text-sm font-medium text-slate-300">
                                    Nombre de la empresa
                                    <input
                                        required
                                        minLength={2}
                                        maxLength={120}
                                        value={nombre}
                                        onChange={(evento) =>
                                            setNombre(evento.target.value)
                                        }
                                        disabled={!esAdministrador || guardando}
                                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-background px-3 text-sm text-foreground outline-none transition focus:border-indigo-400/70 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                </label>

                                <label className="mt-5 block text-sm font-medium text-slate-300">
                                    Sitio web
                                    <input
                                        type="url"
                                        maxLength={2048}
                                        value={sitioWeb}
                                        onChange={(evento) =>
                                            setSitioWeb(evento.target.value)
                                        }
                                        placeholder="https://tuempresa.com"
                                        disabled={!esAdministrador || guardando}
                                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-slate-600 focus:border-indigo-400/70 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                </label>

                                <label className="mt-5 block text-sm font-medium text-slate-300">
                                    Impuesto sobre ventas (%)
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={tasaImpuesto}
                                        onChange={(evento) =>
                                            setTasaImpuesto(evento.target.value)
                                        }
                                        disabled={!esAdministrador || guardando}
                                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-background px-3 text-sm text-foreground outline-none transition focus:border-indigo-400/70 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                    <span className="mt-1 block text-xs font-normal text-slate-500">
                                        Se aplicará a las nuevas ventas. Las
                                        ventas existentes conservan la tasa
                                        usada al registrarse.
                                    </span>
                                </label>

                                {empresa.sitioWeb && (
                                    <a
                                        href={empresa.sitioWeb}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-3 inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200"
                                    >
                                        Visitar sitio web
                                        <ExternalLink className="size-3.5" />
                                    </a>
                                )}

                                {error && (
                                    <p
                                        role="alert"
                                        className="mt-5 text-sm text-rose-300"
                                    >
                                        {error}
                                    </p>
                                )}
                                {mensaje && (
                                    <p
                                        role="status"
                                        className="mt-5 text-sm text-emerald-300"
                                    >
                                        {mensaje}
                                    </p>
                                )}

                                {esAdministrador ? (
                                    <button
                                        type="submit"
                                        disabled={guardando}
                                        className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {guardando && (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        )}
                                        Guardar cambios
                                    </button>
                                ) : (
                                    <p className="mt-7 text-xs text-slate-500">
                                        Solo un administrador puede modificar
                                        esta información.
                                    </p>
                                )}
                            </form>

                            <aside className="h-fit rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] text-slate-300">
                                    <Users className="size-5" />
                                </div>
                                <h2 className="mt-4 font-semibold text-foreground">
                                    Miembros de la empresa
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                    {empresa.cantidadUsuarios}{" "}
                                    {empresa.cantidadUsuarios === 1
                                        ? "usuario pertenece"
                                        : "usuarios pertenecen"}{" "}
                                    a esta organización. Los usuarios y sus
                                    permisos se administran dentro de la empresa.
                                </p>
                                {esAdministrador && (
                                    <Link
                                        href="/usuarios"
                                        className="mt-5 inline-flex text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
                                    >
                                        Gestionar equipo
                                        <span className="ml-1" aria-hidden="true">
                                            →
                                        </span>
                                    </Link>
                                )}
                            </aside>
                        </div>
                        <MarketplaceSettings esAdministrador={esAdministrador} />
                        <AparienciaSettings />
                        </>
                    ) : null}
                </section>
            </div>
    );
}
