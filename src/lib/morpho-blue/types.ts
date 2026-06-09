/**
 * Morpho Blue position types.
 *
 * Morpho Blue has isolated lending markets — each market is defined by
 * (loanToken, collateralToken, oracle, irm, lltv). Users can supply the
 * loan asset for yield, and/or borrow against collateral.
 * Collateral earns ZERO interest.
 */

export interface MorphoBlueMarketInfo {
  uniqueKey: string;        // bytes32 market ID
  chainId: number;
  loanSymbol: string;
  loanAddress: string;
  loanDecimals: number;
  collateralSymbol: string;
  collateralAddress: string;
  collateralDecimals: number;
  lltv: number;             // e.g. 0.86 for 86%
  supplyApy: number;
  borrowApy: number;
  supplyAssetsUsd: number;
  borrowAssetsUsd: number;
  utilization: number;
}

export interface MorphoBlueCollateralBalance {
  symbol: string;
  address: string;
  balance: number;
  balanceUSD: number;
  priceUSD: number;
}

export interface MorphoBlueMarketPosition {
  uniqueKey: string;
  chainId: number;
  chainName: string;
  loanSymbol: string;
  loanDecimals: number;
  collateralSymbol: string;
  lltv: number;
  // Supply or borrow (can have both in same market in Blue)
  supplyBalance: number;
  supplyBalanceUSD: number;
  borrowBalance: number;
  borrowBalanceUSD: number;
  collateralBalance: number;
  collateralBalanceUSD: number;
  // Rates
  supplyAPY: number;
  borrowAPY: number;
  // Derived
  healthFactor: number;     // (collateralUSD * lltv) / borrowUSD, Infinity if no borrow
  // Market info for simulation
  marketInfo: MorphoBlueMarketInfo;
}

export interface MorphoBluePositionData {
  address: string;
  markets: MorphoBlueMarketPosition[];
  totalSupplyUSD: number;
  totalBorrowUSD: number;
  totalCollateralUSD: number;
  netWorthUSD: number;
}
