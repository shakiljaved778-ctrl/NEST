import type { RulePack, SeverityThresholds, Variant } from "@amil/rules-engine";
import type { z } from "zod";
import accountCloseConventionalJson from "../packs/account.close.conventional.json" with { type: "json" };
import accountCloseIslamicJson from "../packs/account.close.islamic.json" with { type: "json" };
import accountDormancyConventionalJson from "../packs/account.dormancy.conventional.json" with { type: "json" };
import accountDormancyIslamicJson from "../packs/account.dormancy.islamic.json" with { type: "json" };
import balanceTransferConventionalJson from "../packs/card.balance_transfer.conventional.json" with { type: "json" };
import balanceTransferIslamicJson from "../packs/card.balance_transfer.islamic.json" with { type: "json" };
import cashWithdrawalConventionalJson from "../packs/card.cash_withdrawal.conventional.json" with { type: "json" };
import cashWithdrawalIslamicJson from "../packs/card.cash_withdrawal.islamic.json" with { type: "json" };
import cardCloseConventionalJson from "../packs/card.close.conventional.json" with { type: "json" };
import cardCloseIslamicJson from "../packs/card.close.islamic.json" with { type: "json" };
import eppConventionalJson from "../packs/card.epp_conversion.conventional.json" with { type: "json" };
import eppIslamicJson from "../packs/card.epp_conversion.islamic.json" with { type: "json" };
import minimumPaymentConventionalJson from "../packs/card.minimum_payment.conventional.json" with { type: "json" };
import minimumPaymentIslamicJson from "../packs/card.minimum_payment.islamic.json" with { type: "json" };
import depositBreakConventionalJson from "../packs/deposit.break.conventional.json" with { type: "json" };
import depositBreakIslamicJson from "../packs/deposit.break.islamic.json" with { type: "json" };
import financeSettlementConventionalJson from "../packs/finance.early_settlement.conventional.json" with { type: "json" };
import financeSettlementIslamicJson from "../packs/finance.early_settlement.islamic.json" with { type: "json" };
import topUpConventionalJson from "../packs/finance.top_up.conventional.json" with { type: "json" };
import topUpIslamicJson from "../packs/finance.top_up.islamic.json" with { type: "json" };
import rewardsExpiryConventionalJson from "../packs/rewards.expiry.conventional.json" with { type: "json" };
import rewardsExpiryIslamicJson from "../packs/rewards.expiry.islamic.json" with { type: "json" };
import salaryChangeConventionalJson from "../packs/salary.transfer_change.conventional.json" with { type: "json" };
import salaryChangeIslamicJson from "../packs/salary.transfer_change.islamic.json" with { type: "json" };
import { AccountCloseParamsSchema, evaluateAccountClose } from "./account-close/pack";
import { AccountDormancyParamsSchema, evaluateAccountDormancy } from "./account-dormancy/pack";
import { BalanceTransferParamsSchema, evaluateBalanceTransfer } from "./balance-transfer/pack";
import { evaluateCardClose } from "./card-close/calculate";
import {
  type CardCloseFactKey,
  type CardCloseInput,
  type CardCloseParams,
  CardCloseParamsSchema,
} from "./card-close/types";
import { CashWithdrawalParamsSchema, evaluateCashWithdrawal } from "./cash-withdrawal/pack";
import { loadPackDefinition, type PackDefinition } from "./define";
import { DepositBreakParamsSchema, evaluateDepositBreak } from "./deposit-break/pack";
import { EppConversionParamsSchema, evaluateEppConversion } from "./epp-conversion/pack";
import { evaluateFinanceEarlySettlement } from "./finance-early-settlement/calculate";
import {
  type FinanceSettlementFactKey,
  type FinanceSettlementInput,
  type FinanceSettlementParams,
  FinanceSettlementParamsSchema,
} from "./finance-early-settlement/types";
import { evaluateMinimumPayment, MinimumPaymentParamsSchema } from "./minimum-payment/pack";
import { evaluateRewardsExpiry, RewardsExpiryParamsSchema } from "./rewards-expiry/pack";
import { evaluateSalaryChange, SalaryChangeParamsSchema } from "./salary-change/pack";
import { evaluateTopUp, TopUpParamsSchema } from "./top-up/pack";

export type LoadedPack<I, P, K extends string> = RulePack<I, P, K> & {
  definition: PackDefinition<P>;
  /** Validates bank-stored parameter overrides before they are ever computed with. */
  parametersSchema: z.ZodType<P>;
};

function makePack<I, P, K extends string>(
  raw: unknown,
  schema: z.ZodType<P>,
  evaluate: RulePack<I, P, K>["evaluate"],
): LoadedPack<I, P, K> {
  const definition = loadPackDefinition(raw, schema);
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
    parametersSchema: schema,
  };
}

type Evaluate<I, P, K extends string> = RulePack<I, P, K>["evaluate"];
type Ev<F extends (...a: never[]) => unknown> = ReturnType<F>;
type KeysOf<F extends (...a: never[]) => unknown> =
  Ev<F> extends { facts: infer S } ? Exclude<keyof S, "_sources"> & string : never;

/** Both variants of a pack, which share a calculator but carry their own definition file. */
function both<I, P, K extends string>(
  conventional: unknown,
  islamic: unknown,
  schema: z.ZodType<P>,
  evaluate: Evaluate<I, P, K>,
) {
  return {
    conventional: makePack<I, P, K>(conventional, schema, evaluate),
    islamic: makePack<I, P, K>(islamic, schema, evaluate),
  } as const;
}

/** Adapt calculators that need fewer arguments to the uniform (input, params, thresholds, now). */
const withoutNow =
  <I, P, R>(f: (i: I, p: P, t: SeverityThresholds) => R) =>
  (i: I, p: P, t: SeverityThresholds): R =>
    f(i, p, t);

export const cardClosePacks = both<CardCloseInput, CardCloseParams, CardCloseFactKey>(
  cardCloseConventionalJson,
  cardCloseIslamicJson,
  CardCloseParamsSchema,
  evaluateCardClose,
);

export const financeEarlySettlementPacks = both<
  FinanceSettlementInput,
  FinanceSettlementParams,
  FinanceSettlementFactKey
>(
  financeSettlementConventionalJson,
  financeSettlementIslamicJson,
  FinanceSettlementParamsSchema,
  evaluateFinanceEarlySettlement,
);

export const PACKS = {
  "card.close": cardClosePacks,
  "finance.early_settlement": financeEarlySettlementPacks,
  "finance.top_up": both(topUpConventionalJson, topUpIslamicJson, TopUpParamsSchema, evaluateTopUp),
  "card.cash_withdrawal": both(
    cashWithdrawalConventionalJson,
    cashWithdrawalIslamicJson,
    CashWithdrawalParamsSchema,
    withoutNow(evaluateCashWithdrawal),
  ),
  "card.minimum_payment": both(
    minimumPaymentConventionalJson,
    minimumPaymentIslamicJson,
    MinimumPaymentParamsSchema,
    withoutNow(evaluateMinimumPayment),
  ),
  "card.epp_conversion": both(
    eppConventionalJson,
    eppIslamicJson,
    EppConversionParamsSchema,
    withoutNow(evaluateEppConversion),
  ),
  "card.balance_transfer": both(
    balanceTransferConventionalJson,
    balanceTransferIslamicJson,
    BalanceTransferParamsSchema,
    withoutNow(evaluateBalanceTransfer),
  ),
  "deposit.break": both(
    depositBreakConventionalJson,
    depositBreakIslamicJson,
    DepositBreakParamsSchema,
    evaluateDepositBreak,
  ),
  "salary.transfer_change": both(
    salaryChangeConventionalJson,
    salaryChangeIslamicJson,
    SalaryChangeParamsSchema,
    withoutNow(evaluateSalaryChange),
  ),
  "account.close": both(
    accountCloseConventionalJson,
    accountCloseIslamicJson,
    AccountCloseParamsSchema,
    evaluateAccountClose,
  ),
  "account.dormancy": both(
    accountDormancyConventionalJson,
    accountDormancyIslamicJson,
    AccountDormancyParamsSchema,
    // Time-based, not amount-based: thresholds do not apply.
    (
      i: Parameters<typeof evaluateAccountDormancy>[0],
      p: Parameters<typeof evaluateAccountDormancy>[1],
      _t: SeverityThresholds,
      now: Date,
    ) => evaluateAccountDormancy(i, p, now),
  ),
  "rewards.expiry": both(
    rewardsExpiryConventionalJson,
    rewardsExpiryIslamicJson,
    RewardsExpiryParamsSchema,
    evaluateRewardsExpiry,
  ),
} as const;

export type PackKey = keyof typeof PACKS;
export type PackInput<K extends PackKey> = Parameters<
  (typeof PACKS)[K]["conventional"]["evaluate"]
>[0];
export type PackFactKey<K extends PackKey> = KeysOf<(typeof PACKS)[K]["conventional"]["evaluate"]>;

/** A pack handled without knowing its input type (the API, the proactive runner). */
export type AnyLoadedPack = LoadedPack<never, unknown, string>;

export function getPack(key: PackKey, variant: Variant): AnyLoadedPack {
  return PACKS[key][variant] as unknown as AnyLoadedPack;
}

export function isPackKey(key: string): key is PackKey {
  return Object.hasOwn(PACKS, key);
}

/** Every implemented pack definition (both variants). Used by the seed and the console. */
export const ALL_PACK_DEFINITIONS: PackDefinition<unknown>[] = Object.values(PACKS).flatMap(
  (p) => [p.conventional.definition, p.islamic.definition] as PackDefinition<unknown>[],
);

export function variantForFinanceType(type: FinanceSettlementInput["finance"]["type"]): Variant {
  return type === "conventional" ? "conventional" : "islamic";
}
