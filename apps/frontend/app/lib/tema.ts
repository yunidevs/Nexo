export type TemaApariencia = "claro" | "oscuro";

const CLAVE_TEMA = "nexo-apariencia";

export function esTemaApariencia(valor: unknown): valor is TemaApariencia {
    return valor === "claro" || valor === "oscuro";
}

function aplicarTema(tema: TemaApariencia) {
    document.documentElement.classList.toggle("light", tema === "claro");
}

function leerTemaGuardado(): TemaApariencia {
    try {
        const guardado = window.localStorage.getItem(CLAVE_TEMA);
        return esTemaApariencia(guardado) ? guardado : "oscuro";
    } catch {
        return "oscuro";
    }
}

// El tema vive como almacén externo (localStorage + clase en <html>) y se
// consume con useSyncExternalStore para evitar desajustes de hidratación.
let temaActual: TemaApariencia | null = null;
const suscriptores = new Set<() => void>();

export function suscribirseAlTema(cambio: () => void) {
    suscriptores.add(cambio);
    return () => {
        suscriptores.delete(cambio);
    };
}

export function obtenerTema(): TemaApariencia {
    if (temaActual === null) {
        temaActual = leerTemaGuardado();
        aplicarTema(temaActual);
    }
    return temaActual;
}

// El HTML se genera con el tema oscuro por defecto; el script inicial
// aplica la clase del tema guardado antes del primer pintado.
export function obtenerTemaServidor(): TemaApariencia {
    return "oscuro";
}

export function establecerTema(tema: TemaApariencia) {
    temaActual = tema;
    try {
        window.localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
        // Sin almacenamiento disponible el tema solo se aplica a esta vista.
    }
    aplicarTema(tema);
    for (const suscriptor of suscriptores) suscriptor();
}

// Se ejecuta antes del primer pintado para evitar un destello del tema
// oscuro cuando el usuario eligió el modo claro.
export const SCRIPT_TEMA_INICIAL = `(function(){try{var t=localStorage.getItem("${CLAVE_TEMA}");if(t==="claro"){document.documentElement.classList.add("light")}}catch(e){}})();`;
