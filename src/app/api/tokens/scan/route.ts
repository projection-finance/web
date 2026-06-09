import { NextRequest, NextResponse } from "next/server";
import { NetworkId, NETWORKS } from "@/src/lib/aave/networks";
import { scanWalletTokens } from "@/src/lib/tokens/scanner";
import { createMonitoredProvider } from "@/src/lib/rpc-monitor";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const network = req.nextUrl.searchParams.get("network") as NetworkId | null;

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter" },
      { status: 400 }
    );
  }

  if (!network || !NETWORKS[network]) {
    return NextResponse.json(
      { error: "Invalid or missing network parameter" },
      { status: 400 }
    );
  }

  // Resolve ENS if needed
  let resolvedAddress = address;
  if (address.endsWith(".eth") || address.includes(".")) {
    try {
      const provider = createMonitoredProvider(
        `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, "ENS_SCAN"
      );
      const resolved = await provider.resolveName(address);
      if (!resolved) {
        return NextResponse.json(
          { error: "ENS name not found" },
          { status: 404 }
        );
      }
      resolvedAddress = resolved;
    } catch {
      return NextResponse.json(
        { error: "Failed to resolve ENS name" },
        { status: 500 }
      );
    }
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(resolvedAddress)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address" },
      { status: 400 }
    );
  }

  try {
    const result = await scanWalletTokens(resolvedAddress, network);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Wallet scan error:", err);
    return NextResponse.json(
      { error: "Failed to scan wallet" },
      { status: 500 }
    );
  }
}
