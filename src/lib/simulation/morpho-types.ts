import { PriceScenario, RateMode } from "./types";

// ── Morpho rate scenario (keyed by vaultAddress, not symbol) ──

export interface MorphoRateScenario {
  vaultAddress: string;
  mode: RateMode;
  startRate: number; // APY as decimal
  endRate?: number;
  manualRates?: number[];
  minRate?: number;
  maxRate?: number;
  cycleDays?: number;
  fromDay?: number;
  originalRate?: number;
}

// ── Scheduled actions ──

export interface MorphoScheduledAction {
  day: number;
  orderInDay: number;
  type: "deposit" | "withdraw";
  vaultAddress: string;
  amount: number; // in USD
}

// ── Scenario sets ──

export interface MorphoScenarioSet {
  id: string;
  name: string;
  color: string;
  priceScenarios: PriceScenario[];
  rateScenarios: MorphoRateScenario[];
}

// ── Simulation config ──

export interface MorphoSimulationConfig {
  durationDays: number;
  priceScenarios: PriceScenario[];
  rateScenarios: MorphoRateScenario[];
  scheduledActions: MorphoScheduledAction[];
  scenarioSets?: MorphoScenarioSet[];
  activeScenarioSetId?: string;
}

// ── Engine state (internal) ──

export interface MorphoVaultEngineEntry {
  vaultAddress: string;
  vaultName: string;
  assetSymbol: string;
  balanceUsd: number;
  priceUsd: number; // price of underlying asset
  netApy: number;
  cumulativeInterestUsd: number;
}

export interface MorphoEngineState {
  vaults: MorphoVaultEngineEntry[];
}

// ── Day snapshot ──

export interface MorphoVaultSnapshot {
  vaultAddress: string;
  vaultName: string;
  assetSymbol: string;
  balanceUsd: number;
  netApy: number;
  interestEarnedUsd: number;
}

export interface MorphoDayActionResult {
  type: "deposit" | "withdraw";
  vaultAddress: string;
  amount: number;
  status: "success" | "skipped";
  reason?: string;
}

export interface MorphoDaySnapshot {
  day: number;
  totalDepositedUsd: number;
  totalInterestEarnedUsd: number;
  netWorthUsd: number;
  vaults: MorphoVaultSnapshot[];
  actionsExecuted: MorphoDayActionResult[];
  warnings: string[];
}

// ── Simulation result ──

export interface MorphoSimulationSummary {
  startNetWorth: number;
  endNetWorth: number;
  totalInterestEarned: number;
  avgApy: number;
}

export interface MorphoSimulationResult {
  timeline: MorphoDaySnapshot[];
  summary: MorphoSimulationSummary;
}
