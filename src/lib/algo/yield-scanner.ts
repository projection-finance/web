import { EmodeCategory } from "@/src/lib/aave/emode";
import { isEModeAvailable } from "@/src/lib/aave/emode";
import {
  PositionContext,
  YieldOpportunity,
  YieldOptimizerResponse,
} from "@/src/lib/ai/types";
import { ScheduledAction } from "@/src/lib/simulation/types";
import { classifyAsset, isSameClass } from "./asset-classifier";
import { calculateNetAPY } from "./net-apy";

// ── Config ──

export interface ScanConfig {
  minHealthFactor: number;
  minAPYImprovement: number;
  minAmountUSD: number;
  maxOpportunities: number;
  riskTolerance: "conservative" | "balanced" | "aggressive";
  excludeSymbols: string[];
}

const DEFAULT_CONFIG: ScanConfig = {
  minHealthFactor: 1.5,
  minAPYImprovement: 0.005,
  minAmountUSD: 50,
  maxOpportunities: 5,
  riskTolerance: "balanced",
  excludeSymbols: [],
};

// ── Risk helpers ──

type RiskLevel = "low" | "medium" | "high";

function riskAllowed(
  level: RiskLevel,
  tolerance: ScanConfig["riskTolerance"]
): boolean {
  if (tolerance === "aggressive") return true;
  if (tolerance === "balanced") return level !== "high";
  return level === "low"; // conservative
}

function operationRisk(
  symbolA: string,
  symbolB: string,
  categories: EmodeCategory[],
  addingDebt: boolean
): RiskLevel {
  const same = isSameClass(symbolA, symbolB, categories);
  const classA = classifyAsset(symbolA, categories);
  const classB = classifyAsset(symbolB, categories);

  // Stablecoin swaps are always low risk
  if (classA === "stablecoin" && classB === "stablecoin") return "low";

  // Same class = low, cross class = high
  if (!same) return "high";

  // Adding debt is at minimum medium
  if (addingDebt) return "medium";

  return "low";
}

// ── Score an opportunity for ranking ──

function scoreOpportunity(opp: YieldOpportunity): number {
  const riskWeight: Record<RiskLevel, number> = {
    low: 1.0,
    medium: 0.7,
    high: 0.4,
  };
  return opp.estimatedAPYImprovement * riskWeight[opp.riskLevel];
}

// ── Action factory helpers ──

function makeAction(
  type: ScheduledAction["type"],
  symbol: string,
  amount: number,
  extra?: Partial<ScheduledAction>
): ScheduledAction {
  return {
    day: 1, // Actions start at day 1; day 0 is baseline
    orderInDay: 0,
    type,
    symbol,
    amount,
    ...extra,
  };
}

// ═══════════════════════════════════════════════════════
// Rule 1 — Collateral Toggle
// ═══════════════════════════════════════════════════════

function ruleCollateralToggle(
  ctx: PositionContext,
  config: ScanConfig
): YieldOpportunity[] {
  const opps: YieldOpportunity[] = [];

  for (const supply of ctx.supplies) {
    if (config.excludeSymbols.includes(supply.symbol)) continue;
    if (supply.balanceUSD < config.minAmountUSD) continue;

    // Supply not used as collateral but has LTV > 0 → could be enabled
    if (!supply.usedAsCollateral && supply.ltv > 0) {
      opps.push({
        title: `Enable ${supply.symbol} as collateral`,
        description: `${supply.symbol} ($${supply.balanceUSD.toFixed(0)}) is not used as collateral but has ${(supply.ltv * 100).toFixed(0)}% LTV. Enabling it would increase your borrowing capacity.`,
        estimatedAPYImprovement: 0, // info only
        riskLevel: "low",
        actions: [], // info only — no engine action
      });
    }
  }

  return opps;
}

// ═══════════════════════════════════════════════════════
// Rule 2 — E-Mode Activation
// ═══════════════════════════════════════════════════════

function ruleEmodeActivation(
  ctx: PositionContext,
  categories: EmodeCategory[]
): YieldOpportunity[] {
  // Only suggest if not already in an E-Mode
  if (ctx.summary.emodeCategoryId !== 0) return [];

  const opps: YieldOpportunity[] = [];

  for (const cat of categories) {
    if (cat.id === 0) continue;

    // Check if all user borrows are borrowable in this category
    // We need to match by symbol since we don't have underlyingAsset
    const allBorrowsCompatible = ctx.borrows.every((b) =>
      cat.assets.some((a) => a.symbol === b.symbol && a.borrowable)
    );

    if (!allBorrowsCompatible && ctx.borrows.length > 0) continue;

    // Also check that at least one supply is in this category
    const hasSupplyInCategory = ctx.supplies.some((s) =>
      cat.assets.some((a) => a.symbol === s.symbol)
    );
    if (!hasSupplyInCategory) continue;

    // Build a proper userBorrows array for isEModeAvailable (needs underlyingAsset)
    const borrowsForCheck = ctx.borrows.map((b) => {
      const asset = cat.assets.find((a) => a.symbol === b.symbol);
      return {
        underlyingAsset: asset?.underlyingAsset ?? "",
        symbol: b.symbol,
      };
    });

    const { available } = isEModeAvailable(cat.id, categories, borrowsForCheck);
    if (!available) continue;

    const ltvBoost = Number(cat.ltv) - ctx.summary.currentLTV;

    opps.push({
      title: `Activate E-Mode: ${cat.label}`,
      description: `Switch to "${cat.label}" E-Mode for better capital efficiency.${ltvBoost > 0 ? ` LTV increases by ~${(ltvBoost * 100).toFixed(0)}%.` : ""}`,
      estimatedAPYImprovement: 0,
      riskLevel: "low",
      actions: [
        makeAction("set_emode", "", 0, { emodeCategoryId: cat.id }),
      ],
    });
  }

  return opps;
}

// ═══════════════════════════════════════════════════════
// Rule 3 — Supply Rate Shopping
// ═══════════════════════════════════════════════════════

function ruleSupplyRateShopping(
  ctx: PositionContext,
  categories: EmodeCategory[],
  config: ScanConfig
): YieldOpportunity[] {
  const opps: YieldOpportunity[] = [];

  for (const supply of ctx.supplies) {
    if (config.excludeSymbols.includes(supply.symbol)) continue;
    if (supply.balanceUSD < config.minAmountUSD) continue;

    const currentYield = supply.supplyAPY + supply.incentiveAPR;
    let bestCandidate: { symbol: string; yield: number; risk: RiskLevel } | null = null;

    for (const asset of ctx.availableAssets) {
      if (asset.symbol === supply.symbol) continue;
      if (config.excludeSymbols.includes(asset.symbol)) continue;
      if (!isSameClass(supply.symbol, asset.symbol, categories)) continue;

      const candidateYield = asset.supplyAPY + asset.supplyIncentiveAPR;
      const improvement = candidateYield - currentYield;

      if (improvement < config.minAPYImprovement) continue;

      const risk = operationRisk(supply.symbol, asset.symbol, categories, false);

      if (!bestCandidate || candidateYield > bestCandidate.yield) {
        bestCandidate = { symbol: asset.symbol, yield: candidateYield, risk };
      }
    }

    if (bestCandidate) {
      const improvement = bestCandidate.yield - currentYield;
      opps.push({
        title: `Switch supply: ${supply.symbol} → ${bestCandidate.symbol}`,
        description: `${bestCandidate.symbol} offers ${(bestCandidate.yield * 100).toFixed(2)}% supply APY vs ${(currentYield * 100).toFixed(2)}% on ${supply.symbol}. Same asset class, +${(improvement * 100).toFixed(2)}% improvement.`,
        estimatedAPYImprovement: (improvement * supply.balanceUSD) / ctx.summary.netWorthUSD,
        riskLevel: bestCandidate.risk,
        actions: [
          makeAction("withdraw", supply.symbol, supply.balance),
          makeAction("supply", bestCandidate.symbol, supply.balance, {
            useAsCollateral: supply.usedAsCollateral,
          }),
        ],
      });
    }
  }

  return opps;
}

// ═══════════════════════════════════════════════════════
// Rule 4 — Borrow Rate Shopping
// ═══════════════════════════════════════════════════════

function ruleBorrowRateShopping(
  ctx: PositionContext,
  categories: EmodeCategory[],
  config: ScanConfig
): YieldOpportunity[] {
  const opps: YieldOpportunity[] = [];

  for (const borrow of ctx.borrows) {
    if (config.excludeSymbols.includes(borrow.symbol)) continue;
    if (borrow.debtUSD < config.minAmountUSD) continue;

    const currentCost = borrow.borrowAPY - borrow.incentiveAPR;
    let bestCandidate: { symbol: string; cost: number; risk: RiskLevel } | null = null;

    for (const asset of ctx.availableAssets) {
      if (asset.symbol === borrow.symbol) continue;
      if (config.excludeSymbols.includes(asset.symbol)) continue;
      if (!asset.borrowingEnabled) continue;
      if (!isSameClass(borrow.symbol, asset.symbol, categories)) continue;

      const candidateCost = asset.borrowAPY - asset.borrowIncentiveAPR;
      const improvement = currentCost - candidateCost;

      if (improvement < config.minAPYImprovement) continue;

      const risk = operationRisk(borrow.symbol, asset.symbol, categories, true);

      if (!bestCandidate || candidateCost < bestCandidate.cost) {
        bestCandidate = { symbol: asset.symbol, cost: candidateCost, risk };
      }
    }

    if (bestCandidate) {
      const improvement = currentCost - bestCandidate.cost;
      opps.push({
        title: `Switch borrow: ${borrow.symbol} → ${bestCandidate.symbol}`,
        description: `${bestCandidate.symbol} costs ${(bestCandidate.cost * 100).toFixed(2)}% net borrow APY vs ${(currentCost * 100).toFixed(2)}% on ${borrow.symbol}. Same asset class, -${(improvement * 100).toFixed(2)}% cheaper.`,
        estimatedAPYImprovement: (improvement * borrow.debtUSD) / ctx.summary.netWorthUSD,
        riskLevel: bestCandidate.risk,
        actions: [
          makeAction("repay", borrow.symbol, borrow.debt),
          makeAction("borrow", bestCandidate.symbol, borrow.debt),
        ],
      });
    }
  }

  return opps;
}

// ═══════════════════════════════════════════════════════
// Rule 5 — Excess HF → Repay Debt
// ═══════════════════════════════════════════════════════

function ruleExcessHFRepay(
  ctx: PositionContext,
  categories: EmodeCategory[],
  config: ScanConfig
): YieldOpportunity[] {
  if (ctx.summary.healthFactor <= 3.0) return [];
  if (ctx.borrows.length === 0) return [];

  // Find the least profitable supply
  const eligibleSupplies = ctx.supplies
    .filter(
      (s) =>
        !config.excludeSymbols.includes(s.symbol) &&
        s.balanceUSD >= config.minAmountUSD &&
        s.usedAsCollateral
    )
    .sort((a, b) => (a.supplyAPY + a.incentiveAPR) - (b.supplyAPY + b.incentiveAPR));

  if (eligibleSupplies.length === 0) return [];
  const worstSupply = eligibleSupplies[0];

  // Find the most expensive borrow
  const eligibleBorrows = ctx.borrows
    .filter(
      (b) =>
        !config.excludeSymbols.includes(b.symbol) &&
        b.debtUSD >= config.minAmountUSD
    )
    .sort((a, b) => (b.borrowAPY - b.incentiveAPR) - (a.borrowAPY - a.incentiveAPR));

  if (eligibleBorrows.length === 0) return [];
  const worstBorrow = eligibleBorrows[0];

  // Calculate max withdrawable amount while keeping HF >= minHF + 0.5
  const targetHF = config.minHealthFactor + 0.5;
  const { totalCollateralUSD, totalBorrowsUSD, currentLiquidationThreshold } =
    ctx.summary;

  if (totalBorrowsUSD <= 0) return [];

  // HF = (totalCollateral * liquidationThreshold) / totalBorrows
  // targetHF = ((totalCollateral - withdrawUSD) * liquidationThreshold) / (totalBorrows - repayUSD)
  // For simplicity, withdrawUSD = repayUSD (we withdraw collateral to repay)
  // targetHF = ((totalCollateral - x) * liqThreshold) / (totalBorrows - x)
  // Solving: x = (totalCollateral * liqThreshold - targetHF * totalBorrows) / (liqThreshold - targetHF)

  const numerator =
    totalCollateralUSD * currentLiquidationThreshold -
    targetHF * totalBorrowsUSD;
  const denominator = currentLiquidationThreshold - targetHF;

  if (denominator >= 0) return []; // Can't maintain target HF
  const maxWithdrawUSD = Math.max(0, numerator / denominator);

  if (maxWithdrawUSD < config.minAmountUSD) return [];

  // Cap at the borrow debt and supply balance
  const amountUSD = Math.min(
    maxWithdrawUSD,
    worstBorrow.debtUSD,
    worstSupply.balanceUSD
  );

  if (amountUSD < config.minAmountUSD) return [];

  // Calculate APY improvement: we save (borrowAPY - incentive) and lose (supplyAPY + incentive)
  const borrowCostSaved = worstBorrow.borrowAPY - worstBorrow.incentiveAPR;
  const supplyYieldLost = worstSupply.supplyAPY + worstSupply.incentiveAPR;
  const netImprovement = borrowCostSaved - supplyYieldLost;

  if (netImprovement < config.minAPYImprovement) return [];

  // Calculate amounts in native tokens
  const supplyAsset = ctx.availableAssets.find(
    (a) => a.symbol === worstSupply.symbol
  );
  const borrowAsset = ctx.availableAssets.find(
    (a) => a.symbol === worstBorrow.symbol
  );

  const withdrawAmount = supplyAsset?.priceUSD
    ? amountUSD / supplyAsset.priceUSD
    : (amountUSD / worstSupply.balanceUSD) * worstSupply.balance;
  const repayAmount = borrowAsset?.priceUSD
    ? amountUSD / borrowAsset.priceUSD
    : (amountUSD / worstBorrow.debtUSD) * worstBorrow.debt;

  return [
    {
      title: `Reduce debt: withdraw ${worstSupply.symbol} → repay ${worstBorrow.symbol}`,
      description: `Health factor is ${ctx.summary.healthFactor.toFixed(1)} (excess). Withdraw $${amountUSD.toFixed(0)} of ${worstSupply.symbol} (${(supplyYieldLost * 100).toFixed(2)}% APY) to repay ${worstBorrow.symbol} (${(borrowCostSaved * 100).toFixed(2)}% cost). Net improvement: +${(netImprovement * 100).toFixed(2)}%.`,
      estimatedAPYImprovement:
        (netImprovement * amountUSD) / ctx.summary.netWorthUSD,
      riskLevel: "medium",
      actions: [
        makeAction("withdraw", worstSupply.symbol, withdrawAmount),
        makeAction("repay", worstBorrow.symbol, repayAmount),
      ],
    },
  ];
}

// ═══════════════════════════════════════════════════════
// Rule 6 — Incentive Capture
// ═══════════════════════════════════════════════════════

function ruleIncentiveCapture(
  ctx: PositionContext,
  categories: EmodeCategory[],
  config: ScanConfig
): YieldOpportunity[] {
  if (ctx.summary.availableBorrowsUSD < config.minAmountUSD) return [];

  const opps: YieldOpportunity[] = [];

  for (const asset of ctx.availableAssets) {
    if (config.excludeSymbols.includes(asset.symbol)) continue;
    if (!asset.borrowingEnabled) continue;

    // Only if incentives exceed borrow cost (net negative cost = we get paid)
    if (asset.borrowIncentiveAPR <= asset.borrowAPY) continue;

    const netYield = asset.borrowIncentiveAPR - asset.borrowAPY;
    if (netYield < config.minAPYImprovement) continue;

    // Borrow a reasonable amount (up to available borrows, capped by HF)
    const maxBorrowUSD = Math.min(
      ctx.summary.availableBorrowsUSD * 0.5, // conservative: only use half
      asset.priceUSD > 0 ? asset.priceUSD * 1e9 : Infinity // sanity cap
    );

    if (maxBorrowUSD < config.minAmountUSD) continue;

    const borrowAmount =
      asset.priceUSD > 0 ? maxBorrowUSD / asset.priceUSD : 0;
    if (borrowAmount <= 0) continue;

    opps.push({
      title: `Incentive capture: borrow ${asset.symbol}`,
      description: `${asset.symbol} pays ${(asset.borrowIncentiveAPR * 100).toFixed(2)}% incentive vs ${(asset.borrowAPY * 100).toFixed(2)}% borrow cost. Net yield: +${(netYield * 100).toFixed(2)}% on up to $${maxBorrowUSD.toFixed(0)}.`,
      estimatedAPYImprovement:
        (netYield * maxBorrowUSD) / ctx.summary.netWorthUSD,
      riskLevel: "high",
      actions: [makeAction("borrow", asset.symbol, borrowAmount)],
    });
  }

  return opps;
}

// ═══════════════════════════════════════════════════════
// Main scanner
// ═══════════════════════════════════════════════════════

export function scanYieldOpportunities(
  ctx: PositionContext,
  emodeCategories: EmodeCategory[],
  config: Partial<ScanConfig> = {}
): YieldOptimizerResponse {
  const cfg: ScanConfig = { ...DEFAULT_CONFIG, ...config };

  // Run all 6 rules independently
  const allOpps: YieldOpportunity[] = [
    ...ruleCollateralToggle(ctx, cfg),
    ...ruleEmodeActivation(ctx, emodeCategories),
    ...ruleSupplyRateShopping(ctx, emodeCategories, cfg),
    ...ruleBorrowRateShopping(ctx, emodeCategories, cfg),
    ...ruleExcessHFRepay(ctx, emodeCategories, cfg),
    ...ruleIncentiveCapture(ctx, emodeCategories, cfg),
  ];

  // Filter by risk tolerance
  const filtered = allOpps.filter((opp) =>
    riskAllowed(opp.riskLevel, cfg.riskTolerance)
  );

  // Score, sort, and truncate
  const ranked = filtered
    .sort((a, b) => scoreOpportunity(b) - scoreOpportunity(a))
    .slice(0, cfg.maxOpportunities);

  // Calculate APY
  const currentNetAPY = calculateNetAPY(ctx);
  const totalImprovement = ranked.reduce(
    (sum, opp) => sum + opp.estimatedAPYImprovement,
    0
  );

  return {
    opportunities: ranked,
    currentNetAPY,
    projectedNetAPY: currentNetAPY + totalImprovement,
    analysis:
      ranked.length > 0
        ? `Found ${ranked.length} optimization${ranked.length > 1 ? "s" : ""} for your position (${cfg.riskTolerance} mode).`
        : `No optimizations found for your position at ${cfg.riskTolerance} risk tolerance.`,
  };
}
