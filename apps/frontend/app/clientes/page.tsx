"use client";

import {
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Clock3,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    UserRound,
    UserRoundX,
    X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";

interface Cliente {
    id: string;
    nombre: string;
    apellido: string | null;
    documento: string | null;
    telefono: string | null;
    correo: string | null;
    direccion: string | null;
    activo: boolean;
    creadaEn: string;
    origen: "MANUAL" | "MARKETPLACE";
    posibleDuplicado: boolean;
}

interface OperacionCliente {
    id: string;
    tipo: "CREADO" | "ACTUALIZADO" | "DESACTIVADO" | "ACTIVADO";
    detalle: string;
    creadaEn: string;
    usuario: { nombre: string; apellido: string } | null;
}

interface Paginacion {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
}

interface ActividadComercial {
    totales: {
        totalComprado: number;
        cantidadPedidos: number;
        ticketPromedio: number;
        ultimaCompra: string | null;
        pedidosCompletados: number;
        pedidosPendientes: number;
    };
    pedidosRecientes: {
        id: string;
        fecha: string;
        total: number;
        estado: string;
        articulos: number;
    }[];
}

interface FormularioCliente {
    nombre: string;
    apellido: string;
    documento: string;
    telefono: string;
    correo: string;
    direccion: string;
}

const formularioVacio: FormularioCliente = {
    nombre: "",
    apellido: "",
    documento: "",
    telefono: "",
    correo: "",
    direccion: "",
};

function esCliente(valor: unknown): valor is Cliente {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "nombre" in valor &&
        typeof valor.nombre === "string" &&
        "apellido" in valor &&
        (typeof valor.apellido === "string" || valor.apellido === null) &&
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
        "origen" in valor &&
        ["MANUAL", "MARKETPLACE"].includes(String(valor.origen)) &&
        "posibleDuplicado" in valor &&
        typeof valor.posibleDuplicado === "boolean"
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

function esResultadoClientes(
    valor: unknown,
): valor is { datos: Cliente[]; paginacion: Paginacion } {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "datos" in valor &&
        Array.isArray(valor.datos) &&
        valor.datos.every(esCliente) &&
        "paginacion" in valor &&
        esPaginacion(valor.paginacion)
    );
}

function esOperacion(valor: unknown): valor is OperacionCliente {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "tipo" in valor &&
        ["CREADO", "ACTUALIZADO", "DESACTIVADO", "ACTIVADO"].includes(
            String(valor.tipo),
        ) &&
        "detalle" in valor &&
        typeof valor.detalle === "string" &&
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
): valor is { datos: OperacionCliente[]; paginacion: Paginacion } {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "datos" in valor &&
        Array.isArray(valor.datos) &&
        valor.datos.every(esOperacion) &&
        "paginacion" in valor &&
        esPaginacion(valor.paginacion)
    );
}

function esActividadComercial(valor: unknown): valor is ActividadComercial {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "totales" in valor &&
        typeof valor.totales === "object" &&
        valor.totales !== null &&
        "pedidosRecientes" in valor &&
        Array.isArray(valor.pedidosRecientes)
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

function etiquetaOperacion(tipo: OperacionCliente["tipo"]) {
    const etiquetas: Record<OperacionCliente["tipo"], string> = {
        CREADO: "Cliente creado",
        ACTUALIZADO: "Datos actualizados",
        DESACTIVADO: "Cliente desactivado",
        ACTIVADO: "Cliente reactivado",
    };

    return etiquetas[tipo];
}

async function obtenerClientes(
    pagina: number,
    limite: number,
    buscar: string,
) {
    const parametros = new URLSearchParams({
        pagina: String(pagina),
        limite: String(limite),
        buscar,
    });
    const resultado = await apiRequest(`/clientes?${parametros.toString()}`);

    if (!esResultadoClientes(resultado)) {
        throw new Error("La API devolvió una lista de clientes no válida.");
    }

    return resultado;
}

export default function PaginaClientes() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
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
    const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [datosFormulario, setDatosFormulario] =
        useState<FormularioCliente>(formularioVacio);
    const [guardando, setGuardando] = useState(false);
    const [clienteConsultado, setClienteConsultado] = useState<Cliente | null>(null);
    const [operaciones, setOperaciones] = useState<OperacionCliente[]>([]);
    const [paginacionOperaciones, setPaginacionOperaciones] = useState<Paginacion>({
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0,
    });
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const [errorHistorial, setErrorHistorial] = useState("");
    const [pestanaActiva, setPestanaActiva] = useState<"operaciones" | "comercial">("operaciones");
    const [actividadComercial, setActividadComercial] = useState<ActividadComercial | null>(null);
    const [cargandoComercial, setCargandoComercial] = useState(false);

    useEffect(() => {
        let cancelada = false;

        async function cargar() {
            try {
                const resultado = await obtenerClientes(
                    paginacion.pagina,
                    paginacion.limite,
                    termino,
                );

                if (!cancelada) {
                    setClientes(resultado.datos);
                    setPaginacion(resultado.paginacion);
                    setError("");
                }
            } catch (error) {
                if (!cancelada) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "No se pudieron cargar los clientes.",
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
    }, [
        paginacion.limite,
        paginacion.pagina,
        revisionBusqueda,
        termino,
    ]);

    function buscar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setCargando(true);
        setError("");
        setPaginacion((actual) => ({ ...actual, pagina: 1 }));
        setTermino(busqueda.trim());
        setRevisionBusqueda((actual) => actual + 1);
    }

    function abrirNuevo() {
        setClienteEditando(null);
        setDatosFormulario(formularioVacio);
        setError("");
        setModalAbierto(true);
    }

    function abrirEdicion(cliente: Cliente) {
        setClienteEditando(cliente);
        setDatosFormulario({
            nombre: cliente.nombre,
            apellido: cliente.apellido ?? "",
            documento: cliente.documento ?? "",
            telefono: cliente.telefono ?? "",
            correo: cliente.correo ?? "",
            direccion: cliente.direccion ?? "",
        });
        setError("");
        setModalAbierto(true);
    }

    async function consultarCliente(cliente: Cliente) {
        setClienteConsultado(cliente);
        setOperaciones([]);
        setActividadComercial(null);
        setPaginacionOperaciones((actual) => ({ ...actual, pagina: 1 }));
        setCargandoHistorial(true);
        setCargandoComercial(true);
        setErrorHistorial("");

        try {
            const [detalle, historial, comercial] = await Promise.all([
                apiRequest(`/clientes/${cliente.id}`),
                apiRequest(
                    `/clientes/${cliente.id}/historial?pagina=1&limite=${paginacionOperaciones.limite}`,
                ),
                apiRequest(`/clientes/${cliente.id}/comercial`),
            ]);

            const clienteDetalle =
                typeof detalle === "object" && detalle !== null && "cliente" in detalle
                    ? detalle.cliente
                    : null;

            if (!esCliente(clienteDetalle)) {
                throw new Error("La API devolvió datos del cliente no válidos.");
            }

            if (!esResultadoOperaciones(historial)) {
                throw new Error("La API devolvió un historial no válido.");
            }

            if (!esActividadComercial(comercial)) {
                throw new Error("La API devolvió una actividad comercial no válida.");
            }

            setClienteConsultado(clienteDetalle);
            setOperaciones(historial.datos);
            setPaginacionOperaciones(historial.paginacion);
            setActividadComercial(comercial);
        } catch (error) {
            setErrorHistorial(
                error instanceof Error
                    ? error.message
                    : "No se pudo cargar la información del cliente.",
            );
        } finally {
            setCargandoHistorial(false);
            setCargandoComercial(false);
        }
    }

    async function cambiarPaginaHistorial(pagina: number) {
        if (!clienteConsultado) return;
        setCargandoHistorial(true);
        setErrorHistorial("");

        try {
            const resultado = await apiRequest(
                `/clientes/${clienteConsultado.id}/historial?pagina=${pagina}&limite=${paginacionOperaciones.limite}`,
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
                    : "No se pudo cargar el historial del cliente.",
            );
        } finally {
            setCargandoHistorial(false);
        }
    }

    async function guardarCliente(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");

        try {
            const cliente = clienteEditando;
            await apiRequest(
                cliente ? `/clientes/${cliente.id}` : "/clientes",
                cliente ? "PATCH" : "POST",
                datosFormulario,
            );
            setModalAbierto(false);
            setCargando(true);
            setError("");
            setMensaje(
                cliente
                    ? "Los datos del cliente se actualizaron."
                    : "El cliente se creó correctamente.",
            );
            setRevisionBusqueda((actual) => actual + 1);
            if (cliente && clienteConsultado?.id === cliente.id) {
                void consultarCliente(cliente);
            }
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar el cliente.",
            );
        } finally {
            setGuardando(false);
        }
    }

    async function cambiarEstado(cliente: Cliente) {
        setCargando(true);
        setError("");
        setMensaje("");

        try {
            await apiRequest(
                `/clientes/${cliente.id}/estado`,
                "PATCH",
                { activo: !cliente.activo },
            );
            setMensaje(
                cliente.activo
                    ? "El cliente se desactivó."
                    : "El cliente se activó.",
            );
            setRevisionBusqueda((actual) => actual + 1);
            if (clienteConsultado?.id === cliente.id) {
                void consultarCliente(cliente);
            }
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo cambiar el estado del cliente.",
            );
            setCargando(false);
        }
    }

    function updateField(
        campo: keyof FormularioCliente,
        valor: string,
    ) {
        setDatosFormulario((actual) => ({ ...actual, [campo]: valor }));
    }

    return (
        <>
            <div className="mx-auto w-full max-w-6xl">
                <header className="flex flex-col justify-between gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-sm font-medium text-indigo-300">
                            Directorio
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                            Clientes
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Administra los contactos de tu empresa.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                        <p className="text-sm text-slate-500">
                            {paginacion.total}{" "}
                            {paginacion.total === 1 ? "cliente" : "clientes"}
                        </p>
                        <button
                            type="button"
                            onClick={abrirNuevo}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400"
                        >
                            <Plus className="size-4" />
                            Nuevo cliente
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
                            <span className="sr-only">Buscar clientes</span>
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                            <input
                                value={busqueda}
                                onChange={(evento) =>
                                    setBusqueda(evento.target.value)
                                }
                                placeholder="Nombre, documento, correo o teléfono"
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
                            aria-label="Tabla de clientes; desplazamiento horizontal"
                            tabIndex={0}
                        >
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="border-b border-white/[0.08] bg-white/[0.025] text-xs font-medium uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">Cliente</th>
                                        <th className="px-5 py-4">Documento</th>
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
                                                    Cargando clientes...
                                                </span>
                                            </td>
                                        </tr>
                                    ) : clientes.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-5 py-14 text-center"
                                            >
                                                <UserRound className="mx-auto size-6 text-slate-600" />
                                                <p className="mt-3 font-medium text-slate-300">
                                                    {termino
                                                        ? "No hay clientes que coincidan con la búsqueda."
                                                        : "Todavía no tienes clientes."}
                                                </p>
                                                {!termino && (
                                                    <button
                                                        type="button"
                                                        onClick={abrirNuevo}
                                                        className="mt-3 text-sm text-indigo-300 hover:text-indigo-200"
                                                    >
                                                        Agregar el primer cliente
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        clientes.map((cliente) => (
                                            <tr
                                                key={cliente.id}
                                                className="text-slate-300"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-foreground">
                                                            {cliente.nombre}{" "}
                                                            {cliente.apellido}
                                                        </p>
                                                        {cliente.posibleDuplicado && (
                                                            <span title="Posible duplicado detectado" className="flex size-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                                                                <CircleAlert className="size-3" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                                        <span>
                                                            {cliente.origen === "MARKETPLACE" ? "🛒 Marketplace" : "👤 Manual"}
                                                        </span>
                                                        <span>•</span>
                                                        <span>
                                                            Añadido{" "}
                                                            {new Intl.DateTimeFormat(
                                                                "es",
                                                                {
                                                                    dateStyle:
                                                                        "medium",
                                                                },
                                                            ).format(
                                                                new Date(
                                                                    cliente.creadaEn,
                                                                ),
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {cliente.documento || "—"}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p>
                                                        {cliente.correo || "—"}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {cliente.telefono || "—"}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs ${
                                                            cliente.activo
                                                                ? "bg-emerald-500/10 text-emerald-300"
                                                                : "bg-slate-500/10 text-slate-400"
                                                        }`}
                                                    >
                                                        {cliente.activo
                                                            ? "Activo"
                                                            : "Inactivo"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void consultarCliente(
                                                                    cliente,
                                                                )
                                                            }
                                                            aria-label={`Consultar historial de ${cliente.nombre}`}
                                                            className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                                                        >
                                                            <Clock3 className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirEdicion(
                                                                    cliente,
                                                                )
                                                            }
                                                            aria-label={`Editar ${cliente.nombre}`}
                                                            className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void cambiarEstado(
                                                                    cliente,
                                                                )
                                                            }
                                                            aria-label={`${cliente.activo ? "Desactivar" : "Activar"} ${cliente.nombre}`}
                                                            className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-foreground"
                                                        >
                                                            {cliente.activo ? (
                                                                <UserRoundX className="size-4" />
                                                            ) : (
                                                                <UserRound className="size-4" />
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

                        <footer className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3 text-sm text-slate-500">
                            <span>
                                Página {paginacion.pagina} de{" "}
                                {Math.max(paginacion.totalPaginas, 1)}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={
                                        cargando || paginacion.pagina <= 1
                                    }
                                    onClick={() =>
                                        {
                                            setCargando(true);
                                            setPaginacion((actual) => ({
                                                ...actual,
                                                pagina: actual.pagina - 1,
                                            }));
                                        }
                                    }
                                    aria-label="Página anterior"
                                    className="rounded-md border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
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
                                    onClick={() =>
                                        {
                                            setCargando(true);
                                            setPaginacion((actual) => ({
                                                ...actual,
                                                pagina: actual.pagina + 1,
                                            }));
                                        }
                                    }
                                    aria-label="Página siguiente"
                                    className="rounded-md border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        </footer>
                    </div>

                    {clienteConsultado && (
                        <aside className="mt-6 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-indigo-300">
                                        Ficha del cliente
                                    </p>
                                    <h2 className="mt-1 text-lg font-semibold text-foreground">
                                        {clienteConsultado.nombre} {clienteConsultado.apellido ?? ""}
                                    </h2>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPestanaActiva("operaciones")}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                            pestanaActiva === "operaciones"
                                                ? "bg-indigo-500 text-on-accent"
                                                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                                        }`}
                                    >
                                        Operaciones
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPestanaActiva("comercial")}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                            pestanaActiva === "comercial"
                                                ? "bg-indigo-500 text-on-accent"
                                                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                                        }`}
                                    >
                                        Actividad comercial
                                    </button>
                                </div>
                            </div>

                            <div className="p-5">
                                {pestanaActiva === "operaciones" ? (
                                    <>
                                        {cargandoHistorial ? (
                                            <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                                                <LoaderCircle className="mr-2 size-4 animate-spin" />
                                                Cargando historial...
                                            </div>
                                        ) : errorHistorial ? (
                                            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.07] p-3 text-sm text-red-300">
                                                {errorHistorial}
                                            </div>
                                        ) : operaciones.length === 0 ? (
                                            <div className="py-8 text-center text-sm text-slate-400">
                                                Aún no hay operaciones registradas para este cliente.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {operaciones.map((operacion) => (
                                                    <article
                                                        key={operacion.id}
                                                        className="rounded-xl border border-white/[0.08] bg-surface p-4"
                                                    >
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <p className="font-medium text-foreground">
                                                                    {etiquetaOperacion(operacion.tipo)}
                                                                </p>
                                                                <p className="mt-1 text-sm text-slate-400">
                                                                    {operacion.detalle}
                                                                </p>
                                                            </div>
                                                            <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-200">
                                                                {operacion.tipo}
                                                            </span>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                                            <span>{fechaLegible(operacion.creadaEn)}</span>
                                                            {operacion.usuario && (
                                                                <span>
                                                                    Por {operacion.usuario.nombre} {operacion.usuario.apellido}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        )}
                                        <footer className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-sm text-slate-500">
                                            <span>
                                                Página {paginacionOperaciones.pagina} de{" "}
                                                {Math.max(paginacionOperaciones.totalPaginas, 1)}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={cargandoHistorial || paginacionOperaciones.pagina <= 1}
                                                    onClick={() =>
                                                        void cambiarPaginaHistorial(
                                                            paginacionOperaciones.pagina - 1,
                                                        )
                                                    }
                                                    aria-label="Página anterior del historial"
                                                    className="rounded-md border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <ChevronLeft className="size-4" />
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
                                                            paginacionOperaciones.pagina + 1,
                                                        )
                                                    }
                                                    aria-label="Página siguiente del historial"
                                                    className="rounded-md border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <ChevronRight className="size-4" />
                                                </button>
                                            </div>
                                        </footer>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        {cargandoComercial ? (
                                            <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                                                <LoaderCircle className="mr-2 size-4 animate-spin" />
                                                Cargando actividad comercial...
                                            </div>
                                        ) : actividadComercial ? (
                                            <>
                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                                    <TarjetaMetrica
                                                        label="Total comprado"
                                                        valor={`$${Number(actividadComercial.totales.totalComprado).toLocaleString()}`}
                                                    />
                                                    <TarjetaMetrica
                                                        label="Nº pedidos"
                                                        valor={actividadComercial.totales.cantidadPedidos.toString()}
                                                    />
                                                    <TarjetaMetrica
                                                        label="Ticket promedio"
                                                        valor={`$${Number(actividadComercial.totales.ticketPromedio).toLocaleString()}`}
                                                    />
                                                    <TarjetaMetrica
                                                        label="Última compra"
                                                        valor={actividadComercial.totales.ultimaCompra ? new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(actividadComercial.totales.ultimaCompra)) : "Nunca"}
                                                    />
                                                    <TarjetaMetrica
                                                        label="Completados"
                                                        valor={actividadComercial.totales.pedidosCompletados.toString()}
                                                    />
                                                    <TarjetaMetrica
                                                        label="Pendientes"
                                                        valor={actividadComercial.totales.pedidosPendientes.toString()}
                                                    />
                                                </div>

                                                <div>
                                                    <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                                                        Pedidos recientes
                                                    </h3>
                                                    <div className="mt-3 space-y-2">
                                                        {actividadComercial.pedidosRecientes.length === 0 ? (
                                                            <p className="py-4 text-center text-sm text-slate-500">
                                                                No hay pedidos registrados.
                                                            </p>
                                                        ) : (
                                                            actividadComercial.pedidosRecientes.map((pedido) => (
                                                                <div
                                                                    key={pedido.id}
                                                                    className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.01] px-4 py-3"
                                                                >
                                                                    <div>
                                                                        <p className="text-sm font-medium text-slate-200">
                                                                            {new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(pedido.fecha))}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {pedido.articulos} {pedido.articulos === 1 ? "artículo" : "artículos"}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-sm font-semibold text-foreground">
                                                                            ${Number(pedido.total).toLocaleString()}
                                                                        </p>
                                                                        <span className="text-[10px] uppercase tracking-wide text-indigo-300">
                                                                            {pedido.estado.replace(/_/g, " ")}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="py-8 text-center text-sm text-slate-400">
                                                No se pudo cargar la actividad comercial.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}
                </section>
            </div>

            {modalAbierto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) {
                            setModalAbierto(false);
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-formulario-cliente"
                        className="my-auto w-full max-w-xl rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl sm:p-7"
                    >
                        <header className="flex items-start justify-between">
                            <div>
                                <h2
                                    id="titulo-formulario-cliente"
                                    className="text-xl font-semibold text-foreground"
                                >
                                    {clienteEditando
                                        ? "Editar cliente"
                                        : "Nuevo cliente"}
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    Los datos se guardan en el espacio de tu
                                    empresa.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalAbierto(false)}
                                aria-label="Cerrar formulario"
                                className="rounded-md p-2 text-slate-500 hover:bg-white/5 hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </header>

                        <form onSubmit={guardarCliente} className="mt-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <CampoCliente
                                    id="cliente-nombre"
                                    label="Nombre *"
                                    value={datosFormulario.nombre}
                                    onChange={(valor) =>
                                        updateField("nombre", valor)
                                    }
                                    required
                                    maxLength={80}
                                />
                                <CampoCliente
                                    id="cliente-apellido"
                                    label="Apellido"
                                    value={datosFormulario.apellido}
                                    onChange={(valor) =>
                                        updateField("apellido", valor)
                                    }
                                    maxLength={80}
                                />
                                <CampoCliente
                                    id="cliente-documento"
                                    label="Documento"
                                    value={datosFormulario.documento}
                                    onChange={(valor) =>
                                        updateField("documento", valor)
                                    }
                                    maxLength={40}
                                />
                                <CampoCliente
                                    id="cliente-telefono"
                                    label="Teléfono"
                                    value={datosFormulario.telefono}
                                    onChange={(valor) =>
                                        updateField("telefono", valor)
                                    }
                                    maxLength={40}
                                />
                                <CampoCliente
                                    id="cliente-correo"
                                    label="Correo electrónico"
                                    type="email"
                                    value={datosFormulario.correo}
                                    onChange={(valor) =>
                                        updateField("correo", valor)
                                    }
                                    maxLength={254}
                                />
                                <CampoCliente
                                    id="cliente-direccion"
                                    label="Dirección"
                                    value={datosFormulario.direccion}
                                    onChange={(valor) =>
                                        updateField("direccion", valor)
                                    }
                                    maxLength={300}
                                />
                            </div>

                            {error && (
                                <p
                                    role="alert"
                                    className="mt-4 text-sm text-red-300"
                                >
                                    {error}
                                </p>
                            )}

                            <footer className="mt-7 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalAbierto(false)}
                                    className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-indigo-400 disabled:opacity-60"
                                >
                                    {guardando && (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    )}
                                    {clienteEditando
                                        ? "Guardar cambios"
                                        : "Crear cliente"}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
}

interface CampoClienteProps {
    id: string;
    label: string;
    value: string;
    onChange: (valor: string) => void;
    type?: string;
    required?: boolean;
    maxLength: number;
}

function CampoCliente({
    id,
    label,
    value,
    onChange,
    type = "text",
    required = false,
    maxLength,
}: CampoClienteProps) {
    return (
        <label
            htmlFor={id}
            className="block text-xs font-medium text-slate-300"
        >
            {label}
            <input
                id={id}
                type={type}
                value={value}
                required={required}
                maxLength={maxLength}
                onChange={(evento) => onChange(evento.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-indigo-400/70"
            />
        </label>
    );
}

function TarjetaMetrica({ label, valor }: { label: string; valor: string }) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {label}
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">{valor}</p>
        </div>
    );
}
