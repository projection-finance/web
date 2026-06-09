"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, SlidersHorizontal, CalendarPlus, X, ChevronDown, Search } from "lucide-react";
import { UNISWAP_CHAINS, POPULAR_POOLS, FEE_TIER_LABELS } from "@/src/lib/uniswap/config";
import { getLiquidityFromAmounts } from "@/src/lib/uniswap/math";
import { useUniswapSimulation } from "@/src/hooks/useUniswapSimulation";
import ProjectionChart from "@/src/components/simulation/ProjectionChart";
import ProjectionTimelineWrapper from "@/src/components/simulation/ProjectionTimelineWrapper";
import { adaptUniswapResult } from "@/src/lib/simulation/chart-adapter";
import UniswapActionScheduler from "./UniswapActionScheduler";
import UniswapScenariosModal from "./UniswapScenariosModal";
import type { UniswapPool } from "@/src/lib/uniswap/types";
import type { UniswapEngineState, UniswapPositionEngineEntry } from "@/src/lib/simulation/uniswap-types";

function formatUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function formatPrice(v: number): string {
  if (v >= 1_000) return v.toFixed(2);
  if (v >= 1) return v.toFixed(4);
  if (v >= 0.001) return v.toFixed(6);
  return v.toExponential(3);
}

const DURATION_PRESETS = [7, 30, 90, 180, 365];

interface UniswapDashboardProps {
  onClear?: () => void;
}

export default function UniswapDashboard({ onClear }: UniswapDashboardProps) {
  useSession();

  // ── Pool search state ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChainId, setSelectedChainId] = useState(1);
  const [searchResults, setSearchResults] = useState<UniswapPool[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Selected pool ──
  const [selectedPool, setSelectedPool] = useState<UniswapPool | null>(null);

  // ── Position config ──
  const [currentPrice, setCurrentPrice] = useState("");
  const [rangePct, setRangePct] = useState("20");
  const [depositUSD, setDepositUSD] = useState("10000");
  const [hasBuilt, setHasBuilt] = useState(false);

  // ── Simulation state ──
  const [engineState, setEngineState] = useState<UniswapEngineState>({ positions: [] });
  const sim = useUniswapSimulation(engineState);

  // ── UI state ──
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [scenariosModalOpen, setScenariosModalOpen] = useState(false);

  // ── Pool search logic ──
  const fetchPools = useCallback(async (chainId: number, query?: string) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ chainId: String(chainId), limit: "20" });
      if (query) params.set("q", query);
      const res = await fetch(`/api/uniswap/pools?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch pools (${res.status})`);
      }
      const pools: UniswapPool[] = await res.json();
      setSearchResults(pools);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch pools";
      console.error("[Uniswap] Pool search error:", msg);
      setSearchError(msg);
      // Fallback to popular pools for this chain
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Load top pools when search opens or chain changes
  useEffect(() => {
    if (searchOpen) {
      fetchPools(selectedChainId, searchQuery || undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, selectedChainId]);

  // Debounced search
  useEffect(() => {
    if (!searchOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPools(selectedChainId, searchQuery || undefined);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Focus search input when opening
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSelectPool = useCallback((pool: UniswapPool) => {
    setSelectedPool(pool);
    setCurrentPrice(formatPrice(pool.currentPrice));
    setHasBuilt(false);
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  // ── Fallback pools for display when no API results ──
  const fallbackPools = useMemo(() =>
    POPULAR_POOLS.filter((p) => p.chainId === selectedChainId),
  [selectedChainId]);

  // ── Derived values ──
  const price = parseFloat(currentPrice) || (selectedPool?.currentPrice ?? 0);
  const rangePctNum = parseFloat(rangePct) || 20;
  const priceLower = price * (1 - rangePctNum / 100);
  const priceUpper = price * (1 + rangePctNum / 100);
  const deposit = parseFloat(depositUSD) || 10000;
  const amount1 = deposit / 2;
  const amount0 = price > 0 ? (deposit / 2) / price : 0;

  const liquidity = useMemo(() =>
    getLiquidityFromAmounts(amount0, amount1, price, priceLower, priceUpper),
    [amount0, amount1, price, priceLower, priceUpper],
  );

  const feeTierDecimal = selectedPool ? selectedPool.feeTier / 1_000_000 : 0;
  const dailyVolume = selectedPool?.volumeUSD24h ?? 0;
  const dailyFeesEstimate = dailyVolume * feeTierDecimal * (liquidity > 0 ? liquidity / (liquidity * 100) : 0);
  const aprEstimate = deposit > 0 ? (dailyFeesEstimate * 365) / deposit : 0;

  // ── Build position ──
  const handleBuild = useCallback(() => {
    if (!selectedPool) return;
    const pos: UniswapPositionEngineEntry = {
      poolAddress: selectedPool.address,
      token0Symbol: selectedPool.token0Symbol,
      token1Symbol: selectedPool.token1Symbol,
      feeTier: feeTierDecimal,
      priceLower,
      priceUpper,
      liquidity,
      currentPrice: price,
      token0PriceUSD: price,
      token1PriceUSD: 1,
      totalActiveLiquidity: selectedPool.totalLiquidity || liquidity * 100,
      dailyVolumeUSD: dailyVolume,
      cumulativeFeesUSD: 0,
      cumulativeFees0: 0,
      cumulativeFees1: 0,
      unclaimedFeesUSD: 0,
      priceAtEntry: price,
    };
    setEngineState({ positions: [pos] });
    setHasBuilt(true);
  }, [selectedPool, price, priceLower, priceUpper, liquidity, feeTierDecimal, dailyVolume]);

  const selectedSnapshot = useMemo(() => {
    if (sim.selectedDay === null || !sim.result) return null;
    return sim.result.timeline[sim.selectedDay] ?? null;
  }, [sim.selectedDay, sim.result]);

  const chainMeta = UNISWAP_CHAINS.find((c) => c.chainId === selectedChainId);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pb-[60px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onClear} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#303549] hover:border-gray-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#303549]">Uniswap V3 Simulator</h1>
            <p className="text-xs text-gray-400">Concentrated liquidity position projection</p>
          </div>
        </div>
      </div>

      {/* Position Builder */}
      <div className="bg-white rounded-xl border border-gray-200 mb-5 p-4">
        <h2 className="text-sm font-semibold text-[#303549] mb-3">Position Setup</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Pool selector */}
          <div className="relative">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Pool</label>
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full h-9 text-xs text-left border border-gray-200 rounded-lg px-3 flex items-center justify-between bg-white hover:border-gray-300 transition-colors"
            >
              {selectedPool ? (
                <span className="font-medium text-[#303549]">
                  {selectedPool.token0Symbol}/{selectedPool.token1Symbol}
                  <span className="text-gray-400 ml-1.5">{FEE_TIER_LABELS[selectedPool.feeTier] || `${selectedPool.feeTier / 10000}%`}</span>
                  <span className="text-gray-400 ml-1.5">({chainMeta?.name})</span>
                </span>
              ) : (
                <span className="text-gray-400">Search for a pool...</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {selectedPool && (
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                <span>TVL {formatUSD(selectedPool.tvlUSD)}</span>
                <span>24h Vol {formatUSD(selectedPool.volumeUSD24h)}</span>
                <span>Price {formatPrice(selectedPool.currentPrice)}</span>
              </div>
            )}
          </div>

          {/* Current price */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
              Current Price {selectedPool ? `(${selectedPool.token0Symbol}/${selectedPool.token1Symbol})` : ""}
            </label>
            <input
              type="number"
              value={currentPrice}
              onChange={(e) => { setCurrentPrice(e.target.value); setHasBuilt(false); }}
              placeholder={selectedPool ? formatPrice(selectedPool.currentPrice) : "Select a pool first"}
              className="w-full h-9 text-xs border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-[#FF007A]"
              step="any"
              disabled={!selectedPool}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Range */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Range (± %)</label>
            <input
              type="number"
              value={rangePct}
              onChange={(e) => { setRangePct(e.target.value); setHasBuilt(false); }}
              className="w-full h-9 text-xs border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-[#FF007A]"
              min="0.1"
              max="200"
              step="1"
              disabled={!selectedPool}
            />
            {selectedPool && (
              <p className="text-[10px] text-gray-400 mt-1">
                Range: {formatPrice(priceLower)} — {formatPrice(priceUpper)}
              </p>
            )}
          </div>

          {/* Deposit */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Deposit (USD)</label>
            <input
              type="number"
              value={depositUSD}
              onChange={(e) => { setDepositUSD(e.target.value); setHasBuilt(false); }}
              className="w-full h-9 text-xs border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-[#FF007A]"
              min="1"
              step="100"
              disabled={!selectedPool}
            />
          </div>

          {/* Fee tier display */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">Fee Tier</label>
            <div className="h-9 text-xs border border-gray-100 rounded-lg px-3 flex items-center bg-gray-50 text-gray-500">
              {selectedPool ? (FEE_TIER_LABELS[selectedPool.feeTier] || `${selectedPool.feeTier / 10000}%`) : "—"}
            </div>
            {selectedPool && (
              <p className="text-[10px] text-gray-400 mt-1">
                Est. APR: {(aprEstimate * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {/* Build button */}
        <button
          onClick={handleBuild}
          disabled={!selectedPool}
          className={`w-full sm:w-auto px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedPool
              ? "bg-[#FF007A] text-white hover:bg-[#E0006B]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {hasBuilt ? "Rebuild Position" : "Build & Simulate"}
        </button>
      </div>

      {/* Summary cards — only after build */}
      {sim.result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Position Value</p>
            <p className="text-lg font-bold text-[#303549] mt-0.5">{formatUSD(sim.result.summary.endNetValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Fees Earned</p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">+{formatUSD(sim.result.summary.totalFeesEarned)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Impermanent Loss</p>
            <p className={`text-lg font-bold mt-0.5 ${sim.result.summary.totalIL < 0 ? "text-red-500" : "text-gray-400"}`}>
              {sim.result.summary.totalIL < 0 ? "-" : ""}{formatUSD(Math.abs(sim.result.summary.totalIL))}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Net PnL</p>
            <p className={`text-lg font-bold mt-0.5 ${sim.result.summary.netPnL >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {sim.result.summary.netPnL >= 0 ? "+" : ""}{formatUSD(sim.result.summary.netPnL)}
            </p>
          </div>
        </div>
      )}

      {/* Range status */}
      {sim.result && (
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 rounded-full px-3 py-1 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            In range: {sim.result.summary.daysInRange}d
          </div>
          <div className="flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Out of range: {sim.result.summary.daysOutOfRange}d
          </div>
          {sim.result.summary.breakEvenDay !== null && (
            <div className="flex items-center gap-1.5 bg-[#FF007A]/10 text-[#FF007A] rounded-full px-3 py-1 text-[11px] font-medium">
              Break-even: Day {sim.result.summary.breakEvenDay}
            </div>
          )}
        </div>
      )}

      {/* Fixed bottom Projection Timeline */}
      {hasBuilt && (
        <ProjectionTimelineWrapper
          isRunning={sim.isRunning}
          hasResult={!!sim.result}
          selectedDay={sim.selectedDay}
          emptyMessage="Build a position to see the projection"
          extraToolbarButtons={
            <>
              <button onClick={() => setActionsExpanded((v) => !v)} className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${actionsExpanded ? "bg-[#FF007A] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                <CalendarPlus className="w-3.5 h-3.5" />Actions
                {sim.config.scheduledActions.length > 0 && <span className={`text-[9px] rounded-full px-1 ${actionsExpanded ? "bg-white/20" : "bg-[#FF007A] text-white"}`}>{sim.config.scheduledActions.length}</span>}
              </button>
              <button onClick={() => setScenariosModalOpen(true)} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <SlidersHorizontal className="w-3.5 h-3.5" />Scenarios
                {(sim.config.priceScenarios.length + sim.config.volumeScenarios.length) > 0 && <span className="text-[9px] bg-[#FF007A] text-white rounded-full px-1">{sim.config.priceScenarios.length + sim.config.volumeScenarios.length}</span>}
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
                <UniswapActionScheduler positions={engineState.positions} actions={sim.config.scheduledActions} durationDays={sim.config.durationDays} onAddAction={sim.addScheduledAction} onRemoveAction={sim.removeScheduledAction} />
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
            {sim.config.volumeScenarios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mr-1 self-center">Volume</span>
                {sim.config.volumeScenarios.map((vs) => (
                  <div key={vs.poolAddress} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gray-50 border border-gray-200 text-[10px]">
                    <span className="text-gray-500">Pool</span>
                    <span className="font-medium text-[#303549]">{vs.mode}</span>
                    <button onClick={() => sim.removeVolumeScenario(vs.poolAddress)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <ProjectionChart result={adaptUniswapResult(sim.result!)} selectedDay={sim.selectedDay} onSelectDay={sim.setSelectedDay} />
          </div>
        </ProjectionTimelineWrapper>
      )}

      {/* Selected day detail */}
      {selectedSnapshot && (
        <div className="bg-white rounded-xl border border-gray-200 mb-5">
          <div className="px-4 py-3 border-b border-gray-100"><h2 className="text-sm font-semibold text-[#303549]">Day {selectedSnapshot.day} Detail</h2></div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div><p className="text-[10px] text-gray-400 uppercase">Net Value</p><p className="text-sm font-bold text-[#303549]">{formatUSD(selectedSnapshot.totalNetValueUSD)}</p></div>
              <div><p className="text-[10px] text-gray-400 uppercase">HODL Value</p><p className="text-sm font-bold text-[#303549]">{formatUSD(selectedSnapshot.totalHoldValueUSD)}</p></div>
              <div><p className="text-[10px] text-gray-400 uppercase">Fees</p><p className="text-sm font-bold text-emerald-600">+{formatUSD(selectedSnapshot.totalFeesUSD)}</p></div>
              <div><p className="text-[10px] text-gray-400 uppercase">IL</p><p className={`text-sm font-bold ${selectedSnapshot.totalILAbsolute < 0 ? "text-red-500" : "text-gray-400"}`}>{formatUSD(Math.abs(selectedSnapshot.totalILAbsolute))}</p></div>
            </div>
            {selectedSnapshot.positions.map((pos, i) => (
              <div key={i} className="bg-gray-50 rounded-md px-3 py-2 mb-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#303549]">{pos.token0Symbol}/{pos.token1Symbol}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pos.inRange ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                      {pos.inRange ? "IN RANGE" : "OUT OF RANGE"}
                    </span>
                  </div>
                  <span className="text-xs text-[#303549]">{formatUSD(pos.netValueUSD)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                  <span>Price: {pos.currentPrice.toFixed(2)}</span>
                  <span>Range: [{pos.priceLower.toFixed(2)} — {pos.priceUpper.toFixed(2)}]</span>
                  <span>Fees: +{formatUSD(pos.cumulativeFeesUSD)}</span>
                  <span>IL: {(pos.ilPercent * 100).toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenarios modal */}
      <UniswapScenariosModal
        isOpen={scenariosModalOpen}
        onClose={() => setScenariosModalOpen(false)}
        durationDays={sim.config.durationDays}
        positions={engineState.positions}
        priceScenarios={sim.config.priceScenarios}
        volumeScenarios={sim.config.volumeScenarios}
        onUpdatePriceScenario={sim.addPriceScenario}
        onRemovePriceScenario={sim.removePriceScenario}
        onUpdateVolumeScenario={sim.addVolumeScenario}
        onRemoveVolumeScenario={sim.removeVolumeScenario}
      />

      {/* Pool search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
          <div className="fixed inset-0 bg-black/20" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} />
          <div className="relative bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Chain tabs */}
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
              {UNISWAP_CHAINS.map((c) => (
                <button
                  key={c.chainId}
                  onClick={() => { setSelectedChainId(c.chainId); setSearchQuery(""); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                    c.chainId === selectedChainId ? "bg-[#FF007A]/10 text-[#FF007A]" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.logo} alt={c.name} className="w-4 h-4 rounded-full" />
                  {c.name}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by token symbol (ETH, USDC, WBTC...)"
                className="flex-1 text-sm outline-none"
                autoFocus
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {isSearching ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 text-gray-300 animate-spin" /></div>
              ) : searchError ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-red-500 mb-1">Failed to load pools</p>
                  <p className="text-xs text-gray-400 mb-3">{searchError}</p>
                  {fallbackPools.length > 0 && (
                    <>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Suggested pools</p>
                      {fallbackPools.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const fakePool: UniswapPool = {
                              address: `${p.token0}-${p.token1}-${p.feeTier}-${p.chainId}`,
                              chainId: p.chainId,
                              token0Symbol: p.token0, token0Address: "", token0Decimals: 18,
                              token1Symbol: p.token1, token1Address: "", token1Decimals: 6,
                              feeTier: p.feeTier, tickSpacing: 10, currentTick: 0,
                              currentPrice: p.defaultPrice, sqrtPriceX96: "",
                              totalLiquidity: 0, volumeUSD24h: p.dailyVolume,
                              feesUSD24h: 0, tvlUSD: 0,
                            };
                            handleSelectPool(fakePool);
                          }}
                          className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors text-[#303549]"
                        >
                          {p.label} <span className="text-gray-400 ml-1">{formatUSD(p.dailyVolume)}/day</span>
                        </button>
                      ))}
                    </>
                  )}
                  <button onClick={() => fetchPools(selectedChainId, searchQuery || undefined)} className="text-xs font-medium text-[#FF007A] hover:underline mt-2">
                    Retry
                  </button>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  {searchQuery ? "No pools found" : "No pools available on this network"}
                </div>
              ) : searchResults.map((pool) => (
                <button
                  key={pool.address}
                  onClick={() => handleSelectPool(pool)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#FF007A]/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#FF007A]">V3</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#303549]">
                        {pool.token0Symbol}/{pool.token1Symbol}
                      </span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1 py-0.5">
                        {FEE_TIER_LABELS[pool.feeTier] || `${pool.feeTier / 10000}%`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-gray-400">TVL {formatUSD(pool.tvlUSD)}</span>
                      <span className="text-[10px] text-gray-400">Vol {formatUSD(pool.volumeUSD24h)}/day</span>
                      <span className="text-[10px] text-gray-400">Price {formatPrice(pool.currentPrice)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
