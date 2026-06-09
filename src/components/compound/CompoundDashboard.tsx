"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderOpen, Save, Share2, SlidersHorizontal, CalendarPlus, X, Plus, Search } from "lucide-react";
import type { CompoundPositionData, CompoundMarketPosition } from "@/src/lib/compound/types";
import { ALL_COMPOUND_MARKETS, type CompoundMarket } from "@/src/lib/compound/config";
import { useCompoundSimulation } from "@/src/hooks/useCompoundSimulation";
import { useProjections } from "@/src/hooks/useProjections";
import ProjectionChart from "@/src/components/simulation/ProjectionChart";
import ProjectionTimelineWrapper from "@/src/components/simulation/ProjectionTimelineWrapper";
import { adaptCompoundResult } from "@/src/lib/simulation/chart-adapter";
import CompoundActionScheduler from "./CompoundActionScheduler";
import CompoundPriceRatesModal from "./CompoundPriceRatesModal";
import SaveProjectionModal from "@/src/components/simulation/SaveProjectionModal";
import LoadProjectionModal from "@/src/components/simulation/LoadProjectionModal";
import AISummaryModal from "@/src/components/simulation/AISummaryModal";
import type { CompoundSimulationConfig } from "@/src/lib/simulation/compound-types";
import type { AISummaryData, AISummaryRequest, AIModel } from "@/src/lib/ai/types";

function formatUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

function formatHF(hf: number | null | undefined): string {
  if (hf == null || hf === Infinity || hf > 99) return "—";
  return hf.toFixed(2);
}

function hfColor(hf: number | null | undefined): string {
  if (hf == null || hf === Infinity || hf > 99) return "text-gray-400";
  if (hf >= 2) return "text-emerald-600";
  if (hf >= 1.5) return "text-yellow-600";
  if (hf >= 1.1) return "text-orange-500";
  return "text-red-500";
}

const CHAIN_LABELS: Record<number, string> = { 1: "Ethereum", 8453: "Base", 42161: "Arbitrum", 10: "Optimism", 137: "Polygon" };
const DURATION_PRESETS = [7, 30, 90, 180, 365];

interface CompoundDashboardProps {
  position: CompoundPositionData;
  ensName?: string;
  projectionId?: string;
  sessionId?: string;
  isSandbox?: boolean;
  onChangeWallet?: (address: string, ens?: string) => void;
  onClear?: () => void;
  onPositionChange?: (position: CompoundPositionData) => void;
}

export default function CompoundDashboard({
  position,
  ensName,
  projectionId,
  isSandbox = false,
  onChangeWallet,
  onClear,
  onPositionChange,
}: CompoundDashboardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const sim = useCompoundSimulation(position);
  const {
    projections, isLoading: projectionsLoading,
    list: listProjections, save: saveProjection,
    load: loadProjection, update: updateProjection,
    duplicate: duplicateProjection, remove: removeProjection,
  } = useProjections();


  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentProjectionId, setCurrentProjectionId] = useState<string | null>(projectionId ?? null);
  const [currentProjectionName, setCurrentProjectionName] = useState<string | null>(null);
  const [currentProjectionDetails, setCurrentProjectionDetails] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [priceRatesModalOpen, setPriceRatesModalOpen] = useState(false);
  const [aiSummaryModalOpen, setAiSummaryModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummaryData | null>(null);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [marketSearchOpen, setMarketSearchOpen] = useState(false);
  const [marketSearchQuery, setMarketSearchQuery] = useState("");
  const [addMarketAmount, setAddMarketAmount] = useState("1000");
  const lastSavedConfigRef = useRef<string>("");
  const [unsavedChanges, setUnsavedChanges] = useState(0);

  const configFingerprint = useMemo(
    () => JSON.stringify({ d: sim.config.durationDays, p: sim.config.priceScenarios, r: sim.config.rateScenarios, a: sim.config.scheduledActions }),
    [sim.config],
  );

  useEffect(() => {
    if (!lastSavedConfigRef.current) { lastSavedConfigRef.current = configFingerprint; return; }
    if (configFingerprint !== lastSavedConfigRef.current) setUnsavedChanges((c) => c + 1);
  }, [configFingerprint]);

  useEffect(() => { if (session?.user) listProjections("compound"); }, [session?.user, listProjections]);

  // Lowest HF across all markets
  const lowestHF = useMemo(() => {
    const hfs = position.markets.filter((m) => m.baseBorrowBalance > 0).map((m) => m.healthFactor);
    return hfs.length > 0 ? Math.min(...hfs) : Infinity;
  }, [position]);

  const selectedSnapshot = useMemo(() => {
    if (sim.selectedDay === null || !sim.result) return null;
    return sim.result.timeline[sim.selectedDay] ?? null;
  }, [sim.selectedDay, sim.result]);

  const shortAddr = position.address ? `${position.address.slice(0, 6)}...${position.address.slice(-4)}` : null;

  // ── Handlers ──

  const generateDefaultName = useCallback(() => {
    const walletLabel = ensName || (position.address ? shortAddr : "Sandbox");
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${walletLabel} — Compound · ${date} · ${sim.config.durationDays}d`;
  }, [position.address, ensName, shortAddr, sim.config.durationDays]);

  const handleSave = useCallback(async (name: string, details: string) => {
    setIsSaving(true);
    try {
      if (currentProjectionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateProjection(currentProjectionId, { name, details, config: sim.config as any });
        setCurrentProjectionName(name);
        setCurrentProjectionDetails(details);
      } else {
        const created = await saveProjection(name, sim.config, { address: position.address || undefined, type: "compound", details });
        setCurrentProjectionId(created.id);
        setCurrentProjectionName(name);
        setCurrentProjectionDetails(details);
        const params = new URLSearchParams(window.location.search);
        params.set("projection", created.id);
        router.replace(`/compound?${params.toString()}`);
      }
      lastSavedConfigRef.current = configFingerprint;
      setUnsavedChanges(0);
      setSaveModalOpen(false);
    } catch { /* silent */ }
    finally { setIsSaving(false); }
  }, [currentProjectionId, sim.config, position.address, saveProjection, updateProjection, router, configFingerprint]);

  const handleShare = useCallback(async () => {
    if (!session?.user) return;
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: position.address || undefined, name: currentProjectionName || generateDefaultName(), details: currentProjectionDetails || undefined, config: sim.config, type: "compound" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      await navigator.clipboard.writeText(data.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch { /* silent */ }
    finally { setShareLoading(false); }
  }, [session?.user, position.address, currentProjectionName, currentProjectionDetails, sim.config, generateDefaultName]);

  const handleLoadProjection = useCallback(async (p: { id: string }) => {
    try {
      const full = await loadProjection(p.id);
      if (full.config) {
        setCurrentProjectionId(full.id);
        setCurrentProjectionName(full.name);
        setCurrentProjectionDetails(full.details);
        setAiSummary(full.aiSummary ?? null);
        sim.loadConfigAndRun(full.config as unknown as CompoundSimulationConfig);
        setUnsavedChanges(0);
      }
      setLoadModalOpen(false);
    } catch { /* silent */ }
  }, [loadProjection, sim]);

  const buildSummaryRequest = useCallback((language: string, model?: AIModel): AISummaryRequest => {
    const r = sim.result;
    return {
      type: "morpho" as const, // Reuse morpho type for AI since structure is similar
      language,
      model,
      address: position.address || undefined,
      ensName: ensName || undefined,
      durationDays: sim.config.durationDays,
      morphoSummary: r?.summary ? {
        startNetWorth: r.summary.startNetWorth,
        endNetWorth: r.summary.endNetWorth,
        totalInterestEarned: r.summary.totalInterestEarned,
        avgApy: 0,
      } : undefined,
      priceChanges: sim.config.priceScenarios.map((p) => ({ symbol: p.symbol, mode: p.mode, startPrice: p.startPrice, endPrice: p.endPrice })),
    };
  }, [sim.result, sim.config, position, ensName]);

  const handleSaveAISummary = useCallback(async (summary: AISummaryData) => {
    setAiSummary(summary);
    if (currentProjectionId) {
      try { await updateProjection(currentProjectionId, { aiSummary: summary }); } catch { /* silent */ }
    }
  }, [currentProjectionId, updateProjection]);

  // ── Market management (sandbox) ──

  const filteredMarkets = useMemo(() => {
    if (!marketSearchQuery) return ALL_COMPOUND_MARKETS;
    const q = marketSearchQuery.toLowerCase();
    return ALL_COMPOUND_MARKETS.filter(
      (m) => m.baseSymbol.toLowerCase().includes(q) || m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [marketSearchQuery]);

  const handleAddMarket = useCallback((market: CompoundMarket) => {
    if (!onPositionChange) return;
    const exists = position.markets.some((m) => m.marketId === market.id);
    if (exists) return;
    const amt = parseFloat(addMarketAmount);
    const depositUSD = isNaN(amt) || amt <= 0 ? 1000 : amt;
    const newMarket: CompoundMarketPosition = {
      marketId: market.id,
      cometProxy: market.cometProxy,
      chainId: market.chainId,
      chainName: CHAIN_LABELS[market.chainId] || `Chain ${market.chainId}`,
      baseSymbol: market.baseSymbol,
      baseDecimals: market.baseDecimals,
      baseTokenAddress: "",
      basePriceUSD: 1,
      baseSupplyBalance: depositUSD,
      baseSupplyBalanceUSD: depositUSD,
      baseBorrowBalance: 0,
      baseBorrowBalanceUSD: 0,
      supplyAPY: 0.03,
      borrowAPY: 0.05,
      collaterals: [],
      collateralAssets: [],
      totalCollateralUSD: 0,
      borrowCapacityUSD: 0,
      liquidationRiskUSD: 0,
      healthFactor: Infinity,
    };
    const newMarkets = [...position.markets, newMarket];
    onPositionChange({
      ...position,
      markets: newMarkets,
      totalSupplyUSD: newMarkets.reduce((s, m) => s + m.baseSupplyBalanceUSD, 0),
      totalBorrowUSD: newMarkets.reduce((s, m) => s + m.baseBorrowBalanceUSD, 0),
      totalCollateralUSD: newMarkets.reduce((s, m) => s + m.totalCollateralUSD, 0),
      netWorthUSD: newMarkets.reduce((s, m) => s + m.baseSupplyBalanceUSD + m.totalCollateralUSD - m.baseBorrowBalanceUSD, 0),
    });
    setMarketSearchOpen(false);
    setMarketSearchQuery("");
  }, [position, onPositionChange, addMarketAmount]);

  const handleRemoveMarket = useCallback((marketId: string) => {
    if (!onPositionChange) return;
    const newMarkets = position.markets.filter((m) => m.marketId !== marketId);
    onPositionChange({
      ...position,
      markets: newMarkets,
      totalSupplyUSD: newMarkets.reduce((s, m) => s + m.baseSupplyBalanceUSD, 0),
      totalBorrowUSD: newMarkets.reduce((s, m) => s + m.baseBorrowBalanceUSD, 0),
      totalCollateralUSD: newMarkets.reduce((s, m) => s + m.totalCollateralUSD, 0),
      netWorthUSD: newMarkets.reduce((s, m) => s + m.baseSupplyBalanceUSD + m.totalCollateralUSD - m.baseBorrowBalanceUSD, 0),
    });
  }, [position, onPositionChange]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pb-[60px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClear} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#303549] hover:border-gray-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#303549]">
                {isSandbox ? "Compound Sandbox" : "Compound V3"}
              </h1>
              {isSandbox && (
                <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-[#00D395]/10 text-[#00D395]">SANDBOX</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {ensName && <span className="text-xs font-medium text-[#303549]">{ensName}</span>}
              {shortAddr && <span className="text-xs text-gray-400 font-mono">{shortAddr}</span>}
              {isSandbox && !shortAddr && <span className="text-xs text-gray-400">Custom portfolio</span>}
              {currentProjectionName && <span className="text-[10px] text-[#00D395] font-medium">— {currentProjectionName}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onChangeWallet && !isSandbox && (
            <button onClick={() => onChangeWallet(position.address, ensName)} className="text-xs text-gray-400 hover:text-[#303549] transition-colors">Switch wallet</button>
          )}
          {session?.user && (
            <button onClick={() => setSaveModalOpen(true)} className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#303549] text-white hover:bg-[#1e2333] transition-colors">
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "..." : currentProjectionId ? "Save" : "Save as"}
              {unsavedChanges > 0 && currentProjectionId && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#00D395] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{unsavedChanges > 9 ? "9+" : unsavedChanges}</span>
              )}
            </button>
          )}
          {sim.result && session?.user && (
            <button onClick={handleShare} disabled={shareLoading} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-gray-200 text-[#303549] hover:bg-gray-50 transition-colors">
              <Share2 className="w-3.5 h-3.5" />
              {shareLoading ? "..." : shareCopied ? "Copied!" : "Share"}
            </button>
          )}
          {session?.user && (
            <button onClick={() => setLoadModalOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border border-gray-200 text-[#303549] hover:bg-gray-50 transition-colors" title="Load projection">
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Supply</p>
          <p className="text-lg font-bold text-[#303549] mt-0.5">${formatUSD(position.totalSupplyUSD)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Borrow</p>
          <p className="text-lg font-bold text-[#303549] mt-0.5">${formatUSD(position.totalBorrowUSD)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Collateral</p>
          <p className="text-lg font-bold text-[#303549] mt-0.5">${formatUSD(position.totalCollateralUSD)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Net Worth</p>
          <p className="text-lg font-bold text-[#303549] mt-0.5">${formatUSD(position.netWorthUSD)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Health Factor</p>
          <p className={`text-lg font-bold mt-0.5 ${hfColor(lowestHF)}`}>{formatHF(lowestHF)}</p>
        </div>
      </div>

      {/* Markets table */}
      <div className="bg-white rounded-xl border border-gray-200 mb-5 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#303549]">Markets</h2>
          {isSandbox && onPositionChange && (
            <button
              onClick={() => setMarketSearchOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-[#00D395] hover:text-[#00B37E] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Market
            </button>
          )}
        </div>

        {position.markets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <svg width={36} height={36} viewBox="0 0 20 20" fill="none" className="opacity-30">
              <circle cx="10" cy="10" r="10" fill="#00D395" />
              <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">C</text>
            </svg>
            <p className="text-sm text-gray-400">No markets yet</p>
            {isSandbox && onPositionChange && (
              <button
                onClick={() => setMarketSearchOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#00D395] text-white hover:bg-[#00B37E] transition-colors"
              >
                <Search className="w-3 h-3" />
                Browse Compound markets
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-semibold">Market</th>
                  <th className="text-left px-4 py-2 font-semibold">Chain</th>
                  <th className="text-right px-4 py-2 font-semibold">Supply</th>
                  <th className="text-right px-4 py-2 font-semibold">Borrow</th>
                  <th className="text-right px-4 py-2 font-semibold">Collateral</th>
                  <th className="text-right px-4 py-2 font-semibold">HF</th>
                  <th className="text-right px-4 py-2 font-semibold">APY</th>
                  {isSandbox && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {position.markets.map((m) => (
                  <tr key={m.marketId} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium text-[#303549]">{m.baseSymbol}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] text-gray-400">{m.chainName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs text-[#303549]">${formatUSD(m.baseSupplyBalanceUSD)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs text-[#303549]">${formatUSD(m.baseBorrowBalanceUSD)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs text-[#303549]">${formatUSD(m.totalCollateralUSD)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs font-medium ${hfColor(m.healthFactor)}`}>{formatHF(m.healthFactor)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {m.baseSupplyBalance > 0 && (
                        <span className="text-xs text-emerald-600">{((m.supplyAPY ?? 0) * 100).toFixed(2)}%</span>
                      )}
                      {m.baseBorrowBalance > 0 && (
                        <span className="text-xs text-red-500">-{((m.borrowAPY ?? 0) * 100).toFixed(2)}%</span>
                      )}
                    </td>
                    {isSandbox && onPositionChange && (
                      <td className="px-1 py-2.5">
                        <button
                          onClick={() => handleRemoveMarket(m.marketId)}
                          className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fixed bottom Projection Timeline */}
      {position.markets.length > 0 && (
        <ProjectionTimelineWrapper
          isRunning={sim.isRunning}
          hasResult={!!sim.result}
          selectedDay={sim.selectedDay}
          onSave={() => setSaveModalOpen(true)}
          isSaving={isSaving}
          saveLabel={currentProjectionId ? "Save" : "Save as"}
          unsavedChanges={unsavedChanges}
          onLoad={session?.user ? () => setLoadModalOpen(true) : undefined}
          onAISummary={() => setAiSummaryModalOpen(true)}
          hasAISummary={!!aiSummary}
          emptyMessage="No simulation data"
          extraToolbarButtons={
            <>
              <button onClick={() => setActionsExpanded((v) => !v)} className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${actionsExpanded ? "bg-[#00D395] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                <CalendarPlus className="w-3.5 h-3.5" />Actions
                {sim.config.scheduledActions.length > 0 && <span className={`text-[9px] rounded-full px-1 ${actionsExpanded ? "bg-white/20" : "bg-[#00D395] text-white"}`}>{sim.config.scheduledActions.length}</span>}
              </button>
              <button onClick={() => setPriceRatesModalOpen(true)} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <SlidersHorizontal className="w-3.5 h-3.5" />Scenarios
                {(sim.config.priceScenarios.length + sim.config.rateScenarios.length) > 0 && <span className="text-[9px] bg-[#00D395] text-white rounded-full px-1">{sim.config.priceScenarios.length + sim.config.rateScenarios.length}</span>}
              </button>
            </>
          }
        >
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mr-2">Duration</span>
              {DURATION_PRESETS.map((d) => (
                <button key={d} onClick={() => sim.updateDuration(d)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${sim.config.durationDays === d ? "bg-[#303549] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{d}d</button>
              ))}
            </div>
            {actionsExpanded && (
              <div className="mb-4 border border-gray-100 rounded-lg p-3">
                <CompoundActionScheduler markets={position.markets} actions={sim.config.scheduledActions} durationDays={sim.config.durationDays} onAddAction={sim.addScheduledAction} onRemoveAction={sim.removeScheduledAction} />
              </div>
            )}
            {sim.config.rateScenarios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mr-1 self-center">Rates</span>
                {sim.config.rateScenarios.map((rs) => (
                  <div key={`${rs.marketId}-${rs.rateType}`} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gray-50 border border-gray-200 text-[10px]">
                    <span className="text-gray-500">{rs.marketId.split("_").pop()} {rs.rateType}</span>
                    <span className="font-medium text-[#303549]">{rs.mode === "fixed" ? `${((rs.startRate ?? 0) * 100).toFixed(1)}%` : rs.mode}</span>
                    <button onClick={() => sim.removeRateScenario(rs.marketId, rs.rateType)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {sim.config.priceScenarios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mr-1 self-center">Prices</span>
                {sim.config.priceScenarios.map((ps) => (
                  <div key={ps.symbol} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gray-50 border border-gray-200 text-[10px]">
                    <span className="text-gray-500">{ps.symbol}</span>
                    <span className="font-medium text-[#303549]">{ps.mode}</span>
                    <button onClick={() => sim.removePriceScenario(ps.symbol)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <ProjectionChart result={adaptCompoundResult(sim.result!)} selectedDay={sim.selectedDay} onSelectDay={sim.setSelectedDay} />
          </div>
        </ProjectionTimelineWrapper>
      )}

      {/* Selected day detail */}
      {selectedSnapshot && (
        <div className="bg-white rounded-xl border border-gray-200 mb-5">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#303549]">Day {selectedSnapshot.day} Detail</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Net Worth</p>
                <p className="text-sm font-bold text-[#303549]">${formatUSD(selectedSnapshot.netWorthUSD)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Supply</p>
                <p className="text-sm font-bold text-[#303549]">${formatUSD(selectedSnapshot.totalSupplyUSD)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Borrow</p>
                <p className="text-sm font-bold text-[#303549]">${formatUSD(selectedSnapshot.totalBorrowUSD)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Health Factor</p>
                <p className={`text-sm font-bold ${hfColor(selectedSnapshot.lowestHealthFactor)}`}>{formatHF(selectedSnapshot.lowestHealthFactor)}</p>
              </div>
            </div>
            {selectedSnapshot.markets.map((m) => (
              <div key={m.marketId} className="bg-gray-50 rounded-md px-3 py-2 mb-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-[#303549]">{m.baseSymbol}</span>
                    <span className={`text-[10px] ml-2 ${hfColor(m.healthFactor)}`}>HF {formatHF(m.healthFactor)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.baseSupplyBalanceUSD > 0 && <span className="text-xs text-emerald-600">+${formatUSD(m.baseSupplyBalanceUSD)}</span>}
                    {m.baseBorrowBalanceUSD > 0 && <span className="text-xs text-red-500">-${formatUSD(m.baseBorrowBalanceUSD)}</span>}
                  </div>
                </div>
                {m.collaterals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {m.collaterals.map((c) => (
                      <span key={c.symbol} className="text-[10px] text-gray-500">
                        {c.symbol}: ${formatUSD(c.balanceUSD)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {selectedSnapshot.actionsExecuted.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Actions</p>
                {selectedSnapshot.actionsExecuted.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-semibold uppercase text-[#303549]">{a.type}</span>
                    <span className="text-gray-500">{(a.amount ?? 0).toFixed(4)} {a.symbol}</span>
                    <span className={`text-[10px] ${a.status === "success" ? "text-green-500" : "text-red-400"}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <CompoundPriceRatesModal
        isOpen={priceRatesModalOpen}
        onClose={() => setPriceRatesModalOpen(false)}
        durationDays={sim.config.durationDays}
        markets={position.markets}
        priceScenarios={sim.config.priceScenarios}
        rateScenarios={sim.config.rateScenarios}
        onUpdatePriceScenario={sim.addPriceScenario}
        onRemovePriceScenario={sim.removePriceScenario}
        onUpdateRateScenario={sim.addRateScenario}
        onRemoveRateScenario={sim.removeRateScenario}
      />

      <AISummaryModal
        isOpen={aiSummaryModalOpen}
        onClose={() => setAiSummaryModalOpen(false)}
        existingSummary={aiSummary}
        onSave={handleSaveAISummary}
        buildRequest={buildSummaryRequest}
      />

      <SaveProjectionModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSave}
        defaultName={currentProjectionName || generateDefaultName()}
        defaultDetails={currentProjectionDetails || ""}
        isSaving={isSaving}
      />

      <LoadProjectionModal
        isOpen={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        projections={projections}
        isLoading={projectionsLoading}
        currentProjectionId={currentProjectionId}
        onLoad={handleLoadProjection}
        onDuplicate={(id) => duplicateProjection(id).then(() => listProjections("compound"))}
        onDelete={(id) => removeProjection(id).then(() => listProjections("compound"))}
      />

      {/* Market search overlay (sandbox) */}
      {marketSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/20" onClick={() => setMarketSearchOpen(false)} />
          <div className="relative bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={marketSearchQuery}
                onChange={(e) => setMarketSearchQuery(e.target.value)}
                placeholder="Search Compound V3 markets..."
                className="flex-1 text-sm outline-none"
                autoFocus
              />
              <button onClick={() => setMarketSearchOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Starting amount</span>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-gray-400">$</span>
                <input
                  type="number"
                  value={addMarketAmount}
                  onChange={(e) => setAddMarketAmount(e.target.value)}
                  className="w-24 h-7 text-xs text-right border border-gray-200 rounded-md px-2 focus:outline-none focus:border-[#00D395] bg-white"
                  min="0"
                  step="100"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filteredMarkets.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No markets found</div>
              ) : (
                filteredMarkets.map((m) => {
                  const exists = position.markets.some((p) => p.marketId === m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => !exists && handleAddMarket(m)}
                      disabled={exists}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        exists ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      <svg width={24} height={24} viewBox="0 0 20 20" fill="none" className="shrink-0">
                        <circle cx="10" cy="10" r="10" fill="#00D395" />
                        <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">C</text>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[#303549]">{m.baseSymbol}</span>
                          <span className="text-[10px] text-gray-400">{CHAIN_LABELS[m.chainId] || `Chain ${m.chainId}`}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{m.label}</span>
                      </div>
                      {exists ? (
                        <span className="text-[10px] text-gray-400">Added</span>
                      ) : (
                        <Plus className="w-4 h-4 text-gray-300 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
