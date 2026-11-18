const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const apiUnauthorizedEvent = "nexo:unauthorized";

export class ApiRequestError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string,
    ) {
        super(message);
        this.name = "ApiRequestError";
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export async function apiRequest<T extends object>(
    path: string,
    method = "GET",
    data?: T,
    headers?: Record<string, string>,
): Promise<unknown> {
    let response: Response;

    try {
        response = await fetch(`${apiBase}${path}`, {
            method,
            credentials: "include",
            headers: data
                ? { "content-type": "application/json", ...headers }
                : headers,
            body: data ? JSON.stringify(data) : undefined,
        });
    } catch {
        throw new Error(
            "No se pudo conectar con NexoERP. Comprueba que la API esté iniciada.",
        );
    }

    let result: unknown;

    try {
        result = await response.json();
    } catch {
        throw new Error("La API devolvió una respuesta que no es válida.");
    }

    if (!isRecord(result)) {
        throw new Error("La API devolvió una respuesta que no es válida.");
    }

    if (!response.ok || result.exito !== true) {
        const error = isRecord(result.error) ? result.error : undefined;
        const code =
            error && typeof error.codigo === "string"
                ? error.codigo
                : undefined;
        const message =
            error && typeof error.mensaje === "string"
                ? error.mensaje
                : "No se pudo completar la operación.";

        if (
            response.status === 401 &&
            (code === "NO_AUTENTICADO" || code === "SESION_INVALIDA") &&
            typeof window !== "undefined"
        ) {
            window.dispatchEvent(new Event(apiUnauthorizedEvent));
        }

        throw new ApiRequestError(message, response.status, code);
    }

    if ("paginacion" in result) {
        return {
            datos: result.datos,
            paginacion: result.paginacion,
        };
    }

    return result.datos;
}
