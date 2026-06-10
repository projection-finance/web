import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { getUserPlan } from "@/src/lib/plan";

const VALID_TYPES = ["aave", "sandbox", "morpho", "compound", "morpho-blue"];

// GET: list projections — allowed for all authenticated users (read-only for free)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeParam = req.nextUrl.searchParams.get("type");
  const where: Record<string, unknown> = { userId: session.user.id };
  if (typeParam && VALID_TYPES.includes(typeParam)) {
    where.type = typeParam;
  }

  const projections = await prisma.savedProjection.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      type: true,
      name: true,
      details: true,
      address: true,
      network: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(projections);
}

// POST: create projection — type-based gating
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, address, network, details, config, snapshots, type = "aave", aiSummary } = body;

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const { features } = await getUserPlan();

  if (type !== "sandbox") {
    // Protocol projections: aave, morpho, compound, morpho-blue
    if (!features.canSaveProjections) {
      return NextResponse.json(
        { error: "Upgrade to PRO to save projections" },
        { status: 403 }
      );
    }
    // Address is required for aave/morpho; compound/morpho-blue may omit it
    const addressRequired = type === "aave" || type === "morpho";
    if (!name || !config || (addressRequired && !address)) {
      return NextResponse.json(
        { error: addressRequired ? "Missing required fields: name, address, config" : "Missing required fields: name, config" },
        { status: 400 }
      );
    }
  } else {
    // sandbox
    if (!features.canSaveSandboxProjections) {
      return NextResponse.json(
        { error: "Cannot save sandbox projections" },
        { status: 403 }
      );
    }
    if (!name || !config) {
      return NextResponse.json(
        { error: "Missing required fields: name, config" },
        { status: 400 }
      );
    }
    // Free user token limit
    if (
      features.maxSandboxTokens !== Infinity &&
      config.holdings &&
      Array.isArray(config.holdings) &&
      config.holdings.length > features.maxSandboxTokens
    ) {
      return NextResponse.json(
        { error: `Free plan limited to ${features.maxSandboxTokens} tokens per sandbox save` },
        { status: 403 }
      );
    }
  }

  const projection = await prisma.savedProjection.create({
    data: {
      userId: session.user.id,
      type,
      name,
      address: address ?? null,
      network: network ?? "ETHEREUM_V3",
      details: details ?? null,
      config,
      snapshots: snapshots ?? null,
      aiSummary: aiSummary ?? null,
    },
  });

  return NextResponse.json(projection, { status: 201 });
}
