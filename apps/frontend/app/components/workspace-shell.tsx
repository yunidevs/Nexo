"use client";

import {
    Bell,
    Boxes,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    FileText,
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    Tag,
    Truck,
    Settings,
    ShoppingCart,
    Store,
    Users,
    UserRound,
    X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    createContext,
    memo,
    type Dispatch,
    type KeyboardEvent,
    type ReactNode,
    type SetStateAction,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
    apiRequest,
    apiUnauthorizedEvent,
    ApiRequestError,
} from "@/app/lib/api";

export interface PerfilWorkspace {
    nombre: string;
    apellido: string;
    correo: string;
    empresa: string;
    rol: string;
}

const PerfilWorkspaceContext = createContext<PerfilWorkspace | null>(null);

export function usePerfilWorkspace() {
    return useContext(PerfilWorkspaceContext);
}

interface WorkspaceShellProps {
    perfil?: PerfilWorkspace;
    onLogout?: () => void | Promise<void>;
    children: ReactNode;
}

const grupos: Array<{
    nombre: string;
    items: Array<{
        nombre: string;
        href: string;
        icono: LucideIcon;
        roles?: string[];
    }>;
    soloAdministradores?: boolean;
}> = [
    {
        nombre: "General",
        items: [
            {
                nombre: "Resumen",
                href: "/dashboard",
                icono: LayoutDashboard,
            },
        ],
    },
    {
        nombre: "Gestión",
        items: [
            { nombre: "Clientes", href: "/clientes", icono: Users },
            { nombre: "Productos", href: "/productos", icono: Package },
            { nombre: "Inventario", href: "/inventario", icono: Boxes },
            { nombre: "Categorías", href: "/categorias", icono: Tag },
            {
                nombre: "Proveedores",
                href: "/proveedores",
                icono: Truck,
                roles: ["ADMINISTRADOR", "VENDEDOR"],
            },
            {
                nombre: "Compras",
                href: "/compras",
                icono: ShoppingCart,
                roles: ["ADMINISTRADOR", "VENDEDOR"],
            },
            {
                nombre: "Ventas",
                href: "/ventas",
                icono: CreditCard,
                roles: ["ADMINISTRADOR", "VENDEDOR"],
            },
            {
                nombre: "Marketplace",
                href: "/marketplace/gestion",
                icono: Store,
                roles: ["ADMINISTRADOR", "VENDEDOR"],
            },
            {
                nombre: "Reportes",
                href: "/reportes",
                icono: FileText,
                roles: ["ADMINISTRADOR", "VENDEDOR"],
            },
        ],
    },
    {
        nombre: "Administración",
        items: [{ nombre: "Usuarios", href: "/usuarios", icono: UserRound }],
        soloAdministradores: true,
    },
];

const tituloPorRuta: Record<string, string> = {
    "/dashboard": "Resumen",
    "/clientes": "Clientes",
    "/productos": "Productos",
    "/inventario": "Inventario",
    "/categorias": "Categorías",
    "/proveedores": "Proveedores",
    "/compras": "Compras",
    "/ventas": "Ventas",
    "/marketplace/gestion": "Marketplace",
    "/reportes": "Reportes",
    "/empresa": "Empresa",
    "/usuarios": "Usuarios",
};

function esPerfilWorkspace(valor: unknown): valor is PerfilWorkspace {
    if (typeof valor !== "object" || valor === null) return false;

    return (
        "nombre" in valor &&
        typeof valor.nombre === "string" &&
        "apellido" in valor &&
        typeof valor.apellido === "string" &&
        "correo" in valor &&
        typeof valor.correo === "string" &&
        "empresa" in valor &&
        typeof valor.empresa === "string" &&
        "rol" in valor &&
        typeof valor.rol === "string"
    );
}

const WorkspaceNavigation = memo(function WorkspaceNavigation({
    pathname,
    rol,
    contraido,
    grupoAbierto,
    setGrupoAbierto,
    setMenuMovilAbierto,
}: {
    pathname: string;
    rol: string | undefined;
    contraido: boolean;
    grupoAbierto: string | null;
    setGrupoAbierto: Dispatch<SetStateAction<string | null>>;
    setMenuMovilAbierto: Dispatch<SetStateAction<boolean>>;
}) {
    return (
        <nav
            className="flex-1 space-y-5 overflow-y-auto px-3 py-5"
            aria-label="Navegación principal"
        >
            {grupos
                .filter(
                    (grupo) =>
                        !grupo.soloAdministradores || rol === "ADMINISTRADOR",
                )
                .map((grupo) => {
                    const expandido =
                        grupoAbierto === null ||
                        grupoAbierto === grupo.nombre;

                    return (
                        <section key={grupo.nombre}>
                            <button
                                type="button"
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition hover:text-slate-300 ${
                                    contraido ? "lg:justify-center" : ""
                                }`}
                                aria-expanded={expandido}
                                onClick={() =>
                                    setGrupoAbierto(
                                        expandido ? "" : grupo.nombre,
                                    )
                                }
                                title={contraido ? grupo.nombre : undefined}
                            >
                                <span className={contraido ? "lg:hidden" : ""}>
                                    {grupo.nombre}
                                </span>
                                <ChevronDown
                                    className={`size-3.5 transition-transform ${
                                        expandido ? "" : "-rotate-90"
                                    } ${contraido ? "lg:hidden" : ""}`}
                                />
                                <span
                                    className={`hidden size-1.5 rounded-full bg-slate-600 ${
                                        contraido ? "lg:block" : ""
                                    }`}
                                />
                            </button>
                            {expandido && (
                                <ul className="mt-1 space-y-1">
                                    {grupo.items
                                        .filter(
                                            (item) =>
                                                !item.roles ||
                                                item.roles.includes(rol ?? ""),
                                        )
                                        .map((item) => {
                                            const activo =
                                                pathname === item.href;
                                            const Icono = item.icono;

                                            return (
                                                <li key={item.href}>
                                                    <Link
                                                        href={item.href}
                                                        onClick={() =>
                                                            setMenuMovilAbierto(
                                                                false,
                                                            )
                                                        }
                                                        title={
                                                            contraido
                                                                ? item.nombre
                                                                : undefined
                                                        }
                                                        aria-current={
                                                            activo
                                                                ? "page"
                                                                : undefined
                                                        }
                                                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${
                                                            activo
                                                                ? "bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-400/15"
                                                                : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"
                                                        } ${
                                                            contraido
                                                                ? "lg:justify-center lg:px-0"
                                                                : ""
                                                        }`}
                                                    >
                                                        <Icono className="size-4 shrink-0" />
                                                        <span
                                                            className={
                                                                contraido
                                                                    ? "lg:hidden"
                                                                    : ""
                                                            }
                                                        >
                                                            {item.nombre}
                                                        </span>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                </ul>
                            )}
                        </section>
                    );
                })}
        </nav>
    );
});

export function WorkspaceShell({
    perfil,
    onLogout,
    children,
}: WorkspaceShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [contraido, setContraido] = useState(false);
    const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
    const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
    const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
    const [usuarioMenuAbierto, setUsuarioMenuAbierto] = useState(false);
    const [perfilInterno, setPerfilInterno] =
        useState<PerfilWorkspace | null>(null);
    const [estadoPerfil, setEstadoPerfil] = useState<
        "cargando" | "autenticado" | "error"
    >(perfil ? "autenticado" : "cargando");
    const [intentoPerfil, setIntentoPerfil] = useState(0);
    const [errorPerfil, setErrorPerfil] = useState("");
    const [errorCerrarSesion, setErrorCerrarSesion] = useState("");
    const perfilActual = perfil ?? perfilInterno;
    const botonMenuMovil = useRef<HTMLButtonElement>(null);
    const botonCerrarMenuMovil = useRef<HTMLButtonElement>(null);
    const menuMovilEstabaAbierto = useRef(false);

    useEffect(() => {
        if (menuMovilAbierto) {
            menuMovilEstabaAbierto.current = true;
            botonCerrarMenuMovil.current?.focus();
            return;
        }

        if (menuMovilEstabaAbierto.current) {
            menuMovilEstabaAbierto.current = false;
            botonMenuMovil.current?.focus();
        }
    }, [menuMovilAbierto]);

    function gestionarTecladoMenu(evento: KeyboardEvent<HTMLElement>) {
        if (evento.key === "Escape") {
            evento.preventDefault();
            setMenuMovilAbierto(false);
            return;
        }

        if (evento.key !== "Tab") return;

        const elementosEnfocables = Array.from(
            evento.currentTarget.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
        ).filter((elemento) => elemento.offsetParent !== null);
        const primero = elementosEnfocables[0];
        const ultimo = elementosEnfocables[elementosEnfocables.length - 1];

        if (!primero || !ultimo) {
            evento.preventDefault();
        } else if (evento.shiftKey && document.activeElement === primero) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primero.focus();
        }
    }

    useEffect(() => {
        if (perfil) return;

        let cancelada = false;

        async function cargarPerfil() {
            try {
                const datos = await apiRequest("/autenticacion/perfil");
                const usuario =
                    typeof datos === "object" &&
                    datos !== null &&
                    "usuario" in datos
                        ? datos.usuario
                        : null;

                if (!esPerfilWorkspace(usuario)) {
                    throw new Error("La API devolvió un perfil no válido.");
                }

                if (!cancelada) {
                    setPerfilInterno(usuario);
                    setEstadoPerfil("autenticado");
                }
            } catch (error) {
                if (!cancelada) {
                    if (
                        error instanceof ApiRequestError &&
                        error.status === 401
                    ) {
                        router.replace("/auth/login");
                        return;
                    }

                    setErrorPerfil(
                        error instanceof Error
                            ? error.message
                            : "No se pudo cargar el perfil de usuario.",
                    );
                    setEstadoPerfil("error");
                }
            }
        }

        void cargarPerfil();

        return () => {
            cancelada = true;
        };
    }, [perfil, intentoPerfil, router]);

    useEffect(() => {
        function manejarSesionNoAutenticada() {
            setPerfilInterno(null);
            setEstadoPerfil("cargando");
            router.replace("/auth/login");
        }

        window.addEventListener(apiUnauthorizedEvent, manejarSesionNoAutenticada);

        return () => {
            window.removeEventListener(
                apiUnauthorizedEvent,
                manejarSesionNoAutenticada,
            );
        };
    }, [router]);

    async function cerrarSesion() {
        setErrorCerrarSesion("");

        try {
            await apiRequest("/autenticacion/cerrar-sesion", "POST");
            router.push("/auth/login");
        } catch (error) {
            setErrorCerrarSesion(
                error instanceof Error
                    ? error.message
                    : "No se pudo cerrar la sesión.",
            );
        }
    }

    if (estadoPerfil !== "autenticado" || !perfilActual) {
        return (
            <main className="erp-root flex min-h-screen items-center justify-center bg-background px-5 text-slate-100">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-raised p-6 text-center">
                    {estadoPerfil === "cargando" ? (
                        <>
                            <p className="text-sm font-medium text-foreground">
                                Verificando tu sesión...
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                                Espera mientras comprobamos tu acceso.
                            </p>
                        </>
                    ) : (
                        <>
                            <p
                                role="alert"
                                className="text-sm font-medium text-rose-200"
                            >
                                {errorPerfil}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setErrorPerfil("");
                                    setEstadoPerfil("cargando");
                                    setIntentoPerfil((intento) => intento + 1);
                                }}
                                className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-on-accent transition hover:bg-indigo-400"
                            >
                                Reintentar
                            </button>
                        </>
                    )}
                </div>
            </main>
        );
    }

    return (
        <PerfilWorkspaceContext.Provider value={perfilActual}>
        <div className="erp-root flex min-h-screen bg-background text-slate-100">
            {menuMovilAbierto && (
                <button
                    type="button"
                    aria-label="Cerrar menú de navegación"
                    className="fixed inset-0 z-30 bg-black/70 lg:hidden"
                    onClick={() => setMenuMovilAbierto(false)}
                />
            )}

            <aside
                id="workspace-navigation"
                role={menuMovilAbierto ? "dialog" : undefined}
                aria-label={menuMovilAbierto ? "Menú de navegación" : undefined}
                aria-modal={menuMovilAbierto ? true : undefined}
                onKeyDown={menuMovilAbierto ? gestionarTecladoMenu : undefined}
                className={`fixed inset-y-0 left-0 z-40 flex w-68 flex-col border-r border-white/[0.07] bg-surface transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
                    menuMovilAbierto ? "translate-x-0" : "-translate-x-full"
                } ${contraido ? "lg:w-20" : "lg:w-68"}`}
            >
                <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
                    <Link
                        href="/dashboard"
                        className={`flex min-w-0 items-center gap-2.5 ${
                            contraido ? "lg:hidden" : ""
                        }`}
                        onClick={() => setMenuMovilAbierto(false)}
                        aria-label="Nexo ERP, ir al resumen"
                    >
                        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-indigo-500 text-on-accent">
                            <LayoutDashboard
                                className="size-4"
                                strokeWidth={2.5}
                            />
                        </span>
                        <span className="text-[15px] font-bold tracking-[-0.03em] text-foreground">
                            NEXOERP<span className="text-indigo-400">.</span>
                        </span>
                    </Link>
                    <button
                        type="button"
                        className="hidden size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-foreground lg:grid"
                        aria-label={
                            contraido
                                ? "Expandir barra lateral"
                                : "Contraer barra lateral"
                        }
                        onClick={() => setContraido((actual) => !actual)}
                    >
                        {contraido ? (
                            <ChevronRight className="size-4" />
                        ) : (
                            <ChevronLeft className="size-4" />
                        )}
                    </button>
                    <button
                        type="button"
                        ref={botonCerrarMenuMovil}
                        className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-foreground lg:hidden"
                        aria-label="Cerrar menú"
                        onClick={() => setMenuMovilAbierto(false)}
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {contraido && (
                    <Link
                        href="/dashboard"
                        className="hidden h-14 items-center justify-center border-b border-white/[0.07] text-[11px] font-bold text-foreground lg:flex"
                        title="Nexo ERP"
                        aria-label="Nexo ERP, ir al resumen"
                    >
                        N<span className="text-indigo-400">.</span>
                    </Link>
                )}

                <WorkspaceNavigation
                    pathname={pathname}
                    rol={perfilActual?.rol}
                    contraido={contraido}
                    grupoAbierto={grupoAbierto}
                    setGrupoAbierto={setGrupoAbierto}
                    setMenuMovilAbierto={setMenuMovilAbierto}
                />

                <div
                    className={`border-t border-white/[0.07] p-3 ${
                        contraido ? "lg:px-2" : ""
                    }`}
                >
                    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-200">
                            {perfilActual
                                ? `${perfilActual.nombre.charAt(0)}${perfilActual.apellido.charAt(0)}`
                                : "NE"}
                        </span>
                        <div
                            className={`min-w-0 flex-1 ${
                                contraido ? "lg:hidden" : ""
                            }`}
                        >
                            <p className="truncate text-xs font-medium text-slate-200">
                                {perfilActual
                                    ? `${perfilActual.nombre} ${perfilActual.apellido}`
                                    : "Cargando cuenta"}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                                {perfilActual?.empresa ?? "Nexo ERP"}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            <div
                className="flex min-h-screen min-w-0 flex-1 flex-col"
                inert={menuMovilAbierto}
            >
                <header className="sticky top-0 z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-white/[0.07] bg-background/95 px-5 backdrop-blur sm:px-7">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/[0.05] lg:hidden"
                            aria-label="Abrir menú de navegación"
                            aria-expanded={menuMovilAbierto}
                            aria-controls="workspace-navigation"
                            ref={botonMenuMovil}
                            onClick={() =>
                                setMenuMovilAbierto((actual) => !actual)
                            }
                        >
                            <Menu className="size-4" />
                        </button>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                                {tituloPorRuta[pathname] ?? "Espacio de trabajo"}
                            </p>
                            <p className="hidden text-[11px] text-slate-500 sm:block">
                                {perfilActual?.empresa ?? "Nexo ERP"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <div className="relative">
                            <button
                                type="button"
                                className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-foreground"
                                aria-label="Notificaciones"
                                aria-expanded={notificacionesAbiertas}
                                onClick={() =>
                                    setNotificacionesAbiertas(
                                        (actual) => !actual,
                                    )
                                }
                            >
                                <Bell className="size-[17px]" />
                            </button>
                            {notificacionesAbiertas && (
                                <div
                                    role="status"
                                    className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-white/10 bg-surface-raised p-4 shadow-2xl"
                                >
                                    <p className="text-xs font-semibold text-foreground">
                                        Notificaciones
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-slate-400">
                                        Las notificaciones de tu organización
                                        aparecerán aquí.
                                    </p>
                                </div>
                            )}
                        </div>

                        <Link
                            href="/empresa"
                            className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-foreground"
                            aria-label="Configuración de la empresa"
                            title="Configuración de la empresa"
                        >
                            <Settings className="size-[17px]" />
                        </Link>

                        <div className="relative ml-1">
                            <button
                                type="button"
                                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition hover:bg-white/[0.06]"
                                aria-label="Menú de usuario"
                                aria-expanded={usuarioMenuAbierto}
                                onClick={() =>
                                    setUsuarioMenuAbierto((actual) => !actual)
                                }
                            >
                                <span className="grid size-8 place-items-center rounded-full bg-indigo-500/15 text-[11px] font-semibold text-indigo-200">
                                    {perfilActual
                                        ? `${perfilActual.nombre.charAt(0)}${perfilActual.apellido.charAt(0)}`
                                        : "NE"}
                                </span>
                                <ChevronDown className="hidden size-3.5 text-slate-500 sm:block" />
                            </button>
                            {usuarioMenuAbierto && (
                                <div className="absolute right-0 top-12 z-30 w-60 rounded-xl border border-white/10 bg-surface-raised p-2 shadow-2xl">
                                    <div className="border-b border-white/[0.07] px-3 py-2">
                                        <p className="truncate text-xs font-medium text-foreground">
                                            {perfilActual
                                                ? `${perfilActual.nombre} ${perfilActual.apellido}`
                                                : "Cuenta"}
                                        </p>
                                        {perfilActual && (
                                            <p className="mt-1 truncate text-[11px] text-slate-500">
                                                {perfilActual.correo}
                                            </p>
                                        )}
                                    </div>
                                    {perfilActual && (
                                        <p className="px-3 py-2 text-[10px] capitalize text-slate-500">
                                            {perfilActual.rol
                                                .toLowerCase()
                                                .replaceAll("_", " ")}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void (onLogout
                                                ? onLogout()
                                                : cerrarSesion())
                                        }
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-foreground"
                                    >
                                        <LogOut className="size-3.5" />
                                        Cerrar sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="w-full flex-1 px-5 py-7 sm:px-7 lg:px-9">
                    {(errorPerfil || errorCerrarSesion) && (
                        <div
                            role="alert"
                            className="mx-auto mb-6 flex w-full max-w-7xl items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
                        >
                            <span>{errorPerfil || errorCerrarSesion}</span>
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
        </PerfilWorkspaceContext.Provider>
    );
}
