import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.favoriteWallet.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.favoriteWallet.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.favoriteWallet.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { addNetwork, removeNetwork, label } = body;

  const data: Record<string, unknown> = {};

  if (label !== undefined) {
    data.label = label;
  }

  if (addNetwork) {
    const current = (existing.monitoredNetworks as string[] | null) ?? [];
    if (!current.includes(addNetwork)) {
      data.monitoredNetworks = [...current, addNetwork];
    }
  }

  if (removeNetwork) {
    const current = (existing.monitoredNetworks as string[] | null) ?? [];
    const updated = current.filter((n) => n !== removeNetwork);
    data.monitoredNetworks = updated.length > 0 ? updated : [];

    // Also remove from healthFactors
    if (existing.healthFactors && typeof existing.healthFactors === "object") {
      const hfMap = { ...(existing.healthFactors as Record<string, unknown>) };
      delete hfMap[removeNetwork];
      data.healthFactors = Object.keys(hfMap).length > 0 ? hfMap : null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(existing);
  }

  const updated = await prisma.favoriteWallet.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
