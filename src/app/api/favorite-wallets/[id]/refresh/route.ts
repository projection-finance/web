import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { getAavePosition } from "@/src/lib/aave/fetcher";
import { markets } from "@/src/lib/aave/config";

type HfEntry = { hf: number | null; at: string };
type HfMap = Record<string, HfEntry>;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const wallet = await prisma.favoriteWallet.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!wallet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const now = new Date().toISOString();
    const healthFactors: HfMap = {};

    // Determine which networks to scan
    const monitoredNetworks = wallet.monitoredNetworks as string[] | null;
    const marketsToScan = monitoredNetworks
      ? markets.filter((m) => monitoredNetworks.includes(m.id))
      : markets; // null = scan all (legacy behavior)

    // Fetch HF from selected networks in parallel
    const results = await Promise.allSettled(
      marketsToScan.map(async (market) => {
        const position = await getAavePosition(wallet.address, market);
        return { networkId: market.id, hf: position.workingData.healthFactor };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { networkId, hf } = result.value;
        if (monitoredNetworks) {
          // Explicit mode: store all monitored networks (null if no active borrows)
          healthFactors[networkId] = {
            hf: isFinite(hf) && hf > 0 ? hf : null,
            at: now,
          };
        } else {
          // Legacy mode: only store networks with active borrows
          if (isFinite(hf) && hf > 0) {
            healthFactors[networkId] = { hf, at: now };
          }
        }
      }
    }

    // Compute overall min HF (worst position across all networks)
    const hfValues = Object.values(healthFactors)
      .map((e) => e.hf)
      .filter((v): v is number => v !== null);
    const minHf = hfValues.length > 0 ? Math.min(...hfValues) : null;

    const updated = await prisma.favoriteWallet.update({
      where: { id },
      data: {
        lastHealthFactor: minHf,
        lastHealthFactorAt: new Date(),
        healthFactors: Object.keys(healthFactors).length > 0 ? healthFactors : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(`Failed to refresh HF for wallet ${wallet.address}:`, err);
    return NextResponse.json(
      { error: "Failed to fetch health factor" },
      { status: 500 }
    );
  }
}
