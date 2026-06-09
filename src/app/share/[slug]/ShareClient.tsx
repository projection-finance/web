"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import ProjectionChart from "@/src/components/simulation/ProjectionChart";
import { formatUSD } from "@/src/lib/format";
import {
  TemporalSimulationConfig,
  TemporalSimulationResult,
  EngineState,
} from "@/src/lib/simulation/types";
import { AavePositionData } from "@/src/lib/aave/types";
import { TokenSimulationConfig, TokenSimulationResult } from "@/src/lib/tokens/types";
import BigNumber from "bignumber.js";
import { Copy, Check, ExternalLink, Sparkles, ChevronDown, ChevronUp, Eye, EyeOff, BarChart2, X } from "lucide-react";
import Link from "next/link";
import type { AISummaryData } from "@/src/lib/ai/types";
import TokenProjectionChart from "@/src/components/tokens/TokenProjectionChart";
import { getNetworkById } from "@/src/lib/aave/networks";
import Image from "next/image";
import TokenIcon from "@/src/components/ui/TokenIcon";

interface SharedData {
  type?: string; // "aave" | "sandbox"
  name: string;
  details: string | null;
  address: string;
  network?: string;
  config: TemporalSimulationConfig | TokenSimulationConfig;
  aiSummary?: AISummaryData | null;
  createdAt: string;
}


export default function ShareClient({ slug }: { slug: string }) {
  const [shared, setShared] = useState<SharedData | null>(null);
  const [position, setPosition] = useState<AavePositionData | null>(null);
  const [result, setResult] = useState<TemporalSimulationResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Map<string, TemporalSimulationResult>>(new Map());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeScenarioSetId, setActiveScenarioSetId] = useState<string | undefined>(undefined);
  const [sandboxResult, setSandboxResult] = useState<TokenSimulationResult | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Timeline bar state
  const [timelineHidden, setTimelineHidden] = useState(false);
  const [timelineOpaque, setTimelineOpaque] = useState(false);
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);

  const isSandbox = shared?.type === "sandbox";
  const hasSummary = !!shared?.aiSummary;

  // Auto-open summary sheet if summary exists but no simulation yet
  useEffect(() => {
    if (hasSummary && !result && !sandboxResult) setSummarySheetOpen(true);
  }, [hasSummary, result, sandboxResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1. Fetch shared projection data
  useEffect(() => {
    fetch(`/api/share/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Projection not found");
        return res.json();
      })
      .then((data: SharedData) => {
        setShared(data);
        if (data.type !== "sandbox") {
          setActiveScenarioSetId(
            (data.config as TemporalSimulationConfig).activeScenarioSetId
          );
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  // 2a. Sandbox: run token simulation directly
  useEffect(() => {
    if (!shared || shared.type !== "sandbox") return;
    const sandboxConfig = shared.config as TokenSimulationConfig;

    fetch("/api/tokens/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: sandboxConfig }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Simulation failed");
        return res.json();
      })
      .then((data) => {
        setSandboxResult(data.result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [shared]);

  // 2b. Fetch live Aave position
  useEffect(() => {
    if (!shared || shared.type === "sandbox") return;
    fetch(`/api/aave/position?address=${encodeURIComponent(shared.address)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load position");
        return res.json();
      })
      .then((data: AavePositionData) => setPosition(data))
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [shared]);

  // 3. Run Aave simulation
  useEffect(() => {
    if (!shared || !position) return;

    const marketReferenceCurrencyPriceInUSD = new BigNumber(
      position.baseCurrencyData.marketReferenceCurrencyPriceInUsd
    ).shiftedBy(-8).toNumber();

    const initialState: EngineState = {
      rawUserReserves: JSON.parse(JSON.stringify(position.rawUserReserves)),
      formattedPoolReserves: JSON.parse(JSON.stringify(position.formattedPoolReserves)),
      baseCurrencyData: JSON.parse(JSON.stringify(position.baseCurrencyData)),
      userEmodeCategoryId: position.userEmodeCategoryId,
      marketReferenceCurrencyPriceInUSD,
      healthFactorData: position.workingData,
      merklIncentives: position.merklIncentives,
    };

    const aaveConfig = shared.config as TemporalSimulationConfig;
    const scenarioConfigs = aaveConfig.scenarioSets?.length
      ? aaveConfig.scenarioSets.map((s) => ({
          id: s.id,
          priceScenarios: s.priceScenarios,
          rateScenarios: s.rateScenarios,
        }))
      : undefined;

    fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: aaveConfig, initialState, scenarioConfigs }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Simulation failed");
        return res.json();
      })
      .then((data) => {
        setResult(data.result);
        if (data.scenarioResults) {
          const map = new Map<string, TemporalSimulationResult>();
          for (const [id, sr] of data.scenarioResults) {
            map.set(id, sr as TemporalSimulationResult);
          }
          setScenarioResults(map);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [shared, position]);

  const aaveSharedConfig = (!isSandbox && shared)
    ? shared.config as TemporalSimulationConfig
    : null;

  const activeScenarioResult = useMemo(() => {
    if (!aaveSharedConfig) return result;
    const activeId = activeScenarioSetId ?? aaveSharedConfig.scenarioSets?.[0]?.id;
    if (activeId && scenarioResults.size > 0) {
      return scenarioResults.get(activeId) ?? result;
    }
    return result;
  }, [scenarioResults, activeScenarioSetId, aaveSharedConfig, result]);

  const activePriceScenarios = useMemo(() => {
    if (!aaveSharedConfig) return [];
    const activeId = activeScenarioSetId ?? aaveSharedConfig.scenarioSets?.[0]?.id;
    if (activeId && aaveSharedConfig.scenarioSets?.length) {
      const set = aaveSharedConfig.scenarioSets.find((s) => s.id === activeId);
      if (set) return set.priceScenarios;
    }
    return aaveSharedConfig.priceScenarios;
  }, [aaveSharedConfig, activeScenarioSetId]);

  const activeRateScenarios = useMemo(() => {
    if (!aaveSharedConfig) return [];
    const activeId = activeScenarioSetId ?? aaveSharedConfig.scenarioSets?.[0]?.id;
    if (activeId && aaveSharedConfig.scenarioSets?.length) {
      const set = aaveSharedConfig.scenarioSets.find((s) => s.id === activeId);
      if (set) return set.rateScenarios;
    }
    return aaveSharedConfig.rateScenarios;
  }, [aaveSharedConfig, activeScenarioSetId]);

  const timelineActions = useMemo(() => {
    if (!aaveSharedConfig) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scheduled = aaveSharedConfig.scheduledActions.map((a: any) => ({
      day: a.day,
      label: a.type === "set_emode"
        ? (a.emodeCategoryId === 0 ? "Disable E-Mode" : `E-Mode ${a.symbol}`)
        : `${a.type.charAt(0).toUpperCase() + a.type.slice(1)} ${a.amount} ${a.symbol}`,
      type: a.type,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priceActions = activePriceScenarios.map((s: any) => ({
      day: s.fromDay ?? 0,
      label: `${s.symbol} price → $${formatUSD(s.startPrice)}`,
      type: "price_change",
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rateActions = activeRateScenarios.map((s: any) => ({
      day: s.fromDay ?? 0,
      label: `${s.symbol} ${s.rateType} APY → ${(s.startRate * 100).toFixed(1)}%`,
      type: "rate_change",
    }));
    return [...scheduled, ...priceActions, ...rateActions];
  }, [aaveSharedConfig, activePriceScenarios, activeRateScenarios]);

  const truncatedAddress = shared
    ? `${shared.address.slice(0, 6)}...${shared.address.slice(-4)}`
    : "";

  const handleCopyAddress = useCallback(() => {
    if (!shared) return;
    navigator.clipboard.writeText(shared.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shared]);

  const formattedDate = shared
    ? new Date(shared.createdAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";

  // Bottom bar: header ~36px + chart 120px + padding ~12px = ~168px
  const bottomPad = timelineHidden ? "pb-4" : "pb-[180px]";

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <img src="/favicon.svg" alt="logo" width={32} height={32} className="opacity-40" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#303549] mb-2">Projection not found</h1>
          <p className="text-sm text-gray-400 max-w-xs">
            This shared link may have expired or been removed.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5382E3] text-white rounded-lg hover:bg-[#4371D0] transition-colors text-sm font-medium"
        >
          Try projection.finance
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4">
        <img src="/favicon.svg" alt="logo" width={40} height={40} className="animate-pulse" />
        <p className="text-sm text-gray-400">Loading shared projection...</p>
      </div>
    );
  }

  // ── AI Summary bottom sheet ──
  const SummarySheet = hasSummary && shared?.aiSummary ? (
    <>
      {/* Backdrop */}
      {summarySheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={() => setSummarySheetOpen(false)}
        />
      )}

      {/* Sheet */}
      <div
        className={`fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          summarySheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ bottom: 0, maxHeight: "80vh" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#5382E3]/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-[#5382E3]" />
            </div>
            <span className="text-sm font-semibold text-[#303549]">AI Summary</span>
            {shared.aiSummary.language && shared.aiSummary.language !== "en" && (
              <span className="text-[10px] text-gray-400 uppercase">{shared.aiSummary.language}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {shared.aiSummary.generatedAt && (
              <span className="text-[10px] text-gray-400 hidden sm:inline">
                {new Date(shared.aiSummary.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
            <button
              onClick={() => setSummarySheetOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(80vh - 90px)" }}>
          <div
            className="prose prose-sm max-w-none text-sm text-[#303549] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(shared.aiSummary.content) }}
          />
        </div>
      </div>
    </>
  ) : null;

  // ── Shared bottom bar (Timeline only) ──
  const BottomBar = (
    <>
      {SummarySheet}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 transition-opacity duration-200 ${
          timelineOpaque ? "opacity-40 hover:opacity-100" : "opacity-100"
        } bg-[#F5F5FA]`}
      >
        {/* Bar header */}
        <div className="px-3 sm:px-6 pt-1.5 pb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {/* Timeline tab */}
            <button
              onClick={() => setTimelineHidden(false)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                !timelineHidden ? "bg-[#303549] text-white" : "text-gray-500 hover:bg-gray-200"
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              Timeline
            </button>

            {/* AI Summary button — opens sheet */}
            {hasSummary && (
              <button
                onClick={() => setSummarySheetOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-[#5382E3]" />
                <span className="text-[#5382E3]">AI Summary</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!timelineHidden && (
              <button
                onClick={() => setTimelineOpaque((o) => !o)}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors"
                title={timelineOpaque ? "Make opaque" : "Make transparent"}
              >
                {timelineOpaque ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => setTimelineHidden((h) => !h)}
              className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors"
              title={timelineHidden ? "Show timeline" : "Hide timeline"}
            >
              {timelineHidden
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <Link
              href={isSandbox ? "/tokens" : "/"}
              className="hidden sm:inline text-[10px] text-[#5382E3] hover:underline whitespace-nowrap"
            >
              {isSandbox ? "Try Portfolio Sandbox" : "Try on your positions"}
            </Link>
          </div>
        </div>

        {/* Chart content */}
        {!timelineHidden && (
          <div className="px-3 sm:px-6 pb-2">
            {!isSandbox && result && activeScenarioResult && (
              <ProjectionChart
                result={activeScenarioResult}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                timelineActions={timelineActions}
                priceScenarios={activePriceScenarios}
                rateScenarios={activeRateScenarios}
                scheduledActionsCount={aaveSharedConfig?.scheduledActions?.length ?? 0}
                scenarioResults={scenarioResults}
                scenarioSets={aaveSharedConfig?.scenarioSets}
                activeScenarioSetId={activeScenarioSetId ?? aaveSharedConfig?.scenarioSets?.[0]?.id}
                onSetActiveScenario={setActiveScenarioSetId}
                chartHeight={120}
              />
            )}
            {isSandbox && sandboxResult && (
              <TokenProjectionChart
                result={sandboxResult}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                priceScenarios={(shared!.config as TokenSimulationConfig).priceScenarios}
                actions={(shared!.config as TokenSimulationConfig).actions}
                chartHeight={120}
              />
            )}
          </div>
        )}
      </div>
    </>
  );

  // ── Sandbox view ──
  if (isSandbox && sandboxResult) {
    const sandboxConfig = shared!.config as TokenSimulationConfig;
    const sandboxSnap = sandboxResult.timeline[selectedDay ?? 0] ?? sandboxResult.timeline[0];
    const importSrc = sandboxConfig.importSource;
    const importNet = importSrc ? getNetworkById(importSrc.network) : null;

    return (
      <div className={`flex-1 ${bottomPad}`}>
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="text-lg font-bold text-[#303549]">{shared!.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {importSrc && importNet && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#5382E3]/10 rounded-md">
                  <Image src={importNet.logo} alt={importNet.name} width={12} height={12} />
                  <span className="text-[10px] text-[#5382E3] font-medium">{importNet.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {importSrc.ensName || `${importSrc.address.slice(0, 6)}...${importSrc.address.slice(-4)}`}
                  </span>
                </div>
              )}
              {shared!.details && <span className="text-xs text-gray-400">{shared!.details}</span>}
            </div>
          </div>
          <span className="text-gray-400 text-xs">Shared {formattedDate}</span>
        </div>

        {/* Summary metrics — 2×2 on mobile, 4-col on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { label: "Start Value", value: `$${formatUSD(sandboxResult.summary.startValueUSD)}` },
            { label: "End Value", value: `$${formatUSD(sandboxResult.summary.endValueUSD)}` },
            {
              label: "Change",
              value: `${sandboxResult.summary.changePercent >= 0 ? "+" : ""}${(sandboxResult.summary.changePercent * 100).toFixed(2)}%`,
              color: sandboxResult.summary.changePercent >= 0 ? "text-green-600" : "text-red-500",
            },
            {
              label: "P&L",
              value: `${sandboxResult.summary.changeUSD >= 0 ? "+" : ""}$${formatUSD(Math.abs(sandboxResult.summary.changeUSD))}`,
              color: sandboxResult.summary.changeUSD >= 0 ? "text-green-600" : "text-red-500",
            },
          ].map((item) => (
            <div key={item.label} className="bg-[#F5F5FA] rounded-lg px-3 py-2">
              <p className={`text-sm font-semibold ${item.color ?? "text-[#303549]"}`}>{item.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Holdings at selected day */}
        {sandboxSnap && (
          <div className="bg-[#F5F5FA] rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-[#303549] mb-2">
              Holdings
              {selectedDay !== null && selectedDay > 0 && (
                <span className="text-[10px] text-gray-400 font-normal ml-1.5">Day {selectedDay}</span>
              )}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
              {sandboxSnap.holdings
                .filter((h) => h.quantity > 0 || h.supplied > 0)
                .map((h) => (
                  <div key={h.coingeckoId} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {h.image ? (
                        <img src={h.image} alt={h.symbol} className="w-4 h-4 rounded-full" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[7px] font-bold">
                          {h.symbol.slice(0, 2)}
                        </div>
                      )}
                      <span className="text-gray-600">{h.symbol}</span>
                    </div>
                    <span className="text-[#303549] font-medium">${formatUSD(h.valueUSD)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {BottomBar}
      </div>
    );
  }

  // ── Aave view ──
  const displaySnap = result?.timeline[selectedDay ?? 0] ?? result?.timeline[0];

  return (
    <div className={`flex-1 ${bottomPad}`}>
      {/* Header bar */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-[#303549]">{shared!.name}</h1>
          {shared!.details && (
            <span className="text-xs text-gray-400">{shared!.details}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyAddress}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-[#303549] font-mono text-xs"
            title="Copy wallet address"
          >
            {truncatedAddress}
            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
          </button>
          <span className="text-gray-400 text-xs hidden sm:inline">Shared {formattedDate}</span>
        </div>
      </div>

      {displaySnap && <AaveBoard snap={displaySnap} />}

      {BottomBar}
    </div>
  );
}

// ── Aave position board (read-only) ──
function AaveBoard({ snap }: { snap: NonNullable<ReturnType<TemporalSimulationResult["timeline"]["at"]>> }) {
  const hf = snap.healthFactor;
  // Aave V3: HF < 0.95 = 100% close factor (full liquidation), HF < 1 = 50% close factor
  const isLiquidated = isFinite(hf) && hf < 0.95;
  const isAtRisk = isFinite(hf) && hf < 1;
  const isNegativeWorth = snap.netWorthUSD < 0;
  const netWorth = snap.netWorthUSD;
  const supplyIncome = snap.supplies.reduce((s, r) => s + r.balanceUSD * r.supplyAPY, 0);
  const borrowCost = snap.borrows.reduce((s, r) => s + r.debtUSD * r.borrowAPY, 0);
  const netAPY = netWorth > 0 ? (supplyIncome - borrowCost) / netWorth : 0;
  const maxBorrow = snap.totalBorrowsUSD + snap.availableBorrowsUSD;
  const borrowPowerUsed = maxBorrow > 0 ? snap.totalBorrowsUSD / maxBorrow : 0;

  const hfColor = !isFinite(hf) || hf > 1e10
    ? "text-green-600"
    : hf < 0.95 ? "text-red-600"
    : hf < 1 ? "text-red-500"
    : hf < 1.1 ? "text-orange-500"
    : "text-green-600";

  const metrics = [
    { label: "Net worth", value: `${isNegativeWorth ? "-" : ""}$${formatUSD(Math.abs(netWorth))}`, className: isNegativeWorth ? "text-red-500" : "text-[#303549]" },
    { label: "Net APY", value: `${netAPY >= 0 ? "+" : ""}${(netAPY * 100).toFixed(2)}%`, className: "text-[#303549]" },
    { label: "Collateral", value: `$${formatUSD(snap.totalCollateralUSD)}`, className: "text-[#303549]" },
    { label: "Borrow", value: `$${formatUSD(snap.totalBorrowsUSD)}`, className: "text-[#303549]" },
    { label: "Available", value: `$${formatUSD(snap.availableBorrowsUSD)}`, className: "text-[#303549]" },
    { label: "HF", value: !isFinite(hf) || hf > 1e10 ? "∞" : hf.toFixed(2), className: hfColor },
    { label: "LTV", value: `${(snap.currentLTV * 100).toFixed(1)}%`, className: "text-[#303549]" },
  ];

  const activeSupplies = snap.supplies.filter((s) => s.balance > 0);
  const activeBorrows = snap.borrows.filter((b) => b.debt > 0);

  return (
    <>
      {/* Summary metrics — scrollable on mobile, row on desktop */}
      <div className={`mb-4 rounded-lg ${isAtRisk ? "bg-red-50 border border-red-200" : "bg-[#F5F5FA]"}`}>
        {/* Mobile: 2-col grid */}
        <div className="sm:hidden grid grid-cols-2 gap-0 px-3 py-2">
          {metrics.map((item) => (
            <div key={item.label} className="py-1.5">
              <p className={`text-sm font-semibold leading-tight ${item.className}`}>{item.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
        {/* Desktop: single compact row with separators */}
        <div className="hidden sm:flex items-center gap-0 px-4 py-2.5 overflow-x-auto">
          {metrics.map((item, i, arr) => (
            <div key={item.label} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className={`text-sm font-semibold leading-tight ${item.className}`}>{item.value}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">{item.label}</span>
              </div>
              {i < arr.length - 1 && <div className="w-px h-6 bg-slate-200 mx-2 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {isAtRisk && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <span className="text-red-600 text-xs font-bold">!</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700">
              Liquidation zone {isLiquidated ? "— 100% close factor" : "— 50% close factor"}{isNegativeWorth ? " — Negative net worth" : ""}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {isLiquidated
                ? "HF < 0.95 — position can be fully liquidated in a single call."
                : "HF < 1 — up to 50% of debt can be liquidated per call."}
            </p>
          </div>
        </div>
      )}

      {/* Supplies & Borrows — stacked on mobile, 2-col on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Your Supplies */}
        <div className="bg-[#F5F5FA] rounded-xl border border-slate-100">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#303549]">Your supplies</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#5382E31F] text-[#5382E3] text-[11px] font-medium">
              ${formatUSD(snap.supplies.reduce((s, r) => s + r.balanceUSD, 0))}
            </span>
          </div>
          {activeSupplies.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-t border-slate-100">
                    <th className="text-left px-4 py-1.5 text-[#62677B] font-medium">Asset</th>
                    <th className="text-left px-4 py-1.5 text-[#62677B] font-medium">Balance</th>
                    <th className="text-left px-4 py-1.5 text-[#62677B] font-medium">APY</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSupplies.map((s) => (
                    <tr key={s.symbol} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={s.symbol} size={24} />
                          <span className="font-medium text-[#303549]">{s.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-medium text-[#303549]">
                          {s.balance < 0.01 ? s.balance.toFixed(6) : s.balance.toFixed(4)}
                        </p>
                        <p className="text-gray-400">${formatUSD(s.balanceUSD)}</p>
                      </td>
                      <td className="px-4 py-2 text-emerald-600 font-medium">
                        {((s.supplyAPY + (s.incentiveAPR || 0)) * 100).toFixed(2)}%
                        {s.incentiveAPR > 0 && (
                          <span className="block text-[10px] text-[#5382E3]">
                            +{(s.incentiveAPR * 100).toFixed(2)}% rewards
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 px-4 pb-3">No supplies</p>
          )}
        </div>

        {/* Your Borrows */}
        <div className="bg-[#F5F5FA] rounded-xl border border-slate-100">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-wrap gap-1">
            <h3 className="text-sm font-semibold text-[#303549]">Your borrows</h3>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#5382E31F] text-[#5382E3] text-[11px] font-medium">
                ${formatUSD(snap.totalBorrowsUSD)}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-medium">
                {(borrowPowerUsed * 100).toFixed(1)}% used
              </span>
            </div>
          </div>
          {activeBorrows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-t border-slate-100">
                    <th className="text-left px-4 py-1.5 text-[#62677B] font-medium">Asset</th>
                    <th className="text-left px-4 py-1.5 text-[#62677B] font-medium">Debt</th>
                    <th className="text-left px-4 py-1.5 text-[#62677B] font-medium">APY</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBorrows.map((b) => (
                    <tr key={b.symbol} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={b.symbol} size={24} />
                          <span className="font-medium text-[#303549]">{b.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-medium text-[#303549]">
                          {b.debt < 0.01 ? b.debt.toFixed(6) : b.debt.toFixed(4)}
                        </p>
                        <p className="text-gray-400">${formatUSD(b.debtUSD)}</p>
                      </td>
                      <td className="px-4 py-2 text-orange-500 font-medium">
                        {((b.borrowAPY - (b.incentiveAPR || 0)) * 100).toFixed(2)}%
                        {b.incentiveAPR > 0 && (
                          <span className="block text-[10px] text-[#5382E3]">
                            -{(b.incentiveAPR * 100).toFixed(2)}% rewards
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 px-4 pb-3">No borrows</p>
          )}
        </div>
      </div>
    </>
  );
}

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold mt-4 mb-1.5">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-base font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br class="my-1.5" />')
    .replace(/\n/g, "<br />");
}
