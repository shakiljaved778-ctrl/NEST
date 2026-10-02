import { test as base, expect } from "@playwright/test";

/**
 * `page` that fails the test if the browser reports a Content-Security-Policy violation, so the
 * policy (D-065) is exercised by every end-to-end flow.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content.Security.Policy/i.test(m.text())) violations.push(m.text());
    });
    page.on("pageerror", (e) => {
      if (/Content.Security.Policy/i.test(e.message)) violations.push(e.message);
    });
    await use(page);
    expect(violations).toEqual([]);
  },
});

export { expect };
export type { BrowserContext, Page } from "@playwright/test";
