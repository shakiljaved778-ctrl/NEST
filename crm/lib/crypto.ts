import crypto from "crypto";

// AES-256-GCM field-level encryption for sensitive identifiers (QID/passport).
// Ciphertext format: v1:<iv b64>:<authTag b64>:<data b64>

function getKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("FIELD_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptField(ciphertext: string): string {
  const [version, ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (version !== "v1") throw new Error("Unknown ciphertext version");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** Masked display: show only the last 3 characters, e.g. "•••••••••456" */
export function maskId(last3: string | null | undefined, totalLength = 11): string {
  if (!last3) return "—";
  return "•".repeat(Math.max(totalLength - last3.length, 4)) + last3;
}

export function last3(value: string): string {
  return value.slice(-3);
}

// ── TOTP (RFC 6238, SHA-1, 30s step, 6 digits) — dependency-free ────────────

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const idx = B32_ALPHABET.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpCode(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/** Verify with ±1 time-step tolerance. */
export function verifyTotp(secret: string, code: string, timestamp = Date.now()): boolean {
  const normalized = code.replace(/\s/g, "");
  for (const skew of [-1, 0, 1]) {
    if (totpCode(secret, timestamp + skew * 30_000) === normalized) return true;
  }
  return false;
}

export function totpUri(secret: string, email: string): string {
  return `otpauth://totp/${encodeURIComponent("Fintech CRM")}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent("Fintech CRM")}`;
}
