import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PackageSearch, ShieldCheck } from "lucide-react";

/**
 * Hero pensado para móvil: titular comercial breve, propuesta de valor,
 * CTA principal visible en la primera pantalla y mensaje de confianza.
 * Solo se renderiza por debajo de `lg`; el hero editorial de escritorio
 * permanece intacto.
 */
export function HeroMovil() {
    return (
        <section className="landing-entrada relative -mx-5 mt-4 px-5 sm:px-8 lg:hidden">
            <div className="relative overflow-hidden rounded-[22px] border border-[#25382A]/12 bg-[#25382A] px-6 py-8 text-[#F4F1E8] shadow-[0_28px_60px_-30px_rgba(37,56,42,.9)]">
                {/* Composición visual: franja de productos reales del catálogo */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[#D9E8A5]/20 blur-3xl"
                />
                <div className="relative">
                    <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#D9E8A5]">
                        <span className="h-px w-6 bg-[#D9E8A5]/50" />
                        Nexo Marketplace
                    </p>

                    <h1 className="mt-3 font-serif text-[2rem] leading-[1.08] tracking-[-0.015em]">
                        Comprá a proveedores reales y seguí cada pedido.
                    </h1>

                    <p className="mt-3 max-w-[38ch] text-[13px] leading-[1.6] text-[#F4F1E8]/75">
                        Productos de tiendas verificadas, pago seguro con PayPal
                        y seguimiento paso a paso hasta tu puerta.
                    </p>

                    <div className="mt-6 flex flex-col gap-2.5">
                        <Link
                            href="/marketplace/productos"
                            className="group inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#D9E8A5] px-5 py-3.5 text-[13.5px] font-semibold text-[#25382A] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(217,232,165,.7)]"
                        >
                            Explorar productos
                            <ArrowRight
                                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                                aria-hidden="true"
                            />
                        </Link>
                        <Link
                            href="/seguimiento-pedido"
                            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#F4F1E8]/25 px-5 py-3 text-[13px] font-semibold text-[#F4F1E8] transition-colors hover:bg-[#F4F1E8]/10"
                        >
                            <PackageSearch className="size-4" aria-hidden="true" />
                            Seguir mi pedido
                        </Link>
                    </div>

                    <p className="mt-5 flex items-center gap-2 text-[11px] text-[#F4F1E8]/60">
                        <ShieldCheck className="size-4 shrink-0 text-[#D9E8A5]" aria-hidden="true" />
                        Pago protegido por PayPal · Sin registro obligatorio
                    </p>
                </div>
            </div>

            {/* Microcomposición de imágenes con carga diferida */}
            <div className="mt-4 grid grid-cols-3 gap-2.5" aria-hidden="true">
                {[
                    "/marketplace/editorial-hogar.jpg",
                    "/marketplace/editorial-tecnologia.jpg",
                    "/marketplace/editorial-moda.jpg",
                ].map((src, indice) => (
                    <div
                        key={src}
                        className={`relative aspect-[4/3] overflow-hidden rounded-[14px] border border-[#25382A]/10 bg-[#EAE6D8] ${
                            indice === 1 ? "translate-y-2" : ""
                        }`}
                    >
                        <Image
                            src={src}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 33vw, 120px"
                            className="object-cover"
                            loading="lazy"
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}
