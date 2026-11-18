import {
    ArrowRight,
    Banknote,
    Boxes,
    CreditCard,
    FileText,
    LayoutDashboard,
    Package,
    Search,
    ShoppingBag,
    ShoppingCart,
    TrendingUp,
    Truck,
    Users,
    type LucideIcon,
} from "lucide-react";

/**
 * Vista previa del ERP para la portada. Reproduce la estructura real del
 * panel de gestión (resumen, clientes, productos, inventario, proveedores,
 * ventas y reportes; indicadores del día y del mes, gráfico de ventas,
 * pedidos recientes y aviso de stock bajo) con la paleta de marca.
 */

interface EntradaMenu {
    nombre: string;
    icono: LucideIcon;
    activa?: boolean;
}

const MENU: { grupo: string; entradas: EntradaMenu[] }[] = [
    {
        grupo: "General",
        entradas: [{ nombre: "Resumen", icono: LayoutDashboard, activa: true }],
    },
    {
        grupo: "Gestión",
        entradas: [
            { nombre: "Clientes", icono: Users },
            { nombre: "Productos", icono: Package },
            { nombre: "Inventario", icono: Boxes },
            { nombre: "Proveedores", icono: Truck },
            { nombre: "Ventas", icono: CreditCard },
            { nombre: "Reportes", icono: FileText },
        ],
    },
];

const INDICADORES: {
    etiqueta: string;
    valor: string;
    variacion: string;
    icono: LucideIcon;
}[] = [
    {
        etiqueta: "Ventas de hoy",
        valor: "18.420,00",
        variacion: "+8,4%",
        icono: ShoppingCart,
    },
    {
        etiqueta: "Ventas del mes",
        valor: "312.860,00",
        variacion: "+12,1%",
        icono: TrendingUp,
    },
    {
        etiqueta: "Operaciones",
        valor: "1.248",
        variacion: "+6,2%",
        icono: ShoppingBag,
    },
    {
        etiqueta: "Ingresos recibidos",
        valor: "246.500,00",
        variacion: "+9,8%",
        icono: Banknote,
    },
];

const PEDIDOS = [
    {
        iniciales: "MC",
        nombre: "María Castro",
        detalle: "Pedido #10482",
        importe: "+1.240,00",
    },
    {
        iniciales: "JR",
        nombre: "Javier Ríos",
        detalle: "Pedido #10481",
        importe: "+860,00",
    },
    {
        iniciales: "AL",
        nombre: "Ana López",
        detalle: "Pedido #10480",
        importe: "+540,00",
    },
];

const MESES = ["Ene", "Mar", "May", "Jul", "Sep", "Nov"];

export function DashboardPreview() {
    return (
        <div className="relative h-full w-full">
            {/* Capa de profundidad: una lámina de lima asoma por detrás. */}
            <div
                aria-hidden="true"
                className="absolute left-0 top-4 -bottom-3 -right-3 hidden rounded-[20px] bg-[#C9DD93] lg:block"
            />
            <div className="relative flex h-full w-full overflow-hidden rounded-[18px] border border-[#25382A]/12 bg-[#FBFAF6] shadow-[0_42px_90px_-38px_rgba(37,56,42,.6)]">
                <aside className="hidden w-[164px] shrink-0 flex-col bg-[#1E2C22] px-3 py-4 xl:flex">
                    <div className="mb-5 flex items-center gap-2 px-1.5">
                        <span className="grid size-6 place-items-center rounded-[7px] bg-[#D9E8A5] text-[#25382A]">
                            <LayoutDashboard
                                className="size-3.5"
                                strokeWidth={2.2}
                            />
                        </span>
                        <span className="text-[11px] font-bold tracking-[-0.01em] text-[#EDF0E7]">
                            NEXO ERP
                        </span>
                    </div>

                    <nav
                        className="flex flex-col gap-4"
                        aria-label="Menú del panel de gestión"
                    >
                        {MENU.map((seccion) => (
                            <div key={seccion.grupo}>
                                <p className="mb-1.5 px-1.5 text-[8px] font-semibold tracking-[0.16em] text-[#7E8F81] uppercase">
                                    {seccion.grupo}
                                </p>
                                <ul className="flex flex-col gap-0.5">
                                    {seccion.entradas.map((entrada) => {
                                        const Icono = entrada.icono;
                                        return (
                                            <li key={entrada.nombre}>
                                                <span
                                                    className={`flex items-center gap-2 rounded-[6px] px-1.5 py-[5px] text-[10px] font-medium ${
                                                        entrada.activa
                                                            ? "bg-[#D9E8A5]/12 text-[#D9E8A5]"
                                                            : "text-[#A9B5A8]"
                                                    }`}
                                                >
                                                    <Icono className="size-3.5 shrink-0" />
                                                    {entrada.nombre}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>

                    <div className="mt-auto flex items-center gap-2 border-t border-white/10 px-1.5 pt-3">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#D9E8A5] text-[9px] font-bold text-[#25382A]">
                            CG
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-[9.5px] font-medium text-[#EDF0E7]">
                                Carlos García
                            </span>
                            <span className="block truncate text-[8.5px] text-[#7E8F81]">
                                Casa Botánica
                            </span>
                        </span>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-[#25382A]/8 px-3.5">
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-semibold tracking-[-0.01em] text-[#252723]">
                                Resumen
                            </p>
                            <p className="truncate text-[8.5px] text-[#7E8177]">
                                Casa Botánica · lunes 24 de junio
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="grid size-6 place-items-center rounded-[7px] border border-[#25382A]/10 text-[#7E8177]">
                                <Search className="size-3" />
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full border border-[#25382A]/10 py-1 pl-1 pr-2">
                                <span className="grid size-5 place-items-center rounded-full bg-[#25382A] text-[8px] font-bold text-[#F4F1E8]">
                                    CG
                                </span>
                                <span className="hidden text-[9px] font-medium text-[#55584F] sm:block">
                                    Administrador
                                </span>
                            </span>
                        </div>
                    </header>

                    <div className="grid grid-cols-2 gap-2 px-3.5 pt-3 sm:grid-cols-4">
                        {INDICADORES.map((indicador) => {
                            const Icono = indicador.icono;
                            return (
                                <div
                                    key={indicador.etiqueta}
                                    className="rounded-[10px] border border-[#25382A]/8 bg-[#F5F3EA] px-2.5 py-2"
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="truncate text-[8px] text-[#7E8177]">
                                            {indicador.etiqueta}
                                        </span>
                                        <Icono
                                            className="size-3 shrink-0 text-[#697A52]"
                                            strokeWidth={1.8}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-[#252723]">
                                        {indicador.valor}
                                    </p>
                                    <p className="mt-0.5 text-[8.5px] font-medium text-[#697A52]">
                                        {indicador.variacion}
                                        <span className="font-normal text-[#9A9C93]">
                                            {" "}
                                            vs. mes anterior
                                        </span>
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 px-3.5 py-3 sm:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)]">
                        <section className="flex min-h-0 min-w-0 flex-col rounded-[10px] border border-[#25382A]/8 bg-[#F5F3EA] p-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-[8.5px] text-[#7E8177]">
                                        Rendimiento
                                    </p>
                                    <p className="mt-0.5 text-[11px] font-semibold tracking-[-0.01em] text-[#252723]">
                                        Ventas mensuales
                                    </p>
                                </div>
                                <span className="rounded-[6px] border border-[#25382A]/10 px-1.5 py-0.5 text-[8px] text-[#55584F]">
                                    Este año
                                </span>
                            </div>

                            <div className="relative mt-2 min-h-[86px] flex-1">
                                <div className="absolute inset-y-0 left-0 flex flex-col justify-between text-[7.5px] text-[#A3A69C]">
                                    <span>30k</span>
                                    <span>20k</span>
                                    <span>10k</span>
                                    <span>0</span>
                                </div>
                                <div className="absolute inset-y-0 left-8 right-0">
                                    <svg
                                        className="h-full w-full overflow-visible"
                                        viewBox="0 0 400 120"
                                        preserveAspectRatio="none"
                                        role="img"
                                        aria-label="Gráfico de ventas mensuales al alza"
                                    >
                                        <defs>
                                            <linearGradient
                                                id="nexo-landing-ventas"
                                                x1="0"
                                                x2="0"
                                                y1="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0"
                                                    stopColor="#A7B69A"
                                                    stopOpacity=".55"
                                                />
                                                <stop
                                                    offset="1"
                                                    stopColor="#A7B69A"
                                                    stopOpacity="0"
                                                />
                                            </linearGradient>
                                        </defs>
                                        <g
                                            stroke="rgba(37,56,42,.09)"
                                            strokeWidth="1"
                                            vectorEffect="non-scaling-stroke"
                                        >
                                            <line x1="0" y1="0" x2="400" y2="0" />
                                            <line x1="0" y1="40" x2="400" y2="40" />
                                            <line x1="0" y1="80" x2="400" y2="80" />
                                            <line x1="0" y1="119" x2="400" y2="119" />
                                        </g>
                                        <path
                                            className="landing-area"
                                            d="M0 104 C26 100 48 96 72 88 C96 80 112 92 136 76 C160 60 178 74 202 60 C226 46 244 58 268 44 C292 30 310 42 334 30 C358 18 378 24 400 12 L400 120 L0 120 Z"
                                            fill="url(#nexo-landing-ventas)"
                                        />
                                        <path
                                            className="landing-trazo"
                                            d="M0 104 C26 100 48 96 72 88 C96 80 112 92 136 76 C160 60 178 74 202 60 C226 46 244 58 268 44 C292 30 310 42 334 30 C358 18 378 24 400 12"
                                            fill="none"
                                            stroke="#3F5C33"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    </svg>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 left-8 flex justify-between text-[7.5px] text-[#A3A69C]">
                                    {MESES.map((mes) => (
                                        <span key={mes}>{mes}</span>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="flex min-h-0 min-w-0 flex-col rounded-[10px] border border-[#25382A]/8 bg-[#F5F3EA] p-2.5">
                            <div>
                                <p className="text-[8.5px] text-[#7E8177]">
                                    Actividad
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold tracking-[-0.01em] text-[#252723]">
                                    Últimos pedidos
                                </p>
                            </div>
                            <ul className="mt-2 flex flex-col gap-2">
                                {PEDIDOS.map((pedido) => (
                                    <li
                                        key={pedido.nombre}
                                        className="flex items-center gap-2"
                                    >
                                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#25382A]/8 text-[8px] font-bold text-[#3F5C33]">
                                            {pedido.iniciales}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[9.5px] font-medium text-[#252723]">
                                                {pedido.nombre}
                                            </span>
                                            <span className="block truncate text-[8px] text-[#9A9C93]">
                                                {pedido.detalle}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-[9.5px] font-semibold text-[#697A52]">
                                            {pedido.importe}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#25382A]/8 pt-2">
                                <span className="text-[8.5px] text-[#9A9C93]">
                                    Ventas del mes
                                </span>
                                <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold text-[#3F5C33]">
                                    Ver todas
                                    <ArrowRight
                                        className="size-2.5"
                                        strokeWidth={2}
                                    />
                                </span>
                            </div>
                        </section>
                    </div>

                    <div className="mx-3.5 mb-3 flex items-center justify-between gap-3 rounded-[10px] border border-[#25382A]/8 bg-[#F5F3EA] px-2.5 py-2">
                        <div className="flex items-center gap-2">
                            <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-[#D9E8A5]/60 text-[#3F5C33]">
                                <Boxes className="size-3.5" strokeWidth={1.9} />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-[9.5px] font-medium text-[#252723]">
                                    Stock bajo
                                </p>
                                <p className="truncate text-[8px] text-[#9A9C93]">
                                    12 productos requieren atención
                                </p>
                            </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold text-[#3F5C33]">
                            Revisar
                            <ArrowRight className="size-3" strokeWidth={2} />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
