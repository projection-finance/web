import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { getUserPlan } from "@/src/lib/plan";

// GET: load a single projection — allowed for all authenticated users (read-only for free)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const projection = await prisma.savedProjection.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!projection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(projection);
}

// PUT: update projection — type-based gating
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.savedProjection.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { features } = await getUserPlan();

  if (existing.type === "sandbox") {
    if (!features.canSaveSandboxProjections) {
      return NextResponse.json(
        { error: "Cannot update sandbox projections" },
        { status: 403 }
      );
    }
  } else {
    // aave (or any other future type)
    if (!features.canSaveProjections) {
      return NextResponse.json(
        { error: "Upgrade to PRO to update projections" },
        { status: 403 }
      );
    }
  }

  const body = await req.json();

  // Sandbox token limit check on update
  if (
    existing.type === "sandbox" &&
    body.config &&
    features.maxSandboxTokens !== Infinity &&
    body.config.holdings &&
    Array.isArray(body.config.holdings) &&
    body.config.holdings.length > features.maxSandboxTokens
  ) {
    return NextResponse.json(
      { error: `Free plan limited to ${features.maxSandboxTokens} tokens per sandbox save` },
      { status: 403 }
    );
  }

  const updated = await prisma.savedProjection.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      details: body.details !== undefined ? body.details : existing.details,
      config: body.config ?? existing.config,
      snapshots: body.snapshots ?? existing.snapshots,
      aiSummary: body.aiSummary !== undefined ? body.aiSummary : existing.aiSummary,
    },
  });

  return NextResponse.json(updated);
}

// DELETE: remove projection — allowed for all authenticated users (own data)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.savedProjection.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.savedProjection.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
