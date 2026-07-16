import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Defence-in-depth: middleware also guards /admin, and every admin action
  // re-checks the role server-side.
  if (session?.user?.role !== "ADMIN") redirect("/my-day");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <AdminNav />
      <div>{children}</div>
    </div>
  );
}
