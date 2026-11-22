import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Los enlaces de seguimiento se comparten por correo o se muestran al
 * comprador, por lo que deben seguir siendo válidos durante un tiempo
 * razonable sin obligar a iniciar sesión.
 */
const VIGENCIA_SEGUIMIENTO_MS = 30 * 24 * 60 * 60 * 1000;
const PREFIJO_FIRMA = "nexo:seguimiento:";

function firmar(
    pedidoId: string,
    expiraEn: number,
    secreto: string,
): string {
    return createHmac("sha256", secreto)
        .update(`${PREFIJO_FIRMA}${pedidoId}.${expiraEn}`)
        .digest("base64url");
}

/**
 * Genera un token HMAC con caducidad para consultar el seguimiento de un
 * pedido sin autenticación. El token no expone datos del pedido: solo
 * demuestra que quien lo posee recibió el enlace original.
 */
export function generarTokenSeguimiento(
    pedidoId: string,
    secreto: string,
): string {
    if (!secreto) {
        throw new Error(
            "No se puede firmar un token de seguimiento sin secreto configurado.",
        );
    }
    const expiraEn = Date.now() + VIGENCIA_SEGUIMIENTO_MS;
    return `${expiraEn}.${firmar(pedidoId, expiraEn, secreto)}`;
}

/**
 * Verifica firma y caducidad comparando en tiempo constante.
 */
export function verificarTokenSeguimiento(
    pedidoId: string,
    token: string,
    secreto: string,
): boolean {
    if (!secreto) return false;

    const partes = token.split(".");
    if (partes.length !== 2) return false;

    const [expiraTexto, firma] = partes;
    if (!expiraTexto || !firma) return false;

    const expiraEn = Number(expiraTexto);
    if (!Number.isSafeInteger(expiraEn) || expiraEn <= Date.now()) {
        return false;
    }

    const esperada = Buffer.from(firmar(pedidoId, expiraEn, secreto));
    const recibida = Buffer.from(firma);

    return (
        esperada.length === recibida.length &&
        timingSafeEqual(esperada, recibida)
    );
}
