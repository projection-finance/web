"use client";

import Link from "next/link";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { StressTestSummary, StressStatus, PriceChange } from "@/src/lib/radar/stressTest";
import { type NetworkId, networkIdToSlug } from "@/src/lib/aave/networks";

interface StressTestResultsProps {
  summary: StressTestSummary;
  priceChanges: PriceChange[];
  network: NetworkId;
}

function formatUSD(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function truncAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatHF(hf: number): string {
  if (!isFinite(hf) || hf > 1e10) return "∞";
  if (hf < 0.01) return "Liq.";
  return hf.toFixed(2);
}

const STATUS_CONFIG: Record<StressStatus, { label: string; color: string; bg: string; border: string }> = {
  liquidated_full: { label: "LIQUIDATED 100%", color: "text-red-700", bg: "bg-red-100", border: "border-red-200" },
  liquidated_partial: { label: "LIQUIDATED 50%", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  entered_risk: { label: "AT RISK", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  exited_risk: { label: "SAFER", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  safer: { label: "IMPROVED", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  riskier: { label: "WEAKER", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  unchanged: { label: "UNCHANGED", color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-200" },
};

function buildProjectionURL(walletAddress: string, network: NetworkId, priceChanges: PriceChange[]): string {
  const params = new URLSearchParams({ wallet: walletAddress });
  if (network !== "ETHEREUM_V3") params.set("network", network);
  if (priceChanges.length > 0) {
    const stressParam = priceChanges
      .filter((p) => p.percentChange !== 0)
      .map((p) => `${p.symbol}:${p.percentChange}`)
      .join(",");
    params.set("stress", stressParam);
  }
  return `/?${params.toString()}`;
}

export default function StressTestResults({ summary, priceChanges, network }: StressTestResultsProps) {
  const networkSlug = networkIdToSlug(network);
  const { results, liquidatedCount, liquidatedValueUSD, enteredRiskCount, exitedRiskCount } = summary;

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Shield className="w-10 h-10 text-gray-200" />
        <p className="text-sm text-gray-400">No significant impact detected. Adjust the price scenarios above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
          <div>
            <p className="text-lg font-bold text-red-600">{liquidatedCount}</p>
            <p className="text-[10px] text-red-400">would be liquidated</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <p className="text-lg font-bold text-red-600">{formatUSD(liquidatedValueUSD)}</p>
            <p className="text-[10px] text-red-400">debt at risk</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-lg font-bold text-amber-600">{enteredRiskCount}</p>
            <p className="text-[10px] text-amber-400">enter risk zone</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <p className="text-lg font-bold text-emerald-600">{exitedRiskCount}</p>
            <p className="text-[10px] text-emerald-400">exit risk zone</p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-1.5">
        {results.map((result, i) => {
          const cfg = STATUS_CONFIG[result.status];
          const projectionUrl = buildProjectionURL(result.position.walletAddress, network, priceChanges);

          return (
            <Card key={result.position.id} className="bg-white hover:border-gray-300 transition-colors">
              <CardContent className="p-0">
                <div className="px-3 sm:px-4 py-3">
                  {/* Top row: rank + wallet + badge + HF change */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-gray-300 shrink-0">{i + 1}</span>
                      <Link
                        href={`/radar/${networkSlug}/${result.position.walletAddress}`}
                        className="text-xs font-mono text-[#303549] hover:text-[#5382E3] transition-colors truncate"
                      >
                        {truncAddr(result.position.walletAddress)}
                      </Link>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-gray-400">{formatHF(result.currentHF)}</span>
                      <ArrowRight className={`w-3 h-3 ${result.deltaHF < 0 ? "text-red-400" : "text-emerald-400"}`} />
                      <span className={`text-xs font-bold ${
                        result.stressedHF < 0.95 ? "text-red-600"
                        : result.stressedHF < 1 ? "text-red-500"
                        : result.stressedHF < 1.1 ? "text-amber-600"
                        : "text-emerald-600"
                      }`}>
                        {formatHF(result.stressedHF)}
                      </span>
                    </div>
                  </div>

                  {/* Summary + action */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] sm:text-[11px] text-gray-500 leading-snug flex-1 min-w-0">
                      {result.summary}
                    </p>
                    <Link
                      href={projectionUrl}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#5382E3] bg-blue-50 hover:bg-blue-100 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Simulate
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
