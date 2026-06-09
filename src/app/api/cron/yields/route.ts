import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint: full yields refresh for daily APY snapshots.
 * Triggers /api/yields?force=true to fetch ALL networks and write snapshots.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `http://localhost:${process.env.PORT || 3000}`;

    const res = await fetch(`${baseUrl}/api/yields?force=true`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Yields fetch failed", status: res.status },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      ok: true,
      rows: data.rows?.length ?? 0,
      errors: data.errors?.length ?? 0,
    });
  } catch (err) {
    console.error("[cron/yields] Failed:", err);
    return NextResponse.json(
      { error: "Internal error", details: String(err) },
      { status: 500 }
    );
  }
}
