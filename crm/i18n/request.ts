import { getRequestConfig } from "next-intl/server";

// i18n scaffold: English is complete; Arabic keys are stubbed in ar.json and
// fall back to English until translated. Locale is fixed to "en" for now —
// switch by reading a user preference / cookie here when Arabic ships.
export default getRequestConfig(async () => {
  const locale = "en";
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
