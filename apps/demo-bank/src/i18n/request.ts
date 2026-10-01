import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALE_COOKIE = "ddb_locale";
export type AppLocale = "en" | "ar";

/** Locale lives in a cookie (no URL prefix), so bank deep links stay locale-free. */
export async function currentLocale(): Promise<AppLocale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "ar" ? "ar" : "en";
}

export default getRequestConfig(async () => {
  const locale = await currentLocale();
  const messages = (await import(`../messages/${locale}.json`)) as {
    default: Record<string, unknown>;
  };
  return { locale, messages: messages.default, timeZone: "Asia/Qatar" };
});
