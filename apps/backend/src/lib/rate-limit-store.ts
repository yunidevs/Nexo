import type { Store } from "express-rate-limit";
import { redisDel, redisIncr, redisPexpire } from "./redis.js";

/**
 * Store de rate limiting distribuido sobre Redis para express-rate-limit.
 *
 * Usa INCR + PEXPIRE (atómico por comando) bajo el prefijo `rl:`. Si Redis
 * no está configurado o falla, degrada a contadores en memoria del proceso
 * — el rate limit sigue funcionando, solo que por instancia.
 *
 * `get`/`decrement` no se usan con la configuración actual del proyecto
 * (sin skipFailedRequests ni requestPropertyName); se implementan de forma
 * mínima para cumplir la interfaz.
 */

interface ContadorLocal {
    totalHits: number;
    resetTime: number;
}

const contadoresLocales = new Map<string, ContadorLocal>();

function incrementoLocal(clave: string, windowMs: number) {
    const ahora = Date.now();
    const actual = contadoresLocales.get(clave);
    if (!actual || actual.resetTime <= ahora) {
        const nuevo = { totalHits: 1, resetTime: ahora + windowMs };
        contadoresLocales.set(clave, nuevo);
        return nuevo;
    }
    actual.totalHits += 1;
    return actual;
}

export function createRedisRateLimitStore(windowMs: number): Store {
    // Siempre devuelve un store: sin REDIS_URL o si Redis falla, increment
    // cae en los contadores locales (equivalente al store en memoria por
    // defecto de express-rate-limit).
    return {
        init() {
            // Nada que inicializar: la ventana se aplica con PEXPIRE.
        },

        async get() {
            return undefined;
        },

        async increment(key) {
            const clave = `rl:${key}`;
            const hits = await redisIncr(clave);

            if (hits === null) {
                const local = incrementoLocal(clave, windowMs);
                return {
                    totalHits: local.totalHits,
                    resetTime: new Date(local.resetTime),
                };
            }

            if (hits === 1) {
                await redisPexpire(clave, windowMs);
            }

            return {
                totalHits: hits,
                resetTime: new Date(Date.now() + windowMs),
            };
        },

        async decrement(key) {
            const clave = `rl:${key}`;
            const local = contadoresLocales.get(clave);
            if (local && local.totalHits > 0) {
                local.totalHits -= 1;
                return;
            }
            // DECR no existe en el cliente mínimo; el decrement solo se usa
            // con skipFailedRequests, que no aplicamos. No-op aceptable.
        },

        async resetKey(key) {
            contadoresLocales.delete(`rl:${key}`);
            await redisDel(`rl:${key}`);
        },
    };
}
