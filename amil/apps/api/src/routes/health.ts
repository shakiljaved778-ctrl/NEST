import type { FastifyInstance } from "fastify";

export type DependencyCheck = () => Promise<void>;

export interface HealthDeps {
  checks: Record<string, DependencyCheck>;
  version: string;
}

const CHECK_TIMEOUT_MS = 2_000;

async function runCheck(check: DependencyCheck): Promise<"ok" | "fail"> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS);
      }),
    ]);
    return "ok";
  } catch {
    return "fail";
  } finally {
    clearTimeout(timer);
  }
}

export function healthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  /** Liveness: the process is up. Never touches dependencies. */
  app.get("/healthz", () => ({ status: "ok", service: "amil-api", version: deps.version }));

  /** Readiness: every dependency (Postgres, Redis) answers. 503 otherwise. */
  app.get("/readyz", async (_req, reply) => {
    const names = Object.keys(deps.checks);
    const results = await Promise.all(
      names.map((n) => runCheck(deps.checks[n] ?? (() => Promise.reject(new Error(n))))),
    );
    const checks = Object.fromEntries(names.map((n, i) => [n, results[i]]));
    const ready = results.every((r) => r === "ok");
    return reply.code(ready ? 200 : 503).send({ status: ready ? "ready" : "not_ready", checks });
  });
}
