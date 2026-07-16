import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// S3-compatible storage abstraction. Driver selected via STORAGE_DRIVER env:
//  - "local": files under STORAGE_LOCAL_PATH (dev default)
//  - "s3":    any S3-compatible endpoint via @aws-sdk/client-s3

export interface StorageDriver {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalDriver implements StorageDriver {
  private root = path.resolve(process.env.STORAGE_LOCAL_PATH ?? "./storage");

  private resolve(key: string): string {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return p;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.resolve(key)).catch(() => {});
  }
}

class S3Driver implements StorageDriver {
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;
  private bucket = process.env.S3_BUCKET ?? "";

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then(
        ({ S3Client }) =>
          new S3Client({
            region: process.env.S3_REGION ?? "me-south-1",
            endpoint: process.env.S3_ENDPOINT || undefined,
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
            },
          })
      );
    }
    return this.clientPromise;
  }

  async put(key: string, data: Buffer, mime: string): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await this.client();
    await c.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: mime }));
  }

  async get(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await this.client();
    const res = await c.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty S3 object");
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await this.client();
    await c.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (!driver) {
    driver = process.env.STORAGE_DRIVER === "s3" ? new S3Driver() : new LocalDriver();
  }
  return driver;
}

export function newStorageKey(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const now = new Date();
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}-${safe}`;
}
