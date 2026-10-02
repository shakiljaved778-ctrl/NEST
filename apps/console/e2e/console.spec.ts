import { type BrowserContext, expect, type Page, test } from "./fixtures";

const BANK = "http://localhost:3000";
const KHALID_CLOSE = `${BANK}/cards/card_khalid_platinum/close`;

/** Demo sign-in: pick a staff member by role. */
async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(role) }).click();
  await page.waitForURL("http://localhost:3001/");
}

/** Khalid, in the demo bank, about to close his Platinum card. */
async function khalidClosing(context: BrowserContext) {
  const page = await context.newPage();
  await context.addCookies([{ name: "ddb_locale", value: "en", url: BANK }]);
  await page.goto(`${BANK}/personas`);
  await page.getByTestId("persona-khalid").click();
  await page.waitForURL(`${BANK}/`);
  await page.goto(KHALID_CLOSE);
  return page;
}

async function setPointValue(page: Page, value: string) {
  await page.goto("/packs/card.close/conventional");
  await page.getByLabel("programmePointValueQar").fill(value);
  await page.getByRole("button", { name: /Review 1 change/ }).click();
  await expect(page.getByTestId("param-diff")).toContainText("programmePointValueQar");
  await page.getByLabel("Reason for the change").fill("Programme repricing (demo)");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await page.waitForURL((u) => u.searchParams.has("saved"));
  await expect(page.getByRole("status")).toContainText(/Saved as version \d+\.\d+\.\d+/);
  await expect(page.getByLabel("programmePointValueQar")).toHaveValue(value);
}

test.describe.serial("Bank console (Phase 7 acceptance)", () => {
  test("changing Khalid's point value in the console changes his next insight", async ({
    page,
    context,
  }) => {
    await signIn(page, "Product manager");
    await page.goto("/packs/card.close/conventional");
    // Start from the seeded behaviour (the ledger's own point value) if a run was interrupted.
    if (await page.getByLabel("programmePointValueQar").inputValue()) await setPointValue(page, "");
    await setPointValue(page, "0.0125");
    await expect(page.getByTestId("version-history")).toContainText("programmePointValueQar");

    const bank = await khalidClosing(context);
    const card = bank.locator("amil-insight .card");
    await expect(card.locator("h2")).toHaveText(
      "Closing this card forfeits 42,000 points (about QAR 525.00)",
    );
    // Khalid takes the loss-avoiding option; the complaints lookup will show it.
    await card.getByRole("button", { name: "Redeem points first" }).click();
    await expect(bank).toHaveURL(/\/rewards$/);

    // Back to the ledger's own value (restores the seeded behaviour).
    await setPointValue(page, "");
    await bank.goto(KHALID_CLOSE);
    await expect(bank.locator("amil-insight .card h2")).toHaveText(
      "Closing this card forfeits 42,000 points (about QAR 420.00)",
    );
  });

  test("disabling card.close removes the insight immediately; enabling brings it back", async ({
    page,
    context,
  }) => {
    await signIn(page, "Product manager");
    await page.goto("/packs");
    const toggle = page
      .getByTestId("pack-card.close-conventional")
      .getByRole("switch", { name: /Card closure \(conventional\)/ });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    page.once("dialog", (d) => void d.accept());
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    const bank = await khalidClosing(context);
    await expect(bank.getByTestId("bank-continue")).toBeVisible();
    await expect(bank.locator("amil-insight .card")).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await bank.goto(KHALID_CLOSE);
    await expect(bank.locator("amil-insight .card h2")).toContainText("42,000 points");
  });

  test("the complaints lookup shows Khalid's history: what he saw and how he responded", async ({
    page,
  }) => {
    await signIn(page, "Compliance officer");
    await page.getByRole("link", { name: "Complaints lookup" }).click();
    await page.getByLabel("Customer reference").fill("DDB-C-0001");
    await page.getByRole("button", { name: "Look up" }).click();
    const result = page.getByTestId("complaints-result");
    await expect(result).toContainText("Audit chain verified");
    const repriced = result
      .locator("li")
      .filter({ hasText: "Closing this card forfeits 42,000 points (about QAR 525.00)" })
      .first();
    await expect(repriced).toContainText("Value of points: QAR 525.00");
    await expect(repriced.getByTestId("response")).toContainText(
      "Chose an option (Redeem points first)",
    );
    await repriced.getByRole("link", { name: /Audit event/ }).click();
    await expect(page.getByTestId("event-chain")).toContainText("Content matches its hash");
    await expect(page.getByTestId("event-chain")).toContainText("Linked to the previous event");
  });

  test("Islamic copy: product drafts and submits, compliance approves, Sharia approves", async ({
    page,
  }) => {
    await signIn(page, "Product manager");
    await page.goto("/templates?pack=salary.transfer_change&locale=en&status=live");
    await page
      .getByRole("row")
      .filter({ hasText: "islamic" })
      .filter({ hasText: "caution" })
      .getByRole("link")
      .click();
    const label = page.getByLabel("Label for talk_to_someone");
    const next =
      (await label.inputValue()) === "Talk to someone" ? "Speak to someone" : "Talk to someone";
    await label.fill(next);
    await expect(page.getByTestId("copy-checks")).toContainText("Copy checks pass");
    await page.getByLabel("Comment").fill("Warmer wording");
    await page.getByRole("button", { name: "Save as new draft" }).click();
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
    const draftUrl = page.url();
    // Banned terms are caught as you type.
    await page.getByLabel("Headline").fill("Upgrade now");
    await expect(page.getByTestId("copy-checks")).toContainText(/upgrade/i);
    await page.reload();

    await page.getByRole("button", { name: "Submit for compliance review" }).click();
    await expect(page.getByText("In compliance review").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

    await signIn(page, "Compliance officer");
    await page.goto(draftUrl);
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Awaiting Sharia approval").first()).toBeVisible();

    await signIn(page, "Sharia reviewer");
    await page.goto(draftUrl);
    await page.getByRole("button", { name: "Sharia approve" }).click();
    await expect(page.getByText("Sharia approved (live)").first()).toBeVisible();
    const history = page.getByTestId("approval-history");
    await expect(history).toContainText("sharia approved");
    await expect(history).toContainText("submitted");
  });

  test("roles see only what they may use (segregation of duties)", async ({ page }) => {
    await signIn(page, "Viewer");
    await expect(page.getByRole("link", { name: "Audit" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Complaints lookup" })).toHaveCount(0);
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "Not available for your role" })).toBeVisible();
    await page.goto("/packs");
    await expect(
      page.getByTestId("pack-card.close-conventional").getByRole("switch"),
    ).toBeDisabled();
  });

  test("audit: search by customer, verify the chain, export CSV", async ({ page }) => {
    await signIn(page, "Compliance officer");
    await page.goto("/audit");
    await page.getByLabel("Customer reference").fill("DDB-C-0001");
    await page.getByLabel("Pack").selectOption("card.close");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByTestId("audit-results")).toContainText("Closing this card forfeits");
    await page.getByRole("button", { name: "Verify hash chain" }).click();
    await expect(page.getByTestId("chain-result")).toContainText("Chain intact");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("amil-audit.csv");
    // Every look at customer data is itself recorded (D-068).
    await page.getByRole("link", { name: "Console activity" }).click();
    const activity = page.getByTestId("activity");
    await expect(activity).toContainText("audit export");
    await expect(activity).toContainText("audit search");
    await expect(activity).not.toContainText("DDB-C-0001");
  });

  test("dashboard and compliance pack render from live data", async ({ page }) => {
    await signIn(page, "Compliance officer");
    await expect(page.getByTestId("kpis")).toContainText("Insights shown");
    await page.getByRole("link", { name: "Compliance pack" }).click();
    await expect(page.getByTestId("model-card")).toContainText("insight.v1");
    const payload = page.getByTestId("redaction-payload");
    await expect(payload).toContainText("QAR 420.00");
    await expect(payload).not.toContainText("Khalid");
    await expect(payload).not.toContainText("DDB-C-0001");
    await expect(page.getByTestId("pack-fields")).toContainText("RewardsLedger");
  });
});
