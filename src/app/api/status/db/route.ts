import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "unknown";
    }
  })();

  try {
    const user = await prisma.user.findFirst({
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      connected: true,
      host,
      email: user?.email ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { connected: false, host, error: String(error) },
      { status: 500 }
    );
  }
}
