import { ChainId } from "@aave/contract-helpers";
import { EmodeCategory } from "./emode";

export type AssetDetails = {
  symbol: string;
  name: string;
  priceInUSD: number;
  priceInMarketReferenceCurrency: number;
  baseLTVasCollateral: number;
  isActive?: boolean;
  isFrozen?: boolean;
  isIsolated?: boolean;
  isPaused?: boolean;
  reserveLiquidationThreshold: number;
  reserveFactor: number;
  usageAsCollateralEnabled: boolean;
  initialPriceInUSD: number;
  aTokenAddress?: string;
  variableDebtTokenAddress?: string;
  underlyingAsset?: string;
  decimals?: number;
  isNewlyAddedBySimUser?: boolean;
  borrowingEnabled?: boolean;
  liquidityIndex?: number;
  variableBorrowIndex?: number;
  liquidityRate?: number;
  variableBorrowRate?: number;
  availableLiquidity?: number;
  borrowCap?: number;
  supplyCap?: number;
  eModeLtv?: number;
  eModeLiquidationThreshold?: number;
  eModeLabel?: string;
  eModeCategoryId?: number;
  borrowableInIsolation?: boolean;
  isSiloedBorrowing?: boolean;
  totalDebt?: number;
  totalVariableDebt?: number;
  totalLiquidity?: number;
  flashLoanEnabled?: boolean;
  supplyAPY?: number;
  variableBorrowAPY?: number;
  supplyAPR?: number;
  variableBorrowAPR?: number;
  walletBalance?: number;
  isRewardToken?: boolean;
};

export type ReserveAssetDataItem = {
  asset: AssetDetails;
  underlyingBalance: number;
  underlyingBalanceUSD: number;
  underlyingBalanceMarketReferenceCurrency: number;
  usageAsCollateralEnabledOnUser: boolean;
  scaledATokenBalance?: string;
};

export type BorrowedAssetDataItem = {
  asset: AssetDetails;
  stableBorrows?: number;
  variableBorrows?: number;
  totalBorrows: number;
  totalBorrowsUSD: number;
  stableBorrowAPY: number;
  totalBorrowsMarketReferenceCurrency: number;
  scaledVariableDebt?: string;
};

export type AaveHealthFactorData = {
  address?: string;
  healthFactor: number;
  totalBorrowsUSD: number;
  availableBorrowsUSD: number;
  totalCollateralMarketReferenceCurrency: number;
  totalBorrowsMarketReferenceCurrency: number;
  currentLiquidationThreshold: number;
  currentLoanToValue: number;
  userReservesData: ReserveAssetDataItem[];
  userBorrowsData: BorrowedAssetDataItem[];
  userEmodeCategoryId?: number;
  isInIsolationMode?: boolean;
};

export type RawUserReserve = {
  underlyingAsset: string;
  scaledATokenBalance: string;
  usageAsCollateralEnabledOnUser: boolean;
  scaledVariableDebt: string;
};

export type MerklIncentiveData = {
  underlyingAsset: string;
  action: "supply" | "borrow";
  apr: number;
  rewardTokenSymbol: string;
  rewardTokenAddress: string;
  rewardTokenPriceUSD?: number;
};

export type AavePositionData = {
  address: string;
  marketReferenceCurrencyPriceInUSD: number;
  availableAssets: AssetDetails[];
  fetchedData: AaveHealthFactorData;
  workingData: AaveHealthFactorData;
  // Raw data needed for offline recalculation via formatUserSummary
  rawUserReserves: RawUserReserve[];
  formattedPoolReserves: FormattedReserve[];
  baseCurrencyData: BaseCurrencyData;
  userEmodeCategoryId: number;
  emodeCategories: EmodeCategory[];
  merklIncentives?: MerklIncentiveData[];
};

export type BaseCurrencyData = {
  marketReferenceCurrencyDecimals: number;
  marketReferenceCurrencyPriceInUsd: string;
  networkBaseTokenPriceInUsd: string;
  networkBaseTokenPriceDecimals: number;
};

/**
 * Incentive entry attached to a reserve by formatReservesAndIncentives.
 */
export type ReserveIncentive = {
  incentiveAPR: string | number;
  rewardTokenSymbol?: string;
  rewardTokenAddress?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/**
 * Per-reserve eMode entry (Aave V3.1+, from formatReservesAndIncentives
 * called with the eModes parameter).
 */
export type ReserveEMode = {
  id: number;
  collateralEnabled?: boolean;
  borrowingEnabled?: boolean;
  eMode: {
    label?: string;
    ltv: string | number;
    liquidationThreshold: string | number;
    liquidationBonus: string | number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
};

/**
 * A reserve as returned by @aave/math-utils formatReservesAndIncentives,
 * possibly mutated by the simulation engine (indices, rates, prices).
 *
 * Known/commonly-used fields are typed; the index signature keeps the rest
 * of the (large) math-utils output accessible.
 */
export interface FormattedReserve {
  symbol: string;
  underlyingAsset: string;
  name?: string;
  decimals?: string | number;

  // Indices & rates (RAY strings, advanced daily by the engine)
  liquidityIndex?: string;
  variableBorrowIndex?: string;
  liquidityRate?: string;
  variableBorrowRate?: string;
  lastUpdateTimestamp?: number;

  // Formatted APYs/APRs (decimal strings, e.g. "0.031")
  supplyAPY?: string | number;
  variableBorrowAPY?: string | number;
  supplyAPR?: string | number;
  variableBorrowAPR?: string | number;

  // Pool state (normalized token units)
  totalDebt?: string;
  totalLiquidity?: string;
  availableLiquidity?: string | number;
  formattedAvailableLiquidity?: string | number;

  // Prices
  priceInUSD?: string | number;
  priceInMarketReferenceCurrency?: string | number;

  // Risk parameters
  baseLTVasCollateral?: string | number; // raw bps (e.g. "7500")
  formattedBaseLTVasCollateral?: string | number; // decimal (e.g. "0.75")
  reserveLiquidationThreshold?: string | number; // raw bps
  formattedReserveLiquidationThreshold?: string | number; // decimal
  reserveLiquidationBonus?: string | number; // raw bps (e.g. "10500")
  formattedReserveLiquidationBonus?: string | number; // decimal (e.g. "0.05")
  reserveFactor?: string;

  // Interest rate strategy (RAY strings)
  optimalUsageRatio?: string;
  baseVariableBorrowRate?: string;
  variableRateSlope1?: string;
  variableRateSlope2?: string;

  // Flags
  isActive?: boolean;
  isFrozen?: boolean;
  isPaused?: boolean;
  borrowingEnabled?: boolean;
  usageAsCollateralEnabled?: boolean;
  isSiloedBorrowing?: boolean;
  borrowableInIsolation?: boolean;

  // Caps
  borrowCap?: string | number;
  supplyCap?: string | number;

  // Token addresses
  aTokenAddress?: string;
  variableDebtTokenAddress?: string;

  // Incentives & eModes
  aIncentivesData?: ReserveIncentive[];
  vIncentivesData?: ReserveIncentive[];
  eModes?: ReserveEMode[];
  eModeCategoryId?: string | number;

  // Remaining fields from the math-utils output
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export type AaveMarketConfig = {
  id: string;
  title: string;
  chainId: ChainId;
  rpcUrl: string;
  protocol?: "aave" | "spark"; // defaults to "aave"
  disabled?: boolean; // true = market temporarily unavailable (e.g. contract timeout)
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: string;
    UI_POOL_DATA_PROVIDER: string;
    UI_INCENTIVE_DATA_PROVIDER: string;
  };
};

// --- Simulation types ---

export type SimActionType =
  | "supply"
  | "borrow"
  | "repay"
  | "withdraw"
  | "price_change"
  | "toggle_collateral"
  | "set_emode"
  | "set_wallet_balance";

export type SimAction = {
  id: string;
  type: SimActionType;
  symbol: string;
  amount?: number;
  newPriceUSD?: number; // for price_change
  useAsCollateral?: boolean; // for supply
  repayFromCollateral?: boolean; // for repay: withdraw from supply then repay
  newEmodeCategoryId?: number; // for set_emode
  timestamp: number;
};

export type SimSnapshot = {
  id: string;
  label: string;
  action: SimAction | null; // null = initial state
  healthFactorData: AaveHealthFactorData;
  rawUserReserves: RawUserReserve[];
  formattedPoolReserves: FormattedReserve[];
  marketReferenceCurrencyPriceInUSD: number;
  walletBalances: Record<string, number>; // symbol → balance
  userEmodeCategoryId: number;
};
