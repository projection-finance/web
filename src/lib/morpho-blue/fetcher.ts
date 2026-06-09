/**
 * Morpho Blue market data fetcher.
 * Uses the Morpho GraphQL API — no Alchemy RPC needed.
 */

import type { YieldRow } from "@/src/app/api/yields/route";
import { MORPHO_API_URL, type MorphoBlueChain } from "./config";
import type { MorphoBlueMarketInfo } from "./types";

const TIMEOUT_MS = 20_000;
const PAGE_SIZE = 100;
const MIN_TVL_USD = 10_000;

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

const MARKETS_QUERY = `
query BlueMarkets($chainIds: [Int!]!, $first: Int!, $skip: Int!) {
  markets(
    first: $first
    skip: $skip
    orderBy: SupplyAssetsUsd
    orderDirection: Desc
    where: { chainId_in: $chainIds }
  ) {
    items {
      uniqueKey
      lltv
      loanAsset { address symbol decimals }
      collateralAsset { address symbol decimals }
      state {
        supplyApy
        borrowApy
        supplyAssetsUsd
        borrowAssetsUsd
        utilization
        rewards { supplyApr borrowApr asset { address } }
      }
    }
    pageInfo { countTotal }
  }
}`;

interface GqlMarketItem {
  uniqueKey: string;
  lltv: string;
  loanAsset: { address: string; symbol: string; decimals: number };
  collateralAsset: { address: string; symbol: string; decimals: number } | null;
  state: {
    supplyApy: number;
    borrowApy: number;
    supplyAssetsUsd: number;
    borrowAssetsUsd: number;
    utilization: number;
    rewards: { supplyApr: number; borrowApr: number; asset: { address: string } }[];
  };
}

function morphoBlueMarketUrl(chainId: number, uniqueKey: string): string {
  const slugs: Record<number, string> = { 1: "ethereum", 8453: "base" };
  return `https://app.morpho.org/${slugs[chainId] ?? "ethereum"}/market/${uniqueKey}`;
}

/**
 * Fetch all Morpho Blue markets for a given chain and convert to YieldRows.
 */
export async function fetchMorphoBlueYields(chain: MorphoBlueChain): Promise<YieldRow[]> {
  const chainIds = [chain.chainId];
  const allItems: GqlMarketItem[] = [];
  let skip = 0;

  for (;;) {
    const data = await gql<{
      markets: { items: GqlMarketItem[]; pageInfo: { countTotal: number } };
    }>(MARKETS_QUERY, { chainIds, first: PAGE_SIZE, skip });

    allItems.push(...data.markets.items);
    if (allItems.length >= data.markets.pageInfo.countTotal) break;
    skip += PAGE_SIZE;
  }

  const rows: YieldRow[] = [];

  for (const m of allItems) {
    const tvl = m.state.supplyAssetsUsd;
    if (tvl < MIN_TVL_USD) continue;
    if (!m.collateralAsset) continue; // Skip markets without collateral (idle markets)

    const lltv = Number(m.lltv) / 1e18;
    const supplyApy = m.state.supplyApy;
    const borrowApy = m.state.borrowApy;

    const rewardSupplyApr = m.state.rewards.reduce((s, r) => s + (r.supplyApr || 0), 0);
    const rewardBorrowApr = m.state.rewards.reduce((s, r) => s + (r.borrowApr || 0), 0);

    rows.push({
      symbol: m.loanAsset.symbol,
      networkId: chain.networkId,
      networkName: chain.name,
      networkLogo: chain.logo,
      networkColor: chain.color,
      supplyAPY: supplyApy,
      variableBorrowAPY: borrowApy,
      merklSupplyAPR: rewardSupplyApr,
      merklBorrowAPR: rewardBorrowApr,
      merklRewardTokens: [],
      totalSupplyAPY: supplyApy + rewardSupplyApr,
      availableLiquidityUSD: tvl,
      isStablecoin: /USD|DAI|FRAX|LUSD|GHO|crvUSD|USDS/i.test(m.loanAsset.symbol),
      protocol: "morpho-blue",
      protocolLabel: `${m.loanAsset.symbol}/${m.collateralAsset.symbol} (${(lltv * 100).toFixed(0)}%)`,
      protocolUrl: morphoBlueMarketUrl(chain.chainId, m.uniqueKey),
      underlyingAsset: m.loanAsset.address?.toLowerCase(),
    });
  }

  return rows;
}

/**
 * Fetch market info for use in the dashboard/config (all markets on a chain).
 */
export async function fetchMorphoBlueMarkets(chain: MorphoBlueChain): Promise<MorphoBlueMarketInfo[]> {
  const chainIds = [chain.chainId];
  const allItems: GqlMarketItem[] = [];
  let skip = 0;

  for (;;) {
    const data = await gql<{
      markets: { items: GqlMarketItem[]; pageInfo: { countTotal: number } };
    }>(MARKETS_QUERY, { chainIds, first: PAGE_SIZE, skip });

    allItems.push(...data.markets.items);
    if (allItems.length >= data.markets.pageInfo.countTotal) break;
    skip += PAGE_SIZE;
  }

  return allItems
    .filter((m) => m.collateralAsset && m.state.supplyAssetsUsd >= MIN_TVL_USD)
    .map((m) => ({
      uniqueKey: m.uniqueKey,
      chainId: chain.chainId,
      loanSymbol: m.loanAsset.symbol,
      loanAddress: m.loanAsset.address,
      loanDecimals: m.loanAsset.decimals,
      collateralSymbol: m.collateralAsset!.symbol,
      collateralAddress: m.collateralAsset!.address,
      collateralDecimals: m.collateralAsset!.decimals,
      lltv: Number(m.lltv) / 1e18,
      supplyApy: m.state.supplyApy,
      borrowApy: m.state.borrowApy,
      supplyAssetsUsd: m.state.supplyAssetsUsd,
      borrowAssetsUsd: m.state.borrowAssetsUsd,
      utilization: m.state.utilization,
    }));
}
