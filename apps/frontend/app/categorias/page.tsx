"use client";

import {
    Ban,
    CircleAlert,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Tag,
    X,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/app/lib/api";

interface Categoria {
    id: string;
    nombre: string;
    descripcion: string | null;
    activo: boolean;
    creadaEn: string;
}

interface Paginacion {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
}

interface FormularioCategoria {
    nombre: string;
    descripcion: string;
}

const formularioVacio: FormularioCategoria = {
    nombre: "",
    descripcion: "",
};

function esCategoria(valor: unknown): valor is Categoria {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "nombre" in valor &&
        typeof valor.nombre === "string" &&
        "descripcion" in valor &&
        (typeof valor.descripcion === "string" || valor.descripcion === null) &&
        "activo" in valor &&
        typeof valor.activo === "boolean" &&
        "creadaEn" in valor &&
        typeof valor.creadaEn === "string"
    );
}

function esPaginacion(valor: unknown): valor is Paginacion {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "pagina" in valor &&
        typeof valor.pagina === "number" &&
        "limite" in valor &&
        typeof valor.limite === "number" &&
        "total" in valor &&
        typeof valor.total === "number" &&
        "totalPaginas" in valor &&
        typeof valor.totalPaginas === "number"
    );
}

function esResultadoCategorias(
    valor: unknown,
): valor is { datos: Categoria[]; paginacion: Paginacion } {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "datos" in valor &&
        Array.isArray(valor.datos) &&
        valor.datos.every(esCategoria) &&
        "paginacion" in valor &&
        esPaginacion(valor.paginacion)
    );
}

async function obtenerCategorias(
    pagina: number,
    limite: number,
    buscar: string,
) {
    const parametros = new URLSearchParams({
        pagina: String(pagina),
        limite: String(limite),
        buscar,
    });
    const resultado = await apiRequest(`/categorias?${parametros.toString()}`);

    if (!esResultadoCategorias(resultado)) {
        throw new Error("La API devolvió una lista de categorías no válida.");
    }

    return resultado;
}

export default function PaginaCategorias() {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [paginacion, setPaginacion] = useState<Paginacion>({
        pagina: 1,
        limite: 10,
        total: 0,
        totalPaginas: 0,
    });
    const [busqueda, setBusqueda] = useState("");
    const [termino, setTermino] = useState("");
    const [revisionBusqueda, setRevisionBusqueda] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(
        null,
    );
    const [modalAbierto, setModalAbierto] = useState(false);
    const [datosFormulario, setDatosFormulario] =
        useState<FormularioCategoria>(formularioVacio);
    const [guardando, setGuardando] = useState(false);
    const activadorModal = useRef<HTMLElement | null>(null);

    useEffect(() => {
        let cancelada = false;

        async function cargar() {
            try {
                const resultado = await obtenerCategorias(
                    paginacion.pagina,
                    paginacion.limite,
                    termino,
                );

                if (!cancelada) {
                    setCategorias(resultado.datos);
                    setPaginacion(resultado.paginacion);
                    setError("");
                }
            } catch (error) {
                if (!cancelada) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "No se pudieron cargar las categorías.",
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
    }, [paginacion.limite, paginacion.pagina, revisionBusqueda, termino]);

    function buscar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setCargando(true);
        setError("");
        setPaginacion((actual) => ({ ...actual, pagina: 1 }));
        setTermino(busqueda.trim());
        setRevisionBusqueda((actual) => actual + 1);
    }

    function abrirNuevo() {
        activadorModal.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        setCategoriaEditando(null);
        setDatosFormulario(formularioVacio);
        setError("");
        setModalAbierto(true);
    }

    function abrirEdicion(categoria: Categoria) {
        activadorModal.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        setCategoriaEditando(categoria);
        setDatosFormulario({
            nombre: categoria.nombre,
            descripcion: categoria.descripcion ?? "",
        });
        setError("");
        setModalAbierto(true);
    }

    function cerrarFormulario() {
        setModalAbierto(false);
        window.requestAnimationFrame(() => activadorModal.current?.focus());
    }

    async function guardarCategoria(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");

        try {
            const categoria = categoriaEditando;
            await apiRequest(
                categoria ? `/categorias/${categoria.id}` : "/categorias",
                categoria ? "PATCH" : "POST",
                datosFormulario,
            );
            cerrarFormulario();
            setCargando(true);
            setMensaje(
                categoria
                    ? "La categoría se actualizó correctamente."
                    : "La categoría se creó correctamente.",
            );
            setRevisionBusqueda((actual) => actual + 1);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar la categoría.",
            );
        } finally {
            setGuardando(false);
        }
    }

    async function cambiarEstado(categoria: Categoria) {
        setCargando(true);
        setError("");
        setMensaje("");

        try {
            await apiRequest(`/categorias/${categoria.id}/estado`, "PATCH", {
                activo: !categoria.activo,
            });
            setMensaje(
                categoria.activo
                    ? "La categoría se desactivó."
                    : "La categoría se activó.",
            );
            setRevisionBusqueda((actual) => actual + 1);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo cambiar el estado de la categoría.",
            );
            setCargando(false);
        }
    }

    function updateField(campo: keyof FormularioCategoria, valor: string) {
        setDatosFormulario((actual) => ({ ...actual, [campo]: valor }));
    }

    return (
        <>
            <div className="mx-auto w-full max-w-6xl">
                <header className="flex flex-col justify-between gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-sm font-medium text-indigo-300">
                            Inventario
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                            Categorías
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Organiza tus productos por tipo o familia.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                        <p className="text-sm text-slate-500">
                            {paginacion.total}{" "}
                            {paginacion.total === 1 ? "categoría" : "categorías"}
                        </p>
                        <button
                            type="button"
                            onClick={abrirNuevo}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400"
                        >
                            <Plus className="size-4" />
                            Nueva categoría
                        </button>
                    </div>
                </header>

                <section className="py-8">
                    <form
                        onSubmit={buscar}
                        className="mt-7 flex max-w-xl gap-2"
                        role="search"
                    >
                        <label className="relative block flex-1">
                            <span className="sr-only">Buscar categorías</span>
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                            <input
                                value={busqueda}
                                onChange={(evento) =>
                                    setBusqueda(evento.target.value)
                                }
                                placeholder="Nombre o descripción"
                                className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-slate-600 focus:border-indigo-400/70"
                            />
                        </label>
                        <button
                            type="submit"
                            className="rounded-lg border border-white/10 px-4 text-sm font-medium text-slate-300 transition hover:bg-white/5"
                        >
                            Buscar
                        </button>
                    </form>

                    {error && (
                        <div
                            role="alert"
                            className="mt-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.07] p-3 text-sm text-red-300"
                        >
                            <CircleAlert className="size-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    {mensaje && !error && (
                        <p
                            role="status"
                            className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] p-3 text-sm text-emerald-300"
                        >
                            {mensaje}
                        </p>
                    )}

                    <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                        <p className="px-5 py-2 text-xs text-slate-400 sm:hidden">
                            Desliza horizontalmente para ver todas las columnas.
                        </p>
                        <div
                            className="overflow-x-auto"
                            role="region"
                            aria-label="Tabla de categorías; desplazamiento horizontal"
                            tabIndex={0}
                        >
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="border-b border-white/[0.08] bg-white/[0.025] text-xs font-medium uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">Categoría</th>
                                        <th className="px-5 py-4">Descripción</th>
                                        <th className="px-5 py-4">Estado</th>
                                        <th className="px-5 py-4 text-right">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {cargando ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-5 py-14 text-center text-slate-400"
                                            >
                                                <LoaderCircle className="mx-auto size-5 animate-spin" />
                                                <span className="mt-3 block">
                                                    Cargando categorías...
                                                </span>
                                            </td>
                                        </tr>
                                    ) : categorias.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-5 py-14 text-center"
                                            >
                                                <Tag className="mx-auto size-6 text-slate-600" />
                                                <p className="mt-3 font-medium text-slate-300">
                                                    {termino
                                                        ? "No hay categorías que coincidan con la búsqueda."
                                                        : "Todavía no tienes categorías."}
                                                </p>
                                                {!termino && (
                                                    <button
                                                        type="button"
                                                        onClick={abrirNuevo}
                                                        className="mt-3 text-sm text-indigo-300 hover:text-indigo-200"
                                                    >
                                                        Agregar la primera categoría
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        categorias.map((categoria) => (
                                            <tr
                                                key={categoria.id}
                                                className="text-slate-300"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-foreground">
                                                        {categoria.nombre}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Añadida{" "}
                                                        {new Intl.DateTimeFormat(
                                                            "es",
                                                            {
                                                                dateStyle:
                                                                    "medium",
                                                            },
                                                        ).format(
                                                            new Date(
                                                                categoria.creadaEn,
                                                            ),
                                                        )}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {categoria.descripcion || "—"}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs ${
                                                            categoria.activo
                                                                ? "bg-emerald-500/10 text-emerald-300"
                                                                : "bg-slate-500/10 text-slate-400"
                                                        }`}
                                                    >
                                                        {categoria.activo
                                                            ? "Activa"
                                                            : "Inactiva"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirEdicion(
                                                                    categoria,
                                                                )
                                                            }
                                                            aria-label={`Editar ${categoria.nombre}`}
                                                            className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void cambiarEstado(
                                                                    categoria,
                                                                )
                                                            }
                                                            aria-label={`${categoria.activo ? "Desactivar" : "Activar"} ${categoria.nombre}`}
                                                            className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                                                        >
                                                            {categoria.activo ? (
                                                                <Ban className="size-4" />
                                                            ) : (
                                                                <Tag className="size-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {paginacion.totalPaginas > 1 && (
                        <div className="mt-6 flex items-center justify-between gap-3 text-sm text-slate-400">
                            <button
                                type="button"
                                onClick={() =>
                                    setPaginacion((actual) => ({
                                        ...actual,
                                        pagina: Math.max(1, actual.pagina - 1),
                                    }))
                                }
                                disabled={paginacion.pagina === 1}
                                className="rounded-lg border border-white/10 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Anterior
                            </button>
                            <span>
                                Página {paginacion.pagina} de {paginacion.totalPaginas}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setPaginacion((actual) => ({
                                        ...actual,
                                        pagina: Math.min(
                                            actual.totalPaginas || 1,
                                            actual.pagina + 1,
                                        ),
                                    }))
                                }
                                disabled={
                                    paginacion.pagina >= paginacion.totalPaginas
                                }
                                className="rounded-lg border border-white/10 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </section>
            </div>

            {modalAbierto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    role="presentation"
                    onKeyDown={(evento) => {
                        if (evento.key === "Escape") {
                            cerrarFormulario();
                            return;
                        }

                        if (evento.key !== "Tab") return;

                        const elementosEnfocables = Array.from(
                            evento.currentTarget.querySelectorAll<HTMLElement>(
                                'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
                            ),
                        ).filter(
                            (elemento) => elemento.offsetParent !== null,
                        );
                        const primero = elementosEnfocables[0];
                        const ultimo =
                            elementosEnfocables[
                                elementosEnfocables.length - 1
                            ];

                        if (!primero || !ultimo) {
                            evento.preventDefault();
                        } else if (
                            evento.shiftKey &&
                            document.activeElement === primero
                        ) {
                            evento.preventDefault();
                            ultimo.focus();
                        } else if (
                            !evento.shiftKey &&
                            document.activeElement === ultimo
                        ) {
                            evento.preventDefault();
                            primero.focus();
                        }
                    }}
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) {
                            cerrarFormulario();
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="category-form-title"
                        className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-surface p-6 shadow-2xl"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-indigo-300">
                                    {categoriaEditando ? "Editar categoría" : "Nueva categoría"}
                                </p>
                                <h2 id="category-form-title" className="mt-1 text-xl font-semibold text-foreground">
                                    {categoriaEditando
                                        ? categoriaEditando.nombre
                                        : "Crear categoría"}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={cerrarFormulario}
                                aria-label="Cerrar formulario"
                                className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={guardarCategoria} className="mt-6 space-y-4">
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-slate-300">
                                    Nombre
                                </span>
                                <input
                                    autoFocus
                                    value={datosFormulario.nombre}
                                    onChange={(evento) =>
                                        updateField("nombre", evento.target.value)
                                    }
                                    required
                                    maxLength={80}
                                    placeholder="Ej. Electrónica"
                                    className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-slate-500 focus:border-indigo-400/70"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-slate-300">
                                    Descripción
                                </span>
                                <textarea
                                    value={datosFormulario.descripcion}
                                    onChange={(evento) =>
                                        updateField(
                                            "descripcion",
                                            evento.target.value,
                                        )
                                    }
                                    maxLength={300}
                                    rows={4}
                                    placeholder="Describe el tipo de productos que agrupa esta categoría"
                                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-slate-500 focus:border-indigo-400/70"
                                />
                            </label>

                            {error && (
                                <p className="rounded-lg border border-red-500/20 bg-red-500/[0.07] p-3 text-sm text-red-300">
                                    {error}
                                </p>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={cerrarFormulario}
                                    className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-on-accent transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {guardando
                                        ? "Guardando..."
                                        : categoriaEditando
                                          ? "Guardar cambios"
                                          : "Crear categoría"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
}
