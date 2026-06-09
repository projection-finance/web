import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { getUserPlan } from "@/src/lib/plan";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallets = await prisma.favoriteWallet.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(wallets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { features } = await getUserPlan();
  if (!features.canSaveFavoriteWallets) {
    return NextResponse.json(
      { error: "Upgrade to PRO to save favorite wallets" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { address, label, networks } = body;

  if (!address || !label) {
    return NextResponse.json(
      { error: "Address and label are required" },
      { status: 400 }
    );
  }

  const normalized = address.toLowerCase().trim();

  const existing = await prisma.favoriteWallet.findUnique({
    where: { userId_address: { userId: session.user.id, address: normalized } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This wallet is already in your favorites" },
      { status: 409 }
    );
  }

  const wallet = await prisma.favoriteWallet.create({
    data: {
      userId: session.user.id,
      address: normalized,
      label: label.trim(),
      monitoredNetworks: Array.isArray(networks) && networks.length > 0 ? networks : undefined,
    },
  });

  return NextResponse.json(wallet, { status: 201 });
}
