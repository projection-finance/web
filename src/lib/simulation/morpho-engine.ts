import {
  MorphoSimulationConfig,
  MorphoEngineState,
  MorphoSimulationResult,
  MorphoDaySnapshot,
  MorphoVaultEngineEntry,
  MorphoDayActionResult,
  MorphoRateScenario,
} from "./morpho-types";
import { generateAllPriceSeries } from "./prices";
import { generateRateSeries } from "./rates";
import type { RateScenario } from "./types";

/**
 * Generate rate series for Morpho vault scenarios.
 * Adapts MorphoRateScenario to the existing generateRateSeries function.
 */
function generateMorphoRateSeries(
  scenarios: MorphoRateScenario[],
  durationDays: number
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const scenario of scenarios) {
    // Adapt to RateScenario interface for reuse
    const adapted: RateScenario = {
      symbol: scenario.vaultAddress,
      rateType: "supply",
      mode: scenario.mode,
      startRate: scenario.startRate,
      endRate: scenario.endRate,
      manualRates: scenario.manualRates,
      minRate: scenario.minRate,
      maxRate: scenario.maxRate,
      cycleDays: scenario.cycleDays,
      fromDay: scenario.fromDay,
      originalRate: scenario.originalRate,
    };
    result[scenario.vaultAddress] = generateRateSeries(adapted, durationDays);
  }
  return result;
}

function buildSnapshot(
  day: number,
  vaults: MorphoVaultEngineEntry[],
  actions: MorphoDayActionResult[],
  warnings: string[]
): MorphoDaySnapshot {
  const totalDepositedUsd = vaults.reduce((s, v) => s + v.balanceUsd, 0);
  const totalInterestEarnedUsd = vaults.reduce((s, v) => s + v.cumulativeInterestUsd, 0);

  return {
    day,
    totalDepositedUsd,
    totalInterestEarnedUsd,
    netWorthUsd: totalDepositedUsd,
    vaults: vaults.map((v) => ({
      vaultAddress: v.vaultAddress,
      vaultName: v.vaultName,
      assetSymbol: v.assetSymbol,
      balanceUsd: v.balanceUsd,
      netApy: v.netApy,
      interestEarnedUsd: v.cumulativeInterestUsd,
    })),
    actionsExecuted: actions,
    warnings,
  };
}

/**
 * Run a Morpho vault simulation.
 *
 * For each day:
 *   1. Apply rate scenarios → update vault netApy
 *   2. Compound interest: balanceUsd += balanceUsd × dailyRate
 *   3. Apply price scenarios → scale balanceUsd proportionally
 *   4. Execute scheduled actions (deposit/withdraw)
 *   5. Build snapshot
 */
export function runMorphoSimulation(
  config: MorphoSimulationConfig,
  initialState: MorphoEngineState
): MorphoSimulationResult {
  const { durationDays, priceScenarios, rateScenarios, scheduledActions } = config;

  // Deep clone to avoid mutation
  const vaults: MorphoVaultEngineEntry[] = JSON.parse(JSON.stringify(initialState.vaults));

  // Pre-generate series
  const priceSeries = generateAllPriceSeries(priceScenarios, durationDays);
  const rateSeries = generateMorphoRateSeries(rateScenarios, durationDays);

  // Sort actions
  const sortedActions = [...scheduledActions].sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay
  );

  // Track previous prices for proportional scaling
  const prevPrices: Record<string, number> = {};
  for (const v of vaults) {
    prevPrices[v.assetSymbol] = v.priceUsd;
  }

  const timeline: MorphoDaySnapshot[] = [];

  // Day 0: baseline snapshot
  timeline.push(buildSnapshot(0, vaults, [], []));

  for (let day = 1; day <= durationDays; day++) {
    const dayActions: MorphoDayActionResult[] = [];
    const warnings: string[] = [];

    // 1. Apply rate scenarios
    for (const vault of vaults) {
      const series = rateSeries[vault.vaultAddress];
      if (series && series[day] !== undefined) {
        vault.netApy = series[day];
      }
    }

    // 2. Compound interest
    for (const vault of vaults) {
      if (vault.balanceUsd <= 0) continue;
      const dailyRate = Math.pow(1 + vault.netApy, 1 / 365) - 1;
      const interest = vault.balanceUsd * dailyRate;
      vault.balanceUsd += interest;
      vault.cumulativeInterestUsd += interest;
    }

    // 3. Apply price scenarios (proportional scaling)
    for (const vault of vaults) {
      const series = priceSeries[vault.assetSymbol];
      if (series && series[day] !== undefined) {
        const newPrice = series[day];
        const oldPrice = prevPrices[vault.assetSymbol] || vault.priceUsd;
        if (oldPrice > 0 && newPrice !== oldPrice) {
          const ratio = newPrice / oldPrice;
          vault.balanceUsd *= ratio;
          // Scale cumulative interest proportionally too
          vault.cumulativeInterestUsd *= ratio;
        }
        vault.priceUsd = newPrice;
        prevPrices[vault.assetSymbol] = newPrice;
      }
    }

    // 4. Execute scheduled actions
    const todayActions = sortedActions.filter((a) => a.day === day);
    for (const action of todayActions) {
      const vault = vaults.find((v) => v.vaultAddress === action.vaultAddress);
      if (!vault) {
        dayActions.push({
          type: action.type,
          vaultAddress: action.vaultAddress,
          amount: action.amount,
          status: "skipped",
          reason: "Vault not found",
        });
        continue;
      }

      if (action.type === "deposit") {
        vault.balanceUsd += action.amount;
        dayActions.push({
          type: "deposit",
          vaultAddress: action.vaultAddress,
          amount: action.amount,
          status: "success",
        });
      } else if (action.type === "withdraw") {
        if (action.amount > vault.balanceUsd) {
          warnings.push(
            `Withdraw $${action.amount.toFixed(2)} exceeds balance $${vault.balanceUsd.toFixed(2)} in ${vault.vaultName}`
          );
          dayActions.push({
            type: "withdraw",
            vaultAddress: action.vaultAddress,
            amount: action.amount,
            status: "skipped",
            reason: "Insufficient balance",
          });
        } else {
          vault.balanceUsd -= action.amount;
          dayActions.push({
            type: "withdraw",
            vaultAddress: action.vaultAddress,
            amount: action.amount,
            status: "success",
          });
        }
      }
    }

    // 5. Build snapshot
    timeline.push(buildSnapshot(day, vaults, dayActions, warnings));
  }

  // Summary
  const startNetWorth = timeline[0].netWorthUsd;
  const endNetWorth = timeline[timeline.length - 1].netWorthUsd;
  const totalInterestEarned = vaults.reduce((s, v) => s + v.cumulativeInterestUsd, 0);
  const totalBalance = vaults.reduce((s, v) => s + v.balanceUsd, 0);
  const avgApy =
    totalBalance > 0
      ? vaults.reduce((s, v) => s + v.netApy * v.balanceUsd, 0) / totalBalance
      : 0;

  return {
    timeline,
    summary: {
      startNetWorth,
      endNetWorth,
      totalInterestEarned,
      avgApy,
    },
  };
}
