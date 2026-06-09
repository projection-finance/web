import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const network = params.get("network") || "ETHEREUM_V3";
  const maxHf = params.get("maxHf") ? Number(params.get("maxHf")) : undefined;
  const minDebt = params.get("minDebt") ? Number(params.get("minDebt")) : 0;
  const limit = Math.min(Number(params.get("limit") || 50), 200);
  const offset = Number(params.get("offset") || 0);

  const where = {
    network,
    status: { in: ["active", "liquidated"] }, // include partially-liquidated positions still tracked
    totalDebtUSD: { gte: minDebt },
    ...(maxHf !== undefined ? { healthFactor: { lte: maxHf } } : {}),
  };

  const [positions, total] = await Promise.all([
    prisma.radarPosition.findMany({
      where,
      orderBy: { totalDebtUSD: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.radarPosition.count({ where }),
  ]);

  // Aggregate stats
  const atRisk = await prisma.radarPosition.count({
    where: { network, status: { in: ["active", "liquidated"] }, healthFactor: { lt: 1.1 } },
  });

  const atRiskValue = await prisma.radarPosition.aggregate({
    where: { network, status: { in: ["active", "liquidated"] }, healthFactor: { lt: 1.1 } },
    _sum: { totalDebtUSD: true },
  });

  return NextResponse.json({
    positions,
    total,
    stats: {
      totalTracked: total,
      atRiskCount: atRisk,
      atRiskValueUSD: atRiskValue._sum.totalDebtUSD || 0,
    },
  });
}
