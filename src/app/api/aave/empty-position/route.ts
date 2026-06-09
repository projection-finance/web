import { NextRequest, NextResponse } from "next/server";
import { getEmptyAavePosition } from "@/src/lib/aave/fetcher";
import { ETHEREUM_V3_MARKET, getMarketById } from "@/src/lib/aave/config";

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get("network");
  const market = network ? getMarketById(network) : ETHEREUM_V3_MARKET;

  if (!market) {
    return NextResponse.json({ error: `Unknown network: ${network}` }, { status: 400 });
  }

  if (market.disabled) {
    return NextResponse.json(
      { error: `${market.title} is temporarily unavailable. On-chain data providers are not responding.` },
      { status: 503 }
    );
  }

  try {
    const position = await getEmptyAavePosition(market);
    return NextResponse.json(position);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load market data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
