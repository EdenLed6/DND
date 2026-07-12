import "./globals.css";
import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "D&D 5e Campaign Manager",
  description: "Manage collaborative D&D 5e campaigns — characters, campaigns, and live combat with maps.",
  manifest: "/manifest.webmanifest",
  applicationName: "D&D Manager",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "D&D Manager" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#120f0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-[100dvh]">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
