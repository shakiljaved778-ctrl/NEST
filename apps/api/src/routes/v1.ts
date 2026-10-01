import { hashCustomerRef, type PrismaClient } from "@amil/db";
import type { ModelGateway } from "@amil/gateway";
import {
  CheckRequest,
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
import { runCheck } from "../services/checks";

export interface V1Deps extends AuthDeps {
  prisma: PrismaClient;
  gateway: ModelGateway;
  auditHashSecret: string;
}

const CustomerRefParam = z.object({ customerRef: z.string().min(1).max(64) });
const InsightIdParam = z.object({ id: z.string().uuid() });
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

  // ── Pre-action check ──
  app.post("/v1/checks", async (req) => {
    const auth = await authenticate(req, deps, "checks:write");
    const body = parseOr400(CheckRequest, req.body);
    assertCustomer(auth, body.customerRef);
    return runCheck(
      {
        prisma: deps.prisma,
        gateway: deps.gateway,
        auditHashSecret: deps.auditHashSecret,
        clock: deps.clock,
        log: req.log,
      },
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
}
