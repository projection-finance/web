import { NextRequest, NextResponse } from "next/server";
import { getAavePosition } from "@/src/lib/aave/fetcher";
import { ETHEREUM_V3_MARKET, getMarketById } from "@/src/lib/aave/config";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const network = searchParams.get("network");

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  // Basic address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address format" },
      { status: 400 }
    );
  }

  const market = network ? getMarketById(network) : ETHEREUM_V3_MARKET;
  if (!market) {
    return NextResponse.json(
      { error: `Unknown network: ${network}` },
      { status: 400 }
    );
  }

  if (market.disabled) {
    return NextResponse.json(
      { error: `${market.title} is temporarily unavailable. On-chain data providers are not responding.` },
      { status: 503 }
    );
  }

  try {
    const position = await getAavePosition(address, market);
    return NextResponse.json(position);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching AAVE position:", message);
    return NextResponse.json(
      { error: "Failed to fetch AAVE position", details: message },
      { status: 500 }
    );
  }
}
