import BigNumber from "bignumber.js";

const RAY = new BigNumber("1000000000000000000000000000"); // 1e27

export interface InterestRateResult {
  utilizationRate: number; // decimal (e.g., 0.45)
  variableBorrowRate: string; // RAY string
  liquidityRate: string; // RAY string
  variableBorrowAPY: number; // decimal (e.g., 0.05 = 5%)
  supplyAPY: number; // decimal
}

/**
 * Calculate AAVE V3 interest rates from pool parameters.
 *
 * AAVE V3 formula (DefaultReserveInterestRateStrategyV2):
 *   U = totalDebt / totalLiquidity
 *   If U <= Uo: borrowRate = baseRate + slope1 * U / Uo
 *   If U > Uo:  borrowRate = baseRate + slope1 + slope2 * (U - Uo) / (1 - Uo)
 *   supplyRate = borrowRate * U * (1 - reserveFactor)
 *
 * @param totalDebt - normalized token units (e.g., "1234567.89")
 * @param totalLiquidity - normalized token units
 * @param optimalUsageRatio - RAY string from blockchain
 * @param baseVariableBorrowRate - RAY string
 * @param variableRateSlope1 - RAY string
 * @param variableRateSlope2 - RAY string
 * @param reserveFactor - normalized decimal string (e.g., "0.1" for 10%)
 */
export function calculateInterestRates(
  totalDebt: BigNumber,
  totalLiquidity: BigNumber,
  optimalUsageRatio: string,
  baseVariableBorrowRate: string,
  variableRateSlope1: string,
  variableRateSlope2: string,
  reserveFactor: string
): InterestRateResult {
  // Convert RAY params to decimals
  const Uo = new BigNumber(optimalUsageRatio).dividedBy(RAY);
  const baseRate = new BigNumber(baseVariableBorrowRate).dividedBy(RAY);
  const slope1 = new BigNumber(variableRateSlope1).dividedBy(RAY);
  const slope2 = new BigNumber(variableRateSlope2).dividedBy(RAY);
  const rf = new BigNumber(reserveFactor);

  // Utilization ratio
  let U: BigNumber;
  if (totalLiquidity.isZero() || totalLiquidity.isNaN()) {
    U = new BigNumber(0);
  } else {
    U = totalDebt.dividedBy(totalLiquidity);
  }

  // Borrow rate
  let borrowRate: BigNumber;
  if (U.lte(Uo)) {
    if (Uo.isZero()) {
      borrowRate = baseRate;
    } else {
      borrowRate = baseRate.plus(slope1.multipliedBy(U).dividedBy(Uo));
    }
  } else {
    const excessU = U.minus(Uo);
    const maxExcess = new BigNumber(1).minus(Uo);
    if (maxExcess.isZero()) {
      borrowRate = baseRate.plus(slope1);
    } else {
      borrowRate = baseRate
        .plus(slope1)
        .plus(slope2.multipliedBy(excessU).dividedBy(maxExcess));
    }
  }

  // Supply rate
  const supplyRate = borrowRate
    .multipliedBy(U)
    .multipliedBy(new BigNumber(1).minus(rf));

  // Convert back to RAY for storage
  const variableBorrowRateRAY = borrowRate.multipliedBy(RAY).toFixed(0);
  const liquidityRateRAY = supplyRate.multipliedBy(RAY).toFixed(0);

  return {
    utilizationRate: U.toNumber(),
    variableBorrowRate: variableBorrowRateRAY,
    liquidityRate: liquidityRateRAY,
    variableBorrowAPY: borrowRate.toNumber(),
    supplyAPY: supplyRate.toNumber(),
  };
}

/**
 * Convenience wrapper: extract parameters from a FormattedReserve and compute new rates.
 * Used after actions modify totalDebt/totalLiquidity.
 */
export function calculateRatesForReserve(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reserve: Record<string, any>,
  newTotalDebt: BigNumber,
  newTotalLiquidity: BigNumber
): InterestRateResult {
  return calculateInterestRates(
    newTotalDebt,
    newTotalLiquidity,
    reserve.optimalUsageRatio || "0",
    reserve.baseVariableBorrowRate || "0",
    reserve.variableRateSlope1 || "0",
    reserve.variableRateSlope2 || "0",
    reserve.reserveFactor || "0"
  );
}
