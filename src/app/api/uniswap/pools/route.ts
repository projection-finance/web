import { NextRequest, NextResponse } from "next/server";
import { searchUniswapPools, fetchTopPools } from "@/src/lib/uniswap/fetcher";

export async function GET(req: NextRequest) {
  const chainIdParam = req.nextUrl.searchParams.get("chainId");
  const query = req.nextUrl.searchParams.get("q") || undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");

  const chainId = chainIdParam ? parseInt(chainIdParam, 10) : 1;
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  if (isNaN(chainId)) {
    return NextResponse.json({ error: "Invalid chainId" }, { status: 400 });
  }

  try {
    const pools = query
      ? await searchUniswapPools(chainId, query, limit)
      : await fetchTopPools(chainId, limit);
    return NextResponse.json(pools);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch pools";
    console.error("[Uniswap] Pool search failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
