import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { TrmBootstrap } from "@/components/providers/TrmBootstrap";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finanzas Y&L — Hogar",
  description:
    "Gestión financiera del hogar para Yamil y Liz. Multimoneda COP/USD.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="h-full">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} min-h-full font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TrmBootstrap>
            <AppShell>{children}</AppShell>
            <Toaster richColors position="top-center" />
          </TrmBootstrap>
        </ThemeProvider>
      </body>
    </html>
  );
}
