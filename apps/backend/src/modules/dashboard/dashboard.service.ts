import {
    EstadoPedidoMarketplace,
    EstadoVenta,
    Prisma,
    type PrismaClient,
} from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import { redisGet, redisSet } from "../../lib/redis.js";

/**
 * Caché opcional en Redis para las agregaciones del dashboard. Sin
 * REDIS_URL se calcula siempre en vivo (comportamiento original). Los
 * valores se serializan a JSON: es lo mismo que recibe el cliente HTTP,
 * por lo que Decimal y Date conservan su representación de salida.
 */
const cachear = async <T>(
    clave: string,
    ttlSegundos: number,
    calcular: () => Promise<T>,
): Promise<T> => {
    const cacheada = await redisGet(clave);
    if (cacheada !== null) {
        try {
            return JSON.parse(cacheada) as T;
        } catch {
            // Entrada corrupta: se recalcula y se sobrescribe abajo.
        }
    }

    const valor = await calcular();
    await redisSet(clave, JSON.stringify(valor), ttlSegundos);
    return valor;
};

export interface ProductoStockBajo {
    id: string;
    sku: string;
    nombre: string;
    stock: number;
    stockMinimo: number;
}

export interface CompraReciente {
    id: string;
    estado: string;
    total: string;
    creadaEn: Date;
    proveedor: { nombre: string };
}

export interface ProductoMasVendido {
    id: string;
    sku: string;
    nombre: string;
    cantidad: number;
}

export interface DashboardResumen {
    ventasHoy: { total: string; cantidad: number };
    ventasMes: { total: string; cantidad: number };
    ingresosMes: string;
    productosStockBajo: { total: number; productos: ProductoStockBajo[] };
    clientesNuevos: number;
    comprasRecientes: CompraReciente[];
    productosMasVendidos: ProductoMasVendido[];
}

export type PeriodoEstadisticas = "dia" | "semana" | "mes";

export interface MetricasPeriodo {
    ventas: string;
    pedidos: number;
    unidades: number;
    ingresos: string;
}

export interface CuboEstadisticas {
    clave: string;
    etiqueta: string;
    desde: string;
    hasta: string;
    metricas: MetricasPeriodo;
}

export interface ComparacionMetrica {
    actual: string;
    anterior: string;
    /** Porcentaje de variación o null cuando no hay base comparable. */
    variacion: number | null;
}

export interface EstadoPedidosPeriodo {
    abiertos: number;
    completados: number;
    incidencias: number;
}

export interface EstadisticasDashboard {
    periodo: PeriodoEstadisticas;
    zonaHoraria: string;
    desde: string;
    hasta: string;
    anterior: { desde: string; hasta: string };
    cubos: CuboEstadisticas[];
    totales: MetricasPeriodo;
    comparacion: Record<
        "ventas" | "pedidos" | "unidades" | "ingresos",
        ComparacionMetrica
    >;
    estadoPedidos: EstadoPedidosPeriodo;
    generadoEn: string;
}

export interface DashboardService {
    obtenerResumen(empresaId: string): Promise<DashboardResumen>;
    obtenerEstadisticas(
        empresaId: string,
        periodo: PeriodoEstadisticas,
        fecha?: string,
    ): Promise<EstadisticasDashboard>;
}

// ============================================================
// ZONA HORARIA Y RANGOS
// ============================================================

const ZONA_POR_DEFECTO = "America/Montevideo";

interface PartesFecha {
    anio: number;
    mes: number;
    dia: number;
    hora: number;
    minuto: number;
    segundo: number;
}

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateadorZona(zona: string): Intl.DateTimeFormat {
    const existente = formateadores.get(zona);
    if (existente) return existente;

    const formateador = new Intl.DateTimeFormat("en-US", {
        timeZone: zona,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    formateadores.set(zona, formateador);
    return formateador;
}

function partesEnZona(instante: Date, zona: string): PartesFecha {
    const partes = formateadorZona(zona).formatToParts(instante);
    const valor = (tipo: Intl.DateTimeFormatPartTypes, porDefecto = 0) => {
        const parte = partes.find((item) => item.type === tipo);
        const numero = Number(parte?.value);
        return Number.isFinite(numero) ? numero : porDefecto;
    };

    return {
        anio: valor("year"),
        mes: valor("month"),
        dia: valor("day"),
        hora: valor("hour"),
        minuto: valor("minute"),
        segundo: valor("second"),
    };
}

/**
 * Diferencia (en milisegundos) entre el reloj de pared de la zona y UTC.
 * Uruguay no aplica horario de verano, pero el cálculo funciona para
 * cualquier zona IANA con cambios estacionales.
 */
function desplazamientoZona(instante: Date, zona: string): number {
    const partes = partesEnZona(instante, zona);
    const comoUtc = Date.UTC(
        partes.anio,
        partes.mes - 1,
        partes.dia,
        partes.hora,
        partes.minuto,
        partes.segundo,
    );
    const instanteEnSegundos = Math.floor(instante.getTime() / 1000) * 1000;
    return comoUtc - instanteEnSegundos;
}

/** Convierte una fecha/hora local de la zona al instante UTC equivalente. */
function instanteEnZona(
    anio: number,
    mes: number,
    dia: number,
    hora: number,
    zona: string,
): Date {
    const objetivo = Date.UTC(anio, mes - 1, dia, hora, 0, 0, 0);
    const primerIntento =
        objetivo - desplazamientoZona(new Date(objetivo), zona);
    const segundoIntento =
        objetivo - desplazamientoZona(new Date(primerIntento), zona);

    return new Date(
        segundoIntento !== primerIntento ? segundoIntento : primerIntento,
    );
}

interface FechaCalendario {
    anio: number;
    mes: number;
    dia: number;
}

function parsearFecha(fecha: string): FechaCalendario {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new AppError(
            "FECHA_INVALIDA",
            "La fecha debe tener el formato AAAA-MM-DD.",
            400,
        );
    }

    const anio = Number(fecha.slice(0, 4));
    const mes = Number(fecha.slice(5, 7));
    const dia = Number(fecha.slice(8, 10));
    const control = new Date(Date.UTC(anio, mes - 1, dia));

    if (
        control.getUTCFullYear() !== anio ||
        control.getUTCMonth() !== mes - 1 ||
        control.getUTCDate() !== dia
    ) {
        throw new AppError(
            "FECHA_INVALIDA",
            "La fecha indicada no existe en el calendario.",
            400,
        );
    }

    return { anio, mes, dia };
}

export interface CuboRango {
    inicio: Date;
    fin: Date;
    etiqueta: string;
    /** Clave de reloj de pared local, usada para unir las filas de SQL. */
    claveLocal: string;
    trunc: "hour" | "day";
}

export interface RangoEstadisticas {
    periodo: PeriodoEstadisticas;
    desde: Date;
    hasta: Date;
    anteriorDesde: Date;
    anteriorHasta: Date;
    cubos: CuboRango[];
}

const pad = (valor: number) => String(valor).padStart(2, "0");

const formatoDiaSemana = new Intl.DateTimeFormat("es-UY", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
});

const formatoDiaMes = new Intl.DateTimeFormat("es-UY", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
});

function crearCubo(
    anio: number,
    mes: number,
    dia: number,
    hora: number,
    trunc: "hour" | "day",
    zona: string,
    etiqueta: string,
): CuboRango {
    const inicio = instanteEnZona(anio, mes, dia, hora, zona);
    const fin =
        trunc === "hour"
            ? instanteEnZona(anio, mes, dia, hora + 1, zona)
            : instanteEnZona(anio, mes, dia + 1, 0, zona);
    const claveLocal =
        trunc === "hour"
            ? `${anio}-${pad(mes)}-${pad(dia)}T${pad(hora)}:00:00`
            : `${anio}-${pad(mes)}-${pad(dia)}T00:00:00`;

    return { inicio, fin, etiqueta, claveLocal, trunc };
}

/**
 * Calcula los límites locales del período solicitado y del período anterior
 * equivalente. Las fechas se interpretan en la zona horaria del dashboard,
 * nunca en UTC, para que "hoy" coincida con el día del negocio.
 */
export function resolverRango(
    periodo: PeriodoEstadisticas,
    fecha: string | undefined,
    zona: string,
    ahora: Date = new Date(),
): RangoEstadisticas {
    const base = fecha
        ? parsearFecha(fecha)
        : (() => {
              const partes = partesEnZona(ahora, zona);
              return {
                  anio: partes.anio,
                  mes: partes.mes,
                  dia: partes.dia,
              };
          })();

    if (periodo === "dia") {
        const desde = instanteEnZona(base.anio, base.mes, base.dia, 0, zona);
        const hasta = instanteEnZona(
            base.anio,
            base.mes,
            base.dia + 1,
            0,
            zona,
        );
        const anteriorDesde = instanteEnZona(
            base.anio,
            base.mes,
            base.dia - 1,
            0,
            zona,
        );
        const cubos: CuboRango[] = [];

        for (let hora = 0; hora < 24; hora += 1) {
            cubos.push(
                crearCubo(
                    base.anio,
                    base.mes,
                    base.dia,
                    hora,
                    "hour",
                    zona,
                    `${pad(hora)}:00`,
                ),
            );
        }

        return {
            periodo,
            desde,
            hasta,
            anteriorDesde,
            anteriorHasta: desde,
            cubos,
        };
    }

    if (periodo === "semana") {
        const referencia = new Date(
            Date.UTC(base.anio, base.mes - 1, base.dia),
        );
        const diaSemana = (referencia.getUTCDay() + 6) % 7;
        const lunes = new Date(
            Date.UTC(base.anio, base.mes - 1, base.dia - diaSemana),
        );
        const lunesAnterior = new Date(lunes.getTime() - 7 * 86_400_000);
        const domingo = new Date(lunes.getTime() + 7 * 86_400_000);

        const cubos: CuboRango[] = [];
        for (let indice = 0; indice < 7; indice += 1) {
            const dia = new Date(lunes.getTime() + indice * 86_400_000);
            cubos.push(
                crearCubo(
                    dia.getUTCFullYear(),
                    dia.getUTCMonth() + 1,
                    dia.getUTCDate(),
                    0,
                    "day",
                    zona,
                    formatoDiaSemana.format(dia),
                ),
            );
        }

        return {
            periodo,
            desde: instanteEnZona(
                lunes.getUTCFullYear(),
                lunes.getUTCMonth() + 1,
                lunes.getUTCDate(),
                0,
                zona,
            ),
            hasta: instanteEnZona(
                domingo.getUTCFullYear(),
                domingo.getUTCMonth() + 1,
                domingo.getUTCDate(),
                0,
                zona,
            ),
            anteriorDesde: instanteEnZona(
                lunesAnterior.getUTCFullYear(),
                lunesAnterior.getUTCMonth() + 1,
                lunesAnterior.getUTCDate(),
                0,
                zona,
            ),
            anteriorHasta: instanteEnZona(
                lunes.getUTCFullYear(),
                lunes.getUTCMonth() + 1,
                lunes.getUTCDate(),
                0,
                zona,
            ),
            cubos,
        };
    }

    const diasDelMes = new Date(
        Date.UTC(base.anio, base.mes, 0),
    ).getUTCDate();
    const cubos: CuboRango[] = [];

    for (let dia = 1; dia <= diasDelMes; dia += 1) {
        const fechaCubo = new Date(Date.UTC(base.anio, base.mes - 1, dia));
        cubos.push(
            crearCubo(
                base.anio,
                base.mes,
                dia,
                0,
                "day",
                zona,
                formatoDiaMes.format(fechaCubo),
            ),
        );
    }

    const desde = instanteEnZona(base.anio, base.mes, 1, 0, zona);
    const hasta = instanteEnZona(base.anio, base.mes + 1, 1, 0, zona);
    const anteriorDesde = instanteEnZona(
        base.anio,
        base.mes - 1,
        1,
        0,
        zona,
    );

    return {
        periodo,
        desde,
        hasta,
        anteriorDesde,
        anteriorHasta: desde,
        cubos,
    };
}

// ============================================================
// AGREGACIÓN
// ============================================================

interface FilaVentas {
    claveLocal: string;
    ventas: string;
    pedidos: number;
}

interface FilaUnidades {
    claveLocal: string;
    unidades: number;
}

interface FilaIngresos {
    claveLocal: string;
    ingresos: string;
}

async function consultarVentas(
    prisma: PrismaClient,
    empresaId: string,
    rango: { desde: Date; hasta: Date },
    trunc: "hour" | "day",
    zona: string,
): Promise<FilaVentas[]> {
    return prisma.$queryRaw<FilaVentas[]>(Prisma.sql`
        SELECT
            to_char(
                date_trunc(
                    ${trunc}::text,
                    (v."creada_en" AT TIME ZONE 'UTC') AT TIME ZONE ${zona}::text
                ),
                'YYYY-MM-DD"T"HH24:MI:SS'
            ) AS "claveLocal",
            COALESCE(SUM(v."total"), 0)::text AS "ventas",
            COUNT(*)::int AS "pedidos"
        FROM "ventas" v
        WHERE v."empresa_id" = ${empresaId}::uuid
          AND v."estado" = ${EstadoVenta.CONFIRMADA}::"EstadoVenta"
          AND v."creada_en" >= (${rango.desde.toISOString()}::timestamptz AT TIME ZONE 'UTC')
          AND v."creada_en" < (${rango.hasta.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
        ORDER BY 1
    `);
}

async function consultarUnidades(
    prisma: PrismaClient,
    empresaId: string,
    rango: { desde: Date; hasta: Date },
    trunc: "hour" | "day",
    zona: string,
): Promise<FilaUnidades[]> {
    return prisma.$queryRaw<FilaUnidades[]>(Prisma.sql`
        SELECT
            to_char(
                date_trunc(
                    ${trunc}::text,
                    (v."creada_en" AT TIME ZONE 'UTC') AT TIME ZONE ${zona}::text
                ),
                'YYYY-MM-DD"T"HH24:MI:SS'
            ) AS "claveLocal",
            COALESCE(SUM(d."cantidad"), 0)::int AS "unidades"
        FROM "detalles_ventas" d
        JOIN "ventas" v ON v."id" = d."venta_id"
        WHERE v."empresa_id" = ${empresaId}::uuid
          AND v."estado" = ${EstadoVenta.CONFIRMADA}::"EstadoVenta"
          AND v."creada_en" >= (${rango.desde.toISOString()}::timestamptz AT TIME ZONE 'UTC')
          AND v."creada_en" < (${rango.hasta.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
        ORDER BY 1
    `);
}

async function consultarIngresos(
    prisma: PrismaClient,
    empresaId: string,
    rango: { desde: Date; hasta: Date },
    trunc: "hour" | "day",
    zona: string,
): Promise<FilaIngresos[]> {
    return prisma.$queryRaw<FilaIngresos[]>(Prisma.sql`
        SELECT
            to_char(
                date_trunc(
                    ${trunc}::text,
                    (p."creada_en" AT TIME ZONE 'UTC') AT TIME ZONE ${zona}::text
                ),
                'YYYY-MM-DD"T"HH24:MI:SS'
            ) AS "claveLocal",
            COALESCE(SUM(p."monto"), 0)::text AS "ingresos"
        FROM "pagos_ventas" p
        JOIN "ventas" v ON v."id" = p."venta_id"
        WHERE v."empresa_id" = ${empresaId}::uuid
          AND v."estado" = ${EstadoVenta.CONFIRMADA}::"EstadoVenta"
          AND p."creada_en" >= (${rango.desde.toISOString()}::timestamptz AT TIME ZONE 'UTC')
          AND p."creada_en" < (${rango.hasta.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
        ORDER BY 1
    `);
}

const importe = (valor: string) => new Prisma.Decimal(valor || 0).toFixed(2);

/** Construye los cubos del gráfico rellenando con cero los períodos vacíos. */
export function construirCubos(
    rango: RangoEstadisticas,
    ventas: FilaVentas[],
    unidades: FilaUnidades[],
    ingresos: FilaIngresos[],
): CuboEstadisticas[] {
    const mapaVentas = new Map(ventas.map((fila) => [fila.claveLocal, fila]));
    const mapaUnidades = new Map(
        unidades.map((fila) => [fila.claveLocal, fila]),
    );
    const mapaIngresos = new Map(
        ingresos.map((fila) => [fila.claveLocal, fila]),
    );

    return rango.cubos.map((cubo) => {
        const filaVentas = mapaVentas.get(cubo.claveLocal);
        const filaUnidades = mapaUnidades.get(cubo.claveLocal);
        const filaIngresos = mapaIngresos.get(cubo.claveLocal);

        return {
            clave: cubo.claveLocal,
            etiqueta: cubo.etiqueta,
            desde: cubo.inicio.toISOString(),
            hasta: cubo.fin.toISOString(),
            metricas: {
                ventas: importe(filaVentas?.ventas ?? "0"),
                pedidos: filaVentas?.pedidos ?? 0,
                unidades: filaUnidades?.unidades ?? 0,
                ingresos: importe(filaIngresos?.ingresos ?? "0"),
            },
        };
    });
}

function sumarMetricas(
    ventas: FilaVentas[],
    unidades: FilaUnidades[],
    ingresos: FilaIngresos[],
): MetricasPeriodo {
    return {
        ventas: ventas
            .reduce(
                (total, fila) => total.plus(fila.ventas),
                new Prisma.Decimal(0),
            )
            .toFixed(2),
        pedidos: ventas.reduce((total, fila) => total + fila.pedidos, 0),
        unidades: unidades.reduce(
            (total, fila) => total + fila.unidades,
            0,
        ),
        ingresos: ingresos
            .reduce(
                (total, fila) => total.plus(fila.ingresos),
                new Prisma.Decimal(0),
            )
            .toFixed(2),
    };
}

export function calcularVariacion(
    actual: string,
    anterior: string,
): number | null {
    const valorActual = Number(actual);
    const valorAnterior = Number(anterior);

    if (!Number.isFinite(valorActual) || !Number.isFinite(valorAnterior)) {
        return null;
    }
    // Sin base no se puede calcular un porcentaje honesto.
    if (valorAnterior === 0) return null;

    return Number(
        (((valorActual - valorAnterior) / valorAnterior) * 100).toFixed(1),
    );
}

function compararMetrica(
    actual: string,
    anterior: string,
): ComparacionMetrica {
    return {
        actual,
        anterior,
        variacion: calcularVariacion(actual, anterior),
    };
}

const ESTADOS_ABIERTOS = new Set<EstadoPedidoMarketplace>([
    EstadoPedidoMarketplace.PENDIENTE_PAGO,
    EstadoPedidoMarketplace.PAGO_CONFIRMADO,
    EstadoPedidoMarketplace.PREPARANDO,
    EstadoPedidoMarketplace.DESPACHADO,
    EstadoPedidoMarketplace.ENVIADO,
    EstadoPedidoMarketplace.EN_TRANSITO,
    EstadoPedidoMarketplace.EN_REPARTO,
    EstadoPedidoMarketplace.INCIDENCIA,
    EstadoPedidoMarketplace.ENTREGA_FALLIDA,
]);

const ESTADOS_INCIDENCIA = new Set<EstadoPedidoMarketplace>([
    EstadoPedidoMarketplace.INCIDENCIA,
    EstadoPedidoMarketplace.ENTREGA_FALLIDA,
    EstadoPedidoMarketplace.PAGO_RECHAZADO,
]);

async function consultarEstadoPedidos(
    prisma: PrismaClient,
    empresaId: string,
    rango: { desde: Date; hasta: Date },
): Promise<EstadoPedidosPeriodo> {
    const agrupados = await prisma.pedidoMarketplace.groupBy({
        by: ["estado"],
        where: {
            empresaId,
            creadaEn: { gte: rango.desde, lt: rango.hasta },
        },
        _count: { _all: true },
    });

    let abiertos = 0;
    let completados = 0;
    let incidencias = 0;

    for (const grupo of agrupados) {
        const cantidad = grupo._count._all;
        if (ESTADOS_ABIERTOS.has(grupo.estado)) abiertos += cantidad;
        if (ESTADOS_INCIDENCIA.has(grupo.estado)) incidencias += cantidad;
        if (grupo.estado === EstadoPedidoMarketplace.ENTREGADO) {
            completados += cantidad;
        }
    }

    return { abiertos, completados, incidencias };
}

const obtenerEstadisticas = async (
    prisma: PrismaClient,
    empresaId: string,
    zonaHoraria: string,
    periodo: PeriodoEstadisticas,
    fecha: string | undefined,
): Promise<EstadisticasDashboard> => {
    const rango = resolverRango(periodo, fecha, zonaHoraria);
    const trunc = rango.cubos[0]?.trunc ?? "day";
    const rangoActual = { desde: rango.desde, hasta: rango.hasta };
    const rangoAnterior = {
        desde: rango.anteriorDesde,
        hasta: rango.anteriorHasta,
    };

    const [
        ventasActuales,
        unidadesActuales,
        ingresosActuales,
        ventasAnteriores,
        unidadesAnteriores,
        ingresosAnteriores,
        estadoPedidos,
    ] = await Promise.all([
        consultarVentas(prisma, empresaId, rangoActual, trunc, zonaHoraria),
        consultarUnidades(prisma, empresaId, rangoActual, trunc, zonaHoraria),
        consultarIngresos(prisma, empresaId, rangoActual, trunc, zonaHoraria),
        consultarVentas(prisma, empresaId, rangoAnterior, trunc, zonaHoraria),
        consultarUnidades(
            prisma,
            empresaId,
            rangoAnterior,
            trunc,
            zonaHoraria,
        ),
        consultarIngresos(
            prisma,
            empresaId,
            rangoAnterior,
            trunc,
            zonaHoraria,
        ),
        consultarEstadoPedidos(prisma, empresaId, rangoActual),
    ]);

    const cubos = construirCubos(
        rango,
        ventasActuales,
        unidadesActuales,
        ingresosActuales,
    );
    const totales = sumarMetricas(
        ventasActuales,
        unidadesActuales,
        ingresosActuales,
    );
    const totalesAnteriores = sumarMetricas(
        ventasAnteriores,
        unidadesAnteriores,
        ingresosAnteriores,
    );

    return {
        periodo,
        zonaHoraria,
        desde: rango.desde.toISOString(),
        hasta: rango.hasta.toISOString(),
        anterior: {
            desde: rango.anteriorDesde.toISOString(),
            hasta: rango.anteriorHasta.toISOString(),
        },
        cubos,
        totales,
        comparacion: {
            ventas: compararMetrica(
                totales.ventas,
                totalesAnteriores.ventas,
            ),
            pedidos: compararMetrica(
                String(totales.pedidos),
                String(totalesAnteriores.pedidos),
            ),
            unidades: compararMetrica(
                String(totales.unidades),
                String(totalesAnteriores.unidades),
            ),
            ingresos: compararMetrica(
                totales.ingresos,
                totalesAnteriores.ingresos,
            ),
        },
        estadoPedidos,
        generadoEn: new Date().toISOString(),
    };
};

// ============================================================
// RESUMEN EXISTENTE
// ============================================================

const obtenerResumen = async (
    prisma: PrismaClient,
    empresaId: string,
    zonaHoraria: string,
): Promise<DashboardResumen> => {
    const rangoDia = resolverRango("dia", undefined, zonaHoraria);
    const rangoMes = resolverRango("mes", undefined, zonaHoraria);
    const inicioHoy = rangoDia.desde;
    const inicioManana = rangoDia.hasta;
    const inicioMes = rangoMes.desde;
    const finMes = rangoMes.hasta;

    const filtroVentasHoy: Prisma.VentaWhereInput = {
        empresaId,
        estado: EstadoVenta.CONFIRMADA,
        creadaEn: { gte: inicioHoy, lt: inicioManana },
    };
    const filtroVentasMes: Prisma.VentaWhereInput = {
        empresaId,
        estado: EstadoVenta.CONFIRMADA,
        creadaEn: { gte: inicioMes, lt: finMes },
    };
    const filtroStockBajo: Prisma.ProductoWhereInput = {
        empresaId,
        activo: true,
        stock: { lte: prisma.producto.fields.stockMinimo },
    };

    const [
        agregadoHoy,
        cantidadVentasHoy,
        agregadoMes,
        cantidadVentasMes,
        agregadoIngresosMes,
        totalProductosStockBajo,
        productosStockBajo,
        clientesNuevos,
        comprasRecientes,
        productosAgrupados,
    ] = await Promise.all([
        prisma.venta.aggregate({
            where: filtroVentasHoy,
            _sum: { total: true },
        }),
        prisma.venta.count({ where: filtroVentasHoy }),
        prisma.venta.aggregate({
            where: filtroVentasMes,
            _sum: { total: true },
        }),
        prisma.venta.count({ where: filtroVentasMes }),
        prisma.pagoVenta.aggregate({
            where: {
                creadaEn: { gte: inicioMes, lt: finMes },
                venta: { empresaId, estado: EstadoVenta.CONFIRMADA },
            },
            _sum: { monto: true },
        }),
        prisma.producto.count({ where: filtroStockBajo }),
        prisma.producto.findMany({
            where: filtroStockBajo,
            select: {
                id: true,
                sku: true,
                nombre: true,
                stock: true,
                stockMinimo: true,
            },
            orderBy: [{ stock: "asc" }, { nombre: "asc" }],
            take: 5,
        }),
        prisma.cliente.count({
            where: {
                empresaId,
                creadaEn: { gte: inicioMes, lt: finMes },
            },
        }),
        prisma.compra.findMany({
            where: { empresaId },
            select: {
                id: true,
                estado: true,
                total: true,
                creadaEn: true,
                proveedor: { select: { nombre: true } },
            },
            orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
            take: 5,
        }),
        prisma.detalleVenta.groupBy({
            by: ["productoId"],
            where: { venta: filtroVentasMes },
            _sum: { cantidad: true },
            orderBy: { _sum: { cantidad: "desc" } },
            take: 5,
        }),
    ]);

    const idsProductos = productosAgrupados.map(({ productoId }) => productoId);
    const productos = idsProductos.length
        ? await prisma.producto.findMany({
              where: { empresaId, id: { in: idsProductos } },
              select: { id: true, sku: true, nombre: true },
          })
        : [];
    const productosPorId = new Map(
        productos.map((producto) => [producto.id, producto]),
    );

    return {
        ventasHoy: {
            total: agregadoHoy._sum.total?.toString() ?? "0",
            cantidad: cantidadVentasHoy,
        },
        ventasMes: {
            total: agregadoMes._sum.total?.toString() ?? "0",
            cantidad: cantidadVentasMes,
        },
        ingresosMes: agregadoIngresosMes._sum.monto?.toString() ?? "0",
        productosStockBajo: {
            total: totalProductosStockBajo,
            productos: productosStockBajo,
        },
        clientesNuevos,
        comprasRecientes: comprasRecientes.map((compra) => ({
            ...compra,
            total: compra.total.toString(),
        })),
        productosMasVendidos: productosAgrupados.flatMap((producto) => {
            const datos = productosPorId.get(producto.productoId);
            return datos
                ? [
                      {
                          ...datos,
                          cantidad: producto._sum.cantidad ?? 0,
                      },
                  ]
                : [];
        }),
    };
};

export const createDashboardService = (
    prisma: PrismaClient,
    zonaHoraria: string = ZONA_POR_DEFECTO,
): DashboardService => ({
    obtenerResumen: (empresaId) =>
        cachear(`dash:resumen:${empresaId}`, 30, () =>
            obtenerResumen(prisma, empresaId, zonaHoraria),
        ),
    obtenerEstadisticas: (empresaId, periodo, fecha) =>
        cachear(`dash:stats:${empresaId}:${periodo}:${fecha}`, 300, () =>
            obtenerEstadisticas(prisma, empresaId, zonaHoraria, periodo, fecha),
        ),
});
