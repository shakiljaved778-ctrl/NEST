/** Wording cache (section 8): identical fact template + locale + template version -> cached wording, 24 h. */
export interface WordingCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export const WORDING_TTL_SECONDS = 24 * 60 * 60;

/** In-process cache for tests and single-instance dev. */
export class MemoryWordingCache implements WordingCache {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();
  constructor(private readonly now: () => number = Date.now) {}

  get(key: string): Promise<string | null> {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= this.now()) return Promise.resolve(null);
    return Promise.resolve(hit.value);
  }

  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }
}

/** Minimal Redis surface (ioredis-compatible). */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
}

export class RedisWordingCache implements WordingCache {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = "amil:wording:",
  ) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(this.prefix + key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.prefix + key, value, "EX", ttlSeconds);
  }
}
