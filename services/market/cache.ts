/**
 * Cache abstraction for market/macro data.
 *
 * Default is a process-local in-memory TTL cache. In production, swap in Redis
 * (Upstash) by implementing {@link CacheStore} — the interface is intentionally
 * tiny (get/set with TTL). Nothing else in the app changes.
 *
 * NOTE: an in-memory cache is per serverless instance; treat it as best-effort.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

interface Entry {
  value: unknown;
  expires: number;
}

export class InMemoryCache implements CacheStore {
  private store = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expires) {
      this.store.delete(key);
      return null;
    }
    return e.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
}

/**
 * Redis-backed cache stub. Wire up `@upstash/redis` (or ioredis) here and set
 * REDIS_URL. Left unimplemented on purpose so the demo has no external deps.
 */
export class RedisCache implements CacheStore {
  // constructor(private client: Redis) {}
  async get<T>(_key: string): Promise<T | null> {
    // TODO: return JSON.parse(await this.client.get(_key))
    throw new Error("RedisCache not configured — set REDIS_URL and implement.");
  }
  async set<T>(_key: string, _value: T, _ttl: number): Promise<void> {
    // TODO: await this.client.set(_key, JSON.stringify(_value), { ex: _ttl })
    throw new Error("RedisCache not configured — set REDIS_URL and implement.");
  }
}

let singleton: CacheStore | null = null;

/** Returns the configured cache (in-memory by default). */
export function getCache(): CacheStore {
  if (singleton) return singleton;
  // if (process.env.REDIS_URL) singleton = new RedisCache(...);
  singleton = new InMemoryCache();
  return singleton;
}

/** Convenience: get-or-compute with TTL. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T> | T,
): Promise<T> {
  const store = getCache();
  const hit = await store.get<T>(key);
  if (hit !== null) return hit;
  const value = await compute();
  await store.set(key, value, ttlSeconds);
  return value;
}
