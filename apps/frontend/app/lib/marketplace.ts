// Tipos, validadores y helpers compartidos por las páginas del marketplace.
// Los datos provienen de la API pública del marketplace; se validan en el
// cliente antes de renderizarlos.

export interface ProductoCatalogo {
    id: string;
    sku: string;
    nombre: string;
    precioVenta: number | string;
    categoria: string | null;
    imagenUrl: string | null;
    stock: number;
    empresa: { id: string; nombre: string; slug: string };
}

export interface ResultadoCatalogo {
    productos: ProductoCatalogo[];
    total: number;
    pagina: number;
    porPagina: number;
    totalPaginas: number;
}

export interface ProductoTienda {
    id: string;
    sku: string;
    nombre: string;
    precioVenta: number | string;
    categoria: string | null;
    imagenUrl: string | null;
    stock: number;
}

export interface TiendaMarketplace {
    id: string;
    nombre: string;
    slug: string;
    tasaImpuesto: number | string;
    costoEnvio: number | string;
    comisionPorcentaje: number | string;
    productos: ProductoTienda[];
}

export interface CategoriaPublica {
    nombre: string;
    cantidad: number;
}

export const ORDENES_CATALOGO = [
    { valor: "relevancia", etiqueta: "Relevancia" },
    { valor: "recientes", etiqueta: "Más recientes" },
    { valor: "populares", etiqueta: "Más populares" },
    { valor: "precio-asc", etiqueta: "Precio: menor a mayor" },
    { valor: "precio-desc", etiqueta: "Precio: mayor a menor" },
    { valor: "nombre", etiqueta: "Nombre: A-Z" },
] as const;

export type OrdenCatalogo = (typeof ORDENES_CATALOGO)[number]["valor"];

export const POR_PAGINA_CATALOGO = 12;

export function esOrdenCatalogo(valor: string | null): valor is OrdenCatalogo {
    return (
        valor !== null &&
        ORDENES_CATALOGO.some((orden) => orden.valor === valor)
    );
}

export function formatearImporte(valor: number | string): string {
    return new Intl.NumberFormat("es-UY", {
        style: "currency",
        currency: "UYU",
        minimumFractionDigits: 2,
    }).format(Number(valor));
}

export interface ConsultaCatalogo {
    q?: string;
    categoria?: string;
    empresa?: string;
    precioMin?: string;
    precioMax?: string;
    disponible?: string;
    orden?: string;
    pagina?: number;
    porPagina?: number;
}

/** Construye el query string del catálogo omitiendo valores vacíos y por defecto. */
export function construirConsultaCatalogo(consulta: ConsultaCatalogo): string {
    const parametros = new URLSearchParams();
    if (consulta.q) parametros.set("q", consulta.q);
    if (consulta.categoria) parametros.set("categoria", consulta.categoria);
    if (consulta.empresa) parametros.set("empresa", consulta.empresa);
    if (consulta.precioMin) parametros.set("precioMin", consulta.precioMin);
    if (consulta.precioMax) parametros.set("precioMax", consulta.precioMax);
    if (consulta.disponible === "true")
        parametros.set("disponible", "true");
    if (consulta.orden && consulta.orden !== "relevancia")
        parametros.set("orden", consulta.orden);
    if (consulta.porPagina && consulta.porPagina !== POR_PAGINA_CATALOGO)
        parametros.set("porPagina", String(consulta.porPagina));
    if (consulta.pagina && consulta.pagina > 1)
        parametros.set("pagina", String(consulta.pagina));
    const cadena = parametros.toString();
    return cadena ? `?${cadena}` : "";
}

export function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null;
}

export function esProductoCatalogo(valor: unknown): valor is ProductoCatalogo {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.sku === "string" &&
        typeof valor.nombre === "string" &&
        (typeof valor.precioVenta === "string" ||
            typeof valor.precioVenta === "number") &&
        (typeof valor.categoria === "string" || valor.categoria === null) &&
        (typeof valor.imagenUrl === "string" || valor.imagenUrl === null) &&
        typeof valor.stock === "number" &&
        esObjeto(valor.empresa) &&
        typeof valor.empresa.id === "string" &&
        typeof valor.empresa.nombre === "string" &&
        typeof valor.empresa.slug === "string"
    );
}

export function esResultadoCatalogo(valor: unknown): valor is ResultadoCatalogo {
    return (
        esObjeto(valor) &&
        Array.isArray(valor.productos) &&
        valor.productos.every(esProductoCatalogo) &&
        typeof valor.total === "number" &&
        typeof valor.pagina === "number" &&
        typeof valor.porPagina === "number" &&
        typeof valor.totalPaginas === "number"
    );
}

/** La API envuelve el catálogo paginado dentro de la clave `catalogo`. */
export function esRespuestaCatalogo(
    valor: unknown,
): valor is { catalogo: ResultadoCatalogo } {
    return esObjeto(valor) && esResultadoCatalogo(valor.catalogo);
}

function esProductoTienda(valor: unknown): valor is ProductoTienda {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.sku === "string" &&
        typeof valor.nombre === "string" &&
        (typeof valor.precioVenta === "string" ||
            typeof valor.precioVenta === "number") &&
        (typeof valor.categoria === "string" || valor.categoria === null) &&
        (typeof valor.imagenUrl === "string" || valor.imagenUrl === null) &&
        typeof valor.stock === "number"
    );
}

export function esTiendaMarketplace(valor: unknown): valor is TiendaMarketplace {
    return (
        esObjeto(valor) &&
        typeof valor.id === "string" &&
        typeof valor.nombre === "string" &&
        typeof valor.slug === "string" &&
        (typeof valor.tasaImpuesto === "string" ||
            typeof valor.tasaImpuesto === "number") &&
        (typeof valor.costoEnvio === "string" ||
            typeof valor.costoEnvio === "number") &&
        (typeof valor.comisionPorcentaje === "string" ||
            typeof valor.comisionPorcentaje === "number") &&
        Array.isArray(valor.productos) &&
        valor.productos.every(esProductoTienda)
    );
}

export function esCategoriasPublicas(
    valor: unknown,
): valor is CategoriaPublica[] {
    return (
        Array.isArray(valor) &&
        valor.every(
            (categoria) =>
                esObjeto(categoria) &&
                typeof categoria.nombre === "string" &&
                typeof categoria.cantidad === "number",
        )
    );
}

export function esRespuestaTienda(
    valor: unknown,
): valor is { tienda: TiendaMarketplace } {
    return esObjeto(valor) && esTiendaMarketplace(valor.tienda);
}

export function esRespuestaDetalleProducto(
    valor: unknown,
): valor is { producto: ProductoCatalogo; relacionados: ProductoCatalogo[] } {
    return (
        esObjeto(valor) &&
        esProductoCatalogo(valor.producto) &&
        Array.isArray(valor.relacionados) &&
        valor.relacionados.every(esProductoCatalogo)
    );
}

export function esListaTiendas(
    valor: unknown,
): valor is { tiendas: TiendaMarketplace[] } {
    return (
        esObjeto(valor) &&
        Array.isArray(valor.tiendas) &&
        valor.tiendas.every(esTiendaMarketplace)
    );
}

/** Deriva la lista de categorías reales de una tienda a partir de sus productos. */
export function categoriasDeTienda(tienda: TiendaMarketplace): CategoriaPublica[] {
    const conteos = new Map<string, number>();
    for (const producto of tienda.productos) {
        const categoria = producto.categoria?.trim();
        if (categoria) conteos.set(categoria, (conteos.get(categoria) ?? 0) + 1);
    }
    return Array.from(conteos, ([nombre, cantidad]) => ({ nombre, cantidad })).sort(
        (a, b) => a.nombre.localeCompare(b.nombre, "es"),
    );
}
