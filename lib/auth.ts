/**
 * OTP authentication (MVP).
 *
 * Mirrors the production contract: POST /auth/otp/request issues a short-lived
 * code (sent by SMS in production; returned in the response only in demo mode),
 * POST /auth/otp/verify exchanges it for a session token. Production replaces
 * the token store with JWT + rotating refresh tokens and per-number rate
 * limiting at the WAF; the request/verify semantics are identical.
 */

export type Role = "customer" | "provider" | "ops" | "admin";

export interface OtpChallenge {
  phone: string;
  code: string;
  expiresAt: number; // epoch ms
  attempts: number;
}

export interface Session {
  token: string;
  phone: string;
  role: Role;
  createdAt: string;
  expiresAt: number; // epoch ms
}

const OTP_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

/** Fixed demo OTP for store reviewers / staging (see docs/STORE-SUBMISSION.md). */
export const DEMO_OTP = "0000";

declare global {
  // eslint-disable-next-line no-var
  var __nestOtp: Map<string, OtpChallenge> | undefined;
  // eslint-disable-next-line no-var
  var __nestSessions: Map<string, Session> | undefined;
}

function challenges(): Map<string, OtpChallenge> {
  if (!globalThis.__nestOtp) globalThis.__nestOtp = new Map();
  return globalThis.__nestOtp;
}

function sessions(): Map<string, Session> {
  if (!globalThis.__nestSessions) globalThis.__nestSessions = new Map();
  return globalThis.__nestSessions;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!/^\+?\d{8,15}$/.test(digits)) throw new Error("Invalid phone number");
  return digits.startsWith("+") ? digits : `+974${digits}`; // default to Qatar
}

export function requestOtp(phone: string, now = Date.now()): { phone: string; demoCode: string; resendAfterMs: number } {
  const normalized = normalizePhone(phone);
  const existing = challenges().get(normalized);
  if (existing && now - (existing.expiresAt - OTP_TTL_MS) < RESEND_COOLDOWN_MS) {
    throw new Error("Please wait before requesting another code");
  }
  const code = DEMO_OTP; // production: crypto-random 4 digits, delivered by SMS only
  challenges().set(normalized, { phone: normalized, code, expiresAt: now + OTP_TTL_MS, attempts: 0 });
  return { phone: normalized, demoCode: code, resendAfterMs: RESEND_COOLDOWN_MS };
}

export function verifyOtp(phone: string, code: string, role: Role = "customer", now = Date.now()): Session {
  const normalized = normalizePhone(phone);
  const challenge = challenges().get(normalized);
  if (!challenge) throw new Error("No code requested for this number");
  if (now > challenge.expiresAt) {
    challenges().delete(normalized);
    throw new Error("Code expired — request a new one");
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    challenges().delete(normalized);
    throw new Error("Too many attempts — request a new code");
  }
  if (challenge.code !== code) {
    challenge.attempts += 1;
    throw new Error("Incorrect code");
  }

  challenges().delete(normalized);
  const token = `nest_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const session: Session = {
    token,
    phone: normalized,
    role,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions().set(token, session);
  return session;
}

export function getSession(token: string, now = Date.now()): Session | undefined {
  const s = sessions().get(token);
  if (!s) return undefined;
  if (now > s.expiresAt) {
    sessions().delete(token);
    return undefined;
  }
  return s;
}
