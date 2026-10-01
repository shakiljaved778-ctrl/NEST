import type { Fact, FactSet, FactSource, FactSourceName, FactUnit } from "./contract";

/**
 * Collects facts for one evaluation. Every fact is recorded with its source and as-of date,
 * and `_sources` lists each distinct (source, asOf) pair, so "Why am I seeing this?" and the
 * audit trail can cite where each figure came from.
 */
export class FactBuilder<K extends string> {
  private readonly facts = new Map<K, Fact>();

  add(key: K, value: string, unit: FactUnit, source: FactSourceName, asOf: string): this {
    if (this.facts.has(key)) throw new Error(`Duplicate fact: ${key}`);
    this.facts.set(key, { key, value, unit, source, asOf });
    return this;
  }

  get(key: K): Fact | undefined {
    return this.facts.get(key);
  }

  build(): FactSet<K> {
    const sources: FactSource[] = [];
    const seen = new Set<string>();
    for (const f of this.facts.values()) {
      const id = `${f.source}@${f.asOf}`;
      if (!seen.has(id)) {
        seen.add(id);
        sources.push({ source: f.source, asOf: f.asOf });
      }
    }
    const out = Object.fromEntries(this.facts) as Record<K, Fact>;
    return Object.assign(out, { _sources: sources });
  }
}
