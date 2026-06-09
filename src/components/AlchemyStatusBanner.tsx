"use client";

import { useState, useEffect } from "react";

interface AlchemyHealth {
  ok: boolean;
  reason?: string;
  checkedAt: string;
}

/**
 * Shows a warning banner when Alchemy RPC is unavailable (quota exceeded, etc.).
 * Checks /api/health/alchemy once on mount (cached server-side for 1h).
 */
export default function AlchemyStatusBanner() {
  const [health, setHealth] = useState<AlchemyHealth | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/health/alchemy")
      .then((r) => r.json())
      .then(setHealth)
      .catch((err) => { console.warn("[AlchemyStatus] Health check failed:", err.message); });
  }, []);

  if (!health || health.ok || dismissed) return null;

  const messages: Record<string, { title: string; detail: string }> = {
    quota_exceeded: {
      title: "RPC quota exceeded",
      detail: "Alchemy monthly limit reached. On-chain data (Aave, Compound, Spark, wallet scans) is temporarily unavailable. Morpho data still works.",
    },
    rpc_error: {
      title: "RPC service error",
      detail: "The blockchain data provider is returning errors. Some features may not work correctly.",
    },
    timeout: {
      title: "RPC service slow",
      detail: "The blockchain data provider is responding slowly. Data may take longer to load.",
    },
    network_error: {
      title: "RPC service unreachable",
      detail: "Cannot reach the blockchain data provider. Please try again later.",
    },
  };

  const msg = messages[health.reason || ""] || messages.rpc_error;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-amber-500 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </span>
        <div className="min-w-0">
          <span className="text-xs font-semibold text-amber-700">{msg.title}</span>
          <span className="text-xs text-amber-600 ml-1.5 hidden sm:inline">{msg.detail}</span>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
