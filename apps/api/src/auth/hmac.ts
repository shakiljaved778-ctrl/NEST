import { createHmac, timingSafeEqual } from "node:crypto";
import { HEADERS, NONCE_PATTERN, signingString } from "@amil/sdk";
import type { ApiKey } from "../config";

/** Replay window (section 7): requests older or newer than 5 minutes are rejected. */
export const REPLAY_WINDOW_SECONDS = 300;

/** Remembers signatures seen within the replay window. */
export interface ReplayStore {
  /** true if the id was not seen before (and is now recorded), false if it is a replay. */
  claim(id: string, ttlSeconds: number): Promise<boolean>;
}

export class MemoryReplayStore implements ReplayStore {
  private readonly seen = new Map<string, number>();
  constructor(private readonly now: () => number = Date.now) {}

  claim(id: string, ttlSeconds: number): Promise<boolean> {
    const t = this.now();
    for (const [k, exp] of this.seen) if (exp <= t) this.seen.delete(k);
    if (this.seen.has(id)) return Promise.resolve(false);
    this.seen.set(id, t + ttlSeconds * 1000);
    return Promise.resolve(true);
  }
}

export interface RedisSetNx {
  set(key: string, value: string, ex: "EX", seconds: number, nx: "NX"): Promise<unknown>;
}

export class RedisReplayStore implements ReplayStore {
  constructor(private readonly redis: RedisSetNx) {}
  async claim(id: string, ttlSeconds: number): Promise<boolean> {
    return (await this.redis.set(`amil:replay:${id}`, "1", "EX", ttlSeconds, "NX")) === "OK";
  }
}

export type HmacFailure =
  "missing_headers" | "unknown_key" | "stale_timestamp" | "bad_signature" | "replayed";

export interface HmacInput {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  /** Path including the query string, exactly as sent. */
  url: string;
  rawBody: string;
}

const header = (h: HmacInput["headers"], name: string): string | undefined => {
  const v = h[name];
  return Array.isArray(v) ? v[0] : v;
};

/**
 * Verify a bank-to-AMIL request: known key, timestamp within +/-5 minutes, HMAC-SHA256 over
 * timestamp.method.path.body[.nonce] (constant-time compare), and a signature never seen before.
 * The optional nonce is signed, so identical requests in the same second can both be accepted.
 */
export async function verifyHmac(
  input: HmacInput,
  keys: ApiKey[],
  replay: ReplayStore,
  nowSeconds: number,
): Promise<{ ok: true; key: ApiKey } | { ok: false; reason: HmacFailure }> {
  const keyId = header(input.headers, HEADERS.key);
  const timestamp = header(input.headers, HEADERS.timestamp);
  const signature = header(input.headers, HEADERS.signature);
  const nonce = header(input.headers, HEADERS.nonce);
  if (!keyId || !timestamp || !signature) return { ok: false, reason: "missing_headers" };
  if (nonce !== undefined && !NONCE_PATTERN.test(nonce))
    return { ok: false, reason: "bad_signature" };
  const key = keys.find((k) => k.keyId === keyId);
  if (!key) return { ok: false, reason: "unknown_key" };
  const ts = Number(timestamp);
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(nowSeconds - ts) > REPLAY_WINDOW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }
  const expected = createHmac("sha256", key.secret)
    .update(signingString(timestamp, input.method, input.url, input.rawBody, nonce))
    .digest();
  const given = /^[0-9a-f]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : Buffer.alloc(0);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!(await replay.claim(`${keyId}:${signature}`, REPLAY_WINDOW_SECONDS * 2))) {
    return { ok: false, reason: "replayed" };
  }
  return { ok: true, key };
}
