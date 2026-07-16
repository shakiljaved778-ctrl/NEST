"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/my-day";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        totp: totp || undefined,
        redirect: false,
      });
      if (res?.error) {
        const code = res.code ?? res.error;
        if (code.includes("TOTP_REQUIRED")) {
          setNeedsTotp(true);
          setError(t("auth.totpRequired"));
        } else if (code.includes("TOTP_INVALID")) {
          setNeedsTotp(true);
          setError("Invalid authenticator code");
        } else if (code.includes("ACCOUNT_LOCKED")) {
          setError(t("auth.accountLocked"));
        } else {
          setError(t("auth.invalidCredentials"));
        }
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Landmark className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">{t("app.name")}</CardTitle>
        <CardDescription>{t("app.tagline")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.qa"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {needsTotp && (
            <div className="space-y-2">
              <Label htmlFor="totp">{t("auth.totp")}</Label>
              <Input
                id="totp"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                placeholder="123456"
                autoFocus
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "…" : t("auth.signIn")}
          </Button>
          {googleEnabled && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signIn("google", { callbackUrl })}
            >
              {t("auth.signInWithGoogle")}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
