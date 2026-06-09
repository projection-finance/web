import { prisma } from "@/src/lib/prisma";

// ── Pool key generation ──

export function makePoolKey(
  protocol: "aave" | "morpho" | "spark" | "compound" | "morpho-blue",
  networkId: string,
  symbol: string,
  protocolLabel?: string
): string {
  if (protocol === "morpho" && protocolLabel) {
    return `morpho:${networkId}:${normalizeVaultName(protocolLabel)}`;
  }
  return `${protocol}:${networkId}:${symbol}`;
}

function normalizeVaultName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ── Write today's snapshot for a set of yield rows ──

export async function writeDailySnapshots(
  rows: Array<{
    poolKey: string;
    protocol: string;
    symbol: string;
    networkId: string;
    apy: number;
  }>
): Promise<number> {
  const today = new Date(new Date().toISOString().slice(0, 10));
  let written = 0;

  for (const row of rows) {
    try {
      await prisma.yieldSnapshot.upsert({
        where: {
          poolKey_date: { poolKey: row.poolKey, date: today },
        },
        update: { apy: row.apy },
        create: {
          poolKey: row.poolKey,
          protocol: row.protocol,
          symbol: row.symbol,
          networkId: row.networkId,
          apy: row.apy,
          date: today,
        },
      });
      written++;
    } catch {
      // Skip errors
    }
  }

  return written;
}

// ── Compute average APY from snapshots ──

export type AvgApyResult = {
  avgApy7d: number | null;
  avgApy30d: number | null;
  avgApy90d: number | null;
};

export async function computeAvgApy(
  poolKeys: string[]
): Promise<Map<string, AvgApyResult>> {
  if (poolKeys.length === 0) return new Map();

  const now = new Date();
  const d7 = new Date(now);
  d7.setDate(d7.getDate() - 7);
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const d90 = new Date(now);
  d90.setDate(d90.getDate() - 90);

  // Fetch all snapshots for the last 90 days in one query
  const snapshots = await prisma.yieldSnapshot.findMany({
    where: {
      poolKey: { in: poolKeys },
      date: { gte: d90 },
    },
    select: { poolKey: true, apy: true, date: true },
    orderBy: { date: "desc" },
  });

  // Group by poolKey
  const grouped = new Map<string, { apy: number; date: Date }[]>();
  for (const s of snapshots) {
    const arr = grouped.get(s.poolKey) ?? [];
    arr.push({ apy: s.apy, date: s.date });
    grouped.set(s.poolKey, arr);
  }

  const results = new Map<string, AvgApyResult>();

  for (const key of poolKeys) {
    const entries = grouped.get(key) ?? [];

    const last7 = entries.filter((e) => e.date >= d7);
    const last30 = entries.filter((e) => e.date >= d30);
    const last90 = entries;

    results.set(key, {
      avgApy7d: last7.length >= 3 ? avg(last7.map((e) => e.apy)) : null,
      avgApy30d: last30.length >= 7 ? avg(last30.map((e) => e.apy)) : null,
      avgApy90d: last90.length >= 30 ? avg(last90.map((e) => e.apy)) : null,
    });
  }

  return results;
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}
