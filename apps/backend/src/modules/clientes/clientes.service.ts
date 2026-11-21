
import {
    Prisma,
    TipoOperacionCliente,
    OrigenCliente,
    type Cliente,
    type PrismaClient,
} from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import {
    normalizarTelefono,
    normalizarTelefonoOpcional,
} from "../comun/telefono.js";
import {
    normalizarCorreo,
    normalizarCorreoOpcional,
} from "../comun/correo.js";

export interface DatosCrearCliente {
    nombre: string;
    apellido?: string;
    documento?: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
    origen?: OrigenCliente;
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
    origen: true,
    posibleDuplicado: true,
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

export interface ActividadComercialCliente {
    totales: {
        totalComprado: Prisma.Decimal;
        cantidadPedidos: number;
        ticketPromedio: Prisma.Decimal;
        ultimaCompra: Date | null;
        pedidosCompletados: number;
        pedidosPendientes: number;
    };
    pedidosRecientes: {
        id: string;
        fecha: Date;
        total: Prisma.Decimal;
        estado: string;
        articulos: number;
    }[];
}

export interface DuplicadoCliente {
    campo: "correo" | "telefono";
    valor: string;
    clientes: {
        id: string;
        nombre: string;
        apellido: string | null;
        creadaEn: Date;
    }[];
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
    obtenerActividadComercial(
        empresaId: string,
        clienteId: string,
    ): Promise<ActividadComercialCliente>;
    detectarDuplicados(empresaId: string): Promise<DuplicadoCliente[]>;
    resolverClienteCompra(
        tx: Prisma.TransactionClient,
        empresaId: string,
        datos: {
            nombre: string;
            correo: string;
            telefono: string;
            direccion: string;
            localidad: string;
            departamento: string;
        },
    ): Promise<{ id: string }>;
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
    prisma: PrismaClient | Prisma.TransactionClient,
    empresaId: string,
    usuarioId: string | null,
    datos: DatosCrearCliente,
): Promise<ClientePublico> => {
    const data: Prisma.ClienteCreateInput = {
        ...datos,
        empresa: { connect: { id: empresaId } },
        correoNormalizado: normalizarCorreoOpcional(datos.correo),
        telefonoNormalizado: normalizarTelefonoOpcional(datos.telefono),
    };

    const cliente = await prisma.cliente.create({
        data,
        select: camposPublicos,
    });

    const tx = prisma as Prisma.TransactionClient;
    if (typeof tx.operacionCliente?.create === "function") {
        await registrarOperacion(tx, {
            clienteId: cliente.id,
            usuarioId,
            tipo: TipoOperacionCliente.CREADO,
            detalle: `Cliente creado: ${cliente.nombre}${cliente.apellido ? ` ${cliente.apellido}` : ""}.`,
        });
    }

    return cliente;
};

export const actualizarCliente = async (
    prisma: PrismaClient | Prisma.TransactionClient,
    empresaId: string,
    usuarioId: string | null,
    id: string,
    datos: DatosActualizarCliente,
): Promise<ClientePublico> => {
    const existente = await prisma.cliente.findFirst({
        where: { id, empresaId },
        select: camposPublicos,
    });

    if (!existente) {
        throw customerNotFound();
    }

    const data: Prisma.ClienteUpdateInput = {
        ...datos,
    };

    if (datos.correo !== undefined) {
        data.correoNormalizado = normalizarCorreoOpcional(datos.correo);
    }
    if (datos.telefono !== undefined) {
        data.telefonoNormalizado = normalizarTelefonoOpcional(datos.telefono);
    }

    const camposActualizados = Object.entries(datos).filter(
        ([campo, valor]) =>
            existente[campo as keyof typeof existente] !== valor,
    );

    if (camposActualizados.length === 0) {
        return existente;
    }

    const cliente = await prisma.cliente.update({
        where: { id },
        data,
        select: camposPublicos,
    });

    const tx = prisma as Prisma.TransactionClient;
    if (typeof tx.operacionCliente?.create === "function") {
        await registrarOperacion(tx, {
            clienteId: id,
            usuarioId,
            tipo: TipoOperacionCliente.ACTUALIZADO,
            detalle: `Cliente actualizado. Campos modificados: ${camposActualizados
                .map(([campo]) => campo)
                .join(", ")}.`,
        });
    }

    return cliente;
};

export const cambiarEstadoCliente = async (
    prisma: PrismaClient | Prisma.TransactionClient,
    empresaId: string,
    usuarioId: string | null,
    id: string,
    activo: boolean,
): Promise<ClientePublico> => {
    const existente = await prisma.cliente.findFirst({
        where: { id, empresaId },
        select: { id: true, nombre: true, apellido: true, activo: true },
    });

    if (!existente) {
        throw customerNotFound();
    }

    if (existente.activo === activo) {
        return prisma.cliente.findUniqueOrThrow({
            where: { id },
            select: camposPublicos,
        });
    }

    const cliente = await prisma.cliente.update({
        where: { id },
        data: { activo },
        select: camposPublicos,
    });

    const tx = prisma as Prisma.TransactionClient;
    if (typeof tx.operacionCliente?.create === "function") {
        await registrarOperacion(tx, {
            clienteId: id,
            usuarioId,
            tipo: activo
                ? TipoOperacionCliente.ACTIVADO
                : TipoOperacionCliente.DESACTIVADO,
            detalle: activo ? "Cliente reactivado." : "Cliente desactivado.",
        });
    }

    return cliente;
};

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

export const obtenerActividadComercialCliente = async (
    prisma: PrismaClient,
    empresaId: string,
    clienteId: string,
): Promise<ActividadComercialCliente> => {
    await ensureCustomerExists(prisma, empresaId, clienteId);

    const pedidos = await prisma.pedidoMarketplace.findMany({
        where: { empresaId, clienteId },
        include: {
            venta: {
                include: {
                    detalles: true,
                },
            },
        },
        orderBy: { creadaEn: "desc" },
    });

    const pagados = pedidos.filter((p) => p.pagadaEn !== null);
    const totalComprado = pagados.reduce(
        (acc, p) => acc.add(p.total),
        new Prisma.Decimal(0),
    );
    const cantidadPedidos = pagados.length;
    const ticketPromedio =
        cantidadPedidos > 0
            ? totalComprado.div(cantidadPedidos)
            : new Prisma.Decimal(0);
    const ultimaCompra = pagados[0]?.pagadaEn || null;

    const pedidosCompletados = pagados.filter((p) =>
        ["ENTREGADO"].includes(p.estado),
    ).length;
    const pedidosPendientes = pagados.filter(
        (p) =>
            !["ENTREGADO", "CANCELADO", "REEMBOLSADO"].includes(p.estado),
    ).length;

    const pedidosRecientes = pedidos.slice(0, 10).map((p) => ({
        id: p.id,
        fecha: p.creadaEn,
        total: p.total,
        estado: p.estado,
        articulos: p.venta?.detalles.length || 0,
    }));

    return {
        totales: {
            totalComprado,
            cantidadPedidos,
            ticketPromedio,
            ultimaCompra,
            pedidosCompletados,
            pedidosPendientes,
        },
        pedidosRecientes,
    };
};

export const detectarDuplicadosClientes = async (
    prisma: PrismaClient,
    empresaId: string,
): Promise<DuplicadoCliente[]> => {
    const duplicadosCorreo = await prisma.$queryRaw<
        { correo_normalizado: string; ids: string[] }[]
    >`
        SELECT correo_normalizado, array_agg(id::text) as ids
        FROM clientes
        WHERE empresa_id = ${empresaId}::uuid AND correo_normalizado IS NOT NULL
        GROUP BY correo_normalizado
        HAVING count(*) > 1
    `;

    const duplicadosTelefono = await prisma.$queryRaw<
        { telefono_normalizado: string; ids: string[] }[]
    >`
        SELECT telefono_normalizado, array_agg(id::text) as ids
        FROM clientes
        WHERE empresa_id = ${empresaId}::uuid AND telefono_normalizado IS NOT NULL
        GROUP BY telefono_normalizado
        HAVING count(*) > 1
    `;

    const resultado: DuplicadoCliente[] = [];

    for (const d of duplicadosCorreo) {
        const clientes = await prisma.cliente.findMany({
            where: { id: { in: d.ids } },
            select: { id: true, nombre: true, apellido: true, creadaEn: true },
        });
        resultado.push({
            campo: "correo",
            valor: d.correo_normalizado,
            clientes,
        });
    }

    for (const d of duplicadosTelefono) {
        const clientes = await prisma.cliente.findMany({
            where: { id: { in: d.ids } },
            select: { id: true, nombre: true, apellido: true, creadaEn: true },
        });
        resultado.push({
            campo: "telefono",
            valor: d.telefono_normalizado,
            clientes,
        });
    }

    return resultado;
};

export const resolverClienteCompra = async (
    tx: Prisma.TransactionClient,
    empresaId: string,
    datos: {
        nombre: string;
        correo: string;
        telefono: string;
        direccion: string;
        localidad: string;
        departamento: string;
    },
): Promise<{ id: string }> => {
    const correoNormalizado = normalizarCorreo(datos.correo);
    const telefonoNormalizado = normalizarTelefonoOpcional(datos.telefono);

    // 1. Intentar por correo
    let cliente = await tx.cliente.findFirst({
        where: { empresaId, correoNormalizado },
        select: { id: true, correo: true, telefono: true, direccion: true },
    });

    let posibleDuplicado = false;

    // 2. Intentar por teléfono si no se encontró por correo y el teléfono es válido
    if (!cliente && telefonoNormalizado) {
        const candidatos = await tx.cliente.findMany({
            where: { empresaId, telefonoNormalizado },
            select: { id: true, correo: true, telefono: true, direccion: true },
        });

        if (candidatos.length === 1) {
            cliente = candidatos[0];
        } else if (candidatos.length > 1) {
            // Ambigüedad: marcaremos el nuevo como posible duplicado
            posibleDuplicado = true;
        }
    }

    const direccionCompleta = `${datos.direccion}, ${datos.localidad}, ${datos.departamento}`;

    if (cliente && !posibleDuplicado) {
        // Actualizar solo campos vacíos
        const updates: DatosActualizarCliente = {};
        if (!cliente.correo) updates.correo = datos.correo;
        if (!cliente.telefono) updates.telefono = datos.telefono;
        if (!cliente.direccion) updates.direccion = direccionCompleta;

        if (Object.keys(updates).length > 0) {
            await actualizarCliente(tx, empresaId, null, cliente.id, updates);
        }

        return { id: cliente.id };
    }

    // 3. Crear nuevo cliente
    const nuevo = await crearCliente(tx, empresaId, null, {
        nombre: datos.nombre,
        correo: datos.correo,
        telefono: datos.telefono,
        direccion: direccionCompleta,
        origen: OrigenCliente.MARKETPLACE,
    });

    if (posibleDuplicado) {
        await tx.cliente.update({
            where: { id: nuevo.id },
            data: { posibleDuplicado: true },
        });
    }

    return { id: nuevo.id };
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
    obtenerActividadComercial: (empresaId, clienteId) =>
        obtenerActividadComercialCliente(prisma, empresaId, clienteId),
    detectarDuplicados: (empresaId) => detectarDuplicadosClientes(prisma, empresaId),
    resolverClienteCompra: (tx, empresaId, datos) =>
        resolverClienteCompra(tx, empresaId, datos),
});
