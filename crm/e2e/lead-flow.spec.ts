import { test, expect } from "@playwright/test";

// Critical revenue flow: create a lead → convert it (account + contact + deal)
// → move the deal to Closed Won.
test("lead create → convert → win deal", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@crm.qa");
  await page.getByLabel("Password").fill("Passw0rd!Demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/my-day");

  const stamp = Date.now();
  const first = "E2E";
  const last = `Lead${stamp}`;

  // 1. Create a lead
  await page.goto("/leads");
  await page.getByRole("button", { name: "New lead" }).click();
  await page.getByLabel("First name *").fill(first);
  await page.getByLabel("Last name *").fill(last);
  await page.getByLabel("Company").fill(`E2E Corp ${stamp}`);
  await page.getByRole("button", { name: "Create lead" }).click();

  // lands on the lead detail page
  await page.waitForURL(/\/leads\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: `${first} ${last}` })).toBeVisible();

  // 2. Convert → creates account + contact + deal, redirects to the deal
  await page.getByRole("button", { name: "Convert" }).click();
  await expect(page.getByRole("heading", { name: "Convert lead" })).toBeVisible();
  await page.getByRole("button", { name: "Convert lead" }).click();
  await page.waitForURL(/\/deals\/[a-z0-9]+$/);

  // 3. Move the deal to Closed Won via the stage bar
  await page.getByRole("button", { name: "Closed Won" }).click();
  // won subscriptions dialog appears; skip it
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("WON").first()).toBeVisible();
});
