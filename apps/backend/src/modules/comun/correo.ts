
/**
 * Normaliza un correo electrónico: trim y minúsculas.
 */
export function normalizarCorreo(correo: string): string {
    return correo.trim().toLowerCase();
}

export function normalizarCorreoOpcional(
    correo: string | null | undefined,
): string | null {
    if (typeof correo !== "string" || correo.trim() === "") return null;
    return normalizarCorreo(correo);
}
