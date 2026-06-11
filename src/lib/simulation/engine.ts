import BigNumber from "bignumber.js";
import {
  TemporalSimulationConfig,
  TemporalSimulationResult,
  DaySnapshot,
  DayAssetPrice,
  DayAssetRate,
  DaySupplyItem,
  DayBorrowItem,
  DayActionResult,
  SimulationSummary,
  EngineState,
  ScheduledAction,
  IncentiveDetail,
  LiquidationEvent,
} from "./types";
import { generateAllPriceSeries } from "./prices";
import { generateAllRateSeries } from "./rates";
import {
  recalculatePosition,
  applyPriceChange,
  applySupply,
  applyBorrow,
  applyRepay,
  applyWithdraw,
} from "@/src/lib/aave/calculator";
import { calculateRatesForReserve } from "@/src/lib/aave/rates";
import { FormattedReserve, MerklIncentiveData, RawUserReserve } from "@/src/lib/aave/types";

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_YEAR = 31536000;

/**
 * Deep clone helper for mutable state.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Advance the interest indices on formattedPoolReserves by one day.
 *
 * AAVE's formatUserSummary uses `currentTimestamp` together with the reserve's
 * `lastUpdateTimestamp`, `liquidityIndex`, and `liquidityRate` to compute
 * normalized income internally. To simulate day-by-day progression, we advance
 * the `lastUpdateTimestamp` by one day and compound the indices ourselves.
 *
 * newLiquidityIndex = oldIndex * (1 + liquidityRate / RAY * SECONDS_PER_DAY / SECONDS_PER_YEAR)
 * newVariableBorrowIndex = oldIndex * (1 + variableBorrowRate / RAY * SECONDS_PER_DAY / SECONDS_PER_YEAR)
 *
 * This is a linear approximation of the actual compound formula. For daily steps,
 * this is a very close approximation.
 */
function accrueInterest(
  reserves: FormattedReserve[],
  secondsElapsed: number
): FormattedReserve[] {
  const RAY = new BigNumber("1000000000000000000000000000"); // 1e27

  return reserves.map((r) => {
    const liquidityRate = new BigNumber(r.liquidityRate || "0");
    const variableBorrowRate = new BigNumber(r.variableBorrowRate || "0");
    const oldLiquidityIndex = new BigNumber(r.liquidityIndex || RAY.toString());
    const oldVariableBorrowIndex = new BigNumber(
      r.variableBorrowIndex || RAY.toString()
    );

    // AAVE V3 linear interest formula (MathUtils.calculateLinearInterest):
    // linearInterest = RAY + rate * dt / SECONDS_PER_YEAR
    // newIndex = oldIndex * linearInterest / RAY
    //
    // liquidityRate/variableBorrowRate are ANNUAL rates in RAY format.
    // Dividing by SECONDS_PER_YEAR converts to per-second before multiplying by dt.
    const newLiquidityIndex = oldLiquidityIndex
      .multipliedBy(
        RAY.plus(
          liquidityRate
            .multipliedBy(secondsElapsed)
            .dividedToIntegerBy(SECONDS_PER_YEAR)
        )
      )
      .dividedBy(RAY)
      .toFixed(0);

    const newVariableBorrowIndex = oldVariableBorrowIndex
      .multipliedBy(
        RAY.plus(
          variableBorrowRate
            .multipliedBy(secondsElapsed)
            .dividedToIntegerBy(SECONDS_PER_YEAR)
        )
      )
      .dividedBy(RAY)
      .toFixed(0);

    // Also advance lastUpdateTimestamp so formatUserSummary doesn't
    // double-count the interest accrual
    const oldTimestamp = Number(r.lastUpdateTimestamp || 0);

    return {
      ...r,
      liquidityIndex: newLiquidityIndex,
      variableBorrowIndex: newVariableBorrowIndex,
      lastUpdateTimestamp: oldTimestamp + secondsElapsed,
    };
  });
}

/**
 * Apply all price changes for a given day to the formattedPoolReserves.
 */
function applyDayPrices(
  reserves: FormattedReserve[],
  priceSeries: Record<string, number[]>,
  day: number,
  marketReferenceCurrencyPriceInUSD: number,
  marketReferenceCurrencyDecimals: number
): FormattedReserve[] {
  let result = reserves;
  for (const symbol of Object.keys(priceSeries)) {
    const prices = priceSeries[symbol];
    if (day < prices.length) {
      result = applyPriceChange(
        result,
        symbol,
        prices[day],
        marketReferenceCurrencyPriceInUSD,
        marketReferenceCurrencyDecimals
      );
    }
  }
  return result;
}

/**
 * Apply rate scenario overrides for a given day.
 * Converts APY decimals to RAY format and overwrites the reserve's rates.
 * Rate scenarios set the baseline; action-triggered recalculation may override later.
 */
function applyDayRates(
  reserves: FormattedReserve[],
  rateSeries: Record<string, { supply?: number[]; borrow?: number[] }>,
  day: number
): FormattedReserve[] {
  const RAY_VAL = new BigNumber("1000000000000000000000000000");

  // Aave's liquidityRate / variableBorrowRate are APRs (per-second basis):
  // formatUserSummary derives APY ≈ e^APR − 1. Scenario rates are APYs, so
  // convert with APR = ln(1 + APY) to keep the user's configured APY intact.
  const apyToApr = (apy: number) => Math.log(1 + Math.max(apy, 0));

  return reserves.map((r) => {
    const series = rateSeries[r.symbol];
    if (!series) return r;

    const updated = { ...r };

    if (series.supply && day < series.supply.length) {
      const supplyAPY = series.supply[day];
      updated.liquidityRate = new BigNumber(apyToApr(supplyAPY))
        .multipliedBy(RAY_VAL)
        .toFixed(0);
      updated.supplyAPY = String(supplyAPY);
    }

    if (series.borrow && day < series.borrow.length) {
      const borrowAPY = series.borrow[day];
      updated.variableBorrowRate = new BigNumber(apyToApr(borrowAPY))
        .multipliedBy(RAY_VAL)
        .toFixed(0);
      updated.variableBorrowAPY = String(borrowAPY);
    }

    return updated;
  });
}

/**
 * After an action changes supply/borrow amounts, recalculate interest rates
 * for the affected reserve using the AAVE V3 interest rate model.
 * Updates liquidityRate, variableBorrowRate, and pool state tracking fields.
 */
function recalculateRatesAfterAction(
  formattedPoolReserves: FormattedReserve[],
  affectedSymbol: string,
  actionType: string,
  actionAmount: number
): FormattedReserve[] {
  return formattedPoolReserves.map((r) => {
    if (r.symbol !== affectedSymbol) return r;

    // totalDebt and totalLiquidity are normalized in token units on formatted reserves
    let totalDebt = new BigNumber(r.totalDebt || "0");
    let totalLiquidity = new BigNumber(r.totalLiquidity || "0");

    // Adjust based on action type (amounts in token units, matching normalized fields)
    switch (actionType) {
      case "supply":
        totalLiquidity = totalLiquidity.plus(actionAmount);
        break;
      case "withdraw":
        totalLiquidity = BigNumber.max(
          totalLiquidity.minus(actionAmount),
          0
        );
        break;
      case "borrow":
        totalDebt = totalDebt.plus(actionAmount);
        break;
      case "repay":
        totalDebt = BigNumber.max(totalDebt.minus(actionAmount), 0);
        totalLiquidity = totalLiquidity; // repay doesn't change total liquidity
        break;
    }

    const result = calculateRatesForReserve(r, totalDebt, totalLiquidity);

    return {
      ...r,
      liquidityRate: result.liquidityRate,
      variableBorrowRate: result.variableBorrowRate,
      supplyAPY: String(result.supplyAPY),
      variableBorrowAPY: String(result.variableBorrowAPY),
      totalDebt: totalDebt.toString(),
      totalLiquidity: totalLiquidity.toString(),
    };
  });
}

/**
 * Execute a single scheduled action, returning updated state.
 */
function executeScheduledAction(
  action: ScheduledAction,
  rawUserReserves: RawUserReserve[],
  formattedPoolReserves: FormattedReserve[],
  userEmodeCategoryId: number
): {
  rawUserReserves: RawUserReserve[];
  result: DayActionResult;
  userEmodeCategoryId: number;
} {
  const findAsset = (symbol: string) =>
    formattedPoolReserves.find((r) => r.symbol === symbol)
      ?.underlyingAsset as string | undefined;

  // Handle set_emode: no asset needed
  if (action.type === "set_emode") {
    return {
      rawUserReserves,
      result: {
        type: action.type,
        symbol: action.symbol,
        amount: action.amount,
        status: "success",
      },
      userEmodeCategoryId: action.emodeCategoryId ?? 0,
    };
  }

  const underlyingAsset = findAsset(action.symbol);
  if (!underlyingAsset) {
    return {
      rawUserReserves,
      result: {
        type: action.type,
        symbol: action.symbol,
        amount: action.amount,
        status: "skipped",
        reason: `Asset ${action.symbol} not found in pool reserves`,
      },
      userEmodeCategoryId,
    };
  }

  let newReserves = rawUserReserves;

  switch (action.type) {
    case "supply":
      newReserves = applySupply(
        rawUserReserves,
        formattedPoolReserves,
        underlyingAsset,
        action.amount,
        action.useAsCollateral ?? true
      );
      break;
    case "borrow":
      newReserves = applyBorrow(
        rawUserReserves,
        formattedPoolReserves,
        underlyingAsset,
        action.amount
      );
      break;
    case "repay":
      if (action.repayFromCollateral) {
        newReserves = applyWithdraw(
          rawUserReserves,
          formattedPoolReserves,
          underlyingAsset,
          action.amount
        );
        newReserves = applyRepay(
          newReserves,
          formattedPoolReserves,
          underlyingAsset,
          action.amount
        );
      } else {
        newReserves = applyRepay(
          rawUserReserves,
          formattedPoolReserves,
          underlyingAsset,
          action.amount
        );
      }
      break;
    case "withdraw":
      newReserves = applyWithdraw(
        rawUserReserves,
        formattedPoolReserves,
        underlyingAsset,
        action.amount
      );
      break;
    case "set_wallet_balance":
      // This action only affects wallet balance, not on-chain reserves
      // The wallet balance is tracked separately in the simulation state
      break;
  }

  return {
    rawUserReserves: newReserves,
    result: {
      type: action.type,
      symbol: action.symbol,
      amount: action.amount,
      status: "success",
    },
    userEmodeCategoryId,
  };
}

/**
 * Gather incentive details for a given asset symbol and action (supply/borrow).
 * Combines protocol incentives (from formattedPoolReserves) and Merkl incentives.
 */
function gatherIncentives(
  symbol: string,
  action: "supply" | "borrow",
  formattedPoolReserves: FormattedReserve[],
  merklIncentives: MerklIncentiveData[] | undefined,
  incentiveOverrides: Record<string, number> | undefined
): { incentiveAPR: number; incentives: IncentiveDetail[] } {
  const details: IncentiveDetail[] = [];

  // Protocol incentives from formattedPoolReserves
  const reserve = formattedPoolReserves.find((r) => r.symbol === symbol);
  if (reserve) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incentivesData: any[] =
      action === "supply"
        ? (reserve.aIncentivesData || [])
        : (reserve.vIncentivesData || []);

    for (const inc of incentivesData) {
      const apr = Number(inc.incentiveAPR ?? 0);
      if (apr <= 0) continue;
      details.push({
        rewardTokenSymbol: inc.rewardTokenSymbol ?? "UNKNOWN",
        rewardTokenAddress: inc.rewardTokenAddress ?? "",
        incentiveAPR: apr,
        source: "protocol",
      });
    }
  }

  // Merkl incentives
  if (merklIncentives && reserve) {
    const underlyingAsset = (reserve.underlyingAsset as string)?.toLowerCase();
    for (const mi of merklIncentives) {
      if (
        mi.underlyingAsset?.toLowerCase() === underlyingAsset &&
        mi.action === action
      ) {
        details.push({
          rewardTokenSymbol: mi.rewardTokenSymbol,
          rewardTokenAddress: mi.rewardTokenAddress,
          incentiveAPR: mi.apr,
          source: "merkl",
        });
      }
    }
  }

  let totalAPR = details.reduce((sum, d) => sum + d.incentiveAPR, 0);

  // Apply override if a scenario has been set for this asset's incentive rate
  const overrideKey = `${symbol}_${action}Incentive`;
  if (incentiveOverrides && overrideKey in incentiveOverrides) {
    totalAPR = incentiveOverrides[overrideKey];
  }

  return { incentiveAPR: totalAPR, incentives: details };
}

// Aave V3 close factor mechanics: below this HF a liquidator may repay 100%
// of a debt position in one call; between this and 1.0, at most 50%.
const CLOSE_FACTOR_HF_THRESHOLD = 0.95;
const MAX_LIQUIDATION_ROUNDS = 10;

/**
 * Resolve a reserve's liquidation bonus as a fraction (e.g. 0.05 = 5%).
 */
function getLiquidationBonus(reserve: FormattedReserve | undefined): number {
  if (reserve) {
    const formatted = Number(reserve.formattedReserveLiquidationBonus);
    if (isFinite(formatted) && formatted >= 0 && formatted < 1) return formatted;
    const raw = Number(reserve.reserveLiquidationBonus);
    if (isFinite(raw) && raw > 10000) return (raw - 10000) / 10000;
  }
  return 0.05; // sensible default
}

/**
 * Simulate Aave V3 liquidations while the position is liquidatable (HF < 1).
 *
 * Each round mimics one liquidation call: the largest debt position is repaid
 * up to the close factor (50%, or 100% when HF < 0.95) and collateral worth
 * (debt repaid x (1 + liquidation bonus)) is seized from the largest enabled
 * collateral. Pool rates are recalculated after each round. Stops when HF
 * recovers above 1, the position is empty, or MAX_LIQUIDATION_ROUNDS is hit.
 *
 * Note: eMode-specific liquidation bonuses are not modeled (reserve-level
 * bonus is used).
 */
function executeLiquidations(
  rawUserReserves: RawUserReserve[],
  formattedPoolReserves: FormattedReserve[],
  baseCurrencyData: EngineState["baseCurrencyData"],
  userEmodeCategoryId: number,
  currentTimestamp: number,
  initialHFData: EngineState["healthFactorData"]
): {
  rawUserReserves: RawUserReserve[];
  formattedPoolReserves: FormattedReserve[];
  healthFactorData: EngineState["healthFactorData"];
  events: LiquidationEvent[];
} {
  let raw = rawUserReserves;
  let pool = formattedPoolReserves;
  let hfData = initialHFData;
  const events: LiquidationEvent[] = [];

  for (let round = 1; round <= MAX_LIQUIDATION_ROUNDS; round++) {
    const hf = hfData.healthFactor;
    if (!isFinite(hf) || hf >= 1 || hfData.totalBorrowsUSD <= 0) break;

    // Liquidators target the largest debt and the largest enabled collateral
    const debt = [...hfData.userBorrowsData].sort(
      (a, b) => b.totalBorrowsUSD - a.totalBorrowsUSD
    )[0];
    const collateral = hfData.userReservesData
      .filter((r) => r.usageAsCollateralEnabledOnUser && r.underlyingBalanceUSD > 0)
      .sort((a, b) => b.underlyingBalanceUSD - a.underlyingBalanceUSD)[0];
    if (!debt || !collateral) break;

    const debtPrice = debt.asset.priceInUSD;
    const collateralPrice = collateral.asset.priceInUSD;
    if (debtPrice <= 0 || collateralPrice <= 0) break;

    const collateralReserve = pool.find(
      (r) => r.underlyingAsset === collateral.asset.underlyingAsset
    );
    const bonus = getLiquidationBonus(collateralReserve);

    const closeFactor = hf < CLOSE_FACTOR_HF_THRESHOLD ? 1 : 0.5;

    let debtToCoverUSD = debt.totalBorrowsUSD * closeFactor;
    let seizedUSD = debtToCoverUSD * (1 + bonus);
    // Cap at available collateral
    if (seizedUSD > collateral.underlyingBalanceUSD) {
      seizedUSD = collateral.underlyingBalanceUSD;
      debtToCoverUSD = seizedUSD / (1 + bonus);
    }
    if (debtToCoverUSD <= 0) break;

    const debtAmount = debtToCoverUSD / debtPrice;
    const collateralAmount = seizedUSD / collateralPrice;

    raw = applyRepay(raw, pool, debt.asset.underlyingAsset as string, debtAmount);
    raw = applyWithdraw(
      raw,
      pool,
      collateral.asset.underlyingAsset as string,
      collateralAmount
    );

    // Reflect the pool-level effects on interest rates
    pool = recalculateRatesAfterAction(pool, debt.asset.symbol, "repay", debtAmount);
    pool = recalculateRatesAfterAction(
      pool,
      collateral.asset.symbol,
      "withdraw",
      collateralAmount
    );

    hfData = recalculatePosition(
      raw,
      pool,
      baseCurrencyData,
      userEmodeCategoryId,
      currentTimestamp
    );

    events.push({
      round,
      debtSymbol: debt.asset.symbol,
      collateralSymbol: collateral.asset.symbol,
      debtRepaid: debtAmount,
      debtRepaidUSD: debtToCoverUSD,
      collateralSeized: collateralAmount,
      collateralSeizedUSD: seizedUSD,
      liquidationBonus: bonus,
      healthFactorAfter: hfData.healthFactor,
    });
  }

  return { rawUserReserves: raw, formattedPoolReserves: pool, healthFactorData: hfData, events };
}

/**
 * Build a DaySnapshot from the current engine state.
 */
function buildDaySnapshot(
  day: number,
  state: EngineState,
  priceSeries: Record<string, number[]>,
  actionsExecuted: DayActionResult[],
  incentiveOverrides?: Record<string, number>,
  liquidationEvents?: LiquidationEvent[]
): DaySnapshot {
  const hfData = state.healthFactorData;

  const prices: DayAssetPrice[] = Object.entries(priceSeries).map(
    ([symbol, series]) => ({
      symbol,
      priceUSD: series[day] ?? series[series.length - 1],
    })
  );

  // Also include prices for user-position tokens not covered by price scenarios
  const scenarioSymbols = new Set(Object.keys(priceSeries));
  const userSymbolsForPrices = new Set([
    ...hfData.userReservesData.map((r) => r.asset.symbol),
    ...hfData.userBorrowsData.map((b) => b.asset.symbol),
  ]);
  for (const sym of userSymbolsForPrices) {
    if (!scenarioSymbols.has(sym)) {
      const reserveAsset =
        hfData.userReservesData.find((r) => r.asset.symbol === sym)?.asset ??
        hfData.userBorrowsData.find((b) => b.asset.symbol === sym)?.asset;
      if (reserveAsset) {
        prices.push({ symbol: sym, priceUSD: reserveAsset.priceInUSD });
      }
    }
  }

  const totalCollateralUSD =
    hfData.totalCollateralMarketReferenceCurrency *
    state.marketReferenceCurrencyPriceInUSD;

  const supplies: DaySupplyItem[] = hfData.userReservesData.map((r) => {
    const inc = gatherIncentives(
      r.asset.symbol,
      "supply",
      state.formattedPoolReserves,
      state.merklIncentives,
      incentiveOverrides
    );
    return {
      symbol: r.asset.symbol,
      balance: r.underlyingBalance,
      balanceUSD: r.underlyingBalanceUSD,
      supplyAPY: r.asset.supplyAPY ?? 0,
      incentiveAPR: inc.incentiveAPR,
      incentives: inc.incentives,
    };
  });

  const borrows: DayBorrowItem[] = hfData.userBorrowsData.map((b) => {
    const inc = gatherIncentives(
      b.asset.symbol,
      "borrow",
      state.formattedPoolReserves,
      state.merklIncentives,
      incentiveOverrides
    );
    return {
      symbol: b.asset.symbol,
      debt: b.totalBorrows,
      debtUSD: b.totalBorrowsUSD,
      borrowAPY: b.asset.variableBorrowAPY ?? 0,
      incentiveAPR: inc.incentiveAPR,
      incentives: inc.incentives,
    };
  });

  // Build rates for assets the user has positions in
  const userSymbols = new Set([
    ...hfData.userReservesData.map((r) => r.asset.symbol),
    ...hfData.userBorrowsData.map((b) => b.asset.symbol),
  ]);
  const rates: DayAssetRate[] = state.formattedPoolReserves
    .filter((r) => userSymbols.has(r.symbol))
    .map((r) => {
      const supplyInc = gatherIncentives(
        r.symbol,
        "supply",
        state.formattedPoolReserves,
        state.merklIncentives,
        incentiveOverrides
      );
      const borrowInc = gatherIncentives(
        r.symbol,
        "borrow",
        state.formattedPoolReserves,
        state.merklIncentives,
        incentiveOverrides
      );
      return {
        symbol: r.symbol,
        supplyAPY: Number(r.supplyAPY || 0),
        variableBorrowAPY: Number(r.variableBorrowAPY || 0),
        supplyIncentiveAPR: supplyInc.incentiveAPR,
        borrowIncentiveAPR: borrowInc.incentiveAPR,
      };
    });

  const warnings: string[] = [];
  if (liquidationEvents && liquidationEvents.length > 0) {
    for (const ev of liquidationEvents) {
      warnings.push(
        `Liquidated: repaid ${ev.debtRepaid.toFixed(4)} ${ev.debtSymbol} debt ($${ev.debtRepaidUSD.toFixed(2)}), seized ${ev.collateralSeized.toFixed(4)} ${ev.collateralSymbol} collateral ($${ev.collateralSeizedUSD.toFixed(2)}, +${(ev.liquidationBonus * 100).toFixed(1)}% bonus) — HF after: ${isFinite(ev.healthFactorAfter) ? ev.healthFactorAfter.toFixed(4) : "∞"}`
      );
    }
  }
  if (hfData.healthFactor < 0.95 && isFinite(hfData.healthFactor)) {
    warnings.push(`Health factor below 0.95 (${hfData.healthFactor.toFixed(4)}) — 100% close factor, full liquidation possible`);
  } else if (hfData.healthFactor < 1 && isFinite(hfData.healthFactor)) {
    warnings.push(`Health factor below 1 (${hfData.healthFactor.toFixed(4)}) — 50% close factor, partial liquidation possible`);
  } else if (hfData.healthFactor < 1.1 && isFinite(hfData.healthFactor)) {
    warnings.push(`Health factor below 1.1 (${hfData.healthFactor.toFixed(4)}) — approaching liquidation`);
  }

  return {
    day,
    prices,
    rates,
    healthFactor: hfData.healthFactor,
    totalCollateralUSD,
    totalBorrowsUSD: hfData.totalBorrowsUSD,
    netWorthUSD: totalCollateralUSD - hfData.totalBorrowsUSD,
    availableBorrowsUSD: hfData.availableBorrowsUSD,
    currentLTV: hfData.currentLoanToValue,
    currentLiquidationThreshold: hfData.currentLiquidationThreshold,
    supplies,
    borrows,
    actionsExecuted,
    liquidationEvents: liquidationEvents && liquidationEvents.length > 0 ? liquidationEvents : undefined,
    warnings,
  };
}

/**
 * Run a temporal simulation over N days.
 *
 * The engine loop for each day:
 * 1. If day > 0: accrue interest (advance indices by 1 day)
 * 2. Apply price changes from scenarios
 * 3. Execute scheduled actions for this day
 * 4. Recalculate position via formatUserSummary
 * 5. Build and store snapshot
 */
export function runTemporalSimulation(
  config: TemporalSimulationConfig,
  initialState: EngineState
): TemporalSimulationResult {
  const { durationDays, priceScenarios, rateScenarios, scheduledActions } =
    config;

  // Generate all price and rate series upfront
  const priceSeries = generateAllPriceSeries(priceScenarios, durationDays);
  const rateSeries = generateAllRateSeries(rateScenarios, durationDays);

  // Group actions by day
  const actionsByDay: Record<number, ScheduledAction[]> = {};
  for (const action of scheduledActions) {
    if (!actionsByDay[action.day]) actionsByDay[action.day] = [];
    actionsByDay[action.day].push(action);
  }
  // Sort within each day by orderInDay
  for (const day of Object.keys(actionsByDay)) {
    actionsByDay[Number(day)].sort((a, b) => a.orderInDay - b.orderInDay);
  }

  // Initialize mutable state
  let rawUserReserves: RawUserReserve[] = deepClone(initialState.rawUserReserves);
  let formattedPoolReserves: FormattedReserve[] = deepClone(
    initialState.formattedPoolReserves
  );
  const baseCurrencyData = deepClone(initialState.baseCurrencyData);
  let userEmodeCategoryId = initialState.userEmodeCategoryId;
  const { marketReferenceCurrencyPriceInUSD } = initialState;
  const merklIncentives = initialState.merklIncentives;

  // Base timestamp = now. Each day advances by SECONDS_PER_DAY.
  const baseTimestamp = Math.floor(Date.now() / 1000);

  const timeline: DaySnapshot[] = [];
  let lowestHF = Infinity;
  let lowestHFDay = 0;
  let liquidationOccurred = false;
  let liquidationDay: number | undefined;

  // Track incentive rate overrides from scenarios
  const incentiveOverrides: Record<string, number> = {};

  // Day 0 is the baseline state (no actions executed).
  // Actions can only be scheduled from day 1 onwards.
  // This ensures we always have a clean reference state to compare against.
  for (let day = 0; day <= durationDays; day++) {
    const currentTimestamp = baseTimestamp + day * SECONDS_PER_DAY;

    // Step 1: Apply rate scenarios + accrue interest (skip day 0)
    if (day > 0) {
      formattedPoolReserves = applyDayRates(
        formattedPoolReserves,
        rateSeries,
        day
      );
      formattedPoolReserves = accrueInterest(
        formattedPoolReserves,
        SECONDS_PER_DAY
      );
    }

    // Apply incentive rate overrides from scenarios
    for (const symbol of Object.keys(rateSeries)) {
      const series = rateSeries[symbol];
      if (series.supplyIncentive && day < series.supplyIncentive.length) {
        incentiveOverrides[`${symbol}_supplyIncentive`] = series.supplyIncentive[day];
      }
      if (series.borrowIncentive && day < series.borrowIncentive.length) {
        incentiveOverrides[`${symbol}_borrowIncentive`] = series.borrowIncentive[day];
      }
    }

    // Step 2: Apply price changes
    formattedPoolReserves = applyDayPrices(
      formattedPoolReserves,
      priceSeries,
      day,
      marketReferenceCurrencyPriceInUSD,
      baseCurrencyData.marketReferenceCurrencyDecimals
    );

    // Step 3: Execute scheduled actions
    const dayActions = actionsByDay[day] ?? [];
    const actionsExecuted: DayActionResult[] = [];

    for (const action of dayActions) {
      const result = executeScheduledAction(
        action,
        rawUserReserves,
        formattedPoolReserves,
        userEmodeCategoryId
      );
      rawUserReserves = result.rawUserReserves;
      userEmodeCategoryId = result.userEmodeCategoryId;
      actionsExecuted.push(result.result);

      // Recalculate interest rates after successful actions
      if (result.result.status === "success" && action.type !== "set_emode") {
        if (action.type === "repay" && action.repayFromCollateral) {
          // Collateral repay = withdraw + repay: apply both effects on pool
          formattedPoolReserves = recalculateRatesAfterAction(
            formattedPoolReserves,
            action.symbol,
            "withdraw",
            action.amount
          );
          formattedPoolReserves = recalculateRatesAfterAction(
            formattedPoolReserves,
            action.symbol,
            "repay",
            action.amount
          );
        } else {
          formattedPoolReserves = recalculateRatesAfterAction(
            formattedPoolReserves,
            action.symbol,
            action.type,
            action.amount
          );
        }
      }
    }

    // Step 4: Recalculate position
    let healthFactorData = recalculatePosition(
      rawUserReserves,
      formattedPoolReserves,
      baseCurrencyData,
      userEmodeCategoryId,
      currentTimestamp
    );

    // Track lowest health factor BEFORE liquidations restore it
    const hf = healthFactorData.healthFactor;
    if (isFinite(hf) && hf < lowestHF) {
      lowestHF = hf;
      lowestHFDay = day;
    }

    // Step 4.5: Execute liquidations while HF < 1 (skip day 0 — baseline)
    let liquidationEvents: LiquidationEvent[] = [];
    if (
      day > 0 &&
      isFinite(hf) &&
      hf < 1 &&
      healthFactorData.totalBorrowsUSD > 0
    ) {
      const liq = executeLiquidations(
        rawUserReserves,
        formattedPoolReserves,
        baseCurrencyData,
        userEmodeCategoryId,
        currentTimestamp,
        healthFactorData
      );
      rawUserReserves = liq.rawUserReserves;
      formattedPoolReserves = liq.formattedPoolReserves;
      healthFactorData = liq.healthFactorData;
      liquidationEvents = liq.events;

      if (liquidationEvents.length > 0 && !liquidationOccurred) {
        liquidationOccurred = true;
        liquidationDay = day;
      }
    }

    // Build state for snapshot
    const state: EngineState = {
      rawUserReserves,
      formattedPoolReserves,
      baseCurrencyData,
      userEmodeCategoryId,
      marketReferenceCurrencyPriceInUSD,
      healthFactorData,
      merklIncentives,
    };

    // Step 5: Build snapshot
    const snapshot = buildDaySnapshot(
      day,
      state,
      priceSeries,
      actionsExecuted,
      incentiveOverrides,
      liquidationEvents
    );
    timeline.push(snapshot);
  }

  // Build summary
  const startSnapshot = timeline[0];
  const endSnapshot = timeline[timeline.length - 1];

  // Interest earned/paid: accrue each day's balance at that day's rate.
  // (Using raw USD balance deltas would conflate price moves and scheduled
  // deposits/withdrawals with interest.)
  // Each snapshot accrues over the following day, so the last one is excluded.
  let totalInterestEarned = 0;
  let totalInterestPaid = 0;
  let totalIncentivesEarnedUSD = 0;
  for (let i = 0; i < timeline.length - 1; i++) {
    const snap = timeline[i];
    for (const s of snap.supplies) {
      totalInterestEarned += s.balanceUSD * (Number(s.supplyAPY) || 0) / 365;
      totalIncentivesEarnedUSD += s.balanceUSD * (s.incentiveAPR || 0) / 365;
    }
    for (const b of snap.borrows) {
      totalInterestPaid += b.debtUSD * (Number(b.borrowAPY) || 0) / 365;
      totalIncentivesEarnedUSD += b.debtUSD * (b.incentiveAPR || 0) / 365;
    }
  }

  // Aggregate liquidation totals
  let totalDebtRepaidByLiquidationUSD = 0;
  let totalCollateralSeizedUSD = 0;
  for (const snap of timeline) {
    for (const ev of snap.liquidationEvents ?? []) {
      totalDebtRepaidByLiquidationUSD += ev.debtRepaidUSD;
      totalCollateralSeizedUSD += ev.collateralSeizedUSD;
    }
  }

  const summary: SimulationSummary = {
    startNetWorth: startSnapshot.netWorthUSD,
    endNetWorth: endSnapshot.netWorthUSD,
    totalInterestEarned,
    totalInterestPaid,
    totalIncentivesEarnedUSD,
    lowestHealthFactor: lowestHF === Infinity ? Infinity : lowestHF,
    lowestHealthFactorDay: lowestHFDay,
    liquidationOccurred,
    liquidationDay,
    totalDebtRepaidByLiquidationUSD: totalDebtRepaidByLiquidationUSD > 0 ? totalDebtRepaidByLiquidationUSD : undefined,
    totalCollateralSeizedUSD: totalCollateralSeizedUSD > 0 ? totalCollateralSeizedUSD : undefined,
  };

  return { timeline, summary };
}
