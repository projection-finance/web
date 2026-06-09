/**
 * Compound V3 (Comet) position reader.
 *
 * Reads user positions directly from Comet proxy contracts via RPC.
 * Each market is queried independently: base supply/borrow + collateral balances.
 */

import { ethers } from "ethers";
import type { CompoundChain, CompoundMarket } from "./config";
import { COMPOUND_CHAINS } from "./config";
import { createMonitoredProvider } from "@/src/lib/rpc-monitor";
import type {
  CompoundMarketPosition,
  CompoundPositionData,
  CompoundCollateralAsset,
  CompoundCollateralBalance,
} from "./types";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const TIMEOUT_MS = 15_000;
const SECONDS_PER_YEAR = 31_536_000;
const FACTOR_SCALE = 1e18;

const COMET_ABI = [
  "function baseToken() view returns (address)",
  "function baseTokenPriceFeed() view returns (address)",
  "function getPrice(address priceFeed) view returns (uint256)",
  "function getUtilization() view returns (uint256)",
  "function getSupplyRate(uint256 utilization) view returns (uint64)",
  "function getBorrowRate(uint256 utilization) view returns (uint64)",
  "function balanceOf(address account) view returns (uint256)",
  "function borrowBalanceOf(address account) view returns (uint256)",
  "function numAssets() view returns (uint8)",
  "function getAssetInfo(uint8 i) view returns (tuple(uint8 offset, address asset, address priceFeed, uint64 scale, uint64 borrowCollateralFactor, uint64 liquidateCollateralFactor, uint64 liquidationFactor, uint128 supplyCap))",
  "function collateralBalanceOf(address account, address asset) view returns (uint128)",
];

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

async function fetchMarketPosition(
  provider: ethers.providers.StaticJsonRpcProvider,
  market: CompoundMarket,
  chain: CompoundChain,
  userAddress: string,
): Promise<CompoundMarketPosition | null> {
  try {
    const comet = new ethers.Contract(market.cometProxy, COMET_ABI, provider);

    // Batch core reads
    const [
      baseToken,
      priceFeed,
      utilization,
      supplyBalanceRaw,
      borrowBalanceRaw,
      numAssets,
    ] = await Promise.all([
      comet.baseToken(),
      comet.baseTokenPriceFeed(),
      comet.getUtilization(),
      comet.balanceOf(userAddress),
      comet.borrowBalanceOf(userAddress),
      comet.numAssets(),
    ]);

    const [basePriceRaw, supplyRatePerSec, borrowRatePerSec] =
      await Promise.all([
        comet.getPrice(priceFeed),
        comet.getSupplyRate(utilization),
        comet.getBorrowRate(utilization),
      ]);

    const basePriceUSD = Number(basePriceRaw) / 1e8;
    const supplyAPY =
      Math.pow(1 + Number(supplyRatePerSec) / FACTOR_SCALE, SECONDS_PER_YEAR) -
      1;
    const borrowAPY =
      Math.pow(1 + Number(borrowRatePerSec) / FACTOR_SCALE, SECONDS_PER_YEAR) -
      1;

    const baseSupplyBalance = Number(
      ethers.utils.formatUnits(supplyBalanceRaw, market.baseDecimals),
    );
    const baseBorrowBalance = Number(
      ethers.utils.formatUnits(borrowBalanceRaw, market.baseDecimals),
    );

    // Read collateral asset info
    const numAssetsNum = Number(numAssets);
    const assetInfoPromises = [];
    for (let i = 0; i < numAssetsNum; i++) {
      assetInfoPromises.push(comet.getAssetInfo(i));
    }
    const assetInfos = await Promise.all(assetInfoPromises);

    // Read collateral balances and metadata
    const collateralAssets: CompoundCollateralAsset[] = [];
    const collaterals: CompoundCollateralBalance[] = [];

    const collateralPromises = assetInfos.map(async (info) => {
      const assetAddress = (info.asset as string).toLowerCase();
      const assetPriceFeed = info.priceFeed as string;
      const borrowCF = Number(info.borrowCollateralFactor) / FACTOR_SCALE;
      const liquidateCF =
        Number(info.liquidateCollateralFactor) / FACTOR_SCALE;
      const scale = Number(info.scale);
      // scale = 10^decimals for the asset
      const decimals = Math.round(Math.log10(scale));
      const supplyCap = Number(info.supplyCap) / scale;

      // Get symbol + price + user balance in parallel
      const erc20 = new ethers.Contract(assetAddress, ERC20_ABI, provider);
      const [symbol, priceRaw, balanceRaw] = await Promise.all([
        erc20.symbol().catch(() => "???"),
        comet.getPrice(assetPriceFeed),
        comet.collateralBalanceOf(userAddress, assetAddress),
      ]);

      const priceUSD = Number(priceRaw) / 1e8;
      const balance = Number(balanceRaw) / scale;

      collateralAssets.push({
        symbol,
        address: assetAddress,
        priceFeedAddress: assetPriceFeed,
        decimals,
        priceUSD,
        borrowCollateralFactor: borrowCF,
        liquidateCollateralFactor: liquidateCF,
        supplyCap,
      });

      if (balance > 0) {
        collaterals.push({
          symbol,
          address: assetAddress,
          balance,
          balanceUSD: balance * priceUSD,
          priceUSD,
          borrowCollateralFactor: borrowCF,
          liquidateCollateralFactor: liquidateCF,
        });
      }
    });

    await Promise.all(collateralPromises);

    // Compute derived values
    const totalCollateralUSD = collaterals.reduce(
      (s, c) => s + c.balanceUSD,
      0,
    );
    const borrowCapacityUSD =
      collaterals.reduce(
        (s, c) => s + c.balanceUSD * c.borrowCollateralFactor,
        0,
      ) -
      baseBorrowBalance * basePriceUSD;
    const liquidationRiskUSD = collaterals.reduce(
      (s, c) => s + c.balanceUSD * c.liquidateCollateralFactor,
      0,
    );
    const healthFactor =
      baseBorrowBalance > 0
        ? liquidationRiskUSD / (baseBorrowBalance * basePriceUSD)
        : Infinity;

    return {
      marketId: market.id,
      cometProxy: market.cometProxy,
      chainId: chain.chainId,
      chainName: chain.name,
      baseSymbol: market.baseSymbol,
      baseDecimals: market.baseDecimals,
      baseTokenAddress: (baseToken as string).toLowerCase(),
      basePriceUSD,
      baseSupplyBalance,
      baseSupplyBalanceUSD: baseSupplyBalance * basePriceUSD,
      baseBorrowBalance,
      baseBorrowBalanceUSD: baseBorrowBalance * basePriceUSD,
      supplyAPY,
      borrowAPY,
      collaterals,
      collateralAssets,
      totalCollateralUSD,
      borrowCapacityUSD,
      liquidationRiskUSD,
      healthFactor,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch Compound V3 position for a wallet across all chains/markets.
 * Only returns markets where the user has any balance (supply, borrow, or collateral).
 */
export async function fetchCompoundPosition(
  address: string,
  chainIds?: number[],
): Promise<CompoundPositionData> {
  const chains = chainIds
    ? COMPOUND_CHAINS.filter((c) => chainIds.includes(c.chainId))
    : COMPOUND_CHAINS;

  const allMarkets: CompoundMarketPosition[] = [];

  const chainPromises = chains.map(async (chain) => {
    const rpcUrl = `https://${chain.alchemySlug}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    const provider = createMonitoredProvider(rpcUrl, `COMPOUND_${chain.name}`);

    const timer = setTimeout(() => {}, TIMEOUT_MS);

    try {
      const results = await Promise.allSettled(
        chain.markets.map((market) =>
          fetchMarketPosition(provider, market, chain, address),
        ),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          const pos = result.value;
          // Only include markets where user has any position
          if (
            pos.baseSupplyBalance > 0 ||
            pos.baseBorrowBalance > 0 ||
            pos.collaterals.length > 0
          ) {
            allMarkets.push(pos);
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }
  });

  await Promise.allSettled(chainPromises);

  const totalSupplyUSD = allMarkets.reduce(
    (s, m) => s + m.baseSupplyBalanceUSD,
    0,
  );
  const totalBorrowUSD = allMarkets.reduce(
    (s, m) => s + m.baseBorrowBalanceUSD,
    0,
  );
  const totalCollateralUSD = allMarkets.reduce(
    (s, m) => s + m.totalCollateralUSD,
    0,
  );

  return {
    address,
    markets: allMarkets,
    totalSupplyUSD,
    totalBorrowUSD,
    totalCollateralUSD,
    netWorthUSD: totalSupplyUSD + totalCollateralUSD - totalBorrowUSD,
  };
}
