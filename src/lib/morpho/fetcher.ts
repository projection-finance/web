import type { YieldRow } from "@/src/app/api/yields/route";
import { MORPHO_API_URL, type MorphoChain } from "./config";
import { isMorphoStablecoin } from "./stablecoins";

const MIN_TVL_USD = 10_000;
const PAGE_SIZE = 100;
const TIMEOUT_MS = 20_000;

// ── GraphQL queries ──

const V1_QUERY = `
query VaultsV1($chainIds: [Int!]!, $first: Int!, $skip: Int!) {
  vaults(first: $first, skip: $skip, where: { chainId_in: $chainIds, whitelisted: true }) {
    items {
      name
      address
      state { netApy totalAssetsUsd }
      asset { symbol address }
    }
    pageInfo { countTotal }
  }
}`;

const V2_QUERY = `
query VaultsV2($chainIds: [Int!]!, $first: Int!, $skip: Int!) {
  vaultV2s(first: $first, skip: $skip, where: { chainId_in: $chainIds, whitelisted: true }) {
    items {
      name
      address
      avgNetApy
      totalAssetsUsd
      asset { symbol address }
      adapters { items { type } }
    }
    pageInfo { countTotal }
  }
}`;

// ── Helpers ──

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

// ── Paginated fetchers ──

type V1Item = {
  name: string;
  address: string;
  state: { netApy: number; totalAssetsUsd: number };
  asset: { symbol: string; address: string };
};

type V2Item = {
  name: string;
  address: string;
  avgNetApy: number;
  totalAssetsUsd: number;
  asset: { symbol: string; address: string };
  adapters: { items: { type: string }[] };
};

async function fetchAllV1(chainIds: number[]): Promise<V1Item[]> {
  const all: V1Item[] = [];
  let skip = 0;

  for (;;) {
    const data = await gql<{
      vaults: { items: V1Item[]; pageInfo: { countTotal: number } };
    }>(V1_QUERY, { chainIds, first: PAGE_SIZE, skip });

    all.push(...data.vaults.items);
    if (all.length >= data.vaults.pageInfo.countTotal) break;
    skip += PAGE_SIZE;
  }

  return all;
}

async function fetchAllV2(chainIds: number[]): Promise<V2Item[]> {
  const all: V2Item[] = [];
  let skip = 0;

  for (;;) {
    const data = await gql<{
      vaultV2s: { items: V2Item[]; pageInfo: { countTotal: number } };
    }>(V2_QUERY, { chainIds, first: PAGE_SIZE, skip });

    all.push(...data.vaultV2s.items);
    if (all.length >= data.vaultV2s.pageInfo.countTotal) break;
    skip += PAGE_SIZE;
  }

  return all;
}

// ── Helpers ── (URLs)

const MORPHO_CHAIN_SLUG: Record<number, string> = {
  1: "ethereum",
  8453: "base",
};

function morphoVaultUrl(chainId: number, vaultAddress: string): string {
  const slug = MORPHO_CHAIN_SLUG[chainId] ?? "ethereum";
  return `https://app.morpho.org/${slug}/vault/${vaultAddress}`;
}

// ── Public API ──

const VALID_V2_ADAPTERS = new Set(["MetaMorpho", "MorphoMarketV1"]);

export async function fetchMorphoVaults(chain: MorphoChain): Promise<YieldRow[]> {
  const chainIds = [chain.chainId];
  const [v1Items, v2Items] = await Promise.all([
    fetchAllV1(chainIds),
    fetchAllV2(chainIds),
  ]);

  const rows: YieldRow[] = [];

  // Deduplicate by address (V2 takes precedence if same vault appears in both)
  const v2Addresses = new Set(v2Items.map((v) => v.address.toLowerCase()));

  // V1 vaults
  for (const v of v1Items) {
    if (v2Addresses.has(v.address.toLowerCase())) continue;
    const tvl = v.state.totalAssetsUsd;
    if (tvl < MIN_TVL_USD) continue;

    const apy = v.state.netApy;
    rows.push({
      symbol: v.asset.symbol,
      networkId: chain.networkId,
      networkName: chain.name,
      networkLogo: chain.logo,
      networkColor: chain.color,
      supplyAPY: apy,
      variableBorrowAPY: 0,
      merklSupplyAPR: 0,
      merklBorrowAPR: 0,
      merklRewardTokens: [],
      totalSupplyAPY: apy,
      availableLiquidityUSD: tvl,
      isStablecoin: isMorphoStablecoin(v.asset.symbol),
      protocol: "morpho",
      protocolLabel: v.name,
      protocolUrl: morphoVaultUrl(chain.chainId, v.address),
      underlyingAsset: v.asset.address?.toLowerCase(),
    });
  }

  // V2 vaults — only those with valid adapter types
  for (const v of v2Items) {
    const adapterTypes = v.adapters.items.map((a) => a.type);
    if (!adapterTypes.some((t) => VALID_V2_ADAPTERS.has(t))) continue;

    const tvl = v.totalAssetsUsd;
    if (tvl < MIN_TVL_USD) continue;

    const apy = v.avgNetApy;
    rows.push({
      symbol: v.asset.symbol,
      networkId: chain.networkId,
      networkName: chain.name,
      networkLogo: chain.logo,
      networkColor: chain.color,
      supplyAPY: apy,
      variableBorrowAPY: 0,
      merklSupplyAPR: 0,
      merklBorrowAPR: 0,
      merklRewardTokens: [],
      totalSupplyAPY: apy,
      availableLiquidityUSD: tvl,
      isStablecoin: isMorphoStablecoin(v.asset.symbol),
      protocol: "morpho",
      protocolLabel: v.name,
      protocolUrl: morphoVaultUrl(chain.chainId, v.address),
      underlyingAsset: v.asset.address?.toLowerCase(),
    });
  }

  return rows;
}
