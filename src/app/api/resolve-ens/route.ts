import { NextRequest, NextResponse } from "next/server";
import { createMonitoredProvider } from "@/src/lib/rpc-monitor";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });
  }

  try {
    const provider = createMonitoredProvider(
      `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, "ENS_RESOLVE"
    );
    const address = await provider.resolveName(name);
    if (!address) {
      return NextResponse.json({ error: "ENS name not found" }, { status: 404 });
    }
    return NextResponse.json({ address });
  } catch {
    return NextResponse.json({ error: "Failed to resolve ENS name" }, { status: 500 });
  }
}
