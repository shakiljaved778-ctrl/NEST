import type { RulePack, Variant } from "@amil/rules-engine";
import cardCloseConventionalJson from "../packs/card.close.conventional.json" with { type: "json" };
import cardCloseIslamicJson from "../packs/card.close.islamic.json" with { type: "json" };
import financeSettlementConventionalJson from "../packs/finance.early_settlement.conventional.json" with { type: "json" };
import financeSettlementIslamicJson from "../packs/finance.early_settlement.islamic.json" with { type: "json" };
import { evaluateCardClose } from "./card-close/calculate";
import {
  type CardCloseFactKey,
  type CardCloseInput,
  type CardCloseParams,
  CardCloseParamsSchema,
} from "./card-close/types";
import { loadPackDefinition, type PackDefinition } from "./define";
import { evaluateFinanceEarlySettlement } from "./finance-early-settlement/calculate";
import {
  type FinanceSettlementFactKey,
  type FinanceSettlementInput,
  type FinanceSettlementParams,
  FinanceSettlementParamsSchema,
} from "./finance-early-settlement/types";

export type LoadedPack<I, P, K extends string> = RulePack<I, P, K> & {
  definition: PackDefinition<P>;
};

function makePack<I, P, K extends string>(
  definition: PackDefinition<P>,
  evaluate: RulePack<I, P, K>["evaluate"],
): LoadedPack<I, P, K> {
  return {
    key: definition.key,
    version: definition.version,
    variant: definition.variant,
    productFamily: definition.productFamily,
    triggers: definition.triggers,
    requiredData: definition.requiredData,
    defaultParameters: definition.parameters,
    evaluate,
    definition,
  };
}

export const cardClosePacks = {
  conventional: makePack<CardCloseInput, CardCloseParams, CardCloseFactKey>(
    loadPackDefinition(cardCloseConventionalJson, CardCloseParamsSchema),
    evaluateCardClose,
  ),
  islamic: makePack<CardCloseInput, CardCloseParams, CardCloseFactKey>(
    loadPackDefinition(cardCloseIslamicJson, CardCloseParamsSchema),
    evaluateCardClose,
  ),
} as const;

export const financeEarlySettlementPacks = {
  conventional: makePack<FinanceSettlementInput, FinanceSettlementParams, FinanceSettlementFactKey>(
    loadPackDefinition(financeSettlementConventionalJson, FinanceSettlementParamsSchema),
    evaluateFinanceEarlySettlement,
  ),
  islamic: makePack<FinanceSettlementInput, FinanceSettlementParams, FinanceSettlementFactKey>(
    loadPackDefinition(financeSettlementIslamicJson, FinanceSettlementParamsSchema),
    evaluateFinanceEarlySettlement,
  ),
} as const;

/** Every implemented pack definition (both variants). Used by the seed and the console. */
export const ALL_PACK_DEFINITIONS: PackDefinition<unknown>[] = [
  cardClosePacks.conventional.definition,
  cardClosePacks.islamic.definition,
  financeEarlySettlementPacks.conventional.definition,
  financeEarlySettlementPacks.islamic.definition,
];

export function variantForFinanceType(type: FinanceSettlementInput["finance"]["type"]): Variant {
  return type === "conventional" ? "conventional" : "islamic";
}
