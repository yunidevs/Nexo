import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./database.js";
import { cerrarColaCorreos } from "./lib/correo.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp({ config });

const server = app.listen(config.port, () => {
    console.info(
        `Servidor NexoERP ejecutándose en http://localhost:${config.port}`,
    );
});

async function closeServer() {
    server.close(async (error) => {
        if (error) {
            console.error("No se pudo cerrar el servidor correctamente.", error);
            process.exitCode = 1;
        }

        await cerrarColaCorreos();
        await prisma.$disconnect();
    });
}

process.once("SIGINT", () => void closeServer());
process.once("SIGTERM", () => void closeServer());
