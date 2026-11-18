
import {
    Prisma,
    TipoOperacionCliente,
    type Cliente,
    type PrismaClient,
} from "@prisma/client";
import { AppError } from "../../errors/app-error.js";

export interface DatosCrearCliente {
    nombre: string;
    apellido?: string;
    documento?: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
}

export type DatosActualizarCliente = Partial<DatosCrearCliente>;

export interface FiltrosClientes {
    empresaId: string;
    buscar: string;
    activo?: boolean;
    pagina: number;
    limite: number;
}

const camposPublicos = {
    id: true,
    nombre: true,
    apellido: true,
    documento: true,
    telefono: true,
    correo: true,
    direccion: true,
    activo: true,
    creadaEn: true,
    actualizadaEn: true,
} satisfies Prisma.ClienteSelect;

const camposOperacion = {
    id: true,
    tipo: true,
    detalle: true,
    creadaEn: true,
    usuario: {
        select: { nombre: true, apellido: true },
    },
} satisfies Prisma.OperacionClienteSelect;

export type ClientePublico = Prisma.ClienteGetPayload<{
    select: typeof camposPublicos;
}>;

export type OperacionClientePublica = Prisma.OperacionClienteGetPayload<{
    select: typeof camposOperacion;
}>;

export interface ResultadoClientes {
    datos: ClientePublico[];
    paginacion: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

export interface ResultadoOperacionesCliente {
    datos: OperacionClientePublica[];
    paginacion: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

export interface CustomerService {
    listar(filtros: FiltrosClientes): Promise<ResultadoClientes>;
    obtener(empresaId: string, id: string): Promise<ClientePublico>;
    crear(
        empresaId: string,
        usuarioId: string,
        datos: DatosCrearCliente,
    ): Promise<ClientePublico>;
    actualizar(
        empresaId: string,
        usuarioId: string,
        id: string,
        datos: DatosActualizarCliente,
    ): Promise<ClientePublico>;
    cambiarEstado(
        empresaId: string,
        usuarioId: string,
        id: string,
        activo: boolean,
    ): Promise<ClientePublico>;
    listarOperaciones(
        empresaId: string,
        clienteId: string,
        pagina: number,
        limite: number,
    ): Promise<ResultadoOperacionesCliente>;
}

const customerNotFound = () =>
    new AppError(
        "CLIENTE_NO_ENCONTRADO",
        "El cliente solicitado no existe.",
        404,
    );

const ensureCustomerExists = async (
    prisma: PrismaClient | Prisma.TransactionClient,
    empresaId: string,
    id: string,
): Promise<void> => {
    const cliente = await prisma.cliente.findFirst({
        where: { id, empresaId },
        select: { id: true },
    });

    if (!cliente) {
        throw customerNotFound();
    }
};

const registrarOperacion = (
    tx: Prisma.TransactionClient,
    datos: {
        clienteId: string;
        usuarioId: string;
        tipo: TipoOperacionCliente;
        detalle: string;
    },
) =>
    tx.operacionCliente.create({
        data: datos,
    });

export const listarClientes = async (
    prisma: PrismaClient,
    filtros: FiltrosClientes,
): Promise<ResultadoClientes> => {
    const where: Prisma.ClienteWhereInput = {
        empresaId: filtros.empresaId,
        ...(filtros.activo === undefined
            ? {}
            : { activo: filtros.activo }),
        ...(filtros.buscar
            ? {
                  OR: [
                      {
                          nombre: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                      {
                          apellido: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                      {
                          documento: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                      {
                          correo: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                      {
                          telefono: {
                              contains: filtros.buscar,
                              mode: "insensitive",
                          },
                      },
                  ],
              }
            : {}),
    };

    const [datos, total] = await Promise.all([
        prisma.cliente.findMany({
            where,
            select: camposPublicos,
            orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,
        }),
        prisma.cliente.count({ where }),
    ]);

    return {
        datos,
        paginacion: {
            pagina: filtros.pagina,
            limite: filtros.limite,
            total,
            totalPaginas: Math.ceil(total / filtros.limite),
        },
    };
};

export const obtenerCliente = async (
    prisma: PrismaClient,
    empresaId: string,
    id: string,
): Promise<ClientePublico> => {
    const cliente = await prisma.cliente.findFirst({
        where: { id, empresaId },
        select: camposPublicos,
    });

    if (!cliente) {
        throw customerNotFound();
    }

    return cliente;
};

export const crearCliente = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    datos: DatosCrearCliente,
): Promise<ClientePublico> =>
    prisma.$transaction(async (tx) => {
        const cliente = await tx.cliente.create({
            data: { ...datos, empresaId },
            select: camposPublicos,
        });

        await registrarOperacion(tx, {
            clienteId: cliente.id,
            usuarioId,
            tipo: TipoOperacionCliente.CREADO,
            detalle: `Cliente creado: ${cliente.nombre}${cliente.apellido ? ` ${cliente.apellido}` : ""}.`,
        });

        return cliente;
    });

export const actualizarCliente = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    id: string,
    datos: DatosActualizarCliente,
): Promise<ClientePublico> =>
    prisma.$transaction(async (tx) => {
        const existente = await tx.cliente.findFirst({
            where: { id, empresaId },
            select: camposPublicos,
        });

        if (!existente) {
            throw customerNotFound();
        }

        const camposActualizados = Object.entries(datos).filter(
            ([campo, valor]) =>
                existente[campo as keyof typeof existente] !== valor,
        );

        if (camposActualizados.length === 0) {
            return existente;
        }

        const cliente = await tx.cliente.update({
            where: { id },
            data: datos,
            select: camposPublicos,
        });

        await registrarOperacion(tx, {
            clienteId: id,
            usuarioId,
            tipo: TipoOperacionCliente.ACTUALIZADO,
            detalle: `Cliente actualizado. Campos modificados: ${camposActualizados
                .map(([campo]) => campo)
                .join(", ")}.`,
        });

        return cliente;
    });

export const cambiarEstadoCliente = async (
    prisma: PrismaClient,
    empresaId: string,
    usuarioId: string,
    id: string,
    activo: boolean,
): Promise<ClientePublico> =>
    prisma.$transaction(async (tx) => {
        const existente = await tx.cliente.findFirst({
            where: { id, empresaId },
            select: { id: true, nombre: true, apellido: true, activo: true },
        });

        if (!existente) {
            throw customerNotFound();
        }

        if (existente.activo === activo) {
            return tx.cliente.findUniqueOrThrow({
                where: { id },
                select: camposPublicos,
            });
        }

        const cliente = await tx.cliente.update({
            where: { id },
            data: { activo },
            select: camposPublicos,
        });

        await registrarOperacion(tx, {
            clienteId: id,
            usuarioId,
            tipo: activo
                ? TipoOperacionCliente.ACTIVADO
                : TipoOperacionCliente.DESACTIVADO,
            detalle: activo ? "Cliente reactivado." : "Cliente desactivado.",
        });

        return cliente;
    });

export const listarOperacionesCliente = async (
    prisma: PrismaClient,
    empresaId: string,
    clienteId: string,
    pagina: number,
    limite: number,
): Promise<ResultadoOperacionesCliente> => {
    await ensureCustomerExists(prisma, empresaId, clienteId);

    const where: Prisma.OperacionClienteWhereInput = { clienteId };

    const [datos, total] = await Promise.all([
        prisma.operacionCliente.findMany({
            where,
            select: camposOperacion,
            orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
            skip: (pagina - 1) * limite,
            take: limite,
        }),
        prisma.operacionCliente.count({ where }),
    ]);

    return {
        datos,
        paginacion: {
            pagina,
            limite,
            total,
            totalPaginas: Math.ceil(total / limite),
        },
    };
};

export const createCustomerService = (
    prisma: PrismaClient,
): CustomerService => ({
    listar: (filtros) => listarClientes(prisma, filtros),
    obtener: (empresaId, id) => obtenerCliente(prisma, empresaId, id),
    crear: (empresaId, usuarioId, datos) =>
        crearCliente(prisma, empresaId, usuarioId, datos),
    actualizar: (empresaId, usuarioId, id, datos) =>
        actualizarCliente(prisma, empresaId, usuarioId, id, datos),
    cambiarEstado: (empresaId, usuarioId, id, activo) =>
        cambiarEstadoCliente(prisma, empresaId, usuarioId, id, activo),
    listarOperaciones: (empresaId, clienteId, pagina, limite) =>
        listarOperacionesCliente(prisma, empresaId, clienteId, pagina, limite),
});
