import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { getUserPlan } from "@/src/lib/plan";

// GET: list all custom tokens for the authenticated user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await prisma.customToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tokens);
}

// POST: create a custom token
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { features } = await getUserPlan();

  // Check plan limit
  const count = await prisma.customToken.count({
    where: { userId: session.user.id },
  });
  if (count >= features.maxCustomTokens) {
    return NextResponse.json(
      { error: "Upgrade to PRO to create custom tokens" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { symbol, name, priceInUSD, supplyAPY, variableBorrowAPY,
    baseLTVasCollateral, reserveLiquidationThreshold, reserveFactor,
    borrowingEnabled, usageAsCollateralEnabled, availableLiquidity } = body;

  if (!symbol || !name || priceInUSD == null || priceInUSD <= 0) {
    return NextResponse.json(
      { error: "Missing required fields: symbol, name, priceInUSD (> 0)" },
      { status: 400 }
    );
  }

  // Check symbol uniqueness per user
  const existing = await prisma.customToken.findUnique({
    where: { userId_symbol: { userId: session.user.id, symbol: symbol.toUpperCase() } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `You already have a token with symbol "${symbol.toUpperCase()}"` },
      { status: 409 }
    );
  }

  const token = await prisma.customToken.create({
    data: {
      userId: session.user.id,
      symbol: symbol.toUpperCase(),
      name,
      priceInUSD,
      supplyAPY: supplyAPY ?? 0,
      variableBorrowAPY: variableBorrowAPY ?? 0,
      baseLTVasCollateral: baseLTVasCollateral ?? 0.75,
      reserveLiquidationThreshold: reserveLiquidationThreshold ?? 0.8,
      reserveFactor: reserveFactor ?? 0.1,
      borrowingEnabled: borrowingEnabled ?? true,
      usageAsCollateralEnabled: usageAsCollateralEnabled ?? true,
      availableLiquidity: availableLiquidity ?? 1000000,
    },
  });

  return NextResponse.json(token, { status: 201 });
}
