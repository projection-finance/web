import type { PriceScenario, RateMode } from "./types";

// ── Rate scenario (keyed by market uniqueKey) ──

export interface MorphoBlueRateScenario {
  uniqueKey: string;
  rateType: "supply" | "borrow";
  mode: RateMode;
  startRate: number;
  endRate?: number;
  manualRates?: number[];
  minRate?: number;
  maxRate?: number;
  cycleDays?: number;
  fromDay?: number;
  originalRate?: number;
}

// ── Scheduled actions ──

export type MorphoBlueActionType =
  | "supply"
  | "withdraw"
  | "borrow"
  | "repay"
  | "supplyCollateral"
  | "withdrawCollateral";

export interface MorphoBlueScheduledAction {
  day: number;
  orderInDay: number;
  type: MorphoBlueActionType;
  uniqueKey: string;
  symbol: string;
  amount: number;
}

// ── Scenario sets ──

export interface MorphoBlueScenarioSet {
  id: string;
  name: string;
  color: string;
  priceScenarios: PriceScenario[];
  rateScenarios: MorphoBlueRateScenario[];
}

// ── Config ──

export interface MorphoBlueSimulationConfig {
  durationDays: number;
  priceScenarios: PriceScenario[];
  rateScenarios: MorphoBlueRateScenario[];
  scheduledActions: MorphoBlueScheduledAction[];
  scenarioSets?: MorphoBlueScenarioSet[];
  activeScenarioSetId?: string;
}

// ── Engine state ──

export interface MorphoBlueMarketEngineEntry {
  uniqueKey: string;
  loanSymbol: string;
  collateralSymbol: string;
  lltv: number;
  loanPriceUSD: number;
  collateralPriceUSD: number;
  supplyBalance: number;       // loan token units
  borrowBalance: number;       // loan token units
  collateralBalance: number;   // collateral token units
  supplyAPY: number;
  borrowAPY: number;
  cumulativeInterestEarned: number;
  cumulativeInterestPaid: number;
}

export interface MorphoBlueEngineState {
  markets: MorphoBlueMarketEngineEntry[];
}

// ── Day snapshot ──

export interface MorphoBlueMarketSnapshot {
  uniqueKey: string;
  loanSymbol: string;
  collateralSymbol: string;
  lltv: number;
  loanPriceUSD: number;
  collateralPriceUSD: number;
  supplyBalance: number;
  supplyBalanceUSD: number;
  borrowBalance: number;
  borrowBalanceUSD: number;
  collateralBalance: number;
  collateralBalanceUSD: number;
  supplyAPY: number;
  borrowAPY: number;
  healthFactor: number;
  interestEarned: number;
  interestPaid: number;
}

export interface MorphoBlueDayActionResult {
  type: string;
  uniqueKey: string;
  symbol: string;
  amount: number;
  status: "success" | "skipped";
  reason?: string;
}

export interface MorphoBlueDaySnapshot {
  day: number;
  markets: MorphoBlueMarketSnapshot[];
  totalSupplyUSD: number;
  totalBorrowUSD: number;
  totalCollateralUSD: number;
  netWorthUSD: number;
  lowestHealthFactor: number;
  actionsExecuted: MorphoBlueDayActionResult[];
  warnings: string[];
}

// ── Results ──

export interface MorphoBlueSimulationSummary {
  startNetWorth: number;
  endNetWorth: number;
  totalInterestEarned: number;
  totalInterestPaid: number;
  lowestHealthFactor: number;
  lowestHealthFactorDay: number;
  liquidationOccurred: boolean;
  liquidationDay?: number;
}

export interface MorphoBlueSimulationResult {
  timeline: MorphoBlueDaySnapshot[];
  summary: MorphoBlueSimulationSummary;
}
