import type {
  MorphoBlueSimulationConfig,
  MorphoBlueEngineState,
  MorphoBlueSimulationResult,
  MorphoBlueDaySnapshot,
  MorphoBlueMarketEngineEntry,
  MorphoBlueMarketSnapshot,
  MorphoBlueDayActionResult,
  MorphoBlueRateScenario,
} from "./morpho-blue-types";
import { generateAllPriceSeries } from "./prices";
import { generateRateSeries } from "./rates";
import type { RateScenario } from "./types";

function generateBlueRateSeries(
  scenarios: MorphoBlueRateScenario[],
  durationDays: number,
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const s of scenarios) {
    const adapted: RateScenario = {
      symbol: `${s.uniqueKey}:${s.rateType}`,
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

function computeHF(m: MorphoBlueMarketEngineEntry): number {
  if (m.borrowBalance <= 0) return Infinity;
  const borrowUSD = m.borrowBalance * m.loanPriceUSD;
  const collateralUSD = m.collateralBalance * m.collateralPriceUSD;
  return borrowUSD > 0 ? (collateralUSD * m.lltv) / borrowUSD : Infinity;
}

function buildSnapshot(
  day: number,
  markets: MorphoBlueMarketEngineEntry[],
  actions: MorphoBlueDayActionResult[],
  warnings: string[],
): MorphoBlueDaySnapshot {
  const snaps: MorphoBlueMarketSnapshot[] = markets.map((m) => ({
    uniqueKey: m.uniqueKey,
    loanSymbol: m.loanSymbol,
    collateralSymbol: m.collateralSymbol,
    lltv: m.lltv,
    loanPriceUSD: m.loanPriceUSD,
    collateralPriceUSD: m.collateralPriceUSD,
    supplyBalance: m.supplyBalance,
    supplyBalanceUSD: m.supplyBalance * m.loanPriceUSD,
    borrowBalance: m.borrowBalance,
    borrowBalanceUSD: m.borrowBalance * m.loanPriceUSD,
    collateralBalance: m.collateralBalance,
    collateralBalanceUSD: m.collateralBalance * m.collateralPriceUSD,
    supplyAPY: m.supplyAPY,
    borrowAPY: m.borrowAPY,
    healthFactor: computeHF(m),
    interestEarned: m.cumulativeInterestEarned,
    interestPaid: m.cumulativeInterestPaid,
  }));

  const totalSupplyUSD = snaps.reduce((s, m) => s + m.supplyBalanceUSD, 0);
  const totalBorrowUSD = snaps.reduce((s, m) => s + m.borrowBalanceUSD, 0);
  const totalCollateralUSD = snaps.reduce((s, m) => s + m.collateralBalanceUSD, 0);
  const hfs = snaps.filter((m) => m.borrowBalanceUSD > 0).map((m) => m.healthFactor);

  return {
    day,
    markets: snaps,
    totalSupplyUSD,
    totalBorrowUSD,
    totalCollateralUSD,
    netWorthUSD: totalSupplyUSD + totalCollateralUSD - totalBorrowUSD,
    lowestHealthFactor: hfs.length > 0 ? Math.min(...hfs) : Infinity,
    actionsExecuted: actions,
    warnings,
  };
}

/**
 * Run Morpho Blue simulation. Per day:
 * 1. Apply rate scenarios
 * 2. Accrue interest (supply earns, borrow grows, collateral does NOTHING)
 * 3. Apply price scenarios
 * 4. Execute actions
 * 5. Check health factor
 */
export function runMorphoBlueSimulation(
  config: MorphoBlueSimulationConfig,
  initialState: MorphoBlueEngineState,
): MorphoBlueSimulationResult {
  const { durationDays, priceScenarios, rateScenarios, scheduledActions } = config;

  const markets: MorphoBlueMarketEngineEntry[] = JSON.parse(JSON.stringify(initialState.markets));
  const priceSeries = generateAllPriceSeries(priceScenarios, durationDays);
  const rateSeries = generateBlueRateSeries(rateScenarios, durationDays);
  const sortedActions = [...scheduledActions].sort((a, b) => a.day - b.day || a.orderInDay - b.orderInDay);

  const timeline: MorphoBlueDaySnapshot[] = [];
  let lowestHF = Infinity;
  let lowestHFDay = 0;
  let liquidationOccurred = false;
  let liquidationDay: number | undefined;

  timeline.push(buildSnapshot(0, markets, [], []));

  for (let day = 1; day <= durationDays; day++) {
    const dayActions: MorphoBlueDayActionResult[] = [];
    const warnings: string[] = [];

    // 1. Apply rate scenarios
    for (const m of markets) {
      const supplyKey = `${m.uniqueKey}:supply`;
      const borrowKey = `${m.uniqueKey}:borrow`;
      if (rateSeries[supplyKey]?.[day] !== undefined) m.supplyAPY = rateSeries[supplyKey][day];
      if (rateSeries[borrowKey]?.[day] !== undefined) m.borrowAPY = rateSeries[borrowKey][day];
    }

    // 2. Accrue interest
    for (const m of markets) {
      if (m.supplyBalance > 0) {
        const dailyRate = Math.pow(1 + m.supplyAPY, 1 / 365) - 1;
        const interest = m.supplyBalance * dailyRate;
        m.supplyBalance += interest;
        m.cumulativeInterestEarned += interest * m.loanPriceUSD;
      }
      if (m.borrowBalance > 0) {
        const dailyRate = Math.pow(1 + m.borrowAPY, 1 / 365) - 1;
        const interest = m.borrowBalance * dailyRate;
        m.borrowBalance += interest;
        m.cumulativeInterestPaid += interest * m.loanPriceUSD;
      }
    }

    // 3. Apply price scenarios
    for (const m of markets) {
      const loanSeries = priceSeries[m.loanSymbol];
      if (loanSeries?.[day] !== undefined) m.loanPriceUSD = loanSeries[day];
      const collSeries = priceSeries[m.collateralSymbol];
      if (collSeries?.[day] !== undefined) m.collateralPriceUSD = collSeries[day];
    }

    // 4. Execute actions
    const todayActions = sortedActions.filter((a) => a.day === day);
    for (const action of todayActions) {
      const m = markets.find((mk) => mk.uniqueKey === action.uniqueKey);
      if (!m) {
        dayActions.push({ type: action.type, uniqueKey: action.uniqueKey, symbol: action.symbol, amount: action.amount, status: "skipped", reason: "Market not found" });
        continue;
      }

      switch (action.type) {
        case "supply":
          if (m.borrowBalance > 0) {
            const repay = Math.min(m.borrowBalance, action.amount);
            m.borrowBalance -= repay;
            const remaining = action.amount - repay;
            if (remaining > 0) m.supplyBalance += remaining;
          } else {
            m.supplyBalance += action.amount;
          }
          dayActions.push({ type: "supply", uniqueKey: m.uniqueKey, symbol: m.loanSymbol, amount: action.amount, status: "success" });
          break;
        case "withdraw":
          if (action.amount > m.supplyBalance) {
            dayActions.push({ type: "withdraw", uniqueKey: m.uniqueKey, symbol: m.loanSymbol, amount: action.amount, status: "skipped", reason: "Insufficient supply" });
          } else {
            m.supplyBalance -= action.amount;
            dayActions.push({ type: "withdraw", uniqueKey: m.uniqueKey, symbol: m.loanSymbol, amount: action.amount, status: "success" });
          }
          break;
        case "borrow":
          if (m.supplyBalance > 0) {
            const withdraw = Math.min(m.supplyBalance, action.amount);
            m.supplyBalance -= withdraw;
            const remaining = action.amount - withdraw;
            if (remaining > 0) m.borrowBalance += remaining;
          } else {
            m.borrowBalance += action.amount;
          }
          dayActions.push({ type: "borrow", uniqueKey: m.uniqueKey, symbol: m.loanSymbol, amount: action.amount, status: "success" });
          break;
        case "repay": {
          const repay = Math.min(m.borrowBalance, action.amount);
          m.borrowBalance -= repay;
          dayActions.push({ type: "repay", uniqueKey: m.uniqueKey, symbol: m.loanSymbol, amount: repay, status: "success" });
          break;
        }
        case "supplyCollateral":
          m.collateralBalance += action.amount;
          dayActions.push({ type: "supplyCollateral", uniqueKey: m.uniqueKey, symbol: m.collateralSymbol, amount: action.amount, status: "success" });
          break;
        case "withdrawCollateral":
          if (action.amount > m.collateralBalance) {
            dayActions.push({ type: "withdrawCollateral", uniqueKey: m.uniqueKey, symbol: m.collateralSymbol, amount: action.amount, status: "skipped", reason: "Insufficient collateral" });
          } else {
            m.collateralBalance -= action.amount;
            dayActions.push({ type: "withdrawCollateral", uniqueKey: m.uniqueKey, symbol: m.collateralSymbol, amount: action.amount, status: "success" });
          }
          break;
      }
    }

    // 5. Check health factors
    for (const m of markets) {
      const hf = computeHF(m);
      if (hf < lowestHF) { lowestHF = hf; lowestHFDay = day; }
      if (hf < 1 && !liquidationOccurred) {
        liquidationOccurred = true;
        liquidationDay = day;
        warnings.push(`Liquidation risk: ${m.loanSymbol}/${m.collateralSymbol} HF ${hf.toFixed(3)} < 1.0`);
      }
    }

    timeline.push(buildSnapshot(day, markets, dayActions, warnings));
  }

  const startNetWorth = timeline[0].netWorthUSD;
  const endNetWorth = timeline[timeline.length - 1].netWorthUSD;

  return {
    timeline,
    summary: {
      startNetWorth,
      endNetWorth,
      totalInterestEarned: markets.reduce((s, m) => s + m.cumulativeInterestEarned, 0),
      totalInterestPaid: markets.reduce((s, m) => s + m.cumulativeInterestPaid, 0),
      lowestHealthFactor: lowestHF === Infinity ? 999 : lowestHF,
      lowestHealthFactorDay: lowestHFDay,
      liquidationOccurred,
      liquidationDay,
    },
  };
}
