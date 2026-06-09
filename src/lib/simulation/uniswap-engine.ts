import type {
  UniswapSimulationConfig,
  UniswapEngineState,
  UniswapSimulationResult,
  UniswapDaySnapshot,
  UniswapPositionEngineEntry,
  UniswapPositionSnapshot,
  UniswapDayActionResult,
  VolumeScenario,
} from "./uniswap-types";
import { generateAllPriceSeries } from "./prices";
import {
  getAmounts,
  getLiquidityFromAmounts,
  computeIL,
  estimateDailyFees,
  isInRange,
} from "@/src/lib/uniswap/math";

// ── Volume series generator ──

function generateVolumeSeries(scenario: VolumeScenario, durationDays: number): number[] {
  const series: number[] = new Array(durationDays + 1);
  const start = scenario.startVolume;
  const from = scenario.fromDay ?? 0;

  for (let d = 0; d <= durationDays; d++) {
    if (d < from) {
      series[d] = scenario.originalVolume ?? start;
      continue;
    }

    const t = (d - from) / Math.max(1, durationDays - from);

    switch (scenario.mode) {
      case "fixed":
        series[d] = start;
        break;
      case "linear":
        series[d] = start + ((scenario.endVolume ?? start) - start) * t;
        break;
      case "sinusoidal": {
        const min = scenario.minVolume ?? start * 0.5;
        const max = scenario.maxVolume ?? start * 1.5;
        const cycle = scenario.cycleDays ?? durationDays;
        series[d] = (min + max) / 2 + ((max - min) / 2) * Math.sin((2 * Math.PI * (d - from)) / cycle);
        break;
      }
      case "manual":
        series[d] = scenario.manualVolumes?.[d] ?? start;
        break;
      default:
        series[d] = start;
    }
  }
  return series;
}

function generateAllVolumeSeries(
  scenarios: VolumeScenario[],
  durationDays: number,
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const s of scenarios) {
    result[s.poolAddress] = generateVolumeSeries(s, durationDays);
  }
  return result;
}

// ── Snapshot builder ──

function buildPositionSnapshot(pos: UniswapPositionEngineEntry): UniswapPositionSnapshot {
  const inRangeNow = isInRange(pos.currentPrice, pos.priceLower, pos.priceUpper);
  const { amount0, amount1 } = getAmounts(pos.liquidity, pos.currentPrice, pos.priceLower, pos.priceUpper);
  const posValueUSD = amount0 * pos.token0PriceUSD + amount1 * pos.token1PriceUSD;

  const { holdValue, ilAbsolute, ilPercent } = computeIL(
    pos.liquidity,
    pos.priceAtEntry,
    pos.currentPrice,
    pos.priceLower,
    pos.priceUpper,
  );
  const holdValueUSD = holdValue * (pos.token1PriceUSD || 1); // if pair is X/stablecoin

  return {
    poolAddress: pos.poolAddress,
    token0Symbol: pos.token0Symbol,
    token1Symbol: pos.token1Symbol,
    priceLower: pos.priceLower,
    priceUpper: pos.priceUpper,
    liquidity: pos.liquidity,
    currentPrice: pos.currentPrice,
    inRange: inRangeNow,
    amount0,
    amount1,
    positionValueUSD: posValueUSD,
    holdValueUSD,
    ilAbsolute: ilAbsolute * (pos.token1PriceUSD || 1),
    ilPercent,
    dailyFeesUSD: 0,
    cumulativeFeesUSD: pos.cumulativeFeesUSD,
    unclaimedFeesUSD: pos.unclaimedFeesUSD,
    netValueUSD: posValueUSD + pos.unclaimedFeesUSD,
  };
}

function buildDaySnapshot(
  day: number,
  positions: UniswapPositionEngineEntry[],
  actions: UniswapDayActionResult[],
  warnings: string[],
  dailyFees: number[],
): UniswapDaySnapshot {
  const snaps = positions.map((pos, i) => {
    const s = buildPositionSnapshot(pos);
    s.dailyFeesUSD = dailyFees[i] ?? 0;
    return s;
  });

  return {
    day,
    positions: snaps,
    totalPositionValueUSD: snaps.reduce((s, p) => s + p.positionValueUSD, 0),
    totalHoldValueUSD: snaps.reduce((s, p) => s + p.holdValueUSD, 0),
    totalILAbsolute: snaps.reduce((s, p) => s + p.ilAbsolute, 0),
    totalFeesUSD: snaps.reduce((s, p) => s + p.cumulativeFeesUSD, 0),
    totalNetValueUSD: snaps.reduce((s, p) => s + p.netValueUSD, 0),
    actionsExecuted: actions,
    warnings,
  };
}

/**
 * Run Uniswap V3 position simulation.
 *
 * Per day:
 * 1. Apply price scenarios → update currentPrice for each position's pair
 * 2. Determine in-range/out-of-range
 * 3. Apply volume scenarios → update daily volume
 * 4. Compute fee accrual (only if in-range)
 * 5. Execute scheduled actions
 * 6. Build snapshot with IL computation
 */
export function runUniswapSimulation(
  config: UniswapSimulationConfig,
  initialState: UniswapEngineState,
): UniswapSimulationResult {
  const { durationDays, priceScenarios, volumeScenarios, scheduledActions } = config;

  const positions: UniswapPositionEngineEntry[] = JSON.parse(JSON.stringify(initialState.positions));
  const priceSeries = generateAllPriceSeries(priceScenarios, durationDays);
  const volumeSeries = generateAllVolumeSeries(volumeScenarios, durationDays);
  const sortedActions = [...scheduledActions].sort((a, b) => a.day - b.day || a.orderInDay - b.orderInDay);

  const timeline: UniswapDaySnapshot[] = [];
  let totalDaysInRange = 0;
  let totalDaysOutOfRange = 0;
  let breakEvenDay: number | null = null;

  // Day 0: baseline
  timeline.push(buildDaySnapshot(0, positions, [], [], positions.map(() => 0)));

  for (let day = 1; day <= durationDays; day++) {
    const dayActions: UniswapDayActionResult[] = [];
    const warnings: string[] = [];
    const dailyFees: number[] = [];

    // 1. Apply price scenarios
    for (const pos of positions) {
      // Price scenario for the pair (use token0 symbol)
      const series = priceSeries[pos.token0Symbol];
      if (series?.[day] !== undefined) {
        pos.currentPrice = series[day];
        // Update USD prices: if token1 is stablecoin, token0PriceUSD = currentPrice
        pos.token0PriceUSD = pos.currentPrice * pos.token1PriceUSD;
      }
    }

    // 2 + 3. Volume + Fee accrual
    for (const pos of positions) {
      const inRangeNow = isInRange(pos.currentPrice, pos.priceLower, pos.priceUpper);

      // Update volume from scenario
      const volSeries = volumeSeries[pos.poolAddress];
      if (volSeries?.[day] !== undefined) {
        pos.dailyVolumeUSD = volSeries[day];
      }

      // Fee accrual
      const fees = estimateDailyFees(
        pos.dailyVolumeUSD,
        pos.feeTier,
        pos.liquidity,
        pos.totalActiveLiquidity,
        inRangeNow,
      );
      pos.cumulativeFeesUSD += fees;
      pos.unclaimedFeesUSD += fees;
      dailyFees.push(fees);

      if (inRangeNow) totalDaysInRange++;
      else totalDaysOutOfRange++;
    }

    // 4. Execute actions
    const todayActions = sortedActions.filter((a) => a.day === day);
    for (const action of todayActions) {
      const posIdx = action.positionIndex;

      if (action.type === "createPosition") {
        if (!action.priceLower || !action.priceUpper || !action.amount0 || !action.amount1) {
          dayActions.push({ type: "createPosition", positionIndex: posIdx, status: "skipped", reason: "Missing parameters" });
          continue;
        }
        // Use the first position's pool data as template, or defaults
        const template = positions[0];
        const price = template?.currentPrice ?? 1;
        const L = getLiquidityFromAmounts(action.amount0, action.amount1, price, action.priceLower, action.priceUpper);
        positions.push({
          poolAddress: template?.poolAddress ?? "sandbox",
          token0Symbol: template?.token0Symbol ?? "TOKEN0",
          token1Symbol: template?.token1Symbol ?? "TOKEN1",
          feeTier: template?.feeTier ?? 0.003,
          priceLower: action.priceLower,
          priceUpper: action.priceUpper,
          liquidity: L,
          currentPrice: price,
          token0PriceUSD: template?.token0PriceUSD ?? price,
          token1PriceUSD: template?.token1PriceUSD ?? 1,
          totalActiveLiquidity: template?.totalActiveLiquidity ?? L * 100,
          dailyVolumeUSD: template?.dailyVolumeUSD ?? 1_000_000,
          cumulativeFeesUSD: 0,
          cumulativeFees0: 0,
          cumulativeFees1: 0,
          unclaimedFeesUSD: 0,
          priceAtEntry: price,
        });
        dailyFees.push(0);
        dayActions.push({ type: "createPosition", positionIndex: positions.length - 1, status: "success", detail: `L=${L.toFixed(0)} range=[${action.priceLower}, ${action.priceUpper}]` });
        continue;
      }

      const pos = positions[posIdx];
      if (!pos) {
        dayActions.push({ type: action.type, positionIndex: posIdx, status: "skipped", reason: "Position not found" });
        continue;
      }

      switch (action.type) {
        case "addLiquidity": {
          const a0 = action.addAmount0 ?? 0;
          const a1 = action.addAmount1 ?? 0;
          const addL = getLiquidityFromAmounts(a0, a1, pos.currentPrice, pos.priceLower, pos.priceUpper);
          pos.liquidity += addL;
          dayActions.push({ type: "addLiquidity", positionIndex: posIdx, status: "success", detail: `+${addL.toFixed(0)} L` });
          break;
        }
        case "removeLiquidity": {
          const pct = (action.liquidityPercent ?? 100) / 100;
          const removeL = pos.liquidity * pct;
          pos.liquidity -= removeL;
          dayActions.push({ type: "removeLiquidity", positionIndex: posIdx, status: "success", detail: `${(pct * 100).toFixed(0)}% removed` });
          break;
        }
        case "collectFees": {
          const collected = pos.unclaimedFeesUSD;
          pos.unclaimedFeesUSD = 0;
          dayActions.push({ type: "collectFees", positionIndex: posIdx, status: "success", detail: `$${collected.toFixed(2)}` });
          break;
        }
        case "closePosition": {
          pos.unclaimedFeesUSD = 0;
          pos.liquidity = 0;
          dayActions.push({ type: "closePosition", positionIndex: posIdx, status: "success" });
          break;
        }
      }
    }

    // Build snapshot
    timeline.push(buildDaySnapshot(day, positions, dayActions, warnings, dailyFees));

    // Check break-even
    if (breakEvenDay === null) {
      const snap = timeline[timeline.length - 1];
      if (snap.totalFeesUSD > Math.abs(snap.totalILAbsolute) && snap.totalILAbsolute < 0) {
        breakEvenDay = day;
      }
    }
  }

  const start = timeline[0];
  const end = timeline[timeline.length - 1];

  return {
    timeline,
    summary: {
      startNetValue: start.totalNetValueUSD,
      endNetValue: end.totalNetValueUSD,
      totalFeesEarned: end.totalFeesUSD,
      totalIL: end.totalILAbsolute,
      netPnL: end.totalNetValueUSD - start.totalNetValueUSD,
      daysInRange: totalDaysInRange,
      daysOutOfRange: totalDaysOutOfRange,
      breakEvenDay,
    },
  };
}
