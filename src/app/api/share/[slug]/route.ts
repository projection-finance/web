import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const shared = await prisma.sharedProjection.findUnique({
    where: { slug },
    select: {
      type: true,
      name: true,
      details: true,
      address: true,
      network: true,
      config: true,
      aiSummary: true,
      createdAt: true,
    },
  });

  if (!shared) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(shared);
}
