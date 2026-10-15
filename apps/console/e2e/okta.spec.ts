import { expect, test } from "./fixtures";

const OKTA_CONSOLE = "http://localhost:3002";
const MOCK_OKTA = "http://localhost:4100";

/** The console configured for Okta (D-077), against a test-only OpenID provider. */
test.describe.serial("Console sign-in with Okta", () => {
  test("only Okta sign-in is offered; the demo staff picker is off", async ({ page }) => {
    await page.goto(`${OKTA_CONSOLE}/login`);
    await expect(page.getByRole("link", { name: "Sign in with Okta" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Compliance officer/ })).toHaveCount(0);
  });

  test("a staff member signs in with Okta and gets their AMIL role", async ({ page, request }) => {
    await request.get(`${MOCK_OKTA}/mock/login-as?email=compliance@ddb.example.test`);
    await page.goto(`${OKTA_CONSOLE}/login`);
    await page.getByRole("link", { name: "Sign in with Okta" }).click();
    await page.waitForURL(`${OKTA_CONSOLE}/`);
    await expect(page.getByTestId("signed-in-user")).toHaveText("Demo Compliance Officer");
    await page.getByRole("link", { name: "Console activity" }).click();
    await expect(page.getByTestId("activity")).toContainText("method: okta");
  });

  test("an Okta account that is not an AMIL console user is refused", async ({ page, request }) => {
    await request.get(`${MOCK_OKTA}/mock/login-as?email=someone.else@ddb.example.test`);
    await page.goto(`${OKTA_CONSOLE}/login`);
    await page.getByRole("link", { name: "Sign in with Okta" }).click();
    await page.waitForURL(/\/login\?error=not_authorised$/);
    await expect(page.getByText(/not set up as an AMIL console user/)).toBeVisible();
    await page.goto(`${OKTA_CONSOLE}/`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("a callback without a matching sign-in attempt is rejected", async ({ page }) => {
    await page.goto(`${OKTA_CONSOLE}/auth/okta/callback?code=forged&state=forged`);
    await expect(page).toHaveURL(/\/login\?error=sign_in_failed$/);
  });
});
