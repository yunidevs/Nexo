import "dotenv/config";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "./database.js";
import { loadConfig } from "./config.js";
import { createMarketplaceService } from "./modules/marketplace/marketplace.service.js";
import { enviarCorreoSmtp, type DatosCorreo } from "./lib/correo.js";
import { redisPing, redisUrl } from "./lib/redis.js";

/**
 * Proceso trabajador de NexoERP.
 *
 * Ejecuta tareas programadas fuera del ciclo de requests HTTP, de modo que
 * el API permanece stateless y puede escalar horizontalmente. Arranque:
 *
 *   npm run worker            (desarrollo)
 *   npm run start:worker      (producción, requiere build previo)
 *
 * Las tareas se registran en `tareas` con su intervalo en milisegundos.
 * Cada ejecución está protegida: un fallo se registra y no detiene el worker.
 */

interface TareaProgramada {
    nombre: string;
    intervaloMs: number;
    ejecutar: () => Promise<unknown>;
}

const tareas: TareaProgramada[] = [];

function registrarTarea(tarea: TareaProgramada) {
    tareas.push(tarea);
    console.info(
        JSON.stringify({
            nivel: "info",
            mensaje: "worker_tarea_registrada",
            tarea: tarea.nombre,
            intervaloMs: tarea.intervaloMs,
        }),
    );
}

// Liberación de pedidos vencidos del marketplace.
// Sustituye al barrido perezoso que corre dentro de los requests de
// checkout/estado: con este worker el stock reservado se libera aunque no
// haya tráfico. Usa el mismo servicio que la API para no duplicar reglas.
registrarTarea({
    nombre: "pedidos-vencidos",
    intervaloMs: 60_000,
    ejecutar: () => marketplaceService.liberarPedidosVencidos(),
});

const config = loadConfig();
const marketplaceService = createMarketplaceService(prisma, config);

// Con Redis configurado, el worker también consume la cola de correos:
// los envíos transaccionales (recuperación de contraseña, etc.) se hacen
// aquí de forma asíncrona con reintentos, fuera del request HTTP.
let workerCorreos: Worker<DatosCorreo> | null = null;
let conexionCola: Redis | null = null;

async function iniciarColaCorreos() {
    const url = redisUrl();
    if (!url) return;

    // Si Redis está configurado pero caído, no iniciar el consumidor:
    // evita spam de reconexión y los correos siguen yéndose por SMTP
    // síncrono desde el API hasta que Redis vuelva y se reinicie el worker.
    if (!(await redisPing())) {
        console.warn(
            JSON.stringify({
                nivel: "warn",
                mensaje: "worker_cola_correos_omitida",
                detalle: "Redis no responde; cola de correos desactivada.",
            }),
        );
        return;
    }

    conexionCola = new Redis(url, { maxRetriesPerRequest: null });
    workerCorreos = new Worker<DatosCorreo>(
        "emails",
        async (job) => {
            await enviarCorreoSmtp(config, job.data);
        },
        { connection: conexionCola, concurrency: 5 },
    );
    workerCorreos.on("failed", (job, error) => {
        console.error(
            JSON.stringify({
                nivel: "error",
                mensaje: "worker_correo_fallido",
                jobId: job?.id,
                destinatario: job?.data.destinatario,
                detalle: error.message,
            }),
        );
    });
}

async function ejecutarTarea(tarea: TareaProgramada) {
    try {
        await tarea.ejecutar();
    } catch (error) {
        console.error(
            JSON.stringify({
                nivel: "error",
                mensaje: "worker_tarea_fallida",
                tarea: tarea.nombre,
                detalle: error instanceof Error ? error.message : String(error),
            }),
        );
    }
}

async function principal() {
    console.info(
        JSON.stringify({
            nivel: "info",
            mensaje: "worker_iniciado",
            tareas: tareas.map((t) => t.nombre),
            redis: redisUrl() ? "configurada" : "no_configurada",
        }),
    );

    void iniciarColaCorreos();

    // Primera ejecución inmediata de cada tarea y luego por intervalo.
    for (const tarea of tareas) {
        void ejecutarTarea(tarea);
        setInterval(() => void ejecutarTarea(tarea), tarea.intervaloMs);
    }
}

async function apagar() {
    await workerCorreos?.close();
    conexionCola?.disconnect();
    await prisma.$disconnect();
    process.exit(0);
}

process.once("SIGINT", () => void apagar());
process.once("SIGTERM", () => void apagar());

void principal();
