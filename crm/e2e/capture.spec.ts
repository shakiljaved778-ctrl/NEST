import { test, expect } from "@playwright/test";

// Public lead-capture endpoint (no auth). Uses the seeded campaign token.
test.describe("Lead capture endpoint", () => {
  test("creates a lead from a valid tokenized POST", async ({ request }) => {
    const res = await request.post("/api/capture/leads", {
      data: {
        token: "demo-campaign-token",
        firstName: "Capture",
        lastName: `E2E${Date.now()}`,
        email: `capture${Date.now()}@example.qa`,
        phone: "+974 5555 9999",
        consent: true,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBeTruthy();
  });

  test("rejects an invalid token", async ({ request }) => {
    const res = await request.post("/api/capture/leads", {
      data: { token: "not-a-real-token", firstName: "X", lastName: "Y" },
    });
    expect(res.status()).toBe(403);
  });

  test("rejects a payload that fails validation", async ({ request }) => {
    const res = await request.post("/api/capture/leads", {
      data: { token: "demo-campaign-token" }, // missing firstName
    });
    expect(res.status()).toBe(422);
  });

  test("inbound webhook accepts a loose payload", async ({ request }) => {
    const res = await request.post("/api/webhooks/leads/demo-webhook-token", {
      data: { name: "Webhook E2E", email: `hook${Date.now()}@example.qa`, company: "Hook Co" },
    });
    expect(res.status()).toBe(201);
  });
});
