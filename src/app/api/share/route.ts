import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { address, network, name, details, config, type, aiSummary } = body;

  if (!name || !config) {
    return NextResponse.json(
      { error: "Missing required fields: name, config" },
      { status: 400 }
    );
  }

  // For aave/morpho type, address is required; for sandbox it's optional
  const projType = type === "sandbox" ? "sandbox" : type === "morpho" ? "morpho" : "aave";
  if ((projType === "aave" || projType === "morpho") && !address) {
    return NextResponse.json(
      { error: "Missing required field: address" },
      { status: 400 }
    );
  }

  const slug = nanoid(10);

  const shared = await prisma.sharedProjection.create({
    data: {
      slug,
      type: projType,
      userId: session.user.id,
      address: address ?? "",
      network: network ?? "ETHEREUM_V3",
      name,
      details: details ?? null,
      config,
      aiSummary: aiSummary ?? null,
    },
  });

  const origin = process.env.AUTH_URL || new URL(req.url).origin;
  const url = `${origin.replace(/\/$/, "")}/share/${shared.slug}`;

  return NextResponse.json({ slug: shared.slug, url }, { status: 201 });
}
