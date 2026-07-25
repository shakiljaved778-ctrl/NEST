import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voyara · Command Deck",
  description:
    "The agentic travel company. State intent once — Voyara plans, prices, books, and guards the trip.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-body antialiased min-h-screen">{children}</body>
    </html>
  );
}
