import { db } from "@/lib/db";

export interface SlaSettings {
  firstTouchMinutes: number;
  escalateAfterMinutes: number;
  reassignOnEscalate: boolean;
}

const DEFAULT_SLA: SlaSettings = { firstTouchMinutes: 30, escalateAfterMinutes: 60, reassignOnEscalate: false };

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.appSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return { ...fallback, ...(row.value as object) } as T;
}

export async function setSetting(key: string, value: object): Promise<void> {
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

export async function getSlaSettings(): Promise<SlaSettings> {
  return getSetting("sla", DEFAULT_SLA);
}
