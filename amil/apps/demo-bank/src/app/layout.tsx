import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doha Demo Bank (fictional)",
  description:
    "Demo mobile banking app for AMIL. Doha Demo Bank is fictional; all data is synthetic.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  // Locale and RTL switching (next-intl) arrive in Phase 4.
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
