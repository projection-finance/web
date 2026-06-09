/**
 * Uniswap V3 concentrated liquidity math.
 *
 * All formulas use float sqrt prices (not Q64.96 encoding).
 * Reference: Uniswap V3 whitepaper, SqrtPriceMath.sol, LiquidityAmounts.sol
 */

// ── Tick ↔ Price conversions ──

export function tickToPrice(tick: number): number {
  return 1.0001 ** tick;
}

export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

export function tickToSqrtPrice(tick: number): number {
  return Math.sqrt(1.0001 ** tick);
}

/**
 * Snap a tick to the nearest valid tick for a given tick spacing.
 */
export function snapTick(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing;
}

// ── Fee tier → tick spacing ──

export const FEE_TIER_TICK_SPACING: Record<number, number> = {
  100: 1,     // 0.01%
  500: 10,    // 0.05%
  3000: 60,   // 0.30%
  10000: 200, // 1.00%
};

// ── Core CL formulas ──

/**
 * Compute token amounts for a position given liquidity and price.
 *
 * Three cases:
 * - Price below range: 100% token0
 * - Price in range: mix of token0 and token1
 * - Price above range: 100% token1
 */
export function getAmounts(
  liquidity: number,
  currentPrice: number,
  priceLower: number,
  priceUpper: number,
): { amount0: number; amount1: number } {
  const sa = Math.sqrt(priceLower);
  const sb = Math.sqrt(priceUpper);
  const sp = Math.sqrt(Math.max(priceLower, Math.min(priceUpper, currentPrice)));

  if (currentPrice <= priceLower) {
    // 100% token0
    return {
      amount0: liquidity * (sb - sa) / (sa * sb),
      amount1: 0,
    };
  } else if (currentPrice >= priceUpper) {
    // 100% token1
    return {
      amount0: 0,
      amount1: liquidity * (sb - sa),
    };
  } else {
    // In range: mix
    return {
      amount0: liquidity * (sb - sp) / (sp * sb),
      amount1: liquidity * (sp - sa),
    };
  }
}

/**
 * Compute liquidity from deposit amounts and price range.
 * Takes the minimum of L_from_token0 and L_from_token1 (unused excess returned).
 */
export function getLiquidityFromAmounts(
  amount0: number,
  amount1: number,
  currentPrice: number,
  priceLower: number,
  priceUpper: number,
): number {
  const sa = Math.sqrt(priceLower);
  const sb = Math.sqrt(priceUpper);
  const sp = Math.sqrt(Math.max(priceLower, Math.min(priceUpper, currentPrice)));

  if (currentPrice <= priceLower) {
    return amount0 * (sa * sb) / (sb - sa);
  } else if (currentPrice >= priceUpper) {
    return amount1 / (sb - sa);
  } else {
    const L0 = amount0 * (sp * sb) / (sb - sp);
    const L1 = amount1 / (sp - sa);
    return Math.min(L0, L1);
  }
}

/**
 * Position value in USD.
 */
export function positionValueUSD(
  liquidity: number,
  currentPrice: number,
  priceLower: number,
  priceUpper: number,
  price0USD: number,
  price1USD: number,
): number {
  const { amount0, amount1 } = getAmounts(liquidity, currentPrice, priceLower, priceUpper);
  return amount0 * price0USD + amount1 * price1USD;
}

/**
 * Compute impermanent loss vs holding.
 */
export function computeIL(
  liquidity: number,
  priceInitial: number,
  priceCurrent: number,
  priceLower: number,
  priceUpper: number,
): { ilAbsolute: number; ilPercent: number; lpValue: number; holdValue: number } {
  // Initial amounts at deposit price
  const init = getAmounts(liquidity, priceInitial, priceLower, priceUpper);

  // HODL value: just hold initial amounts at current price
  const holdValue = init.amount0 * priceCurrent + init.amount1;

  // LP value at current price
  const curr = getAmounts(liquidity, priceCurrent, priceLower, priceUpper);
  const lpValue = curr.amount0 * priceCurrent + curr.amount1;

  const ilAbsolute = lpValue - holdValue;
  const ilPercent = holdValue > 0 ? ilAbsolute / holdValue : 0;

  return { ilAbsolute, ilPercent, lpValue, holdValue };
}

/**
 * Estimate daily fee income for a position.
 *
 * fee = poolDailyVolume * feeTier * (positionLiquidity / totalActiveLiquidity)
 *
 * Only earns fees when price is in range.
 */
export function estimateDailyFees(
  poolDailyVolumeUSD: number,
  feeTier: number,
  positionLiquidity: number,
  totalActiveLiquidity: number,
  inRange: boolean,
): number {
  if (!inRange || totalActiveLiquidity <= 0) return 0;
  const totalFees = poolDailyVolumeUSD * feeTier;
  return totalFees * (positionLiquidity / totalActiveLiquidity);
}

/**
 * Check if current price is within the position's range.
 */
export function isInRange(currentPrice: number, priceLower: number, priceUpper: number): boolean {
  return currentPrice > priceLower && currentPrice < priceUpper;
}
