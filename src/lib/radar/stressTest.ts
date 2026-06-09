/**
 * Lightweight stress-test HF recalculation for Radar positions.
 * Uses position JSON data (collaterals/debts with amounts & liqThresholds)
 * instead of the full simulation engine — no RPC calls needed.
 */

// ── Types ──

export interface PositionJson {
  collaterals: { symbol: string; amountUSD: number; amount: number; liqThreshold: number }[];
  debts: { symbol: string; amountUSD: number; amount: number }[];
}

export interface RadarPositionForStress {
  id: string;
  walletAddress: string;
  healthFactor: number;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  mainCollateralSymbol: string;
  positionJson: PositionJson | null;
}

export interface PriceChange {
  symbol: string;
  percentChange: number; // -20 means price drops 20%
}

export type StressStatus =
  | "liquidated_full"   // HF < 0.95 (100% close factor)
  | "liquidated_partial" // 0.95 <= HF < 1 (50% close factor)
  | "entered_risk"      // was >= 1.1, now < 1.1
  | "exited_risk"       // was < 1.1, now >= 1.1
  | "safer"             // HF increased
  | "riskier"           // HF decreased but not liquidated
  | "unchanged";

export interface StressTestResult {
  position: RadarPositionForStress;
  currentHF: number;
  stressedHF: number;
  deltaHF: number;
  stressedCollateralUSD: number;
  stressedDebtUSD: number;
  status: StressStatus;
  summary: string;
}

export interface StressTestSummary {
  liquidatedCount: number;
  liquidatedValueUSD: number;
  enteredRiskCount: number;
  exitedRiskCount: number;
  results: StressTestResult[];
}

// ── Stablecoin detection (standalone, no emode data needed) ──

const STABLECOIN_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "FRAX", "GHO", "LUSD", "PYUSD", "crvUSD",
  "USDC.e", "USDbC", "USDe", "sUSDe", "USDS", "sUSDS", "FDUSD",
  "USD₮", "aUSDC", "aUSDT", "aDAI", "syrupUSDT", "syrupUSDC",
]);

export function isStablecoinSymbol(symbol: string): boolean {
  if (STABLECOIN_SYMBOLS.has(symbol)) return true;
  // Heuristic: contains "USD" or "usd"
  const lower = symbol.toLowerCase();
  return lower.includes("usd") || lower.includes("dai") || lower.includes("eur");
}

// ── Core computation ──

/**
 * Ratio-based stressed HF computation.
 * Uses the on-chain HF (which already includes E-Mode, isolation mode, etc.)
 * and applies the collateral/debt value change ratio.
 *
 * stressedHF = onChainHF × (stressedCollateralUSD / currentCollateralUSD) / (stressedDebtUSD / currentDebtUSD)
 *
 * This is exact when all collateral shares the same effective liqThreshold
 * (E-Mode case) and a good approximation otherwise.
 */
export function computeStressedHF(
  positionJson: PositionJson,
  priceChanges: PriceChange[],
  onChainHF: number,
  currentTotalCollateralUSD: number,
  currentTotalDebtUSD: number,
): { stressedHF: number; stressedCollateralUSD: number; stressedDebtUSD: number } {
  const changeMap = new Map(priceChanges.map((p) => [p.symbol, p.percentChange]));

  let stressedCollateralUSD = 0;
  let stressedDebtUSD = 0;

  for (const c of positionJson.collaterals) {
    if (c.amount <= 0) continue;
    const currentPrice = c.amountUSD / c.amount;
    const pctChange = changeMap.get(c.symbol) ?? 0;
    const newPrice = currentPrice * (1 + pctChange / 100);
    stressedCollateralUSD += c.amount * newPrice;
  }

  for (const d of positionJson.debts) {
    if (d.amount <= 0) continue;
    const currentPrice = d.amountUSD / d.amount;
    const pctChange = changeMap.get(d.symbol) ?? 0;
    const newPrice = currentPrice * (1 + pctChange / 100);
    stressedDebtUSD += d.amount * newPrice;
  }

  // Ratio-based: preserves E-Mode and any on-chain nuances
  const collateralRatio = currentTotalCollateralUSD > 0
    ? stressedCollateralUSD / currentTotalCollateralUSD
    : 1;
  const debtRatio = currentTotalDebtUSD > 0
    ? stressedDebtUSD / currentTotalDebtUSD
    : 1;

  const stressedHF = debtRatio > 0
    ? onChainHF * collateralRatio / debtRatio
    : Infinity;

  return { stressedHF, stressedCollateralUSD, stressedDebtUSD };
}

function getStatus(currentHF: number, stressedHF: number): StressStatus {
  if (stressedHF < 0.95 && currentHF >= 0.95) return "liquidated_full";
  if (stressedHF < 1 && currentHF >= 1) return "liquidated_partial";
  if (stressedHF < 1.1 && currentHF >= 1.1) return "entered_risk";
  if (stressedHF >= 1.1 && currentHF < 1.1) return "exited_risk";
  if (stressedHF > currentHF + 0.001) return "safer";
  if (stressedHF < currentHF - 0.001) return "riskier";
  return "unchanged";
}

function buildSummary(result: StressTestResult): string {
  const hfFrom = result.currentHF < 100 ? result.currentHF.toFixed(2) : "∞";
  const hfTo = result.stressedHF < 100 ? result.stressedHF.toFixed(2) : "∞";
  const debtStr = formatCompact(result.position.totalDebtUSD);

  switch (result.status) {
    case "liquidated_full":
      return `$${debtStr} position fully liquidatable — HF ${hfFrom} → ${hfTo} (100% close factor)`;
    case "liquidated_partial":
      return `$${debtStr} position enters liquidation zone — HF ${hfFrom} → ${hfTo} (50% close factor)`;
    case "entered_risk":
      return `$${debtStr} position enters risk zone — HF ${hfFrom} → ${hfTo}`;
    case "exited_risk":
      return `$${debtStr} position exits risk zone — HF ${hfFrom} → ${hfTo}`;
    case "safer":
      return `Position improves — HF ${hfFrom} → ${hfTo}`;
    case "riskier":
      return `$${debtStr} position weakens — HF ${hfFrom} → ${hfTo}`;
    default:
      return `No significant impact — HF stays at ${hfFrom}`;
  }
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

// ── Main entry point ──

export function runStressTest(
  positions: RadarPositionForStress[],
  priceChanges: PriceChange[],
  topN = 10,
): StressTestSummary {
  if (priceChanges.length === 0 || priceChanges.every((p) => p.percentChange === 0)) {
    return { liquidatedCount: 0, liquidatedValueUSD: 0, enteredRiskCount: 0, exitedRiskCount: 0, results: [] };
  }

  const allResults: StressTestResult[] = [];

  for (const pos of positions) {
    if (!pos.positionJson || !pos.positionJson.collaterals?.length) continue;

    const currentHF = pos.healthFactor;
    const { stressedHF, stressedCollateralUSD, stressedDebtUSD } = computeStressedHF(
      pos.positionJson, priceChanges, currentHF, pos.totalCollateralUSD, pos.totalDebtUSD
    );
    const deltaHF = stressedHF - currentHF;
    const status = getStatus(currentHF, stressedHF);

    if (status === "unchanged") continue;

    const result: StressTestResult = {
      position: pos,
      currentHF,
      stressedHF,
      deltaHF,
      stressedCollateralUSD,
      stressedDebtUSD,
      status,
      summary: "",
    };
    result.summary = buildSummary(result);
    allResults.push(result);
  }

  // Sort: liquidations first, then by |deltaHF| descending
  const statusPriority: Record<StressStatus, number> = {
    liquidated_full: 0,
    liquidated_partial: 1,
    entered_risk: 2,
    exited_risk: 3,
    riskier: 4,
    safer: 5,
    unchanged: 6,
  };

  allResults.sort((a, b) => {
    const pa = statusPriority[a.status];
    const pb = statusPriority[b.status];
    if (pa !== pb) return pa - pb;
    return Math.abs(b.deltaHF) - Math.abs(a.deltaHF);
  });

  const liquidatedCount = allResults.filter((r) => r.status === "liquidated_full" || r.status === "liquidated_partial").length;
  const liquidatedValueUSD = allResults
    .filter((r) => r.status === "liquidated_full" || r.status === "liquidated_partial")
    .reduce((sum, r) => sum + r.stressedDebtUSD, 0);
  const enteredRiskCount = allResults.filter((r) => r.status === "entered_risk").length;
  const exitedRiskCount = allResults.filter((r) => r.status === "exited_risk").length;

  return {
    liquidatedCount,
    liquidatedValueUSD,
    enteredRiskCount,
    exitedRiskCount,
    results: allResults.slice(0, topN),
  };
}

// ── Unique assets from positions ──

export function extractUniqueAssets(positions: RadarPositionForStress[]): string[] {
  const symbols = new Set<string>();
  for (const pos of positions) {
    if (!pos.positionJson) continue;
    for (const c of pos.positionJson.collaterals) symbols.add(c.symbol);
    for (const d of pos.positionJson.debts) symbols.add(d.symbol);
  }
  return Array.from(symbols).sort();
}
