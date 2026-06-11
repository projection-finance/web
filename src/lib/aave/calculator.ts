import dayjs from "dayjs";
import { formatUserSummary, FormatReserveUSDResponse } from "@aave/math-utils";
import BigNumber from "bignumber.js";
import {
  AaveHealthFactorData,
  AssetDetails,
  BorrowedAssetDataItem,
  FormattedReserve,
  RawUserReserve,
  ReserveAssetDataItem,
  BaseCurrencyData,
} from "./types";

/** RAY (1e27) as a string — fallback for missing reserve indices. */
const RAY_STR = "1000000000000000000000000000";

/**
 * Recalculate the full user position using @aave/math-utils formatUserSummary.
 *
 * This is the correct AAVE v3 approach:
 * - Handles eMode (category-based LTV/LT)
 * - Handles isolation mode
 * - Proper interest accrual from scaled balances
 * - Exact match to AAVE v3 smart contract math
 *
 * To simulate changes, modify the inputs BEFORE calling this function:
 * - Price change → modify `priceInMarketReferenceCurrency` on formattedPoolReserves
 * - Supply → increase `scaledATokenBalance` on rawUserReserves
 * - Borrow → increase `scaledVariableDebt` on rawUserReserves
 * - Withdraw → decrease `scaledATokenBalance`
 * - Repay → decrease `scaledVariableDebt`
 */
export function recalculatePosition(
  rawUserReserves: RawUserReserve[],
  formattedPoolReserves: FormattedReserve[],
  baseCurrencyData: BaseCurrencyData,
  userEmodeCategoryId: number,
  currentTimestamp?: number
): AaveHealthFactorData {
  const timestamp = currentTimestamp ?? dayjs().unix();

  const userSummary = formatUserSummary({
    currentTimestamp: timestamp,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    userReserves: rawUserReserves,
    formattedReserves: formattedPoolReserves as unknown as FormatReserveUSDResponse[],
    userEmodeCategoryId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildAssetDetails = (reserveItem: any): AssetDetails => {
    const reserve = reserveItem.reserve;
    return {
      symbol: reserve.symbol,
      name: reserve.name,
      decimals: reserve.decimals,
      priceInUSD: Number(reserve.priceInUSD),
      priceInMarketReferenceCurrency: new BigNumber(
        reserve.priceInMarketReferenceCurrency
      )
        .shiftedBy(baseCurrencyData.marketReferenceCurrencyDecimals * -1)
        .toNumber(),
      baseLTVasCollateral: Number(reserve.baseLTVasCollateral),
      reserveFactor: Number(reserve.reserveFactor),
      usageAsCollateralEnabled: reserve.usageAsCollateralEnabled,
      reserveLiquidationThreshold: Number(reserve.reserveLiquidationThreshold),
      initialPriceInUSD: Number(reserve.priceInUSD),
      underlyingAsset: reserve.underlyingAsset,
      borrowingEnabled: reserve.borrowingEnabled,
      isActive: reserve.isActive,
      isFrozen: reserve.isFrozen,
      isPaused: reserve.isPaused,
      supplyAPY: Number(reserve.supplyAPY),
      variableBorrowAPY: Number(reserve.variableBorrowAPY),
      availableLiquidity: Number(reserve.availableLiquidity),
      borrowCap: Number(reserve.borrowCap),
      supplyCap: Number(reserve.supplyCap),
      eModeLtv: Number(reserve.eModeLtv),
      eModeLiquidationThreshold: Number(reserve.eModeLiquidationThreshold),
      eModeCategoryId: Number(reserve.eModeCategoryId),
      eModeLabel: reserve.eModeLabel,
      liquidityIndex: Number(reserve.liquidityIndex),
      variableBorrowIndex: Number(reserve.variableBorrowIndex),
      liquidityRate: Number(reserve.liquidityRate),
      variableBorrowRate: Number(reserve.variableBorrowRate),
    };
  };

  const userReservesData: ReserveAssetDataItem[] = userSummary.userReservesData
    .filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.underlyingBalance && r.underlyingBalance !== "0"
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((reserveItem: any) => {
      const rawUR = rawUserReserves.find(
        (ur) => ur.underlyingAsset === reserveItem.reserve.underlyingAsset
      );
      return {
        asset: buildAssetDetails(reserveItem),
        underlyingBalance: Number(reserveItem.underlyingBalance),
        underlyingBalanceUSD: Number(reserveItem.underlyingBalanceUSD),
        underlyingBalanceMarketReferenceCurrency: Number(
          reserveItem.underlyingBalanceMarketReferenceCurrency
        ),
        usageAsCollateralEnabledOnUser:
          reserveItem.usageAsCollateralEnabledOnUser,
        scaledATokenBalance: rawUR?.scaledATokenBalance,
      };
    });

  const userBorrowsData: BorrowedAssetDataItem[] = userSummary.userReservesData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.totalBorrows && r.totalBorrows !== "0")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((reserveItem: any) => {
      const rawUR = rawUserReserves.find(
        (ur) => ur.underlyingAsset === reserveItem.reserve.underlyingAsset
      );
      return {
        asset: buildAssetDetails(reserveItem),
        variableBorrows: Number(reserveItem.variableBorrows),
        totalBorrows: Number(reserveItem.totalBorrows),
        totalBorrowsUSD: Number(reserveItem.totalBorrowsUSD),
        stableBorrowAPY: 0,
        totalBorrowsMarketReferenceCurrency: Number(
          reserveItem.totalBorrowsMarketReferenceCurrency
        ),
        scaledVariableDebt: rawUR?.scaledVariableDebt,
      };
    });

  return {
    healthFactor: Number(userSummary.healthFactor),
    totalBorrowsUSD: Number(userSummary.totalBorrowsUSD),
    availableBorrowsUSD: Number(userSummary.availableBorrowsUSD),
    totalCollateralMarketReferenceCurrency: Number(
      userSummary.totalCollateralMarketReferenceCurrency
    ),
    totalBorrowsMarketReferenceCurrency: Number(
      userSummary.totalBorrowsMarketReferenceCurrency
    ),
    currentLiquidationThreshold: Number(
      userSummary.currentLiquidationThreshold
    ),
    currentLoanToValue: Number(userSummary.currentLoanToValue),
    userReservesData,
    userBorrowsData,
    userEmodeCategoryId,
    isInIsolationMode: userSummary.isInIsolationMode,
  };
}

/**
 * Apply a price change to formattedPoolReserves.
 * Modifies `priceInMarketReferenceCurrency` which is what formatUserSummary uses
 * to compute health factor. Also updates `priceInUSD` for display.
 *
 * Returns a new array (does not mutate the input).
 */
export function applyPriceChange(
  formattedPoolReserves: FormattedReserve[],
  symbol: string,
  newPriceUSD: number,
  marketReferenceCurrencyPriceInUSD: number,
  marketReferenceCurrencyDecimals: number
): FormattedReserve[] {
  return formattedPoolReserves.map((r) => {
    if (r.symbol !== symbol) return r;

    // priceInMarketReferenceCurrency is stored as a raw big number string
    // e.g. for ETH: "1000000000000000000" (1e18) when 1 ETH = 1 ETH
    // We need to compute: newPriceUSD / marketRefPriceInUSD * 10^marketRefDecimals
    const oldPriceUSD = Number(r.priceInUSD);
    if (!oldPriceUSD || !isFinite(oldPriceUSD)) return r;

    const ratio = newPriceUSD / oldPriceUSD;
    const newPriceInMRC = new BigNumber(r.priceInMarketReferenceCurrency ?? 0)
      .multipliedBy(ratio)
      .toFixed(0);

    return {
      ...r,
      priceInUSD: String(newPriceUSD),
      priceInMarketReferenceCurrency: newPriceInMRC,
      formattedPriceInMarketReferenceCurrency: new BigNumber(newPriceInMRC)
        .shiftedBy(marketReferenceCurrencyDecimals * -1)
        .toString(),
    };
  });
}

/**
 * Apply a supply action: increase scaledATokenBalance for the given asset.
 * scaledDelta = amount * 10^decimals / (liquidityIndex / 1e27)
 *             = amount * 10^decimals * 1e27 / liquidityIndex
 *
 * IMPORTANT: pf-frontend had this inverted (qty * index instead of qty / index).
 * The correct formula: scaledBalance = actualBalance / normalizedIncome
 *
 * Returns a new array (does not mutate).
 */
export function applySupply(
  rawUserReserves: RawUserReserve[],
  formattedPoolReserves: FormattedReserve[],
  underlyingAsset: string,
  amount: number,
  useAsCollateral: boolean = true
): RawUserReserve[] {
  const reserve = formattedPoolReserves.find(
    (r) => r.underlyingAsset === underlyingAsset
  );
  if (!reserve) return rawUserReserves;

  const decimals = Number(reserve.decimals);
  const liquidityIndex = new BigNumber(reserve.liquidityIndex ?? RAY_STR);

  // scaledDelta = amount * 10^decimals * RAY / liquidityIndex
  const RAY = new BigNumber("1000000000000000000000000000"); // 1e27
  const scaledDelta = new BigNumber(amount)
    .multipliedBy(new BigNumber(10).pow(decimals))
    .multipliedBy(RAY)
    .dividedBy(liquidityIndex)
    .toFixed(0);

  const existing = rawUserReserves.find(
    (ur) => ur.underlyingAsset === underlyingAsset
  );

  if (existing) {
    return rawUserReserves.map((ur) => {
      if (ur.underlyingAsset !== underlyingAsset) return ur;
      return {
        ...ur,
        scaledATokenBalance: new BigNumber(ur.scaledATokenBalance)
          .plus(scaledDelta)
          .toFixed(0),
        usageAsCollateralEnabledOnUser: useAsCollateral,
      };
    });
  }

  // New reserve position
  return [
    ...rawUserReserves,
    {
      underlyingAsset,
      scaledATokenBalance: scaledDelta,
      usageAsCollateralEnabledOnUser: useAsCollateral,
      scaledVariableDebt: "0",
    },
  ];
}

/**
 * Apply a borrow action: increase scaledVariableDebt for the given asset.
 * scaledDelta = amount * 10^decimals * RAY / variableBorrowIndex
 *
 * Returns a new array (does not mutate).
 */
export function applyBorrow(
  rawUserReserves: RawUserReserve[],
  formattedPoolReserves: FormattedReserve[],
  underlyingAsset: string,
  amount: number
): RawUserReserve[] {
  const reserve = formattedPoolReserves.find(
    (r) => r.underlyingAsset === underlyingAsset
  );
  if (!reserve) return rawUserReserves;

  const decimals = Number(reserve.decimals);
  const variableBorrowIndex = new BigNumber(reserve.variableBorrowIndex ?? RAY_STR);

  const RAY = new BigNumber("1000000000000000000000000000");
  const scaledDelta = new BigNumber(amount)
    .multipliedBy(new BigNumber(10).pow(decimals))
    .multipliedBy(RAY)
    .dividedBy(variableBorrowIndex)
    .toFixed(0);

  const existing = rawUserReserves.find(
    (ur) => ur.underlyingAsset === underlyingAsset
  );

  if (existing) {
    return rawUserReserves.map((ur) => {
      if (ur.underlyingAsset !== underlyingAsset) return ur;
      return {
        ...ur,
        scaledVariableDebt: new BigNumber(ur.scaledVariableDebt)
          .plus(scaledDelta)
          .toFixed(0),
      };
    });
  }

  return [
    ...rawUserReserves,
    {
      underlyingAsset,
      scaledATokenBalance: "0",
      usageAsCollateralEnabledOnUser: false,
      scaledVariableDebt: scaledDelta,
    },
  ];
}

/**
 * Apply a repay action: decrease scaledVariableDebt for the given asset.
 * Returns a new array (does not mutate).
 */
export function applyRepay(
  rawUserReserves: RawUserReserve[],
  formattedPoolReserves: FormattedReserve[],
  underlyingAsset: string,
  amount: number
): RawUserReserve[] {
  const reserve = formattedPoolReserves.find(
    (r) => r.underlyingAsset === underlyingAsset
  );
  if (!reserve) return rawUserReserves;

  const decimals = Number(reserve.decimals);
  const variableBorrowIndex = new BigNumber(reserve.variableBorrowIndex ?? RAY_STR);

  const RAY = new BigNumber("1000000000000000000000000000");
  const scaledDelta = new BigNumber(amount)
    .multipliedBy(new BigNumber(10).pow(decimals))
    .multipliedBy(RAY)
    .dividedBy(variableBorrowIndex)
    .toFixed(0);

  return rawUserReserves.map((ur) => {
    if (ur.underlyingAsset !== underlyingAsset) return ur;
    const newScaledDebt = BigNumber.max(
      new BigNumber(ur.scaledVariableDebt).minus(scaledDelta),
      0
    ).toFixed(0);
    return {
      ...ur,
      scaledVariableDebt: newScaledDebt,
    };
  });
}

/**
 * Toggle collateral usage for an asset.
 * Flips `usageAsCollateralEnabledOnUser` on the matching raw user reserve.
 * Returns a new array (does not mutate).
 */
export function applyCollateralToggle(
  rawUserReserves: RawUserReserve[],
  underlyingAsset: string,
  enable: boolean
): RawUserReserve[] {
  return rawUserReserves.map((ur) => {
    if (ur.underlyingAsset !== underlyingAsset) return ur;
    return { ...ur, usageAsCollateralEnabledOnUser: enable };
  });
}

/**
 * Apply a withdraw action: decrease scaledATokenBalance for the given asset.
 * Returns a new array (does not mutate).
 */
export function applyWithdraw(
  rawUserReserves: RawUserReserve[],
  formattedPoolReserves: FormattedReserve[],
  underlyingAsset: string,
  amount: number
): RawUserReserve[] {
  const reserve = formattedPoolReserves.find(
    (r) => r.underlyingAsset === underlyingAsset
  );
  if (!reserve) return rawUserReserves;

  const decimals = Number(reserve.decimals);
  const liquidityIndex = new BigNumber(reserve.liquidityIndex ?? RAY_STR);

  const RAY = new BigNumber("1000000000000000000000000000");
  const scaledDelta = new BigNumber(amount)
    .multipliedBy(new BigNumber(10).pow(decimals))
    .multipliedBy(RAY)
    .dividedBy(liquidityIndex)
    .toFixed(0);

  return rawUserReserves.map((ur) => {
    if (ur.underlyingAsset !== underlyingAsset) return ur;
    const newScaledBalance = BigNumber.max(
      new BigNumber(ur.scaledATokenBalance).minus(scaledDelta),
      0
    ).toFixed(0);
    return {
      ...ur,
      scaledATokenBalance: newScaledBalance,
    };
  });
}
