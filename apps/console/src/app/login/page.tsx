import { DEMO_DISCLAIMER_EN } from "@amil/ui";
import { bankClient } from "@/lib/env";
import { ROLE_LABELS } from "@/lib/labels";
import { signIn } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Demo sign-in. A bank would put its own SSO in front of the console; here staff pick a demo
 * user, and the console backend mints their console token over HMAC.
 */
export default async function LoginPage() {
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
