import type { Prisma } from "@prisma/client";
import { hashCustomerRef, type PrismaClient } from "@amil/db";
import type { ModelGateway } from "@amil/gateway";
import {
  AlertListQuery,
  CheckRequest,
  CheckResponse,
  EventRequest,
  ExplainChargeRequest,
  InsightCard,
  type Alert,
  ConsentPurpose,
  ConsentRequest,
  DEFAULT_SESSION_SCOPES,
  InsightResponseRequest,
  SessionRequest,
  type ConsentList,
} from "@amil/sdk";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCustomer, authenticate, type AuthDeps } from "../auth/guard";
import { mintSessionToken } from "../auth/session";
import { badRequest, forbidden, notFound, parseOr400 } from "../errors";
import { explainCharge } from "../services/charges";
import { type CheckDeps, runCheck } from "../services/checks";

export interface V1Deps extends AuthDeps {
  prisma: PrismaClient;
  gateway: ModelGateway;
  auditHashSecret: string;
}

const CustomerRefParam = z.object({ customerRef: z.string().min(1).max(64) });
const InsightIdParam = z.object({ id: z.string().uuid() });
const AlertIdParam = z.object({ id: z.string().min(1).max(64) });
const WithdrawQuery = z.object({ purpose: ConsentPurpose });

export function v1Routes(app: FastifyInstance, deps: V1Deps): void {
  const customerId = async (bankId: string, customerRef: string) => {
    const c = await deps.prisma.customer.findUnique({
      where: { bankId_externalRef: { bankId, externalRef: customerRef } },
      select: { id: true },
    });
    if (!c) throw notFound();
    return c.id;
  };
  const consentList = async (bankId: string, customerRef: string): Promise<ConsentList> => {
    const id = await customerId(bankId, customerRef);
    const rows = await deps.prisma.consent.findMany({
      where: { customerId: id },
      orderBy: { grantedAt: "asc" },
    });
    return {
      customerRef,
      consents: rows.map((r) => ({
        id: r.id,
        purpose: r.purpose as z.infer<typeof ConsentPurpose>,
        version: r.version,
        method: r.method,
        grantedAt: r.grantedAt.toISOString(),
        withdrawnAt: r.withdrawnAt?.toISOString() ?? null,
        privacyPolicyVersion: r.privacyPolicyVersion,
      })),
    };
  };

  // ── Sessions: the bank's backend mints a short-lived widget token ──
  app.post("/v1/sessions", async (req, reply) => {
    const auth = await authenticate(req, deps, null);
    const body = parseOr400(SessionRequest, req.body);
    await customerId(auth.bankId, body.customerRef);
    const scopes = body.scopes ?? DEFAULT_SESSION_SCOPES;
    const { token, expiresAt } = await mintSessionToken(
      deps.sessionSecret,
      {
        bankId: auth.bankId,
        customerRef: body.customerRef,
        scopes,
        ...(body.locale ? { locale: body.locale } : {}),
      },
      Math.floor(deps.clock().getTime() / 1000),
    );
    return reply.code(201).send({ token, expiresAt: expiresAt.toISOString(), scopes });
  });

  // ── Consents (non-negotiable 5) ──
  app.post("/v1/consents", async (req, reply) => {
    const auth = await authenticate(req, deps, "consents:write");
    const body = parseOr400(ConsentRequest, req.body);
    assertCustomer(auth, body.customerRef);
    const id = await customerId(auth.bankId, body.customerRef);
    const now = deps.clock();
    const row = await deps.prisma.consent.create({
      data: {
        customerId: id,
        purpose: body.purpose,
        version: body.version,
        method: body.method,
        privacyPolicyVersion: body.privacyPolicyVersion,
        grantedAt: now,
      },
    });
    return reply.code(201).send({
      id: row.id,
      purpose: body.purpose,
      version: row.version,
      method: row.method,
      grantedAt: row.grantedAt.toISOString(),
      withdrawnAt: null,
      privacyPolicyVersion: row.privacyPolicyVersion,
    });
  });

  app.get("/v1/consents/:customerRef", async (req) => {
    const auth = await authenticate(req, deps, "consents:read");
    const { customerRef } = parseOr400(CustomerRefParam, req.params);
    assertCustomer(auth, customerRef);
    return consentList(auth.bankId, customerRef);
  });

  app.delete("/v1/consents/:customerRef", async (req) => {
    const auth = await authenticate(req, deps, "consents:write");
    const { customerRef } = parseOr400(CustomerRefParam, req.params);
    const { purpose } = parseOr400(WithdrawQuery, req.query);
    assertCustomer(auth, customerRef);
    const id = await customerId(auth.bankId, customerRef);
    await deps.prisma.consent.updateMany({
      where: { customerId: id, purpose, withdrawnAt: null },
      data: { withdrawnAt: deps.clock() },
    });
    return consentList(auth.bankId, customerRef);
  });

  const checkDeps = (log: CheckDeps["log"]): CheckDeps => ({
    prisma: deps.prisma,
    gateway: deps.gateway,
    auditHashSecret: deps.auditHashSecret,
    clock: deps.clock,
    log,
  });

  // ── Pre-action check ──
  app.post("/v1/checks", async (req) => {
    const auth = await authenticate(req, deps, "checks:write");
    const body = parseOr400(CheckRequest, req.body);
    assertCustomer(auth, body.customerRef);
    return runCheck(
      checkDeps(req.log),
      auth.bankId,
      body,
      auth.kind === "session" ? auth.locale : undefined,
    );
  });

  // ── Customer response to an insight (append-only) ──
  app.post("/v1/insights/:id/responses", async (req, reply) => {
    const auth = await authenticate(req, deps, "insights:respond");
    const { id } = parseOr400(InsightIdParam, req.params);
    const body = parseOr400(InsightResponseRequest, req.body);
    const event = await deps.prisma.insightEvent.findFirst({
      where: { id, bankId: auth.bankId },
      select: { id: true, customerRefHash: true, shown: true, applicable: true },
    });
    if (!event) throw notFound();
    if (
      auth.kind === "session" &&
      event.customerRefHash !== hashCustomerRef(deps.auditHashSecret, auth.bankId, auth.customerRef)
    )
      throw forbidden();
    if (body.action === "chose_option") {
      const shown = z
        .object({ options: z.array(z.object({ key: z.string() })) })
        .safeParse(event.shown);
      if (
        !body.optionKey ||
        !shown.success ||
        !shown.data.options.some((o) => o.key === body.optionKey)
      )
        throw badRequest("unknown_option");
    }
    const row = await deps.prisma.customerResponse.create({
      data: {
        insightEventId: event.id,
        action: body.action,
        optionKey: body.optionKey ?? null,
        at: deps.clock(),
      },
    });
    return reply
      .code(201)
      .send({ id: row.id, insightId: event.id, action: row.action, at: row.at.toISOString() });
  });

  // ── Proactive alerts (written by the scheduler; read here) ──
  interface AlertRow {
    id: string;
    rulePackKey: string;
    severity: Alert["severity"];
    createdAt: Date;
    readAt: Date | null;
    localeEventIds: unknown;
    insightEvent: { id: string; shown: unknown } | null;
  }
  const alertSelect = {
    id: true,
    rulePackKey: true,
    severity: true,
    createdAt: true,
    readAt: true,
    localeEventIds: true,
    insightEvent: { select: { id: true, shown: true } },
  } as const;
  const LocaleEventIds = z.record(z.string(), z.string());
  /** Alerts with the card in the requested language when it was worded in it (else preferred). */
  const toAlerts = async (rows: AlertRow[], locale?: "en" | "ar"): Promise<Alert[]> => {
    const wanted = new Map<string, string>();
    if (locale)
      for (const r of rows) {
        const ids = LocaleEventIds.safeParse(r.localeEventIds);
        const id = ids.success ? ids.data[locale] : undefined;
        if (id && id !== r.insightEvent?.id) wanted.set(r.id, id);
      }
    const localized = wanted.size
      ? await deps.prisma.insightEvent.findMany({
          where: { id: { in: [...wanted.values()] } },
          select: { id: true, shown: true },
        })
      : [];
    const byId = new Map(localized.map((e) => [e.id, e]));
    return rows.flatMap((row) => {
      const event = byId.get(wanted.get(row.id) ?? "") ?? row.insightEvent;
      const card = InsightCard.safeParse(event?.shown);
      if (!event || !card.success) return [];
      return [
        {
          id: row.id,
          rulePackKey: row.rulePackKey as Alert["rulePackKey"],
          severity: row.severity,
          createdAt: row.createdAt.toISOString(),
          readAt: row.readAt?.toISOString() ?? null,
          insight: CheckResponse.parse({
            insightId: event.id,
            applicable: true,
            kind: "insight",
            severity: row.severity,
            card: card.data,
            requiresAcknowledgement: false,
          }),
        },
      ];
    });
  };

  app.get("/v1/alerts", async (req) => {
    const auth = await authenticate(req, deps, "alerts:read");
    const { customerRef, locale } = parseOr400(AlertListQuery, req.query);
    assertCustomer(auth, customerRef);
    const id = await customerId(auth.bankId, customerRef);
    // Withdrawing proactive-alert consent hides alerts immediately (non-negotiable 5).
    const consent = await deps.prisma.consent.findFirst({
      where: { customerId: id, purpose: "proactive_alerts", withdrawnAt: null },
      select: { id: true },
    });
    const rows = consent
      ? await deps.prisma.alert.findMany({
          where: { customerId: id, dismissedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 50,
          select: alertSelect,
        })
      : [];
    const alerts = await toAlerts(
      rows,
      locale ?? (auth.kind === "session" ? auth.locale : undefined),
    );
    return { customerRef, unread: alerts.filter((a) => !a.readAt).length, alerts };
  });

  app.post("/v1/alerts/:id/read", async (req) => {
    const auth = await authenticate(req, deps, "alerts:read");
    const { id } = parseOr400(AlertIdParam, req.params);
    const row = await deps.prisma.alert.findFirst({
      where: { id, customer: { bankId: auth.bankId } },
      select: { ...alertSelect, customer: { select: { externalRef: true } } },
    });
    if (!row) throw notFound();
    assertCustomer(auth, row.customer.externalRef);
    const updated = row.readAt
      ? row
      : await deps.prisma.alert.update({
          where: { id },
          data: { readAt: deps.clock() },
          select: alertSelect,
        });
    const [alert] = await toAlerts([updated], auth.kind === "session" ? auth.locale : undefined);
    if (!alert) throw notFound();
    return alert;
  });

  // ── Explain my charge ──
  app.post("/v1/explain-charge", async (req) => {
    const auth = await authenticate(req, deps, "charges:explain");
    const body = parseOr400(ExplainChargeRequest, req.body);
    assertCustomer(auth, body.customerRef);
    return explainCharge(
      checkDeps(req.log),
      auth.bankId,
      body,
      auth.kind === "session" ? auth.locale : undefined,
    );
  });

  // ── Inbound product events (bank backend only, idempotent) ──
  // Recorded for the bank's own audit and for a pilot where AMIL keeps its own store. In the MVP
  // AMIL reads the bank's (synthetic) records directly (D-024), so events trigger no processing.
  app.post("/v1/events", async (req, reply) => {
    const auth = await authenticate(req, deps, null);
    const body = parseOr400(EventRequest, req.body);
    if (body.customerRef) await customerId(auth.bankId, body.customerRef);
    const where = {
      bankId_idempotencyKey: { bankId: auth.bankId, idempotencyKey: body.idempotencyKey },
    };
    const existing = await deps.prisma.inboundEvent.findUnique({ where });
    const ack = (row: { id: string; receivedAt: Date }, duplicate: boolean) => ({
      eventId: row.id,
      idempotencyKey: body.idempotencyKey,
      receivedAt: row.receivedAt.toISOString(),
      duplicate,
    });
    if (existing) return reply.code(200).send(ack(existing, true));
    try {
      const row = await deps.prisma.inboundEvent.create({
        data: {
          bankId: auth.bankId,
          idempotencyKey: body.idempotencyKey,
          type: body.type,
          // Validated JSON from the request body: safe to store as Prisma JSON.
          payload: JSON.parse(
            JSON.stringify({
              occurredAt: body.occurredAt,
              ...(body.customerRef ? { customerRef: body.customerRef } : {}),
              data: body.payload,
            }),
          ) as Prisma.InputJsonObject,
          receivedAt: deps.clock(),
        },
      });
      return reply.code(201).send(ack(row, false));
    } catch (error) {
      // A concurrent retry with the same key won the insert: acknowledge it as a duplicate.
      const raced = await deps.prisma.inboundEvent.findUnique({ where });
      if (raced) return reply.code(200).send(ack(raced, true));
      throw error;
    }
  });
}
