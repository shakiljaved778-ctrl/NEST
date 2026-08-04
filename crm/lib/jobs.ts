import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getSlaSettings } from "@/lib/settings";
import { notify, notifyMany } from "@/lib/services/notify";
import { routeLead } from "@/lib/services/routing";
import { fmtDate } from "@/lib/utils";

// DB-backed job queue. Jobs are claimed with an atomic UPDATE … RETURNING so
// multiple workers never double-process. Recurring system jobs (SLA sweep,
// renewal reminders, daily digest) re-enqueue themselves after each run.

export async function enqueueJob(type: string, payload: object = {}, runAt: Date = new Date()) {
  return db.job.create({ data: { type, payload: payload as never, runAt } });
}

/** Ensure a self-rescheduling system job exists (idempotent). */
async function ensureRecurring(type: string, nextRunAt: Date) {
  const existing = await db.job.findFirst({ where: { type, status: "PENDING" } });
  if (!existing) await enqueueJob(type, {}, nextRunAt);
}

export async function ensureSystemJobs() {
  await ensureRecurring("sla_check", new Date());
  await ensureRecurring("renewal_check", new Date());
  await ensureRecurring("subscription_expiry", new Date());
  await ensureRecurring("daily_digest", nextDigestTime());
}

/** Daily digest at 06:00 Asia/Qatar (03:00 UTC). */
function nextDigestTime(): Date {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// ─── Processors ──────────────────────────────────────────────────────────────

async function processSlaCheck(): Promise<void> {
  const sla = await getSlaSettings();
  const now = new Date();

  // 1. Newly breached: SLA due passed, no first touch, not yet flagged
  const breached = await db.lead.findMany({
    where: {
      deletedAt: null,
      status: "NEW",
      firstTouchAt: null,
      slaBreachedAt: null,
      slaDueAt: { lt: now },
    },
    include: { owner: { select: { id: true, name: true } }, team: { select: { teamLeadId: true } } },
    take: 200,
  });

  for (const lead of breached) {
    await db.lead.update({ where: { id: lead.id }, data: { slaBreachedAt: now } });
    await logAudit({
      action: "SLA_BREACH",
      entityType: "LEAD",
      entityId: lead.id,
      entityLabel: `${lead.firstName} ${lead.lastName}`,
      after: { slaDueAt: lead.slaDueAt?.toISOString() },
    });
    const recipients = new Set<string>();
    if (lead.ownerId) recipients.add(lead.ownerId);
    if (lead.team?.teamLeadId) recipients.add(lead.team.teamLeadId);
    await notifyMany(Array.from(recipients), {
      type: "sla_breach",
      title: "Lead SLA breached",
      body: `First touch overdue for ${lead.firstName} ${lead.lastName}${lead.company ? ` (${lead.company})` : ""}`,
      link: `/leads/${lead.id}`,
    });
  }

  // 2. Escalation: still untouched N minutes after breach → optionally reassign
  const escalateCutoff = new Date(now.getTime() - sla.escalateAfterMinutes * 60_000);
  const toEscalate = await db.lead.findMany({
    where: {
      deletedAt: null,
      status: "NEW",
      firstTouchAt: null,
      slaBreachedAt: { lt: escalateCutoff },
      slaEscalatedAt: null,
    },
    include: { team: { select: { teamLeadId: true } } },
    take: 100,
  });

  for (const lead of toEscalate) {
    await db.lead.update({ where: { id: lead.id }, data: { slaEscalatedAt: now } });
    if (sla.reassignOnEscalate) {
      await routeLead(lead.id); // re-run routing (round-robin picks the next rep)
      await logAudit({
        action: "ASSIGN", entityType: "LEAD", entityId: lead.id,
        after: { reason: "sla_escalation_reassign" },
      });
    }
    if (lead.team?.teamLeadId) {
      await notify({
        userId: lead.team.teamLeadId,
        type: "sla_escalation",
        title: "Lead escalated — SLA still breached",
        body: `${lead.firstName} ${lead.lastName} has had no first touch. ${sla.reassignOnEscalate ? "It was re-routed." : "Manual action needed."}`,
        link: `/leads/${lead.id}`,
      });
    }
  }
}

const RENEWAL_WINDOWS = [60, 30, 7] as const;

async function processRenewalCheck(): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 61 * 86_400_000);
  const subs = await db.subscription.findMany({
    where: { deletedAt: null, status: "ACTIVE", renewalDate: { gte: now, lte: horizon } },
    include: {
      product: { select: { name: true } },
      account: { select: { id: true, legalName: true, ownerId: true } },
      contact: { select: { id: true, firstName: true, lastName: true, ownerId: true } },
    },
  });

  for (const sub of subs) {
    if (!sub.renewalDate) continue;
    const daysLeft = Math.ceil((sub.renewalDate.getTime() - now.getTime()) / 86_400_000);
    const sent = (sub.remindersSent as number[]) ?? [];
    const window = RENEWAL_WINDOWS.find((w) => daysLeft <= w && !sent.includes(w));
    if (!window) continue;

    const ownerId = sub.account?.ownerId ?? sub.contact?.ownerId;
    const clientName = sub.account?.legalName ?? `${sub.contact?.firstName} ${sub.contact?.lastName}`;
    const link = sub.account ? `/clients/accounts/${sub.account.id}` : `/clients/contacts/${sub.contact?.id}`;

    if (ownerId) {
      await notify({
        userId: ownerId,
        type: "renewal",
        title: `Renewal in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        body: `${clientName} — ${sub.product.name} renews on ${fmtDate(sub.renewalDate)}`,
        link,
      });
    }
    await db.subscription.update({
      where: { id: sub.id },
      data: { remindersSent: [...sent, window] as never },
    });
  }
}

/** Mark active subscriptions whose renewal date has passed as EXPIRED. */
async function processSubscriptionExpiry(): Promise<void> {
  const graceCutoff = new Date(Date.now() - 86_400_000); // 1-day grace
  await db.subscription.updateMany({
    where: { deletedAt: null, status: "ACTIVE", renewalDate: { lt: graceCutoff } },
    data: { status: "EXPIRED" },
  });
}

async function processDailyDigest(): Promise<void> {
  // Lazy import keeps nodemailer (Node-only) out of the edge/instrumentation bundle.
  const { sendMail } = await import("@/lib/email");
  const users = await db.user.findMany({
    where: { active: true, deletedAt: null, emailDigest: true, role: { in: ["REP", "TEAM_LEAD", "MANAGER"] } },
  });
  const now = new Date();
  const endOfDay = new Date(now.getTime() + 86_400_000);

  for (const user of users) {
    const [dueTasks, overdueTasks, newLeads, unread] = await Promise.all([
      db.task.count({ where: { ownerId: user.id, status: "OPEN", deletedAt: null, dueAt: { gte: now, lte: endOfDay } } }),
      db.task.count({ where: { ownerId: user.id, status: "OPEN", deletedAt: null, dueAt: { lt: now } } }),
      db.lead.count({ where: { ownerId: user.id, status: "NEW", deletedAt: null, firstTouchAt: null } }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    if (dueTasks + overdueTasks + newLeads === 0) continue;
    await sendMail({
      to: user.email,
      subject: `Your day: ${newLeads} new leads, ${dueTasks} tasks due, ${overdueTasks} overdue`,
      text: [
        `Good morning ${user.name},`,
        ``,
        `• New leads awaiting first touch: ${newLeads}`,
        `• Tasks due today: ${dueTasks}`,
        `• Overdue tasks: ${overdueTasks}`,
        `• Unread notifications: ${unread}`,
        ``,
        `Open your My Day board: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/my-day`,
      ].join("\n"),
    });
  }
}

// ─── Worker ──────────────────────────────────────────────────────────────────

const PROCESSORS: Record<string, () => Promise<void>> = {
  sla_check: processSlaCheck,
  renewal_check: processRenewalCheck,
  subscription_expiry: processSubscriptionExpiry,
  daily_digest: processDailyDigest,
};

const RESCHEDULE_MS: Record<string, number> = {
  sla_check: 60_000, // every minute
  renewal_check: 60 * 60_000, // hourly
  subscription_expiry: 60 * 60_000, // hourly
};

async function claimJob() {
  const rows = await db.$queryRaw<{ id: string; type: string; payload: unknown }[]>`
    UPDATE "Job" SET status = 'RUNNING', "lockedAt" = NOW(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job"
      WHERE status = 'PENDING' AND "runAt" <= NOW()
      ORDER BY "runAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload`;
  return rows[0] ?? null;
}

/** Process pending jobs until the queue is drained. Returns number processed. */
export async function runPendingJobs(): Promise<number> {
  let processed = 0;
  for (let i = 0; i < 50; i++) {
    const job = await claimJob();
    if (!job) break;
    processed++;
    const processor = PROCESSORS[job.type];
    try {
      if (job.type === "route_lead") {
        const { leadId } = job.payload as { leadId: string };
        await routeLead(leadId);
      } else if (processor) {
        await processor();
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }
      await db.job.update({ where: { id: job.id }, data: { status: "DONE", processedAt: new Date() } });
    } catch (err) {
      const jobRow = await db.job.findUnique({ where: { id: job.id } });
      const failedForGood = (jobRow?.attempts ?? 1) >= (jobRow?.maxAttempts ?? 3);
      await db.job.update({
        where: { id: job.id },
        data: {
          status: failedForGood ? "FAILED" : "PENDING",
          runAt: new Date(Date.now() + 30_000 * (jobRow?.attempts ?? 1)),
          lastError: err instanceof Error ? err.message : String(err),
        },
      });
      console.error(`[jobs] ${job.type} failed`, err);
    }
    // self-reschedule recurring jobs
    if (RESCHEDULE_MS[job.type]) {
      await ensureRecurringAfter(job.type, RESCHEDULE_MS[job.type]);
    } else if (job.type === "daily_digest") {
      await enqueueJob("daily_digest", {}, nextDigestTime());
    }
  }
  return processed;
}

async function ensureRecurringAfter(type: string, ms: number) {
  const existing = await db.job.findFirst({ where: { type, status: "PENDING" } });
  if (!existing) await enqueueJob(type, {}, new Date(Date.now() + ms));
}
