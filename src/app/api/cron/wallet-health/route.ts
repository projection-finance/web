import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { markets, getMarketById } from "@/src/lib/aave/config";
import { AaveMarketConfig } from "@/src/lib/aave/types";
import { UiPoolDataProvider } from "@aave/contract-helpers";
import { createMonitoredProvider } from "@/src/lib/rpc-monitor";
import {
  formatReservesAndIncentives,
  formatUserSummaryAndIncentives,
} from "@aave/math-utils";
import dayjs from "dayjs";

type HfEntry = { hf: number; at: string };
type HfMap = Record<string, HfEntry>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PoolSnapshot = { formattedReserves: any[]; baseCurrencyData: any; currentTimestamp: number };

/** Fetch pool-level data for a market — shared across all wallets, no user address needed. */
async function fetchPoolSnapshot(market: AaveMarketConfig): Promise<PoolSnapshot> {
  const provider = createMonitoredProvider(market.rpcUrl, market.id, market.chainId);
  const poolDataProvider = new UiPoolDataProvider({
    uiPoolDataProviderAddress: market.addresses.UI_POOL_DATA_PROVIDER,
    provider,
    chainId: market.chainId,
  });

  const reserves = await poolDataProvider.getReservesHumanized({
    lendingPoolAddressProvider: market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
  });

  const currentTimestamp = dayjs().unix();
  const formattedReserves = formatReservesAndIncentives({
    reserves: reserves.reservesData,
    currentTimestamp,
    marketReferenceCurrencyDecimals: reserves.baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd: reserves.baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    reserveIncentives: [], // not needed for HF
  });

  return { formattedReserves, baseCurrencyData: reserves.baseCurrencyData, currentTimestamp };
}

/** Get health factor for one wallet on one market, using pre-fetched pool data (1 RPC call). */
async function getWalletHF(
  address: string,
  market: AaveMarketConfig,
  pool: PoolSnapshot,
): Promise<number | null> {
  const provider = createMonitoredProvider(market.rpcUrl, market.id, market.chainId);
  const poolDataProvider = new UiPoolDataProvider({
    uiPoolDataProviderAddress: market.addresses.UI_POOL_DATA_PROVIDER,
    provider,
    chainId: market.chainId,
  });

  const userReserves = await poolDataProvider.getUserReservesHumanized({
    lendingPoolAddressProvider: market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
    user: address,
  });

  // No positions on this market → skip HF calculation
  const hasPositions = userReserves.userReserves.some(
    (ur) => ur.scaledATokenBalance !== "0" || ur.scaledVariableDebt !== "0"
  );
  if (!hasPositions) return null;

  const userSummary = formatUserSummaryAndIncentives({
    currentTimestamp: pool.currentTimestamp,
    marketReferencePriceInUsd: pool.baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    marketReferenceCurrencyDecimals: pool.baseCurrencyData.marketReferenceCurrencyDecimals,
    userReserves: userReserves.userReserves,
    formattedReserves: pool.formattedReserves,
    userEmodeCategoryId: userReserves.userEmodeCategoryId,
    reserveIncentives: [],
    userIncentives: [],
  });

  const hf = Number(userSummary.healthFactor);
  return isFinite(hf) && hf > 0 ? hf : null;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallets = await prisma.favoriteWallet.findMany({
    select: { address: true, healthFactors: true },
    distinct: ["address"],
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // ── Step 1: Fetch pool snapshots once per market (shared across all wallets) ──
  const poolSnapshots = new Map<string, PoolSnapshot>();
  await Promise.allSettled(
    markets
      .filter((m) => !m.disabled)
      .map(async (market) => {
        try {
          poolSnapshots.set(market.id, await fetchPoolSnapshot(market));
        } catch {
          // Market unavailable — skip silently
        }
      })
  );

  // ── Step 2: For each wallet, get HF per active market (1 call per wallet/market) ──
  const now = new Date();
  const nowIso = now.toISOString();
  let updated = 0;

  for (const { address, healthFactors: prevHf } of wallets) {
    try {
      const healthFactors: HfMap = {};

      const prevMap = (prevHf && typeof prevHf === "object") ? prevHf as HfMap : null;
      const activeMarketIds = prevMap ? Object.keys(prevMap) : null;

      const marketsToCheck = activeMarketIds
        ? activeMarketIds
            .map((id) => getMarketById(id))
            .filter((m): m is NonNullable<typeof m> => !!m && !m.disabled)
        : markets.filter((m) => !m.disabled);

      await Promise.allSettled(
        marketsToCheck.map(async (market) => {
          const pool = poolSnapshots.get(market.id);
          if (!pool) return;
          try {
            const hf = await getWalletHF(address, market, pool);
            if (hf !== null) {
              healthFactors[market.id] = { hf, at: nowIso };
            }
          } catch {
            // HF fetch failed for this wallet/market — skip
          }
        })
      );

      const hfValues = Object.values(healthFactors).map((e) => e.hf);
      const minHf = hfValues.length > 0 ? Math.min(...hfValues) : null;

      const result = await prisma.favoriteWallet.updateMany({
        where: { address },
        data: {
          lastHealthFactor: minHf,
          lastHealthFactorAt: now,
          healthFactors: Object.keys(healthFactors).length > 0 ? healthFactors : undefined,
        },
      });

      updated += result.count;
    } catch (err) {
      console.error(`Failed to fetch HF for ${address}:`, err);
    }
  }

  return NextResponse.json({ ok: true, updated });
}
