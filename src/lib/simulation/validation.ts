import { z } from "zod";

/**
 * Pragmatic request validation for the simulation API routes.
 *
 * The engine state mirrors raw @aave/math-utils structures, so we validate
 * the security/DoS-relevant surface (durations, array sizes, finite numbers)
 * and stay loose on protocol-specific fields.
 */

const loose = z.looseObject({});

// --- Aave temporal simulation (/api/simulate) ---

const scheduledActionSchema = z.looseObject({
  day: z.number().int().min(0).max(365),
  orderInDay: z.number().int().min(0),
  type: z.enum([
    "supply",
    "borrow",
    "repay",
    "withdraw",
    "set_emode",
    "set_wallet_balance",
  ]),
  symbol: z.string().max(64),
  amount: z.number().finite(),
});

export const temporalConfigSchema = z.looseObject({
  durationDays: z.number().int().min(0).max(365),
  priceScenarios: z.array(loose).max(100),
  rateScenarios: z.array(loose).max(100),
  scheduledActions: z.array(scheduledActionSchema).max(500),
});

export const engineStateSchema = z.looseObject({
  rawUserReserves: z.array(loose).max(200),
  formattedPoolReserves: z.array(loose).max(500),
  baseCurrencyData: loose,
  userEmodeCategoryId: z.number().int(),
  marketReferenceCurrencyPriceInUSD: z.number().finite(),
  healthFactorData: loose,
});

export const simulateRequestSchema = z.looseObject({
  config: temporalConfigSchema,
  initialState: engineStateSchema,
  scenarioConfigs: z
    .array(
      z.looseObject({
        id: z.string().max(128),
        priceScenarios: z.array(loose).max(100),
        rateScenarios: z.array(loose).max(100),
      })
    )
    .max(10)
    .optional(),
});

// --- Token sandbox simulation (/api/tokens/simulate) ---

const tokenHoldingSchema = z.looseObject({
  coingeckoId: z.string().max(128),
  symbol: z.string().max(64),
  name: z.string().max(128),
  quantity: z.number().finite(),
  currentPriceUSD: z.number().finite().min(0),
});

const tokenActionSchema = z.looseObject({
  id: z.string().max(128),
  day: z.number().int().min(0).max(365),
  orderInDay: z.number().int().min(0),
  type: z.enum(["swap", "send", "receive", "supply", "claim", "borrow", "repay"]),
  symbol: z.string().max(64),
  amount: z.number().finite(),
});

export const tokenConfigSchema = z.looseObject({
  durationDays: z.number().int().min(1).max(365),
  holdings: z.array(tokenHoldingSchema).min(1).max(100),
  priceScenarios: z.array(loose).max(100),
  rateScenarios: z.array(loose).max(100).optional(),
  actions: z.array(tokenActionSchema).max(500).optional(),
  scenarioSets: z
    .array(
      z.looseObject({
        id: z.string().max(128),
        priceScenarios: z.array(loose).max(100),
        rateScenarios: z.array(loose).max(100),
      })
    )
    .max(10)
    .optional(),
});
