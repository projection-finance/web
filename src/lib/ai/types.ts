import {
  PriceScenario,
  RateScenario,
  ScheduledAction,
} from "@/src/lib/simulation/types";

// --- AI Model ---

export type AIModel = string;

export const AI_MODELS = [
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", provider: "Anthropic" },
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6", provider: "Anthropic" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "openai/codex-mini", label: "Codex Mini", provider: "OpenAI" },
  { id: "openai/gpt-4.1", label: "GPT-4.1", provider: "OpenAI" },
] as const;

export const DEFAULT_AI_MODEL: AIModel = "anthropic/claude-sonnet-4.6";

// --- Position Context (compressed for LLM) ---

export interface PositionContextSupply {
  symbol: string;
  balance: number;
  balanceUSD: number;
  supplyAPY: number;
  incentiveAPR: number;
  usedAsCollateral: boolean;
  ltv: number;
  liquidationThreshold: number;
}

export interface PositionContextBorrow {
  symbol: string;
  debt: number;
  debtUSD: number;
  borrowAPY: number;
  incentiveAPR: number;
}

export interface PositionContextAvailableAsset {
  symbol: string;
  supplyAPY: number;
  borrowAPY: number;
  supplyIncentiveAPR: number;
  borrowIncentiveAPR: number;
  ltv: number;
  liquidationThreshold: number;
  borrowingEnabled: boolean;
  priceUSD: number;
}

export interface PositionContextMarketConditions {
  ethPriceUSD: number;
  timestamp: number;
}

export interface PositionContext {
  summary: {
    healthFactor: number;
    totalCollateralUSD: number;
    totalBorrowsUSD: number;
    netWorthUSD: number;
    availableBorrowsUSD: number;
    currentLTV: number;
    currentLiquidationThreshold: number;
    emodeCategoryId: number;
  };
  supplies: PositionContextSupply[];
  borrows: PositionContextBorrow[];
  availableAssets: PositionContextAvailableAsset[];
  marketConditions: PositionContextMarketConditions;
}

// --- Yield Optimizer ---

export interface YieldOpportunity {
  title: string;
  description: string;
  estimatedAPYImprovement: number;
  riskLevel: "low" | "medium" | "high";
  actions: ScheduledAction[];
}

export interface YieldOptimizerRequest {
  positionContext: PositionContext;
  constraints?: {
    minHealthFactor?: number;
    riskTolerance?: "conservative" | "balanced" | "aggressive";
    excludeSymbols?: string[];
  };
  model?: AIModel;
}

export interface YieldOptimizerResponse {
  opportunities: YieldOpportunity[];
  currentNetAPY: number;
  projectedNetAPY: number;
  analysis: string;
}

// --- Strategy Advisor ---

export interface StrategyProfile {
  name: string;
  riskLevel: "conservative" | "balanced" | "aggressive";
  description: string;
  targetHealthFactor: number;
  priceScenarios: PriceScenario[];
  rateScenarios: RateScenario[];
  actions: ScheduledAction[];
  projectedAPY: number;
}

export interface StrategyAdvisorRequest {
  positionContext: PositionContext;
  scenario: string; // natural language scenario description
  durationDays?: number;
  profiles?: ("conservative" | "balanced" | "aggressive")[];
  model?: AIModel;
}

export interface StrategyAdvisorResponse {
  strategies: StrategyProfile[];
  scenarioAnalysis: string;
  recommendation: string;
}

// --- AI Summary ---

export interface AISummaryData {
  content: string;       // The summary text (markdown)
  language: string;      // ISO 639-1 code (e.g. "en", "fr", "es")
  generatedAt: string;   // ISO date string
  reloadCount: number;   // How many times regenerated (max 10)
  model: AIModel;        // Which model generated the summary
}

export interface AISummaryRequest {
  type: "aave" | "sandbox" | "morpho";
  language?: string;     // ISO 639-1 code, default "en"
  model?: AIModel;
  // Aave context
  network?: string;
  address?: string;
  ensName?: string;
  durationDays: number;
  // Aave-specific simulation data
  simulationSummary?: {
    startNetWorth: number;
    endNetWorth: number;
    totalInterestEarned: number;
    totalInterestPaid: number;
    totalIncentivesEarnedUSD: number;
    lowestHealthFactor: number;
    lowestHealthFactorDay: number;
    liquidationOccurred: boolean;
    liquidationDay?: number;
  };
  startState?: {
    healthFactor: number;
    totalCollateralUSD: number;
    totalBorrowsUSD: number;
    netWorthUSD: number;
    supplies: { symbol: string; balanceUSD: number; supplyAPY: number }[];
    borrows: { symbol: string; debtUSD: number; borrowAPY: number }[];
  };
  endState?: {
    healthFactor: number;
    totalCollateralUSD: number;
    totalBorrowsUSD: number;
    netWorthUSD: number;
    supplies: { symbol: string; balanceUSD: number; supplyAPY: number }[];
    borrows: { symbol: string; debtUSD: number; borrowAPY: number }[];
  };
  actions?: { day: number; type: string; symbol: string; amount: number }[];
  priceChanges?: { symbol: string; mode: string; startPrice: number; endPrice?: number }[];
  rateChanges?: { symbol: string; rateType: string; mode: string; startRate: number; endRate?: number }[];
  // Sandbox-specific data
  sandboxSummary?: {
    startValueUSD: number;
    endValueUSD: number;
    changeUSD: number;
    changePercent: number;
    totalInterestEarned: number;
    totalRewardsEarned: number;
    highestValueUSD: number;
    highestValueDay: number;
    lowestValueUSD: number;
    lowestValueDay: number;
  };
  sandboxStartHoldings?: { symbol: string; quantity: number; valueUSD: number }[];
  sandboxEndHoldings?: { symbol: string; quantity: number; valueUSD: number }[];
  sandboxActions?: { day: number; type: string; symbol: string; amount: number; toSymbol?: string }[];
  // Morpho-specific data
  morphoSummary?: {
    startNetWorth: number;
    endNetWorth: number;
    totalInterestEarned: number;
    avgApy: number;
  };
  morphoVaults?: { vaultName: string; assetSymbol: string; balanceUsd: number; netApy: number }[];
  morphoActions?: { day: number; type: string; vaultName: string; amount: number }[];
}

export interface AISummaryResponse {
  summary: string; // The generated summary (markdown)
}

// --- AI Insights ---

export interface AIInsightsRequest {
  prompt: string;
  positionContext?: PositionContext;
  historicalContext?: {
    symbols: string[];
    startDate: string;
    endDate: string;
    currentPrices: Record<string, number>;
  };
  model?: AIModel;
}

export interface AIInsightsResponse {
  answer: string;
  priceScenarios?: PriceScenario[];
  rateScenarios?: RateScenario[];
  actions?: ScheduledAction[];
  reasoning?: string;
}

// --- Streaming ---

export type AIStreamEvent =
  | { type: "status"; message: string }
  | { type: "chunk"; content: string }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string; code: AIErrorCode };

// --- Errors ---

export type AIErrorCode =
  | "INVALID_REQUEST"
  | "API_KEY_MISSING"
  | "RATE_LIMITED"
  | "MODEL_ERROR"
  | "VALIDATION_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

export class AIError extends Error {
  code: AIErrorCode;
  statusCode: number;

  constructor(message: string, code: AIErrorCode, statusCode: number = 500) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
