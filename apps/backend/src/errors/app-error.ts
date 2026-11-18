export class AppError extends Error {
    constructor(
        public readonly codigo: string,
        public readonly mensaje: string,
        public readonly statusCode: number,
    ) {
        super(mensaje);
        this.name = "AppError";
    }
}
