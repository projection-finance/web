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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormattedReserve = Record<string, any>;

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
