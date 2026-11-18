import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../errors/app-error.js";

type ErrorWithStatus = Error & { status?: unknown };

function isErrorWithStatus(error: unknown): error is ErrorWithStatus {
    return error instanceof Error && "status" in error;
}

export const errorHandler: ErrorRequestHandler = (
    error: unknown,
    req,
    res,
    _next,
) => {
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            exito: false,
            error: {
                codigo: error.codigo,
                mensaje: error.mensaje,
            },
        });
        return;
    }

    if (isErrorWithStatus(error) && error.status === 400) {
        res.status(400).json({
            exito: false,
            error: {
                codigo: "JSON_INVALIDO",
                mensaje: "El cuerpo de la solicitud no contiene JSON válido.",
            },
        });
        return;
    }

    if (isErrorWithStatus(error) && error.status === 413) {
        res.status(413).json({
            exito: false,
            error: {
                codigo: "CUERPO_DEMASIADO_GRANDE",
                mensaje:
                    "El cuerpo de la solicitud supera el tamaño permitido.",
            },
        });
        return;
    }

    if (
        error instanceof Prisma.PrismaClientInitializationError &&
        error.errorCode === "P1001"
    ) {
        console.error(
            JSON.stringify({
                nivel: "error",
                mensaje: "base_de_datos_no_disponible",
                metodo: req.method,
                ruta: req.path,
                codigo: error.errorCode,
            }),
        );
        res.status(503).json({
            exito: false,
            error: {
                codigo: "BASE_DE_DATOS_NO_DISPONIBLE",
                mensaje:
                    "No se pudo conectar con la base de datos. Comprueba que PostgreSQL esté iniciado y vuelve a intentarlo.",
            },
        });
        return;
    }

    console.error(
        JSON.stringify({
            nivel: "error",
            mensaje: "error_no_controlado",
            metodo: req.method,
            ruta: req.path,
            error: error instanceof Error ? error.message : "Error desconocido",
        }),
    );

    res.status(500).json({
        exito: false,
        error: {
            codigo: "ERROR_INTERNO",
            mensaje: "Ocurrió un error interno.",
        },
    });
};
