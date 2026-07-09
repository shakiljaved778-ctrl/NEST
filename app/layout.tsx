import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEST Solutions — Qatar's trusted home-services super app",
  description:
    "One app for a trusted home: verified professionals, transparent prices, and AI that books the right service in seconds. Customer app, provider app, admin & operations dashboards.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12294B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
