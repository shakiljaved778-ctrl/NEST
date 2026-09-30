import { execSync } from "node:child_process";

/** Apply migrations to the integration-test database, if one is configured. */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  execSync("prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: url },
  });
}
