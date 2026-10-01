import { setLocale } from "@/app/actions";

export function LanguageToggle({
  locale,
  path,
  label,
}: {
  locale: "en" | "ar";
  path: string;
  label: string;
}) {
  const next = locale === "ar" ? "en" : "ar";
  return (
    <form action={setLocale.bind(null, next, path)}>
      <button
        type="submit"
        className="rounded-full border border-white/40 px-3 py-0.5 text-xs"
        data-testid="language-toggle"
        lang={next}
      >
        {label}
      </button>
    </form>
  );
}
