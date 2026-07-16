import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <LoginForm googleEnabled={googleEnabled} />
      </Suspense>
    </div>
  );
}
