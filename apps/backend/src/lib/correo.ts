import nodemailer from "nodemailer";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { AppError } from "../errors/app-error.js";
import { redisUrl } from "./redis.js";

/**
 * Envío de correos transaccionales.
 *
 * Con `REDIS_URL` configurada, el correo se encola en BullMQ (cola
 * `emails`) y lo procesa el worker de forma asíncrona con reintentos —
 * el request HTTP no espera al SMTP. Si Redis no está disponible o la
 * cola falla, se envía de forma síncrona como antes, de modo que el
 * comportamiento nunca depende de Redis.
 */

export interface ConfigCorreo {
    mailtrapSmtpHost?: string;
    mailtrapSmtpPort?: number;
    mailtrapSmtpUser?: string;
    mailtrapSmtpPass?: string;
    mailtrapFromEmail?: string;
    mailtrapFromName?: string;
}

export interface DatosCorreo {
    destinatario: string;
    asunto: string;
    texto: string;
    html: string;
}

const NOMBRE_COLA = "emails";

let cola: Queue<DatosCorreo> | null = null;
let conexion: Redis | null = null;

function obtenerCola(): Queue<DatosCorreo> {
    if (cola) return cola;
    const url = redisUrl();
    if (!url) {
        throw new Error("REDIS_URL no configurada.");
    }
    // Productor: sin offline queue ni reintentos indefinidos para que
    // queue.add() falle rápido si Redis no responde y se use el fallback
    // SMTP síncrono en lugar de dejar el request colgado.
    conexion = new Redis(url, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
    });
    cola = new Queue<DatosCorreo>(NOMBRE_COLA, { connection: conexion });
    return cola;
}

function crearTransporte(config: ConfigCorreo) {
    return nodemailer.createTransport({
        host: config.mailtrapSmtpHost,
        port: config.mailtrapSmtpPort,
        secure: config.mailtrapSmtpPort === 465,
        auth: {
            user: config.mailtrapSmtpUser,
            pass: config.mailtrapSmtpPass,
        },
    });
}

function datosFrom(config: ConfigCorreo) {
    return {
        address: config.mailtrapFromEmail,
        name: config.mailtrapFromName ?? "NexoERP",
    };
}

/** Envía el correo por SMTP de forma síncrona (fallback y worker). */
export async function enviarCorreoSmtp(
    config: ConfigCorreo,
    datos: DatosCorreo,
): Promise<void> {
    const transport = crearTransporte(config);
    await transport.sendMail({
        from: datosFrom(config),
        to: datos.destinatario,
        subject: datos.asunto,
        text: datos.texto,
        html: datos.html,
    });
}

/**
 * Encola o envía el correo según la configuración. Lanza
 * `AppError("EMAIL_NO_DISPONIBLE")` si el envío síncrono falla; si el
 * encolado falla, reintenta por SMTP síncrono.
 */
export async function enviarCorreo(
    config: ConfigCorreo,
    datos: DatosCorreo,
): Promise<void> {
    if (redisUrl()) {
        try {
            await obtenerCola().add("enviar", datos, {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: 500,
            });
            return;
        } catch (error) {
            console.error(
                JSON.stringify({
                    nivel: "warn",
                    mensaje: "cola_correos_no_disponible",
                    detalle:
                        error instanceof Error ? error.message : String(error),
                }),
            );
        }
    }

    try {
        await enviarCorreoSmtp(config, datos);
    } catch (error) {
        console.error(
            JSON.stringify({
                nivel: "error",
                mensaje: "mailtrap_no_disponible",
                error:
                    error instanceof Error
                        ? error.message
                        : "Error desconocido",
            }),
        );
        throw new AppError(
            "EMAIL_NO_DISPONIBLE",
            "No se pudo enviar el correo. Inténtalo más tarde.",
            502,
        );
    }
}

/** Cierra la conexión del productor (apagado ordenado del API). */
export async function cerrarColaCorreos(): Promise<void> {
    await cola?.close();
    cola = null;
    conexion?.disconnect();
    conexion = null;
}
