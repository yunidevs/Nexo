/**
 * Imagen decorativa para las tarjetas de categoría. Las categorías son
 * dinámicas (cada empresa usa las suyas), así que se asigna una foto
 * genérica según palabras clave del nombre real; las que no coinciden
 * no tienen imagen y la tarjeta muestra su diseño de respaldo.
 */
export function imagenCategoria(categoria: string): string | null {
    const nombre = categoria.toLowerCase();
    if (/(tecnolog|electr|comput|gadget|celular|inform|audio)/.test(nombre))
        return "/marketplace/categorias/cat-tecnologia.jpg";
    if (/(hogar|casa|mueble|decorac|cocina|jard)/.test(nombre))
        return "/marketplace/categorias/cat-hogar.jpg";
    if (/(moda|ropa|indumentaria|vestir|calzado)/.test(nombre))
        return "/marketplace/categorias/cat-moda.jpg";
    if (/(belleza|cosm[eé]tic|cuidado personal|perfum)/.test(nombre))
        return "/marketplace/categorias/cat-belleza.jpg";
    if (/(aliment|comida|gourmet|bebida)/.test(nombre))
        return "/marketplace/categorias/cat-alimentos.jpg";
    if (/(deport|fitness|ejercicio|gym)/.test(nombre))
        return "/marketplace/categorias/cat-deportes.jpg";
    if (/(juguete|juegos|juego|entretenimiento)/.test(nombre))
        return "/marketplace/categorias/cat-juguetes.jpg";
    if (/(libro|librer)/.test(nombre))
        return "/marketplace/categorias/cat-libros.jpg";
    if (/(mascota|pet|animal)/.test(nombre))
        return "/marketplace/categorias/cat-mascotas.jpg";
    if (/(oficina|papeler|escritorio|trabajo)/.test(nombre))
        return "/marketplace/categorias/cat-oficina.jpg";
    return null;
}
