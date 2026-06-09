import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { fetchTopBorrowers, refreshPositionsByAddress } from "@/src/lib/aave/subgraph";

export const maxDuration = 300; // 5 min timeout for serverless

async function upsertPosition(position: { walletAddress: string; healthFactor: number; totalCollateralUSD: number; totalDebtUSD: number; mainCollateralSymbol: string; mainCollateralAmount: number; mainCollateralPriceUSD: number; liquidationPriceUSD: number | null; liquidationThreshold: number; positionJson: { collaterals: { symbol: string; amountUSD: number; amount: number; liqThreshold: number }[]; debts: { symbol: string; amountUSD: number; amount: number }[] } }) {
  const addr = position.walletAddress.toLowerCase();
  await prisma.radarPosition.upsert({
    where: { walletAddress_network: { walletAddress: addr, network: "ETHEREUM_V3" } },
    create: {
      walletAddress: addr,
      network: "ETHEREUM_V3",
      healthFactor: position.healthFactor,
      totalCollateralUSD: position.totalCollateralUSD,
      totalDebtUSD: position.totalDebtUSD,
      mainCollateralSymbol: position.mainCollateralSymbol,
      mainCollateralAmount: position.mainCollateralAmount,
      mainCollateralPriceUSD: position.mainCollateralPriceUSD,
      liquidationPriceUSD: position.liquidationPriceUSD,
      liquidationThreshold: position.liquidationThreshold,
      positionJson: position.positionJson,
      status: "active",
    },
    update: {
      healthFactor: position.healthFactor,
      totalCollateralUSD: position.totalCollateralUSD,
      totalDebtUSD: position.totalDebtUSD,
      mainCollateralSymbol: position.mainCollateralSymbol,
      mainCollateralAmount: position.mainCollateralAmount,
      mainCollateralPriceUSD: position.mainCollateralPriceUSD,
      liquidationPriceUSD: position.liquidationPriceUSD,
      liquidationThreshold: position.liquidationThreshold,
      positionJson: position.positionJson,
      status: "active",
    },
  });
  return addr;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Phase 1: Fetch top borrowers by debt size (Chaos Labs discovery) ──
    const positions = await fetchTopBorrowers(300);
    console.log(`[radar] Fetched ${positions.length} top positions`);

    let upserted = 0;
    const seenAddresses = new Set<string>();

    for (const position of positions) {
      if (position.totalDebtUSD < 100_000) continue;
      try {
        const addr = await upsertPosition(position);
        seenAddresses.add(addr);
        upserted++;
      } catch (err) {
        console.error(`[radar] Failed to upsert ${position.walletAddress}:`, err);
      }
    }

    // ── Phase 2: Re-screen existing at-risk positions (HF < 1.5) ──
    // These may have fallen out of the top-300-by-debt list but are still
    // interesting to track (especially partially-liquidated positions with
    // 0.95 <= HF < 1 that survive due to the 50% close factor).
    const atRiskPositions = await prisma.radarPosition.findMany({
      where: {
        network: "ETHEREUM_V3",
        status: { in: ["active", "liquidated"] },
        healthFactor: { lt: 1.5 },
        walletAddress: { notIn: Array.from(seenAddresses) }, // skip already-updated
      },
      select: { walletAddress: true },
      take: 100,
    });

    if (atRiskPositions.length > 0) {
      const atRiskAddresses = atRiskPositions.map((p) => p.walletAddress);
      console.log(`[radar] Re-screening ${atRiskAddresses.length} at-risk positions`);

      const refreshed = await refreshPositionsByAddress(atRiskAddresses);
      for (const position of refreshed) {
        if (position.totalDebtUSD < 1) {
          // Position fully repaid/liquidated — mark as closed
          await prisma.radarPosition.updateMany({
            where: { walletAddress: position.walletAddress.toLowerCase(), network: "ETHEREUM_V3" },
            data: { status: "closed" },
          });
        } else {
          try {
            const addr = await upsertPosition(position);
            seenAddresses.add(addr);
            upserted++;
          } catch (err) {
            console.error(`[radar] Failed to upsert at-risk ${position.walletAddress}:`, err);
          }
        }
      }

      // Addresses that returned nothing from on-chain (no debt at all) — mark closed
      const refreshedAddrs = new Set(refreshed.map((p) => p.walletAddress.toLowerCase()));
      for (const addr of atRiskAddresses) {
        if (!refreshedAddrs.has(addr.toLowerCase()) && !seenAddresses.has(addr.toLowerCase())) {
          await prisma.radarPosition.updateMany({
            where: { walletAddress: addr, network: "ETHEREUM_V3" },
            data: { status: "closed" },
          });
        }
      }
    }

    // ── Phase 3: Mark stale positions (not seen in either phase) as closed ──
    if (seenAddresses.size > 0) {
      await prisma.radarPosition.updateMany({
        where: {
          network: "ETHEREUM_V3",
          status: "active",
          healthFactor: { gte: 1.5 }, // only close non-at-risk positions that disappeared
          walletAddress: { notIn: Array.from(seenAddresses) },
        },
        data: { status: "closed" },
      });
    }

    return NextResponse.json({ ok: true, upserted });
  } catch (err) {
    console.error("[radar] Positions cron failed:", err);
    return NextResponse.json(
      { error: "Internal error", details: String(err) },
      { status: 500 }
    );
  }
}
