import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cinzel, Crimson_Pro, Inter } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";

// Self-hosted (downloaded at build, served from our origin) — no request to
// Google's CDN on page load, so no visitor-IP leak and no CSP conflict.
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-display", display: "swap" });
const crimson = Crimson_Pro({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui-face", display: "swap" });

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
  themeColor: "#f3ecd9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${crimson.variable} ${inter.variable}`}>
      <body className="min-h-[100dvh]">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
