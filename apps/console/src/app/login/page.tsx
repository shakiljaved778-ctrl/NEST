import { DEMO_DISCLAIMER_EN } from "@amil/ui";
import { bankClient } from "@/lib/env";
import { ROLE_LABELS } from "@/lib/labels";
import { oktaConfig } from "@/lib/okta";
import { signIn } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Demo sign-in. A bank would put its own SSO in front of the console; here staff pick a demo
 * user, and the console backend mints their console token over HMAC.
 */
const ERRORS: Record<string, string> = {
  sign_in_failed: "Sign-in did not complete. Try again.",
  not_authorised:
    "Your Okta account is not set up as an AMIL console user. Ask your AMIL administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (oktaConfig())
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">AMIL Console</p>
        <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Use your bank&apos;s Okta account. Your role in the console is set by your AMIL
          administrator.
        </p>
        {error ? (
          <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
            {ERRORS[error] ?? ERRORS.sign_in_failed}
          </p>
        ) : null}
        <a
          href="/auth/okta/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white"
        >
          Sign in with Okta
        </a>
      </main>
    );
  const { users } = await bankClient().listConsoleUsers();
  const order = ["product", "compliance", "sharia", "admin", "viewer"];
  const sorted = [...users].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <p className="text-sm font-semibold tracking-wide text-brand uppercase">AMIL Console</p>
      <h1 className="mt-1 text-2xl font-semibold">Sign in to Doha Demo Bank</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Choose a demo staff member. Each role sees and can do only what it is allowed to: product
        drafts, compliance approves, the Sharia reviewer gives the final approval for Islamic copy.
      </p>
      <form action={signIn} className="mt-6 grid gap-3">
        {sorted.map((u) => (
          <button
            key={u.id}
            name="consoleUserId"
            value={u.id}
            type="submit"
            className="rounded-lg border border-line bg-white p-4 text-left shadow-sm transition hover:border-brand"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{u.name}</span>
              <span className="text-xs text-ink-muted">{ROLE_LABELS[u.role]?.title}</span>
            </span>
            <span className="mt-1 block text-xs text-ink-muted">{ROLE_LABELS[u.role]?.can}</span>
          </button>
        ))}
      </form>
      <p className="mt-10 text-xs text-ink-muted">{DEMO_DISCLAIMER_EN}</p>
    </main>
  );
}
