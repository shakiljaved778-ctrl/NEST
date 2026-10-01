import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";
import { currentLocale } from "@/i18n/request";
import { bankBrand } from "@/lib/bank";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doha Demo Bank (fictional)",
  description:
    "Demo mobile banking app for AMIL. Doha Demo Bank is fictional; all data is synthetic.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

/** Bank brand tokens (Bank.brandTokens) become CSS custom properties for the app and the AMIL widget. */
function brandStyle(tokens: Record<string, string>): CSSProperties {
  const vars: Record<string, string> = {};
  const map: Record<string, string[]> = {
    primary: ["--ddb-primary", "--amil-primary"],
    primaryContrast: ["--ddb-primary-contrast", "--amil-primary-contrast"],
    accent: ["--ddb-accent"],
    surface: ["--ddb-surface", "--amil-surface"],
    surfaceMuted: ["--ddb-surface-muted", "--amil-surface-muted"],
    text: ["--ddb-text", "--amil-text"],
    textMuted: ["--ddb-text-muted", "--amil-text-muted"],
    critical: ["--amil-critical"],
    caution: ["--amil-caution"],
    info: ["--amil-info"],
    radius: ["--ddb-radius", "--amil-radius"],
    fontFamily: ["--amil-font"],
  };
  for (const [token, names] of Object.entries(map)) {
    const value = tokens[token];
    if (typeof value === "string") for (const n of names) vars[n] = value;
  }
  return vars;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await currentLocale();
  const messages = await getMessages();
  const brand = await bankBrand();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body style={brandStyle((brand?.brandTokens ?? {}) as Record<string, string>)}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
