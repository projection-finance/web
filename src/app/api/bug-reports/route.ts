import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json();
  const { message, page, userAgent } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  await prisma.bugReport.create({
    data: {
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      message: message.trim(),
      page: page ?? null,
      userAgent: userAgent ?? null,
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
