import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.coingecko.com/api/v3";
const PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  const apiKey = process.env.COINGECKO_API_KEY;
  const baseUrl = apiKey ? PRO_BASE_URL : BASE_URL;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-pro-api-key"] = apiKey;

  try {
    const res = await fetch(`${baseUrl}/search?query=${encodeURIComponent(query)}`, { headers });

    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coins = (data.coins ?? []).slice(0, 20).map((c: any) => ({
      id: c.id,
      symbol: c.symbol?.toUpperCase() ?? "",
      name: c.name ?? "",
      thumb: c.thumb ?? "",
      large: c.large ?? "",
      market_cap_rank: c.market_cap_rank ?? null,
    }));

    return NextResponse.json(coins);
  } catch {
    return NextResponse.json([]);
  }
}
