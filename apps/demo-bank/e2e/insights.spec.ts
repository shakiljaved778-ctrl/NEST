import { expect, type Page, test } from "./fixtures";

/** Log in as a demo persona (demo-only switcher) in a given language. */
async function as(page: Page, persona: string, locale: "en" | "ar") {
  await page
    .context()
    .addCookies([{ name: "ddb_locale", value: locale, url: "http://localhost:3000" }]);
  await page.goto("/personas");
  await page.getByTestId(`persona-${persona}`).click();
  await page.waitForURL("http://localhost:3000/");
}

test.describe("Khalid closes his Platinum card", () => {
  test("sees the critical points insight in English and deep-links to Redeem points", async ({
    page,
  }) => {
    await as(page, "khalid", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.getByTestId("card-card_khalid_platinum").click();
    await page.getByTestId("close-card").click();

    const card = page.locator("amil-insight .card");
    await expect(card.locator("h2")).toHaveText(
      "Closing this card forfeits 42,000 points (about QAR 420.00)",
    );
    await expect(card).toHaveAttribute("data-severity", "critical");
    await expect(card.locator('[data-fact="pointsValue"]')).toContainText("QAR 420.00");
    await expect(card.locator("footer")).toContainText("Figures from Doha Demo Bank records as of");

    // Critical: "Continue" is disabled until the customer acknowledges.
    const continueBtn = card.locator('[data-option="continue_closure"]');
    await expect(continueBtn).toBeDisabled();
    await card.getByLabel("I understand").check();
    await expect(continueBtn).toBeEnabled();

    // The loss-avoiding option comes first and deep-links into the bank's own flow.
    const options = card.locator("button.option");
    await expect(options.first()).toHaveText("Redeem points first");
    await options.first().click();
    await expect(page).toHaveURL(/\/cards\/card_khalid_platinum\/rewards$/);
    await expect(page.getByTestId("rewards-screen")).toContainText("42,000");
  });

  test("sees the same insight in Arabic, right-to-left, and deep-links to Redeem points", async ({
    page,
  }) => {
    await as(page, "khalid", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.goto("/cards/card_khalid_platinum/close");

    const card = page.locator("amil-insight .card");
    await expect(card.locator("h2")).toHaveText(
      "إغلاق هذه البطاقة يُفقدك 42,000 نقطة (نحو 420.00 ر.ق)",
    );
    await expect(card).toHaveAttribute("dir", "rtl");
    await expect(card.locator('[data-option="continue_closure"]')).toBeDisabled();
    await expect(card.locator("footer")).toContainText("الأرقام من سجلات بنك الدوحة التجريبي");

    await card.getByRole("button", { name: "استبدل النقاط أولاً" }).click();
    await expect(page).toHaveURL(/\/cards\/card_khalid_platinum\/rewards$/);
    await expect(page.getByTestId("rewards-screen")).toBeVisible();
  });

  test("can still continue to the bank's own confirmation after acknowledging", async ({
    page,
  }) => {
    await as(page, "khalid", "en");
    await page.goto("/cards/card_khalid_platinum/close");
    const card = page.locator("amil-insight .card");
    await card.getByLabel("I understand").check();
    await card.locator('[data-option="continue_closure"]').click();
    await expect(page).toHaveURL(/\/cards\/card_khalid_platinum\/close\/confirm$/);
    await expect(page.getByTestId("bank-confirm")).toContainText(
      "AMIL never closes cards or moves money",
    );
  });
});

test("Fatima settles early and is offered the cheaper date first", async ({ page }) => {
  await as(page, "fatima", "en");
  await page.getByTestId("finance-fin_fatima_murabaha").click();
  await page.getByTestId("settle-early").click();

  const card = page.locator("amil-insight .card");
  await expect(card.locator("h2")).toHaveText(
    /^Settling on \d{1,2} \w{3} \d{4} instead of today costs QAR 4,000.00 less$/,
  );
  await expect(card).toHaveAttribute("data-severity", "critical");
  await expect(card.locator("p.body")).toContainText("ibra (rebate)");

  const first = card.locator("button.option").first();
  await expect(first).toHaveText("Settle on the cheaper date");
  await first.click();
  await expect(page).toHaveURL(
    /\/finance\/fin_fatima_murabaha\/settle\/schedule\?date=\d{4}-\d{2}-\d{2}$/,
  );
  await expect(page.getByTestId("schedule-screen")).toContainText("Settlement scheduled for");
});

test("a customer without consent sees generic information only", async ({ page }) => {
  await as(page, "priya", "en");
  await page.goto("/cards/card_priya_classic/close");
  const card = page.locator("amil-insight .card");
  await expect(card).toHaveAttribute("data-kind", "generic");
  await expect(card.locator("h2")).toHaveText("Before you close your card");
  await expect(card.locator("ul.facts")).toHaveCount(0);
});
