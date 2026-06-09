import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

// PUT: update a custom token
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.customToken.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If symbol is changing, check uniqueness
  if (body.symbol && body.symbol.toUpperCase() !== existing.symbol) {
    const conflict = await prisma.customToken.findUnique({
      where: { userId_symbol: { userId: session.user.id, symbol: body.symbol.toUpperCase() } },
    });
    if (conflict) {
      return NextResponse.json(
        { error: `You already have a token with symbol "${body.symbol.toUpperCase()}"` },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.customToken.update({
    where: { id },
    data: {
      symbol: body.symbol ? body.symbol.toUpperCase() : existing.symbol,
      name: body.name ?? existing.name,
      priceInUSD: body.priceInUSD ?? existing.priceInUSD,
      supplyAPY: body.supplyAPY ?? existing.supplyAPY,
      variableBorrowAPY: body.variableBorrowAPY ?? existing.variableBorrowAPY,
      baseLTVasCollateral: body.baseLTVasCollateral ?? existing.baseLTVasCollateral,
      reserveLiquidationThreshold: body.reserveLiquidationThreshold ?? existing.reserveLiquidationThreshold,
      reserveFactor: body.reserveFactor ?? existing.reserveFactor,
      borrowingEnabled: body.borrowingEnabled ?? existing.borrowingEnabled,
      usageAsCollateralEnabled: body.usageAsCollateralEnabled ?? existing.usageAsCollateralEnabled,
      availableLiquidity: body.availableLiquidity ?? existing.availableLiquidity,
    },
  });

  return NextResponse.json(updated);
}

// DELETE: remove a custom token
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.customToken.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.customToken.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
