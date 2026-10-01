import { expect, type Page, test } from "@playwright/test";

async function as(page: Page, persona: string, locale: "en" | "ar") {
  await page
    .context()
    .addCookies([{ name: "ddb_locale", value: locale, url: "http://localhost:3000" }]);
  await page.goto("/personas");
  await page.getByTestId(`persona-${persona}`).click();
  await page.waitForURL("http://localhost:3000/");
}

test.describe("Phase 6: Ask AMIL and compare", () => {
  test("Khalid asks what happens if he closes his card: fact chips, then Redeem points", async ({
    page,
  }) => {
    await as(page, "khalid", "en");
    await page.goto("/ask");
    const assistant = page.locator("amil-assistant");
    await assistant.getByRole("button", { name: "What happens if I close my card?" }).click();
    const answer = assistant.locator('.amil[data-kind="insight"]');
    await expect(answer.locator("h3")).toHaveText(
      "Closing this card forfeits 42,000 points (about QAR 420.00)",
    );
    await expect(answer).toHaveAttribute("data-severity", "critical");
    await expect(answer.locator('[data-fact="pointsValue"]')).toContainText("QAR 420.00");
    await expect(answer.locator("footer")).toContainText("Figures from Doha Demo Bank records");
    await answer.getByRole("button", { name: "Redeem points first" }).click();
    await expect(page).toHaveURL(/\/cards\/card_khalid_platinum\/rewards$/);
  });

  test("Ask AMIL refuses investment advice and offers Talk to someone", async ({ page }) => {
    await as(page, "khalid", "en");
    await page.goto("/ask");
    const assistant = page.locator("amil-assistant");
    await assistant.getByRole("textbox").fill("Should I invest in stocks?");
    await assistant.getByRole("button", { name: "Send" }).click();
    const answer = assistant.locator('.amil[data-kind="refusal"]');
    await expect(answer.locator("h3")).toHaveText("I can't give investment or product advice");
    await expect(answer.getByRole("button", { name: "Talk to someone" })).toBeVisible();
    await expect(answer.locator("[data-fact]")).toHaveCount(0);
  });

  test("Ask AMIL in Arabic, right-to-left", async ({ page }) => {
    await as(page, "khalid", "ar");
    await page.goto("/ask");
    const assistant = page.locator("amil-assistant");
    await assistant.getByRole("button", { name: "ماذا يحدث إذا أغلقت بطاقتي؟" }).click();
    await expect(assistant.locator('.amil[data-kind="insight"] h3')).toHaveText(
      "إغلاق هذه البطاقة يُفقدك 42,000 نقطة (نحو 420.00 ر.ق)",
    );
    await expect(assistant.locator("div[dir]").first()).toHaveAttribute("dir", "rtl");
  });

  test("Fatima compares settlement dates; the cheaper date is marked and deep-links", async ({
    page,
  }) => {
    await as(page, "fatima", "en");
    await page.getByTestId("finance-fin_fatima_murabaha").click();
    await page.getByTestId("compare-settlement").click();
    await expect(page.getByTestId("compare-headline")).toHaveText(
      /^Settling on .+ costs QAR 4,000\.00 less than today$/,
    );
    await expect(page.locator('th[data-option="cheapest_date"]')).toHaveAttribute(
      "data-best",
      "true",
    );
    await expect(page.locator('[data-cell="cheapest_date.savingVsToday"]')).toHaveText(
      "QAR 4,000.00",
    );
    await page.getByTestId("compare-action-schedule_settlement").click();
    await expect(page).toHaveURL(/\/finance\/fin_fatima_murabaha\/settle\/schedule\?date=/);
  });

  test("Aisha: break now or wait, in Arabic", async ({ page }) => {
    await as(page, "aisha", "ar");
    await page.goto("/compare/deposit?depositId=dep_aisha_term12");
    await expect(page.getByTestId("compare-headline")).toHaveText(/يمنحك 9,012\.33 ر\.ق أكثر$/);
    await expect(page.locator('th[data-option="wait_to_maturity"]')).toHaveAttribute(
      "data-best",
      "true",
    );
  });
});
