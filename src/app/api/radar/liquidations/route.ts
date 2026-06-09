import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const network = params.get("network") || "ETHEREUM_V3";
  const limit = Math.min(Number(params.get("limit") || 20), 100);
  const offset = Number(params.get("offset") || 0);

  const [liquidations, total] = await Promise.all([
    prisma.radarLiquidation.findMany({
      where: { network },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.radarLiquidation.count({ where: { network } }),
  ]);

  return NextResponse.json({ liquidations, total });
}
