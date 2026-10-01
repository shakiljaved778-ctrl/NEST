import { signRequest } from "@amil/sdk/server";
import { describe, expect, it } from "vitest";
import { MemoryReplayStore, verifyHmac } from "./hmac";
import { mintSessionToken, verifySessionToken } from "./session";

const keys = [{ keyId: "ddb-demo", secret: "s".repeat(40), bankId: "bank_ddb" }];
const NOW = 1_790_000_000;

function signed(
  overrides: {
    body?: string;
    ts?: number;
    secret?: string;
    keyId?: string;
    url?: string;
    method?: string;
  } = {},
) {
  const body = overrides.body ?? '{"a":1}';
  const ts = String(overrides.ts ?? NOW);
  const url = overrides.url ?? "/v1/checks";
  const method = overrides.method ?? "POST";
  return {
    headers: {
      "x-amil-key": overrides.keyId ?? "ddb-demo",
      "x-amil-timestamp": ts,
      "x-amil-signature": signRequest(overrides.secret ?? "s".repeat(40), ts, method, url, body),
    },
    method: "POST",
    url: "/v1/checks",
    rawBody: '{"a":1}',
  };
}

describe("HMAC verification", () => {
  it("accepts a correctly signed request once, then rejects the replay", async () => {
    const store = new MemoryReplayStore(() => NOW * 1000);
    const req = signed();
    expect(await verifyHmac(req, keys, store, NOW)).toMatchObject({
      ok: true,
      key: { bankId: "bank_ddb" },
    });
    expect(await verifyHmac(req, keys, store, NOW)).toEqual({ ok: false, reason: "replayed" });
  });

  it.each([
    ["a tampered body", signed({ body: '{"a":2}' }), "bad_signature"],
    ["a different path", signed({ url: "/v1/sessions" }), "bad_signature"],
    ["a different method", signed({ method: "DELETE" }), "bad_signature"],
    ["the wrong secret", signed({ secret: "t".repeat(40) }), "bad_signature"],
    ["an unknown key", signed({ keyId: "other" }), "unknown_key"],
    ["a timestamp 6 minutes old", signed({ ts: NOW - 360 }), "stale_timestamp"],
    ["a timestamp 6 minutes ahead", signed({ ts: NOW + 360 }), "stale_timestamp"],
  ] as const)("rejects %s", async (_name, req, reason) => {
    expect(await verifyHmac(req, keys, new MemoryReplayStore(), NOW)).toEqual({
      ok: false,
      reason,
    });
  });

  it("accepts a timestamp 4 minutes old", async () => {
    expect(
      (await verifyHmac(signed({ ts: NOW - 240 }), keys, new MemoryReplayStore(), NOW)).ok,
    ).toBe(true);
  });

  it("rejects missing headers and non-hex signatures", async () => {
    expect(
      await verifyHmac(
        { headers: {}, method: "POST", url: "/", rawBody: "" },
        keys,
        new MemoryReplayStore(),
        NOW,
      ),
    ).toEqual({ ok: false, reason: "missing_headers" });
    const bad = signed();
    bad.headers["x-amil-signature"] = "zz";
    expect(await verifyHmac(bad, keys, new MemoryReplayStore(), NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });
});

describe("session tokens", () => {
  const secret = "x".repeat(40);
  it("round-trips claims and expires after 15 minutes", async () => {
    const { token, expiresAt } = await mintSessionToken(
      secret,
      { bankId: "bank_ddb", customerRef: "DDB-C-0001", scopes: ["checks:write"], locale: "ar" },
      NOW,
    );
    expect(expiresAt.getTime()).toBe((NOW + 900) * 1000);
    expect(await verifySessionToken(secret, token, NOW + 899)).toEqual({
      bankId: "bank_ddb",
      customerRef: "DDB-C-0001",
      scopes: ["checks:write"],
      locale: "ar",
    });
    expect(await verifySessionToken(secret, token, NOW + 901)).toBeNull();
  });

  it("rejects a token signed with another secret or tampered with", async () => {
    const { token } = await mintSessionToken(
      secret,
      { bankId: "bank_ddb", customerRef: "DDB-C-0001", scopes: ["checks:write"] },
      NOW,
    );
    expect(await verifySessionToken("y".repeat(40), token, NOW)).toBeNull();
    const [h, p, s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "DDB-C-0002", bank: "bank_ddb", scopes: ["checks:write"] })).toString("base64url")}.${s}`;
    expect(p).toBeDefined();
    expect(await verifySessionToken(secret, forged, NOW)).toBeNull();
  });
});
