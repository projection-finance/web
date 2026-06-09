/**
 * Uniswap V3 position and pool types.
 */

export interface UniswapPool {
  address: string;
  chainId: number;
  token0Symbol: string;
  token0Address: string;
  token0Decimals: number;
  token1Symbol: string;
  token1Address: string;
  token1Decimals: number;
  feeTier: number;        // 100, 500, 3000, 10000
  tickSpacing: number;
  currentTick: number;
  currentPrice: number;   // token0 priced in token1
  sqrtPriceX96: string;
  totalLiquidity: number; // active in-range liquidity
  volumeUSD24h: number;
  feesUSD24h: number;
  tvlUSD: number;
}

export interface UniswapPosition {
  tokenId: string;
  pool: UniswapPool;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  liquidity: number;
  amount0: number;
  amount1: number;
  valueUSD: number;
  unclaimedFees0: number;
  unclaimedFees1: number;
  unclaimedFeesUSD: number;
  inRange: boolean;
}

export interface UniswapPositionData {
  address: string;
  positions: UniswapPosition[];
  totalValueUSD: number;
  totalFeesUSD: number;
}
