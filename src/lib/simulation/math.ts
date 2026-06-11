/**
 * Shared interest-math helpers used by the simulation engines
 * (Aave sandbox tokens, Compound, Morpho, Morpho Blue).
 */

/**
 * Per-day compounding rate equivalent to a yearly APY: (1 + APY)^(1/365) − 1.
 * Guards against APY <= -100% which would produce NaN.
 */
export function dailyRateFromAPY(apy: number): number {
  const safe = Math.max(apy, -0.999999);
  return Math.pow(1 + safe, 1 / 365) - 1;
}

/**
 * One day of compound interest on (principal + already-accrued interest).
 * Negative APYs are clamped to 0.
 */
export function compoundDailyInterest(
  principal: number,
  accrued: number,
  apy: number
): number {
  return (principal + accrued) * dailyRateFromAPY(Math.max(apy, 0));
}
