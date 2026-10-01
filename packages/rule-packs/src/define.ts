import type {
  DataRequirement,
  FactSourceName,
  FactUnit,
  Trigger,
  Variant,
} from "@amil/rules-engine";
import { z } from "zod";

/** Shape of a versioned pack definition file in packs/*.json. */
export const PackFileSchema = z.object({
  $comment: z.string().optional(),
  key: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver"),
  variant: z.enum(["conventional", "islamic"]),
  productFamily: z.string(),
  triggers: z.array(z.object({ type: z.enum(["action", "schedule"]), event: z.string() })).min(1),
  requiredData: z.array(z.object({ entity: z.string(), fields: z.array(z.string()).min(1) })),
  parameters: z.record(z.string(), z.unknown()),
  facts: z
    .array(
      z.object({
        key: z.string(),
        unit: z.string(),
        source: z.string(),
        description: z.string(),
      }),
    )
    .min(1),
});

export interface PackFact {
  key: string;
  unit: FactUnit;
  source: FactSourceName;
  description: string;
}

export interface PackDefinition<P> {
  key: string;
  version: string;
  variant: Variant;
  productFamily: string;
  triggers: Trigger[];
  requiredData: DataRequirement[];
  parameters: P;
  facts: PackFact[];
}

/** Validate a pack JSON file and its parameters. Throws with a readable message on bad input. */
export function loadPackDefinition<P>(raw: unknown, parameters: z.ZodType<P>): PackDefinition<P> {
  const file = PackFileSchema.parse(raw);
  return {
    key: file.key,
    version: file.version,
    variant: file.variant,
    productFamily: file.productFamily,
    triggers: file.triggers,
    requiredData: file.requiredData,
    parameters: parameters.parse(file.parameters),
    facts: file.facts as PackFact[],
  };
}

export const RoundingModeSchema = z.enum(["half_up", "half_even"]);
