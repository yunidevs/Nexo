"use client";

import {
  AlertTriangle, ArrowUpRight, Banknote, Boxes, CalendarDays,
  ContactRound, Package, RefreshCw, ShoppingBag, ShoppingCart, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePerfilWorkspace } from "@/app/components/workspace-shell";
import { apiRequest } from "@/app/lib/api";

interface ProductoStockBajo {
  id: string; sku: string; nombre: string; stock: number; stockMinimo: number;
}
interface CompraReciente {
  id: string; estado: string; total: string; creadaEn: string;
  proveedor: { nombre: string };
}
interface ProductoMasVendido {
  id: string; sku: string; nombre: string; cantidad: number;
}
interface DashboardResumen {
  ventasHoy: { total: string; cantidad: number };
  ventasMes: { total: string; cantidad: number };
  ingresosMes: string;
  productosStockBajo: { total: number; productos: ProductoStockBajo[] };
  clientesNuevos: number;
  comprasRecientes: CompraReciente[];
  productosMasVendidos: ProductoMasVendido[];
}

function esRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function esImporte(v: unknown): v is string | number {
  return (typeof v === "string" || typeof v === "number") && Number.isFinite(Number(v));
}
function esNumero(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function esDashboardResumen(v: unknown): v is DashboardResumen {
  if (!esRegistro(v)) return false;
  const hoy = v.ventasHoy, mes = v.ventasMes, stock = v.productosStockBajo;
  return esRegistro(hoy) && esImporte(hoy.total) && esNumero(hoy.cantidad) &&
    esRegistro(mes) && esImporte(mes.total) && esNumero(mes.cantidad) &&
    esImporte(v.ingresosMes) && esRegistro(stock) && esNumero(stock.total) &&
    Array.isArray(stock.productos) && stock.productos.every(p =>
      esRegistro(p) && typeof p.id === "string" && typeof p.sku === "string" &&
      typeof p.nombre === "string" && esNumero(p.stock) && esNumero(p.stockMinimo)) &&
    esNumero(v.clientesNuevos) && Array.isArray(v.comprasRecientes) &&
    v.comprasRecientes.every(c =>
      esRegistro(c) && typeof c.id === "string" && typeof c.estado === "string" &&
      esImporte(c.total) && typeof c.creadaEn === "string" &&
      esRegistro(c.proveedor) && typeof c.proveedor.nombre === "string") &&
    Array.isArray(v.productosMasVendidos) && v.productosMasVendidos.every(p =>
      esRegistro(p) && typeof p.id === "string" && typeof p.sku === "string" &&
      typeof p.nombre === "string" && esNumero(p.cantidad));
}
const importe = (v: string | number) => new Intl.NumberFormat("es-UY", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(v));
const cantidad = (v: number) => new Intl.NumberFormat("es-UY").format(v);
function fecha(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "Fecha no disponible" :
    new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function estado(v: string) {
  const labels: Record<string, string> = {
    RECIBIDA: "Recibida", PENDIENTE: "Pendiente",
    CANCELADA: "Cancelada", ANULADA: "Anulada",
  };
  return labels[v] ?? v.replaceAll("_", " ").toLowerCase();
}
function estadoClass(v: string) {
  if (v === "RECIBIDA") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  if (v === "CANCELADA" || v === "ANULADA") return "border-rose-500/20 bg-rose-500/10 text-rose-400";
  return "border-amber-500/20 bg-amber-500/10 text-amber-400";
}

function Panel({ title, description, icon: Icon, action, children, className = "" }: {
  title: string; description?: string; icon: LucideIcon; action?: ReactNode;
  children: ReactNode; className?: string;
}) {
  return <section className={`min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-raised ${className}`}>
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-slate-300"><Icon className="size-4" /></span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>;
}
function Indicador({ label, value, detail, icon: Icon, accent }: {
  label: string; value: string; detail: string; icon: LucideIcon; accent: string;
}) {
  return <article className="rounded-2xl border border-white/[0.08] bg-surface-raised p-4 transition-colors hover:border-white/[0.14] sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[13px] font-medium text-slate-400">{label}</p>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${accent}`}><Icon className="size-[17px]" /></span>
    </div>
    <p className="mt-4 text-[26px] font-semibold tracking-tight text-foreground sm:text-[28px]">{value}</p>
    <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
  </article>;
}
function Vacio({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
    <span className="grid size-10 place-items-center rounded-xl bg-white/[0.04] text-slate-500"><Package className="size-5" /></span>
    <p className="mt-3 text-sm font-medium text-slate-300">{title}</p>
    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{description}</p>
  </div>;
}
function Cargando() {
  return <div className="space-y-4 px-5 py-5" aria-label="Cargando información">
    {[1, 2, 3].map(n => <div key={n} className="flex animate-pulse items-center gap-3">
      <div className="size-9 rounded-xl bg-white/[0.06]" />
      <div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-white/[0.06]" /><div className="h-2.5 w-1/3 rounded bg-white/[0.04]" /></div>
      <div className="h-3 w-12 rounded bg-white/[0.06]" />
    </div>)}
  </div>;
}

export default function Dashboard() {
  const perfil = usePerfilWorkspace();
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);

  const cargarResumen = useCallback(async (silencioso = false) => {
    if (silencioso) {
      setActualizando(true);
    } else {
      setCargando(true);
    }
    setError("");
    try {
      const resultado: unknown = await apiRequest("/dashboard");
      if (!esDashboardResumen(resultado)) throw new Error("La API devolvió un resumen con un formato no válido.");
      setResumen(resultado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el resumen del dashboard.");
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void cargarResumen(); }, 0);
    return () => window.clearTimeout(timer);
  }, [cargarResumen]);

  const indicadores = [
    { label: "Ventas de hoy", value: resumen ? importe(resumen.ventasHoy.total) : "—",
      detail: resumen ? `${cantidad(resumen.ventasHoy.cantidad)} operaciones registradas hoy` : "Importe vendido durante el día",
      icon: ShoppingCart, accent: "bg-indigo-500/10 text-indigo-300" },
    { label: "Ventas del mes", value: resumen ? importe(resumen.ventasMes.total) : "—",
      detail: "Importe total de ventas del mes", icon: TrendingUp, accent: "bg-blue-500/10 text-blue-300" },
    { label: "Operaciones del mes", value: resumen ? cantidad(resumen.ventasMes.cantidad) : "—",
      detail: "Ventas registradas este mes", icon: ShoppingBag, accent: "bg-violet-500/10 text-violet-300" },
    { label: "Ingresos recibidos", value: resumen ? importe(resumen.ingresosMes) : "—",
      detail: "Pagos cobrados durante este mes", icon: Banknote, accent: "bg-emerald-500/10 text-emerald-300" },
    { label: "Stock bajo", value: resumen ? cantidad(resumen.productosStockBajo.total) : "—",
      detail: "Productos en o por debajo del mínimo", icon: AlertTriangle, accent: "bg-amber-500/10 text-amber-300" },
    { label: "Clientes nuevos", value: resumen ? cantidad(resumen.clientesNuevos) : "—",
      detail: "Clientes registrados este mes", icon: ContactRound, accent: "bg-cyan-500/10 text-cyan-300" },
  ];
  const maxVendido = Math.max(0, ...(resumen?.productosMasVendidos.map(p => p.cantidad) ?? []));
  const hoy = new Intl.DateTimeFormat("es-UY", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());

  return <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-8">
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-300">
          <span className="size-1.5 rounded-full bg-indigo-400" />{perfil?.empresa ?? "Nexo ERP"}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {perfil?.nombre ? `Buen día, ${perfil.nombre}` : "Panel general"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Este es el estado de tu negocio. Revisa los indicadores y detecta qué necesita atención.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 hidden items-center gap-2 text-xs capitalize text-slate-500 lg:flex"><CalendarDays className="size-4" />{hoy}</div>
        <button type="button" onClick={() => void cargarResumen(true)} disabled={cargando || actualizando}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw className={`size-4 ${actualizando ? "animate-spin" : ""}`} />Actualizar
        </button>
        <Link href="/ventas" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-on-accent transition hover:bg-indigo-400">
          <ShoppingCart className="size-4" />Ver ventas
        </Link>
      </div>
    </header>

    {error && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
        <div><p className="text-sm font-medium text-rose-300">No se pudo actualizar el dashboard</p><p className="mt-0.5 text-xs text-rose-300/70">{error}</p></div>
      </div>
      <button type="button" onClick={() => void cargarResumen()} className="shrink-0 text-left text-xs font-semibold text-rose-300 hover:text-rose-200 sm:text-right">Reintentar</button>
    </div>}

    <section aria-label="Indicadores del negocio" aria-busy={cargando}>
      <div className="mb-3"><h2 className="text-sm font-semibold text-foreground">Resumen del negocio</h2>
        <p className="mt-1 text-xs text-slate-500">Indicadores del día y del mes actual</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {indicadores.map(item => <Indicador key={item.label} {...item} />)}
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-5">
      <Panel title="Compras recientes" description="Últimos movimientos registrados" icon={ShoppingCart} className="xl:col-span-3"
        action={<Link href="/compras" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200">Ver compras <ArrowUpRight className="size-3.5" /></Link>}>
        {cargando ? <Cargando /> : !resumen?.comprasRecientes.length ?
          <Vacio title="Todavía no hay compras" description="Cuando registres compras, podrás consultar aquí los últimos movimientos." /> :
          <ul className="divide-y divide-white/[0.06]">{resumen.comprasRecientes.map(compra =>
            <li key={compra.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.02]">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-300"><ShoppingBag className="size-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{compra.proveedor.nombre}</p>
                <p className="mt-1 text-xs text-slate-500">{fecha(compra.creadaEn)}</p></div>
              <div className="flex shrink-0 flex-col items-end gap-1.5"><span className="text-sm font-semibold text-slate-200">{importe(compra.total)}</span>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${estadoClass(compra.estado)}`}>{estado(compra.estado)}</span></div>
            </li>)}</ul>}
      </Panel>

      <Panel title="Atención prioritaria" description="Elementos que requieren seguimiento" icon={AlertTriangle} className="xl:col-span-2"
        action={<Link href="/inventario" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200">Inventario <ArrowUpRight className="size-3.5" /></Link>}>
        {cargando ? <Cargando /> : !resumen?.productosStockBajo.total ?
          <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><Boxes className="size-5" /></span>
            <p className="mt-3 text-sm font-medium text-slate-200">Inventario bajo control</p>
            <p className="mt-1 text-xs text-slate-500">No hay productos por debajo de su stock mínimo.</p>
          </div> :
          <>
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3">
              <span className="text-2xl font-semibold text-amber-300">{cantidad(resumen.productosStockBajo.total)}</span>
              <p className="text-xs leading-5 text-slate-400">productos necesitan revisión o reposición</p>
            </div>
            <ul className="divide-y divide-white/[0.06]">{resumen.productosStockBajo.productos.map(p => {
              const critico = p.stock <= 0;
              return <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${critico ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-300"}`}><AlertTriangle className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{p.nombre}</p><p className="mt-0.5 text-[11px] text-slate-500">SKU {p.sku}</p></div>
                <div className="shrink-0 text-right"><p className={`text-xs font-semibold ${critico ? "text-rose-400" : "text-amber-300"}`}>{cantidad(p.stock)} / {cantidad(p.stockMinimo)}</p><p className="mt-0.5 text-[10px] text-slate-600">actual / mínimo</p></div>
              </li>;
            })}</ul>
          </>}
      </Panel>
    </section>

    <Panel title="Productos más vendidos" description="Unidades vendidas durante el mes actual" icon={TrendingUp}
      action={<Link href="/productos" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200">Ver productos <ArrowUpRight className="size-3.5" /></Link>}>
      {cargando ? <Cargando /> : !resumen?.productosMasVendidos.length ?
        <Vacio title="Aún no hay ventas de productos" description="Cuando se registren ventas, aquí aparecerán los productos con mayor movimiento." /> :
        <div className="grid gap-x-10 gap-y-5 p-5 md:grid-cols-2">{resumen.productosMasVendidos.map((p, i) => {
          const porcentaje = maxVendido > 0 ? p.cantidad / maxVendido * 100 : 0;
          return <div key={p.id} className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2"><span className="text-[11px] font-semibold tabular-nums text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{p.nombre}</p><p className="text-[10px] text-slate-600">SKU {p.sku}</p></div></div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-300">{cantidad(p.cantidad)} uds.</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.nombre}: ${p.cantidad} unidades`}>
              <div className="h-full rounded-full bg-indigo-400 transition-all duration-500" style={{ width: `${porcentaje}%` }} />
            </div>
          </div>;
        })}</div>}
    </Panel>

    <footer className="flex flex-col gap-1 border-t border-white/[0.06] pt-4 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>Los indicadores mensuales corresponden al mes calendario actual.</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" />Datos obtenidos de tu espacio de trabajo</span>
    </footer>
  </div>;
}
