"use client";

export type MetricaGrafico = "ventas" | "pedidos" | "unidades" | "ingresos";

export interface CuboGrafico {
    clave: string;
    etiqueta: string;
    metricas: {
        ventas: string;
        pedidos: number;
        unidades: number;
        ingresos: string;
    };
}

interface GraficoPeriodoProps {
    cubos: CuboGrafico[];
    metrica: MetricaGrafico;
    etiquetasMetrica: Record<MetricaGrafico, string>;
    descripcionPeriodo: string;
}

const ANCHO = 760;
const ALTO = 300;
const MARGEN = { arriba: 18, derecha: 16, abajo: 34, izquierda: 58 };

const formatoCompacto = new Intl.NumberFormat("es-UY", {
    notation: "compact",
    maximumFractionDigits: 1,
});

const formatoCantidad = new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 0,
});

const formatoImporte = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function valorDe(cubo: CuboGrafico, metrica: MetricaGrafico): number {
    const valor = cubo.metricas[metrica];
    const numero = typeof valor === "number" ? valor : Number(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function formatearValor(valor: number, metrica: MetricaGrafico): string {
    return metrica === "ventas" || metrica === "ingresos"
        ? formatoImporte.format(valor)
        : formatoCantidad.format(valor);
}

/**
 * Redondea el máximo a un techo legible (1, 2, 5 × potencia de diez) para
 * que el eje no muestre cifras arbitrarias.
 */
function techoLegible(maximo: number): number {
    if (!Number.isFinite(maximo) || maximo <= 0) return 1;
    const magnitud = 10 ** Math.floor(Math.log10(maximo));
    const normalizado = maximo / magnitud;
    const paso =
        normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
    return paso * magnitud;
}

export function GraficoPeriodo({
    cubos,
    metrica,
    etiquetasMetrica,
    descripcionPeriodo,
}: GraficoPeriodoProps) {
    const anchoArea = ANCHO - MARGEN.izquierda - MARGEN.derecha;
    const altoArea = ALTO - MARGEN.arriba - MARGEN.abajo;
    const valores = cubos.map((cubo) => valorDe(cubo, metrica));
    const maximo = Math.max(0, ...valores);
    const techo = techoLegible(maximo);
    const paso = anchoArea / Math.max(cubos.length, 1);
    const anchoBarra = Math.max(2, Math.min(30, paso * 0.62));
    const cadaEtiqueta = Math.max(1, Math.ceil(cubos.length / 8));
    const marcas = [0, 0.25, 0.5, 0.75, 1];
    const hayDatos = maximo > 0;
    const etiquetaMetrica = etiquetasMetrica[metrica];

    const total = valores.reduce((acumulado, valor) => acumulado + valor, 0);

    return (
        <figure className="min-w-0">
            <svg
                viewBox={`0 0 ${ANCHO} ${ALTO}`}
                role="img"
                aria-label={`${etiquetaMetrica} por ${descripcionPeriodo}. Total: ${formatearValor(total, metrica)}.`}
                className="h-auto w-full overflow-visible"
            >
                <g aria-hidden="true">
                    {marcas.map((marca) => {
                        const y = MARGEN.arriba + altoArea - marca * altoArea;
                        return (
                            <g key={marca}>
                                <line
                                    x1={MARGEN.izquierda}
                                    x2={ANCHO - MARGEN.derecha}
                                    y1={y}
                                    y2={y}
                                    className="stroke-white/[0.07]"
                                    strokeDasharray={marca === 0 ? undefined : "3 5"}
                                />
                                <text
                                    x={MARGEN.izquierda - 10}
                                    y={y + 3.5}
                                    textAnchor="end"
                                    fontSize={10}
                                    className="fill-slate-500"
                                >
                                    {formatoCompacto.format(techo * marca)}
                                </text>
                            </g>
                        );
                    })}
                </g>

                {cubos.map((cubo, indice) => {
                    const valor = valores[indice] ?? 0;
                    const altura = (valor / techo) * altoArea;
                    const x =
                        MARGEN.izquierda +
                        indice * paso +
                        (paso - anchoBarra) / 2;
                    const y = MARGEN.arriba + altoArea - altura;
                    const mostrarEtiqueta =
                        indice % cadaEtiqueta === 0 ||
                        indice === cubos.length - 1;

                    return (
                        <g key={cubo.clave}>
                            {altura > 0 ? (
                                <rect
                                    x={x}
                                    y={y}
                                    width={anchoBarra}
                                    height={Math.max(altura, 1)}
                                    rx={Math.min(4, anchoBarra / 2)}
                                    className="fill-indigo-400/85 transition-[fill] duration-150 hover:fill-indigo-300 focus-visible:fill-indigo-300"
                                    tabIndex={0}
                                >
                                    <title>{`${cubo.etiqueta}: ${formatearValor(valor, metrica)}`}</title>
                                </rect>
                            ) : null}
                            {mostrarEtiqueta ? (
                                <text
                                    x={x + anchoBarra / 2}
                                    y={ALTO - 12}
                                    textAnchor="middle"
                                    fontSize={10}
                                    className="fill-slate-500"
                                >
                                    {cubo.etiqueta}
                                </text>
                            ) : null}
                        </g>
                    );
                })}

                {!hayDatos ? (
                    <text
                        x={MARGEN.izquierda + anchoArea / 2}
                        y={MARGEN.arriba + altoArea / 2}
                        textAnchor="middle"
                        fontSize={12}
                        className="fill-slate-500"
                    >
                        Sin movimientos registrados en este período
                    </text>
                ) : null}
            </svg>

            <figcaption className="mt-2 text-[11px] text-slate-500">
                {descripcionPeriodo}. Las cifras provienen de ventas confirmadas
                y pagos cobrados; los períodos sin movimientos se muestran en
                cero.
            </figcaption>

            <table className="sr-only">
                <caption>
                    {etiquetaMetrica} por {descripcionPeriodo}
                </caption>
                <thead>
                    <tr>
                        <th scope="col">Período</th>
                        <th scope="col">{etiquetaMetrica}</th>
                    </tr>
                </thead>
                <tbody>
                    {cubos.map((cubo, indice) => (
                        <tr key={cubo.clave}>
                            <th scope="row">{cubo.etiqueta}</th>
                            <td>
                                {formatearValor(valores[indice] ?? 0, metrica)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}
