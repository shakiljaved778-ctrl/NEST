import { describe, it, expect, beforeAll } from "vitest";
import { encryptField, decryptField, maskId, last3, generateTotpSecret, totpCode, verifyTotp } from "@/lib/crypto";

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = "0".repeat(64);
});

describe("field encryption (AES-256-GCM)", () => {
  it("round-trips a QID number", () => {
    const plain = "28935612345";
    const enc = encryptField(plain);
    expect(enc).not.toContain(plain);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptField(enc)).toBe(plain);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    expect(encryptField("same")).not.toBe(encryptField("same"));
  });

  it("fails to decrypt tampered ciphertext", () => {
    const enc = encryptField("secret");
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(() => decryptField(tampered)).toThrow();
  });
});

describe("masking", () => {
  it("shows only the last 3 characters", () => {
    expect(last3("28935612345")).toBe("345");
    const masked = maskId("345");
    expect(masked.endsWith("345")).toBe(true);
    expect(masked).toMatch(/^•+345$/);
  });

  it("handles empty input", () => {
    expect(maskId(null)).toBe("—");
  });
});

describe("TOTP", () => {
  it("generates a base32 secret and verifies its own codes", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    const code = totpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const secret = generateTotpSecret();
    const wrong = totpCode(secret) === "000000" ? "111111" : "000000";
    expect(verifyTotp(secret, wrong)).toBe(false);
  });

  it("accepts a code from the previous time-step (±1 skew)", () => {
    const secret = generateTotpSecret();
    const prev = totpCode(secret, Date.now() - 30_000);
    expect(verifyTotp(secret, prev)).toBe(true);
  });
});
