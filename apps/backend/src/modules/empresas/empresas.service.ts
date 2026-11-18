import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";

export interface DatosActualizarEmpresa {
    nombre: string;
    sitioWeb: string | null;
    tasaImpuesto: number;
}

const camposEmpresa = {
    id: true,
    nombre: true,
    sitioWeb: true,
    tasaImpuesto: true,
    creadaEn: true,
    actualizadaEn: true,
    _count: {
        select: { usuarios: true },
    },
} satisfies Prisma.EmpresaSelect;

export type EmpresaPublica = Prisma.EmpresaGetPayload<{
    select: typeof camposEmpresa;
}>;

export interface CompanyService {
    obtener(empresaId: string): Promise<EmpresaPublica>;
    actualizar(
        empresaId: string,
        datos: DatosActualizarEmpresa,
    ): Promise<EmpresaPublica>;
}

const empresaNoEncontrada = () =>
    new AppError("EMPRESA_NO_ENCONTRADA", "La empresa no existe.", 404);

export const obtenerEmpresa = async (
    prisma: PrismaClient,
    empresaId: string,
): Promise<EmpresaPublica> => {
    const empresa = await prisma.empresa.findUnique({
        where: { id: empresaId },
        select: camposEmpresa,
    });

    if (!empresa) {
        throw empresaNoEncontrada();
    }

    return empresa;
};

export const actualizarEmpresa = async (
    prisma: PrismaClient,
    empresaId: string,
    datos: DatosActualizarEmpresa,
): Promise<EmpresaPublica> => {
    const resultado = await prisma.empresa.updateMany({
        where: { id: empresaId },
        data: datos,
    });

    if (resultado.count !== 1) {
        throw empresaNoEncontrada();
    }

    return obtenerEmpresa(prisma, empresaId);
};

export const createCompanyService = (
    prisma: PrismaClient,
): CompanyService => ({
    obtener: (empresaId) => obtenerEmpresa(prisma, empresaId),
    actualizar: (empresaId, datos) =>
        actualizarEmpresa(prisma, empresaId, datos),
});
