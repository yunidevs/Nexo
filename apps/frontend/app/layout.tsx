import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { AppFrame } from "@/app/components/app-frame";
import { SCRIPT_TEMA_INICIAL } from "@/app/lib/tema";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/* Serif editorial para los titulares de la portada. */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nexo ERP",
    template: "%s | Nexo ERP",
  },
  description:
    "Gestiona clientes, productos, inventario, ventas y operaciones de tu empresa desde Nexo ERP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${cormorant.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          id="tema-inicial"
          dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }}
        />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
