import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { titleCase } from "@/lib/utils";
import { PasswordForm, TotpSection, DigestToggle } from "@/components/settings/settings-forms";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const dbUser = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { team: { select: { name: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd>{dbUser.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{dbUser.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Role</dt><dd>{titleCase(dbUser.role)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Team</dt><dd>{dbUser.team?.name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Territory</dt><dd>{dbUser.territory ?? "—"}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>Minimum 10 characters, with upper, lower and a number.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Two-factor authentication (TOTP)</CardTitle>
          <CardDescription>Add an authenticator app for a second sign-in factor.</CardDescription>
        </CardHeader>
        <CardContent>
          <TotpSection enabled={dbUser.totpEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <DigestToggle enabled={dbUser.emailDigest} />
        </CardContent>
      </Card>
    </div>
  );
}
