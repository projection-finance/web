"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  Radar,
  TrendingDown,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Shield,
  DollarSign,
  Copy,
  Check,
  ArrowUpDown,
  Zap,
} from "lucide-react";
import Link from "next/link";
import AaveIcon from "@/src/components/icons/AaveIcon";
import { type NetworkId, getNetworkById, networkIdToSlug } from "@/src/lib/aave/networks";
import { runStressTest, extractUniqueAssets, type PriceChange, type RadarPositionForStress } from "@/src/lib/radar/stressTest";
import StressTestPanel from "@/src/components/radar/StressTestPanel";
import StressTestResults from "@/src/components/radar/StressTestResults";

// ── Types ──

interface RadarPosition {
  id: string;
  walletAddress: string;
  healthFactor: number;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  mainCollateralSymbol: string;
  mainCollateralAmount: number;
  mainCollateralPriceUSD: number;
  liquidationPriceUSD: number | null;
  liquidationThreshold: number;
  positionJson: {
    collaterals: { symbol: string; amountUSD: number; amount: number; liqThreshold: number }[];
    debts: { symbol: string; amountUSD: number; amount: number }[];
  } | null;
  status: string;
  updatedAt: string;
}

interface RadarLiquidation {
  id: string;
  txHash: string;
  walletAddress: string;
  liquidatorAddress: string;
  collateralAssetSymbol: string;
  collateralSeizedAmount: number;
  collateralSeizedUSD: number;
  debtAssetSymbol: string;
  debtRepaidAmount: number;
  debtRepaidUSD: number;
  timestamp: string;
}

interface Stats {
  totalTracked: number;
  atRiskCount: number;
  atRiskValueUSD: number;
}

type Tab = "positions" | "liquidations" | "stress";
type RiskFilter = string; // "all" or a numeric string like "1.35"
type SortMode = "hf_asc" | "position_desc";

// ── Helpers ──

function getHfColor(hf: number): string {
  if (hf >= 2.0) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (hf >= 1.5) return "bg-emerald-50 text-emerald-600 border-emerald-200";
  if (hf >= 1.3) return "bg-amber-50 text-amber-700 border-amber-200";
  if (hf >= 1.1) return "bg-orange-50 text-orange-700 border-orange-200";
  if (hf >= 1.0) return "bg-red-50 text-red-700 border-red-200";
  if (hf >= 0.95) return "bg-red-100 text-red-700 border-red-300"; // 50% close factor
  return "bg-red-200 text-red-900 border-red-400"; // 100% close factor (HF < 0.95)
}

function getHfDot(hf: number): string {
  if (hf >= 1.5) return "bg-emerald-400";
  if (hf >= 1.1) return "bg-amber-400";
  if (hf >= 1.0) return "bg-orange-400";
  if (hf >= 0.95) return "bg-red-500 animate-pulse";
  return "bg-red-600 animate-pulse";
}

function formatUSD(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatUSDFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatAmount(n: number, symbol: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${symbol}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K ${symbol}`;
  if (n >= 1) return `${n.toFixed(2)} ${symbol}`;
  return `${n.toFixed(4)} ${symbol}`;
}

function truncAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** How much collateral value can drop before liquidation, derived from HF.
 *  HF = collateral*LT / debt → buffer = (HF - 1) / HF = 1 - 1/HF */
function liqBuffer(hf: number): { label: string; color: string } {
  if (!isFinite(hf) || hf > 100) return { label: "Safe", color: "text-emerald-600" };
  if (hf < 0.95) return { label: "Liquidatable (100%)", color: "text-red-600" };
  if (hf < 1) return { label: "Liquidatable (50%)", color: "text-red-500" };
  const pct = ((hf - 1) / hf) * 100;
  if (pct < 5) return { label: `${pct.toFixed(1)}% buffer`, color: "text-red-500" };
  if (pct < 15) return { label: `${pct.toFixed(1)}% buffer`, color: "text-amber-600" };
  if (pct < 30) return { label: `${pct.toFixed(1)}% buffer`, color: "text-amber-500" };
  return { label: `${pct.toFixed(0)}% buffer`, color: "text-emerald-600" };
}

// ── CopyButton ──

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Main Component ──

export default function RadarClient({ defaultNetwork = "ETHEREUM_V3" as NetworkId }: { defaultNetwork?: NetworkId } = {}) {
  const networkMeta = getNetworkById(defaultNetwork);
  const networkSlug = networkIdToSlug(defaultNetwork);
  const [tab, setTab] = useState<Tab>("positions");
  const [positions, setPositions] = useState<RadarPosition[]>([]);
  const [liquidations, setLiquidations] = useState<RadarLiquidation[]>([]);
  const [stats, setStats] = useState<Stats>({ totalTracked: 0, atRiskCount: 0, atRiskValueUSD: 0 });
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [sortMode, setSortMode] = useState<SortMode>("hf_asc");
  const [stressPriceChanges, setStressPriceChanges] = useState<PriceChange[]>([]);

  // Stress test computation (real-time, no button needed)
  const uniqueAssets = useMemo(() => extractUniqueAssets(positions as RadarPositionForStress[]), [positions]);
  const stressTestSummary = useMemo(
    () => runStressTest(positions as RadarPositionForStress[], stressPriceChanges, 10),
    [positions, stressPriceChanges]
  );

  const fetchPositions = useCallback(async () => {
    try {
      const maxHf = riskFilter !== "all" ? riskFilter : "";
      const params = new URLSearchParams({ limit: "100", network: defaultNetwork });
      if (maxHf) params.set("maxHf", maxHf);

      const res = await fetch(`/api/radar/positions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions);
        setStats(data.stats);
      }
    } catch { /* silent */ }
  }, [riskFilter, defaultNetwork]);

  const fetchLiquidations = useCallback(async () => {
    try {
      const res = await fetch(`/api/radar/liquidations?limit=50&network=${defaultNetwork}`);
      if (res.ok) {
        const data = await res.json();
        setLiquidations(data.liquidations);
      }
    } catch { /* silent */ }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPositions(), fetchLiquidations()]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [fetchPositions, fetchLiquidations]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Re-fetch positions when filter changes
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const sortedPositions = useMemo(() => {
    const sorted = [...positions];
    if (sortMode === "hf_asc") {
      // Closest to 1 first (ascending HF)
      sorted.sort((a, b) => a.healthFactor - b.healthFactor);
    } else {
      // Largest position first (descending collateral)
      sorted.sort((a, b) => b.totalCollateralUSD - a.totalCollateralUSD);
    }
    return sorted;
  }, [positions, sortMode]);

  const [customHfInput, setCustomHfInput] = useState("");
  const presets = [
    { value: "all", label: "All" },
    { value: "2.0", label: "< 2.0" },
    { value: "1.5", label: "< 1.5" },
    { value: "1.1", label: "< 1.1" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Radar className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-[#303549]">Liquidation Radar</h1>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
              <AaveIcon size={12} />
              <span className="text-[10px] sm:text-xs text-gray-400">Aave V3 {networkMeta?.name ?? "Ethereum"}</span>
              <span className="text-[10px] sm:text-xs text-gray-300">
                Updated {timeAgo(lastRefresh.toISOString())}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-[#5382E3] hover:text-[#4270D0] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-6">
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-4 flex sm:block items-center justify-between">
            <div className="flex items-center gap-2 sm:mb-1">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Tracked</span>
            </div>
            <div className="flex items-baseline gap-1.5 sm:block">
              <p className="text-xl sm:text-2xl font-bold text-[#303549]">{stats.totalTracked}</p>
              <p className="text-[10px] text-gray-400 sm:mt-0.5">whale positions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-4 flex sm:block items-center justify-between">
            <div className="flex items-center gap-2 sm:mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">At Risk</span>
            </div>
            <div className="flex items-baseline gap-1.5 sm:block">
              <p className="text-xl sm:text-2xl font-bold text-amber-600">{stats.atRiskCount}</p>
              <p className="text-[10px] text-gray-400 sm:mt-0.5">HF &lt; 1.1</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-4 flex sm:block items-center justify-between">
            <div className="flex items-center gap-2 sm:mb-1">
              <DollarSign className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Value at Risk</span>
            </div>
            <div className="flex items-baseline gap-1.5 sm:block">
              <p className="text-xl sm:text-2xl font-bold text-red-600">{formatUSD(stats.atRiskValueUSD)}</p>
              <p className="text-[10px] text-gray-400 sm:mt-0.5">total debt at risk</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-4">
        <button
          onClick={() => setTab("positions")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            tab === "positions"
              ? "bg-[#303549] text-white"
              : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          <Radar className="w-3.5 h-3.5" />
          Whale Positions
        </button>
        <button
          onClick={() => setTab("liquidations")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            tab === "liquidations"
              ? "bg-[#303549] text-white"
              : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Recent Liquidations
        </button>
        <button
          onClick={() => setTab("stress")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            tab === "stress"
              ? "bg-[#303549] text-white"
              : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Stress Test
        </button>
      </div>

      {/* Stress Test Tab */}
      {tab === "stress" && (
        <div className="space-y-4">
          <StressTestPanel
            availableAssets={uniqueAssets}
            priceChanges={stressPriceChanges}
            onChange={setStressPriceChanges}
          />
          <StressTestResults
            summary={stressTestSummary}
            priceChanges={stressPriceChanges}
            network={defaultNetwork}
          />
        </div>
      )}

      {/* Positions Tab */}
      {tab === "positions" && (
        <>
          {/* Risk filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mr-1">Max HF</span>
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => { setRiskFilter(p.value); setCustomHfInput(""); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  riskFilter === p.value && !customHfInput
                    ? "bg-[#303549] text-white"
                    : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="10"
                placeholder="Custom"
                value={customHfInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomHfInput(val);
                  if (val && Number(val) > 0) {
                    setRiskFilter(val);
                  } else if (!val) {
                    setRiskFilter("all");
                  }
                }}
                className={`w-20 h-7 rounded-md text-[11px] font-medium px-2 border outline-none transition-colors ${
                  customHfInput
                    ? "border-[#303549] bg-[#303549] text-white placeholder-gray-400"
                    : "border-gray-200 bg-white text-gray-500 placeholder-gray-300 hover:border-gray-300 focus:border-[#5382E3]"
                }`}
              />
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mr-1">Sort by</span>
            <button
              onClick={() => setSortMode("hf_asc")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                sortMode === "hf_asc"
                  ? "bg-[#303549] text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <ArrowUpDown className="w-3 h-3" />
              HF closest to 1
            </button>
            <button
              onClick={() => setSortMode("position_desc")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                sortMode === "position_desc"
                  ? "bg-[#303549] text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <DollarSign className="w-3 h-3" />
              Largest position
            </button>
          </div>

          {loading && positions.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="animate-pulse bg-white">
                  <CardContent className="p-4">
                    <div className="h-5 bg-gray-100 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-gray-50 rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : positions.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <Shield className="w-10 h-10 text-gray-300" />
                <p className="text-sm text-gray-400">No positions match this filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {/* Table header — desktop only */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-2">Wallet</div>
                <div className="col-span-1 text-center">HF</div>
                <div className="col-span-2 text-right">Collateral</div>
                <div className="col-span-2 text-right">Debt</div>
                <div className="col-span-2">Main Asset</div>
                <div className="col-span-2 text-right">Buffer</div>
              </div>

              {sortedPositions.map((pos, i) => {
                const buffer = liqBuffer(pos.healthFactor);

                return (
                  <Card key={pos.id} className="bg-white hover:border-gray-300 transition-colors group">
                    <CardContent className="p-0">
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 items-center">
                        {/* Rank */}
                        <div className="col-span-1">
                          <span className="text-xs font-mono text-gray-300">{i + 1}</span>
                        </div>

                        {/* Wallet */}
                        <div className="col-span-2 flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getHfDot(pos.healthFactor)}`} />
                          <Link
                            href={`/radar/${networkSlug}/${pos.walletAddress}`}
                            className="text-xs font-mono text-[#303549] hover:text-[#5382E3] transition-colors"
                          >
                            {truncAddr(pos.walletAddress)}
                          </Link>
                          <CopyButton text={pos.walletAddress} />
                        </div>

                        {/* Health Factor */}
                        <div className="col-span-1 flex justify-center">
                          <span className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 border ${getHfColor(pos.healthFactor)}`}>
                            {pos.healthFactor < 100 ? pos.healthFactor.toFixed(2) : "Safe"}
                          </span>
                        </div>

                        {/* Collateral */}
                        <div className="col-span-2 text-right">
                          <p className="text-xs font-semibold text-[#303549]">
                            {formatUSD(pos.totalCollateralUSD)}
                          </p>
                        </div>

                        {/* Debt */}
                        <div className="col-span-2 text-right">
                          <p className="text-xs font-semibold text-[#303549]">
                            {formatUSD(pos.totalDebtUSD)}
                          </p>
                        </div>

                        {/* Main Asset */}
                        <div className="col-span-2">
                          <p className="text-xs text-[#303549] font-medium">
                            {formatAmount(pos.mainCollateralAmount, pos.mainCollateralSymbol)}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            @ {formatUSDFull(pos.mainCollateralPriceUSD)}
                          </p>
                        </div>

                        {/* Buffer */}
                        <div className="col-span-2 text-right">
                          <p className={`text-xs font-semibold ${buffer.color}`}>
                            {buffer.label}
                          </p>
                        </div>
                      </div>

                      {/* Mobile card layout */}
                      <Link
                        href={`/radar/${networkSlug}/${pos.walletAddress}`}
                        className="md:hidden block px-3 py-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono text-gray-300 shrink-0">{i + 1}</span>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getHfDot(pos.healthFactor)}`} />
                            <span className="text-xs font-mono text-[#303549] truncate">
                              {truncAddr(pos.walletAddress)}
                            </span>
                          </div>
                          <span className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 border shrink-0 ml-2 ${getHfColor(pos.healthFactor)}`}>
                            {pos.healthFactor < 100 ? pos.healthFactor.toFixed(2) : "Safe"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <p className="text-gray-400">Collateral</p>
                            <p className="font-semibold text-[#303549]">{formatUSD(pos.totalCollateralUSD)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Debt</p>
                            <p className="font-semibold text-[#303549]">{formatUSD(pos.totalDebtUSD)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400">Buffer</p>
                            <p className={`font-semibold ${buffer.color}`}>{buffer.label}</p>
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Liquidations Tab */}
      {tab === "liquidations" && (
        <>
          {loading && liquidations.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="animate-pulse bg-white">
                  <CardContent className="p-4">
                    <div className="h-5 bg-gray-100 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-gray-50 rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : liquidations.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <TrendingDown className="w-10 h-10 text-gray-300" />
                <p className="text-sm text-gray-400">No recent liquidations found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {/* Table header — desktop only */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Wallet</div>
                <div className="col-span-3">Collateral Seized</div>
                <div className="col-span-3">Debt Repaid</div>
                <div className="col-span-2 text-right">Tx</div>
              </div>

              {liquidations.map((liq) => (
                <Card key={liq.id} className="bg-white hover:border-gray-300 transition-colors">
                  <CardContent className="p-0">
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 items-center">
                      {/* Time */}
                      <div className="col-span-2">
                        <span className="text-xs text-gray-500">{timeAgo(liq.timestamp)}</span>
                      </div>

                      {/* Wallet */}
                      <div className="col-span-2 flex items-center gap-1.5">
                        <Link
                          href={`/radar/${networkSlug}/${liq.walletAddress}`}
                          className="text-xs font-mono text-[#303549] hover:text-[#5382E3] transition-colors"
                        >
                          {truncAddr(liq.walletAddress)}
                        </Link>
                        <CopyButton text={liq.walletAddress} />
                      </div>

                      {/* Collateral Seized */}
                      <div className="col-span-3">
                        <p className="text-xs font-semibold text-red-600">
                          {formatUSD(liq.collateralSeizedUSD)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {liq.collateralAssetSymbol}
                        </p>
                      </div>

                      {/* Debt Repaid */}
                      <div className="col-span-3">
                        <p className="text-xs font-semibold text-[#303549]">
                          {formatUSD(liq.debtRepaidUSD)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {liq.debtAssetSymbol}
                        </p>
                      </div>

                      {/* Tx Link */}
                      <div className="col-span-2 flex justify-end">
                        <a
                          href={`${networkMeta?.explorerUrl ?? "https://etherscan.io"}/tx/${liq.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-[#5382E3] hover:text-[#4270D0] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Explorer
                        </a>
                      </div>
                    </div>

                    {/* Mobile card layout */}
                    <div className="md:hidden px-3 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(liq.timestamp)}</span>
                          <Link
                            href={`/radar/${networkSlug}/${liq.walletAddress}`}
                            className="text-xs font-mono text-[#303549] hover:text-[#5382E3] transition-colors truncate"
                          >
                            {truncAddr(liq.walletAddress)}
                          </Link>
                        </div>
                        <a
                          href={`${networkMeta?.explorerUrl ?? "https://etherscan.io"}/tx/${liq.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[#5382E3] shrink-0 ml-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Tx
                        </a>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <p className="text-gray-400">Collateral Seized</p>
                          <p className="font-semibold text-red-600">{formatUSD(liq.collateralSeizedUSD)} <span className="font-normal text-gray-400">{liq.collateralAssetSymbol}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400">Debt Repaid</p>
                          <p className="font-semibold text-[#303549]">{formatUSD(liq.debtRepaidUSD)} <span className="font-normal text-gray-400">{liq.debtAssetSymbol}</span></p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer info */}
      <div className="mt-4 px-1 pb-4">
        <p className="text-[10px] sm:text-[11px] text-gray-400 leading-relaxed">
          Data sourced from the Aave V3 {networkMeta?.name ?? "Ethereum"} subgraph. Positions with debt &gt; $100K are tracked.
          Updated every 5 minutes. Click any wallet to view their position details.
        </p>
      </div>
    </div>
  );
}
