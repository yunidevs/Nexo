import { AppError } from "../../errors/app-error.js";

/**
 * Normaliza el número al formato de dígitos con código de país, sin "+",
 * "00", espacios ni separadores.
 */
export function normalizarTelefono(telefono: string): string {
    const normalizado = telefono
        .replace(/[\s().-]/g, "")
        .replace(/^\+/, "")
        .replace(/^0{2}/, "");
    if (!/^\d{7,20}$/.test(normalizado)) {
        throw new AppError(
            "TELEFONO_INVALIDO",
            "El número de teléfono no es válido. Inclúyelo con el código de país, por ejemplo 598 95 123 456.",
            400,
        );
    }
    return normalizado;
}

export function normalizarTelefonoOpcional(
    telefono: string | null | undefined,
): string | null {
    if (typeof telefono !== "string" || telefono.trim() === "") return null;
    try {
        return normalizarTelefono(telefono);
    } catch (error) {
        if (error instanceof AppError && error.codigo === "TELEFONO_INVALIDO") {
            return null;
        }
        throw error;
    }
}
