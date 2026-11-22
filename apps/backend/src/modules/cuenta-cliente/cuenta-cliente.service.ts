import { randomBytes, createHash } from "node:crypto";
import { hash, compare } from "bcryptjs";
import { SignJWT } from "jose";
import {
    type EstadoPedidoMarketplace,
    type Prisma,
    type PrismaClient,
} from "@prisma/client";

import { AppError } from "../../errors/app-error.js";
import { enviarCorreo } from "../../lib/correo.js";
import { normalizarCorreo } from "../comun/correo.js";
import { normalizarTelefonoOpcional } from "../comun/telefono.js";
import {
    sessionDurationSeconds,
    type ConfiguracionRecuperacion,
} from "../auth/auth.service.js";

const hashRounds = 12;
const resetTokenDurationMs = 60 * 60 * 1000;

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return entities[character] ?? character;
    });
}

// ============================================================
// TIPOS
// ============================================================

export interface DatosRegistroCliente {
    nombre: string;
    apellido?: string | undefined;
    correo: string;
    contrasena: string;
    telefono?: string | undefined;
}

export interface DatosInicioSesionCliente {
    correo: string;
    contrasena: string;
}

export interface DatosRestablecerCliente {
    token: string;
    contrasena: string;
}

export interface DatosPerfilCliente {
    nombre?: string | undefined;
    apellido?: string | null | undefined;
    telefono?: string | null | undefined;
    direccion?: string | null | undefined;
}

export interface CuentaClientePublica {
    id: string;
    nombre: string;
    apellido: string | null;
    correo: string;
    telefono: string | null;
    direccion: string | null;
}

export interface PedidoCliente {
    id: string;
    estado: string;
    tienda: string;
    total: string;
    creadaEn: Date;
    pagadaEn: Date | null;
    detalles: { nombre: string; cantidad: number }[];
    historial: {
        estado: string;
        detalle: string;
        observaciones: string | null;
        fecha: Date;
    }[];
}

export interface ClienteCuentaService {
    registrar(datos: DatosRegistroCliente): Promise<CuentaClientePublica>;
    iniciarSesion(
        datos: DatosInicioSesionCliente,
    ): Promise<CuentaClientePublica>;
    validarSesion(id: string): Promise<boolean>;
    createToken(cuenta: CuentaClientePublica): Promise<string>;
    solicitarRecuperacion(correo: string): Promise<void>;
    restablecerContrasena(datos: DatosRestablecerCliente): Promise<void>;
    obtenerPerfil(id: string): Promise<CuentaClientePublica>;
    actualizarPerfil(
        id: string,
        datos: DatosPerfilCliente,
    ): Promise<CuentaClientePublica>;
    vincularHistorial(id: string): Promise<{ pedidos: number; clientes: number }>;
    listarPedidos(id: string): Promise<PedidoCliente[]>;
    obtenerPedido(id: string, pedidoId: string): Promise<PedidoCliente>;
}

// ============================================================
// HELPERS
// ============================================================

const selectCuenta = {
    id: true,
    nombre: true,
    apellido: true,
    correo: true,
    telefono: true,
    direccion: true,
} as const;

const selectPedidoCliente = {
    id: true,
    estado: true,
    total: true,
    creadaEn: true,
    pagadaEn: true,
    empresa: { select: { nombre: true } },
    detalles: { select: { nombre: true, cantidad: true } },
    historial: {
        orderBy: { creadaEn: "desc" as const },
        select: {
            estado: true,
            detalle: true,
            observaciones: true,
            creadaEn: true,
        },
    },
} as const;

type FilaPedido = {
    id: string;
    estado: EstadoPedidoMarketplace;
    total: Prisma.Decimal;
    creadaEn: Date;
    pagadaEn: Date | null;
    empresa: { nombre: string };
    detalles: { nombre: string; cantidad: number }[];
    historial: {
        estado: EstadoPedidoMarketplace;
        detalle: string;
        observaciones: string | null;
        creadaEn: Date;
    }[];
};

const aPedidoCliente = (fila: FilaPedido): PedidoCliente => ({
    id: fila.id,
    estado: fila.estado,
    tienda: fila.empresa.nombre,
    total: fila.total.toFixed(2),
    creadaEn: fila.creadaEn,
    pagadaEn: fila.pagadaEn,
    detalles: fila.detalles,
    historial: fila.historial.map((evento) => ({
        estado: evento.estado,
        detalle: evento.detalle,
        observaciones: evento.observaciones,
        fecha: evento.creadaEn,
    })),
});

// ============================================================
// SERVICIO
// ============================================================

export const createClienteCuentaService = (
    prisma: PrismaClient,
    jwtSecret: string,
    recoveryConfig: ConfiguracionRecuperacion = {},
): ClienteCuentaService => {
    const credencialesInvalidas = () =>
        new AppError(
            "CREDENCIALES_INVALIDAS",
            "El correo o la contraseña son incorrectos.",
            401,
        );

    const obtenerCuenta = async (id: string) => {
        const cuenta = await prisma.cuentaCliente.findFirst({
            where: { id, activo: true },
            select: { ...selectCuenta, correoNormalizado: true },
        });
        if (!cuenta) {
            throw new AppError(
                "SESION_INVALIDA",
                "La sesión ya no es válida.",
                401,
            );
        }
        return cuenta;
    };

    return {
        async registrar(datos) {
            const correoNormalizado = normalizarCorreo(datos.correo);
            const contrasenaHash = await hash(datos.contrasena, hashRounds);
            const telefonoNormalizado = normalizarTelefonoOpcional(
                datos.telefono,
            );

            try {
                const cuenta = await prisma.cuentaCliente.create({
                    data: {
                        correo: datos.correo.trim(),
                        correoNormalizado,
                        nombre: datos.nombre,
                        apellido: datos.apellido?.trim() || null,
                        contrasenaHash,
                        telefono: datos.telefono?.trim() || null,
                        telefonoNormalizado,
                    },
                    select: selectCuenta,
                });
                return cuenta;
            } catch (error) {
                if (
                    error instanceof Error &&
                    "code" in error &&
                    error.code === "P2002"
                ) {
                    throw new AppError(
                        "CORREO_REGISTRADO",
                        "Ya existe una cuenta con este correo.",
                        409,
                    );
                }
                throw error;
            }
        },

        async iniciarSesion(datos) {
            const correoNormalizado = normalizarCorreo(datos.correo);
            const cuenta = await prisma.cuentaCliente.findUnique({
                where: { correoNormalizado },
                select: {
                    ...selectCuenta,
                    activo: true,
                    contrasenaHash: true,
                },
            });

            if (
                !cuenta ||
                !cuenta.activo ||
                !(await compare(datos.contrasena, cuenta.contrasenaHash))
            ) {
                throw credencialesInvalidas();
            }

            const { contrasenaHash: _omitido, activo: _activo, ...publica } =
                cuenta;
            return publica;
        },

        async validarSesion(id) {
            const cuenta = await prisma.cuentaCliente.findFirst({
                where: { id, activo: true },
                select: { id: true },
            });
            return cuenta !== null;
        },

        async createToken(cuenta) {
            const secret = new TextEncoder().encode(jwtSecret);
            return new SignJWT({
                tipo: "cliente",
                correo: cuenta.correo,
            })
                .setProtectedHeader({ alg: "HS256" })
                .setSubject(cuenta.id)
                .setIssuedAt()
                .setExpirationTime(`${sessionDurationSeconds}s`)
                .sign(secret);
        },

        async solicitarRecuperacion(correo) {
            if (
                !recoveryConfig.mailtrapSmtpHost ||
                !recoveryConfig.mailtrapSmtpPort ||
                !recoveryConfig.mailtrapSmtpUser ||
                !recoveryConfig.mailtrapSmtpPass ||
                !recoveryConfig.mailtrapFromEmail ||
                !recoveryConfig.frontendUrl
            ) {
                throw new AppError(
                    "RECUPERACION_NO_CONFIGURADA",
                    "La recuperación de contraseña no está configurada en el servidor.",
                    503,
                );
            }

            const correoNormalizado = normalizarCorreo(correo);
            const cuenta = await prisma.cuentaCliente.findUnique({
                where: { correoNormalizado },
                select: { id: true, nombre: true, correo: true, activo: true },
            });

            // Respuesta uniforme: no revelar si el correo existe.
            if (!cuenta || !cuenta.activo) return;

            const token = randomBytes(32).toString("base64url");
            const tokenHash = createHash("sha256").update(token).digest("hex");
            const expiresAt = new Date(Date.now() + resetTokenDurationMs);

            await prisma.clientePasswordResetToken.upsert({
                where: { cuentaId: cuenta.id },
                create: { cuentaId: cuenta.id, tokenHash, expiresAt },
                update: { tokenHash, expiresAt, createdAt: new Date() },
            });

            const resetUrl = new URL(
                "/cuenta/restablecer",
                recoveryConfig.frontendUrl,
            );
            resetUrl.searchParams.set("token", token);
            const link = resetUrl.toString();
            const nombreHtml = escapeHtml(cuenta.nombre);

            // Con REDIS_URL el correo se encola en BullMQ y lo envía el
            // worker; sin Redis se envía de forma síncrona.
            await enviarCorreo(recoveryConfig, {
                destinatario: cuenta.correo,
                asunto: "Recupera tu contraseña de NexoERP",
                texto: `Hola ${cuenta.nombre}, usa este enlace para crear una nueva contraseña: ${link}\n\nEl enlace vence en una hora. Si no solicitaste este cambio, ignora este correo.`,
                html: `<p>Hola ${nombreHtml},</p><p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de NexoERP.</p><p><a href="${link.replaceAll("&", "&amp;")}">Crear nueva contraseña</a></p><p>El enlace vence en una hora. Si no solicitaste este cambio, ignora este correo.</p>`,
            });
        },

        async restablecerContrasena(datos) {
            const tokenHash = createHash("sha256")
                .update(datos.token)
                .digest("hex");
            const token = await prisma.clientePasswordResetToken.findUnique({
                where: { tokenHash },
                select: { cuentaId: true, expiresAt: true },
            });

            if (!token || token.expiresAt <= new Date()) {
                throw new AppError(
                    "ENLACE_RECUPERACION_INVALIDO",
                    "El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.",
                    400,
                );
            }

            const contrasenaHash = await hash(datos.contrasena, hashRounds);

            await prisma.$transaction(async (transaction) => {
                const tokenConsumido =
                    await transaction.clientePasswordResetToken.deleteMany({
                        where: { tokenHash, expiresAt: { gt: new Date() } },
                    });

                if (tokenConsumido.count !== 1) {
                    throw new AppError(
                        "ENLACE_RECUPERACION_INVALIDO",
                        "El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.",
                        400,
                    );
                }

                const cuentaActualizada =
                    await transaction.cuentaCliente.updateMany({
                        where: { id: token.cuentaId, activo: true },
                        data: { contrasenaHash },
                    });

                if (cuentaActualizada.count !== 1) {
                    throw new AppError(
                        "ENLACE_RECUPERACION_INVALIDO",
                        "El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.",
                        400,
                    );
                }
            });
        },

        async obtenerPerfil(id) {
            const cuenta = await obtenerCuenta(id);
            const { correoNormalizado: _omitido, ...publica } = cuenta;
            return publica;
        },

        async actualizarPerfil(id, datos) {
            await obtenerCuenta(id);

            const data: Prisma.CuentaClienteUpdateInput = {};
            if (datos.nombre !== undefined) data.nombre = datos.nombre;
            if (datos.apellido !== undefined) {
                data.apellido = datos.apellido?.trim() || null;
            }
            if (datos.telefono !== undefined) {
                data.telefono = datos.telefono?.trim() || null;
                data.telefonoNormalizado = normalizarTelefonoOpcional(
                    datos.telefono,
                );
            }
            if (datos.direccion !== undefined) {
                data.direccion = datos.direccion?.trim() || null;
            }

            const cuenta = await prisma.cuentaCliente.update({
                where: { id },
                data,
                select: selectCuenta,
            });
            return cuenta;
        },

        /**
         * Vincula compras y clientes comerciales anteriores cuya identidad
         * coincide con el correo verificado de la cuenta (el inicio de sesión
         * con contraseña es la prueba de identidad). Solo afecta registros
         * aún sin cuenta asociada.
         */
        async vincularHistorial(id) {
            const cuenta = await obtenerCuenta(id);
            const correo = cuenta.correoNormalizado;

            const [pedidos, clientes] = await prisma.$transaction([
                prisma.pedidoMarketplace.updateMany({
                    where: {
                        cuentaClienteId: null,
                        correoComprador: {
                            equals: cuenta.correo,
                            mode: "insensitive",
                        },
                    },
                    data: { cuentaClienteId: id },
                }),
                prisma.cliente.updateMany({
                    where: {
                        cuentaClienteId: null,
                        correoNormalizado: correo,
                    },
                    data: { cuentaClienteId: id },
                }),
            ]);

            return {
                pedidos: pedidos.count,
                clientes: clientes.count,
            };
        },

        async listarPedidos(id) {
            await obtenerCuenta(id);
            const pedidos = await prisma.pedidoMarketplace.findMany({
                where: { cuentaClienteId: id },
                select: selectPedidoCliente,
                orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
            });
            return pedidos.map((fila) =>
                aPedidoCliente(fila as FilaPedido),
            );
        },

        async obtenerPedido(id, pedidoId) {
            await obtenerCuenta(id);
            const pedido = await prisma.pedidoMarketplace.findFirst({
                where: { id: pedidoId, cuentaClienteId: id },
                select: selectPedidoCliente,
            });
            if (!pedido) {
                throw new AppError(
                    "PEDIDO_NO_ENCONTRADO",
                    "El pedido no existe o no pertenece a tu cuenta.",
                    404,
                );
            }
            return aPedidoCliente(pedido as FilaPedido);
        },
    };
};
