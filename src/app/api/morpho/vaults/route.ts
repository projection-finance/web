import { NextRequest, NextResponse } from "next/server";
import { MORPHO_CHAINS } from "@/src/lib/morpho/config";
import { fetchMorphoVaults } from "@/src/lib/morpho/fetcher";

// In-memory cache (5 min TTL)
let cache: { rows: VaultInfo[]; time: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

interface VaultInfo {
  vaultName: string;
  vaultAddress: string;
  chainId: number;
  chainName: string;
  assetSymbol: string;
  netApy: number;
  tvlUsd: number;
}

async function getAllVaults(): Promise<VaultInfo[]> {
  if (cache && Date.now() - cache.time < CACHE_TTL) return cache.rows;

  const results = await Promise.all(
    MORPHO_CHAINS.map(async (chain) => {
      const rows = await fetchMorphoVaults(chain);
      return rows.map((r) => ({
        vaultName: r.protocolLabel || r.symbol,
        vaultAddress: "", // yields API doesn't expose address, use name as key
        chainId: chain.chainId,
        chainName: chain.name,
        assetSymbol: r.symbol,
        netApy: r.supplyAPY,
        tvlUsd: r.availableLiquidityUSD,
      }));
    })
  );

  const all = results.flat().sort((a, b) => b.tvlUsd - a.tvlUsd);
  cache = { rows: all, time: Date.now() };
  return all;
}

/**
 * GET /api/morpho/vaults?q=searchterm
 * Returns list of Morpho vaults, optionally filtered by search query.
 */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.toLowerCase() || "";
    const vaults = await getAllVaults();

    const filtered = q
      ? vaults.filter(
          (v) =>
            v.vaultName.toLowerCase().includes(q) ||
            v.assetSymbol.toLowerCase().includes(q) ||
            v.chainName.toLowerCase().includes(q)
        )
      : vaults;

    return NextResponse.json(filtered.slice(0, 50));
  } catch (err) {
    console.error("[/api/morpho/vaults] error:", err);
    return NextResponse.json({ error: "Failed to fetch vaults" }, { status: 500 });
  }
}
