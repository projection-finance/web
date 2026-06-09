import { PositionContext } from "@/src/lib/ai/types";

/**
 * Calculate the net APY of a position.
 *
 * netAPY = (Σ supplyUSD * (supplyAPY + incentiveAPR)
 *         - Σ borrowUSD * (borrowAPY - incentiveAPR))
 *         / netWorthUSD
 *
 * Returns 0 if netWorthUSD <= 0 to avoid division by zero.
 */
export function calculateNetAPY(ctx: PositionContext): number {
  const { netWorthUSD } = ctx.summary;
  if (netWorthUSD <= 0) return 0;

  let supplyYield = 0;
  for (const s of ctx.supplies) {
    supplyYield += s.balanceUSD * (s.supplyAPY + s.incentiveAPR);
  }

  let borrowCost = 0;
  for (const b of ctx.borrows) {
    borrowCost += b.debtUSD * (b.borrowAPY - b.incentiveAPR);
  }

  return (supplyYield - borrowCost) / netWorthUSD;
}
