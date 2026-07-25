/**
 * Saga orchestrator for multi-supplier checkout. Steps run forward; on any
 * failure, completed steps are compensated in reverse order. Every step is
 * idempotent via an idempotency key so retries never double-apply.
 */
export interface SagaStep<Ctx> {
  name: string;
  /** Idempotency key; the same key must not apply an effect twice. */
  idempotencyKey: (ctx: Ctx) => string;
  execute: (ctx: Ctx) => Promise<void>;
  compensate?: (ctx: Ctx) => Promise<void>;
}

export interface SagaResult {
  ok: boolean;
  completed: string[];
  compensated: string[];
  failedStep?: string;
  error?: string;
}

export class Saga<Ctx> {
  private readonly applied = new Set<string>();

  constructor(
    public readonly sagaId: string,
    private readonly steps: SagaStep<Ctx>[],
  ) {}

  async run(ctx: Ctx): Promise<SagaResult> {
    const completed: SagaStep<Ctx>[] = [];
    for (const step of this.steps) {
      const key = `${step.name}:${step.idempotencyKey(ctx)}`;
      try {
        if (!this.applied.has(key)) {
          await step.execute(ctx);
          this.applied.add(key);
        }
        completed.push(step);
      } catch (err) {
        const compensated = await this.compensate(completed, ctx);
        return {
          ok: false,
          completed: completed.map((s) => s.name),
          compensated,
          failedStep: step.name,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    return {
      ok: true,
      completed: completed.map((s) => s.name),
      compensated: [],
    };
  }

  private async compensate(completed: SagaStep<Ctx>[], ctx: Ctx): Promise<string[]> {
    const done: string[] = [];
    for (const step of [...completed].reverse()) {
      if (step.compensate) {
        try {
          await step.compensate(ctx);
          done.push(step.name);
        } catch {
          // Compensation is best-effort; record and continue unwinding.
          done.push(`${step.name}(compensation-error)`);
        }
      }
    }
    return done;
  }
}
