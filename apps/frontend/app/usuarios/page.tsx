"use client";

import {
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    UserRound,
    UserRoundX,
    X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/app/lib/api";

type RolUsuario = "ADMINISTRADOR" | "VENDEDOR" | "ALMACENERO";
type FiltroEstado = "todos" | "true" | "false";

interface Usuario {
    id: string;
    nombre: string;
    apellido: string;
    correo: string;
    rol: RolUsuario;
    activo: boolean;
    creadaEn: string;
}

interface Paginacion {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
}

interface FormularioUsuario {
    nombre: string;
    apellido: string;
    correo: string;
    contrasena: string;
    rol: RolUsuario;
}

const formularioVacio: FormularioUsuario = {
    nombre: "",
    apellido: "",
    correo: "",
    contrasena: "",
    rol: "VENDEDOR",
};

const roles: Array<{ value: RolUsuario; label: string }> = [
    { value: "ADMINISTRADOR", label: "Administrador" },
    { value: "VENDEDOR", label: "Vendedor" },
    { value: "ALMACENERO", label: "Almacenero" },
];

function esRolUsuario(valor: unknown): valor is RolUsuario {
    return (
        valor === "ADMINISTRADOR" ||
        valor === "VENDEDOR" ||
        valor === "ALMACENERO"
    );
}

function esUsuario(valor: unknown): valor is Usuario {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "id" in valor &&
        typeof valor.id === "string" &&
        "nombre" in valor &&
        typeof valor.nombre === "string" &&
        "apellido" in valor &&
        typeof valor.apellido === "string" &&
        "correo" in valor &&
        typeof valor.correo === "string" &&
        "rol" in valor &&
        esRolUsuario(valor.rol) &&
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

function esResultadoUsuarios(
    valor: unknown,
): valor is { datos: Usuario[]; paginacion: Paginacion } {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "datos" in valor &&
        Array.isArray(valor.datos) &&
        valor.datos.every(esUsuario) &&
        "paginacion" in valor &&
        esPaginacion(valor.paginacion)
    );
}

export default function PaginaUsuarios() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [paginacion, setPaginacion] = useState<Paginacion>({
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0,
    });
    const [pagina, setPagina] = useState(1);
    const [busqueda, setBusqueda] = useState("");
    const [termino, setTermino] = useState("");
    const [estado, setEstado] = useState<FiltroEstado>("todos");
    const [revision, setRevision] = useState(0);
    const [usuarioActualId, setUsuarioActualId] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [datosFormulario, setDatosFormulario] =
        useState<FormularioUsuario>(formularioVacio);
    const [guardando, setGuardando] = useState(false);
    const [operacionId, setOperacionId] = useState("");

    useEffect(() => {
        let cancelada = false;

        async function cargar() {
            const parametros = new URLSearchParams({
                pagina: String(pagina),
                limite: String(paginacion.limite),
                buscar: termino,
            });
            if (estado !== "todos") parametros.set("activo", estado);

            try {
                const [resultado, perfil] = await Promise.all([
                    apiRequest(`/usuarios?${parametros.toString()}`),
                    apiRequest("/autenticacion/perfil"),
                ]);
                const usuarioPerfil =
                    typeof perfil === "object" &&
                    perfil !== null &&
                    "usuario" in perfil
                        ? perfil.usuario
                        : null;

                if (!esResultadoUsuarios(resultado)) {
                    throw new Error("La API devolvió una lista de usuarios no válida.");
                }
                if (
                    typeof usuarioPerfil !== "object" ||
                    usuarioPerfil === null ||
                    !("id" in usuarioPerfil) ||
                    typeof usuarioPerfil.id !== "string"
                ) {
                    throw new Error("La API devolvió un perfil no válido.");
                }

                if (!cancelada) {
                    setUsuarios(resultado.datos);
                    setPaginacion(resultado.paginacion);
                    setUsuarioActualId(usuarioPerfil.id);
                    setError("");
                }
            } catch (error) {
                if (!cancelada) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "No se pudieron cargar los usuarios.",
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
    }, [estado, pagina, paginacion.limite, revision, termino]);

    function buscar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setCargando(true);
        setPagina(1);
        setTermino(busqueda.trim());
        setRevision((actual) => actual + 1);
    }

    function abrirNuevo() {
        setUsuarioEditando(null);
        setDatosFormulario(formularioVacio);
        setError("");
        setModalAbierto(true);
    }

    function abrirEdicion(usuario: Usuario) {
        setUsuarioEditando(usuario);
        setDatosFormulario({
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            correo: usuario.correo,
            contrasena: "",
            rol: usuario.rol,
        });
        setError("");
        setModalAbierto(true);
    }

    async function guardarUsuario(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setGuardando(true);
        setError("");

        try {
            const usuario = usuarioEditando;
            if (usuario) {
                await apiRequest(`/usuarios/${usuario.id}`, "PATCH", {
                    nombre: datosFormulario.nombre,
                    apellido: datosFormulario.apellido,
                    correo: datosFormulario.correo,
                });
            } else {
                await apiRequest("/usuarios", "POST", datosFormulario);
            }

            setModalAbierto(false);
            setMensaje(
                usuario
                    ? "Los datos del usuario se actualizaron."
                    : "El usuario se creó correctamente.",
            );
            setCargando(true);
            setRevision((actual) => actual + 1);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar el usuario.",
            );
            setCargando(true);
            setRevision((actual) => actual + 1);
        } finally {
            setGuardando(false);
        }
    }

    async function cambiarRol(usuario: Usuario, rol: RolUsuario) {
        setOperacionId(usuario.id);
        setError("");
        setMensaje("");

        try {
            await apiRequest(`/usuarios/${usuario.id}/rol`, "PATCH", { rol });
            setMensaje(`El rol de ${usuario.nombre} se actualizó.`);
            setCargando(true);
            setRevision((actual) => actual + 1);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo cambiar el rol.",
            );
        } finally {
            setOperacionId("");
        }
    }

    async function cambiarEstado(usuario: Usuario) {
        setOperacionId(usuario.id);
        setError("");
        setMensaje("");

        try {
            await apiRequest(`/usuarios/${usuario.id}/estado`, "PATCH", {
                activo: !usuario.activo,
            });
            setMensaje(
                usuario.activo
                    ? `${usuario.nombre} se desactivó.`
                    : `${usuario.nombre} se activó.`,
            );
            setCargando(true);
            setRevision((actual) => actual + 1);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo cambiar el estado del usuario.",
            );
        } finally {
            setOperacionId("");
        }
    }

    function actualizarCampo(
        campo: keyof FormularioUsuario,
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
                            Accesos de la empresa
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                            Usuarios y roles
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Administra las cuentas y los permisos de acceso
                            de tu equipo.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                        <p className="text-sm text-slate-500">
                            {paginacion.total}{" "}
                            {paginacion.total === 1 ? "usuario" : "usuarios"}
                        </p>
                        <button
                            type="button"
                            onClick={abrirNuevo}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400"
                        >
                            <Plus className="size-4" />
                            Nuevo usuario
                        </button>
                    </div>
                </header>

                <section className="py-8">
                    <div className="mt-5 grid gap-3 text-xs text-slate-400 sm:grid-cols-3">
                        <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                            <span className="font-semibold text-foreground">Administrador</span>
                            {" · "}gestiona usuarios y clientes.
                        </p>
                        <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                            <span className="font-semibold text-foreground">Vendedor</span>
                            {" · "}gestiona clientes.
                        </p>
                        <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                            <span className="font-semibold text-foreground">Almacenero</span>
                            {" · "}rol para operaciones de almacén.
                        </p>
                    </div>

                    <form
                        onSubmit={buscar}
                        className="mt-7 flex max-w-3xl flex-wrap gap-2"
                        role="search"
                    >
                        <label className="relative block min-w-55 flex-1">
                            <span className="sr-only">Buscar usuarios</span>
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                            <input
                                value={busqueda}
                                onChange={(evento) =>
                                    setBusqueda(evento.target.value)
                                }
                                placeholder="Nombre o correo electrónico"
                                className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-slate-600 focus:border-indigo-400/70"
                            />
                        </label>
                        <label>
                            <span className="sr-only">Filtrar por estado</span>
                            <select
                                value={estado}
                                onChange={(evento) => {
                                    setEstado(evento.target.value as FiltroEstado);
                                    setCargando(true);
                                    setPagina(1);
                                }}
                                className="h-11 rounded-lg border border-white/10 bg-surface-raised px-3 text-sm text-slate-300 outline-none focus:border-indigo-400/70"
                            >
                                <option value="todos">Todos los estados</option>
                                <option value="true">Activos</option>
                                <option value="false">Inactivos</option>
                            </select>
                        </label>
                        <button
                            type="submit"
                            className="rounded-lg border border-white/10 px-4 text-sm font-medium text-slate-300 transition hover:bg-white/5"
                        >
                            Buscar
                        </button>
                    </form>

                    {error && !modalAbierto && (
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
                            aria-label="Tabla de usuarios; desplazamiento horizontal"
                            tabIndex={0}
                        >
                            <table className="w-full min-w-[780px] text-left text-sm">
                                <thead className="border-b border-white/[0.08] bg-white/[0.025] text-xs font-medium uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">Usuario</th>
                                        <th className="px-5 py-4">Rol</th>
                                        <th className="px-5 py-4">Estado</th>
                                        <th className="px-5 py-4">Alta</th>
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
                                                    Cargando usuarios...
                                                </span>
                                            </td>
                                        </tr>
                                    ) : usuarios.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-5 py-14 text-center text-slate-400"
                                            >
                                                No se encontraron usuarios.
                                            </td>
                                        </tr>
                                    ) : (
                                        usuarios.map((usuario) => (
                                            <tr key={usuario.id}>
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-foreground">
                                                        {usuario.nombre}{" "}
                                                        {usuario.apellido}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {usuario.correo}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <label className="sr-only">
                                                        Rol de {usuario.nombre}
                                                    </label>
                                                    <select
                                                        value={usuario.rol}
                                                        disabled={
                                                            usuario.id === usuarioActualId ||
                                                            operacionId === usuario.id
                                                        }
                                                        onChange={(evento) =>
                                                            void cambiarRol(
                                                                usuario,
                                                                evento.target.value as RolUsuario,
                                                            )
                                                        }
                                                        className="rounded-md border border-white/10 bg-surface-raised px-2.5 py-2 text-xs text-slate-300 outline-none focus:border-indigo-400/70 disabled:opacity-50"
                                                    >
                                                        {roles.map((rol) => (
                                                            <option
                                                                key={rol.value}
                                                                value={rol.value}
                                                            >
                                                                {rol.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                                            usuario.activo
                                                                ? "bg-emerald-400/10 text-emerald-300"
                                                                : "bg-slate-400/10 text-slate-400"
                                                        }`}
                                                    >
                                                        {usuario.activo
                                                            ? "Activo"
                                                            : "Inactivo"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-slate-400">
                                                    {new Intl.DateTimeFormat(
                                                        "es",
                                                        { dateStyle: "medium" },
                                                    ).format(
                                                        new Date(usuario.creadaEn),
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirEdicion(usuario)
                                                            }
                                                            aria-label={`Editar ${usuario.nombre}`}
                                                            className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/5"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                usuario.id === usuarioActualId ||
                                                                operacionId === usuario.id
                                                            }
                                                            onClick={() =>
                                                                void cambiarEstado(usuario)
                                                            }
                                                            aria-label={
                                                                usuario.activo
                                                                    ? `Desactivar ${usuario.nombre}`
                                                                    : `Activar ${usuario.nombre}`
                                                            }
                                                            className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            {usuario.activo ? (
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
                    </div>

                    {paginacion.totalPaginas > 1 && (
                        <nav
                            aria-label="Paginación de usuarios"
                            className="mt-5 flex items-center justify-between"
                        >
                            <span className="text-sm text-slate-500">
                                Página {paginacion.pagina} de{" "}
                                {paginacion.totalPaginas}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={pagina <= 1 || cargando}
                                    onClick={() => {
                                        setCargando(true);
                                        setPagina((actual) => actual - 1);
                                    }}
                                    className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 disabled:opacity-40"
                                    aria-label="Página anterior"
                                >
                                    <ChevronLeft className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    disabled={
                                        pagina >= paginacion.totalPaginas ||
                                        cargando
                                    }
                                    onClick={() => {
                                        setCargando(true);
                                        setPagina((actual) => actual + 1);
                                    }}
                                    className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 disabled:opacity-40"
                                    aria-label="Página siguiente"
                                >
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        </nav>
                    )}
                </section>
            </div>

            {modalAbierto && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
                    role="presentation"
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-usuario-titulo"
                        className="w-full max-w-xl rounded-2xl border border-white/10 bg-surface-raised p-6 shadow-2xl"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2
                                    id="modal-usuario-titulo"
                                    className="text-xl font-semibold text-foreground"
                                >
                                    {usuarioEditando
                                        ? "Editar usuario"
                                        : "Nuevo usuario"}
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    {usuarioEditando
                                        ? "Actualiza sus datos básicos."
                                        : "Crea una cuenta para un miembro de tu empresa."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalAbierto(false)}
                                aria-label="Cerrar formulario"
                                className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
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

                        <form
                            onSubmit={(evento) => void guardarUsuario(evento)}
                            className="mt-6 space-y-4"
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-xs font-medium text-slate-300">
                                    Nombre
                                    <input
                                        required
                                        minLength={2}
                                        maxLength={80}
                                        value={datosFormulario.nombre}
                                        onChange={(evento) =>
                                            actualizarCampo(
                                                "nombre",
                                                evento.target.value,
                                            )
                                        }
                                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-indigo-400/70"
                                    />
                                </label>
                                <label className="block text-xs font-medium text-slate-300">
                                    Apellido
                                    <input
                                        required
                                        minLength={2}
                                        maxLength={80}
                                        value={datosFormulario.apellido}
                                        onChange={(evento) =>
                                            actualizarCampo(
                                                "apellido",
                                                evento.target.value,
                                            )
                                        }
                                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-indigo-400/70"
                                    />
                                </label>
                            </div>
                            <label className="block text-xs font-medium text-slate-300">
                                Correo electrónico
                                <input
                                    required
                                    type="email"
                                    maxLength={254}
                                    value={datosFormulario.correo}
                                    onChange={(evento) =>
                                        actualizarCampo(
                                            "correo",
                                            evento.target.value,
                                        )
                                    }
                                    className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-indigo-400/70"
                                />
                            </label>
                            {!usuarioEditando && (
                                <label className="block text-xs font-medium text-slate-300">
                                    Contraseña inicial
                                    <input
                                        required
                                        type="password"
                                        minLength={8}
                                        maxLength={72}
                                        value={datosFormulario.contrasena}
                                        onChange={(evento) =>
                                            actualizarCampo(
                                                "contrasena",
                                                evento.target.value,
                                            )
                                        }
                                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-indigo-400/70"
                                    />
                                    <span className="mt-2 block font-normal text-slate-500">
                                        Usa mayúsculas, minúsculas y un símbolo.
                                    </span>
                                </label>
                            )}
                            {!usuarioEditando && (
                                <label className="block text-xs font-medium text-slate-300">
                                    Rol
                                    <select
                                        value={datosFormulario.rol}
                                        onChange={(evento) => {
                                            if (
                                                esRolUsuario(
                                                    evento.target.value,
                                                )
                                            ) {
                                                actualizarCampo(
                                                    "rol",
                                                    evento.target.value,
                                                );
                                            }
                                        }}
                                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-surface-raised px-3 text-sm text-foreground outline-none focus:border-indigo-400/70"
                                    >
                                        {roles.map((rol) => (
                                            <option
                                                key={rol.value}
                                                value={rol.value}
                                            >
                                                {rol.label}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="mt-2 block font-normal text-slate-500">
                                        {datosFormulario.rol ===
                                        "ADMINISTRADOR"
                                            ? "Puede administrar usuarios y clientes."
                                            : datosFormulario.rol === "VENDEDOR"
                                              ? "Puede gestionar clientes."
                                              : "Rol asignado para operaciones de almacén."}
                                    </span>
                                </label>
                            )}
                            <div className="flex justify-end gap-2 border-t border-white/[0.08] pt-4">
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
                                    className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-indigo-400 disabled:opacity-50"
                                >
                                    {guardando
                                        ? "Guardando..."
                                        : usuarioEditando
                                          ? "Guardar cambios"
                                          : "Crear usuario"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
}
