import type { PriceScenario, RateMode } from "./types";

// ── Rate scenario (keyed by marketId) ──

export interface CompoundRateScenario {
  marketId: string;
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

export type CompoundActionType =
  | "supply"
  | "withdraw"
  | "borrow"
  | "repay"
  | "supplyCollateral"
  | "withdrawCollateral";

export interface CompoundScheduledAction {
  day: number;
  orderInDay: number;
  type: CompoundActionType;
  marketId: string;
  symbol: string;
  amount: number;
}

// ── Scenario sets ──

export interface CompoundScenarioSet {
  id: string;
  name: string;
  color: string;
  priceScenarios: PriceScenario[];
  rateScenarios: CompoundRateScenario[];
}

// ── Simulation config ──

export interface CompoundSimulationConfig {
  durationDays: number;
  priceScenarios: PriceScenario[];
  rateScenarios: CompoundRateScenario[];
  scheduledActions: CompoundScheduledAction[];
  scenarioSets?: CompoundScenarioSet[];
  activeScenarioSetId?: string;
}

// ── Engine state ──

export interface CompoundCollateralEngineEntry {
  symbol: string;
  address: string;
  balance: number;
  priceUSD: number;
  borrowCollateralFactor: number;
  liquidateCollateralFactor: number;
}

export interface CompoundMarketEngineEntry {
  marketId: string;
  baseSymbol: string;
  baseDecimals: number;
  basePriceUSD: number;
  baseSupplyBalance: number;
  baseBorrowBalance: number;
  supplyAPY: number;
  borrowAPY: number;
  collaterals: CompoundCollateralEngineEntry[];
  cumulativeInterestEarned: number;
  cumulativeInterestPaid: number;
}

export interface CompoundEngineState {
  markets: CompoundMarketEngineEntry[];
}

// ── Day snapshot ──

export interface CompoundCollateralSnapshot {
  symbol: string;
  balance: number;
  balanceUSD: number;
  priceUSD: number;
}

export interface CompoundMarketSnapshot {
  marketId: string;
  baseSymbol: string;
  basePriceUSD: number;
  baseSupplyBalance: number;
  baseSupplyBalanceUSD: number;
  baseBorrowBalance: number;
  baseBorrowBalanceUSD: number;
  supplyAPY: number;
  borrowAPY: number;
  healthFactor: number;
  borrowCapacityUSD: number;
  collaterals: CompoundCollateralSnapshot[];
  interestEarned: number;
  interestPaid: number;
}

export interface CompoundDayActionResult {
  type: string;
  marketId: string;
  symbol: string;
  amount: number;
  status: "success" | "skipped";
  reason?: string;
}

export interface CompoundDaySnapshot {
  day: number;
  markets: CompoundMarketSnapshot[];
  totalSupplyUSD: number;
  totalBorrowUSD: number;
  totalCollateralUSD: number;
  netWorthUSD: number;
  lowestHealthFactor: number;
  actionsExecuted: CompoundDayActionResult[];
  warnings: string[];
}

// ── Results ──

export interface CompoundSimulationSummary {
  startNetWorth: number;
  endNetWorth: number;
  totalInterestEarned: number;
  totalInterestPaid: number;
  lowestHealthFactor: number;
  lowestHealthFactorDay: number;
  liquidationOccurred: boolean;
  liquidationDay?: number;
}

export interface CompoundSimulationResult {
  timeline: CompoundDaySnapshot[];
  summary: CompoundSimulationSummary;
}
