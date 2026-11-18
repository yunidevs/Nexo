"use client";

import { useEffect } from "react";

/**
 * Observa los elementos marcados con [data-mp-reveal] y los muestra de forma
 * progresiva cuando entran en pantalla (los estilos viven en globals.css).
 * Las secciones se renderizan cuando llegan los datos (después del montaje
 * del componente), así que un MutationObserver detecta los nodos nuevos y
 * los incorpora.
 *
 * Dos detalles importantes:
 *  - la marca de "ya visible" se aplica con estilos en línea, porque React
 *    vuelve a escribir el atributo `class` de los nodos que reutiliza y eso
 *    borraría una clase añadida desde el script;
 *  - los elementos pendientes se registran en un conjunto propio de cada
 *    ejecución del efecto (y no en un atributo del nodo), porque React monta
 *    el efecto dos veces en desarrollo: si la marca quedara en el nodo, la
 *    segunda ejecución saltaría elementos que la primera dejó en cola y
 *    alguna sección podría quedarse oculta.
 */
export function useRevealSecciones() {
    useEffect(() => {
        const movimientoReducido = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;

        /** Elementos ya mostrados por esta ejecución del efecto. */
        const mostrados = new WeakSet<HTMLElement>();
        /** Elementos que todavía esperan entrar en pantalla. */
        const pendientes = new Set<HTMLElement>();

        function mostrar(elemento: HTMLElement) {
            if (mostrados.has(elemento)) return;
            mostrados.add(elemento);
            pendientes.delete(elemento);
            elemento.style.opacity = "1";
            elemento.style.transform = "none";
        }

        function revisar() {
            for (const elemento of Array.from(pendientes)) {
                if (
                    elemento.getBoundingClientRect().top < window.innerHeight
                ) {
                    mostrar(elemento);
                }
            }
        }

        function escanear() {
            for (const elemento of document.querySelectorAll<HTMLElement>(
                "[data-mp-reveal]",
            )) {
                if (mostrados.has(elemento) || pendientes.has(elemento)) {
                    continue;
                }
                if (
                    movimientoReducido ||
                    elemento.getBoundingClientRect().top < window.innerHeight
                ) {
                    mostrar(elemento);
                    continue;
                }
                pendientes.add(elemento);
            }
            revisar();
        }

        escanear();

        const mutaciones = new MutationObserver(escanear);
        mutaciones.observe(document.body, { childList: true, subtree: true });
        window.addEventListener("scroll", revisar, { passive: true });
        window.addEventListener("resize", revisar, { passive: true });

        return () => {
            mutaciones.disconnect();
            window.removeEventListener("scroll", revisar);
            window.removeEventListener("resize", revisar);
        };
    }, []);
}
