import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_OTP, getSession, normalizePhone, requestOtp, verifyOtp } from "../lib/auth";

beforeEach(() => {
  globalThis.__nestOtp = undefined;
  globalThis.__nestSessions = undefined;
});

describe("normalizePhone", () => {
  it("defaults bare numbers to Qatar (+974)", () => {
    expect(normalizePhone("55123456")).toBe("+97455123456");
    expect(normalizePhone("+919812345678")).toBe("+919812345678");
  });

  it("rejects invalid numbers", () => {
    expect(() => normalizePhone("12")).toThrow(/Invalid phone/);
    expect(() => normalizePhone("not-a-phone")).toThrow(/Invalid phone/);
  });
});

describe("OTP flow", () => {
  it("issues a code and exchanges it for a session", () => {
    const { phone, demoCode } = requestOtp("55123456");
    const session = verifyOtp(phone, demoCode);
    expect(session.token).toMatch(/^nest_/);
    expect(session.role).toBe("customer");
    expect(getSession(session.token)?.phone).toBe("+97455123456");
  });

  it("supports provider role sessions", () => {
    const { demoCode } = requestOtp("55123457");
    expect(verifyOtp("55123457", demoCode, "provider").role).toBe("provider");
  });

  it("rejects wrong codes and counts attempts", () => {
    requestOtp("55123458");
    expect(() => verifyOtp("55123458", "9999")).toThrow(/Incorrect/);
    expect(verifyOtp("55123458", DEMO_OTP).token).toBeDefined(); // still works within attempts
  });

  it("locks out after 5 wrong attempts", () => {
    requestOtp("55123459");
    for (let i = 0; i < 5; i++) {
      expect(() => verifyOtp("55123459", "9999")).toThrow(/Incorrect/);
    }
    expect(() => verifyOtp("55123459", DEMO_OTP)).toThrow(/Too many attempts/);
  });

  it("expires codes after the TTL", () => {
    const now = Date.now();
    requestOtp("55123460", now);
    expect(() => verifyOtp("55123460", DEMO_OTP, "customer", now + 6 * 60 * 1000)).toThrow(/expired/);
  });

  it("enforces a resend cooldown", () => {
    const now = Date.now();
    requestOtp("55123461", now);
    expect(() => requestOtp("55123461", now + 1000)).toThrow(/wait/);
  });

  it("consumes the code on success (no replay)", () => {
    const { demoCode } = requestOtp("55123462");
    verifyOtp("55123462", demoCode);
    expect(() => verifyOtp("55123462", demoCode)).toThrow(/No code requested/);
  });

  it("expires sessions", () => {
    const { demoCode } = requestOtp("55123463");
    const now = Date.now();
    const session = verifyOtp("55123463", demoCode, "customer", now);
    expect(getSession(session.token, now + 25 * 60 * 60 * 1000)).toBeUndefined();
  });
});
