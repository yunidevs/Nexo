"use client";

import { Check, X } from "lucide-react";
import { useRef } from "react";
import type { CategoriaPublica } from "@/app/lib/marketplace";

export interface ValoresFiltros {
    categoria: string;
    empresa: string;
    precioMin: string;
    precioMax: string;
    disponible: string;
}

export interface OpcionesEmpresa {
    nombre: string;
    slug: string;
}

interface FiltrosPanelProps {
    valores: ValoresFiltros;
    categorias: CategoriaPublica[];
    empresas: OpcionesEmpresa[] | null;
    /** En modo tienda la empresa ya está fija: no se muestra ese filtro. */
    fijarEmpresa?: boolean;
    onCambiar: (parche: Partial<ValoresFiltros>) => void;
    onLimpiar: () => void;
}

/** Encabezado de cada bloque de filtros: versalitas y filete. */
function TituloFiltro({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.18em] text-mp-olive-ink uppercase">
            {children}
            <span
                aria-hidden="true"
                className="h-px flex-1 bg-mp-border"
            />
        </h3>
    );
}

function ListaOpciones({
    titulo,
    opciones,
    seleccion,
    onSelect,
    claveTodas,
    etiquetaTodas,
}: {
    titulo: string;
    opciones: { valor: string; etiqueta: string; cantidad?: number }[];
    seleccion: string;
    onSelect: (valor: string) => void;
    claveTodas: string;
    etiquetaTodas: string;
}) {
    return (
        <section>
            <TituloFiltro>{titulo}</TituloFiltro>
            <ul className="mt-3 space-y-0.5">
                {[{ valor: "", etiqueta: etiquetaTodas }, ...opciones].map(
                    (opcion) => {
                        const activa = seleccion === opcion.valor;
                        return (
                            <li key={opcion.valor || claveTodas}>
                                <button
                                    type="button"
                                    aria-pressed={activa}
                                    onClick={() => onSelect(opcion.valor)}
                                    className={`group flex w-full items-center justify-between gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[13px] transition-colors duration-200 ${
                                        activa
                                            ? "bg-mp-chip font-semibold text-mp-primary"
                                            : "text-mp-text-soft hover:bg-mp-surface hover:text-mp-text"
                                    }`}
                                >
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        {activa ? (
                                            <Check
                                                className="size-3.5 shrink-0 text-mp-primary"
                                                strokeWidth={2.5}
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                        <span className="min-w-0 truncate">
                                            {opcion.valor === ""
                                                ? etiquetaTodas
                                                : opcion.etiqueta}
                                        </span>
                                    </span>
                                    {opcion.cantidad !== undefined ? (
                                        <span
                                            className={`shrink-0 text-[11.5px] tabular-nums ${
                                                activa
                                                    ? "text-mp-primary"
                                                    : "text-mp-text-faint"
                                            }`}
                                        >
                                            {opcion.cantidad}
                                        </span>
                                    ) : null}
                                </button>
                            </li>
                        );
                    },
                )}
            </ul>
        </section>
    );
}

export function FiltrosPanel({
    valores,
    categorias,
    empresas,
    fijarEmpresa = false,
    onCambiar,
    onLimpiar,
}: FiltrosPanelProps) {
    // Los campos de precio no están controlados: el usuario escribe sin
    // disparar peticiones y aplica al pulsar el botón. La key fuerza el
    // re-montaje cuando el valor aplicado cambia desde afuera (limpiar filtros).
    const refPrecioMin = useRef<HTMLInputElement | null>(null);
    const refPrecioMax = useRef<HTMLInputElement | null>(null);

    const precioMinNumerico = Number(valores.precioMin);
    const precioMaxNumerico = Number(valores.precioMax);
    const hayPrecioInvalido =
        valores.precioMin !== "" &&
        valores.precioMax !== "" &&
        !Number.isNaN(precioMinNumerico) &&
        !Number.isNaN(precioMaxNumerico) &&
        precioMinNumerico > precioMaxNumerico;

    function aplicarPrecio() {
        onCambiar({
            precioMin: refPrecioMin.current?.value ?? "",
            precioMax: refPrecioMax.current?.value ?? "",
        });
    }

    return (
        <div className="space-y-7">
            <ListaOpciones
                titulo="Categorías"
                opciones={categorias.map((categoria) => ({
                    valor: categoria.nombre,
                    etiqueta: categoria.nombre,
                    cantidad: categoria.cantidad,
                }))}
                seleccion={valores.categoria}
                onSelect={(valor) => onCambiar({ categoria: valor })}
                claveTodas="todas-categorias"
                etiquetaTodas="Todas las categorías"
            />

            {!fijarEmpresa && empresas ? (
                <ListaOpciones
                    titulo="Empresas"
                    opciones={empresas.map((empresa) => ({
                        valor: empresa.slug,
                        etiqueta: empresa.nombre,
                    }))}
                    seleccion={valores.empresa}
                    onSelect={(valor) => onCambiar({ empresa: valor })}
                    claveTodas="todas-empresas"
                    etiquetaTodas="Todas las empresas"
                />
            ) : null}

            <section>
                <TituloFiltro>Precio</TituloFiltro>
                <div className="mt-3 flex items-center gap-2">
                    <label className="sr-only" htmlFor="precio-min">
                        Precio mínimo
                    </label>
                    <input
                        id="precio-min"
                        key={`min-${valores.precioMin}`}
                        ref={refPrecioMin}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="Mínimo"
                        defaultValue={valores.precioMin}
                        className="h-10 w-full rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13px] text-mp-text transition-colors placeholder:text-mp-text-faint focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                    />
                    <span aria-hidden="true" className="text-mp-text-faint">
                        –
                    </span>
                    <label className="sr-only" htmlFor="precio-max">
                        Precio máximo
                    </label>
                    <input
                        id="precio-max"
                        key={`max-${valores.precioMax}`}
                        ref={refPrecioMax}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="Máximo"
                        defaultValue={valores.precioMax}
                        className="h-10 w-full rounded-[9px] border border-mp-border bg-mp-elevated px-3 text-[13px] text-mp-text transition-colors placeholder:text-mp-text-faint focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                    />
                </div>
                {hayPrecioInvalido ? (
                    <p className="mt-1.5 text-[11.5px] text-mp-error" role="alert">
                        El mínimo no puede superar el máximo.
                    </p>
                ) : null}
                <button
                    type="button"
                    onClick={aplicarPrecio}
                    disabled={hayPrecioInvalido}
                    className="mt-2.5 h-10 w-full rounded-[9px] border border-mp-primary/25 text-[12.5px] font-semibold text-mp-primary transition-all duration-300 hover:border-mp-primary/50 hover:bg-mp-primary/5 disabled:cursor-not-allowed disabled:opacity-45"
                >
                    Aplicar precio
                </button>
            </section>

            <section>
                <TituloFiltro>Disponibilidad</TituloFiltro>
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-[13px] text-mp-text-soft transition-colors duration-200 hover:bg-mp-surface hover:text-mp-text">
                    <input
                        type="checkbox"
                        checked={valores.disponible === "true"}
                        onChange={(evento) =>
                            onCambiar({
                                disponible: evento.target.checked
                                    ? "true"
                                    : "",
                            })
                        }
                        className="size-4 rounded-[4px] border border-mp-border accent-[var(--mp-primary)]"
                    />
                    Solo productos disponibles
                </label>
            </section>

            <button
                type="button"
                onClick={() => {
                    onLimpiar();
                }}
                className="w-full rounded-[9px] border border-mp-border py-2 text-[12.5px] font-medium text-mp-text-soft transition-colors duration-300 hover:border-mp-error/40 hover:text-mp-error"
            >
                Limpiar filtros
            </button>
        </div>
    );
}

const ETIQUETAS_FILTRO = {
    q: "Búsqueda",
    categoria: "Categoría",
    empresa: "Empresa",
    precio: "Precio",
    disponible: "Solo disponibles",
} as const;

export type ClaveEtiquetaFiltro =
    | keyof typeof ETIQUETAS_FILTRO
    | `precio:${string}`;

interface EtiquetasFiltrosProps {
    valores: ValoresFiltros;
    busqueda: string;
    nombresEmpresas: Record<string, string>;
    onQuitar: (clave: ClaveEtiquetaFiltro) => void;
}

export function EtiquetasFiltros({
    valores,
    busqueda,
    nombresEmpresas,
    onQuitar,
}: EtiquetasFiltrosProps) {
    const etiquetas: { clave: ClaveEtiquetaFiltro; texto: string }[] = [];
    if (busqueda) {
        etiquetas.push({
            clave: "q",
            texto: `${ETIQUETAS_FILTRO.q}: "${busqueda}"`,
        });
    }
    if (valores.categoria) {
        etiquetas.push({
            clave: "categoria",
            texto: `${ETIQUETAS_FILTRO.categoria}: ${valores.categoria}`,
        });
    }
    if (valores.empresa) {
        etiquetas.push({
            clave: "empresa",
            texto: `${ETIQUETAS_FILTRO.empresa}: ${
                nombresEmpresas[valores.empresa] ?? valores.empresa
            }`,
        });
    }
    if (valores.precioMin || valores.precioMax) {
        const rango = [
            valores.precioMin ? `${valores.precioMin}` : "0",
            valores.precioMax ? `${valores.precioMax}` : "∞",
        ].join(" – ");
        etiquetas.push({
            clave: "precio",
            texto: `${ETIQUETAS_FILTRO.precio}: ${rango}`,
        });
    }
    if (valores.disponible === "true") {
        etiquetas.push({
            clave: "disponible",
            texto: ETIQUETAS_FILTRO.disponible,
        });
    }

    if (etiquetas.length === 0) return null;

    return (
        <ul
            className="flex flex-wrap items-center gap-2"
            aria-label="Filtros activos"
        >
            {etiquetas.map((etiqueta) => (
                <li key={etiqueta.clave}>
                    <button
                        type="button"
                        onClick={() => onQuitar(etiqueta.clave)}
                        aria-label={`Quitar filtro ${etiqueta.texto}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-mp-chip px-3 py-1 text-[11.5px] font-medium text-mp-primary transition-all duration-300 hover:bg-mp-primary hover:text-mp-on-accent"
                    >
                        {etiqueta.texto}
                        <X className="size-3.5" aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    );
}
