import { NextResponse } from "next/server";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Re-check every 1 hour (not 24h — we want to detect recovery)

interface AlchemyHealth {
  ok: boolean;
  reason?: string;
  checkedAt: string;
}

let cached: AlchemyHealth | null = null;
let lastCheckTime = 0;

async function checkAlchemy(): Promise<AlchemyHealth> {
  const now = Date.now();

  // Return cache if fresh
  if (cached && now - lastCheckTime < CHECK_INTERVAL_MS) {
    return cached;
  }

  try {
    const res = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();

    if (data.error) {
      const msg = data.error.message || "Unknown RPC error";
      const isQuota = /capacity|limit|exceeded|429/i.test(msg);
      cached = {
        ok: false,
        reason: isQuota ? "quota_exceeded" : "rpc_error",
        checkedAt: new Date().toISOString(),
      };
    } else if (data.result) {
      cached = { ok: true, checkedAt: new Date().toISOString() };
    } else {
      cached = { ok: false, reason: "unexpected_response", checkedAt: new Date().toISOString() };
    }
  } catch (err) {
    cached = {
      ok: false,
      reason: err instanceof Error && /timeout/i.test(err.message) ? "timeout" : "network_error",
      checkedAt: new Date().toISOString(),
    };
  }

  lastCheckTime = now;
  return cached;
}

export async function GET() {
  const health = await checkAlchemy();
  return NextResponse.json(health, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    status: health.ok ? 200 : 503,
  });
}
