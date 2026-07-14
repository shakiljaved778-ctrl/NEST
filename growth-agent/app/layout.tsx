import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Growth Agent",
  description:
    "Daily coach for career growth, LinkedIn presence, reading, fitness & weight loss, AI learning, and finance building.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
