import type { FastifyInstance, FastifyRequest } from "fastify";
import { listActivity, recordActivity, withRefHash } from "../admin/activity";
import { auditEvent, complaints, exportAudit, searchAudit, verifyChain } from "../admin/audit";
import { dashboard } from "../admin/analytics";
import { compliancePack } from "../admin/compliance";
import { authenticateConsole } from "../admin/guard";
import { createPackVersion, listPacks, setPackEnabled } from "../admin/packs";
import { permissionsOf } from "../admin/rbac";
import { mintConsoleToken } from "../admin/session";
import {
  createDraft,
  getTemplate,
  listTemplates,
  previewTemplate,
  setTemplateEnabled,
  transition,
} from "../admin/templates";
import {
  AuditExportQuery,
  AuditQuery,
  ComplaintsQuery,
  ConsoleSessionRequest,
  DateRangeQuery,
  EnabledRequest,
  IdParam,
  PackParams,
  PackVersionRequest,
  TemplateDraftRequest,
  TemplateListQuery,
  TemplatePreviewRequest,
  TemplateTransitionRequest,
} from "../admin/schemas";
import { authenticate } from "../auth/guard";
import { forbidden, notFound, parseOr400 } from "../errors";
import type { V1Deps } from "./v1";

/**
 * Bank console API (section 7: `/v1/admin/*`, RBAC). The console's backend signs in staff and
 * mints an 8-hour console token over HMAC; every route then checks the user's role.
 */
export function adminRoutes(app: FastifyInstance, deps: V1Deps): void {
  const auth = (req: FastifyRequest, permission: Parameters<typeof authenticateConsole>[2]) =>
    authenticateConsole(req, deps, permission);

  // ── Sign-in (console backend only) ──
  app.get("/v1/admin/users", async (req) => {
    const bank = await authenticate(req, deps, null, "console");
    if (bank.kind !== "server") throw forbidden();
    const users = await deps.prisma.consoleUser.findMany({
      where: { bankId: bank.bankId, active: true },
      orderBy: { email: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });
    return { users };
  });

  app.post("/v1/admin/sessions", async (req, reply) => {
    const bank = await authenticate(req, deps, null, "console");
    if (bank.kind !== "server") throw forbidden();
    const { consoleUserId } = parseOr400(ConsoleSessionRequest, req.body);
    const user = await deps.prisma.consoleUser.findFirst({
      where: { id: consoleUserId, bankId: bank.bankId, active: true },
    });
    if (!user) throw notFound();
    await recordActivity(deps.prisma, user, "sign_in", {}, deps.clock());
    const role = user.role;
    const { token, expiresAt } = await mintConsoleToken(
      deps.sessionSecret,
      { bankId: bank.bankId, userId: user.id, role },
      Math.floor(deps.clock().getTime() / 1000),
    );
    return reply.code(201).send({
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, name: user.name, email: user.email, role },
      permissions: permissionsOf(role),
    });
  });

  app.get("/v1/admin/me", async (req) => {
    const user = await auth(req, "dashboard:read");
    return { user, permissions: permissionsOf(user.role) };
  });

  // ── Dashboard ──
  app.get("/v1/admin/dashboard", async (req) => {
    const user = await auth(req, "dashboard:read");
    const q = parseOr400(DateRangeQuery, req.query);
    const to = q.to ? new Date(q.to) : deps.clock();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 86_400_000);
    return dashboard(deps.prisma, user.bankId, from, to);
  });

  // ── Rule packs ──
  app.get("/v1/admin/rule-packs", async (req) => {
    const user = await auth(req, "packs:read");
    return { packs: await listPacks(deps.prisma, user.bankId, deps.clock()) };
  });

  app.post("/v1/admin/rule-packs/:key/:variant/versions", async (req, reply) => {
    const user = await auth(req, "packs:write");
    const { key, variant } = parseOr400(PackParams, req.params);
    const body = parseOr400(PackVersionRequest, req.body);
    return reply
      .code(201)
      .send(await createPackVersion(deps.prisma, user, key, variant, body, deps.clock()));
  });

  app.patch("/v1/admin/rule-packs/:key/:variant", async (req) => {
    const user = await auth(req, "killswitch:write");
    const { key, variant } = parseOr400(PackParams, req.params);
    const body = parseOr400(EnabledRequest, req.body);
    return setPackEnabled(
      deps.prisma,
      user,
      key,
      variant,
      body.enabled,
      body.comment,
      deps.clock(),
    );
  });

  // ── Templates ──
  app.get("/v1/admin/templates", async (req) => {
    const user = await auth(req, "templates:read");
    const q = parseOr400(TemplateListQuery, req.query);
    return { templates: await listTemplates(deps.prisma, user.bankId, q) };
  });

  app.post("/v1/admin/templates/preview", async (req) => {
    const user = await auth(req, "templates:read");
    const body = parseOr400(TemplatePreviewRequest, req.body);
    return previewTemplate(deps.prisma, user.bankId, body, deps.clock());
  });

  app.get("/v1/admin/templates/:id", async (req) => {
    const user = await auth(req, "templates:read");
    const { id } = parseOr400(IdParam, req.params);
    return getTemplate(deps.prisma, user.bankId, id);
  });

  app.post("/v1/admin/templates", async (req, reply) => {
    const user = await auth(req, "templates:write");
    const body = parseOr400(TemplateDraftRequest, req.body);
    return reply.code(201).send(await createDraft(deps.prisma, user, body, deps.clock()));
  });

  app.post("/v1/admin/templates/:id/transitions", async (req) => {
    const { id } = parseOr400(IdParam, req.params);
    const body = parseOr400(TemplateTransitionRequest, req.body);
    const permission =
      body.action === "submit"
        ? "templates:write"
        : body.action === "sharia_approve"
          ? "templates:sharia"
          : body.action === "approve"
            ? "templates:approve"
            : "templates:read"; // reject: role checked against the template's state
    const user = await auth(req, permission);
    return transition(deps.prisma, user, id, body.action, body.comment, deps.clock());
  });

  app.patch("/v1/admin/templates/:id", async (req) => {
    const user = await auth(req, "killswitch:write");
    const { id } = parseOr400(IdParam, req.params);
    const body = parseOr400(EnabledRequest, req.body);
    return setTemplateEnabled(deps.prisma, user, id, body.enabled, body.comment, deps.clock());
  });

  app.get("/v1/admin/approvals", async (req) => {
    const user = await auth(req, "packs:read");
    const rows = await deps.prisma.approvalLog.findMany({
      where: { bankId: user.bankId },
      orderBy: { at: "desc" },
      take: 50,
      include: { actor: { select: { name: true, role: true } } },
    });
    return {
      entries: rows.map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        actor: r.actor.name,
        role: r.actor.role,
        comment: r.comment,
        diff: r.diff,
        at: r.at.toISOString(),
      })),
    };
  });

  // ── Audit ──
  const log = (
    user: { id: string; bankId: string },
    action: Parameters<typeof recordActivity>[2],
    detail: Record<string, unknown>,
  ) => recordActivity(deps.prisma, user, action, detail, deps.clock());

  app.get("/v1/admin/audit", async (req) => {
    const user = await auth(req, "audit:read");
    const q = parseOr400(AuditQuery, req.query);
    const result = await searchAudit(deps.prisma, user.bankId, deps.auditHashSecret, q);
    await log(user, "audit_search", {
      ...withRefHash(deps.auditHashSecret, user.bankId, q),
      results: result.events.length,
    });
    return result;
  });

  app.get("/v1/admin/audit/verify", async (req) => {
    const user = await auth(req, "audit:read");
    const result = await verifyChain(deps.prisma, user.bankId);
    await log(user, "audit_verify", { ok: result.ok, checked: result.checked });
    return result;
  });

  app.get("/v1/admin/activity", async (req) => {
    const user = await auth(req, "audit:read");
    return { entries: await listActivity(deps.prisma, user.bankId) };
  });

  app.get("/v1/admin/audit/export", async (req, reply) => {
    const user = await auth(req, "audit:export");
    const { format, ...q } = parseOr400(AuditExportQuery, req.query);
    const body = await exportAudit(deps.prisma, user.bankId, deps.auditHashSecret, q, format);
    await log(user, "audit_export", {
      format,
      ...withRefHash(deps.auditHashSecret, user.bankId, q),
    });
    return reply
      .header("content-type", format === "csv" ? "text/csv; charset=utf-8" : "application/json")
      .header("content-disposition", `attachment; filename="amil-audit.${format}"`)
      .send(body);
  });

  app.get("/v1/admin/audit/:id", async (req) => {
    const user = await auth(req, "audit:read");
    const { id } = parseOr400(IdParam, req.params);
    const result = await auditEvent(deps.prisma, user.bankId, id);
    await log(user, "audit_event_view", { eventId: id, seq: result.event.seq });
    return result;
  });

  app.get("/v1/admin/complaints", async (req) => {
    const user = await auth(req, "complaints:read");
    const q = parseOr400(ComplaintsQuery, req.query);
    const result = await complaints(deps.prisma, user.bankId, deps.auditHashSecret, q);
    await log(user, "complaints_lookup", {
      ...withRefHash(deps.auditHashSecret, user.bankId, q),
      insights: result.insights.length,
    });
    return result;
  });

  // ── Compliance pack ──
  app.get("/v1/admin/compliance", async (req) => {
    const user = await auth(req, "compliance:read");
    return compliancePack(deps.prisma, deps.gateway, user.bankId, deps.clock());
  });
}
