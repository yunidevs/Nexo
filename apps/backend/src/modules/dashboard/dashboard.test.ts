import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    calcularVariacion,
    construirCubos,
    resolverRango,
} from "./dashboard.service.js";

const ZONA = "America/Montevideo";

describe("rangos del dashboard", () => {
    it("calcula el día local completo y su día anterior", () => {
        const rango = resolverRango("dia", "2026-11-21", ZONA);

        assert.equal(rango.desde.toISOString(), "2026-11-21T03:00:00.000Z");
        assert.equal(rango.hasta.toISOString(), "2026-11-22T03:00:00.000Z");
        assert.equal(
            rango.anteriorDesde.toISOString(),
            "2026-11-20T03:00:00.000Z",
        );
        assert.equal(rango.anteriorHasta.toISOString(), rango.desde.toISOString());
        assert.equal(rango.cubos.length, 24);
        assert.equal(rango.cubos[0]?.etiqueta, "00:00");
        assert.equal(rango.cubos[23]?.etiqueta, "23:00");
        assert.equal(rango.cubos[0]?.claveLocal, "2026-11-21T00:00:00");
    });

    it("inicia la semana en lunes", () => {
        const rango = resolverRango("semana", "2026-11-21", ZONA);

        assert.equal(rango.cubos.length, 7);
        assert.equal(rango.desde.toISOString(), "2026-11-16T03:00:00.000Z");
        assert.equal(rango.hasta.toISOString(), "2026-11-23T03:00:00.000Z");
        assert.equal(
            rango.anteriorDesde.toISOString(),
            "2026-11-09T03:00:00.000Z",
        );
        assert.ok(rango.cubos[0]?.etiqueta.includes("16"));
        assert.equal(rango.cubos[0]?.claveLocal, "2026-11-16T00:00:00");
    });

    it("cubre todos los días del mes y el mes anterior", () => {
        const rango = resolverRango("mes", "2026-11-21", ZONA);

        assert.equal(rango.cubos.length, 30);
        assert.equal(rango.desde.toISOString(), "2026-11-01T03:00:00.000Z");
        assert.equal(rango.hasta.toISOString(), "2026-12-01T03:00:00.000Z");
        assert.equal(
            rango.anteriorDesde.toISOString(),
            "2026-10-01T03:00:00.000Z",
        );
        assert.equal(rango.cubos[29]?.claveLocal, "2026-11-30T00:00:00");
    });

    it("cruza correctamente el cambio de año", () => {
        const rango = resolverRango("mes", "2027-01-15", ZONA);

        assert.equal(
            rango.anteriorDesde.toISOString(),
            "2026-12-01T03:00:00.000Z",
        );
        assert.equal(rango.anteriorHasta.toISOString(), rango.desde.toISOString());
    });

    it("rechaza fechas inexistentes o con formato inválido", () => {
        for (const fecha of ["2026-02-31", "21/11/2026", "2026-13-01"]) {
            assert.throws(
                () => resolverRango("dia", fecha, ZONA),
                (error: unknown) =>
                    typeof error === "object" &&
                    error !== null &&
                    "codigo" in error &&
                    error.codigo === "FECHA_INVALIDA",
            );
        }
    });
});

describe("relleno y comparación de métricas", () => {
    it("rellena con cero los cubos sin movimientos", () => {
        const rango = resolverRango("dia", "2026-11-21", ZONA);
        const cubos = construirCubos(
            rango,
            [
                {
                    claveLocal: "2026-11-21T10:00:00",
                    ventas: "1234.50",
                    pedidos: 2,
                },
            ],
            [{ claveLocal: "2026-11-21T10:00:00", unidades: 3 }],
            [{ claveLocal: "2026-11-21T10:00:00", ingresos: "100" }],
        );

        assert.equal(cubos.length, 24);
        const conDatos = cubos.find(
            (cubo) => cubo.clave === "2026-11-21T10:00:00",
        );
        assert.deepEqual(conDatos?.metricas, {
            ventas: "1234.50",
            pedidos: 2,
            unidades: 3,
            ingresos: "100.00",
        });

        const vacio = cubos.find(
            (cubo) => cubo.clave === "2026-11-21T09:00:00",
        );
        assert.deepEqual(vacio?.metricas, {
            ventas: "0.00",
            pedidos: 0,
            unidades: 0,
            ingresos: "0.00",
        });
    });

    it("no inventa porcentajes cuando no hay base anterior", () => {
        assert.equal(calcularVariacion("100", "0"), null);
        assert.equal(calcularVariacion("0", "0"), null);
        assert.equal(calcularVariacion("150", "100"), 50);
        assert.equal(calcularVariacion("50", "100"), -50);
    });
});
