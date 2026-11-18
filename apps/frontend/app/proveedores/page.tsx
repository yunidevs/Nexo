"use client";

import {
    Building2,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Clock3,
    Eye,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Truck,
    UserRound,
    UserRoundX,
    X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";

interface Proveedor {
    id: string;
    nombre: string;
    documento: string | null;
    telefono: string | null;
    correo: string | null;
    direccion: string | null;
    activo: boolean;
    creadaEn: string;
    actualizadaEn: string;
}

interface Paginacion {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
}

interface OperacionProveedor {
    id: string;
    tipo:
        | "CREADO"
        | "ACTUALIZADO"
        | "DESACTIVADO"
        | "ACTIVADO"
        | "COMPRA_REGISTRADA";
    detalle: string;
    fechaCompra: string | null;
    total: number | string | null;
    creadaEn: string;
    usuario: { nombre: string; apellido: string } | null;
}

interface FormularioProveedor {
    nombre: string;
    documento: string;
    telefono: string;
    correo: string;
    direccion: string;
}

interface FormularioCompra {
    fechaCompra: string;
    detalle: string;
    total: string;
}

const formularioVacio: FormularioProveedor = {
    nombre: "",
    documento: "",
    telefono: "",
    correo: "",
    direccion: "",
};

function esProveedor(valor: unknown): valor is Proveedor {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "nombre" in valor &&
        typeof valor.nombre === "string" &&
        "documento" in valor &&
        (typeof valor.documento === "string" || valor.documento === null) &&
        "telefono" in valor &&
        (typeof valor.telefono === "string" || valor.telefono === null) &&
        "correo" in valor &&
        (typeof valor.correo === "string" || valor.correo === null) &&
        "direccion" in valor &&
        (typeof valor.direccion === "string" || valor.direccion === null) &&
        "activo" in valor &&
        typeof valor.activo === "boolean" &&
        "creadaEn" in valor &&
        typeof valor.creadaEn === "string" &&
        "actualizadaEn" in valor &&
        typeof valor.actualizadaEn === "string"
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

function esResultadoProveedores(
    valor: unknown,
): valor is { datos: Proveedor[]; paginacion: Paginacion } {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "datos" in valor &&
        Array.isArray(valor.datos) &&
        valor.datos.every(esProveedor) &&
        "paginacion" in valor &&
        esPaginacion(valor.paginacion)
    );
}

function esOperacion(valor: unknown): valor is OperacionProveedor {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "tipo" in valor &&
        [
            "CREADO",
            "ACTUALIZADO",
            "DESACTIVADO",
            "ACTIVADO",
            "COMPRA_REGISTRADA",
        ].includes(String(valor.tipo)) &&
        "detalle" in valor &&
        typeof valor.detalle === "string" &&
        "fechaCompra" in valor &&
        (typeof valor.fechaCompra === "string" || valor.fechaCompra === null) &&
        "total" in valor &&
        (typeof valor.total === "string" ||
            typeof valor.total === "number" ||
            valor.total === null) &&
        "creadaEn" in valor &&
        typeof valor.creadaEn === "string" &&
        "usuario" in valor &&
        (valor.usuario === null ||
            (typeof valor.usuario === "object" &&
                valor.usuario !== null &&
                "nombre" in valor.usuario &&
                typeof valor.usuario.nombre === "string" &&
                "apellido" in valor.usuario &&
                typeof valor.usuario.apellido === "string"))
    );
}

function esResultadoOperaciones(
    valor: unknown,
): valor is { datos: OperacionProveedor[]; paginacion: Paginacion } {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "datos" in valor &&
        Array.isArray(valor.datos) &&
        valor.datos.every(esOperacion) &&
        "paginacion" in valor &&
        esPaginacion(valor.paginacion)
    );
}

function fechaLegible(valor: string) {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "Fecha no disponible";

    return new Intl.DateTimeFormat("es", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(fecha);
}

function hoyLocal() {
    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");
    return `${ahora.getFullYear()}-${mes}-${dia}`;
}

function etiquetaOperacion(tipo: OperacionProveedor["tipo"]) {
    const etiquetas: Record<OperacionProveedor["tipo"], string> = {
        CREADO: "Proveedor creado",
        ACTUALIZADO: "Datos actualizados",
        DESACTIVADO: "Proveedor desactivado",
        ACTIVADO: "Proveedor reactivado",
        COMPRA_REGISTRADA: "Compra registrada",
    };
    return etiquetas[tipo];
}

function Campo({
    id,
    etiqueta,
    valor,
    onChange,
    tipo = "text",
    requerido = false,
    maxLength,
    min,
    step,
}: {
    id: string;
    etiqueta: string;
    valor: string;
    onChange: (valor: string) => void;
    tipo?: string;
    requerido?: boolean;
    maxLength?: number;
    min?: string;
    step?: string;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-300">
                {etiqueta}
            </span>
            <input
                id={id}
                type={tipo}
                value={valor}
                required={requerido}
                maxLength={maxLength}
                min={min}
                step={step}
                onChange={(evento) => onChange(evento.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-surface px-3 text-sm text-foreground outline-none transition placeholder:text-slate-600 focus:border-indigo-400/70"
            />
        </label>
    );
}

export default function PaginaProveedores() {
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [paginacion, setPaginacion] = useState<Paginacion>({
        pagina: 1,
        limite: 10,
        total: 0,
        totalPaginas: 0,
    });
    const [busqueda, setBusqueda] = useState("");
    const [termino, setTermino] = useState("");
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [revision, setRevision] = useState(0);
    const [proveedorEditando, setProveedorEditando] =
        useState<Proveedor | null>(null);
    const [datosFormulario, setDatosFormulario] =
        useState<FormularioProveedor>(formularioVacio);
    const [modalFormularioAbierto, setModalFormularioAbierto] =
        useState(false);
    const [proveedorConsultado, setProveedorConsultado] =
        useState<Proveedor | null>(null);
    const [operaciones, setOperaciones] = useState<OperacionProveedor[]>([]);
    const [paginacionOperaciones, setPaginacionOperaciones] =
        useState<Paginacion>({
            pagina: 1,
            limite: 20,
            total: 0,
            totalPaginas: 0,
        });
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const [errorHistorial, setErrorHistorial] = useState("");
    const [compraAbierta, setCompraAbierta] = useState(false);
    const [guardandoCompra, setGuardandoCompra] = useState(false);
    const [errorCompra, setErrorCompra] = useState("");
    const [datosCompra, setDatosCompra] = useState<FormularioCompra>({
        fechaCompra: hoyLocal(),
        detalle: "",
        total: "",
    });

    useEffect(() => {
        let cancelada = false;

        async function cargarProveedores() {
            try {
                const parametros = new URLSearchParams({
                    pagina: String(paginacion.pagina),
                    limite: String(paginacion.limite),
                    buscar: termino,
                });
                const resultado = await apiRequest(
                    `/proveedores?${parametros.toString()}`,
                );

                if (!esResultadoProveedores(resultado)) {
                    throw new Error(
                        "La API devolvió una lista de proveedores no válida.",
                    );
                }

                if (!cancelada) {
                    setProveedores(resultado.datos);
                    setPaginacion(resultado.paginacion);
                    setError("");
                }
            } catch (error) {
                if (!cancelada) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "No se pudieron cargar los proveedores.",
                    );
                }
            } finally {
                if (!cancelada) setCargando(false);
            }
        }

        void cargarProveedores();
        return () => {
            cancelada = true;
        };
    }, [paginacion.limite, paginacion.pagina, revision, termino]);

    function buscar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setCargando(true);
        setPaginacion((actual) => ({ ...actual, pagina: 1 }));
        setTermino(busqueda.trim());
    }

    function abrirNuevo() {
        setProveedorEditando(null);
        setDatosFormulario(formularioVacio);
        setError("");
        setModalFormularioAbierto(true);
    }

    function abrirEdicion(proveedor: Proveedor) {
        setProveedorEditando(proveedor);
        setDatosFormulario({
            nombre: proveedor.nombre,
            documento: proveedor.documento ?? "",
            telefono: proveedor.telefono ?? "",
            correo: proveedor.correo ?? "",
            direccion: proveedor.direccion ?? "",
        });
        setError("");
        setModalFormularioAbierto(true);
    }

    async function guardarProveedor(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");

        try {
            await apiRequest(
                proveedorEditando
                    ? `/proveedores/${proveedorEditando.id}`
                    : "/proveedores",
                proveedorEditando ? "PATCH" : "POST",
                datosFormulario,
            );
            setModalFormularioAbierto(false);
            setCargando(true);
            setMensaje(
                proveedorEditando
                    ? "Los datos del proveedor se actualizaron."
                    : "El proveedor se creó correctamente.",
            );
            setPaginacion((actual) => ({ ...actual, pagina: 1 }));
            setTermino("");
            setBusqueda("");
            setRevision((actual) => actual + 1);
            if (
                proveedorEditando &&
                proveedorConsultado?.id === proveedorEditando.id
            ) {
                void consultarProveedor(proveedorEditando);
            }
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar el proveedor.",
            );
        } finally {
            setGuardando(false);
        }
    }

    async function cambiarEstado(proveedor: Proveedor) {
        setError("");
        setMensaje("");

        try {
            await apiRequest(`/proveedores/${proveedor.id}/estado`, "PATCH", {
                activo: !proveedor.activo,
            });
            setMensaje(
                proveedor.activo
                    ? "El proveedor se desactivó."
                    : "El proveedor se reactivó.",
            );
            setCargando(true);
            setRevision((actual) => actual + 1);
            if (proveedorConsultado?.id === proveedor.id) {
                void consultarProveedor(proveedor);
            }
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo cambiar el estado del proveedor.",
            );
        }
    }

    async function consultarProveedor(proveedor: Proveedor) {
        setProveedorConsultado(proveedor);
        setOperaciones([]);
        setPaginacionOperaciones((actual) => ({ ...actual, pagina: 1 }));
        setCargandoHistorial(true);
        setErrorHistorial("");
        setCompraAbierta(false);

        try {
            const [detalle, historial] = await Promise.all([
                apiRequest(`/proveedores/${proveedor.id}`),
                apiRequest(
                    `/proveedores/${proveedor.id}/historial?pagina=1&limite=${paginacionOperaciones.limite}`,
                ),
            ]);
            const proveedorDetalle =
                typeof detalle === "object" &&
                detalle !== null &&
                "proveedor" in detalle
                    ? detalle.proveedor
                    : null;

            if (!esProveedor(proveedorDetalle)) {
                throw new Error(
                    "La API devolvió datos de proveedor no válidos.",
                );
            }
            if (!esResultadoOperaciones(historial)) {
                throw new Error("La API devolvió un historial no válido.");
            }

            setProveedorConsultado(proveedorDetalle);
            setOperaciones(historial.datos);
            setPaginacionOperaciones(historial.paginacion);
        } catch (error) {
            setErrorHistorial(
                error instanceof Error
                    ? error.message
                    : "No se pudo cargar el historial del proveedor.",
            );
        } finally {
            setCargandoHistorial(false);
        }
    }

    async function cambiarPaginaHistorial(pagina: number) {
        if (!proveedorConsultado) return;
        setCargandoHistorial(true);
        setErrorHistorial("");

        try {
            const resultado = await apiRequest(
                `/proveedores/${proveedorConsultado.id}/historial?pagina=${pagina}&limite=${paginacionOperaciones.limite}`,
            );
            if (!esResultadoOperaciones(resultado)) {
                throw new Error("La API devolvió un historial no válido.");
            }
            setOperaciones(resultado.datos);
            setPaginacionOperaciones(resultado.paginacion);
        } catch (error) {
            setErrorHistorial(
                error instanceof Error
                    ? error.message
                    : "No se pudo cargar el historial del proveedor.",
            );
        } finally {
            setCargandoHistorial(false);
        }
    }

    async function registrarCompra(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!proveedorConsultado) return;
        setGuardandoCompra(true);
        setErrorCompra("");

        try {
            await apiRequest(
                `/proveedores/${proveedorConsultado.id}/compras`,
                "POST",
                {
                    ...datosCompra,
                    total: Number(datosCompra.total),
                },
            );
            setCompraAbierta(false);
            setDatosCompra({
                fechaCompra: hoyLocal(),
                detalle: "",
                total: "",
            });
            setPaginacionOperaciones((actual) => ({
                ...actual,
                pagina: 1,
            }));
            await consultarProveedor(proveedorConsultado);
            setMensaje("La compra se registró en el historial del proveedor.");
        } catch (error) {
            setErrorCompra(
                error instanceof Error
                    ? error.message
                    : "No se pudo registrar la compra.",
            );
        } finally {
            setGuardandoCompra(false);
        }
    }

    function actualizarCampo(
        campo: keyof FormularioProveedor,
        valor: string,
    ) {
        setDatosFormulario((actual) => ({ ...actual, [campo]: valor }));
    }

    return (
        <>
            <div className="mx-auto w-full max-w-6xl">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
                    <div>
                        <p className="text-sm font-medium text-indigo-300">
                            Compras y abastecimiento
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                            Proveedores
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Administra tus proveedores y consulta el historial
                            de cada operación.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={abrirNuevo}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400"
                    >
                        <Plus className="size-4" />
                        Nuevo proveedor
                    </button>
                </header>

                <section className="py-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-500">
                            {paginacion.total}{" "}
                            {paginacion.total === 1
                                ? "proveedor"
                                : "proveedores"}
                        </p>
                        <form
                            onSubmit={buscar}
                            className="flex w-full gap-2 sm:w-auto"
                            role="search"
                        >
                            <label className="relative block min-w-0 flex-1 sm:w-80">
                                <span className="sr-only">
                                    Buscar proveedores
                                </span>
                                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={busqueda}
                                    onChange={(evento) =>
                                        setBusqueda(evento.target.value)
                                    }
                                    placeholder="Nombre, documento o contacto"
                                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-slate-600 focus:border-indigo-400/70"
                                />
                            </label>
                            <button
                                type="submit"
                                className="rounded-lg border border-white/10 px-4 text-sm font-medium text-slate-300 transition hover:bg-white/5"
                            >
                                Buscar
                            </button>
                        </form>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="mt-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.07] p-3 text-sm text-red-300"
                        >
                            <CircleAlert className="size-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    {mensaje && (
                        <p
                            role="status"
                            className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] p-3 text-sm text-emerald-300"
                        >
                            {mensaje}
                        </p>
                    )}

                    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                        <p className="px-5 py-2 text-xs text-slate-400 sm:hidden">
                            Desliza horizontalmente para ver todas las columnas.
                        </p>
                        <div
                            className="overflow-x-auto"
                            role="region"
                            aria-label="Tabla de proveedores; desplazamiento horizontal"
                            tabIndex={0}
                        >
                            <table className="w-full min-w-[780px] text-left text-sm">
                                <thead className="border-b border-white/[0.08] bg-white/[0.025] text-xs font-medium uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">
                                            Proveedor
                                        </th>
                                        <th className="px-5 py-4">
                                            Documento
                                        </th>
                                        <th className="px-5 py-4">Contacto</th>
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
                                                colSpan={5}
                                                className="px-5 py-14 text-center text-slate-400"
                                            >
                                                <LoaderCircle className="mx-auto size-5 animate-spin" />
                                                <span className="mt-3 block">
                                                    Cargando proveedores...
                                                </span>
                                            </td>
                                        </tr>
                                    ) : proveedores.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-5 py-14 text-center"
                                            >
                                                <Truck className="mx-auto size-6 text-slate-600" />
                                                <p className="mt-3 font-medium text-slate-300">
                                                    {termino
                                                        ? "No hay proveedores que coincidan con la búsqueda."
                                                        : "Todavía no tienes proveedores."}
                                                </p>
                                                {!termino && (
                                                    <button
                                                        type="button"
                                                        onClick={abrirNuevo}
                                                        className="mt-3 text-sm text-indigo-300 hover:text-indigo-200"
                                                    >
                                                        Registrar el primero
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        proveedores.map((proveedor) => (
                                            <tr
                                                key={proveedor.id}
                                                className="transition hover:bg-white/[0.025]"
                                            >
                                                <td className="px-5 py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void consultarProveedor(
                                                                proveedor,
                                                            )
                                                        }
                                                        className="text-left font-medium text-slate-200 hover:text-indigo-200"
                                                    >
                                                        {proveedor.nombre}
                                                    </button>
                                                </td>
                                                <td className="px-5 py-4 text-slate-400">
                                                    {proveedor.documento ||
                                                        "—"}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-slate-300">
                                                        {proveedor.telefono ||
                                                            "—"}
                                                    </p>
                                                    {proveedor.correo && (
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {proveedor.correo}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                                            proveedor.activo
                                                                ? "bg-emerald-400/10 text-emerald-300"
                                                                : "bg-slate-400/10 text-slate-400"
                                                        }`}
                                                    >
                                                        {proveedor.activo
                                                            ? "Activo"
                                                            : "Inactivo"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void consultarProveedor(
                                                                    proveedor,
                                                                )
                                                            }
                                                            aria-label={`Consultar ${proveedor.nombre} e historial`}
                                                            title="Consultar e historial"
                                                            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-foreground"
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirEdicion(
                                                                    proveedor,
                                                                )
                                                            }
                                                            aria-label={`Editar ${proveedor.nombre}`}
                                                            title="Editar"
                                                            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-foreground"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void cambiarEstado(
                                                                    proveedor,
                                                                )
                                                            }
                                                            aria-label={
                                                                proveedor.activo
                                                                    ? `Desactivar ${proveedor.nombre}`
                                                                    : `Reactivar ${proveedor.nombre}`
                                                            }
                                                            title={
                                                                proveedor.activo
                                                                    ? "Desactivar"
                                                                    : "Reactivar"
                                                            }
                                                            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-rose-300"
                                                        >
                                                            {proveedor.activo ? (
                                                                <UserRoundX className="size-4" />
                                                            ) : (
                                                                <Check className="size-4" />
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
                        <footer className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3 text-xs text-slate-500">
                            <span>
                                Página {paginacion.pagina} de{" "}
                                {Math.max(paginacion.totalPaginas, 1)}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={cargando || paginacion.pagina <= 1}
                                    onClick={() => {
                                        setCargando(true);
                                        setPaginacion((actual) => ({
                                            ...actual,
                                            pagina: actual.pagina - 1,
                                        }));
                                    }}
                                    aria-label="Página anterior"
                                    className="grid size-8 place-items-center rounded-md border border-white/10 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    disabled={
                                        cargando ||
                                        paginacion.pagina >=
                                            paginacion.totalPaginas
                                    }
                                    onClick={() => {
                                        setCargando(true);
                                        setPaginacion((actual) => ({
                                            ...actual,
                                            pagina: actual.pagina + 1,
                                        }));
                                    }}
                                    aria-label="Página siguiente"
                                    className="grid size-8 place-items-center rounded-md border border-white/10 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        </footer>
                    </div>
                </section>
            </div>

            {modalFormularioAbierto && (
                <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="supplier-form-title"
                        className="my-auto w-full max-w-xl rounded-2xl border border-white/10 bg-surface-raised p-5 shadow-2xl sm:p-6"
                    >
                        <header className="flex items-start justify-between gap-4">
                            <div>
                                <h2
                                    id="supplier-form-title"
                                    className="text-lg font-semibold text-foreground"
                                >
                                    {proveedorEditando
                                        ? "Editar proveedor"
                                        : "Nuevo proveedor"}
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Los cambios quedarán registrados en el
                                    historial.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setModalFormularioAbierto(false)
                                }
                                aria-label="Cerrar formulario"
                                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </header>
                        <form
                            onSubmit={(evento) =>
                                void guardarProveedor(evento)
                            }
                            className="mt-5 space-y-4"
                        >
                            <Campo
                                id="proveedor-nombre"
                                etiqueta="Nombre o razón social"
                                valor={datosFormulario.nombre}
                                requerido
                                min="0.01"
                                step="0.01"
                                maxLength={120}
                                onChange={(valor) =>
                                    actualizarCampo("nombre", valor)
                                }
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Campo
                                    id="proveedor-documento"
                                    etiqueta="Documento fiscal"
                                    valor={datosFormulario.documento}
                                    maxLength={40}
                                    onChange={(valor) =>
                                        actualizarCampo("documento", valor)
                                    }
                                />
                                <Campo
                                    id="proveedor-telefono"
                                    etiqueta="Teléfono"
                                    valor={datosFormulario.telefono}
                                    maxLength={40}
                                    onChange={(valor) =>
                                        actualizarCampo("telefono", valor)
                                    }
                                />
                                <Campo
                                    id="proveedor-correo"
                                    etiqueta="Correo electrónico"
                                    valor={datosFormulario.correo}
                                    tipo="email"
                                    maxLength={254}
                                    onChange={(valor) =>
                                        actualizarCampo("correo", valor)
                                    }
                                />
                                <Campo
                                    id="proveedor-direccion"
                                    etiqueta="Dirección"
                                    valor={datosFormulario.direccion}
                                    maxLength={300}
                                    onChange={(valor) =>
                                        actualizarCampo("direccion", valor)
                                    }
                                />
                            </div>
                            {error && (
                                <p
                                    role="alert"
                                    className="flex items-center gap-2 text-sm text-rose-300"
                                >
                                    <CircleAlert className="size-4 shrink-0" />
                                    {error}
                                </p>
                            )}
                            <footer className="flex justify-end gap-2 border-t border-white/[0.07] pt-4">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setModalFormularioAbierto(false)
                                    }
                                    className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                >
                                    {guardando && (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    )}
                                    {proveedorEditando
                                        ? "Guardar cambios"
                                        : "Crear proveedor"}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}

            {proveedorConsultado && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/70">
                    <button
                        type="button"
                        aria-label="Cerrar consulta del proveedor"
                        className="absolute inset-0"
                        onClick={() => setProveedorConsultado(null)}
                    />
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="supplier-detail-title"
                        className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-white/10 bg-surface shadow-2xl"
                    >
                        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-surface/95 px-5 py-4 backdrop-blur sm:px-7">
                            <div className="min-w-0">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-300">
                                    Consulta de proveedor
                                </p>
                                <h2
                                    id="supplier-detail-title"
                                    className="mt-1 truncate text-lg font-semibold text-foreground"
                                >
                                    {proveedorConsultado.nombre}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setProveedorConsultado(null)
                                }
                                aria-label="Cerrar consulta"
                                className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </header>

                        <div className="space-y-6 p-5 sm:p-7">
                            <section className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="grid size-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-300">
                                            <Building2 className="size-5" />
                                        </span>
                                        <div>
                                            <p className="font-medium text-foreground">
                                                {proveedorConsultado.nombre}
                                            </p>
                                            <span
                                                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                    proveedorConsultado.activo
                                                        ? "bg-emerald-400/10 text-emerald-300"
                                                        : "bg-slate-400/10 text-slate-400"
                                                }`}
                                            >
                                                {proveedorConsultado.activo
                                                    ? "Activo"
                                                    : "Inactivo"}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            abrirEdicion(
                                                proveedorConsultado,
                                            );
                                            setProveedorConsultado(null);
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                                    >
                                        <Pencil className="size-3.5" />
                                        Editar
                                    </button>
                                </div>
                                <dl className="mt-4 grid gap-3 border-t border-white/[0.07] pt-4 sm:grid-cols-2">
                                    <div>
                                        <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                                            Documento
                                        </dt>
                                        <dd className="mt-1 text-xs text-slate-300">
                                            {proveedorConsultado.documento ||
                                                "No registrado"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                                            Teléfono
                                        </dt>
                                        <dd className="mt-1 text-xs text-slate-300">
                                            {proveedorConsultado.telefono ||
                                                "No registrado"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                                            Correo
                                        </dt>
                                        <dd className="mt-1 break-all text-xs text-slate-300">
                                            {proveedorConsultado.correo ||
                                                "No registrado"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                                            Dirección
                                        </dt>
                                        <dd className="mt-1 text-xs text-slate-300">
                                            {proveedorConsultado.direccion ||
                                                "No registrada"}
                                        </dd>
                                    </div>
                                </dl>
                            </section>

                            <section>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">
                                            Historial de operaciones
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {paginacionOperaciones.total}{" "}
                                            {paginacionOperaciones.total === 1
                                                ? "operación registrada"
                                                : "operaciones registradas"}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCompraAbierta((actual) => !actual);
                                            setErrorCompra("");
                                        }}
                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-on-accent transition hover:bg-indigo-400"
                                    >
                                        <Plus className="size-3.5" />
                                        Registrar compra
                                    </button>
                                </div>

                                {compraAbierta && (
                                    <form
                                        onSubmit={(evento) =>
                                            void registrarCompra(evento)
                                        }
                                        className="mt-4 space-y-3 rounded-xl border border-indigo-400/20 bg-indigo-400/[0.04] p-4"
                                    >
                                        <h4 className="text-xs font-semibold text-foreground">
                                            Nueva compra
                                        </h4>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <Campo
                                                id="compra-fecha"
                                                etiqueta="Fecha de compra"
                                                valor={datosCompra.fechaCompra}
                                                tipo="date"
                                                requerido
                                                onChange={(valor) =>
                                                    setDatosCompra((actual) => ({
                                                        ...actual,
                                                        fechaCompra: valor,
                                                    }))
                                                }
                                            />
                                            <Campo
                                                id="compra-total"
                                                etiqueta="Total"
                                                valor={datosCompra.total}
                                                tipo="number"
                                                requerido
                                                onChange={(valor) =>
                                                    setDatosCompra((actual) => ({
                                                        ...actual,
                                                        total: valor,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-medium text-slate-300">
                                                Descripción
                                            </span>
                                            <textarea
                                                value={datosCompra.detalle}
                                                required
                                                maxLength={500}
                                                rows={2}
                                                onChange={(evento) =>
                                                    setDatosCompra((actual) => ({
                                                        ...actual,
                                                        detalle:
                                                            evento.target.value,
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-slate-600 focus:border-indigo-400/70"
                                                placeholder="Productos o servicios adquiridos"
                                            />
                                        </label>
                                        {errorCompra && (
                                            <p
                                                role="alert"
                                                className="text-xs text-rose-300"
                                            >
                                                {errorCompra}
                                            </p>
                                        )}
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setCompraAbierta(false)
                                                }
                                                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={guardandoCompra}
                                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-50"
                                            >
                                                {guardandoCompra && (
                                                    <LoaderCircle className="size-3.5 animate-spin" />
                                                )}
                                                Guardar compra
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {errorHistorial && (
                                    <p
                                        role="alert"
                                        className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs text-rose-300"
                                    >
                                        {errorHistorial}
                                    </p>
                                )}

                                {cargandoHistorial ? (
                                    <p className="py-10 text-center text-xs text-slate-500">
                                        <LoaderCircle className="mx-auto mb-2 size-4 animate-spin" />
                                        Cargando historial...
                                    </p>
                                ) : errorHistorial ? null : operaciones.length ===
                                  0 ? (
                                    <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                                        <Clock3 className="mx-auto size-5 text-slate-500" />
                                        <p className="mt-2 text-xs text-slate-400">
                                            Aún no hay operaciones registradas.
                                        </p>
                                    </div>
                                ) : (
                                    <ol className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                                        {operaciones.map((operacion) => (
                                            <li
                                                key={operacion.id}
                                                className="flex gap-3 p-4"
                                            >
                                                <span
                                                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                                                        operacion.tipo ===
                                                        "COMPRA_REGISTRADA"
                                                            ? "bg-indigo-500/10 text-indigo-300"
                                                            : "bg-white/[0.05] text-slate-400"
                                                    }`}
                                                >
                                                    {operacion.tipo ===
                                                    "COMPRA_REGISTRADA" ? (
                                                        <Truck className="size-4" />
                                                    ) : (
                                                        <UserRound className="size-4" />
                                                    )}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                        <p className="text-xs font-semibold text-slate-200">
                                                            {etiquetaOperacion(
                                                                operacion.tipo,
                                                            )}
                                                        </p>
                                                        <time className="text-[10px] text-slate-500">
                                                            {fechaLegible(
                                                                operacion.creadaEn,
                                                            )}
                                                        </time>
                                                    </div>
                                                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">
                                                        {operacion.detalle}
                                                    </p>
                                                    {operacion.fechaCompra && (
                                                        <p className="mt-1 text-[10px] text-slate-500">
                                                            Fecha de compra:{" "}
                                                            {fechaLegible(
                                                                operacion.fechaCompra,
                                                            )}
                                                            {operacion.total !==
                                                                null &&
                                                                ` · Total: ${Number(
                                                                    operacion.total,
                                                                ).toLocaleString(
                                                                    "es",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2,
                                                                    },
                                                                )}`}
                                                        </p>
                                                    )}
                                                    <p className="mt-1 text-[10px] text-slate-500">
                                                        {operacion.usuario
                                                            ? `${operacion.usuario.nombre} ${operacion.usuario.apellido}`
                                                            : "Usuario eliminado"}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}

                                {paginacionOperaciones.totalPaginas > 1 && (
                                    <footer className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                                        <span>
                                            Página{" "}
                                            {paginacionOperaciones.pagina} de{" "}
                                            {paginacionOperaciones.totalPaginas}
                                        </span>
                                        <span className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={
                                                    cargandoHistorial ||
                                                    paginacionOperaciones.pagina <=
                                                        1
                                                }
                                                onClick={() =>
                                                    void cambiarPaginaHistorial(
                                                        paginacionOperaciones.pagina -
                                                            1,
                                                    )
                                                }
                                                aria-label="Página anterior del historial"
                                                className="grid size-7 place-items-center rounded border border-white/10 hover:bg-white/5 disabled:opacity-40"
                                            >
                                                <ChevronLeft className="size-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={
                                                    cargandoHistorial ||
                                                    paginacionOperaciones.pagina >=
                                                        paginacionOperaciones.totalPaginas
                                                }
                                                onClick={() =>
                                                    void cambiarPaginaHistorial(
                                                        paginacionOperaciones.pagina +
                                                            1,
                                                    )
                                                }
                                                aria-label="Página siguiente del historial"
                                                className="grid size-7 place-items-center rounded border border-white/10 hover:bg-white/5 disabled:opacity-40"
                                            >
                                                <ChevronRight className="size-3.5" />
                                            </button>
                                        </span>
                                    </footer>
                                )}
                            </section>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
