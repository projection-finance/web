/**
 * Uniswap V3 pool data fetcher via The Graph subgraph.
 * Follows the same pattern as the Morpho Blue fetcher (GraphQL + timeout + typed responses).
 */

import type { UniswapPool } from "./types";
import { tickToPrice } from "./math";

const TIMEOUT_MS = 20_000;

const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY || "";

/**
 * Subgraph IDs for Uniswap V3 on each supported chain.
 * Using The Graph's decentralized network gateway.
 */
const SUBGRAPH_IDS: Record<number, string> = {
  1: "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV",       // Ethereum
  8453: "43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPCNzXviQ7wEc2",     // Base
  42161: "FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM",   // Arbitrum
  10: "Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj",      // Optimism
  137: "3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm",     // Polygon
};

function subgraphUrl(chainId: number): string {
  const id = SUBGRAPH_IDS[chainId];
  if (!id) throw new Error(`No Uniswap V3 subgraph for chainId ${chainId}`);
  if (!THEGRAPH_API_KEY) throw new Error("THEGRAPH_API_KEY is not configured");
  return `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/${id}`;
}

// ── GraphQL helper ──

async function gql<T>(url: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Uniswap subgraph ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── GraphQL queries ──

const POOLS_QUERY = `
query SearchPools($first: Int!, $skip: Int!, $orderBy: Pool_orderBy!, $where: Pool_filter) {
  pools(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: desc
    where: $where
  ) {
    id
    token0 { id symbol decimals }
    token1 { id symbol decimals }
    feeTier
    tickSpacing
    tick
    sqrtPrice
    liquidity
    totalValueLockedUSD
    volumeUSD
    feesUSD
    token0Price
    token1Price
    poolDayData(first: 1, orderBy: date, orderDirection: desc) {
      volumeUSD
      feesUSD
    }
  }
}`;

interface GqlPoolItem {
  id: string;
  token0: { id: string; symbol: string; decimals: string };
  token1: { id: string; symbol: string; decimals: string };
  feeTier: string;
  tickSpacing: string;
  tick: string;
  sqrtPrice: string;
  liquidity: string;
  totalValueLockedUSD: string;
  volumeUSD: string;
  feesUSD: string;
  token0Price: string;
  token1Price: string;
  poolDayData: { volumeUSD: string; feesUSD: string }[];
}

function mapPool(raw: GqlPoolItem, chainId: number): UniswapPool {
  const tick = parseInt(raw.tick, 10);
  const dayData = raw.poolDayData[0];
  return {
    address: raw.id,
    chainId,
    token0Symbol: raw.token0.symbol,
    token0Address: raw.token0.id,
    token0Decimals: parseInt(raw.token0.decimals, 10),
    token1Symbol: raw.token1.symbol,
    token1Address: raw.token1.id,
    token1Decimals: parseInt(raw.token1.decimals, 10),
    feeTier: parseInt(raw.feeTier, 10),
    tickSpacing: parseInt(raw.tickSpacing, 10),
    currentTick: tick,
    currentPrice: tickToPrice(tick),
    sqrtPriceX96: raw.sqrtPrice,
    totalLiquidity: parseFloat(raw.liquidity),
    volumeUSD24h: dayData ? parseFloat(dayData.volumeUSD) : 0,
    feesUSD24h: dayData ? parseFloat(dayData.feesUSD) : 0,
    tvlUSD: parseFloat(raw.totalValueLockedUSD),
  };
}

// ── Public API ──

/**
 * Search Uniswap V3 pools on a given chain.
 * If `query` is provided, filters by token symbol.
 */
export async function searchUniswapPools(
  chainId: number,
  query?: string,
  limit = 20,
): Promise<UniswapPool[]> {
  const url = subgraphUrl(chainId);

  const where: Record<string, unknown> = {
    totalValueLockedUSD_gt: "10000", // min $10k TVL
  };

  if (query) {
    const q = query.trim();
    where.or = [
      { token0_: { symbol_contains_nocase: q } },
      { token1_: { symbol_contains_nocase: q } },
    ];
  }

  const data = await gql<{ pools: GqlPoolItem[] }>(url, POOLS_QUERY, {
    first: limit,
    skip: 0,
    orderBy: "totalValueLockedUSD",
    where,
  });

  return data.pools.map((p) => mapPool(p, chainId));
}

/**
 * Fetch top pools by TVL on a given chain (default view before search).
 */
export async function fetchTopPools(
  chainId: number,
  limit = 20,
): Promise<UniswapPool[]> {
  return searchUniswapPools(chainId, undefined, limit);
}
