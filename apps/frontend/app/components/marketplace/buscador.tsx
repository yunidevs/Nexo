"use client";

import { Search, X } from "lucide-react";
import {
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type Ref,
} from "react";

const RETARDO_BUSQUEDA_MS = 400;

export interface BuscadorHandle {
    /** Limpia el campo y cancela la búsqueda pendiente. */
    limpiar: () => void;
    /** Fija el contenido del campo, por ejemplo al cambiar la consulta en la URL. */
    setValor: (valor: string) => void;
}

interface BuscadorProps {
    /** Valor con el que se inicia el campo (p. ej. el parámetro q de la URL). */
    valorInicial?: string;
    /** Se invoca con debounce mientras se escribe e inmediatamente al enviar. */
    onBuscar: (consulta: string) => void;
    /** Versión compacta para el encabezado. */
    compacto?: boolean;
    /** Muestra un indicador de carga junto al campo. */
    cargando?: boolean;
    ref?: Ref<BuscadorHandle>;
}

export function Buscador({
    valorInicial = "",
    onBuscar,
    compacto = false,
    cargando = false,
    ref,
}: BuscadorProps) {
    const [valor, setValor] = useState(valorInicial);
    const temporizador = useRef<number | null>(null);

    function cancelarBusqueda() {
        if (temporizador.current !== null) {
            window.clearTimeout(temporizador.current);
            temporizador.current = null;
        }
    }

    useImperativeHandle(
        ref,
        () => ({
            limpiar: () => {
                cancelarBusqueda();
                setValor("");
            },
            setValor: (nuevo: string) => {
                cancelarBusqueda();
                setValor(nuevo);
            },
        }),
        [],
    );

    useEffect(
        () => () => {
            if (temporizador.current !== null) {
                window.clearTimeout(temporizador.current);
            }
        },
        [],
    );

    function programarBusqueda(consulta: string) {
        cancelarBusqueda();
        temporizador.current = window.setTimeout(() => {
            temporizador.current = null;
            onBuscar(consulta);
        }, RETARDO_BUSQUEDA_MS);
    }

    return (
        <form
            role="search"
            onSubmit={(evento) => {
                evento.preventDefault();
                cancelarBusqueda();
                onBuscar(valor);
            }}
        >
            <div className="group relative rounded-full border border-mp-border bg-mp-elevated transition-all duration-300 ease-out focus-within:border-mp-primary/45 focus-within:shadow-[0_0_0_3px_rgba(37,56,42,0.08)]">
                <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mp-olive transition-colors duration-300 group-focus-within:text-mp-primary"
                />
                <input
                    type="search"
                    value={valor}
                    onChange={(evento) => {
                        setValor(evento.target.value);
                        programarBusqueda(evento.target.value);
                    }}
                    placeholder="Buscar productos, marcas o empresas..."
                    aria-label="Buscar productos, marcas o empresas"
                    className={
                        compacto
                            ? "h-10 w-full rounded-full border-0 bg-transparent pl-10 pr-9 text-[13px] text-mp-text outline-none placeholder:text-mp-text-faint"
                            : "h-12 w-full rounded-full border-0 bg-transparent pl-11 pr-10 text-[14px] text-mp-text outline-none placeholder:text-mp-text-faint"
                    }
                />
                {valor && !cargando ? (
                    <button
                        type="button"
                        aria-label="Limpiar búsqueda"
                        onClick={() => {
                            setValor("");
                            cancelarBusqueda();
                            onBuscar("");
                        }}
                        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-mp-text-faint transition-colors duration-300 hover:bg-mp-primary/10 hover:text-mp-primary"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                ) : null}
                {cargando ? (
                    <span
                        aria-hidden="true"
                        className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-mp-border border-t-mp-primary"
                    />
                ) : null}
            </div>
        </form>
    );
}
