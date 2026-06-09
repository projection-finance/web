import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { fetchRecentLiquidations } from "@/src/lib/aave/subgraph";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const liquidations = await fetchRecentLiquidations(500);
    let inserted = 0;

    for (const liq of liquidations) {
      try {
        await prisma.radarLiquidation.upsert({
          where: {
            txHash_logIndex: {
              txHash: liq.txHash,
              logIndex: liq.logIndex,
            },
          },
          create: {
            txHash: liq.txHash,
            logIndex: liq.logIndex,
            walletAddress: liq.walletAddress.toLowerCase(),
            liquidatorAddress: liq.liquidatorAddress.toLowerCase(),
            network: "ETHEREUM_V3",
            collateralAssetSymbol: liq.collateralAssetSymbol,
            collateralSeizedAmount: liq.collateralSeizedAmount,
            collateralSeizedUSD: liq.collateralSeizedUSD,
            debtAssetSymbol: liq.debtAssetSymbol,
            debtRepaidAmount: liq.debtRepaidAmount,
            debtRepaidUSD: liq.debtRepaidUSD,
            timestamp: liq.timestamp,
          },
          update: {},
        });
        inserted++;
      } catch {
        // duplicate — skip
      }
    }

    // Note: we no longer mark positions as "liquidated" here.
    // A liquidation event doesn't mean the position is gone — partial liquidations
    // (close factor 50% when HF >= 0.95) leave the position active with improved HF.
    // The radar-positions cron will update the HF on next run, and mark positions
    // as "closed" only if they disappear from the top borrowers list.

    return NextResponse.json({ ok: true, inserted });
  } catch (err) {
    console.error("Radar liquidations cron failed:", err);
    return NextResponse.json(
      { error: "Internal error", details: String(err) },
      { status: 500 }
    );
  }
}
