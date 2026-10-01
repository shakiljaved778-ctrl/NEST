import { Bell, House, MessageCircle, Settings } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { currentLocale } from "@/i18n/request";
import { LanguageToggle } from "./language-toggle";
import { PhoneFrame } from "./phone-frame";

interface Props {
  title?: string;
  /** Show a back link instead of the greeting. */
  back?: string;
  customerName?: string;
  children: ReactNode;
  path: string;
}

export async function AppShell({ title, back, customerName, children, path }: Props) {
  const t = await getTranslations();
  const locale = await currentLocale();
  const nav = [
    { href: "/", label: t("nav.home"), icon: House },
    { href: "/alerts", label: t("nav.alerts"), icon: Bell },
    { href: "/ask", label: t("nav.ask"), icon: MessageCircle },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];
  return (
    <PhoneFrame>
      <header className="shrink-0 bg-brand px-5 pb-4 pt-3 text-brand-contrast">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-widest opacity-80">{t("app.bank")}</p>
          <LanguageToggle locale={locale} path={path} label={t("app.language")} />
        </div>
        {back ? (
          <Link href={back} className="mt-2 inline-block text-sm opacity-90" data-testid="back">
            {locale === "ar" ? "→" : "←"} {t("app.back")}
          </Link>
        ) : null}
        <h1 className="mt-1 text-xl font-semibold">
          {title ?? (customerName ? t("app.greeting", { name: customerName }) : t("app.bank"))}
        </h1>
      </header>
      <main className="flex-1 space-y-4 overflow-y-auto bg-surface-muted px-4 py-4">
        {children}
      </main>
      <nav className="grid shrink-0 grid-cols-4 border-t border-black/5 bg-surface text-[11px] text-ink-muted">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 py-2 ${path === href ? "text-brand" : ""}`}
          >
            <Icon size={18} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <footer
        className="shrink-0 bg-surface px-4 pb-2 text-center text-[10px] text-ink-muted"
        data-testid="demo-footer"
      >
        {t("app.demoFooter")}
      </footer>
    </PhoneFrame>
  );
}
