import { requireUser } from "@/lib/auth";

export const metadata = { title: "My Day" };

export default async function MyDayPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="text-2xl font-semibold">My Day</h1>
      <p className="text-muted-foreground">Welcome back, {user.name}</p>
    </div>
  );
}
