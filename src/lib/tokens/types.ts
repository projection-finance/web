import { PriceScenario, RateScenario } from "@/src/lib/simulation/types";
import { NetworkId } from "@/src/lib/aave/networks";

// --- Import source (wallet scan metadata) ---

export interface ImportSource {
  address: string;
  ensName?: string;
  network: NetworkId;
  importedAt: string;
}

// --- Yield source metadata ---

export interface YieldSource {
  yieldKey: string; // "protocol:networkId:symbol"
  protocol: "aave" | "morpho" | "spark" | "compound" | "morpho-blue";
  networkId: string;
  networkName: string;
  protocolLabel?: string;
  protocolUrl?: string;
  supplyAPY: number;
  variableBorrowAPY: number;
  merklSupplyAPR: number;
  merklBorrowAPR: number;
  merklRewardTokens: string[];
  totalSupplyAPY: number;
}

// --- Token holding ---

export interface TokenHolding {
  coingeckoId: string;
  symbol: string;
  name: string;
  image?: string;
  quantity: number;
  currentPriceUSD: number;
  yieldSource?: YieldSource;
}

// --- Token actions ---

export type TokenActionType = "swap" | "send" | "receive" | "supply" | "claim" | "borrow" | "repay";

export interface TokenAction {
  id: string;
  day: number;
  orderInDay: number;
  type: TokenActionType;

  // For send/receive
  symbol: string;
  amount: number;

  // For swap
  fromSymbol?: string;
  fromAmount?: number;
  toSymbol?: string;
  toCoingeckoId?: string;       // coingecko ID of the to-token
  toName?: string;              // display name of the to-token
  toImage?: string;             // image of the to-token
  toCurrentPriceUSD?: number;   // price at time of scheduling (fallback for engine)
  swapConfig?: {
    feePercent: number;        // slippage in % (e.g. 0.3)
    feeTokenSymbol?: string;   // gas fee token (e.g. ETH)
    feeTokenAmount?: number;   // gas fee amount
  };

  // For supply
  supplyConfig?: {
    apy: number;
    locked: boolean;
    lockDays?: number;
    claimFrequency?: "continuous" | "end_of_lock" | "monthly" | "yearly";
    bonusRewards?: {
      symbol: string;
      coingeckoId: string;
      apr: number;
      priceUSD?: number; // reward token price at scheduling time (engine fallback)
    }[];
    protocol?: string;
    networkId?: string;
    yieldKey?: string;
  };

  // For borrow
  borrowConfig?: {
    borrowAPY: number;
    protocol?: string;
    networkId?: string;
    yieldKey?: string;
    borrowIncentives?: { symbol: string; coingeckoId: string; apr: number; priceUSD?: number }[];
  };
}

// Active supply state (tracked internally by engine)
export interface ActiveSupply {
  id: string;
  symbol: string;
  principalAmount: number;
  accruedInterest: number;
  claimedInterest: number;
  startDay: number;
  locked: boolean;
  lockEndDay?: number;
  apy: number;
  yieldKey?: string;
  claimFrequency: "continuous" | "end_of_lock" | "monthly" | "yearly";
  bonusRewards?: {
    symbol: string;
    coingeckoId: string;
    apr: number;
    priceUSD?: number;
    accruedAmount: number;
    claimedAmount: number;
  }[];
}

// Active borrow state (tracked internally by engine)
export interface ActiveBorrow {
  id: string;
  symbol: string;
  principalAmount: number;
  accruedInterest: number;
  startDay: number;
  borrowAPY: number;
  yieldKey?: string;
  borrowIncentives?: {
    symbol: string;
    coingeckoId: string;
    apr: number;
    priceUSD?: number;
    accruedAmount: number;
    claimedAmount: number;
  }[];
}

export interface ActiveSupplySnapshot {
  id: string;
  symbol: string;
  principalAmount: number;
  accruedInterest: number;
  claimedInterest: number;
  apy: number;
  locked: boolean;
  lockEndDay?: number;
  claimFrequency: string;
}

export interface ActiveBorrowSnapshot {
  id: string;
  symbol: string;
  principalAmount: number;
  accruedInterest: number;
  borrowAPY: number;
}

export interface TokenDayActionResult {
  type: string;
  symbol: string;
  amount: number;
  status: "success" | "skipped";
  reason?: string;
  detail?: string;
}

// --- Day snapshot ---

export interface TokenDayHolding {
  symbol: string;
  coingeckoId: string;
  name: string;
  image?: string;
  quantity: number;
  supplied: number;
  borrowed: number;
  priceUSD: number;
  valueUSD: number;
  supplyAPY?: number;
  borrowAPY?: number;
}

export interface TokenDaySnapshot {
  day: number;
  holdings: TokenDayHolding[];
  totalValueUSD: number;
  actionsExecuted: TokenDayActionResult[];
  activeSupplies: ActiveSupplySnapshot[];
  activeBorrows: ActiveBorrowSnapshot[];
}

// --- Simulation config ---

export interface TokenSimulationConfig {
  durationDays: number;
  holdings: TokenHolding[];
  priceScenarios: PriceScenario[];
  rateScenarios: RateScenario[];
  actions: TokenAction[];
  scenarioSets?: TokenScenarioSet[];
  activeScenarioSetId?: string;
  importSource?: ImportSource;
}

export interface TokenScenarioSet {
  id: string;
  name: string;
  color: string;
  priceScenarios: PriceScenario[];
  rateScenarios: RateScenario[];
}

// --- Simulation result ---

export interface TokenSimulationSummary {
  startValueUSD: number;
  endValueUSD: number;
  changeUSD: number;
  changePercent: number;
  highestValueUSD: number;
  highestValueDay: number;
  lowestValueUSD: number;
  lowestValueDay: number;
  totalInterestEarned: number;
  totalRewardsEarned: number;
  totalBorrowInterestPaid: number;
  totalBorrowIncentivesEarned: number;
}

export interface TokenSimulationResult {
  timeline: TokenDaySnapshot[];
  summary: TokenSimulationSummary;
}

// --- CoinGecko search result ---

export interface CoinGeckoSearchResult {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
  large: string;
  market_cap_rank: number | null;
}
