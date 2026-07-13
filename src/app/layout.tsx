import "./globals.css";
import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "D&D 5e Campaign Manager",
  description: "Manage collaborative D&D 5e campaigns — characters, campaigns, and live combat with maps.",
  manifest: "/manifest.webmanifest",
  applicationName: "D&D Manager",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "D&D Manager" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#eee5ce",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-[100dvh]">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
