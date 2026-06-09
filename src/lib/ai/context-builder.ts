import {
  AaveHealthFactorData,
  FormattedReserve,
  MerklIncentiveData,
} from "@/src/lib/aave/types";
import {
  PositionContext,
  PositionContextSupply,
  PositionContextBorrow,
  PositionContextAvailableAsset,
} from "./types";

/**
 * Build a compressed PositionContext from raw Aave data for LLM consumption.
 * Filters dust positions, rounds numbers, and sorts by size.
 */
export function buildPositionContext(
  healthFactorData: AaveHealthFactorData,
  formattedPoolReserves: FormattedReserve[],
  marketRefPriceUSD: number,
  merklIncentives?: MerklIncentiveData[]
): PositionContext {
  const hf = healthFactorData;

  const totalCollateralUSD =
    hf.totalCollateralMarketReferenceCurrency * marketRefPriceUSD;

  // Build supplies, filtering dust (< $0.01)
  const supplies: PositionContextSupply[] = hf.userReservesData
    .filter((r) => r.underlyingBalanceUSD >= 0.01)
    .map((r) => {
      const supplyIncentiveAPR = getIncentiveAPR(
        r.asset.symbol,
        "supply",
        formattedPoolReserves,
        merklIncentives
      );
      return {
        symbol: r.asset.symbol,
        balance: round(r.underlyingBalance, 6),
        balanceUSD: round(r.underlyingBalanceUSD, 2),
        supplyAPY: round(r.asset.supplyAPY ?? 0, 4),
        incentiveAPR: round(supplyIncentiveAPR, 4),
        usedAsCollateral: r.usageAsCollateralEnabledOnUser,
        ltv: round(r.asset.baseLTVasCollateral, 4),
        liquidationThreshold: round(r.asset.reserveLiquidationThreshold, 4),
      };
    })
    .sort((a, b) => b.balanceUSD - a.balanceUSD);

  // Build borrows, filtering dust
  const borrows: PositionContextBorrow[] = hf.userBorrowsData
    .filter((b) => b.totalBorrowsUSD >= 0.01)
    .map((b) => {
      const borrowIncentiveAPR = getIncentiveAPR(
        b.asset.symbol,
        "borrow",
        formattedPoolReserves,
        merklIncentives
      );
      return {
        symbol: b.asset.symbol,
        debt: round(b.totalBorrows, 6),
        debtUSD: round(b.totalBorrowsUSD, 2),
        borrowAPY: round(b.asset.variableBorrowAPY ?? 0, 4),
        incentiveAPR: round(borrowIncentiveAPR, 4),
      };
    })
    .sort((a, b) => b.debtUSD - a.debtUSD);

  // Build available assets (top 20 by yield potential)
  const userSupplySymbols = new Set(supplies.map((s) => s.symbol));
  const userBorrowSymbols = new Set(borrows.map((b) => b.symbol));

  const availableAssets: PositionContextAvailableAsset[] = formattedPoolReserves
    .filter(
      (r) =>
        r.isActive &&
        !r.isFrozen &&
        !r.isPaused
    )
    .map((r) => {
      const supplyIncAPR = getIncentiveAPR(
        r.symbol,
        "supply",
        formattedPoolReserves,
        merklIncentives
      );
      const borrowIncAPR = getIncentiveAPR(
        r.symbol,
        "borrow",
        formattedPoolReserves,
        merklIncentives
      );
      return {
        symbol: r.symbol as string,
        supplyAPY: round(Number(r.supplyAPY || 0), 4),
        borrowAPY: round(Number(r.variableBorrowAPY || 0), 4),
        supplyIncentiveAPR: round(supplyIncAPR, 4),
        borrowIncentiveAPR: round(borrowIncAPR, 4),
        ltv: round(Number(r.baseLTVasCollateral || 0), 4),
        liquidationThreshold: round(
          Number(r.reserveLiquidationThreshold || 0),
          4
        ),
        borrowingEnabled: Boolean(r.borrowingEnabled),
        priceUSD: round(Number(r.priceInUSD || 0), 2),
        // Score for sorting: total yield potential
        _yieldScore:
          Number(r.supplyAPY || 0) + supplyIncAPR + borrowIncAPR,
        _isUserAsset:
          userSupplySymbols.has(r.symbol) || userBorrowSymbols.has(r.symbol),
      };
    })
    .sort((a, b) => {
      // User assets first, then by yield potential
      if (a._isUserAsset !== b._isUserAsset)
        return a._isUserAsset ? -1 : 1;
      return b._yieldScore - a._yieldScore;
    })
    .slice(0, 20)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ _yieldScore, _isUserAsset, ...rest }) => rest);

  return {
    summary: {
      healthFactor: round(
        isFinite(hf.healthFactor) ? hf.healthFactor : 999,
        4
      ),
      totalCollateralUSD: round(totalCollateralUSD, 2),
      totalBorrowsUSD: round(hf.totalBorrowsUSD, 2),
      netWorthUSD: round(totalCollateralUSD - hf.totalBorrowsUSD, 2),
      availableBorrowsUSD: round(hf.availableBorrowsUSD, 2),
      currentLTV: round(hf.currentLoanToValue, 4),
      currentLiquidationThreshold: round(
        hf.currentLiquidationThreshold,
        4
      ),
      emodeCategoryId: hf.userEmodeCategoryId ?? 0,
    },
    supplies,
    borrows,
    availableAssets,
    marketConditions: {
      ethPriceUSD: round(marketRefPriceUSD, 2),
      timestamp: Math.floor(Date.now() / 1000),
    },
  };
}

/**
 * Serialize position context to compact JSON (no indentation).
 */
export function serializePositionContext(ctx: PositionContext): string {
  return JSON.stringify(ctx);
}

// --- Helpers ---

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate total incentive APR for a given asset and action.
 * Mirrors the pattern from src/lib/simulation/engine.ts:339-396.
 */
function getIncentiveAPR(
  symbol: string,
  action: "supply" | "borrow",
  formattedPoolReserves: FormattedReserve[],
  merklIncentives?: MerklIncentiveData[]
): number {
  let totalAPR = 0;

  const reserve = formattedPoolReserves.find((r) => r.symbol === symbol);
  if (!reserve) return 0;

  // Protocol incentives
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incentivesData: any[] =
    action === "supply"
      ? (reserve.aIncentivesData || [])
      : (reserve.vIncentivesData || []);

  for (const inc of incentivesData) {
    const apr = Number(inc.incentiveAPR ?? 0);
    if (apr > 0) totalAPR += apr;
  }

  // Merkl incentives
  if (merklIncentives) {
    const underlyingAsset = (
      reserve.underlyingAsset as string
    )?.toLowerCase();
    for (const mi of merklIncentives) {
      if (
        mi.underlyingAsset?.toLowerCase() === underlyingAsset &&
        mi.action === action
      ) {
        totalAPR += mi.apr;
      }
    }
  }

  return totalAPR;
}
