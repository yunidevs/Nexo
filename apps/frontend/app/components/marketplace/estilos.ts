/**
 * Vocabulario visual compartido por las pantallas del marketplace.
 *
 * Centraliza las clases que se repiten (acciones, títulos de sección,
 * separadores y contenedores) para que la identidad se mantenga
 * coherente entre el catálogo, el detalle, el carrito y la portada del
 * marketplace. Solo reúne cadenas de clases: no hay lógica aquí.
 */

/** Acción principal: fondo verde bosque, texto marfil. */
export const botonPrimario =
    "inline-flex items-center justify-center gap-2 rounded-[10px] bg-mp-primary px-5 py-2.5 text-[13px] font-semibold text-mp-on-accent transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-mp-primary-hover hover:shadow-[0_14px_28px_-16px_rgba(37,56,42,0.75)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none";

/** Acción secundaria: contorno verde y relleno marfil al pasar el cursor. */
export const botonSecundario =
    "inline-flex items-center justify-center gap-2 rounded-[10px] border border-mp-primary/25 bg-mp-elevated px-5 py-2.5 text-[13px] font-semibold text-mp-primary transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-mp-primary/50 hover:bg-mp-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0";

/** Acción terciaria: solo texto con subrayado editorial. */
export const botonTexto =
    "mp-enlace inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-mp-primary transition-colors duration-300 hover:text-mp-olive-ink";

/** Antetítulo en versalitas sobre el marfil. */
export const eyebrow =
    "flex items-center gap-2.5 text-[10px] font-semibold tracking-[0.2em] text-mp-olive-ink uppercase";

/** Título de sección en serif editorial. */
export const tituloSeccion =
    "font-serif text-[1.6rem] leading-[1.14] tracking-[-0.01em] text-mp-primary sm:text-[2rem]";

/** Entrada de texto y selectores. */
export const campo =
    "h-11 w-full rounded-[10px] border border-mp-border bg-mp-elevated px-3.5 text-[13.5px] text-mp-text transition-colors placeholder:text-mp-text-faint focus:border-mp-primary/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mp-primary";

/** Tarjeta base del catálogo. */
export const tarjeta =
    "overflow-hidden rounded-[16px] border border-mp-border bg-mp-elevated transition-all duration-300 ease-out";

/** Enlace de migas de pan. */
export const miga =
    "mp-enlace text-[11.5px] text-mp-text-soft transition-colors duration-300 hover:text-mp-primary";

/** Contenedor con el ancho máximo del marketplace. */
export const contenedor = "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8";
