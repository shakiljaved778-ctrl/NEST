import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getSlaSettings } from "@/lib/settings";
import { notify } from "@/lib/services/notify";

export interface RoutingCriteria {
  sources?: string[];
  channels?: string[];
  territories?: string[];
  productIds?: string[];
  minScore?: number;
  maxScore?: number;
}

export function ruleMatches(
  criteria: RoutingCriteria,
  lead: { source: string; channel: string | null; territory: string | null; productInterestId: string | null; score: number }
): boolean {
  if (criteria.sources?.length && !criteria.sources.includes(lead.source)) return false;
  if (criteria.channels?.length && (!lead.channel || !criteria.channels.includes(lead.channel))) return false;
  if (criteria.territories?.length && (!lead.territory || !criteria.territories.includes(lead.territory)))
    return false;
  if (criteria.productIds?.length && (!lead.productInterestId || !criteria.productIds.includes(lead.productInterestId)))
    return false;
  if (criteria.minScore != null && lead.score < criteria.minScore) return false;
  if (criteria.maxScore != null && lead.score > criteria.maxScore) return false;
  return true;
}

/** Round-robin over a team's active, present members. Skips inactive/on-leave users. */
async function pickRoundRobin(teamId: string): Promise<string | null> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { active: true, onLeave: false, deletedAt: null, role: { in: ["REP", "TEAM_LEAD"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      },
    },
  });
  if (!team || team.members.length === 0) return null;
  const idx = team.rrCursor % team.members.length;
  await db.team.update({ where: { id: teamId }, data: { rrCursor: (idx + 1) % team.members.length } });
  return team.members[idx].id;
}

export interface RouteResult {
  ownerId: string | null;
  teamId: string | null;
  ruleId: string | null;
  ruleName: string | null;
}

/**
 * Evaluate active routing rules in priority order and assign the lead.
 * Sets the SLA due time and notifies the assigned rep. Every assignment is
 * audit-logged with the matched rule.
 */
export async function routeLead(leadId: string): Promise<RouteResult> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.deletedAt) return { ownerId: null, teamId: null, ruleId: null, ruleName: null };

  const rules = await db.leadRoutingRule.findMany({
    where: { active: true, deletedAt: null },
    orderBy: [{ isFallback: "asc" }, { priority: "asc" }],
  });

  let result: RouteResult = { ownerId: null, teamId: null, ruleId: null, ruleName: null };

  for (const rule of rules) {
    if (!rule.isFallback && !ruleMatches(rule.criteria as RoutingCriteria, lead)) continue;

    if (rule.targetType === "REP" && rule.targetRepId) {
      const rep = await db.user.findFirst({
        where: { id: rule.targetRepId, active: true, onLeave: false, deletedAt: null },
        select: { id: true, teamId: true },
      });
      if (!rep) continue; // rep unavailable → try next rule
      result = { ownerId: rep.id, teamId: rep.teamId, ruleId: rule.id, ruleName: rule.name };
      break;
    }
    if (rule.targetType === "TEAM_ROUND_ROBIN" && rule.targetTeamId) {
      const repId = await pickRoundRobin(rule.targetTeamId);
      if (!repId) continue;
      result = { ownerId: repId, teamId: rule.targetTeamId, ruleId: rule.id, ruleName: rule.name };
      break;
    }
  }

  const sla = await getSlaSettings();
  const slaDueAt = new Date(Date.now() + sla.firstTouchMinutes * 60_000);

  await db.lead.update({
    where: { id: leadId },
    data: { ownerId: result.ownerId, teamId: result.teamId, slaDueAt },
  });

  await logAudit({
    action: "ASSIGN",
    entityType: "LEAD",
    entityId: leadId,
    entityLabel: `${lead.firstName} ${lead.lastName}`,
    after: {
      ownerId: result.ownerId,
      teamId: result.teamId,
      rule: result.ruleName ?? "unrouted",
      slaDueAt: slaDueAt.toISOString(),
    },
  });

  if (result.ownerId) {
    await notify({
      userId: result.ownerId,
      type: "lead_assigned",
      title: "New lead assigned",
      body: `${lead.firstName} ${lead.lastName}${lead.company ? ` — ${lead.company}` : ""} (first touch due in ${sla.firstTouchMinutes} min)`,
      link: `/leads/${leadId}`,
    });
  }

  return result;
}
