import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@crm.qa");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("signs in as admin and lands on My Day", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@crm.qa");
    await page.getByLabel("Password").fill("Passw0rd!Demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/my-day");
    await expect(page.getByRole("heading", { name: "My Day" })).toBeVisible();
  });

  test("a rep cannot reach the admin area", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("rep1@crm.qa");
    await page.getByLabel("Password").fill("Passw0rd!Demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/my-day");
    // middleware redirects /admin → /my-day for non-admins
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/my-day/);
  });
});
