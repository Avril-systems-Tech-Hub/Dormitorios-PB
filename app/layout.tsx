import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppToaster } from "@/components/ui/toaster";
import { ActionToast } from "@/components/ui/action-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dormitorios Plaza Basílica | Renta de camas por noche",
  description:
    "Hospedaje económico en CDMX cerca de la Basílica. Camas por noche, wifi y regaderas con agua caliente. Reserva en línea.",
  openGraph: {
    title: "Dormitorios Plaza Basílica",
    description: "Renta de camas por noche en Ciudad de México.",
    locale: "es_MX",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Suspense fallback={null}>
          <ActionToast />
        </Suspense>
        <AppToaster />
      </body>
    </html>
  );
}
