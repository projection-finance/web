/**
 * Alchemy RPC error monitor.
 *
 * Wraps ethers providers to detect non-200 responses (quota exceeded,
 * auth failures, rate limits, etc.) and sends an email alert to the admin.
 * Rate-limited to 1 email per hour to avoid spam.
 */

import { ethers } from "ethers";

const ALERT_EMAIL = process.env.ALERT_EMAIL || "";
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// In-memory tracking
let lastAlertSentAt = 0;
const recentErrors: { timestamp: number; chain: string; method: string; code: string; message: string }[] = [];
const MAX_RECENT_ERRORS = 50;

function recordError(chain: string, method: string, code: string, message: string) {
  const entry = { timestamp: Date.now(), chain, method, code, message };
  recentErrors.push(entry);
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.shift();

  // Rate-limited email alert
  const now = Date.now();
  if (now - lastAlertSentAt >= ALERT_COOLDOWN_MS) {
    lastAlertSentAt = now;
    sendAlertEmail(entry).catch((err) => { console.warn("[RPC Monitor] Alert email failed:", err.message); });
  }
}

async function sendAlertEmail(error: typeof recentErrors[0]) {
  try {
    const { Resend } = await import("resend");
    const key = process.env.AUTH_RESEND_KEY;
    if (!key || !ALERT_EMAIL) return;

    const resend = new Resend(key);
    const errorsLast10 = recentErrors.slice(-10);
    const errorList = errorsLast10
      .map((e) => `<li><code>${e.chain}</code> — ${e.method} — <strong>${e.code}</strong>: ${e.message} <span style="color:#999">(${new Date(e.timestamp).toISOString()})</span></li>`)
      .join("\n");

    await resend.emails.send({
      from: "Projection Finance <noreply@projection.finance>",
      to: ALERT_EMAIL,
      subject: `[RPC Alert] Alchemy error on ${error.chain}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#303549;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#EF4444;margin:0 0 16px;">Alchemy RPC Error Detected</h2>
<p><strong>Chain:</strong> ${error.chain}<br>
<strong>Method:</strong> ${error.method}<br>
<strong>Error:</strong> ${error.code} — ${error.message}<br>
<strong>Time:</strong> ${new Date(error.timestamp).toISOString()}</p>
<h3 style="margin:24px 0 8px;">Recent errors (last ${errorsLast10.length}):</h3>
<ul style="font-size:12px;padding-left:16px;">${errorList}</ul>
<p style="font-size:11px;color:#999;margin-top:24px;">This alert is rate-limited to 1 email per hour.<br>Total errors tracked in memory: ${recentErrors.length}</p>
</body></html>`,
    });
  } catch {
    // Email send failed — nothing we can do
  }
}

/**
 * Check if an ethers error is an Alchemy-level failure (quota, auth, rate limit).
 * Returns { code, message } if it's a reportable error, null otherwise.
 */
function parseRpcError(err: unknown): { code: string; message: string } | null {
  if (!err) return null;

  const errObj = err as { code?: string | number; message?: string; reason?: string; body?: string; status?: number };

  // HTTP-level errors (429, 401, 403, 502, 503)
  if (errObj.status && errObj.status !== 200) {
    return { code: `HTTP_${errObj.status}`, message: errObj.message || "Non-200 response" };
  }

  // ethers SERVER_ERROR wraps HTTP failures
  if (errObj.code === "SERVER_ERROR") {
    return { code: "SERVER_ERROR", message: errObj.message || "Server error" };
  }

  // Rate limit
  if (errObj.code === 429 || errObj.code === "RATE_LIMIT" || (errObj.message && /rate.?limit|429|too many/i.test(errObj.message))) {
    return { code: "RATE_LIMITED", message: errObj.message || "Rate limited" };
  }

  // Auth / quota
  if (errObj.message && /unauthorized|forbidden|quota|capacity|exceeded|invalid.*key/i.test(errObj.message)) {
    return { code: "AUTH_OR_QUOTA", message: errObj.message };
  }

  // Timeout
  if (errObj.code === "TIMEOUT" || (errObj.message && /timeout/i.test(errObj.message))) {
    return { code: "TIMEOUT", message: errObj.message || "Request timeout" };
  }

  // JSON-RPC errors from Alchemy (code -32xxx)
  if (typeof errObj.code === "number" && errObj.code < -32000) {
    return { code: `RPC_${errObj.code}`, message: errObj.message || errObj.reason || "RPC error" };
  }

  return null;
}

/**
 * Create a monitored ethers provider that reports Alchemy errors.
 * Drop-in replacement for `new ethers.providers.StaticJsonRpcProvider(url, chainId?)`.
 */
export function createMonitoredProvider(
  url: string,
  chainLabel: string,
  chainId?: number,
): ethers.providers.StaticJsonRpcProvider {
  // Set connection timeout to 15s (default ethers is 120s which blocks SSE streams)
  const provider = new ethers.providers.StaticJsonRpcProvider(
    { url, timeout: 15_000 },
    chainId,
  );

  // Wrap the internal `send` method to intercept errors
  const originalSend = provider.send.bind(provider);
  provider.send = async function monitoredSend(method: string, params: unknown[]) {
    try {
      return await originalSend(method, params);
    } catch (err) {
      const parsed = parseRpcError(err);
      if (parsed) {
        recordError(chainLabel, method, parsed.code, parsed.message);
      }
      throw err; // Re-throw so callers still handle the error normally
    }
  };

  // Also wrap `perform` which is used by contract calls
  const originalPerform = provider.perform.bind(provider);
  provider.perform = async function monitoredPerform(method: string, params: unknown) {
    try {
      return await originalPerform(method, params);
    } catch (err) {
      const parsed = parseRpcError(err);
      if (parsed) {
        recordError(chainLabel, `perform:${method}`, parsed.code, parsed.message);
      }
      throw err;
    }
  };

  return provider;
}

/** Get recent errors for diagnostics (e.g., health check endpoint) */
export function getRecentRpcErrors() {
  return [...recentErrors];
}
