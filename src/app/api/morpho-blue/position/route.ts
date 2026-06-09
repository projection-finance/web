import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { fetchMorphoBluePosition } from "@/src/lib/morpho-blue/position";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const chainIdParam = request.nextUrl.searchParams.get("chainId");

  if (!address || !ethers.utils.isAddress(address)) {
    return NextResponse.json({ error: "Valid address is required" }, { status: 400 });
  }

  const chainIds = chainIdParam
    ? chainIdParam.split(",").map(Number).filter(Boolean)
    : undefined;

  try {
    const position = await fetchMorphoBluePosition(address, chainIds);
    return NextResponse.json(position);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
