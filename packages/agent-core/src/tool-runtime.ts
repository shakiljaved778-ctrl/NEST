import { z } from "zod";
import {
  type AutonomyTier,
  type ToolDefinition,
  type AuditActorType,
} from "@voyara/contracts";
import { type AuditSink, hashJson } from "./audit.js";

const TIER_RANK: Record<AutonomyTier, number> = { WATCH: 0, ASK: 1, ACT: 2 };

export class MoneyGateError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly tier: AutonomyTier,
  ) {
    super(
      `Tool "${toolName}" moves money and requires approval at autonomy tier ${tier}.`,
    );
    this.name = "MoneyGateError";
  }
}

export class AutonomyCapError extends Error {
  constructor(public readonly amountMinor: number, public readonly capMinor: number) {
    super(`Auto-spend ${amountMinor} exceeds ACT cap ${capMinor}.`);
    this.name = "AutonomyCapError";
  }
}

export interface ExecuteContext {
  actorType: AuditActorType;
  tier: AutonomyTier;
  /** True when the user tapped "approve" for this specific action. */
  userApproved?: boolean;
  /** Per-user ACT auto-spend cap (minor units). */
  actCapMinor?: number;
  /** Amount this call will move, if MONEY (minor units) — checked against cap. */
  amountMinor?: number;
  tripId?: string;
}

/**
 * The single choke point through which EVERY tool call flows — internal agent,
 * NestJS API, and MCP rails alike. It (a) validates input, (b) writes an audit
 * record BEFORE the side effect, (c) enforces MONEY gating in code (not the
 * prompt), (d) executes, (e) validates output.
 */
export class ToolRuntime {
  constructor(private readonly audit: AuditSink) {}

  async execute<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
    tool: ToolDefinition<I, O>,
    rawInput: unknown,
    handler: (input: z.infer<I>) => Promise<z.infer<O>>,
    ctx: ExecuteContext,
  ): Promise<z.infer<O>> {
    // (a) validate input
    const input = tool.input.parse(rawInput);

    // (c) MONEY gate — enforced here, in the runtime, never in the prompt.
    if (tool.moves === "MONEY") {
      const gateOpen =
        ctx.userApproved === true ||
        TIER_RANK[ctx.tier] >= TIER_RANK[tool.minAutoTier];
      if (!gateOpen) {
        throw new MoneyGateError(tool.name, ctx.tier);
      }
      // ACT auto-execution is additionally bounded by the per-user cap.
      if (
        ctx.userApproved !== true &&
        ctx.tier === "ACT" &&
        ctx.amountMinor != null &&
        ctx.actCapMinor != null &&
        ctx.amountMinor > ctx.actCapMinor
      ) {
        throw new AutonomyCapError(ctx.amountMinor, ctx.actCapMinor);
      }
    }

    // (b) audit BEFORE the side effect
    await this.audit.append({
      actorType: ctx.actorType,
      action: `invoke:${tool.name}`,
      toolName: tool.name,
      inputHash: hashJson(input),
      tripId: ctx.tripId,
      createdAt: new Date().toISOString(),
    });

    // (d) execute
    const rawOutput = await handler(input);

    // (e) validate output + record the fingerprint
    const output = tool.output.parse(rawOutput);
    await this.audit.append({
      actorType: ctx.actorType,
      action: `result:${tool.name}`,
      toolName: tool.name,
      inputHash: hashJson(input),
      outputHash: hashJson(output),
      tripId: ctx.tripId,
      createdAt: new Date().toISOString(),
    });

    return output;
  }
}
