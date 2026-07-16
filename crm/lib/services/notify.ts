import { db } from "@/lib/db";

export async function notify(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  await db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    },
  });
}

export async function notifyMany(userIds: string[], params: Omit<Parameters<typeof notify>[0], "userId">) {
  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    })),
  });
}
