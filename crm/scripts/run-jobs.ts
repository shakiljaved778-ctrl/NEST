// Standalone job runner: `npm run jobs:run` — useful for cron-based deploys
// and local testing of the queue.
import { ensureSystemJobs, runPendingJobs } from "../lib/jobs";

async function main() {
  await ensureSystemJobs();
  const n = await runPendingJobs();
  console.log(`Processed ${n} job(s)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
