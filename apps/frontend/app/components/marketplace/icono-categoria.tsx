import {
    Baby,
    Book,
    Package,
    PawPrint,
    Shirt,
    Smartphone,
    Sparkles,
    Gamepad2,
    UtensilsCrossed,
    Watch,
    Dumbbell,
    Flower2,
    House,
    type LucideIcon,
} from "lucide-react";

/**
 * Asigna un icono a una categoría según palabras clave de su nombre real.
 * Las categorías no son fijas (cada empresa usa las suyas), así que las que
 * no coinciden con ninguna palabra clave reciben un icono genérico.
 */
export function iconoCategoria(categoria: string): LucideIcon {
    const nombre = categoria.toLowerCase();
    if (/(tecnolog|electr|comput|gadget|celular|inform|audio)/.test(nombre))
        return Smartphone;
    if (/(hogar|casa|mueble|decorac|cocina|jard)/.test(nombre)) return House;
    if (/(moda|ropa|indumentaria|vestir|calzado)/.test(nombre)) return Shirt;
    if (/(deport|fitness|ejercicio|gym)/.test(nombre)) return Dumbbell;
    if (/(belleza|cosm[eé]tic|cuidado personal|perfum)/.test(nombre))
        return Sparkles;
    if (/(aliment|comida|gourmet|alimentos|bebida|alimentos)/.test(nombre))
        return UtensilsCrossed;
    if (/(accesor|joya|reloj|bijou|bijouter)/.test(nombre)) return Watch;
    if (/(juguete|juegos|juego|entretenimiento)/.test(nombre))
        return Gamepad2;
    if (/(libro|librer)/.test(nombre)) return Book;
    if (/(mascota|pet|animal)/.test(nombre)) return PawPrint;
    if (/(beb[eé]|infantil|ni[nñ]o)/.test(nombre)) return Baby;
    if (/(flor|planta)/.test(nombre)) return Flower2;
    return Package;
}
