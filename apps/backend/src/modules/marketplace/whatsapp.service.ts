import { z } from "zod";
import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors/app-error.js";

const respuestaMensajeSchema = z.object({
    messages: z
        .array(
            z.object({
                id: z.string().min(1).max(200),
            }),
        )
        .min(1),
});

export interface WhatsappService {
    configurado: boolean;
    enviarCodigoVerificacion(destino: string, codigo: string): Promise<void>;
}

export function whatsappConfigurado(config: AppConfig): boolean {
    return Boolean(config.whatsappAccessToken && config.whatsappPhoneNumberId);
}

export function requireWhatsappConfig(
    config: AppConfig,
): asserts config is AppConfig & {
    whatsappAccessToken: string;
    whatsappPhoneNumberId: string;
} {
    if (!whatsappConfigurado(config)) {
        throw new AppError(
            "WHATSAPP_NO_CONFIGURADO",
            "La tienda todavía no tiene configuradas las credenciales de WhatsApp.",
            503,
        );
    }
}

function extraerErrorMeta(body: unknown): { codigo?: string; mensaje?: string } {
    if (typeof body !== "object" || body === null) {
        return {};
    }
    const record = body as Record<string, unknown>;
    const error =
        typeof record.error === "object" && record.error !== null
            ? (record.error as Record<string, unknown>)
            : undefined;
    const mensajeError =
        typeof error?.message === "string" ? error.message : undefined;
    const codigoError =
        typeof error?.code === "string"
            ? error.code
            : typeof error?.code === "number"
              ? String(error.code)
              : undefined;
    return {
        ...(codigoError ? { codigo: codigoError } : {}),
        ...(mensajeError ? { mensaje: mensajeError } : {}),
    };
}

function esErrorDeRed(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TypeError")
    );
}

export function createWhatsappService(
    config: AppConfig,
    fetcher: typeof fetch = fetch,
): WhatsappService {
    const baseUrl = `https://graph.facebook.com/${config.whatsappApiVersion}`;

    const enviar = async (
        destino: string,
        body: Record<string, unknown>,
        operacion: string,
    ): Promise<void> => {
        requireWhatsappConfig(config);
        let response: Response;
        try {
            response = await fetcher(`${baseUrl}/${config.whatsappPhoneNumberId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.whatsappAccessToken}`,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(15_000),
            });
        } catch (error) {
            console.error(
                JSON.stringify({
                    nivel: "error",
                    mensaje: "whatsapp_sin_respuesta",
                    operacion,
                    causa: esErrorDeRed(error) ? "timeout_o_red" : "desconocida",
                }),
            );
            throw new AppError(
                "WHATSAPP_ERROR",
                `No se pudo conectar con WhatsApp al ${operacion}.`,
                502,
            );
        }

        const texto = await response.text();
        let bodyRespuesta: unknown;
        try {
            bodyRespuesta = JSON.parse(texto);
        } catch {
            bodyRespuesta = undefined;
        }

        if (!response.ok) {
            const detalle = extraerErrorMeta(bodyRespuesta);
            console.error(
                JSON.stringify({
                    nivel: "error",
                    mensaje: "whatsapp_respuesta_no_exitosa",
                    operacion,
                    estadoHttp: response.status,
                    codigo: detalle.codigo?.slice(0, 80),
                }),
            );
            const codigo = detalle.codigo
                ? `; código ${detalle.codigo.slice(0, 80)}`
                : "";
            throw new AppError(
                "WHATSAPP_ERROR",
                `WhatsApp rechazó el envío (HTTP ${response.status}${codigo}). Comprueba que el número incluya el código de país.`,
                502,
            );
        }

        const parsed = respuestaMensajeSchema.safeParse(bodyRespuesta);
        if (!parsed.success) {
            console.error(
                JSON.stringify({
                    nivel: "error",
                    mensaje: "whatsapp_respuesta_invalida",
                    operacion,
                    estadoHttp: response.status,
                }),
            );
            throw new AppError(
                "WHATSAPP_ERROR",
                `WhatsApp devolvió una respuesta incompleta al ${operacion}.`,
                502,
            );
        }
    };

    const service: WhatsappService = {
        configurado: whatsappConfigurado(config),

        async enviarCodigoVerificacion(destino, codigo) {
            requireWhatsappConfig(config);
            if (config.whatsappOtpTemplate) {
                // Meta solo permite mensajes iniciados por la empresa fuera de
                // la ventana de 24 h mediante una plantilla de autenticación
                // aprobada (con parámetro de código en el cuerpo).
                await enviar(
                    destino,
                    {
                        messaging_product: "whatsapp",
                        to: destino,
                        type: "template",
                        template: {
                            name: config.whatsappOtpTemplate,
                            language: { code: config.whatsappOtpTemplateLang },
                            components: [
                                {
                                    type: "body",
                                    parameters: [
                                        { type: "text", text: codigo },
                                    ],
                                },
                            ],
                        },
                    },
                    "enviar la plantilla de verificación",
                );
                return;
            }
            await enviar(
                destino,
                {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: destino,
                    type: "text",
                    text: {
                        preview_url: false,
                        body: `Tu código de verificación para continuar con la compra es: ${codigo}. Vence en 10 minutos.`,
                    },
                },
                "enviar el código de verificación",
            );
        },
    };

    return service;
}
