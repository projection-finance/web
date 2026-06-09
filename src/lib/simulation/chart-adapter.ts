/**
 * Adapts protocol-specific simulation results to the unified
 * TemporalSimulationResult format used by the Aave ProjectionChart.
 *
 * This ensures visual consistency across all protocol dashboards:
 * same slider, same day-by-day timeline, same action badges, same layout.
 */

import type {
  TemporalSimulationResult,
  DaySnapshot,
  DayAssetPrice,
  DayAssetRate,
  DaySupplyItem,
  DayBorrowItem,
  DayActionResult,
  SimulationSummary,
} from "./types";
import type { CompoundSimulationResult } from "./compound-types";
import type { MorphoBlueSimulationResult } from "./morpho-blue-types";
import type { MorphoSimulationResult } from "./morpho-types";
import type { UniswapSimulationResult } from "./uniswap-types";

const NO_INCENTIVES: DaySupplyItem["incentives"] = [];

// ── Compound V3 → TemporalSimulationResult ──

export function adaptCompoundResult(r: CompoundSimulationResult): TemporalSimulationResult {
  const timeline: DaySnapshot[] = r.timeline.map((snap) => {
    const supplies: DaySupplyItem[] = [];
    const borrows: DayBorrowItem[] = [];
    const prices: DayAssetPrice[] = [];
    const rates: DayAssetRate[] = [];

    for (const m of snap.markets) {
      if (m.baseSupplyBalanceUSD > 0) {
        supplies.push({ symbol: m.baseSymbol, balance: m.baseSupplyBalance, balanceUSD: m.baseSupplyBalanceUSD, supplyAPY: m.supplyAPY, incentiveAPR: 0, incentives: NO_INCENTIVES });
      }
      if (m.baseBorrowBalanceUSD > 0) {
        borrows.push({ symbol: m.baseSymbol, debt: m.baseBorrowBalance, debtUSD: m.baseBorrowBalanceUSD, borrowAPY: m.borrowAPY, incentiveAPR: 0, incentives: NO_INCENTIVES });
      }
      prices.push({ symbol: m.baseSymbol, priceUSD: m.basePriceUSD });
      for (const c of m.collaterals) {
        prices.push({ symbol: c.symbol, priceUSD: c.priceUSD });
      }
      rates.push({ symbol: m.baseSymbol, supplyAPY: m.supplyAPY, variableBorrowAPY: m.borrowAPY, supplyIncentiveAPR: 0, borrowIncentiveAPR: 0 });
    }

    const actions: DayActionResult[] = snap.actionsExecuted.map((a) => ({
      type: a.type, symbol: a.symbol, amount: a.amount, status: a.status, reason: a.reason,
    }));

    return {
      day: snap.day, prices, rates,
      healthFactor: snap.lowestHealthFactor === Infinity ? 999 : snap.lowestHealthFactor,
      totalCollateralUSD: snap.totalCollateralUSD,
      totalBorrowsUSD: snap.totalBorrowUSD,
      netWorthUSD: snap.netWorthUSD,
      availableBorrowsUSD: 0, currentLTV: 0, currentLiquidationThreshold: 0,
      supplies, borrows, actionsExecuted: actions, warnings: snap.warnings,
    };
  });

  const summary: SimulationSummary = {
    startNetWorth: r.summary.startNetWorth, endNetWorth: r.summary.endNetWorth,
    totalInterestEarned: r.summary.totalInterestEarned, totalInterestPaid: r.summary.totalInterestPaid,
    totalIncentivesEarnedUSD: 0,
    lowestHealthFactor: r.summary.lowestHealthFactor, lowestHealthFactorDay: r.summary.lowestHealthFactorDay,
    liquidationOccurred: r.summary.liquidationOccurred, liquidationDay: r.summary.liquidationDay,
  };

  return { timeline, summary };
}

// ── Morpho Blue → TemporalSimulationResult ──

export function adaptMorphoBlueResult(r: MorphoBlueSimulationResult): TemporalSimulationResult {
  const timeline: DaySnapshot[] = r.timeline.map((snap) => {
    const supplies: DaySupplyItem[] = [];
    const borrows: DayBorrowItem[] = [];
    const prices: DayAssetPrice[] = [];
    const rates: DayAssetRate[] = [];

    for (const m of snap.markets) {
      if (m.supplyBalanceUSD > 0) {
        supplies.push({ symbol: m.loanSymbol, balance: m.supplyBalance, balanceUSD: m.supplyBalanceUSD, supplyAPY: m.supplyAPY, incentiveAPR: 0, incentives: NO_INCENTIVES });
      }
      if (m.borrowBalanceUSD > 0) {
        borrows.push({ symbol: m.loanSymbol, debt: m.borrowBalance, debtUSD: m.borrowBalanceUSD, borrowAPY: m.borrowAPY, incentiveAPR: 0, incentives: NO_INCENTIVES });
      }
      prices.push({ symbol: m.loanSymbol, priceUSD: m.loanPriceUSD });
      prices.push({ symbol: m.collateralSymbol, priceUSD: m.collateralPriceUSD });
      rates.push({ symbol: m.loanSymbol, supplyAPY: m.supplyAPY, variableBorrowAPY: m.borrowAPY, supplyIncentiveAPR: 0, borrowIncentiveAPR: 0 });
    }

    return {
      day: snap.day, prices, rates,
      healthFactor: snap.lowestHealthFactor === Infinity ? 999 : snap.lowestHealthFactor,
      totalCollateralUSD: snap.totalCollateralUSD, totalBorrowsUSD: snap.totalBorrowUSD,
      netWorthUSD: snap.netWorthUSD, availableBorrowsUSD: 0, currentLTV: 0, currentLiquidationThreshold: 0,
      supplies, borrows,
      actionsExecuted: snap.actionsExecuted.map((a) => ({ type: a.type, symbol: a.symbol, amount: a.amount, status: a.status, reason: a.reason })),
      warnings: snap.warnings,
    };
  });

  return {
    timeline,
    summary: {
      startNetWorth: r.summary.startNetWorth, endNetWorth: r.summary.endNetWorth,
      totalInterestEarned: r.summary.totalInterestEarned, totalInterestPaid: r.summary.totalInterestPaid,
      totalIncentivesEarnedUSD: 0,
      lowestHealthFactor: r.summary.lowestHealthFactor, lowestHealthFactorDay: r.summary.lowestHealthFactorDay,
      liquidationOccurred: r.summary.liquidationOccurred, liquidationDay: r.summary.liquidationDay,
    },
  };
}

// ── Morpho Vaults → TemporalSimulationResult ──

export function adaptMorphoVaultsResult(r: MorphoSimulationResult): TemporalSimulationResult {
  const timeline: DaySnapshot[] = r.timeline.map((snap) => ({
    day: snap.day,
    prices: [],
    rates: snap.vaults.map((v): DayAssetRate => ({ symbol: v.assetSymbol, supplyAPY: v.netApy, variableBorrowAPY: 0, supplyIncentiveAPR: 0, borrowIncentiveAPR: 0 })),
    healthFactor: 999, totalCollateralUSD: 0, totalBorrowsUSD: 0,
    netWorthUSD: snap.netWorthUsd, availableBorrowsUSD: 0, currentLTV: 0, currentLiquidationThreshold: 0,
    supplies: snap.vaults.map((v): DaySupplyItem => ({ symbol: v.assetSymbol, balance: v.balanceUsd, balanceUSD: v.balanceUsd, supplyAPY: v.netApy, incentiveAPR: 0, incentives: NO_INCENTIVES })),
    borrows: [],
    actionsExecuted: snap.actionsExecuted.map((a): DayActionResult => ({ type: a.type, symbol: a.vaultAddress, amount: a.amount, status: a.status, reason: a.reason })),
    warnings: snap.warnings,
  }));

  return {
    timeline,
    summary: {
      startNetWorth: r.summary.startNetWorth, endNetWorth: r.summary.endNetWorth,
      totalInterestEarned: r.summary.totalInterestEarned, totalInterestPaid: 0,
      totalIncentivesEarnedUSD: 0, lowestHealthFactor: 999, lowestHealthFactorDay: 0, liquidationOccurred: false,
    },
  };
}

// ── Uniswap V3 → TemporalSimulationResult ──

export function adaptUniswapResult(r: UniswapSimulationResult): TemporalSimulationResult {
  const timeline: DaySnapshot[] = r.timeline.map((snap) => ({
    day: snap.day,
    prices: snap.positions.map((p): DayAssetPrice => ({ symbol: p.token0Symbol, priceUSD: p.currentPrice })),
    rates: [],
    healthFactor: 999, totalCollateralUSD: 0, totalBorrowsUSD: 0,
    netWorthUSD: snap.totalNetValueUSD, availableBorrowsUSD: 0, currentLTV: 0, currentLiquidationThreshold: 0,
    supplies: snap.positions.map((p): DaySupplyItem => ({
      symbol: `${p.token0Symbol}/${p.token1Symbol}`,
      balance: p.positionValueUSD, balanceUSD: p.netValueUSD,
      supplyAPY: p.dailyFeesUSD > 0 && p.positionValueUSD > 0 ? (p.dailyFeesUSD / p.positionValueUSD) * 365 : 0,
      incentiveAPR: 0, incentives: NO_INCENTIVES,
    })),
    borrows: [],
    actionsExecuted: snap.actionsExecuted.map((a): DayActionResult => ({ type: a.type, symbol: `pos#${a.positionIndex}`, amount: 0, status: a.status, reason: a.reason })),
    warnings: snap.warnings,
  }));

  return {
    timeline,
    summary: {
      startNetWorth: r.summary.startNetValue, endNetWorth: r.summary.endNetValue,
      totalInterestEarned: r.summary.totalFeesEarned, totalInterestPaid: Math.abs(r.summary.totalIL),
      totalIncentivesEarnedUSD: 0, lowestHealthFactor: 999, lowestHealthFactorDay: 0, liquidationOccurred: false,
    },
  };
}
