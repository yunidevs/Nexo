"use client";

import {
    Ban,
    CircleAlert,
    Eye,
    LoaderCircle,
    Package,
    Pencil,
    Plus,
    Search,
    Trash2,
    TriangleAlert,
    X,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";
import { usePerfilWorkspace } from "@/app/components/workspace-shell";
import { esUrlImagenValida } from "@/app/components/marketplace/imagen-producto";

interface Producto {
    id: string;
    sku: string;
    nombre: string;
    precioVenta: string | number;
    costo: string | number;
    stockMinimo: number;
    categoria: string | null;
    imagenUrl: string | null;
    activo: boolean;
    publicadoMarketplace: boolean;
    creadaEn: string;
}

interface Categoria {
    id: string;
    nombre: string;
    activo: boolean;
}

interface Paginacion {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
}

interface FormularioProducto {
    sku: string;
    nombre: string;
    precioVenta: string;
    costo: string;
    stockMinimo: string;
    categoria: string;
    imagenUrl: string;
}

interface ResultadoPublicacionMarketplace {
    publicado: boolean;
    visible: boolean;
    requisitosPendientes: string[];
}

interface ResultadoEliminacionProducto {
    id: string;
    sku: string;
    nombre: string;
    modo: "eliminado" | "archivado";
    dependencias: string[];
}

function esResultadoEliminacionProducto(
    valor: unknown,
): valor is ResultadoEliminacionProducto {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "modo" in valor &&
        (valor.modo === "eliminado" || valor.modo === "archivado") &&
        "dependencias" in valor &&
        Array.isArray(valor.dependencias) &&
        valor.dependencias.every(
            (dependencia) => typeof dependencia === "string",
        )
    );
}

const formularioVacio: FormularioProducto = {
    sku: "",
    nombre: "",
    precioVenta: "",
    costo: "",
    stockMinimo: "0",
    categoria: "",
    imagenUrl: "",
};

function esProducto(valor: unknown): valor is Producto {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "sku" in valor &&
        typeof valor.sku === "string" &&
        "nombre" in valor &&
        typeof valor.nombre === "string" &&
        "precioVenta" in valor &&
        (typeof valor.precioVenta === "string" ||
            typeof valor.precioVenta === "number") &&
        "costo" in valor &&
        (typeof valor.costo === "string" || typeof valor.costo === "number") &&
        "stockMinimo" in valor &&
        typeof valor.stockMinimo === "number" &&
        "categoria" in valor &&
        (typeof valor.categoria === "string" || valor.categoria === null) &&
        "imagenUrl" in valor &&
        (typeof valor.imagenUrl === "string" || valor.imagenUrl === null) &&
        "activo" in valor &&
        typeof valor.activo === "boolean" &&
        "publicadoMarketplace" in valor &&
        typeof valor.publicadoMarketplace === "boolean" &&
        "creadaEn" in valor &&
        typeof valor.creadaEn === "string"
    );
}

function esCategoria(valor: unknown): valor is Categoria {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "nombre" in valor &&
        typeof valor.nombre === "string" &&
        "activo" in valor &&
        typeof valor.activo === "boolean"
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

function esResultadoProductos(
    valor: unknown,
): valor is { datos: Producto[]; paginacion: Paginacion } {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "datos" in valor &&
        Array.isArray(valor.datos) &&
        valor.datos.every(esProducto) &&
        "paginacion" in valor &&
        esPaginacion(valor.paginacion)
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

function esResultadoPublicacionMarketplace(
    valor: unknown,
): valor is ResultadoPublicacionMarketplace {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "publicado" in valor &&
        typeof valor.publicado === "boolean" &&
        "visible" in valor &&
        typeof valor.visible === "boolean" &&
        "requisitosPendientes" in valor &&
        Array.isArray(valor.requisitosPendientes) &&
        valor.requisitosPendientes.every(
            (requisito) => typeof requisito === "string",
        )
    );
}

async function obtenerCategorias(): Promise<Categoria[]> {
    const parametros = new URLSearchParams({ pagina: "1", limite: "100" });
    const primeraRespuesta = await apiRequest(
        `/categorias?${parametros.toString()}`,
    );

    if (!esResultadoCategorias(primeraRespuesta)) {
        throw new Error("La API devolvió una lista de categorías no válida.");
    }

    const paginasRestantes = await Promise.all(
        Array.from(
            { length: Math.max(primeraRespuesta.paginacion.totalPaginas - 1, 0) },
            (_, indice) => {
                const parametrosPagina = new URLSearchParams({
                    pagina: String(indice + 2),
                    limite: "100",
                });
                return apiRequest(`/categorias?${parametrosPagina.toString()}`);
            },
        ),
    );
    const categorias = paginasRestantes.flatMap((respuesta) => {
        if (!esResultadoCategorias(respuesta)) {
            throw new Error("La API devolvió una lista de categorías no válida.");
        }
        return respuesta.datos;
    });

    return [...primeraRespuesta.datos, ...categorias];
}

function formatearImporte(valor: string | number) {
    return new Intl.NumberFormat("es", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(valor));
}

export default function PaginaProductos() {
    const perfil = usePerfilWorkspace();
    const [productos, setProductos] = useState<Producto[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [categoriasCargando, setCategoriasCargando] = useState(true);
    const [errorCategorias, setErrorCategorias] = useState("");
    const [agruparPorCategoria, setAgruparPorCategoria] = useState(false);
    const [paginacion, setPaginacion] = useState<Paginacion>({
        pagina: 1,
        limite: 10,
        total: 0,
        totalPaginas: 0,
    });
    const [busqueda, setBusqueda] = useState("");
    const [termino, setTermino] = useState("");
    const [revision, setRevision] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [avisoPublicacion, setAvisoPublicacion] = useState(false);
    const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
    const [modalFormularioAbierto, setModalFormularioAbierto] = useState(false);
    const [productoConsultado, setProductoConsultado] = useState<Producto | null>(null);
    const [cargandoConsulta, setCargandoConsulta] = useState(false);
    const [publicandoId, setPublicandoId] = useState("");
    const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const [errorEliminacion, setErrorEliminacion] = useState("");
    const [datosFormulario, setDatosFormulario] = useState<FormularioProducto>(formularioVacio);

    // Solo un administrador puede eliminar productos: la API lo exige y el
    // botón se oculta para el resto de los roles.
    const puedeEliminar = perfil?.rol === "ADMINISTRADOR";

    useEffect(() => {
        let cancelada = false;

        async function cargarCategorias() {
            try {
                const resultado = await obtenerCategorias();
                if (!cancelada) {
                    setCategorias(resultado);
                    setErrorCategorias("");
                }
            } catch (error) {
                if (!cancelada) {
                    setErrorCategorias(
                        error instanceof Error
                            ? error.message
                            : "No se pudieron cargar las categorías.",
                    );
                }
            } finally {
                if (!cancelada) setCategoriasCargando(false);
            }
        }

        void cargarCategorias();

        return () => {
            cancelada = true;
        };
    }, []);

    useEffect(() => {
        let cancelada = false;

        async function cargar() {
            try {
                const parametros = new URLSearchParams({
                    pagina: String(paginacion.pagina),
                    limite: String(paginacion.limite),
                    buscar: termino,
                });
                const resultado = await apiRequest(
                    `/productos?${parametros.toString()}`,
                );

                if (!esResultadoProductos(resultado)) {
                    throw new Error(
                        "La API devolvió una lista de productos no válida.",
                    );
                }

                if (!cancelada) {
                    setProductos(resultado.datos);
                    setPaginacion(resultado.paginacion);
                    setError("");
                }
            } catch (error) {
                if (!cancelada) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "No se pudieron cargar los productos.",
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
    }, [paginacion.limite, paginacion.pagina, revision, termino]);

    function buscar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setCargando(true);
        setError("");
        setPaginacion((actual) => ({ ...actual, pagina: 1 }));
        setTermino(busqueda.trim());
        setRevision((actual) => actual + 1);
    }

    function abrirNuevo() {
        setProductoEditando(null);
        setDatosFormulario(formularioVacio);
        setError("");
        setModalFormularioAbierto(true);
    }

    function abrirEdicion(producto: Producto) {
        setProductoEditando(producto);
        setDatosFormulario({
            sku: producto.sku,
            nombre: producto.nombre,
            precioVenta: String(producto.precioVenta),
            costo: String(producto.costo),
            stockMinimo: String(producto.stockMinimo),
            categoria: producto.categoria ?? "",
            imagenUrl: producto.imagenUrl ?? "",
        });
        setError("");
        setModalFormularioAbierto(true);
    }

    async function consultarProducto(producto: Producto) {
        setCargandoConsulta(true);
        setProductoConsultado(null);
        setError("");

        try {
            const resultado = await apiRequest(`/productos/${producto.id}`);
            if (
                typeof resultado !== "object" ||
                resultado === null ||
                !("producto" in resultado) ||
                !esProducto(resultado.producto)
            ) {
                throw new Error("La API devolvió un producto no válido.");
            }
            setProductoConsultado(resultado.producto);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo consultar el producto.",
            );
        } finally {
            setCargandoConsulta(false);
        }
    }

    async function guardarProducto(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");
        setAvisoPublicacion(false);

        const datos = {
            sku: datosFormulario.sku.trim(),
            nombre: datosFormulario.nombre.trim(),
            precioVenta: Number(datosFormulario.precioVenta),
            costo: Number(datosFormulario.costo),
            stockMinimo: Number(datosFormulario.stockMinimo),
            categoria: datosFormulario.categoria.trim(),
            imagenUrl: datosFormulario.imagenUrl.trim(),
        };

        try {
            await apiRequest(
                productoEditando ? `/productos/${productoEditando.id}` : "/productos",
                productoEditando ? "PATCH" : "POST",
                datos,
            );
            setModalFormularioAbierto(false);
            setMensaje(
                productoEditando
                    ? "Los datos del producto se actualizaron."
                    : "El producto se creó correctamente.",
            );
            setCargando(true);
            setRevision((actual) => actual + 1);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar el producto.",
            );
        } finally {
            setGuardando(false);
        }
    }

    async function cambiarEstado(producto: Producto) {
        setCargando(true);
        setError("");
        setMensaje("");
        setAvisoPublicacion(false);

        try {
            await apiRequest(`/productos/${producto.id}/estado`, "PATCH", {
                activo: !producto.activo,
            });
            setMensaje(
                producto.activo
                    ? "El producto se desactivó."
                    : "El producto se activó.",
            );
            setRevision((actual) => actual + 1);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo cambiar el estado del producto.",
            );
            setCargando(false);
        }
    }

    async function cambiarPublicacionMarketplace(producto: Producto) {
        setPublicandoId(producto.id);
        setError("");
        setMensaje("");
        setAvisoPublicacion(false);
        try {
            const resultado = await apiRequest(
                `/marketplace/gestion/productos/${producto.id}/publicacion`,
                "PATCH",
                { publicado: !producto.publicadoMarketplace },
            );
            if (!esResultadoPublicacionMarketplace(resultado)) {
                throw new Error(
                    "La API devolvió un estado de publicación no válido.",
                );
            }
            if (!resultado.publicado) {
                setMensaje("El producto dejó de mostrarse en el marketplace.");
            } else if (resultado.visible) {
                setMensaje("El producto se publicó en el marketplace.");
            } else {
                setMensaje(
                    `El producto se marcó para publicarse, pero aún no aparece: ${resultado.requisitosPendientes.join("; ")}.`,
                );
                setAvisoPublicacion(true);
            }
            setRevision((actual) => actual + 1);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo cambiar la publicación del producto.",
            );
        } finally {
            setPublicandoId("");
        }
    }

    function actualizarCampo(campo: keyof FormularioProducto, valor: string) {
        setDatosFormulario((actual) => ({ ...actual, [campo]: valor }));
    }

    function abrirEliminacion(producto: Producto) {
        setProductoAEliminar(producto);
        setErrorEliminacion("");
        setError("");
        setMensaje("");
    }

    function cerrarEliminacion() {
        if (eliminando) return;
        setProductoAEliminar(null);
        setErrorEliminacion("");
    }

    async function eliminarProducto() {
        if (!productoAEliminar) return;

        setEliminando(true);
        setErrorEliminacion("");

        try {
            const resultado = await apiRequest(
                `/productos/${productoAEliminar.id}`,
                "DELETE",
            );
            if (!esResultadoEliminacionProducto(resultado)) {
                throw new Error(
                    "La API devolvió un resultado de eliminación no válido.",
                );
            }

            setProductoAEliminar(null);
            setCargando(true);
            setRevision((actual) => actual + 1);

            if (resultado.modo === "eliminado") {
                setAvisoPublicacion(false);
                setMensaje(
                    `El producto ${resultado.nombre} se eliminó correctamente.`,
                );
            } else {
                setAvisoPublicacion(true);
                setMensaje(
                    `El producto ${resultado.nombre} se archivó porque conserva ${resultado.dependencias.join(", ")}. Se despublicó y dejó de ofrecerse, pero su historial permanece intacto.`,
                );
            }
        } catch (error) {
            setErrorEliminacion(
                error instanceof Error
                    ? error.message
                    : "No se pudo eliminar el producto.",
            );
        } finally {
            setEliminando(false);
        }
    }

    function renderizarTarjeta(producto: Producto) {
        return (
            <article
                key={producto.id}
                className="flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-indigo-400/30 hover:bg-white/[0.04]"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        {producto.imagenUrl ? (
                            <MiniaturaProducto
                                url={producto.imagenUrl}
                                alt={producto.nombre}
                            />
                        ) : (
                            <span
                                aria-hidden="true"
                                className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-400"
                            >
                                <Package className="size-5" />
                            </span>
                        )}
                        <div className="min-w-0">
                            <h3 className="truncate font-semibold text-foreground">
                                {producto.nombre}
                            </h3>
                            <p className="mt-1 truncate text-xs text-slate-500">
                                SKU: {producto.sku}
                            </p>
                        </div>
                    </div>
                    <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                            producto.activo
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-slate-500/10 text-slate-400"
                        }`}
                    >
                        {producto.activo ? "Activo" : "Inactivo"}
                    </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-indigo-400/15 bg-indigo-400/[0.07] px-2.5 py-1 text-xs text-indigo-200">
                        {producto.categoria || "Sin categoría"}
                    </span>
                    {producto.imagenUrl && (
                        <a
                            href={producto.imagenUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-400 hover:text-indigo-300"
                        >
                            Ver imagen
                        </a>
                    )}
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
                    <div>
                        <dt className="text-xs text-slate-500">Precio</dt>
                        <dd className="mt-1 text-sm font-medium text-foreground">
                            {formatearImporte(producto.precioVenta)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-slate-500">Costo</dt>
                        <dd className="mt-1 text-sm text-slate-300">
                            {formatearImporte(producto.costo)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-slate-500">Stock mín.</dt>
                        <dd className="mt-1 text-sm text-slate-300">
                            {producto.stockMinimo}
                        </dd>
                    </div>
                </dl>

                <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                    <input
                        type="checkbox"
                        checked={producto.publicadoMarketplace}
                        disabled={
                            publicandoId === producto.id || !producto.activo
                        }
                        onChange={() =>
                            void cambiarPublicacionMarketplace(producto)
                        }
                        className="size-4 accent-indigo-500"
                    />
                    {publicandoId === producto.id
                        ? "Actualizando..."
                        : "Mostrar en el marketplace"}
                </label>

                <div className="mt-5 flex justify-end gap-2 border-t border-white/[0.06] pt-4">
                    <button
                        type="button"
                        onClick={() => void consultarProducto(producto)}
                        aria-label={`Consultar ${producto.nombre}`}
                        className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                    >
                        <Eye className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => abrirEdicion(producto)}
                        aria-label={`Editar ${producto.nombre}`}
                        className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                    >
                        <Pencil className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => void cambiarEstado(producto)}
                        aria-label={
                            producto.activo
                                ? `Desactivar ${producto.nombre}`
                                : `Activar ${producto.nombre}`
                        }
                        className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                    >
                        <Ban className="size-4" />
                    </button>
                    {puedeEliminar && (
                        <button
                            type="button"
                            onClick={() => abrirEliminacion(producto)}
                            aria-label={`Eliminar ${producto.nombre}`}
                            title="Eliminar producto"
                            className="rounded-md border border-red-800/20 p-2 text-red-800 transition hover:border-red-800 hover:bg-red-800 hover:text-white/80"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    )}
                </div>
            </article>
        );
    }

    const gruposProductos = Array.from(
        productos.reduce((grupos, producto) => {
            const categoria = producto.categoria?.trim() || "Sin categoría";
            const productosCategoria = grupos.get(categoria) ?? [];
            productosCategoria.push(producto);
            grupos.set(categoria, productosCategoria);
            return grupos;
        }, new Map<string, Producto[]>()),
    ).sort(([categoriaA], [categoriaB]) => categoriaA.localeCompare(categoriaB));

    return (
        <>
            <div className="mx-auto w-full max-w-6xl">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
                    <div>
                        <p className="text-sm font-medium text-indigo-300">Inventario</p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                            Productos
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Administra precios, costos y niveles mínimos de stock.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={abrirNuevo}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400"
                    >
                        <Plus className="size-4" />
                        Nuevo producto
                    </button>
                </header>

                <section className="py-8">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm text-slate-400">
                                Busca por nombre, SKU o categoría.
                            </p>
                        </div>
                        <p className="text-sm text-slate-500">
                            {paginacion.total}{" "}
                            {paginacion.total === 1 ? "producto" : "productos"}
                        </p>
                    </div>

                    <form
                        onSubmit={buscar}
                        className="mt-5 flex max-w-xl gap-2"
                        role="search"
                    >
                        <label className="relative block flex-1">
                            <span className="sr-only">Buscar productos</span>
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                            <input
                                value={busqueda}
                                onChange={(evento) => setBusqueda(evento.target.value)}
                                placeholder="Nombre, SKU o categoría"
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
                    {errorCategorias && (
                        <div
                            role="alert"
                            className="mt-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.07] p-3 text-sm text-red-300"
                        >
                            <CircleAlert className="size-4 shrink-0" />
                            {errorCategorias}
                        </div>
                    )}
                    {mensaje && !error && (
                        <p
                            role="status"
                            className={`mt-5 rounded-lg border p-3 text-sm ${
                                avisoPublicacion
                                    ? "border-amber-500/20 bg-amber-500/[0.07] text-amber-300"
                                    : "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
                            }`}
                        >
                            {mensaje}
                        </p>
                    )}

                    <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                        <div>
                            <p className="text-sm font-medium text-foreground">
                                Agrupar por categoría
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {agruparPorCategoria
                                    ? "Los productos se muestran agrupados por categoría."
                                    : "Los productos se muestran en una sola lista."}
                            </p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-3">
                            <span className="text-sm text-slate-300">Agrupar</span>
                            <input
                                type="checkbox"
                                checked={agruparPorCategoria}
                                onChange={(evento) =>
                                    setAgruparPorCategoria(evento.target.checked)
                                }
                                className="size-4 accent-indigo-500"
                                aria-label="Agrupar productos por categoría"
                            />
                        </label>
                    </div>

                    {cargando ? (
                        <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-14 text-center text-slate-400">
                            <LoaderCircle className="mx-auto size-5 animate-spin" />
                            <span className="mt-3 block">Cargando productos...</span>
                        </div>
                    ) : productos.length === 0 ? (
                        <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-14 text-center">
                            <Package className="mx-auto size-6 text-slate-600" />
                            <p className="mt-3 font-medium text-slate-300">
                                {termino
                                    ? "No hay productos que coincidan con la búsqueda."
                                    : "Todavía no tienes productos."}
                            </p>
                            {!termino && (
                                <button
                                    type="button"
                                    onClick={abrirNuevo}
                                    className="mt-3 text-sm text-indigo-300 hover:text-indigo-200"
                                >
                                    Agregar el primer producto
                                </button>
                            )}
                        </div>
                    ) : agruparPorCategoria ? (
                        <div className="mt-6 space-y-8">
                            {gruposProductos.map(([categoria, productosCategoria]) => (
                                <section key={categoria}>
                                    <div className="mb-3 flex items-center justify-between">
                                        <h2 className="text-sm font-semibold text-slate-200">
                                            {categoria}
                                        </h2>
                                        <span className="text-xs text-slate-500">
                                            {productosCategoria.length}{" "}
                                            {productosCategoria.length === 1
                                                ? "producto"
                                                : "productos"}
                                        </span>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                        {productosCategoria.map(renderizarTarjeta)}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {productos.map(renderizarTarjeta)}
                        </div>
                    )}

                    <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                        <span>
                            Página {paginacion.pagina} de {Math.max(paginacion.totalPaginas, 1)}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={paginacion.pagina <= 1 || cargando}
                                onClick={() => {
                                    setCargando(true);
                                    setPaginacion((actual) => ({
                                        ...actual,
                                        pagina: actual.pagina - 1,
                                    }));
                                }}
                                className="rounded-lg border border-white/10 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                disabled={
                                    paginacion.pagina >= paginacion.totalPaginas || cargando
                                }
                                onClick={() => {
                                    setCargando(true);
                                    setPaginacion((actual) => ({
                                        ...actual,
                                        pagina: actual.pagina + 1,
                                    }));
                                }}
                                className="rounded-lg border border-white/10 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {modalFormularioAbierto && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4"
                    role="presentation"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) {
                            setModalFormularioAbierto(false);
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="producto-form-title"
                        className="my-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 id="producto-form-title" className="text-xl font-semibold text-foreground">
                                    {productoEditando ? "Editar producto" : "Nuevo producto"}
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    Completa los datos comerciales y de stock.
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Cerrar formulario"
                                onClick={() => setModalFormularioAbierto(false)}
                                className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-foreground"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={guardarProducto} className="mt-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="text-sm text-slate-300">
                                    SKU
                                    <input
                                        required
                                        maxLength={80}
                                        value={datosFormulario.sku}
                                        onChange={(evento) =>
                                            actualizarCampo("sku", evento.target.value)
                                        }
                                        className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-foreground outline-none focus:border-indigo-400/70"
                                    />
                                </label>
                                <label className="text-sm text-slate-300">
                                    Nombre
                                    <input
                                        required
                                        minLength={2}
                                        maxLength={120}
                                        value={datosFormulario.nombre}
                                        onChange={(evento) =>
                                            actualizarCampo("nombre", evento.target.value)
                                        }
                                        className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-foreground outline-none focus:border-indigo-400/70"
                                    />
                                </label>
                                <label className="text-sm text-slate-300">
                                    Precio de venta
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        max="9999999999.99"
                                        step="0.01"
                                        value={datosFormulario.precioVenta}
                                        onChange={(evento) =>
                                            actualizarCampo("precioVenta", evento.target.value)
                                        }
                                        className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-foreground outline-none focus:border-indigo-400/70"
                                    />
                                </label>
                                <label className="text-sm text-slate-300">
                                    Costo
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        max="9999999999.99"
                                        step="0.01"
                                        value={datosFormulario.costo}
                                        onChange={(evento) =>
                                            actualizarCampo("costo", evento.target.value)
                                        }
                                        className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-foreground outline-none focus:border-indigo-400/70"
                                    />
                                </label>
                                <label className="text-sm text-slate-300">
                                    Stock mínimo
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={datosFormulario.stockMinimo}
                                        onChange={(evento) =>
                                            actualizarCampo("stockMinimo", evento.target.value)
                                        }
                                        className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-foreground outline-none focus:border-indigo-400/70"
                                    />
                                </label>
                                <label className="text-sm text-slate-300">
                                    Categoría
                                    <select
                                        value={datosFormulario.categoria}
                                        onChange={(evento) =>
                                            actualizarCampo("categoria", evento.target.value)
                                        }
                                        disabled={categoriasCargando || Boolean(errorCategorias)}
                                        className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-surface px-3 text-foreground outline-none focus:border-indigo-400/70 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <option value="">
                                            {categoriasCargando
                                                ? "Cargando categorías..."
                                                : categorias.length
                                                  ? "Sin categoría"
                                                  : "No hay categorías"}
                                        </option>
                                        {datosFormulario.categoria &&
                                            !categorias.some(
                                                (categoria) =>
                                                    categoria.nombre ===
                                                    datosFormulario.categoria,
                                            ) && (
                                                <option value={datosFormulario.categoria}>
                                                    {datosFormulario.categoria}
                                                </option>
                                            )}
                                        {categorias.map((categoria) => (
                                            <option
                                                key={categoria.id}
                                                value={categoria.nombre}
                                            >
                                                {categoria.nombre}
                                                {!categoria.activo ? " (inactiva)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                    {errorCategorias && (
                                        <span className="mt-1.5 block text-xs text-red-300">
                                            {errorCategorias}
                                        </span>
                                    )}
                                </label>
                                <label className="text-sm text-slate-300 sm:col-span-2">
                                    URL de imagen
                                    <input
                                        type="url"
                                        maxLength={2048}
                                        placeholder="https://ejemplo.com/imagen.jpg"
                                        value={datosFormulario.imagenUrl}
                                        onChange={(evento) =>
                                            actualizarCampo("imagenUrl", evento.target.value)
                                        }
                                        className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-foreground outline-none placeholder:text-slate-600 focus:border-indigo-400/70"
                                    />
                                </label>
                            </div>
                            {error && (
                                <p role="alert" className="mt-4 text-sm text-red-300">
                                    {error}
                                </p>
                            )}
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalFormularioAbierto(false)}
                                    className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                >
                                    {guardando
                                        ? "Guardando..."
                                        : productoEditando
                                          ? "Guardar cambios"
                                          : "Crear producto"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {(productoConsultado || cargandoConsulta) && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="producto-detail-title"
                        className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl"
                    >
                        {cargandoConsulta ? (
                            <div className="py-10 text-center text-slate-400">
                                <LoaderCircle className="mx-auto size-6 animate-spin" />
                                <p className="mt-3">Consultando producto...</p>
                            </div>
                        ) : (
                            productoConsultado && (
                                <>
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm text-indigo-300">
                                                SKU {productoConsultado.sku}
                                            </p>
                                            <h2 id="producto-detail-title" className="mt-1 text-xl font-semibold text-foreground">
                                                {productoConsultado.nombre}
                                            </h2>
                                        </div>
                                        <button
                                            type="button"
                                            aria-label="Cerrar consulta"
                                            onClick={() => setProductoConsultado(null)}
                                            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-foreground"
                                        >
                                            <X className="size-5" />
                                        </button>
                                    </div>
                                    <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <dt className="text-slate-500">Precio de venta</dt>
                                            <dd className="mt-1 text-foreground">
                                                {formatearImporte(productoConsultado.precioVenta)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-500">Costo</dt>
                                            <dd className="mt-1 text-foreground">
                                                {formatearImporte(productoConsultado.costo)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-500">Stock mínimo</dt>
                                            <dd className="mt-1 text-foreground">
                                                {productoConsultado.stockMinimo}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-500">Categoría</dt>
                                            <dd className="mt-1 text-foreground">
                                                {productoConsultado.categoria || "—"}
                                            </dd>
                                        </div>
                                        <div className="col-span-2">
                                            <dt className="text-slate-500">Estado</dt>
                                            <dd className="mt-1 text-foreground">
                                                {productoConsultado.activo ? "Activo" : "Inactivo"}
                                            </dd>
                                        </div>
                                        {productoConsultado.imagenUrl && (
                                            <div className="col-span-2">
                                                <dt className="text-slate-500">Imagen</dt>
                                                <dd className="mt-1 space-y-2">
                                                    {esUrlImagenValida(
                                                        productoConsultado.imagenUrl,
                                                    ) && (
                                                        <MiniaturaProducto
                                                            url={productoConsultado.imagenUrl}
                                                            alt={productoConsultado.nombre}
                                                            className="h-44 w-full"
                                                            ajuste="object-contain"
                                                        />
                                                    )}
                                                    <a
                                                        href={productoConsultado.imagenUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block break-all text-indigo-300 hover:text-indigo-200"
                                                    >
                                                        Abrir imagen
                                                    </a>
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                </>
                            )
                        )}
                    </section>
                </div>
            )}

            {productoAEliminar && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4"
                    role="presentation"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) {
                            cerrarEliminacion();
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="producto-eliminar-title"
                        className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl"
                    >
                        <div className="flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-400/10 text-red-300"
                            >
                                <TriangleAlert className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <h2
                                    id="producto-eliminar-title"
                                    className="text-xl font-semibold text-foreground"
                                >
                                    Eliminar producto
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-slate-400">
                                    Vas a eliminar{" "}
                                    <span className="font-semibold text-foreground">
                                        {productoAEliminar.nombre}
                                    </span>{" "}
                                    (SKU {productoAEliminar.sku}). Esta acción
                                    no se puede deshacer.
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Cerrar confirmación"
                                onClick={cerrarEliminacion}
                                disabled={eliminando}
                                className="rounded-md p-1 text-slate-400 transition hover:bg-white/5 hover:text-foreground disabled:opacity-50"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm leading-6 text-red-200">
                            Si el producto ya tiene ventas, compras, pedidos o
                            movimientos de inventario, se archivará en lugar de
                            borrarse: dejará de ofrecerse, pero su historial
                            comercial se conserva intacto.
                        </p>

                        {errorEliminacion && (
                            <p
                                role="alert"
                                className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-sm text-rose-200"
                            >
                                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                                {errorEliminacion}
                            </p>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={cerrarEliminacion}
                                disabled={eliminando}
                                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => void eliminarProducto()}
                                disabled={eliminando}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {eliminando ? (
                                    <LoaderCircle className="size-4 animate-spin" />
                                ) : (
                                    <Trash2 className="size-4" />
                                )}
                                {eliminando
                                    ? "Eliminando..."
                                    : "Eliminar producto"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}

/* =============================================================
   MINIATURA DE IMAGEN DEL PRODUCTO
   ============================================================= */

interface MiniaturaProductoProps {
    url: string;
    alt: string;
    /** Clases de tamaño del contenedor (por defecto, la miniatura de tarjeta). */
    className?: string;
    /** Ajuste de la imagen dentro del contenedor. */
    ajuste?: string;
}

/**
 * Muestra la imagen cargada por la empresa como miniatura y la abre en tamaño
 * completo al hacer clic. La URL la escribe la propia empresa: si no apunta a
 * un archivo de imagen válido, o falla al cargar, se muestra el ícono
 * genérico de producto en su lugar.
 */
function MiniaturaProducto({
    url,
    alt,
    className = "size-11",
    ajuste = "object-cover",
}: MiniaturaProductoProps) {
    const [fallo, setFallo] = useState(false);

    if (!esUrlImagenValida(url) || fallo) {
        return (
            <span
                aria-hidden="true"
                className={`grid shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-400 ${className}`}
            >
                <Package className="size-5" />
            </span>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Ver imagen de ${alt}`}
            title="Ver imagen en tamaño completo"
            className={`relative block shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02] ${className}`}
        >
            <Image
                src={url}
                alt=""
                fill
                sizes="44px"
                unoptimized
                onError={() => setFallo(true)}
                className={ajuste}
            />
        </a>
    );
}
