import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "D&D 5e Campaign Manager",
  description: "Manage collaborative D&D 5e campaigns — characters, campaigns, live combat & maps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
