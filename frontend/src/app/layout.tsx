import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Courier_Prime, Inter } from "next/font/google";
import "./globals.css";
import "./private.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  variable: "--font-courier",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JARVIS privado",
  description: "Asistente personal de acceso privado",
  robots: { index: false, follow: false, noarchive: true },
  appleWebApp: { capable: true, title: "JARVIS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0a0d08",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${bebasNeue.variable} ${courierPrime.variable} ${inter.variable} antialiased bg-[#0a0d08] text-[#c8d6b0]`}
      >
        {children}
      </body>
    </html>
  );
}
