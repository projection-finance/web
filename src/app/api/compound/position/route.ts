import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { fetchCompoundPosition } from "@/src/lib/compound/position";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const chainIdParam = request.nextUrl.searchParams.get("chainId");

  if (!address || !ethers.utils.isAddress(address)) {
    return NextResponse.json(
      { error: "Valid address is required" },
      { status: 400 },
    );
  }

  const chainIds = chainIdParam
    ? chainIdParam.split(",").map(Number).filter(Boolean)
    : undefined;

  try {
    const position = await fetchCompoundPosition(address, chainIds);
    return NextResponse.json(position);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
