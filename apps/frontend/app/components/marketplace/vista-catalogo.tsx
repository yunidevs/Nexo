"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Buscador,
    type BuscadorHandle,
} from "@/app/components/marketplace/buscador";
import {
    EtiquetasFiltros,
    FiltrosPanel,
    type ClaveEtiquetaFiltro,
    type OpcionesEmpresa,
    type ValoresFiltros,
} from "@/app/components/marketplace/filtros";
import { TarjetaProducto } from "@/app/components/marketplace/tarjeta-producto";
import {
    botonPrimario,
    contenedor,
    eyebrow,
    tituloSeccion,
} from "@/app/components/marketplace/estilos";
import { apiRequest } from "@/app/lib/api";
import {
    construirConsultaCatalogo,
    esCategoriasPublicas,
    esListaTiendas,
    esOrdenCatalogo,
    esRespuestaCatalogo,
    ORDENES_CATALOGO,
    POR_PAGINA_CATALOGO,
    type CategoriaPublica,
    type ProductoCatalogo,
    type ResultadoCatalogo,
} from "@/app/lib/marketplace";

interface VistaCatalogoProps {
    /** Etiqueta del encabezado de la vista. */
    titulo: string;
    descripcion?: string;
    /** Ruta base para sincronizar filtros en la URL. */
    ruta: string;
    /** Modo tienda: solo muestra productos de esa empresa (por slug). */
    empresaFija?: string;
    /** Categorías disponibles para el filtro; se cargan solas si se omite. */
    categorias?: CategoriaPublica[];
}

function CuadriculaEsqueleto() {
    return (
        <div
            aria-hidden="true"
            className="grid grid-cols-2 gap-3 md:grid-cols-3 sm:gap-4 xl:grid-cols-4"
        >
            {Array.from({ length: 8 }, (_, indice) => (
                <div
                    key={indice}
                    className="animate-pulse overflow-hidden rounded-[16px] border border-mp-border bg-mp-warm"
                >
                    <div className="aspect-[4/5] bg-mp-surface" />
                    <div className="space-y-2 p-4">
                        <div className="h-2.5 w-1/3 rounded bg-mp-surface" />
                        <div className="h-4 w-full rounded bg-mp-surface" />
                        <div className="h-4 w-2/3 rounded bg-mp-surface" />
                        <div className="h-6 w-24 rounded bg-mp-surface" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function VistaCatalogo({
    titulo,
    descripcion,
    ruta,
    empresaFija,
    categorias,
}: VistaCatalogoProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const qParam = searchParams.get("q") ?? "";
    const categoriaParam = searchParams.get("categoria") ?? "";
    const empresaParam = empresaFija ?? (searchParams.get("empresa") ?? "");
    const precioMinParam = searchParams.get("precioMin") ?? "";
    const precioMaxParam = searchParams.get("precioMax") ?? "";
    const disponibleParam =
        searchParams.get("disponible") === "true" ? "true" : "";
    const ordenBruto = searchParams.get("orden");
    const ordenParam = esOrdenCatalogo(ordenBruto)
        ? ordenBruto
        : "relevancia";
    const paginaParam = Math.max(
        1,
        Number.parseInt(searchParams.get("pagina") ?? "1", 10) || 1,
    );

    const valores: ValoresFiltros = {
        categoria: categoriaParam,
        empresa: empresaFija ? "" : empresaParam,
        precioMin: precioMinParam,
        precioMax: precioMaxParam,
        disponible: disponibleParam,
    };

    /** Actualiza la URL conservando los filtros no modificados y reinicia la paginación. */
    const actualizar = useCallback(
        (parche: Record<string, string | number | undefined>) => {
            const valoresNuevos = {
                q: qParam || undefined,
                categoria: categoriaParam || undefined,
                empresa: empresaFija ?? (empresaParam || undefined),
                precioMin: precioMinParam || undefined,
                precioMax: precioMaxParam || undefined,
                disponible: disponibleParam || undefined,
                orden: ordenParam,
                // Cualquier cambio de filtro reinicia la paginación.
                pagina: undefined,
                ...parche,
            };
            router.replace(
                `${ruta}${construirConsultaCatalogo(valoresNuevos)}`,
                { scroll: false },
            );
        },
        [
            router,
            ruta,
            qParam,
            categoriaParam,
            empresaFija,
            empresaParam,
            precioMinParam,
            precioMaxParam,
            disponibleParam,
            ordenParam,
        ],
    );

    // Búsqueda con debounce manejada por el Buscador (estado interno).
    // El ref permite limpiar el campo cuando se quita el filtro desde afuera.
    const buscadorRef = useRef<BuscadorHandle>(null);

    function limpiarBusqueda() {
        buscadorRef.current?.limpiar();
        actualizar({ q: "" });
    }

    // Catálogo paginado con carga incremental.
    const consulta = construirConsultaCatalogo({
        q: qParam || undefined,
        categoria: categoriaParam || undefined,
        empresa: empresaFija ?? (empresaParam || undefined),
        precioMin: precioMinParam || undefined,
        precioMax: precioMaxParam || undefined,
        disponible: disponibleParam || undefined,
        orden: ordenParam,
        pagina: paginaParam,
        porPagina: POR_PAGINA_CATALOGO,
    });
    const [catalogo, setCatalogo] = useState<ResultadoCatalogo | null>(null);
    const [visibles, setVisibles] = useState<ProductoCatalogo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [error, setError] = useState("");
    const consultaAnterior = useRef<string | null>(null);

    useEffect(() => {
        let cancelada = false;
        const reemplazar = consultaAnterior.current !== consulta;
        consultaAnterior.current = consulta;
        if (reemplazar) {
            setCargando(true);
            setError("");
        } else {
            setCargandoMas(true);
        }
        apiRequest(`/marketplace/catalogo${consulta}`)
            .then((datos) => {
                if (cancelada) return;
                if (!esRespuestaCatalogo(datos)) {
                    throw new Error(
                        "La API devolvió un catálogo de productos no válido.",
                    );
                }
                const respuesta = datos.catalogo;
                setCatalogo(respuesta);
                setVisibles((anteriores) =>
                    reemplazar
                        ? respuesta.productos
                        : [...anteriores, ...respuesta.productos],
                );
            })
            .catch((motivo) => {
                if (!cancelada) {
                    setError(
                        motivo instanceof Error
                            ? motivo.message
                            : "No se pudo cargar el catálogo.",
                    );
                }
            })
            .finally(() => {
                if (!cancelada) {
                    setCargando(false);
                    setCargandoMas(false);
                }
            });
        return () => {
            cancelada = true;
        };
    }, [consulta]);

    // Opciones de los filtros: categorías y empresas. Si el modo tienda
    // provee sus categorías, se usan directamente; si no, se cargan solas.
    const [categoriasCargadas, setCategoriasCargadas] = useState<
        CategoriaPublica[]
    >([]);
    const [opcionesEmpresas, setOpcionesEmpresas] = useState<
        OpcionesEmpresa[] | null
    >(empresaFija ? null : []);
    const opcionesCategorias = categorias ?? categoriasCargadas;
    useEffect(() => {
        if (empresaFija) return;
        let cancelada = false;
        async function cargarOpciones() {
            try {
                const [datosCategorias, datosTiendas] = await Promise.all([
                    apiRequest("/marketplace/catalogo/categorias"),
                    apiRequest("/marketplace/tiendas"),
                ]);
                if (cancelada) return;
                const categoriasConsulta = (
                    datosCategorias as { categorias?: unknown } | null
                )?.categorias;
                if (esCategoriasPublicas(categoriasConsulta)) {
                    setCategoriasCargadas(categoriasConsulta);
                }
                if (esListaTiendas(datosTiendas)) {
                    setOpcionesEmpresas(
                        datosTiendas.tiendas
                            .filter((tienda) => tienda.productos.length > 0)
                            .map((tienda) => ({
                                nombre: tienda.nombre,
                                slug: tienda.slug,
                            })),
                    );
                }
            } catch {
                // Los listados de filtros son accesorios: si fallan, el
                // catálogo sigue funcionando con el resto de filtros.
            }
        }
        void cargarOpciones();
        return () => {
            cancelada = true;
        };
    }, [empresaFija]);

    const nombresEmpresas: Record<string, string> = {};
    for (const empresa of opcionesEmpresas ?? []) {
        nombresEmpresas[empresa.slug] = empresa.nombre;
    }

    const filtrosActivos = [
        qParam,
        valores.categoria,
        valores.empresa,
        valores.precioMin || valores.precioMax ? "precio" : "",
        valores.disponible,
    ].filter(Boolean).length;

    function quitarEtiqueta(clave: ClaveEtiquetaFiltro) {
        switch (clave) {
            case "q":
                limpiarBusqueda();
                break;
            case "categoria":
                actualizar({ categoria: "" });
                break;
            case "empresa":
                actualizar({ empresa: "" });
                break;
            case "precio":
                actualizar({ precioMin: "", precioMax: "" });
                break;
            case "disponible":
                actualizar({ disponible: "" });
                break;
        }
    }

    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

    const panelFiltros = (
        <FiltrosPanel
            valores={valores}
            categorias={opcionesCategorias}
            empresas={opcionesEmpresas}
            fijarEmpresa={empresaFija !== undefined}
            onCambiar={actualizar}
            onLimpiar={() => {
                limpiarBusqueda();
                actualizar({
                    categoria: "",
                    empresa: "",
                    precioMin: "",
                    precioMax: "",
                    disponible: "",
                });
            }}
        />
    );

    return (
        <>
            <section className="border-b border-mp-border/80 bg-mp-surface/60">
                <div className={`${contenedor} py-8 sm:py-10`}>
                    <p className={eyebrow}>
                        <span
                            aria-hidden="true"
                            className="h-px w-6 bg-mp-olive/40"
                        />
                        Catálogo
                    </p>
                    <h1 className={`${tituloSeccion} mt-2`}>{titulo}</h1>
                    {descripcion ? (
                        <p className="mt-2 max-w-[58ch] text-[13px] leading-6 text-mp-text-soft">
                            {descripcion}
                        </p>
                    ) : null}
                    <div className="mt-6 max-w-2xl">
                        <Buscador
                            ref={buscadorRef}
                            valorInicial={qParam}
                            onBuscar={(valor) => actualizar({ q: valor })}
                            cargando={cargando && !cargandoMas}
                        />
                    </div>
                </div>
            </section>

            <div
                className={`${contenedor} grid items-start gap-8 py-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-10`}
            >
                <aside
                    className="hidden lg:block"
                    aria-label="Filtros del catálogo"
                >
                    <div className="sticky top-24 rounded-[16px] border border-mp-border bg-mp-elevated p-5">
                        <h2 className="font-serif text-[1.3rem] leading-none text-mp-primary">
                            Filtros
                        </h2>
                        <div className="mt-4">{panelFiltros}</div>
                    </div>
                </aside>

                <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12.5px] text-mp-text-soft">
                            {catalogo && !cargando
                                ? `${catalogo.total} ${
                                      catalogo.total === 1
                                          ? "producto"
                                          : "productos"
                                  }`
                                : "Buscando productos..."}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFiltrosAbiertos(true)}
                                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-mp-primary/25 bg-mp-elevated px-3.5 text-[12.5px] font-semibold text-mp-primary transition-all duration-300 hover:border-mp-primary/50 hover:bg-mp-primary/5 lg:hidden"
                            >
                                Filtrar
                                {filtrosActivos > 0 ? (
                                    <span className="grid min-w-5 place-items-center rounded-full bg-mp-accent px-1 text-[11px] font-bold text-mp-primary">
                                        {filtrosActivos}
                                    </span>
                                ) : null}
                            </button>
                            <label className="inline-flex items-center gap-2 text-[12.5px] text-mp-text-soft">
                                <span className="sr-only sm:not-sr-only">
                                    Ordenar por
                                </span>
                                <select
                                    value={ordenParam}
                                    onChange={(evento) =>
                                        actualizar({
                                            orden: evento.target.value,
                                        })
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

                    <div className="mt-4">
                        <EtiquetasFiltros
                            valores={valores}
                            busqueda={qParam}
                            nombresEmpresas={nombresEmpresas}
                            onQuitar={quitarEtiqueta}
                        />
                    </div>

                    {error ? (
                        <p
                            role="alert"
                            className="mt-4 rounded-[12px] border border-mp-error/25 bg-mp-error/5 p-4 text-[13px] text-mp-error"
                        >
                            {error}
                        </p>
                    ) : null}

                    {cargando ? (
                        <div className="mt-4">
                            <CuadriculaEsqueleto />
                        </div>
                    ) : visibles.length === 0 ? (
                        <div className="mt-4 rounded-[16px] border border-dashed border-mp-border bg-mp-elevated px-6 py-14 text-center">
                            <span className="mx-auto grid size-12 place-items-center rounded-full bg-mp-chip">
                                <Search
                                    className="size-5 text-mp-olive"
                                    strokeWidth={1.4}
                                    aria-hidden="true"
                                />
                            </span>
                            <h2 className="mt-4 font-serif text-[1.35rem] text-mp-primary">
                                No encontramos productos
                            </h2>
                            <p className="mt-1.5 text-[13px] text-mp-text-soft">
                                Probá ajustando la búsqueda o los filtros.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    limpiarBusqueda();
                                    router.replace(ruta);
                                }}
                                className={`${botonPrimario} mt-5`}
                            >
                                Limpiar búsqueda y filtros
                            </button>
                        </div>
                    ) : (
                        <div className="mp-cuadricula mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                            {visibles.map((producto) => (
                                <TarjetaProducto
                                    key={producto.id}
                                    producto={producto}
                                />
                            ))}
                        </div>
                    )}

                    {catalogo && !cargando && visibles.length > 0 ? (
                        visibles.length < catalogo.total ? (
                            <div className="mt-10 text-center">
                                <button
                                    type="button"
                                    onClick={() =>
                                        actualizar({
                                            pagina: paginaParam + 1,
                                        })
                                    }
                                    disabled={cargandoMas}
                                    className={`${botonPrimario} disabled:cursor-wait`}
                                >
                                    {cargandoMas ? (
                                        <span
                                            aria-hidden="true"
                                            className="size-4 animate-spin rounded-full border-2 border-mp-on-accent/30 border-t-mp-on-accent"
                                        />
                                    ) : null}
                                    Cargar más productos
                                    <span className="font-normal opacity-70">
                                        ({catalogo.total - visibles.length}{" "}
                                        restantes)
                                    </span>
                                </button>
                            </div>
                        ) : (
                            <p className="mt-10 text-center text-[12.5px] text-mp-text-soft">
                                Mostrando los {catalogo.total}{" "}
                                {catalogo.total === 1
                                    ? "producto"
                                    : "productos"}{" "}
                                encontrados
                            </p>
                        )
                    ) : null}
                </div>
            </div>

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
                    <div className="absolute inset-y-0 left-0 flex w-full max-w-xs flex-col bg-mp-surface shadow-[0_0_60px_-20px_rgba(37,56,42,0.55)]">
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
                                Aplicar filtros
                                {filtrosActivos > 0
                                    ? ` (${filtrosActivos})`
                                    : ""}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
