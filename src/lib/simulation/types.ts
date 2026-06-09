import {
  AaveHealthFactorData,
  RawUserReserve,
  FormattedReserve,
  BaseCurrencyData,
  MerklIncentiveData,
} from "@/src/lib/aave/types";

// --- Price scenario types ---

export type PriceMode = "fixed" | "linear" | "sinusoidal" | "gbm" | "manual";

export interface PriceScenario {
  symbol: string;
  mode: PriceMode;
  startPrice: number;
  endPrice?: number; // for linear
  mu?: number; // annualized drift for gbm (e.g. 0.05 = 5%/year)
  sigma?: number; // annualized volatility for gbm (e.g. 0.8 = 80%/year)
  seed?: number; // deterministic seed for reproducibility
  manualPrices?: number[]; // for manual mode, price per day
  minPrice?: number; // for sinusoidal mode, oscillation minimum
  maxPrice?: number; // for sinusoidal mode, oscillation maximum
  cycleDays?: number; // for sinusoidal mode, days per full cycle
  fromDay?: number; // day from which this scenario starts (days before use originalPrice)
  originalPrice?: number; // original market price, used for days before fromDay
}

// --- Rate scenario types ---

export type RateMode = "fixed" | "linear" | "sinusoidal" | "manual";

export interface RateScenario {
  symbol: string;
  rateType: "supply" | "borrow" | "supplyIncentive" | "borrowIncentive";
  mode: RateMode;
  startRate: number; // APY as decimal (e.g. 0.05 = 5%)
  endRate?: number; // for linear
  manualRates?: number[]; // for manual mode, rate per day
  minRate?: number; // for sinusoidal mode, oscillation minimum
  maxRate?: number; // for sinusoidal mode, oscillation maximum
  cycleDays?: number; // for sinusoidal mode, days per full cycle
  fromDay?: number; // day from which this scenario starts (days before use originalRate)
  originalRate?: number; // original market rate, used for days before fromDay
}

// --- Incentive types ---

export interface IncentiveDetail {
  rewardTokenSymbol: string;
  rewardTokenAddress: string;
  incentiveAPR: number; // APR as decimal
  source: "protocol" | "merkl";
}

// --- Scheduled action types ---

export interface ScheduledAction {
  day: number; // Day 0 is the baseline state; actions must be scheduled from day 1 onwards
  orderInDay: number;
  type: "supply" | "borrow" | "repay" | "withdraw" | "set_emode" | "set_wallet_balance";
  symbol: string;
  amount: number;
  useAsCollateral?: boolean; // for supply
  repayFromCollateral?: boolean; // for repay: withdraw from supply then repay
  emodeCategoryId?: number; // for set_emode
}

// --- Scenario set (multi-scenario support) ---

export interface ScenarioSet {
  id: string;
  name: string;
  color: string;
  priceScenarios: PriceScenario[];
  rateScenarios: RateScenario[];
}

// --- Simulation config ---

export interface TemporalSimulationConfig {
  durationDays: number;
  priceScenarios: PriceScenario[];
  rateScenarios: RateScenario[];
  scheduledActions: ScheduledAction[];
  scenarioSets?: ScenarioSet[];
  activeScenarioSetId?: string;
}

// --- Multi-scenario result ---

export interface MultiScenarioResult {
  results: Map<string, TemporalSimulationResult>;
  activeId: string;
}

// --- Day snapshot ---

export interface DayAssetPrice {
  symbol: string;
  priceUSD: number;
}

export interface DayAssetRate {
  symbol: string;
  supplyAPY: number;
  variableBorrowAPY: number;
  supplyIncentiveAPR: number;
  borrowIncentiveAPR: number;
}

export interface DaySupplyItem {
  symbol: string;
  balance: number;
  balanceUSD: number;
  supplyAPY: number;
  incentiveAPR: number;
  incentives: IncentiveDetail[];
}

export interface DayBorrowItem {
  symbol: string;
  debt: number;
  debtUSD: number;
  borrowAPY: number;
  incentiveAPR: number;
  incentives: IncentiveDetail[];
}

export interface DayActionResult {
  type: string;
  symbol: string;
  amount: number;
  status: "success" | "skipped";
  reason?: string;
}

export interface DaySnapshot {
  day: number;
  prices: DayAssetPrice[];
  rates: DayAssetRate[];
  healthFactor: number;
  totalCollateralUSD: number;
  totalBorrowsUSD: number;
  netWorthUSD: number;
  availableBorrowsUSD: number;
  currentLTV: number;
  currentLiquidationThreshold: number;
  supplies: DaySupplyItem[];
  borrows: DayBorrowItem[];
  actionsExecuted: DayActionResult[];
  warnings: string[];
}

// --- Simulation result ---

export interface SimulationSummary {
  startNetWorth: number;
  endNetWorth: number;
  totalInterestEarned: number;
  totalInterestPaid: number;
  totalIncentivesEarnedUSD: number;
  lowestHealthFactor: number;
  lowestHealthFactorDay: number;
  liquidationOccurred: boolean;
  liquidationDay?: number;
}

export interface TemporalSimulationResult {
  timeline: DaySnapshot[];
  summary: SimulationSummary;
}

// --- Internal state passed through the engine loop ---

export interface EngineState {
  rawUserReserves: RawUserReserve[];
  formattedPoolReserves: FormattedReserve[];
  baseCurrencyData: BaseCurrencyData;
  userEmodeCategoryId: number;
  marketReferenceCurrencyPriceInUSD: number;
  healthFactorData: AaveHealthFactorData;
  merklIncentives?: MerklIncentiveData[];
}
