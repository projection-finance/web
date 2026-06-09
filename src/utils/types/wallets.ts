export interface Wallet {
  address: string;
  name: string;
  snapshotPosition: SnapshotPosition;
  supplies: Supply[];
  borrows: Borrow[];
  assetsToSupply: AssetsToSupply[];
  assetsToBorrow: AssetsToBorrow[];
  projectionTimeline: ProjectionTimeline[];
}

export interface AssetsToBorrow {
  asset: string;
  available: number;
  apyBorrowRate: string;
}

export interface AssetsToSupply {
  asset: string;
  walletBalance: number;
  apy: number;
  collaterability: boolean;
}

export interface Borrow {
  asset: string;
  debt: number;
  valueUSD: number;
  apy: string;
}

export interface ProjectionTimeline {
  date: Date;
  portfolioValue: number;
}

export interface SnapshotPosition {
  netWorth: number;
  netAPY: number;
  totalCollateral: number;
  totalBorrow: number;
  availableForBorrow: number;
  healthFactor: number;
  lv: number;
}

export interface Supply {
  asset: string;
  balance: number;
  valueUSD: number;
  apy: string;
  collateral: number;
}
