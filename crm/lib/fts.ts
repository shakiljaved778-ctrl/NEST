/** Build a prefix-matching Postgres tsquery ("fin:* & tech:*") from user input. */
export function toTsQuery(q: string): string {
  return q
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}@.+-]/gu, ""))
    .filter((t) => t.length > 0)
    .slice(0, 6)
    .map((t) => `${t.replace(/[':]/g, "")}:*`)
    .join(" & ");
}
