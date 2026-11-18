"use client";

import { Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

interface AuthBackgroundProps {
    children: ReactNode;
    showBack?: boolean;
}

export default function AuthBackground({
    children,
    showBack = true,
}: AuthBackgroundProps) {
    return (
        <main className="erp-root relative min-h-screen overflow-hidden bg-surface text-foreground">
            {/* =========================================================
          FONDO DECORATIVO
          ========================================================= */}

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {/* Glow superior izquierdo */}
                <div className="absolute -left-40 -top-40 h-125 w-125 rounded-full bg-indigo-500/10 blur-[140px]" />

                {/* Glow inferior derecho */}
                <div className="absolute -bottom-40 -right-40 h-125 w-125 rounded-full bg-blue-500/[0.07] blur-[140px]" />

                {/* Cuadrícula */}
                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage:
                            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
                        backgroundSize: "50px 50px",
                    }}
                />

                {/* Luz central */}
                <div className="absolute left-1/2 top-1/2 h-125 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/2.5 blur-[100px]" />
            </div>

            {/* =========================================================
          CONTENIDO
          ========================================================= */}

            <div className="relative z-10 flex min-h-screen flex-col">
                {/* =======================================================
            HEADER
            ======================================================= */}

                <header className="flex h-19 shrink-0 items-center justify-between border-b border-white/6 px-5 sm:px-8 lg:px-10">
                    {/* LOGO */}

                    <Link href="/" className="group flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-transform duration-300 group-hover:scale-105">
                            <Activity className="h-5 w-5 text-foreground" />
                        </div>

                        <div>
                            <span className="block text-sm font-semibold tracking-tight text-foreground">
                                Nexo
                            </span>

                            <span className="hidden text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:block">
                                Gestión empresarial
                            </span>
                        </div>
                    </Link>

                    {/* REGRESAR */}

                    {showBack && (
                        <Link
                            href="/"
                            className="group flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />

                            <span className="hidden sm:inline">
                                Volver al inicio
                            </span>
                        </Link>
                    )}
                </header>

                {/* =======================================================
            CONTENIDO CENTRAL
            ======================================================= */}

                <div className="flex flex-1 items-center justify-center px-5 py-10">
                    {children}
                </div>
            </div>
        </main>
    );
}
