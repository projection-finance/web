import { z } from "zod";

// --- Simulation type schemas (match src/lib/simulation/types.ts) ---

export const PriceScenarioSchema = z.object({
  symbol: z.string().max(10),
  mode: z.enum(["fixed", "linear", "sinusoidal", "gbm", "manual"]),
  startPrice: z.number().positive(),
  endPrice: z.number().positive().optional(),
  mu: z.number().optional(),
  sigma: z.number().optional(),
  seed: z.number().optional(),
  manualPrices: z.array(z.number().positive()).optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  cycleDays: z.number().positive().optional(),
  fromDay: z.number().min(0).optional(),
  originalPrice: z.number().positive().optional(),
});

export const RateScenarioSchema = z.object({
  symbol: z.string().max(10),
  rateType: z.enum(["supply", "borrow", "supplyIncentive", "borrowIncentive"]),
  mode: z.enum(["fixed", "linear", "sinusoidal", "manual"]),
  startRate: z.number().min(0),
  endRate: z.number().min(0).optional(),
  manualRates: z.array(z.number().min(0)).optional(),
  minRate: z.number().min(0).optional(),
  maxRate: z.number().min(0).optional(),
  cycleDays: z.number().positive().optional(),
  fromDay: z.number().min(0).optional(),
  originalRate: z.number().min(0).optional(),
});

export const ScheduledActionSchema = z.object({
  day: z.number().min(0),
  orderInDay: z.number().min(0),
  type: z.enum(["supply", "borrow", "repay", "withdraw", "set_emode"]),
  symbol: z.string().max(10),
  amount: z.number().min(0),
  useAsCollateral: z.boolean().optional(),
  repayFromCollateral: z.boolean().optional(),
  emodeCategoryId: z.number().optional(),
});

// --- Yield Optimizer Response Schema ---

const YieldOpportunitySchema = z.object({
  title: z.string().max(60),
  description: z.string().max(120),
  estimatedAPYImprovement: z.number(),
  riskLevel: z.enum(["low", "medium", "high"]),
  actions: z.array(ScheduledActionSchema),
});

export const YieldOptimizerResponseSchema = z.object({
  opportunities: z.array(YieldOpportunitySchema).min(1).max(5),
  currentNetAPY: z.number(),
  projectedNetAPY: z.number(),
  analysis: z.string().max(200),
});

// --- Strategy Advisor Response Schema ---

const StrategyProfileSchema = z.object({
  name: z.string().max(40),
  riskLevel: z.enum(["conservative", "balanced", "aggressive"]),
  description: z.string().max(120),
  targetHealthFactor: z.number().positive(),
  priceScenarios: z.array(PriceScenarioSchema),
  rateScenarios: z.array(RateScenarioSchema),
  actions: z.array(ScheduledActionSchema),
  projectedAPY: z.number(),
});

export const StrategyAdvisorResponseSchema = z.object({
  strategies: z.array(StrategyProfileSchema).min(1).max(3),
  scenarioAnalysis: z.string().max(200),
  recommendation: z.string().max(150),
});

// --- AI Insights Response Schema ---

export const AIInsightsResponseSchema = z.object({
  answer: z.string().max(250),
  priceScenarios: z.array(PriceScenarioSchema).optional(),
  rateScenarios: z.array(RateScenarioSchema).optional(),
  actions: z.array(ScheduledActionSchema).optional(),
  reasoning: z.string().max(150).optional(),
});
