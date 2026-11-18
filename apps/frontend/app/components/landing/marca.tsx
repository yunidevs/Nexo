/**
 * Marca de Nexo: dos nodos enlazados dentro de un cuadro redondeado.
 * Resume el concepto de la plataforma —conectar la gestión de la
 * empresa con el mercado— y funciona como firma de identidad en la
 * cabecera editorial de la portada.
 */
export function MarcaNexo({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 32 32"
            className={className}
            aria-hidden="true"
            focusable="false"
        >
            <rect width="32" height="32" rx="9" fill="currentColor" />
            <circle cx="11.5" cy="12" r="2.7" fill="#D9E8A5" />
            <circle cx="20.5" cy="20" r="2.7" fill="#D9E8A5" />
            <path
                d="M13.4 14.2 18.6 17.8"
                stroke="#F4F1E8"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}
