// Next.js instrumentation hook: starts the in-process job worker when the
// server boots (Node runtime only). For serverless deployments disable this
// and hit POST /api/jobs/run from an external cron instead.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.JOBS_DISABLE_WORKER === "true") return;

  const { runPendingJobs, ensureSystemJobs } = await import("@/lib/jobs");
  const interval = Number(process.env.JOBS_POLL_INTERVAL_MS ?? 15_000);

  await ensureSystemJobs().catch((e) => console.error("[jobs] ensureSystemJobs failed", e));

  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runPendingJobs();
    } catch (e) {
      console.error("[jobs] worker tick failed", e);
    } finally {
      running = false;
    }
  }, interval).unref();

  console.log(`[jobs] in-process worker started (poll ${interval}ms)`);
}
