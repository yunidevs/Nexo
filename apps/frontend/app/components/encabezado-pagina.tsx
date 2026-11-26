import type { ReactNode } from "react";

interface EncabezadoPaginaProps {
    /** Antetítulo en versalitas sobre el título (eyebrow). */
    kicker?: ReactNode;
    titulo: ReactNode;
    descripcion?: ReactNode;
    /** Acciones alineadas a la derecha (botones, contadores, etc.). */
    acciones?: ReactNode;
    /** Muestra la línea separadora inferior. Por defecto está activa. */
    borde?: boolean;
    className?: string;
}

/**
 * Encabezado compacto y compartido de las páginas del ERP.
 *
 * Centraliza la jerarquía título/descripción/acciones para que todas las
 * secciones ocupen el mínimo espacio vertical necesario y el contenido
 * principal gane protagonismo. No altera lógica ni contenido: solo
 * estructura y espaciado.
 */
export function EncabezadoPagina({
    kicker,
    titulo,
    descripcion,
    acciones,
    borde = true,
    className = "",
}: EncabezadoPaginaProps) {
    return (
        <header
            className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${
                borde ? "border-b border-white/[0.08] pb-3.5" : ""
            } ${className}`}
        >
            <div className="min-w-0">
                {kicker ? (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300">
                        {kicker}
                    </p>
                ) : null}
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {titulo}
                </h1>
                {descripcion ? (
                    <p className="mt-0.5 text-[13px] text-slate-400">
                        {descripcion}
                    </p>
                ) : null}
            </div>
            {acciones ? (
                <div className="flex flex-wrap items-center gap-2">
                    {acciones}
                </div>
            ) : null}
        </header>
    );
}
