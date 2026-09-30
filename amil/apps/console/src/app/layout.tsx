import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMIL Console | Doha Demo Bank (fictional)",
  description: "Bank console for AMIL: rule packs, templates, approvals, audit and compliance.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
