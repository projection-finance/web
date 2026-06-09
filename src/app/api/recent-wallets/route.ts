import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

const MAX_RECENT_WALLETS = 10;

/** GET — list recent wallets for the authenticated user */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallets = await prisma.recentWallet.findMany({
    where: { userId: session.user.id },
    orderBy: { lastUsed: "desc" },
    take: MAX_RECENT_WALLETS,
  });

  return NextResponse.json(
    wallets.map((w) => ({
      address: w.address,
      ensName: w.ensName ?? undefined,
      lastUsed: w.lastUsed.getTime(),
    }))
  );
}

/** POST — upsert a recent wallet (add or bump to top) */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { address, ensName } = body;

  if (!address || typeof address !== "string") {
    return NextResponse.json(
      { error: "Missing address" },
      { status: 400 }
    );
  }

  const normalized = address.toLowerCase();

  // Upsert: create or update lastUsed + ensName
  await prisma.recentWallet.upsert({
    where: {
      userId_address: { userId: session.user.id, address: normalized },
    },
    update: {
      lastUsed: new Date(),
      ensName: ensName ?? undefined,
    },
    create: {
      userId: session.user.id,
      address: normalized,
      ensName: ensName ?? null,
      lastUsed: new Date(),
    },
  });

  // Prune: keep only the latest MAX_RECENT_WALLETS
  const all = await prisma.recentWallet.findMany({
    where: { userId: session.user.id },
    orderBy: { lastUsed: "desc" },
    select: { id: true },
  });

  if (all.length > MAX_RECENT_WALLETS) {
    const toDelete = all.slice(MAX_RECENT_WALLETS).map((w) => w.id);
    await prisma.recentWallet.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE — clear all recent wallets for user, or a specific address */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const address = req.nextUrl.searchParams.get("address");

  if (address) {
    await prisma.recentWallet.deleteMany({
      where: {
        userId: session.user.id,
        address: address.toLowerCase(),
      },
    });
  } else {
    await prisma.recentWallet.deleteMany({
      where: { userId: session.user.id },
    });
  }

  return NextResponse.json({ ok: true });
}
