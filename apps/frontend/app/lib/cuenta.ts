import { apiRequest } from "@/app/lib/api";

export interface CuentaCliente {
    id: string;
    nombre: string;
    apellido: string | null;
    correo: string;
    telefono: string | null;
    direccion: string | null;
}

export interface EventoPedidoCuenta {
    estado: string;
    detalle: string;
    observaciones: string | null;
    fecha: string;
}

export interface PedidoCuenta {
    id: string;
    estado: string;
    tienda: string;
    total: string;
    creadaEn: string;
    pagadaEn: string | null;
    detalles: { nombre: string; cantidad: number }[];
    historial: EventoPedidoCuenta[];
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null;
}

function esCuenta(valor: unknown): valor is CuentaCliente {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.nombre === "string" &&
        typeof valor.correo === "string"
    );
}

export async function obtenerCuenta(): Promise<CuentaCliente | null> {
    try {
        const resultado: unknown = await apiRequest(
            "/cuenta-clientes/perfil",
        );
        if (!esObjeto(resultado) || !esCuenta(resultado.cuenta)) {
            return null;
        }
        return resultado.cuenta;
    } catch {
        return null;
    }
}

export async function cerrarSesionCuenta(): Promise<void> {
    await apiRequest("/cuenta-clientes/cerrar-sesion", "POST");
}
