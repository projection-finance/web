import { NextRequest, NextResponse } from "next/server";
import { markets } from "@/src/lib/aave/config";
import { getMarketReserves } from "@/src/lib/aave/fetcher";
import { isStablecoin } from "@/src/lib/aave/emode";
import { getNetworkById } from "@/src/lib/aave/networks";
import { MerklIncentiveData } from "@/src/lib/aave/types";
import { MORPHO_CHAINS } from "@/src/lib/morpho/config";
import { fetchMorphoVaults } from "@/src/lib/morpho/fetcher";
import { prisma } from "@/src/lib/prisma";
import {
  makePoolKey,
  writeDailySnapshots,
  computeAvgApy,
} from "@/src/lib/defillama/yields";
import { resolveCoingeckoIds } from "@/src/lib/coingecko/resolver";

export type YieldRow = {
  symbol: string;
  networkId: string;
  networkName: string;
  networkLogo: string;
  networkColor: string;
  supplyAPY: number;
  variableBorrowAPY: number;
  merklSupplyAPR: number;
  merklBorrowAPR: number;
  merklRewardTokens: string[];
  totalSupplyAPY: number;
  availableLiquidityUSD: number;
  isStablecoin: boolean;
  protocol: "aave" | "morpho" | "spark" | "compound" | "morpho-blue";
  protocolLabel?: string;
  protocolUrl?: string;
  underlyingAsset?: string;   // contract address (lowercase 0x)
  coingeckoId?: string;       // resolved CoinGecko ID
  avgApy7d?: number | null;
  avgApy30d?: number | null;
  avgApy90d?: number | null;
};

export type YieldsResponse = {
  rows: YieldRow[];
  fetchedAt: string;
  errors: string[];
};

export type YieldProgressEvent =
  | { type: "progress"; loaded: number; total: number; network: string; protocol?: string; rows?: YieldRow[] }
  | { type: "done"; data: YieldsResponse };

// ── Aave market name for app.aave.com URLs ──
const AAVE_MARKET_SLUG: Record<string, string> = {
  ETHEREUM_V3: "proto_mainnet_v3",
  ARBITRUM_V3: "proto_arbitrum_v3",
  BASE_V3: "proto_base_v3",
  OPTIMISM_V3: "proto_optimism_v3",
  POLYGON_V3: "proto_polygon_v3",
  AVALANCHE_V3: "proto_avalanche_v3",
  BNB_V3: "proto_bnb_v3",
  SCROLL_V3: "proto_scroll_v3",
  ZKSYNC_V3: "proto_zksync_v3",
  LINEA_V3: "proto_linea_v3",
  GNOSIS_V3: "proto_gnosis_v3",
  METIS_V3: "proto_metis_v3",
  SONIC_V3: "proto_sonic_v3",
  CELO_V3: "proto_celo_v3",
  MANTLE_V3: "proto_mantle_v3",
  SONEIUM_V3: "proto_soneium_v3",
  INK_V3: "proto_ink_v3",
};

function aaveReserveUrl(marketId: string, underlyingAsset: string): string {
  const slug = AAVE_MARKET_SLUG[marketId];
  if (!slug) return "https://app.aave.com";
  return `https://app.aave.com/reserve-overview/?underlyingAsset=${underlyingAsset.toLowerCase()}&marketName=${slug}`;
}

// ── Concurrency limiter (avoid Alchemy rate limits) ──
const CONCURRENCY = 4; // max parallel RPC-heavy fetches

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = CONCURRENCY,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      try {
        results[idx] = { status: "fulfilled", value: await tasks[idx]() };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

// ── Cache layers ──
// L1: in-memory (instant, lost on restart)
let memCache: YieldsResponse | null = null;
let memCacheTime = 0;
// L2: DB (persistent, 30 min TTL)
const DB_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (refreshed by cron q6h)
// Dedup concurrent fetches
let inflightPromise: Promise<YieldsResponse> | null = null;

function processMarketReserves(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formattedPoolReserves: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emodeCategories: any[],
  merklIncentives: MerklIncentiveData[],
  marketId: string,
  networkMeta: { name: string; logo: string; color: string },
): YieldRow[] {
  const rows: YieldRow[] = [];

  for (const reserve of formattedPoolReserves) {
    const symbol = reserve.symbol as string;
    if (!symbol) continue;
    if (reserve.isFrozen || reserve.isPaused || !reserve.isActive) continue;

    const underlying = (reserve.underlyingAsset as string)?.toLowerCase();

    const supplyIncentives = merklIncentives.filter(
      (m) => m.underlyingAsset.toLowerCase() === underlying && m.action === "supply"
    );
    const borrowIncentives = merklIncentives.filter(
      (m) => m.underlyingAsset.toLowerCase() === underlying && m.action === "borrow"
    );

    const merklSupplyAPR = supplyIncentives.reduce((sum, m) => sum + m.apr, 0);
    const merklBorrowAPR = borrowIncentives.reduce((sum, m) => sum + m.apr, 0);
    const merklRewardTokens = [
      ...new Set([
        ...supplyIncentives.map((m) => m.rewardTokenSymbol),
        ...borrowIncentives.map((m) => m.rewardTokenSymbol),
      ]),
    ];

    const supplyAPY = Number(reserve.supplyAPY) || 0;
    const priceInUSD = Number(reserve.priceInUSD) || 1;
    const availableLiquidity =
      Number(reserve.formattedAvailableLiquidity ?? reserve.availableLiquidity) || 0;

    rows.push({
      symbol,
      networkId: marketId,
      networkName: networkMeta.name,
      networkLogo: networkMeta.logo,
      networkColor: networkMeta.color,
      supplyAPY,
      variableBorrowAPY: Number(reserve.variableBorrowAPY) || 0,
      merklSupplyAPR,
      merklBorrowAPR,
      merklRewardTokens,
      totalSupplyAPY: supplyAPY + merklSupplyAPR,
      availableLiquidityUSD: availableLiquidity * priceInUSD,
      isStablecoin: isStablecoin(symbol, emodeCategories),
      protocol: "aave",
      protocolUrl: aaveReserveUrl(marketId, underlying ?? ""),
      underlyingAsset: underlying,
    });
  }

  return rows;
}

/** Save response to both memory and DB, and write daily snapshots */
async function saveToCache(response: YieldsResponse) {
  memCache = response;
  memCacheTime = Date.now();

  try {
    const jsonData = JSON.parse(JSON.stringify(response));
    await prisma.yieldCache.upsert({
      where: { id: "singleton" },
      update: { data: jsonData },
      create: { id: "singleton", data: jsonData },
    });
  } catch {
    // DB write failed — memory cache still works
  }

  // Write daily APY snapshots (non-blocking)
  writeDailySnapshots(
    response.rows.map((row) => ({
      poolKey: makePoolKey(row.protocol, row.networkId, row.symbol, row.protocolLabel),
      protocol: row.protocol,
      symbol: row.symbol,
      networkId: row.networkId,
      apy: row.totalSupplyAPY,
    }))
  ).catch((e) => console.warn("[Yields] Snapshot write failed:", e.message));
}

/** Enrich yield rows with avg APY 7/30/90d from own snapshots */
async function enrichWithAvgApy(rows: YieldRow[]): Promise<void> {
  const poolKeys = rows.map((row) =>
    makePoolKey(row.protocol, row.networkId, row.symbol, row.protocolLabel)
  );

  try {
    const avgMap = await computeAvgApy(poolKeys);
    for (let i = 0; i < rows.length; i++) {
      const avg = avgMap.get(poolKeys[i]);
      if (avg) {
        rows[i].avgApy7d = avg.avgApy7d;
        rows[i].avgApy30d = avg.avgApy30d;
        rows[i].avgApy90d = avg.avgApy90d;
      }
    }
  } catch {
    // Avg computation failed — rows stay without avg data
  }
}

/** Enrich yield rows with CoinGecko IDs resolved from contract addresses */
async function enrichWithCoingeckoIds(rows: YieldRow[]): Promise<void> {
  const tokens = rows
    .filter((r) => r.underlyingAsset)
    .map((r) => ({ networkId: r.networkId, contractAddress: r.underlyingAsset! }));

  if (tokens.length === 0) return;

  try {
    const { NETWORK_TO_CG_PLATFORM } = await import("@/src/lib/coingecko/platforms");
    const mapping = await resolveCoingeckoIds(tokens);

    for (const row of rows) {
      if (!row.underlyingAsset) continue;
      const platform = NETWORK_TO_CG_PLATFORM[row.networkId];
      if (!platform) continue;
      const key = `${platform}:${row.underlyingAsset}`;
      const id = mapping.get(key);
      if (id) row.coingeckoId = id;
    }
  } catch {
    // CoinGecko resolution failed — rows stay without coingeckoId
  }
}

/** Try L1 (memory) then L2 (DB). Returns null if both stale/empty. */
async function getFromCache(): Promise<YieldsResponse | null> {
  // L1: memory
  if (memCache && Date.now() - memCacheTime < DB_CACHE_TTL_MS) {
    return memCache;
  }

  // L2: DB
  try {
    const row = await prisma.yieldCache.findUnique({ where: { id: "singleton" } });
    if (row && Date.now() - row.updatedAt.getTime() < DB_CACHE_TTL_MS) {
      const response = row.data as unknown as YieldsResponse;
      // Warm up L1
      memCache = response;
      memCacheTime = row.updatedAt.getTime();
      return response;
    }
  } catch {
    // DB read failed
  }

  return null;
}

export async function GET(request: NextRequest) {
  const wantsStream = request.headers.get("accept")?.includes("text/event-stream");
  const forceRefresh = request.nextUrl.searchParams.get("force") === "true";
  const networksParam = request.nextUrl.searchParams.get("networks");

  // ── Determine which markets to fetch ──
  const requestedNetworks = networksParam
    ? networksParam.split(",").filter(Boolean)
    : null;

  // Only Aave (excluding Spark) + Morpho Vaults
  const aaveOnly = markets.filter((m) => m.protocol !== "spark");

  const selectedMarkets = requestedNetworks
    ? aaveOnly.filter((m) => requestedNetworks.includes(m.id))
    : aaveOnly;

  const selectedMorphoChains = requestedNetworks
    ? MORPHO_CHAINS.filter((c) => {
        if (c.chainId === 1) return requestedNetworks.includes("ETHEREUM_V3");
        if (c.chainId === 8453) return requestedNetworks.includes("BASE_V3");
        return false;
      })
    : MORPHO_CHAINS;

  const isFullFetch = !requestedNetworks;

  // ── Check cache ──
  if (!forceRefresh) {
    const cached = await getFromCache();
    if (cached) {
      let rows = cached.rows;
      if (requestedNetworks) {
        const netSet = new Set(requestedNetworks);
        if (netSet.has("ETHEREUM_V3")) netSet.add("MORPHO_ETH");
        if (netSet.has("BASE_V3")) netSet.add("MORPHO_BASE");
        rows = rows.filter((r) => netSet.has(r.networkId));
      }
      await enrichWithAvgApy(rows);
      return NextResponse.json({ ...cached, rows }, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }
  }

  // ── Cache miss or force: fresh fetch ──

  // SSE streaming mode (with progress)
  if (wantsStream) {
    const encoder = new TextEncoder();
    const total = selectedMarkets.length + selectedMorphoChains.length;

    const stream = new ReadableStream({
      async start(controller) {
        const allRows: YieldRow[] = [];
        const errors: string[] = [];
        let loaded = 0;

        const emit = (network: string, protocol?: string, newRows?: YieldRow[]) => {
          loaded++;
          const event: YieldProgressEvent = { type: "progress", loaded, total, network, protocol, rows: newRows };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        // GraphQL-based protocols (no Alchemy) → run freely in parallel
        const graphqlTasks: (() => Promise<void>)[] = [
          ...selectedMorphoChains.map((chain) => async () => {
            let newRows: YieldRow[] = [];
            try {
              newRows = await fetchMorphoVaults(chain);
              allRows.push(...newRows);
            } catch (err: unknown) {
              errors.push(`Morpho ${chain.name}: ${err instanceof Error ? err.message : "unknown error"}`);
            }
            emit(`Morpho ${chain.name}`, "morpho", newRows);
          }),
        ];

        // Aave uses Alchemy RPC → concurrency-limited to avoid rate limits
        const rpcTasks: (() => Promise<void>)[] = [
          ...selectedMarkets.map((market) => async () => {
            const networkMeta = getNetworkById(market.id);
            if (!networkMeta) { emit(market.id, "aave"); return; }
            let newRows: YieldRow[] = [];
            try {
              const { formattedPoolReserves, emodeCategories, merklIncentives } =
                await getMarketReserves(market);
              newRows = processMarketReserves(formattedPoolReserves, emodeCategories, merklIncentives, market.id, networkMeta);
              allRows.push(...newRows);
            } catch (err: unknown) {
              errors.push(`${market.id}: ${err instanceof Error ? err.message : "unknown error"}`);
            }
            emit(networkMeta.name, "aave", newRows);
          }),
        ];

        // Run GraphQL tasks (Morpho + Blue) freely in parallel, RPC tasks concurrency-limited
        await Promise.all([
          Promise.allSettled(graphqlTasks.map((t) => t())),
          runWithConcurrency(rpcTasks),
        ]);

        allRows.sort((a, b) => b.totalSupplyAPY - a.totalSupplyAPY);
        await enrichWithCoingeckoIds(allRows);

        const response: YieldsResponse = { rows: allRows, fetchedAt: new Date().toISOString(), errors };
        if (isFullFetch) await saveToCache(response);
        await enrichWithAvgApy(response.rows);

        const doneEvent: YieldProgressEvent = { type: "done", data: response };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  // JSON mode (no progress, deduplicated)
  if (!inflightPromise) {
    inflightPromise = (async () => {
      const allRows: YieldRow[] = [];
      const errors: string[] = [];

      // Build all tasks with error tracking, run with concurrency limit
      const allTasks: (() => Promise<void>)[] = [
        ...selectedMarkets.map((market) => async () => {
          const networkMeta = getNetworkById(market.id);
          if (!networkMeta) return;
          const { formattedPoolReserves, emodeCategories, merklIncentives } = await getMarketReserves(market);
          allRows.push(
            ...processMarketReserves(formattedPoolReserves, emodeCategories, merklIncentives, market.id, networkMeta)
          );
        }),
        ...selectedMorphoChains.map((chain) => async () => {
          const rows = await fetchMorphoVaults(chain);
          allRows.push(...rows);
        }),
      ];

      const results = await runWithConcurrency(allTasks);

      // Collect errors
      const taskLabels = [
        ...selectedMarkets.map((m) => m.id),
        ...selectedMorphoChains.map((c) => c.networkId),
      ];
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "rejected") {
          const r = results[i] as PromiseRejectedResult;
          errors.push(`${taskLabels[i]}: ${r.reason?.message ?? "unknown error"}`);
        }
      }

      allRows.sort((a, b) => b.totalSupplyAPY - a.totalSupplyAPY);
      await enrichWithCoingeckoIds(allRows);

      const response: YieldsResponse = { rows: allRows, fetchedAt: new Date().toISOString(), errors };
      if (isFullFetch) await saveToCache(response);
      return response;
    })().finally(() => {
      inflightPromise = null;
    });
  }

  const response = await inflightPromise;
  await enrichWithAvgApy(response.rows);
  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
