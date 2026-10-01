import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";

/** Log in as a demo persona (demo-only switcher) in a given language. */
async function as(page: Page, persona: string, locale: "en" | "ar") {
  await page
    .context()
    .addCookies([{ name: "ddb_locale", value: locale, url: "http://localhost:3000" }]);
  await page.goto("/personas");
  await page.getByTestId(`persona-${persona}`).click();
  await page.waitForURL("http://localhost:3000/");
}

test.describe("Phase 5: more packs, alerts, explain my charge", () => {
  test("Aisha breaks her term deposit: critical card, keep-until-maturity deep link", async ({
    page,
  }) => {
    await as(page, "aisha", "en");
    await page.getByTestId("deposit-dep_aisha_term12").click();
    await page.getByTestId("break-deposit").click();
    const card = page.locator("amil-insight .card");
    await expect(card.locator("h2")).toHaveText(
      "Keeping this deposit 9 more days pays QAR 9,012.33 more",
    );
    await expect(card).toHaveAttribute("data-severity", "critical");
    await expect(card.locator('[data-option="continue_break"]')).toBeDisabled();
    await card.getByRole("button", { name: "Keep until maturity" }).click();
    await expect(page).toHaveURL(/\/deposits\/dep_aisha_term12$/);
  });

  test("Aisha in Arabic sees the same card right-to-left", async ({ page }) => {
    await as(page, "aisha", "ar");
    await page.goto("/act/deposit.break?depositId=dep_aisha_term12");
    const card = page.locator("amil-insight .card");
    await expect(card.locator("h2")).toHaveText(
      "إبقاء هذه الوديعة 9 يوماً إضافياً يمنحك 9,012.33 ر.ق أكثر",
    );
    await expect(card).toHaveAttribute("dir", "rtl");
  });

  test("a cash withdrawal on Khalid's card shows the fee before the bank's confirmation", async ({
    page,
  }) => {
    await as(page, "khalid", "en");
    await page.getByTestId("card-card_khalid_platinum").click();
    await page.getByTestId("action-withdraw").click();
    const card = page.locator("amil-insight .card");
    await expect(card.locator("h2")).toHaveText(
      "A cash withdrawal of QAR 1,000.00 has a fee of QAR 60.00",
    );
    await card.getByRole("button", { name: "Continue with the withdrawal" }).click();
    await expect(page).toHaveURL(/\/cards\/card_khalid_platinum\/cash\/confirm\?amount=1000.00$/);
    await expect(page.getByTestId("bank-screen")).toBeVisible();
  });

  test("alerts appear in the inbox after the scheduler runs", async ({ page }) => {
    // Run the proactive packs now, as the BullMQ schedule would at 06:00 Doha time.
    execSync("pnpm --filter @amil/api proactive:run", { cwd: "../..", stdio: "pipe" });

    await as(page, "khalid", "en");
    await page.goto("/alerts");
    const alert = page.getByTestId("alert-rewards.expiry").locator("amil-insight .card");
    await expect(alert.locator("h2")).toHaveText(/^8,000 points worth QAR 80\.00 expire on /);
    await alert.getByRole("button", { name: "Redeem points" }).click();
    await expect(page).toHaveURL(/\/cards\/card_khalid_platinum\/rewards$/);

    await as(page, "grace", "ar");
    await page.goto("/alerts");
    const dormancy = page.getByTestId("alert-account.dormancy").locator("amil-insight .card");
    await expect(dormancy.locator("h2")).toHaveText(/^يصبح هذا الحساب خاملاً في .+، بعد 25 يوماً$/);
    await expect(dormancy).toHaveAttribute("data-severity", "critical");
  });

  test("a no-consent customer gets no alerts", async ({ page }) => {
    await as(page, "priya", "en");
    await page.goto("/alerts");
    await expect(page.getByTestId("alerts-empty")).toBeVisible();
  });

  test("explain my charge: Ravi's cash withdrawal fee is matched to the withdrawal", async ({
    page,
  }) => {
    await as(page, "ravi", "en");
    await page.getByTestId("card-card_ravi_gold").click();
    await page.getByTestId("action-statement").click();
    await page.getByTestId("fee-CARD_CASH_ADVANCE").first().click();
    const x = page.getByTestId("charge-explanation");
    await expect(x).toHaveAttribute("data-kind", "charge");
    await expect(x).toContainText("Cash withdrawal fee");
    await expect(page.getByTestId("charge-amount")).toHaveText("QAR 60.00");
    await expect(page.getByTestId("charge-lines")).toContainText("Fee under the published rule");
    await expect(page.getByTestId("charge-lines")).toContainText("ATM cash withdrawal");
    await expect(page.getByTestId("charge-match")).toHaveText("This matches the published fee.");
    await expect(page.getByTestId("charge-disclosure")).toContainText("No AI is used");
  });
});
