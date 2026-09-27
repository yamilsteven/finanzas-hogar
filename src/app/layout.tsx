import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TrmBootstrap } from "@/components/providers/TrmBootstrap";
import { AppShell } from "@/components/layout/AppShell";
import { APP_NAME, APP_SHORT, APP_TAGLINE } from "@/lib/brand";
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
  title: APP_NAME,
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_SHORT,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  themeColor: "#0F766E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light h-full" style={{ colorScheme: "light" }}>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} min-h-full bg-background font-sans text-foreground antialiased`}
      >
        <TrmBootstrap>
          <AppShell>{children}</AppShell>
          <Toaster richColors position="top-center" />
        </TrmBootstrap>
      </body>
    </html>
  );
}
