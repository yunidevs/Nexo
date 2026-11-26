"use client";

import {
    AlertCircle,
    CheckCircle2,
    LoaderCircle,
    LogOut,
    Save,
    User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import {
    cerrarSesionCuenta,
    type CuentaCliente,
} from "@/app/lib/cuenta";
import {
    botonPrimario,
    botonSecundario,
    campo,
    contenedor,
    eyebrow,
    tarjeta,
    tituloSeccion,
} from "@/app/components/marketplace/estilos";
import { useCuentaCliente } from "../use-cuenta";

interface FormularioPerfil {
    nombre: string;
    telefono: string;
    direccion: string;
}

function esCuenta(valor: unknown): valor is CuentaCliente {
    return (
        typeof valor === "object" &&
        valor !== null &&
        typeof (valor as Record<string, unknown>).id === "string"
    );
}

export default function PerfilCuentaPage() {
    const router = useRouter();
    const { cuenta, cargando } = useCuentaCliente();
    const [formulario, setFormulario] = useState<FormularioPerfil | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [cerrando, setCerrando] = useState(false);

    function valoresFormulario(): FormularioPerfil {
        return (
            formulario ?? {
                nombre: cuenta?.nombre ?? "",
                telefono: cuenta?.telefono ?? "",
                direccion: cuenta?.direccion ?? "",
            }
        );
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");
        setMensaje("");
        const valores = valoresFormulario();
        try {
            const resultado: unknown = await apiRequest(
                "/cuenta-clientes/perfil",
                "PATCH",
                {
                    nombre: valores.nombre.trim(),
                    telefono: valores.telefono.trim() || null,
                    direccion: valores.direccion.trim() || null,
                },
            );
            const datos =
                typeof resultado === "object" &&
                resultado !== null &&
                "cuenta" in resultado
                    ? (resultado as { cuenta: unknown }).cuenta
                    : null;
            if (!esCuenta(datos)) {
                throw new Error("La respuesta del perfil no es válida.");
            }
            setMensaje("Tu perfil se actualizó correctamente.");
        } catch (fallo) {
            setError(
                fallo instanceof Error
                    ? fallo.message
                    : "No se pudo actualizar el perfil.",
            );
        } finally {
            setGuardando(false);
        }
    }

    async function cerrarSesion() {
        setCerrando(true);
        try {
            await cerrarSesionCuenta();
            router.push("/marketplace");
        } catch {
            setCerrando(false);
        }
    }

    if (cargando || !cuenta) {
        return (
            <main className={`${contenedor} py-12`}>
                <p className="inline-flex items-center gap-2 text-sm text-mp-text-soft">
                    <LoaderCircle className="size-4 animate-spin" />
                    Cargando tu perfil...
                </p>
            </main>
        );
    }

    const valores = valoresFormulario();

    return (
        <main className={`${contenedor} py-6 sm:py-8`}>
            <p className={eyebrow}>Mi cuenta</p>
            <h1 className={`${tituloSeccion} mt-3`}>Mi perfil</h1>
            <p className="mt-2 text-sm text-mp-text-soft">
                {cuenta.correo}
            </p>

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <form
                    onSubmit={(evento) => void guardar(evento)}
                    className={`${tarjeta} p-6 sm:p-8`}
                >
                    <h2 className="flex items-center gap-2 text-[13px] font-semibold text-mp-text">
                        <User className="size-4 text-mp-primary" />
                        Datos de contacto
                    </h2>

                    {error && (
                        <p
                            role="alert"
                            className="mt-4 flex items-start gap-2 rounded-[10px] border border-mp-error/20 bg-mp-error/5 p-3 text-[13px] text-mp-error"
                        >
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            {error}
                        </p>
                    )}
                    {mensaje && (
                        <p
                            role="status"
                            className="mt-4 flex items-start gap-2 rounded-[10px] border border-mp-primary/20 bg-mp-primary/5 p-3 text-[13px] text-mp-primary"
                        >
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                            {mensaje}
                        </p>
                    )}

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-[13px] font-medium text-mp-text sm:col-span-2">
                            Nombre
                            <input
                                required
                                minLength={2}
                                maxLength={80}
                                value={valores.nombre}
                                onChange={(evento) =>
                                    setFormulario({
                                        ...valores,
                                        nombre: evento.target.value,
                                    })
                                }
                                className={campo}
                            />
                        </label>
                        <label className="grid gap-1.5 text-[13px] font-medium text-mp-text">
                            Teléfono
                            <input
                                type="tel"
                                maxLength={40}
                                value={valores.telefono}
                                onChange={(evento) =>
                                    setFormulario({
                                        ...valores,
                                        telefono: evento.target.value,
                                    })
                                }
                                placeholder="598 95 123 456"
                                className={campo}
                            />
                        </label>
                        <label className="grid gap-1.5 text-[13px] font-medium text-mp-text">
                            Dirección de entrega habitual
                            <input
                                maxLength={600}
                                value={valores.direccion}
                                onChange={(evento) =>
                                    setFormulario({
                                        ...valores,
                                        direccion: evento.target.value,
                                    })
                                }
                                placeholder="Calle, número, apartamento"
                                className={campo}
                            />
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={guardando}
                        className={`${botonPrimario} mt-6 h-11 px-6`}
                    >
                        {guardando ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        Guardar cambios
                    </button>
                </form>

                <div className="space-y-6">
                    <section className={`${tarjeta} p-6`}>
                        <h2 className="text-[13px] font-semibold text-mp-text">
                            Tus compras
                        </h2>
                        <p className="mt-2 text-[13px] leading-6 text-mp-text-soft">
                            Revisá el estado de todos tus pedidos en cualquier
                            tienda del marketplace.
                        </p>
                        <Link
                            href="/cuenta/pedidos"
                            className={`${botonSecundario} mt-4 h-10 px-5 text-[13px]`}
                        >
                            Ver mis pedidos
                        </Link>
                    </section>

                    <section className={`${tarjeta} p-6`}>
                        <h2 className="text-[13px] font-semibold text-mp-text">
                            Sesión
                        </h2>
                        <p className="mt-2 text-[13px] leading-6 text-mp-text-soft">
                            Cerrá sesión en este dispositivo.
                        </p>
                        <button
                            type="button"
                            onClick={() => void cerrarSesion()}
                            disabled={cerrando}
                            className="mt-4 inline-flex h-10 items-center gap-2 rounded-[10px] border border-mp-error/25 px-4 text-[13px] font-semibold text-mp-error transition-colors hover:bg-mp-error/5 disabled:opacity-50"
                        >
                            {cerrando ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                                <LogOut className="size-4" />
                            )}
                            Cerrar sesión
                        </button>
                    </section>
                </div>
            </div>
        </main>
    );
}
