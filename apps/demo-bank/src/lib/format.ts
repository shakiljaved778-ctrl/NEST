import { formatDate, formatMoney, formatNumber } from "@amil/i18n";

type Locale = "en" | "ar";
type DecimalLike = { toFixed(dp: number): string } | string;

const str = (v: DecimalLike, dp = 2) => (typeof v === "string" ? v : v.toFixed(dp));

export const money = (v: DecimalLike, locale: Locale) =>
  formatMoney(str(v), { locale, digitStyle: "latn" });
export const num = (v: number, locale: Locale) =>
  formatNumber(String(v), { locale, digitStyle: "latn" });
export const date = (d: Date, locale: Locale) =>
  formatDate(d.toISOString(), { locale, digitStyle: "latn" });

/** Map a bank deep link (ddb://cards/x/rewards) to this app's route (/cards/x/rewards). */
export function deepLinkToPath(deepLink: string): string | null {
  const m = /^ddb:\/\/(.+)$/.exec(deepLink);
  return m ? `/${m[1]}` : null;
}
