import { prisma } from "@/src/lib/prisma";
import { NETWORK_TO_CG_PLATFORM } from "./platforms";

const BASE_URL = "https://api.coingecko.com/api/v3";
const PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3";

function cgBase(): string {
  return process.env.COINGECKO_API_KEY ? PRO_BASE_URL : BASE_URL;
}

function cgHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const key = process.env.COINGECKO_API_KEY;
  if (key) h["x-cg-pro-api-key"] = key;
  return h;
}

/** Resolve a single contract address to a coingeckoId. Returns null on failure. */
async function fetchCoingeckoId(
  platform: string,
  address: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${cgBase()}/coins/${platform}/contract/${address}`,
      { headers: cgHeaders() },
    );
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      const retry = await fetch(
        `${cgBase()}/coins/${platform}/contract/${address}`,
        { headers: cgHeaders() },
      );
      if (!retry.ok) return null;
      const data = await retry.json();
      return data.id ?? null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}

export interface TokenToResolve {
  networkId: string;
  contractAddress: string; // lowercase 0x...
}

/**
 * Resolve an array of (networkId, contractAddress) pairs to coingeckoIds.
 * Uses DB-backed persistent cache; only calls CoinGecko for unknown tokens.
 * Returns a Map keyed by "platform:address" → coingeckoId.
 */
export async function resolveCoingeckoIds(
  tokens: TokenToResolve[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (tokens.length === 0) return result;

  // Deduplicate and build cache keys
  const keyMap = new Map<string, { platform: string; address: string }>();
  for (const t of tokens) {
    const platform = NETWORK_TO_CG_PLATFORM[t.networkId];
    if (!platform) continue;
    const addr = t.contractAddress.toLowerCase();
    const key = `${platform}:${addr}`;
    if (!keyMap.has(key)) {
      keyMap.set(key, { platform, address: addr });
    }
  }

  const allKeys = [...keyMap.keys()];
  if (allKeys.length === 0) return result;

  // 1. Bulk-read from DB cache
  try {
    const cached = await prisma.coingeckoMapping.findMany({
      where: { id: { in: allKeys } },
    });
    for (const row of cached) {
      result.set(row.id, row.coingeckoId);
    }
  } catch {
    // DB read failed — resolve everything from API
  }

  // 2. Find keys missing from DB
  const missing = allKeys.filter((k) => !result.has(k));
  if (missing.length === 0) return result;

  // 3. Resolve missing via CoinGecko API (concurrency-limited)
  const CONCURRENCY = 3;
  const newMappings: { id: string; coingeckoId: string }[] = [];

  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (key) => {
      const entry = keyMap.get(key)!;
      const id = await fetchCoingeckoId(entry.platform, entry.address);
      if (id) {
        result.set(key, id);
        newMappings.push({ id: key, coingeckoId: id });
      }
    });
    await Promise.all(promises);
  }

  // 4. Persist new mappings to DB
  if (newMappings.length > 0) {
    try {
      await prisma.coingeckoMapping.createMany({
        data: newMappings,
        skipDuplicates: true,
      });
    } catch {
      // DB write failed — in-memory result still usable
    }
  }

  return result;
}
