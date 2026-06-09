import { NextRequest, NextResponse } from "next/server";
import { fetchMorphoPositionsAllChains } from "@/src/lib/morpho/position";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address format" },
      { status: 400 }
    );
  }

  try {
    const position = await fetchMorphoPositionsAllChains(address);
    return NextResponse.json(position);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching Morpho position:", message);
    return NextResponse.json(
      { error: "Failed to fetch Morpho position", details: message },
      { status: 500 }
    );
  }
}
