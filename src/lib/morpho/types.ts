// ── Morpho vault position types ──

export interface MorphoVaultPosition {
  vaultName: string;
  vaultAddress: string;
  chainId: number;
  assetSymbol: string;
  assetDecimals: number;
  netApy: number; // decimal (e.g. 0.05 = 5%)
  depositedUsd: number;
  pnlUsd: number;
  vaultVersion: "v1" | "v2";
}

export interface MorphoPositionData {
  address: string;
  positions: MorphoVaultPosition[];
  totalDepositedUsd: number;
  totalPnlUsd: number;
}
