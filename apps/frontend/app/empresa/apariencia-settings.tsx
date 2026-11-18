"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
    establecerTema,
    obtenerTema,
    obtenerTemaServidor,
    suscribirseAlTema,
    type TemaApariencia,
} from "@/app/lib/tema";

const opciones: Array<{
    valor: TemaApariencia;
    etiqueta: string;
    descripcion: string;
}> = [
    {
        valor: "claro",
        etiqueta: "Claro",
        descripcion: "Fondos claros para ambientes iluminados.",
    },
    {
        valor: "oscuro",
        etiqueta: "Oscuro",
        descripcion: "Fondos oscuros, el modo original del sistema.",
    },
];

export function AparienciaSettings() {
    const tema = useSyncExternalStore(
        suscribirseAlTema,
        obtenerTema,
        obtenerTemaServidor,
    );

    function elegir(valor: TemaApariencia) {
        establecerTema(valor);
    }

    return (
        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
            <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
                    <Sun className="size-5" />
                </span>
                <div>
                    <h2 className="font-semibold text-foreground">
                        Apariencia
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                        Elige si prefieres usar Nexo ERP en modo claro u
                        oscuro. La preferencia se guarda en este navegador y
                        solo afecta al ERP: la portada y el marketplace
                        mantienen su propia identidad visual.
                    </p>
                </div>
            </div>

            <fieldset className="mt-6">
                <legend className="sr-only">Modo de la interfaz</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                    {opciones.map((opcion) => {
                        const seleccionado = tema === opcion.valor;
                        return (
                            <label
                                key={opcion.valor}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                                    seleccionado
                                        ? "border-indigo-400/70 bg-indigo-400/10"
                                        : "border-white/10 hover:bg-white/[0.04]"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="apariencia"
                                    value={opcion.valor}
                                    checked={seleccionado}
                                    onChange={() => elegir(opcion.valor)}
                                    className="mt-0.5 size-4 accent-indigo-500"
                                />
                                <span className="min-w-0">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                        {opcion.valor === "claro" ? (
                                            <Sun className="size-4 text-amber-300" />
                                        ) : (
                                            <Moon className="size-4 text-slate-400" />
                                        )}
                                        {opcion.etiqueta}
                                    </span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                                        {opcion.descripcion}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            <p className="mt-4 text-xs text-slate-500">
                Tema actual:{" "}
                <span className="font-medium text-slate-400">
                    {tema === "claro" ? "claro" : "oscuro"}
                </span>
                . Al cambiarlo se aplica de inmediato en el ERP.
            </p>
        </section>
    );
}
