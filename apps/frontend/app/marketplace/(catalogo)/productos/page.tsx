"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { TarjetaProducto } from "@/app/components/marketplace/tarjeta-producto";
import {
    Buscador,
    type BuscadorHandle,
} from "@/app/components/marketplace/buscador";
import {
    EtiquetasFiltros,
    FiltrosPanel,
    type ClaveEtiquetaFiltro,
    type ValoresFiltros,
} from "@/app/components/marketplace/filtros";
import {
    botonPrimario,
    contenedor,
    eyebrow,
    miga,
    tituloSeccion,
} from "@/app/components/marketplace/estilos";
import { apiRequest } from "@/app/lib/api";
import {
    construirConsultaCatalogo,
    esCategoriasPublicas,
    esRespuestaCatalogo,
    esTiendaMarketplace,
    ORDENES_CATALOGO,
    type CategoriaPublica,
    type ConsultaCatalogo,
    type ResultadoCatalogo,
    type TiendaMarketplace,
} from "@/app/lib/marketplace";

function esListaTiendas(
    valor: unknown,
): valor is { tiendas: TiendaMarketplace[] } {
    return (
        typeof valor === "object" &&
        valor !== null &&
        Array.isArray((valor as { tiendas?: unknown }).tiendas) &&
        (valor as { tiendas: unknown[] }).tiendas.every(esTiendaMarketplace)
    );
}

/** Reconstruye la consulta actual desde los parámetros de la URL. */
function leerConsulta(parametros: URLSearchParams): ConsultaCatalogo {
    const pagina = Number(parametros.get("pagina"));
    return {
        q: parametros.get("q") ?? undefined,
        categoria: parametros.get("categoria") ?? undefined,
        empresa: parametros.get("empresa") ?? undefined,
        precioMin: parametros.get("precioMin") ?? undefined,
        precioMax: parametros.get("precioMax") ?? undefined,
        disponible: parametros.get("disponible") ?? undefined,
        orden: parametros.get("orden") ?? undefined,
        pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : undefined,
    };
}

function ContenidoCatalogo() {
    const router = useRouter();
    const parametros = useSearchParams();
    const consulta = useMemo(() => leerConsulta(parametros), [parametros]);
    const claveConsulta = construirConsultaCatalogo(consulta);

    const [resultado, setResultado] = useState<ResultadoCatalogo | null>(null);
    const [categorias, setCategorias] = useState<CategoriaPublica[] | null>(
        null,
    );
    const [nombresEmpresas, setNombresEmpresas] = useState<
        Record<string, string>
    >({});
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(true);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

    // Búsqueda con debounce: el campo escribe en la URL y la página vuelve
    // a pedir el catálogo con el criterio ya aplicado.
    const buscadorRef = useRef<BuscadorHandle>(null);
    const consultaEnviada = useRef<string>(consulta.q ?? "");

    useEffect(() => {
        const qUrl = consulta.q ?? "";
        // Si la consulta cambió desde afuera (por ejemplo, al seguir un
        // enlace), el campo se sincroniza con la URL.
        if (qUrl !== consultaEnviada.current) {
            consultaEnviada.current = qUrl;
            buscadorRef.current?.setValor(qUrl);
        }
    }, [consulta.q]);

    useEffect(() => {
        let cancelada = false;
        async function cargarCatalogo() {
            setCargando(true);
            setError("");
            try {
                const datos = await apiRequest(
                    `/marketplace/catalogo${claveConsulta}`,
                );
                if (cancelada) return;
                if (esRespuestaCatalogo(datos)) {
                    setResultado(datos.catalogo);
                } else {
                    throw new Error(
                        "La API devolvió el catálogo con un formato no válido.",
                    );
                }
            } catch (errorCarga) {
                if (cancelada) return;
                setResultado(null);
                setError(
                    errorCarga instanceof Error
                        ? errorCarga.message
                        : "No se pudo cargar el catálogo.",
                );
            } finally {
                if (!cancelada) setCargando(false);
            }
        }
        void cargarCatalogo();
        return () => {
            cancelada = true;
        };
    }, [claveConsulta]);

    // Opciones de los filtros: categorías publicadas y empresas con tienda.
    useEffect(() => {
        let cancelada = false;
        async function cargarOpciones() {
            const [resultadoCategorias, resultadoTiendas] =
                await Promise.allSettled([
                    apiRequest("/marketplace/catalogo/categorias"),
                    apiRequest("/marketplace/tiendas"),
                ]);
            if (cancelada) return;
            if (resultadoCategorias.status === "fulfilled") {
                const datos = resultadoCategorias.value;
                if (
                    typeof datos === "object" &&
                    datos !== null &&
                    esCategoriasPublicas(
                        (datos as { categorias?: unknown }).categorias,
                    )
                ) {
                    setCategorias(
                        (datos as { categorias: CategoriaPublica[] })
                            .categorias,
                    );
                }
            }
            if (resultadoTiendas.status === "fulfilled") {
                const datos = resultadoTiendas.value;
                if (esListaTiendas(datos)) {
                    setNombresEmpresas(
                        Object.fromEntries(
                            datos.tiendas.map((tienda) => [
                                tienda.slug,
                                tienda.nombre,
                            ]),
                        ),
                    );
                }
            }
        }
        void cargarOpciones();
        return () => {
            cancelada = true;
        };
    }, []);

    const valores: ValoresFiltros = {
        categoria: consulta.categoria ?? "",
        empresa: consulta.empresa ?? "",
        precioMin: consulta.precioMin ?? "",
        precioMax: consulta.precioMax ?? "",
        disponible: consulta.disponible ?? "",
    };

    function navegar(consultaNueva: ConsultaCatalogo) {
        router.push(
            `/marketplace/productos${construirConsultaCatalogo(consultaNueva)}`,
        );
    }

    function cambiarFiltros(parche: Partial<ValoresFiltros>) {
        navegar({
            ...consulta,
            ...parche,
            // Un cambio de filtro vuelve a la primera página.
            pagina: undefined,
        });
    }

    function buscar(texto: string) {
        const q = texto.trim();
        if (q === (consulta.q ?? "")) return;
        consultaEnviada.current = q;
        navegar({ ...consulta, q: q || undefined, pagina: undefined });
    }

    function quitarFiltro(clave: ClaveEtiquetaFiltro) {
        if (clave === "q") {
            consultaEnviada.current = "";
            buscadorRef.current?.setValor("");
            return navegar({ ...consulta, q: undefined, pagina: undefined });
        }
        if (clave === "categoria")
            return navegar({ ...consulta, categoria: undefined, pagina: undefined });
        if (clave === "empresa")
            return navegar({ ...consulta, empresa: undefined, pagina: undefined });
        if (clave === "disponible")
            return navegar({ ...consulta, disponible: undefined, pagina: undefined });
        // "precio" o "precio:min" / "precio:max"
        return navegar({ ...consulta, precioMin: undefined, precioMax: undefined, pagina: undefined });
    }

    function cambiarOrden(orden: string) {
        navegar({ ...consulta, orden, pagina: undefined });
    }

    function cambiarPagina(pagina: number) {
        navegar({ ...consulta, pagina });
    }

    const ordenActual = consulta.orden ?? "relevancia";
    const hayResultados = resultado !== null && resultado.productos.length > 0;
    const totalResultados = resultado?.total ?? 0;
    const opcionesEmpresas = Object.entries(nombresEmpresas).map(
        ([slug, nombre]) => ({ slug, nombre }),
    );

    const panelFiltros = (
        <FiltrosPanel
            valores={valores}
            categorias={categorias ?? []}
            empresas={opcionesEmpresas}
            onCambiar={cambiarFiltros}
            onLimpiar={() => {
                consultaEnviada.current = "";
                buscadorRef.current?.setValor("");
                navegar({ orden: consulta.orden });
            }}
        />
    );

    return (
        <main>
            <div className="border-b border-mp-border/80 bg-mp-surface/60">
                <div className={`${contenedor} py-8 sm:py-10`}>
                    <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5">
                        <Link href="/marketplace" className={miga}>
                            Inicio
                        </Link>
                        <span aria-hidden="true" className="text-mp-text-faint">
                            /
                        </span>
                        <span className="text-[11.5px] font-medium text-mp-primary">
                            Productos
                        </span>
                    </nav>

                    <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
                        <div>
                            <p className={eyebrow}>
                                <span
                                    aria-hidden="true"
                                    className="h-px w-6 bg-mp-olive/40"
                                />
                                Catálogo
                            </p>
                            <h1 className={`${tituloSeccion} mt-2`}>
                                Todos los productos
                            </h1>
                            <p className="mt-2 text-[13px] text-mp-text-soft">
                                {cargando
                                    ? "Buscando productos..."
                                    : `${totalResultados} ${
                                          totalResultados === 1
                                              ? "producto"
                                              : "productos"
                                      } de todas las empresas`}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFiltrosAbiertos(true)}
                                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-mp-primary/25 bg-mp-elevated px-3.5 text-[12.5px] font-semibold text-mp-primary transition-all duration-300 hover:border-mp-primary/50 hover:bg-mp-primary/5 lg:hidden"
                            >
                                <SlidersHorizontal
                                    className="size-4"
                                    aria-hidden="true"
                                />
                                Filtros
                            </button>
                            <label className="flex items-center gap-2 text-[12.5px] text-mp-text-soft">
                                <span className="sr-only sm:not-sr-only">
                                    Ordenar por
                                </span>
                                <select
                                    value={ordenActual}
                                    onChange={(evento) =>
                                        cambiarOrden(evento.target.value)
                                    }
                                    className="h-10 rounded-[10px] border border-mp-border bg-mp-elevated px-3 text-[12.5px] font-medium text-mp-text transition-colors focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary"
                                >
                                    {ORDENES_CATALOGO.map((orden) => (
                                        <option
                                            key={orden.valor}
                                            value={orden.valor}
                                        >
                                            {orden.etiqueta}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    <div className="mt-6 max-w-2xl">
                        <Buscador
                            ref={buscadorRef}
                            valorInicial={consulta.q ?? ""}
                            onBuscar={buscar}
                            cargando={cargando}
                        />
                    </div>
                </div>
            </div>

            <div className={`${contenedor} grid items-start gap-8 py-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-10`}>
                <aside
                    aria-label="Filtros del catálogo"
                    className="hidden lg:block"
                >
                    <div className="sticky top-24 rounded-[16px] border border-mp-border bg-mp-elevated p-5">
                        <h2 className="font-serif text-[1.3rem] leading-none text-mp-primary">
                            Filtros
                        </h2>
                        <div className="mt-4">{panelFiltros}</div>
                    </div>
                </aside>

                <div>
                    <EtiquetasFiltros
                        valores={valores}
                        busqueda={consulta.q ?? ""}
                        nombresEmpresas={nombresEmpresas}
                        onQuitar={quitarFiltro}
                    />

                    {error ? (
                        <div
                            role="alert"
                            className="mt-4 rounded-[12px] border border-mp-error/25 bg-mp-error/5 p-4 text-[13px] text-mp-error"
                        >
                            <p>{error}</p>
                            <Link
                                href="/marketplace/productos"
                                className="mt-1 inline-block font-semibold underline"
                            >
                                Reintentar sin filtros
                            </Link>
                        </div>
                    ) : cargando ? (
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, indice) => (
                                <div
                                    key={indice}
                                    className="animate-pulse rounded-[16px] border border-mp-border bg-mp-warm"
                                    style={{ minHeight: "21rem" }}
                                />
                            ))}
                        </div>
                    ) : hayResultados && resultado ? (
                        <>
                            <div className="mp-cuadricula mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                                {resultado.productos.map((producto, indice) => (
                                    <TarjetaProducto
                                        key={producto.id}
                                        producto={producto}
                                        prioritario={indice < 3}
                                    />
                                ))}
                            </div>
                            {resultado.totalPaginas > 1 ? (
                                <nav
                                    aria-label="Paginación"
                                    className="mt-10 flex items-center justify-center gap-3"
                                >
                                    <button
                                        type="button"
                                        disabled={resultado.pagina <= 1}
                                        onClick={() =>
                                            cambiarPagina(
                                                resultado.pagina - 1,
                                            )
                                        }
                                        className="inline-flex h-10 items-center rounded-[10px] border border-mp-border bg-mp-elevated px-4 text-[12.5px] font-semibold text-mp-primary transition-all duration-300 hover:border-mp-primary/45 hover:bg-mp-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Anterior
                                    </button>
                                    <p className="text-[12.5px] text-mp-text-soft">
                                        Página {resultado.pagina} de{" "}
                                        {resultado.totalPaginas}
                                    </p>
                                    <button
                                        type="button"
                                        disabled={
                                            resultado.pagina >=
                                            resultado.totalPaginas
                                        }
                                        onClick={() =>
                                            cambiarPagina(
                                                resultado.pagina + 1,
                                            )
                                        }
                                        className="inline-flex h-10 items-center rounded-[10px] border border-mp-border bg-mp-elevated px-4 text-[12.5px] font-semibold text-mp-primary transition-all duration-300 hover:border-mp-primary/45 hover:bg-mp-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Siguiente
                                    </button>
                                </nav>
                            ) : null}
                        </>
                    ) : (
                        <div className="mt-4 rounded-[16px] border border-dashed border-mp-border bg-mp-elevated px-6 py-14 text-center">
                            <span className="mx-auto grid size-12 place-items-center rounded-full bg-mp-chip">
                                <Search
                                    className="size-5 text-mp-olive"
                                    strokeWidth={1.4}
                                    aria-hidden="true"
                                />
                            </span>
                            <h2 className="mt-4 font-serif text-[1.35rem] text-mp-primary">
                                No encontramos productos con esos filtros
                            </h2>
                            <p className="mt-1.5 text-[13px] text-mp-text-soft">
                                Probá con otra búsqueda o limpiá los filtros
                                activos.
                            </p>
                            <Link
                                href="/marketplace/productos"
                                className={`${botonPrimario} mt-5`}
                            >
                                Limpiar filtros
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Filtros en móvil: panel deslizante */}
            {filtrosAbiertos ? (
                <div
                    className="fixed inset-0 z-50 lg:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Filtros del catálogo"
                >
                    <button
                        type="button"
                        aria-label="Cerrar filtros"
                        onClick={() => setFiltrosAbiertos(false)}
                        className="absolute inset-0 h-full w-full cursor-default bg-mp-primary/40 backdrop-blur-[2px]"
                    />
                    <aside className="absolute left-0 top-0 flex h-full w-full max-w-xs flex-col bg-mp-surface shadow-[0_0_60px_-20px_rgba(37,56,42,0.55)]">
                        <header className="flex items-center justify-between border-b border-mp-border px-5 py-4">
                            <h2 className="font-serif text-[1.35rem] leading-none text-mp-primary">
                                Filtros
                            </h2>
                            <button
                                type="button"
                                onClick={() => setFiltrosAbiertos(false)}
                                aria-label="Cerrar filtros"
                                className="grid size-9 place-items-center rounded-full text-mp-text-soft transition-colors duration-300 hover:bg-mp-primary/10 hover:text-mp-primary"
                            >
                                <X className="size-5" aria-hidden="true" />
                            </button>
                        </header>
                        <div className="flex-1 overflow-y-auto px-5 py-5">
                            {panelFiltros}
                        </div>
                        <div className="border-t border-mp-border px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setFiltrosAbiertos(false)}
                                className={`${botonPrimario} w-full`}
                            >
                                Ver {totalResultados}{" "}
                                {totalResultados === 1
                                    ? "resultado"
                                    : "resultados"}
                            </button>
                        </div>
                    </aside>
                </div>
            ) : null}
        </main>
    );
}

export default function PaginaProductosMarketplace() {
    return (
        <Suspense
            fallback={
                <p className="py-20 text-center text-[13px] text-mp-text-soft">
                    Cargando el catálogo...
                </p>
            }
        >
            <ContenidoCatalogo />
        </Suspense>
    );
}
