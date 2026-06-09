/**
 * Morpho Blue position reader via GraphQL API.
 * No RPC calls needed — everything comes from api.morpho.org.
 */

import { MORPHO_API_URL, MORPHO_BLUE_CHAINS } from "./config";
import type { MorphoBluePositionData, MorphoBlueMarketPosition, MorphoBlueMarketInfo } from "./types";

const TIMEOUT_MS = 20_000;
const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 8453: "Base" };

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(MORPHO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Morpho API ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}

const POSITION_QUERY = `
query BluePositions($address: String!, $chainId: Int!) {
  userByAddress(address: $address, chainId: $chainId) {
    address
    marketPositions {
      market {
        uniqueKey
        lltv
        loanAsset { address symbol decimals }
        collateralAsset { address symbol decimals }
        state { supplyApy borrowApy supplyAssetsUsd borrowAssetsUsd utilization }
      }
      state {
        supplyAssets
        supplyAssetsUsd
        borrowAssets
        borrowAssetsUsd
        collateral
        collateralUsd
      }
    }
  }
}`;

interface GqlPositionItem {
  market: {
    uniqueKey: string;
    lltv: string;
    loanAsset: { address: string; symbol: string; decimals: number };
    collateralAsset: { address: string; symbol: string; decimals: number } | null;
    state: { supplyApy: number; borrowApy: number; supplyAssetsUsd: number; borrowAssetsUsd: number; utilization: number };
  };
  state: {
    supplyAssets: number;
    supplyAssetsUsd: number;
    borrowAssets: number;
    borrowAssetsUsd: number;
    collateral: number;
    collateralUsd: number;
  };
}

export async function fetchMorphoBluePosition(
  address: string,
  chainIds?: number[],
): Promise<MorphoBluePositionData> {
  const chains = chainIds
    ? MORPHO_BLUE_CHAINS.filter((c) => chainIds.includes(c.chainId))
    : MORPHO_BLUE_CHAINS;

  const allMarkets: MorphoBlueMarketPosition[] = [];

  const promises = chains.map(async (chain) => {
    try {
      const data = await gql<{
        userByAddress: { address: string; marketPositions: GqlPositionItem[] } | null;
      }>(POSITION_QUERY, { address: address.toLowerCase(), chainId: chain.chainId });

      const user = data.userByAddress;
      if (!user?.marketPositions) return;

      for (const pos of user.marketPositions) {
        const s = pos.state;
        // Skip if no position at all
        if (s.supplyAssetsUsd === 0 && s.borrowAssetsUsd === 0 && s.collateralUsd === 0) continue;
        if (!pos.market.collateralAsset) continue;

        const lltv = Number(pos.market.lltv) / 1e18;
        const hf = s.borrowAssetsUsd > 0
          ? (s.collateralUsd * lltv) / s.borrowAssetsUsd
          : Infinity;

        const marketInfo: MorphoBlueMarketInfo = {
          uniqueKey: pos.market.uniqueKey,
          chainId: chain.chainId,
          loanSymbol: pos.market.loanAsset.symbol,
          loanAddress: pos.market.loanAsset.address,
          loanDecimals: pos.market.loanAsset.decimals,
          collateralSymbol: pos.market.collateralAsset.symbol,
          collateralAddress: pos.market.collateralAsset.address,
          collateralDecimals: pos.market.collateralAsset.decimals,
          lltv,
          supplyApy: pos.market.state.supplyApy,
          borrowApy: pos.market.state.borrowApy,
          supplyAssetsUsd: pos.market.state.supplyAssetsUsd,
          borrowAssetsUsd: pos.market.state.borrowAssetsUsd,
          utilization: pos.market.state.utilization,
        };

        allMarkets.push({
          uniqueKey: pos.market.uniqueKey,
          chainId: chain.chainId,
          chainName: CHAIN_NAMES[chain.chainId] || `Chain ${chain.chainId}`,
          loanSymbol: pos.market.loanAsset.symbol,
          loanDecimals: pos.market.loanAsset.decimals,
          collateralSymbol: pos.market.collateralAsset.symbol,
          lltv,
          supplyBalance: s.supplyAssets,
          supplyBalanceUSD: s.supplyAssetsUsd,
          borrowBalance: s.borrowAssets,
          borrowBalanceUSD: s.borrowAssetsUsd,
          collateralBalance: s.collateral,
          collateralBalanceUSD: s.collateralUsd,
          supplyAPY: pos.market.state.supplyApy,
          borrowAPY: pos.market.state.borrowApy,
          healthFactor: hf,
          marketInfo,
        });
      }
    } catch {
      // Chain fetch failed — skip
    }
  });

  await Promise.allSettled(promises);

  const totalSupplyUSD = allMarkets.reduce((s, m) => s + m.supplyBalanceUSD, 0);
  const totalBorrowUSD = allMarkets.reduce((s, m) => s + m.borrowBalanceUSD, 0);
  const totalCollateralUSD = allMarkets.reduce((s, m) => s + m.collateralBalanceUSD, 0);

  return {
    address,
    markets: allMarkets,
    totalSupplyUSD,
    totalBorrowUSD,
    totalCollateralUSD,
    netWorthUSD: totalSupplyUSD + totalCollateralUSD - totalBorrowUSD,
  };
}
