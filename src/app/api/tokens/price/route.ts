import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.coingecko.com/api/v3";
const PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3";

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
  }

  const apiKey = process.env.COINGECKO_API_KEY;
  const baseUrl = apiKey ? PRO_BASE_URL : BASE_URL;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-pro-api-key"] = apiKey;

  try {
    const res = await fetch(
      `${baseUrl}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`,
      { headers }
    );

    if (!res.ok) {
      return NextResponse.json({}, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({});
  }
}
