import { createConnection, type Socket } from "node:net";

/**
 * Cliente Redis mínimo sobre el protocolo RESP, sin dependencias externas.
 *
 * Cubre las operaciones que necesita la plataforma hoy (GET/SET con TTL,
 * DEL, PING). Si en el futuro se requiere pub/sub, colas o pipelines
 * completos, se puede sustituir por `ioredis` sin cambiar los consumidores:
 * la API pública de este módulo ya es async y tolerante a fallos.
 *
 * Solo se activa cuando `REDIS_URL` está definida; en caso contrario
 * `redisDisponible()` devuelve false y los consumidores usan su fallback
 * en memoria. Un Redis caído nunca debe tirar abajo la API: todas las
 * operaciones devuelven null/false y registran el error una sola vez.
 */

type RespuestaRedis = string | null | number | RespuestaRedis[];

let socket: Socket | null = null;
let conectando: Promise<Socket | null> | null = null;
let secuencia = 0;
const pendientes = new Map<
    number,
    { resolver: (valor: RespuestaRedis) => void; rechazar: (error: Error) => void }
>();
let buffer: Buffer = Buffer.alloc(0);
let errorReportado = false;

function reportarError(error: unknown) {
    if (errorReportado) return;
    errorReportado = true;
    console.error(
        JSON.stringify({
            nivel: "error",
            mensaje: "redis_error",
            detalle: error instanceof Error ? error.message : String(error),
        }),
    );
}

function codificar(args: (string | number)[]): Buffer {
    const partes = [`*${args.length}\r\n`];
    for (const arg of args) {
        const valor = String(arg);
        partes.push(`$${Buffer.byteLength(valor)}\r\n${valor}\r\n`);
    }
    return Buffer.from(partes.join(""), "utf8");
}

function decodificar(bloque: Buffer): { valor: RespuestaRedis; resto: Buffer } {
    const tipo = bloque.subarray(0, 1).toString();
    const fin = bloque.indexOf("\r\n", 1);
    const linea = bloque.subarray(1, fin).toString();

    switch (tipo) {
        case "+":
            return { valor: linea, resto: bloque.subarray(fin + 2) };
        case "-":
            throw new Error(`Redis: ${linea}`);
        case ":":
            return { valor: Number(linea), resto: bloque.subarray(fin + 2) };
        case "$": {
            const longitud = Number(linea);
            if (longitud === -1) {
                return { valor: null, resto: bloque.subarray(fin + 2) };
            }
            const inicio = fin + 2;
            const valor = bloque
                .subarray(inicio, inicio + longitud)
                .toString("utf8");
            return {
                valor,
                resto: bloque.subarray(inicio + longitud + 2),
            };
        }
        case "*": {
            const cantidad = Number(linea);
            if (cantidad === -1) {
                return { valor: null, resto: bloque.subarray(fin + 2) };
            }
            const elementos: RespuestaRedis[] = [];
            let resto = bloque.subarray(fin + 2);
            for (let i = 0; i < cantidad; i += 1) {
                const decodificado = decodificar(resto);
                elementos.push(decodificado.valor);
                resto = decodificado.resto;
            }
            return { valor: elementos, resto };
        }
        default:
            throw new Error(`Respuesta Redis no reconocida: ${tipo}`);
    }
}

function procesarBuffer() {
    for (;;) {
        if (pendientes.size === 0) {
            buffer = Buffer.alloc(0);
            return;
        }
        try {
            const { valor, resto } = decodificar(buffer);
            buffer = resto;
            const siguiente = pendientes.keys().next().value;
            if (siguiente === undefined) return;
            const pendiente = pendientes.get(siguiente);
            pendientes.delete(siguiente);
            pendiente?.resolver(valor);
        } catch (error) {
            // Respuesta de error del servidor: se descarta y se rechaza
            // el comando pendiente conservando el resto del buffer.
            const fin = buffer.indexOf("\r\n");
            buffer = fin >= 0 ? buffer.subarray(fin + 2) : Buffer.alloc(0);
            const siguiente = pendientes.keys().next().value;
            const pendiente =
                siguiente !== undefined ? pendientes.get(siguiente) : undefined;
            if (pendiente) {
                pendientes.delete(siguiente as number);
                pendiente.rechazar(error instanceof Error ? error : new Error(String(error)));
            }
        }
    }
}

function conectar(url: string): Promise<Socket | null> {
    if (socket && !socket.destroyed) return Promise.resolve(socket);
    if (conectando) return conectando;

    conectando = new Promise((resolver) => {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            resolver(null);
            return;
        }

        const conexion = createConnection({
            host: parsed.hostname,
            port: Number(parsed.port) || 6379,
        });

        conexion.once("connect", () => {
            socket = conexion;
            errorReportado = false;
            resolver(conexion);
        });
        conexion.once("error", (error) => {
            reportarError(error);
            conexion.destroy();
            socket = null;
            resolver(null);
        });
        conexion.on("data", (trozo) => {
            buffer = Buffer.concat([buffer, trozo]);
            procesarBuffer();
        });
        conexion.on("close", () => {
            socket = null;
            for (const pendiente of pendientes.values()) {
                pendiente.rechazar(new Error("Conexión Redis cerrada."));
            }
            pendientes.clear();
        });
    });

    return conectando.finally(() => {
        conectando = null;
    });
}

async function ejecutar(
    url: string,
    args: (string | number)[],
): Promise<RespuestaRedis> {
    const conexion = await conectar(url);
    if (!conexion) return null;

    return new Promise((resolver, rechazar) => {
        const id = ++secuencia;
        pendientes.set(id, { resolver, rechazar });
        conexion.write(codificar(args), (error) => {
            if (error) {
                pendientes.delete(id);
                rechazar(error);
            }
        });
    });
}

/** URL configurada; null si Redis no está habilitado. */
export function redisUrl(): string | null {
    const url = process.env.REDIS_URL?.trim();
    return url ? url : null;
}

export async function redisPing(): Promise<boolean> {
    const url = redisUrl();
    if (!url) return true; // Sin Redis configurado no es una dependencia.
    try {
        return (await ejecutar(url, ["PING"])) === "PONG";
    } catch {
        return false;
    }
}

export async function redisGet(clave: string): Promise<string | null> {
    const url = redisUrl();
    if (!url) return null;
    try {
        const valor = await ejecutar(url, ["GET", clave]);
        return typeof valor === "string" ? valor : null;
    } catch (error) {
        reportarError(error);
        return null;
    }
}

export async function redisSet(
    clave: string,
    valor: string,
    ttlSegundos: number,
): Promise<boolean> {
    const url = redisUrl();
    if (!url) return false;
    try {
        const resultado = await ejecutar(url, [
            "SET",
            clave,
            valor,
            "EX",
            ttlSegundos,
        ]);
        return resultado === "OK";
    } catch (error) {
        reportarError(error);
        return false;
    }
}

export async function redisDel(clave: string): Promise<void> {
    const url = redisUrl();
    if (!url) return;
    try {
        await ejecutar(url, ["DEL", clave]);
    } catch (error) {
        reportarError(error);
    }
}

/** INCR atómico; devuelve el nuevo valor o null si Redis no responde. */
export async function redisIncr(clave: string): Promise<number | null> {
    const url = redisUrl();
    if (!url) return null;
    try {
        const valor = await ejecutar(url, ["INCR", clave]);
        return typeof valor === "number" ? valor : null;
    } catch (error) {
        reportarError(error);
        return null;
    }
}

/** PEXPIRE en milisegundos; true si se aplicó el TTL. */
export async function redisPexpire(
    clave: string,
    milisegundos: number,
): Promise<boolean> {
    const url = redisUrl();
    if (!url) return false;
    try {
        const valor = await ejecutar(url, ["PEXPIRE", clave, milisegundos]);
        return valor === 1;
    } catch (error) {
        reportarError(error);
        return false;
    }
}

/** Cierra la conexión (tests y apagado ordenado). */
export async function redisCerrar(): Promise<void> {
    socket?.destroy();
    socket = null;
}
