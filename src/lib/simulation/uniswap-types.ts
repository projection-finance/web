import type { PriceScenario } from "./types";

// ── Volume scenario (replaces rate scenarios for Uniswap) ──

export type VolumeMode = "fixed" | "linear" | "sinusoidal" | "manual";

export interface VolumeScenario {
  poolAddress: string;
  mode: VolumeMode;
  startVolume: number;       // daily USD volume
  endVolume?: number;
  minVolume?: number;
  maxVolume?: number;
  cycleDays?: number;
  manualVolumes?: number[];
  fromDay?: number;
  originalVolume?: number;
}

// ── Actions ──

export type UniswapActionType =
  | "createPosition"
  | "addLiquidity"
  | "removeLiquidity"
  | "collectFees"
  | "closePosition";

export interface UniswapScheduledAction {
  day: number;
  orderInDay: number;
  type: UniswapActionType;
  positionIndex: number;     // which position (0-based)
  // For createPosition:
  priceLower?: number;
  priceUpper?: number;
  amount0?: number;
  amount1?: number;
  // For addLiquidity:
  addAmount0?: number;
  addAmount1?: number;
  // For removeLiquidity:
  liquidityPercent?: number; // 0-100
}

// ── Scenario sets ──

export interface UniswapScenarioSet {
  id: string;
  name: string;
  color: string;
  priceScenarios: PriceScenario[];
  volumeScenarios: VolumeScenario[];
}

// ── Config ──

export interface UniswapSimulationConfig {
  durationDays: number;
  priceScenarios: PriceScenario[];
  volumeScenarios: VolumeScenario[];
  scheduledActions: UniswapScheduledAction[];
  scenarioSets?: UniswapScenarioSet[];
  activeScenarioSetId?: string;
}

// ── Engine state ──

export interface UniswapPositionEngineEntry {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  feeTier: number;           // decimal, e.g. 0.003
  priceLower: number;
  priceUpper: number;
  liquidity: number;
  currentPrice: number;      // token0 in token1
  token0PriceUSD: number;
  token1PriceUSD: number;
  totalActiveLiquidity: number;
  dailyVolumeUSD: number;
  cumulativeFeesUSD: number;
  cumulativeFees0: number;
  cumulativeFees1: number;
  unclaimedFeesUSD: number;
  priceAtEntry: number;      // price when position was created
}

export interface UniswapEngineState {
  positions: UniswapPositionEngineEntry[];
}

// ── Day snapshot ──

export interface UniswapPositionSnapshot {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  priceLower: number;
  priceUpper: number;
  liquidity: number;
  currentPrice: number;
  inRange: boolean;
  amount0: number;
  amount1: number;
  positionValueUSD: number;
  holdValueUSD: number;
  ilAbsolute: number;
  ilPercent: number;
  dailyFeesUSD: number;
  cumulativeFeesUSD: number;
  unclaimedFeesUSD: number;
  netValueUSD: number;       // positionValueUSD + unclaimedFeesUSD
}

export interface UniswapDayActionResult {
  type: string;
  positionIndex: number;
  status: "success" | "skipped";
  reason?: string;
  detail?: string;
}

export interface UniswapDaySnapshot {
  day: number;
  positions: UniswapPositionSnapshot[];
  totalPositionValueUSD: number;
  totalHoldValueUSD: number;
  totalILAbsolute: number;
  totalFeesUSD: number;
  totalNetValueUSD: number;
  actionsExecuted: UniswapDayActionResult[];
  warnings: string[];
}

// ── Results ──

export interface UniswapSimulationSummary {
  startNetValue: number;
  endNetValue: number;
  totalFeesEarned: number;
  totalIL: number;
  netPnL: number;
  daysInRange: number;
  daysOutOfRange: number;
  breakEvenDay: number | null; // day when cumFees > abs(IL), null if never
}

export interface UniswapSimulationResult {
  timeline: UniswapDaySnapshot[];
  summary: UniswapSimulationSummary;
}
