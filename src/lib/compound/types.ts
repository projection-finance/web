/**
 * Compound V3 (Comet) position types.
 *
 * Key difference from Aave: each market has ONE base asset (supply/borrow)
 * and multiple collateral assets that earn ZERO interest.
 * A user is either a supplier OR borrower of the base asset, never both.
 */

// ── Collateral asset info (from on-chain getAssetInfo) ──

export interface CompoundCollateralAsset {
  symbol: string;
  address: string;
  priceFeedAddress: string;
  decimals: number;
  priceUSD: number;
  borrowCollateralFactor: number;    // e.g. 0.825
  liquidateCollateralFactor: number; // e.g. 0.895
  supplyCap: number;                 // in token units
}

// ── User's collateral balance ──

export interface CompoundCollateralBalance {
  symbol: string;
  address: string;
  balance: number;
  balanceUSD: number;
  priceUSD: number;
  borrowCollateralFactor: number;
  liquidateCollateralFactor: number;
}

// ── Per-market position ──

export interface CompoundMarketPosition {
  marketId: string;
  cometProxy: string;
  chainId: number;
  chainName: string;
  baseSymbol: string;
  baseDecimals: number;
  baseTokenAddress: string;
  basePriceUSD: number;
  // Supply or borrow (mutually exclusive)
  baseSupplyBalance: number;
  baseSupplyBalanceUSD: number;
  baseBorrowBalance: number;
  baseBorrowBalanceUSD: number;
  // Rates
  supplyAPY: number;
  borrowAPY: number;
  // Collateral
  collaterals: CompoundCollateralBalance[];
  collateralAssets: CompoundCollateralAsset[];
  // Derived
  totalCollateralUSD: number;
  borrowCapacityUSD: number;
  liquidationRiskUSD: number;
  healthFactor: number; // Infinity if no borrow
}

// ── Top-level position data ──

export interface CompoundPositionData {
  address: string;
  markets: CompoundMarketPosition[];
  totalSupplyUSD: number;
  totalBorrowUSD: number;
  totalCollateralUSD: number;
  netWorthUSD: number;
}
