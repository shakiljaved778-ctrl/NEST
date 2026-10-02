import { ROLE_LABELS } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export default async function Forbidden() {
  const me = await requireUser();
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold">Not available for your role</h1>
      <p className="mt-2 text-sm text-ink-muted">
        You are signed in as {ROLE_LABELS[me.user.role]?.title}. {ROLE_LABELS[me.user.role]?.can}{" "}
        Segregation of duties keeps this page with another role.
      </p>
    </div>
  );
}
