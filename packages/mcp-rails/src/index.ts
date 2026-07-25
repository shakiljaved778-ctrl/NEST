import { z } from "zod";
import { TOOLS, type ToolName, money, type Money } from "@voyara/contracts";
import {
  ToolRuntime,
  type AuditSink,
  type ExecuteContext,
} from "@voyara/agent-core";
import { Ledger, transfer, Accounts } from "@voyara/ledger";

/**
 * External MCP server (Phase 3 GA). It exposes the SAME tool definitions from
 * contracts/ as the internal agent — one definition, three consumers — wrapped
 * with partner auth, scoped consent, delegated payment mandates, rate limits,
 * and per-booking billing posted through the ledger.
 */
export interface ApiPartner {
  id: string;
  name: string;
  scopes: ToolName[];
  perBookingFeeMinor: number;
  rateLimit: number;
}

/** JSON-schema-ish descriptors advertised to partner AI assistants. */
export function listMcpTools() {
  return (Object.keys(TOOLS) as ToolName[]).map((name) => ({
    name,
    description: TOOLS[name].description,
    moves: TOOLS[name].moves,
  }));
}

export class PartnerScopeError extends Error {
  constructor(tool: ToolName) {
    super(`Partner is not scoped for tool "${tool}".`);
    this.name = "PartnerScopeError";
  }
}

export class McpRails {
  private readonly runtime: ToolRuntime;

  constructor(
    audit: AuditSink,
    private readonly ledger: Ledger,
  ) {
    this.runtime = new ToolRuntime(audit);
  }

  /**
   * Invoke a tool on behalf of a partner. Enforces scope, runs it through the
   * shared ToolRuntime (validation + audit + MONEY gate), and bills per booking.
   */
  async invoke<N extends ToolName>(
    partner: ApiPartner,
    name: N,
    rawInput: unknown,
    handler: (input: z.infer<(typeof TOOLS)[N]["input"]>) => Promise<z.infer<(typeof TOOLS)[N]["output"]>>,
    ctx: Omit<ExecuteContext, "actorType">,
  ): Promise<z.infer<(typeof TOOLS)[N]["output"]>> {
    if (!partner.scopes.includes(name)) throw new PartnerScopeError(name);

    // Indexed-union over the registry defeats TS generic inference; the tool
    // and handler are provably matched by the ToolName key, so erase the
    // generic here and re-narrow the result.
    const exec = this.runtime.execute.bind(this.runtime) as (
      tool: unknown,
      rawInput: unknown,
      handler: unknown,
      ctx: ExecuteContext,
    ) => Promise<unknown>;
    const out = (await exec(TOOLS[name], rawInput, handler, {
      ...ctx,
      actorType: "PARTNER_AGENT",
    })) as z.infer<(typeof TOOLS)[N]["output"]>;

    // Per-booking billing: a completed book_trip earns the partner fee.
    if (name === "book_trip") {
      const fee: Money = money(partner.perBookingFeeMinor, "USD");
      this.ledger.post(
        transfer({
          from: Accounts.voyaraRevenue("partner_fee"),
          to: `partner:${partner.id}`,
          amount: fee,
          memo: `MCP per-booking fee ${partner.name}`,
        }),
      );
    }
    return out;
  }
}
