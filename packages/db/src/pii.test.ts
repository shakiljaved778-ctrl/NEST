import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptPii,
  decryptRow,
  encryptPii,
  encryptRow,
  isEncryptedPii,
  keyProviderFromEnv,
  kmsKeyProvider,
  PiiDecryptionError,
  staticKeyProvider,
} from "./pii";

const k1 = randomBytes(32);
const k2 = randomBytes(32);
const p1 = staticKeyProvider([["k1", k1]]);

describe("PII encryption (AES-256-GCM, D-066)", () => {
  it("round-trips, with a fresh IV each time and no plaintext in the stored value", () => {
    const a = encryptPii(p1, "customer", "displayName", "cus_khalid", "Khalid Al-Mansoori");
    const b = encryptPii(p1, "customer", "displayName", "cus_khalid", "Khalid Al-Mansoori");
    expect(a).toMatch(/^enc:v1:k1:[\w-]+:[\w-]+:[\w-]+$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("Khalid");
    expect(isEncryptedPii(a)).toBe(true);
    expect(decryptPii(p1, "customer", "displayName", "cus_khalid", a)).toBe("Khalid Al-Mansoori");
    const ar = encryptPii(p1, "customer", "displayNameAr", "cus_khalid", "خالد المنصوري");
    expect(decryptPii(p1, "customer", "displayNameAr", "cus_khalid", ar)).toBe("خالد المنصوري");
  });

  it("is bound to its table, column and row: a moved ciphertext does not decrypt", () => {
    const v = encryptPii(p1, "card", "pan", "card_a", "0000000100010007");
    expect(() => decryptPii(p1, "card", "pan", "card_b", v)).toThrow(PiiDecryptionError);
    expect(() => decryptPii(p1, "account", "number", "card_a", v)).toThrow(PiiDecryptionError);
  });

  it("detects tampering and refuses plaintext, malformed values and unknown keys", () => {
    const v = encryptPii(p1, "account", "iban", "acc_1", "QA00DDBX000000000000000010001");
    const parts = v.split(":");
    const ct = Buffer.from(parts[4] ?? "", "base64url");
    ct[0] = (ct[0] ?? 0) ^ 1;
    parts[4] = ct.toString("base64url");
    expect(() => decryptPii(p1, "account", "iban", "acc_1", parts.join(":"))).toThrow(
      "authentication failed",
    );
    expect(() => decryptPii(p1, "account", "iban", "acc_1", "QA00DDBX")).toThrow("not encrypted");
    expect(() => decryptPii(p1, "account", "iban", "acc_1", "enc:v1:k1:x")).toThrow("malformed");
    const other = staticKeyProvider([["k9", k2]]);
    expect(() => decryptPii(other, "account", "iban", "acc_1", v)).toThrow("unknown key id k1");
  });

  it("rotates: new writes use the current key, values under the old key still decrypt", () => {
    const old = encryptPii(p1, "customer", "email", "cus_1", "a@b.test");
    const rotated = staticKeyProvider([
      ["k2", k2],
      ["k1", k1],
    ]);
    expect(decryptPii(rotated, "customer", "email", "cus_1", old)).toBe("a@b.test");
    expect(encryptPii(rotated, "customer", "email", "cus_1", "a@b.test")).toMatch(/^enc:v1:k2:/);
  });

  it("encrypts and decrypts exactly the PII columns of a row", () => {
    const row = {
      id: "cus_1",
      externalRef: "DDB-C-0001",
      displayName: "Khalid",
      displayNameAr: "خالد",
      phone: null,
      email: "k@x.test",
    };
    const enc = encryptRow(p1, "customer", row);
    expect(enc.externalRef).toBe("DDB-C-0001");
    expect(enc.phone).toBeNull();
    expect(isEncryptedPii(enc.displayName)).toBe(true);
    expect(isEncryptedPii(enc.email ?? "")).toBe(true);
    expect(decryptRow(p1, "customer", enc)).toEqual(row);
  });

  it("reads keys from the environment and validates them", () => {
    const env = { PII_ENCRYPTION_KEYS: `k2:${k2.toString("base64")}, k1:${k1.toString("base64")}` };
    expect(keyProviderFromEnv(env).currentKeyId).toBe("k2");
    expect(() => keyProviderFromEnv({})).toThrow("PII_ENCRYPTION_KEYS is not set");
    expect(() => keyProviderFromEnv({ PII_ENCRYPTION_KEYS: "k1:c2hvcnQ=" })).toThrow("32 bytes");
    expect(() => staticKeyProvider([["bad id", k1]])).toThrow("invalid PII key id");
    expect(() => staticKeyProvider([])).toThrow("at least one");
  });

  it("unwraps data keys through the KMS interface once", async () => {
    let calls = 0;
    const provider = await kmsKeyProvider(
      [{ keyId: "kms1", wrappedKey: Buffer.from("wrapped") }],
      (w) => {
        calls++;
        expect(w.toString()).toBe("wrapped");
        return Promise.resolve(k1);
      },
    );
    const v = encryptPii(provider, "card", "pan", "c", "0000");
    expect(decryptPii(p1, "card", "pan", "c", v.replace(":kms1:", ":k1:"))).toBe("0000");
    expect(calls).toBe(1);
  });
});
