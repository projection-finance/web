import type {
  CompoundSimulationConfig,
  CompoundEngineState,
  CompoundSimulationResult,
  CompoundDaySnapshot,
  CompoundMarketEngineEntry,
  CompoundMarketSnapshot,
  CompoundDayActionResult,
  CompoundRateScenario,
} from "./compound-types";
import { generateAllPriceSeries } from "./prices";
import { generateRateSeries } from "./rates";
import type { RateScenario } from "./types";

/**
 * Convert CompoundRateScenarios to rate series.
 * Key: "marketId:supply" or "marketId:borrow"
 */
function generateCompoundRateSeries(
  scenarios: CompoundRateScenario[],
  durationDays: number,
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const s of scenarios) {
    const adapted: RateScenario = {
      symbol: `${s.marketId}:${s.rateType}`,
      rateType: s.rateType,
      mode: s.mode,
      startRate: s.startRate,
      endRate: s.endRate,
      manualRates: s.manualRates,
      minRate: s.minRate,
      maxRate: s.maxRate,
      cycleDays: s.cycleDays,
      fromDay: s.fromDay,
      originalRate: s.originalRate,
    };
    result[adapted.symbol] = generateRateSeries(adapted, durationDays);
  }
  return result;
}

function computeMarketHF(market: CompoundMarketEngineEntry): number {
  if (market.baseBorrowBalance <= 0) return Infinity;
  const liquidationRisk = market.collaterals.reduce(
    (s, c) => s + c.balance * c.priceUSD * c.liquidateCollateralFactor,
    0,
  );
  const borrowUSD = market.baseBorrowBalance * market.basePriceUSD;
  return borrowUSD > 0 ? liquidationRisk / borrowUSD : Infinity;
}

function computeBorrowCapacity(market: CompoundMarketEngineEntry): number {
  const capacity = market.collaterals.reduce(
    (s, c) => s + c.balance * c.priceUSD * c.borrowCollateralFactor,
    0,
  );
  return capacity - market.baseBorrowBalance * market.basePriceUSD;
}

function buildSnapshot(
  day: number,
  markets: CompoundMarketEngineEntry[],
  actions: CompoundDayActionResult[],
  warnings: string[],
): CompoundDaySnapshot {
  const marketSnapshots: CompoundMarketSnapshot[] = markets.map((m) => ({
    marketId: m.marketId,
    baseSymbol: m.baseSymbol,
    basePriceUSD: m.basePriceUSD,
    baseSupplyBalance: m.baseSupplyBalance,
    baseSupplyBalanceUSD: m.baseSupplyBalance * m.basePriceUSD,
    baseBorrowBalance: m.baseBorrowBalance,
    baseBorrowBalanceUSD: m.baseBorrowBalance * m.basePriceUSD,
    supplyAPY: m.supplyAPY,
    borrowAPY: m.borrowAPY,
    healthFactor: computeMarketHF(m),
    borrowCapacityUSD: computeBorrowCapacity(m),
    collaterals: m.collaterals.map((c) => ({
      symbol: c.symbol,
      balance: c.balance,
      balanceUSD: c.balance * c.priceUSD,
      priceUSD: c.priceUSD,
    })),
    interestEarned: m.cumulativeInterestEarned,
    interestPaid: m.cumulativeInterestPaid,
  }));

  const totalSupplyUSD = marketSnapshots.reduce(
    (s, m) => s + m.baseSupplyBalanceUSD,
    0,
  );
  const totalBorrowUSD = marketSnapshots.reduce(
    (s, m) => s + m.baseBorrowBalanceUSD,
    0,
  );
  const totalCollateralUSD = marketSnapshots.reduce(
    (s, m) => s + m.collaterals.reduce((cs, c) => cs + c.balanceUSD, 0),
    0,
  );

  const healthFactors = marketSnapshots
    .filter((m) => m.baseBorrowBalanceUSD > 0)
    .map((m) => m.healthFactor);
  const lowestHF =
    healthFactors.length > 0 ? Math.min(...healthFactors) : Infinity;

  return {
    day,
    markets: marketSnapshots,
    totalSupplyUSD,
    totalBorrowUSD,
    totalCollateralUSD,
    netWorthUSD: totalSupplyUSD + totalCollateralUSD - totalBorrowUSD,
    lowestHealthFactor: lowestHF,
    actionsExecuted: actions,
    warnings,
  };
}

/**
 * Run Compound V3 simulation.
 *
 * Per day:
 * 1. Apply rate scenarios → update supply/borrow APY
 * 2. Accrue interest on base asset (supply earns, borrow grows)
 *    Collateral does NOT earn interest
 * 3. Apply price scenarios → update base + collateral prices
 * 4. Execute scheduled actions
 * 5. Check health factor
 * 6. Build snapshot
 */
export function runCompoundSimulation(
  config: CompoundSimulationConfig,
  initialState: CompoundEngineState,
): CompoundSimulationResult {
  const { durationDays, priceScenarios, rateScenarios, scheduledActions } =
    config;

  // Deep clone
  const markets: CompoundMarketEngineEntry[] = JSON.parse(
    JSON.stringify(initialState.markets),
  );

  // Pre-generate series
  const priceSeries = generateAllPriceSeries(priceScenarios, durationDays);
  const rateSeries = generateCompoundRateSeries(rateScenarios, durationDays);

  const sortedActions = [...scheduledActions].sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay,
  );

  const timeline: CompoundDaySnapshot[] = [];
  let lowestHF = Infinity;
  let lowestHFDay = 0;
  let liquidationOccurred = false;
  let liquidationDay: number | undefined;

  // Day 0: baseline
  timeline.push(buildSnapshot(0, markets, [], []));

  for (let day = 1; day <= durationDays; day++) {
    const dayActions: CompoundDayActionResult[] = [];
    const warnings: string[] = [];

    // 1. Apply rate scenarios
    for (const m of markets) {
      const supplyKey = `${m.marketId}:supply`;
      const borrowKey = `${m.marketId}:borrow`;
      if (rateSeries[supplyKey]?.[day] !== undefined) {
        m.supplyAPY = rateSeries[supplyKey][day];
      }
      if (rateSeries[borrowKey]?.[day] !== undefined) {
        m.borrowAPY = rateSeries[borrowKey][day];
      }
    }

    // 2. Accrue interest on base asset
    for (const m of markets) {
      if (m.baseSupplyBalance > 0) {
        const dailyRate = Math.pow(1 + m.supplyAPY, 1 / 365) - 1;
        const interest = m.baseSupplyBalance * dailyRate;
        m.baseSupplyBalance += interest;
        m.cumulativeInterestEarned += interest * m.basePriceUSD;
      }
      if (m.baseBorrowBalance > 0) {
        const dailyRate = Math.pow(1 + m.borrowAPY, 1 / 365) - 1;
        const interest = m.baseBorrowBalance * dailyRate;
        m.baseBorrowBalance += interest;
        m.cumulativeInterestPaid += interest * m.basePriceUSD;
      }
      // Collateral does NOT accrue interest
    }

    // 3. Apply price scenarios
    for (const m of markets) {
      // Base asset price
      const baseSeries = priceSeries[m.baseSymbol];
      if (baseSeries?.[day] !== undefined) {
        m.basePriceUSD = baseSeries[day];
      }
      // Collateral prices
      for (const c of m.collaterals) {
        const collSeries = priceSeries[c.symbol];
        if (collSeries?.[day] !== undefined) {
          c.priceUSD = collSeries[day];
        }
      }
    }

    // 4. Execute scheduled actions
    const todayActions = sortedActions.filter((a) => a.day === day);
    for (const action of todayActions) {
      const m = markets.find((mk) => mk.marketId === action.marketId);
      if (!m) {
        dayActions.push({
          type: action.type,
          marketId: action.marketId,
          symbol: action.symbol,
          amount: action.amount,
          status: "skipped",
          reason: "Market not found",
        });
        continue;
      }

      switch (action.type) {
        case "supply": {
          // If borrowing, repay first
          if (m.baseBorrowBalance > 0) {
            const repayAmount = Math.min(m.baseBorrowBalance, action.amount);
            m.baseBorrowBalance -= repayAmount;
            const remaining = action.amount - repayAmount;
            if (remaining > 0) m.baseSupplyBalance += remaining;
          } else {
            m.baseSupplyBalance += action.amount;
          }
          dayActions.push({ type: "supply", marketId: m.marketId, symbol: m.baseSymbol, amount: action.amount, status: "success" });
          break;
        }
        case "withdraw": {
          if (action.amount > m.baseSupplyBalance) {
            dayActions.push({ type: "withdraw", marketId: m.marketId, symbol: m.baseSymbol, amount: action.amount, status: "skipped", reason: "Insufficient supply" });
            warnings.push(`Withdraw ${action.amount} ${m.baseSymbol} exceeds supply ${m.baseSupplyBalance.toFixed(4)}`);
          } else {
            m.baseSupplyBalance -= action.amount;
            dayActions.push({ type: "withdraw", marketId: m.marketId, symbol: m.baseSymbol, amount: action.amount, status: "success" });
          }
          break;
        }
        case "borrow": {
          // If supplying, withdraw first
          if (m.baseSupplyBalance > 0) {
            const withdrawAmount = Math.min(m.baseSupplyBalance, action.amount);
            m.baseSupplyBalance -= withdrawAmount;
            const remaining = action.amount - withdrawAmount;
            if (remaining > 0) m.baseBorrowBalance += remaining;
          } else {
            m.baseBorrowBalance += action.amount;
          }
          dayActions.push({ type: "borrow", marketId: m.marketId, symbol: m.baseSymbol, amount: action.amount, status: "success" });
          break;
        }
        case "repay": {
          const repayAmount = Math.min(m.baseBorrowBalance, action.amount);
          m.baseBorrowBalance -= repayAmount;
          dayActions.push({ type: "repay", marketId: m.marketId, symbol: m.baseSymbol, amount: repayAmount, status: "success" });
          break;
        }
        case "supplyCollateral": {
          const coll = m.collaterals.find((c) => c.symbol === action.symbol);
          if (coll) {
            coll.balance += action.amount;
          } else {
            // Add new collateral entry
            m.collaterals.push({
              symbol: action.symbol,
              address: "",
              balance: action.amount,
              priceUSD: priceSeries[action.symbol]?.[day] ?? 1,
              borrowCollateralFactor: 0.8,
              liquidateCollateralFactor: 0.85,
            });
          }
          dayActions.push({ type: "supplyCollateral", marketId: m.marketId, symbol: action.symbol, amount: action.amount, status: "success" });
          break;
        }
        case "withdrawCollateral": {
          const coll = m.collaterals.find((c) => c.symbol === action.symbol);
          if (!coll || coll.balance < action.amount) {
            dayActions.push({ type: "withdrawCollateral", marketId: m.marketId, symbol: action.symbol, amount: action.amount, status: "skipped", reason: "Insufficient collateral" });
          } else {
            coll.balance -= action.amount;
            dayActions.push({ type: "withdrawCollateral", marketId: m.marketId, symbol: action.symbol, amount: action.amount, status: "success" });
          }
          break;
        }
      }
    }

    // 5. Check health factors
    for (const m of markets) {
      const hf = computeMarketHF(m);
      if (hf < lowestHF) {
        lowestHF = hf;
        lowestHFDay = day;
      }
      if (hf < 1 && !liquidationOccurred) {
        liquidationOccurred = true;
        liquidationDay = day;
        warnings.push(
          `Liquidation risk: ${m.baseSymbol} market health factor ${hf.toFixed(3)} < 1.0`,
        );
      }
    }

    // 6. Build snapshot
    timeline.push(buildSnapshot(day, markets, dayActions, warnings));
  }

  // Summary
  const startNetWorth = timeline[0].netWorthUSD;
  const endNetWorth = timeline[timeline.length - 1].netWorthUSD;
  const totalInterestEarned = markets.reduce(
    (s, m) => s + m.cumulativeInterestEarned,
    0,
  );
  const totalInterestPaid = markets.reduce(
    (s, m) => s + m.cumulativeInterestPaid,
    0,
  );

  return {
    timeline,
    summary: {
      startNetWorth,
      endNetWorth,
      totalInterestEarned,
      totalInterestPaid,
      lowestHealthFactor: lowestHF === Infinity ? 999 : lowestHF,
      lowestHealthFactorDay: lowestHFDay,
      liquidationOccurred,
      liquidationDay,
    },
  };
}
