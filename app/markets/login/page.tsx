"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/market/providers/AppState";

export default function LoginPage() {
  const { signUp, logIn } = useAppState();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const res = mode === "up" ? signUp(name, email, pw) : logIn(email, pw);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    if (!res.user.profile?.completedOnboarding) router.push("/markets/onboarding");
    else router.push("/markets");
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="t-panel overflow-hidden">
        <div className="flex border-b border-terminal-border">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setErr(null);
              }}
              className={`flex-1 px-4 py-3 text-sm font-semibold ${
                mode === m
                  ? "bg-terminal-panel2 text-terminal-bright"
                  : "text-terminal-muted hover:text-terminal-text"
              }`}
            >
              {m === "in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form className="space-y-3 p-5" onSubmit={submit}>
          {mode === "up" && (
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className="t-input" placeholder="Your name" />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="t-input"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="t-input"
              placeholder="••••••••"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              required
            />
          </Field>

          {err && <p className="text-xs text-terminal-down">{err}</p>}

          <button type="submit" className="t-btn-accent w-full py-2.5">
            {mode === "in" ? "Sign in" : "Create account"}
          </button>

          {/* OAuth stubs (wired to NextAuth providers later). */}
          <div className="flex items-center gap-2 py-1 text-[10px] uppercase tracking-wide text-terminal-muted">
            <span className="h-px flex-1 bg-terminal-border" /> or <span className="h-px flex-1 bg-terminal-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled
              title="OAuth stub — enable a NextAuth provider to activate"
              className="t-btn cursor-not-allowed opacity-50"
            >
              Google
            </button>
            <button
              type="button"
              disabled
              title="OAuth stub — enable a NextAuth provider to activate"
              className="t-btn cursor-not-allowed opacity-50"
            >
              Apple
            </button>
          </div>
        </form>
      </div>
      <p className="mt-3 text-center text-[11px] text-terminal-muted">
        Demo authentication — accounts are stored locally in your browser. Replaced by
        NextAuth (email/password + OAuth) in production.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-terminal-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
