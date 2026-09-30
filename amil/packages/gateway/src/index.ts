/** Model gateway modes (non-negotiable 6). Default is `redacted`. Implemented in Phase 3. */
export const MODEL_MODES = ["redacted", "in_country", "off"] as const;
export type ModelMode = (typeof MODEL_MODES)[number];
export const DEFAULT_MODEL_MODE: ModelMode = "redacted";
