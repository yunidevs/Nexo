"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

export interface LineaCarrito {
    productoId: string;
    sku: string;
    nombre: string;
    precioVenta: number;
    imagenUrl: string | null;
    categoria: string | null;
    stock: number;
    tiendaSlug: string;
    tiendaNombre: string;
    cantidad: number;
}

export interface GrupoCarrito {
    tiendaSlug: string;
    tiendaNombre: string;
    lineas: LineaCarrito[];
    subtotal: number;
}

const CLAVE_ALMACENAMIENTO = "nexo-mp-carrito-v1";

interface CarritoValor {
    grupos: GrupoCarrito[];
    lineas: LineaCarrito[];
    cantidadArticulos: number;
    agregar: (linea: Omit<LineaCarrito, "cantidad">, cantidad: number) => void;
    cambiarCantidad: (productoId: string, cantidad: number) => void;
    quitar: (productoId: string) => void;
    limpiarTienda: (tiendaSlug: string) => void;
}

const CarritoContexto = createContext<CarritoValor | null>(null);

function esLineaCarrito(valor: unknown): valor is LineaCarrito {
    if (typeof valor !== "object" || valor === null) return false;
    const linea = valor as Record<string, unknown>;
    return (
        typeof linea.productoId === "string" &&
        typeof linea.sku === "string" &&
        typeof linea.nombre === "string" &&
        typeof linea.precioVenta === "number" &&
        (typeof linea.imagenUrl === "string" || linea.imagenUrl === null) &&
        (typeof linea.categoria === "string" || linea.categoria === null) &&
        typeof linea.stock === "number" &&
        typeof linea.tiendaSlug === "string" &&
        typeof linea.tiendaNombre === "string" &&
        typeof linea.cantidad === "number" &&
        linea.cantidad >= 1
    );
}

export function ProveedorCarrito({ children }: { children: ReactNode }) {
    const [lineas, setLineas] = useState<LineaCarrito[]>([]);
    const [listo, setListo] = useState(false);

    useEffect(() => {
        let cancelada = false;
        void (async () => {
            try {
                const guardado = window.localStorage.getItem(CLAVE_ALMACENAMIENTO);
                if (guardado) {
                    const datos: unknown = JSON.parse(guardado);
                    if (!cancelada && Array.isArray(datos)) {
                        setLineas(datos.filter(esLineaCarrito));
                    }
                }
            } catch {
                // localStorage puede no estar disponible (privacidad estricta);
                // el carrito simplemente inicia vacío.
            }
            if (!cancelada) setListo(true);
        })();
        return () => {
            cancelada = true;
        };
    }, []);

    useEffect(() => {
        if (!listo) return;
        try {
            window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(lineas));
        } catch {
            // Si no se puede persistir, el carrito sigue funcionando en memoria.
        }
    }, [lineas, listo]);

    const agregar = useCallback(
        (linea: Omit<LineaCarrito, "cantidad">, cantidad: number) => {
            setLineas((actuales) => {
                const existente = actuales.find(
                    (l) => l.productoId === linea.productoId,
                );
                if (existente) {
                    const nuevaCantidad = Math.min(
                        linea.stock,
                        existente.cantidad + cantidad,
                    );
                    return actuales.map((l) =>
                        l.productoId === linea.productoId
                            ? { ...l, cantidad: nuevaCantidad, stock: linea.stock }
                            : l,
                    );
                }
                const cantidadInicial = Math.max(
                    1,
                    Math.min(linea.stock, cantidad),
                );
                if (cantidadInicial < 1) return actuales;
                return [...actuales, { ...linea, cantidad: cantidadInicial }];
            });
        },
        [],
    );

    const cambiarCantidad = useCallback((productoId: string, cantidad: number) => {
        setLineas((actuales) => {
            if (cantidad <= 0) {
                return actuales.filter((l) => l.productoId !== productoId);
            }
            return actuales.map((l) =>
                l.productoId === productoId
                    ? { ...l, cantidad: Math.min(l.stock, cantidad) }
                    : l,
            );
        });
    }, []);

    const quitar = useCallback((productoId: string) => {
        setLineas((actuales) =>
            actuales.filter((l) => l.productoId !== productoId),
        );
    }, []);

    const limpiarTienda = useCallback((tiendaSlug: string) => {
        setLineas((actuales) =>
            actuales.filter((l) => l.tiendaSlug !== tiendaSlug),
        );
    }, []);

    const grupos = useMemo<GrupoCarrito[]>(() => {
        const mapa = new Map<string, GrupoCarrito>();
        for (const linea of lineas) {
            const grupo = mapa.get(linea.tiendaSlug);
            if (grupo) {
                grupo.lineas.push(linea);
                grupo.subtotal += linea.precioVenta * linea.cantidad;
            } else {
                mapa.set(linea.tiendaSlug, {
                    tiendaSlug: linea.tiendaSlug,
                    tiendaNombre: linea.tiendaNombre,
                    lineas: [linea],
                    subtotal: linea.precioVenta * linea.cantidad,
                });
            }
        }
        return Array.from(mapa.values());
    }, [lineas]);

    const cantidadArticulos = useMemo(
        () => lineas.reduce((suma, linea) => suma + linea.cantidad, 0),
        [lineas],
    );

    return (
        <CarritoContexto.Provider
            value={{
                grupos,
                lineas,
                cantidadArticulos,
                agregar,
                cambiarCantidad,
                quitar,
                limpiarTienda,
            }}
        >
            {children}
        </CarritoContexto.Provider>
    );
}

export function useCarrito(): CarritoValor {
    const valor = useContext(CarritoContexto);
    if (!valor) {
        throw new Error(
            "useCarrito debe usarse dentro de un ProveedorCarrito.",
        );
    }
    return valor;
}
