/**
 * Deterministic PRNG (mulberry32) so the synthetic dataset is identical on every run for the
 * same `now`. Only used to pick synthetic transaction patterns, never for money maths: amounts
 * are built from integer minor units and converted to decimal strings.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) throw new Error("pick from empty list");
    return item;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Money amount string between min and max QAR (whole-dirham precision), e.g. "123.45". */
  amount(minQar: number, maxQar: number): string {
    const minor = this.int(minQar * 100, maxQar * 100);
    return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
  }
}

/** Stable 32-bit hash of a string (FNV-1a), used to derive per-customer seeds. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
