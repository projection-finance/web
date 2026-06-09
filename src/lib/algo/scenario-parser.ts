import { PriceScenario, RateScenario } from "@/src/lib/simulation/types";

/**
 * Client-side parser for natural language scenario prompts.
 * Handles common patterns without needing an LLM.
 *
 * Supported patterns:
 *   "ETH +30%"          → linear, current → current*1.3
 *   "ETH -50%"          → linear, current → current*0.5
 *   "ETH 5000"          → linear, current → 5000
 *   "ETH bullish"       → linear, +20%
 *   "ETH bearish"       → linear, -20%
 *   "ETH volatile"      → sinusoidal, ±15%
 *   "ETH crash"         → gbm, mu=-2.0 sigma=1.5
 *   "ETH moon"          → gbm, mu=1.5 sigma=0.8
 *   Multiple tokens:    "ETH +30%, WBTC -10%"
 */

export interface ParsedScenarios {
  priceScenarios: PriceScenario[];
  rateScenarios: RateScenario[];
}

interface AssetLookup {
  symbol: string;
  priceInUSD: number;
  supplyAPY?: number;
  variableBorrowAPY?: number;
}

// ── Token patterns ──

const SENTIMENT_MAP: Record<string, { type: string; value: number }> = {
  bullish: { type: "pct", value: 0.2 },
  bull: { type: "pct", value: 0.2 },
  up: { type: "pct", value: 0.15 },
  bearish: { type: "pct", value: -0.2 },
  bear: { type: "pct", value: -0.2 },
  down: { type: "pct", value: -0.15 },
  crash: { type: "gbm_crash", value: 0 },
  dump: { type: "gbm_crash", value: 0 },
  moon: { type: "gbm_moon", value: 0 },
  pump: { type: "gbm_moon", value: 0 },
  volatile: { type: "sinusoidal", value: 0.15 },
  choppy: { type: "sinusoidal", value: 0.1 },
  sideways: { type: "fixed", value: 0 },
  flat: { type: "fixed", value: 0 },
  stable: { type: "fixed", value: 0 },
};

/**
 * Try to parse a prompt into PriceScenarios client-side.
 * Returns null if the prompt is too complex for the algo parser.
 */
export function parseScenarioPrompt(
  prompt: string,
  assets: AssetLookup[]
): ParsedScenarios | null {
  const normalized = prompt.toLowerCase().trim();
  if (!normalized) return null;

  // Build symbol lookup (case-insensitive)
  const symbolMap = new Map<string, AssetLookup>();
  for (const a of assets) {
    symbolMap.set(a.symbol.toLowerCase(), a);
  }

  // Split by comma or "and" for multi-token prompts
  const segments = normalized
    .split(/[,;]|\band\b/)
    .map((s) => s.trim())
    .filter(Boolean);

  const priceScenarios: PriceScenario[] = [];

  for (const segment of segments) {
    const result = parseSegment(segment, symbolMap);
    if (!result) return null; // Can't parse this segment → fall back to LLM
    priceScenarios.push(...result);
  }

  if (priceScenarios.length === 0) return null;

  return { priceScenarios, rateScenarios: [] };
}

function parseSegment(
  segment: string,
  symbolMap: Map<string, AssetLookup>
): PriceScenario[] | null {
  const tokens = segment.split(/\s+/);

  // Find the asset symbol in the segment
  let asset: AssetLookup | undefined;
  let remainingTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const candidate = tokens[i].replace(/[^a-z0-9]/gi, "");
    if (symbolMap.has(candidate)) {
      asset = symbolMap.get(candidate);
      remainingTokens = [...tokens.slice(0, i), ...tokens.slice(i + 1)];
      break;
    }
  }

  if (!asset) return null;

  const rest = remainingTokens.join(" ").trim();

  // Pattern 1: percentage "+30%", "-50%", "30%"
  const pctMatch = rest.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]) / 100;
    const endPrice = asset.priceInUSD * (1 + pct);
    return [
      {
        symbol: asset.symbol,
        mode: "linear",
        startPrice: asset.priceInUSD,
        endPrice: Math.max(0.001, endPrice),
        originalPrice: asset.priceInUSD,
      },
    ];
  }

  // Pattern 2: absolute price "5000", "$5000"
  const absMatch = rest.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (absMatch && !SENTIMENT_MAP[rest.replace(/\$?\s*\d+(?:\.\d+)?/, "").trim()]) {
    const targetPrice = parseFloat(absMatch[1]);
    if (targetPrice > 0) {
      return [
        {
          symbol: asset.symbol,
          mode: "linear",
          startPrice: asset.priceInUSD,
          endPrice: targetPrice,
          originalPrice: asset.priceInUSD,
        },
      ];
    }
  }

  // Pattern 3: sentiment keywords
  for (const token of remainingTokens) {
    const clean = token.replace(/[^a-z]/gi, "").toLowerCase();
    const sentiment = SENTIMENT_MAP[clean];
    if (!sentiment) continue;

    switch (sentiment.type) {
      case "pct":
        return [
          {
            symbol: asset.symbol,
            mode: "linear",
            startPrice: asset.priceInUSD,
            endPrice: asset.priceInUSD * (1 + sentiment.value),
            originalPrice: asset.priceInUSD,
          },
        ];
      case "gbm_crash":
        return [
          {
            symbol: asset.symbol,
            mode: "gbm",
            startPrice: asset.priceInUSD,
            mu: -2.0,
            sigma: 1.5,
            originalPrice: asset.priceInUSD,
          },
        ];
      case "gbm_moon":
        return [
          {
            symbol: asset.symbol,
            mode: "gbm",
            startPrice: asset.priceInUSD,
            mu: 1.5,
            sigma: 0.8,
            originalPrice: asset.priceInUSD,
          },
        ];
      case "sinusoidal":
        return [
          {
            symbol: asset.symbol,
            mode: "sinusoidal",
            startPrice: asset.priceInUSD,
            minPrice: asset.priceInUSD * (1 - sentiment.value),
            maxPrice: asset.priceInUSD * (1 + sentiment.value),
            cycleDays: 30,
            originalPrice: asset.priceInUSD,
          },
        ];
      case "fixed":
        return [
          {
            symbol: asset.symbol,
            mode: "fixed",
            startPrice: asset.priceInUSD,
            originalPrice: asset.priceInUSD,
          },
        ];
    }
  }

  return null;
}

// ── Post-processing: simplify LLM output ──

/**
 * Convert any manual-mode scenarios to linear (first → last value).
 * Strip day-by-day arrays. Ensure clean directional curves.
 */
export function simplifyPriceScenario(ps: PriceScenario): PriceScenario {
  if (ps.mode === "manual" && ps.manualPrices && ps.manualPrices.length > 0) {
    const first = ps.manualPrices[0];
    const last = ps.manualPrices[ps.manualPrices.length - 1];
    return {
      symbol: ps.symbol,
      mode: "linear",
      startPrice: first,
      endPrice: last,
      originalPrice: ps.originalPrice ?? first,
    };
  }

  // Strip manualPrices if present on non-manual mode
  const result = { ...ps };
  delete result.manualPrices;
  return result;
}

export function simplifyRateScenario(rs: RateScenario): RateScenario {
  if (rs.mode === "manual" && rs.manualRates && rs.manualRates.length > 0) {
    const first = rs.manualRates[0];
    const last = rs.manualRates[rs.manualRates.length - 1];
    return {
      symbol: rs.symbol,
      rateType: rs.rateType,
      mode: "linear",
      startRate: first,
      endRate: last,
      originalRate: rs.originalRate ?? first,
    };
  }

  const result = { ...rs };
  delete result.manualRates;
  return result;
}
