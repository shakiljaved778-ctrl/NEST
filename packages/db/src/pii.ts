/**
 * Application-level encryption of PII columns at rest (AES-256-GCM, D-066).
 *
 * The PII columns are Customer.displayName/displayNameAr/phone/email, Account.number/iban and
 * Card.pan. Each value is stored as
 *   enc:v1:<keyId>:<iv>:<ciphertext>:<tag>      (base64url parts, 96-bit random IV)
 * with additional authenticated data "<table>.<column>:<rowId>", so a ciphertext copied to
 * another row or column does not decrypt. Keys come from a `PiiKeyProvider`: from the environment
 * for the demo, or data keys unwrapped once by the bank's KMS (envelope encryption). The keyId
 * in each value lets old keys keep decrypting while new writes use the current key (rotation).
 *
 * AMIL's own services never read these columns: only the bank's side (the demo bank and the
 * seed) needs the key.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface PiiKeyProvider {
  /** Key id used for new encryptions. */
  readonly currentKeyId: string;
  /** The 32-byte key for an id; throws for an unknown id. */
  key(keyId: string): Buffer;
}

const PREFIX = "enc:v1:";
const KEY_ID = /^[A-Za-z0-9_-]{1,32}$/;

export class PiiDecryptionError extends Error {
  constructor(reason: string) {
    super(`PII decryption failed: ${reason}`);
  }
}

/** A provider over an in-memory map of keys; the first entry is the current key. */
export function staticKeyProvider(keys: [keyId: string, key: Buffer][]): PiiKeyProvider {
  if (!keys.length) throw new Error("at least one PII key is required");
  const map = new Map<string, Buffer>();
  for (const [id, key] of keys) {
    if (!KEY_ID.test(id)) throw new Error(`invalid PII key id: ${id}`);
    if (key.length !== 32) throw new Error(`PII key ${id} must be 32 bytes (AES-256)`);
    map.set(id, key);
  }
  const [currentKeyId] = keys[0] as [string, Buffer];
  return {
    currentKeyId,
    key(keyId) {
      const k = map.get(keyId);
      if (!k) throw new PiiDecryptionError(`unknown key id ${keyId}`);
      return k;
    },
  };
}

/**
 * Keys from `PII_ENCRYPTION_KEYS="k2:<base64 32 bytes>,k1:<base64 32 bytes>"`. The first is used
 * for new values; the others still decrypt (rotation).
 */
export function keyProviderFromEnv(env: NodeJS.ProcessEnv = process.env): PiiKeyProvider {
  const raw = env.PII_ENCRYPTION_KEYS;
  if (!raw) throw new Error("PII_ENCRYPTION_KEYS is not set (see .env.example)");
  return staticKeyProvider(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const [id = "", b64 = ""] = entry.split(":");
        return [id, Buffer.from(b64, "base64")];
      }),
  );
}

/**
 * KMS interface (envelope encryption): data keys are stored wrapped by a key held in the bank's
 * KMS or HSM and unwrapped once at startup through `unwrap`. Plain keys never sit in config.
 */
export async function kmsKeyProvider(
  wrapped: { keyId: string; wrappedKey: Buffer }[],
  unwrap: (wrappedKey: Buffer) => Promise<Buffer>,
): Promise<PiiKeyProvider> {
  const keys: [string, Buffer][] = [];
  for (const w of wrapped) keys.push([w.keyId, await unwrap(w.wrappedKey)]);
  return staticKeyProvider(keys);
}

export type PiiTable = "customer" | "account" | "card";
const aad = (table: PiiTable, column: string, rowId: string) =>
  Buffer.from(`${table}.${column}:${rowId}`, "utf8");

export function encryptPii(
  provider: PiiKeyProvider,
  table: PiiTable,
  column: string,
  rowId: string,
  plaintext: string,
): string {
  const keyId = provider.currentKeyId;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", provider.key(keyId), iv);
  cipher.setAAD(aad(table, column, rowId));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${keyId}:${iv.toString("base64url")}:${ct.toString("base64url")}:${tag.toString("base64url")}`;
}

export function isEncryptedPii(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function decryptPii(
  provider: PiiKeyProvider,
  table: PiiTable,
  column: string,
  rowId: string,
  value: string,
): string {
  if (!isEncryptedPii(value)) throw new PiiDecryptionError("value is not encrypted");
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 4) throw new PiiDecryptionError("malformed value");
  const [keyId, iv, ct, tag] = parts as [string, string, string, string];
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      provider.key(keyId),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAAD(aad(table, column, rowId));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ct, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (e) {
    if (e instanceof PiiDecryptionError) throw e;
    throw new PiiDecryptionError("authentication failed");
  }
}

/** The encrypted columns per table. */
export const PII_COLUMNS = {
  customer: ["displayName", "displayNameAr", "phone", "email"],
  account: ["number", "iban"],
  card: ["pan"],
} as const satisfies Record<PiiTable, readonly string[]>;

type Row = { id: string } & Record<string, unknown>;

function mapPii<T extends Row>(
  table: PiiTable,
  row: T,
  f: (column: string, value: string) => string,
): T {
  const out: Record<string, unknown> = { ...row };
  for (const column of PII_COLUMNS[table]) {
    const v = out[column];
    if (typeof v === "string") out[column] = f(column, v);
  }
  return out as T;
}

/** Encrypt a row's PII columns before it is written (nulls and absent columns stay as they are). */
export const encryptRow = <T extends Row>(provider: PiiKeyProvider, table: PiiTable, row: T): T =>
  mapPii(table, row, (c, v) => encryptPii(provider, table, c, row.id, v));

/** Decrypt a row's PII columns after it is read. */
export const decryptRow = <T extends Row>(provider: PiiKeyProvider, table: PiiTable, row: T): T =>
  mapPii(table, row, (c, v) => decryptPii(provider, table, c, row.id, v));
