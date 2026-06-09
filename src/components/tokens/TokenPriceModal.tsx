"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { PriceScenario, RateScenario } from "@/src/lib/simulation/types";
import { TokenHolding } from "@/src/lib/tokens/types";
import { Check, ChevronDown, ChevronRight, RotateCcw, Search } from "lucide-react";
import { formatUSD, formatAPY } from "@/src/lib/format";

// ─── Price tab types ───────────────────────────────────────────────

type ScenarioMode = "fixed" | "linear" | "sinusoidal" | "gbm";

const MODE_LABELS: Record<ScenarioMode, string> = {
  fixed: "Fixed",
  linear: "Linear",
  sinusoidal: "Sinusoidal",
  gbm: "GBM",
};

const MODE_DESCRIPTIONS: Record<ScenarioMode, string> = {
  fixed: "Constant price throughout the projection",
  linear: "Price changes linearly from start to end",
  sinusoidal: "Price oscillates between min and max values",
  gbm: "Geometric Brownian Motion — stochastic price path",
};

// ─── Rate tab types ────────────────────────────────────────────────

type RateScenarioMode = "fixed" | "linear" | "sinusoidal";

const RATE_MODE_LABELS: Record<RateScenarioMode, string> = {
  fixed: "Fixed",
  linear: "Linear",
  sinusoidal: "Sinusoidal",
};

const RATE_TYPE_LABELS: Record<RateScenario["rateType"], string> = {
  supply: "Supply APY",
  borrow: "Borrow APY",
  supplyIncentive: "Supply Incentive APR",
  borrowIncentive: "Borrow Incentive APR",
};

// ─── Shared types ──────────────────────────────────────────────────

type TopTab = "prices" | "rates";

interface TokenPriceRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdings: TokenHolding[];
  priceScenarios: PriceScenario[];
  onUpdatePriceScenario: (scenario: PriceScenario) => void;
  onRemovePriceScenario: (symbol: string) => void;
  rateScenarios: RateScenario[];
  onUpdateRateScenario: (scenario: RateScenario) => void;
  onRemoveRateScenario: (symbol: string, rateType: RateScenario["rateType"]) => void;
}

// ─── Editing state for prices ──────────────────────────────────────

interface PriceEditingState {
  [symbol: string]: {
    mode: ScenarioMode;
    startPrice: string;
    endPrice: string;
    minPrice: string;
    maxPrice: string;
    cycleDays: string;
    mu: string;
    sigma: string;
    seed: string;
  };
}

// ─── Editing state for rates ───────────────────────────────────────

interface RateEditingEntry {
  mode: RateScenarioMode;
  startRate: string;
  endRate: string;
  minRate: string;
  maxRate: string;
  cycleDays: string;
}

interface RateEditingState {
  [key: string]: RateEditingEntry; // key = `${yieldKey}:${rateType}`
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

const TokenPriceRatesModal: React.FC<TokenPriceRatesModalProps> = ({
  isOpen,
  onClose,
  holdings,
  priceScenarios,
  onUpdatePriceScenario,
  onRemovePriceScenario,
  rateScenarios,
  onUpdateRateScenario,
  onRemoveRateScenario,
}) => {
  const [topTab, setTopTab] = useState<TopTab>("prices");

  // ─── Price tab state ─────────────────────────────────────────────
  const [priceSearch, setPriceSearch] = useState("");
  const [priceMode, setPriceMode] = useState<ScenarioMode>("fixed");
  const [priceEditing, setPriceEditing] = useState<PriceEditingState>({});

  // ─── Rate tab state ──────────────────────────────────────────────
  const [rateSearch, setRateSearch] = useState("");
  const [rateEditing, setRateEditing] = useState<RateEditingState>({});
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [expandedRateTypes, setExpandedRateTypes] = useState<Set<string>>(new Set());

  // ─── Derived data ────────────────────────────────────────────────

  const priceScenarioMap = useMemo(() => {
    const map: Record<string, PriceScenario> = {};
    for (const s of priceScenarios) map[s.symbol] = s;
    return map;
  }, [priceScenarios]);

  const rateScenarioMap = useMemo(() => {
    const map: Record<string, RateScenario> = {};
    for (const s of rateScenarios) map[`${s.symbol}:${s.rateType}`] = s;
    return map;
  }, [rateScenarios]);

  const filteredPriceHoldings = useMemo(() => {
    if (!priceSearch) return holdings;
    const q = priceSearch.toLowerCase();
    return holdings.filter(
      (h) =>
        h.symbol.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q)
    );
  }, [holdings, priceSearch]);

  const yieldHoldings = useMemo(() => {
    const yh = holdings.filter((h) => h.yieldSource);
    if (!rateSearch) return yh;
    const q = rateSearch.toLowerCase();
    return yh.filter(
      (h) =>
        h.symbol.toLowerCase().includes(q) ||
        h.yieldSource!.yieldKey.toLowerCase().includes(q) ||
        h.yieldSource!.protocol.toLowerCase().includes(q) ||
        h.yieldSource!.networkName.toLowerCase().includes(q)
    );
  }, [holdings, rateSearch]);

  // ─── Price helpers ───────────────────────────────────────────────

  const getPriceEditing = (symbol: string) => {
    if (priceEditing[symbol]) return priceEditing[symbol];
    const existing = priceScenarioMap[symbol];
    const holding = holdings.find((h) => h.symbol === symbol);
    const price = existing?.startPrice ?? holding?.currentPriceUSD ?? 0;
    return {
      mode: (existing?.mode as ScenarioMode) ?? "fixed",
      startPrice: price.toString(),
      endPrice: (existing?.endPrice ?? price).toString(),
      minPrice: (existing?.minPrice ?? price * 0.8).toString(),
      maxPrice: (existing?.maxPrice ?? price * 1.2).toString(),
      cycleDays: (existing?.cycleDays ?? 30).toString(),
      mu: (existing?.mu ?? 0.05).toString(),
      sigma: (existing?.sigma ?? 0.5).toString(),
      seed: (existing?.seed ?? 0).toString(),
    };
  };

  const updatePriceEditing = (symbol: string, partial: Partial<PriceEditingState[string]>) => {
    setPriceEditing((prev) => ({
      ...prev,
      [symbol]: { ...getPriceEditing(symbol), ...partial },
    }));
  };

  const applyPriceScenario = (symbol: string) => {
    const ed = getPriceEditing(symbol);
    const holding = holdings.find((h) => h.symbol === symbol);

    const scenario: PriceScenario = {
      symbol,
      mode: ed.mode,
      startPrice: parseFloat(ed.startPrice) || holding?.currentPriceUSD || 0,
      originalPrice: holding?.currentPriceUSD,
    };

    if (ed.mode === "linear") {
      scenario.endPrice = parseFloat(ed.endPrice) || scenario.startPrice;
    }
    if (ed.mode === "sinusoidal") {
      scenario.minPrice = parseFloat(ed.minPrice) || scenario.startPrice * 0.8;
      scenario.maxPrice = parseFloat(ed.maxPrice) || scenario.startPrice * 1.2;
      scenario.cycleDays = parseInt(ed.cycleDays) || 30;
    }
    if (ed.mode === "gbm") {
      scenario.mu = parseFloat(ed.mu) || 0;
      scenario.sigma = parseFloat(ed.sigma) || 0.5;
      scenario.seed = parseInt(ed.seed) || 0;
    }

    onUpdatePriceScenario(scenario);
    setPriceEditing((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  };

  const resetPriceScenario = (symbol: string) => {
    onRemovePriceScenario(symbol);
    setPriceEditing((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  };

  // ─── Rate helpers ────────────────────────────────────────────────

  const rateKey = (yieldKey: string, rateType: RateScenario["rateType"]) =>
    `${yieldKey}:${rateType}`;

  const getCurrentRate = (holding: TokenHolding, rateType: RateScenario["rateType"]): number => {
    const ys = holding.yieldSource;
    if (!ys) return 0;
    switch (rateType) {
      case "supply": return ys.supplyAPY;
      case "borrow": return ys.variableBorrowAPY;
      case "supplyIncentive": return ys.merklSupplyAPR;
      case "borrowIncentive": return ys.merklBorrowAPR;
    }
  };

  const getRateEditing = (yieldKey: string, rateType: RateScenario["rateType"], holding: TokenHolding): RateEditingEntry => {
    const k = rateKey(yieldKey, rateType);
    if (rateEditing[k]) return rateEditing[k];
    const existing = rateScenarioMap[k];
    const current = getCurrentRate(holding, rateType);
    return {
      mode: (existing?.mode as RateScenarioMode) ?? "fixed",
      startRate: ((existing?.startRate ?? current) * 100).toString(),
      endRate: ((existing?.endRate ?? current) * 100).toString(),
      minRate: ((existing?.minRate ?? current * 0.5) * 100).toString(),
      maxRate: ((existing?.maxRate ?? current * 1.5) * 100).toString(),
      cycleDays: (existing?.cycleDays ?? 30).toString(),
    };
  };

  const updateRateEditing = (yieldKey: string, rateType: RateScenario["rateType"], holding: TokenHolding, partial: Partial<RateEditingEntry>) => {
    const k = rateKey(yieldKey, rateType);
    setRateEditing((prev) => ({
      ...prev,
      [k]: { ...getRateEditing(yieldKey, rateType, holding), ...partial },
    }));
  };

  const applyRateScenario = (yieldKey: string, rateType: RateScenario["rateType"], holding: TokenHolding) => {
    const ed = getRateEditing(yieldKey, rateType, holding);
    const current = getCurrentRate(holding, rateType);

    const scenario: RateScenario = {
      symbol: yieldKey,
      rateType,
      mode: ed.mode,
      startRate: (parseFloat(ed.startRate) || 0) / 100,
      originalRate: current,
    };

    if (ed.mode === "linear") {
      scenario.endRate = (parseFloat(ed.endRate) || 0) / 100;
    }
    if (ed.mode === "sinusoidal") {
      scenario.minRate = (parseFloat(ed.minRate) || 0) / 100;
      scenario.maxRate = (parseFloat(ed.maxRate) || 0) / 100;
      scenario.cycleDays = parseInt(ed.cycleDays) || 30;
    }

    onUpdateRateScenario(scenario);
    const k = rateKey(yieldKey, rateType);
    setRateEditing((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const resetRateScenario = (yieldKey: string, rateType: RateScenario["rateType"]) => {
    onRemoveRateScenario(yieldKey, rateType);
    const k = rateKey(yieldKey, rateType);
    setRateEditing((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const togglePosition = (yieldKey: string) => {
    setExpandedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(yieldKey)) next.delete(yieldKey);
      else next.add(yieldKey);
      return next;
    });
  };

  const toggleRateType = (key: string) => {
    setExpandedRateTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ═══════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-[#303549]">
            Scenarios
          </DialogTitle>
        </DialogHeader>

        {/* ─── Top-level tab switcher ──────────────────────────── */}
        <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
          {(["prices", "rates"] as TopTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setTopTab(tab)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                topTab === tab
                  ? "border-[#5382E3] text-[#5382E3]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "prices" ? "Prices" : "Rates"}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* Prices tab                                             */}
        {/* ═══════════════════════════════════════════════════════ */}
        {topTab === "prices" && (
          <>
            {/* Mode selector */}
            <div className="flex items-center gap-1.5 mb-3">
              {(Object.keys(MODE_LABELS) as ScenarioMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPriceMode(m)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    priceMode === m
                      ? "bg-[#303549] text-white"
                      : "text-gray-500 hover:bg-gray-100 bg-gray-50"
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mb-4">{MODE_DESCRIPTIONS[priceMode]}</p>

            {/* Search */}
            {holdings.length > 4 && (
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={priceSearch}
                  onChange={(e) => setPriceSearch(e.target.value)}
                  placeholder="Search tokens..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-[#5382E3]"
                />
              </div>
            )}

            {/* Token list */}
            <div className="space-y-3">
              {filteredPriceHoldings.map((holding) => {
                const ed = getPriceEditing(holding.symbol);
                const hasScenario = !!priceScenarioMap[holding.symbol];

                return (
                  <div
                    key={holding.coingeckoId}
                    className={`rounded-xl border p-3 transition-colors ${
                      hasScenario
                        ? "border-[#5382E3]/30 bg-[#5382E3]/5"
                        : "border-gray-200"
                    }`}
                  >
                    {/* Token header */}
                    <div className="flex items-center gap-2 mb-2.5">
                      {holding.image ? (
                        <img
                          src={holding.image}
                          alt={holding.symbol}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold">
                          {holding.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#303549]">{holding.symbol}</span>
                          <span className="text-[10px] text-gray-400 truncate">{holding.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          Current: ${formatUSD(holding.currentPriceUSD)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasScenario && (
                          <button
                            onClick={() => resetPriceScenario(holding.symbol)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400"
                            title="Reset"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mode-specific inputs */}
                    <div className="space-y-2">
                      {priceMode === "fixed" && (
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-gray-500 w-16 shrink-0">Price</label>
                          <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">$</span>
                            <input
                              type="number"
                              value={ed.startPrice}
                              onChange={(e) => updatePriceEditing(holding.symbol, { startPrice: e.target.value, mode: "fixed" })}
                              className="w-full pl-5 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                              step="any"
                            />
                          </div>
                        </div>
                      )}

                      {priceMode === "linear" && (
                        <>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">Start</label>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">$</span>
                              <input
                                type="number"
                                value={ed.startPrice}
                                onChange={(e) => updatePriceEditing(holding.symbol, { startPrice: e.target.value, mode: "linear" })}
                                className="w-full pl-5 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                step="any"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">End</label>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">$</span>
                              <input
                                type="number"
                                value={ed.endPrice}
                                onChange={(e) => updatePriceEditing(holding.symbol, { endPrice: e.target.value, mode: "linear" })}
                                className="w-full pl-5 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                step="any"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {priceMode === "sinusoidal" && (
                        <>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">Min</label>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">$</span>
                              <input
                                type="number"
                                value={ed.minPrice}
                                onChange={(e) => updatePriceEditing(holding.symbol, { minPrice: e.target.value, mode: "sinusoidal" })}
                                className="w-full pl-5 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                step="any"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">Max</label>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">$</span>
                              <input
                                type="number"
                                value={ed.maxPrice}
                                onChange={(e) => updatePriceEditing(holding.symbol, { maxPrice: e.target.value, mode: "sinusoidal" })}
                                className="w-full pl-5 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                step="any"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">Cycle</label>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                value={ed.cycleDays}
                                onChange={(e) => updatePriceEditing(holding.symbol, { cycleDays: e.target.value, mode: "sinusoidal" })}
                                className="w-full pl-2 pr-8 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                min={1}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">days</span>
                            </div>
                          </div>
                        </>
                      )}

                      {priceMode === "gbm" && (
                        <>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">Start</label>
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">$</span>
                              <input
                                type="number"
                                value={ed.startPrice}
                                onChange={(e) => updatePriceEditing(holding.symbol, { startPrice: e.target.value, mode: "gbm" })}
                                className="w-full pl-5 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                step="any"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">Drift (μ)</label>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                value={ed.mu}
                                onChange={(e) => updatePriceEditing(holding.symbol, { mu: e.target.value, mode: "gbm" })}
                                className="w-full pl-2 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                step="0.01"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">Vol (σ)</label>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                value={ed.sigma}
                                onChange={(e) => updatePriceEditing(holding.symbol, { sigma: e.target.value, mode: "gbm" })}
                                className="w-full pl-2 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                step="0.01"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 w-16 shrink-0">Seed</label>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                value={ed.seed}
                                onChange={(e) => updatePriceEditing(holding.symbol, { seed: e.target.value, mode: "gbm" })}
                                className="w-full pl-2 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                min={0}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">0 = random</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Apply button */}
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          updatePriceEditing(holding.symbol, { mode: priceMode });
                          const ed2 = { ...getPriceEditing(holding.symbol), mode: priceMode };
                          setPriceEditing((prev) => ({ ...prev, [holding.symbol]: ed2 }));
                          setTimeout(() => applyPriceScenario(holding.symbol), 0);
                        }}
                        className="h-7 px-3 text-[11px] bg-[#303549] hover:bg-[#1e2333]"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Apply
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredPriceHoldings.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-6">
                  No tokens in your portfolio. Add tokens to configure price scenarios.
                </p>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* Rates tab                                              */}
        {/* ═══════════════════════════════════════════════════════ */}
        {topTab === "rates" && (
          <>
            <p className="text-[11px] text-gray-500 mb-4">
              Configure rate scenarios for yield positions. Each rate type can be set independently.
            </p>

            {/* Search */}
            {yieldHoldings.length > 3 && (
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={rateSearch}
                  onChange={(e) => setRateSearch(e.target.value)}
                  placeholder="Search positions..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-[#5382E3]"
                />
              </div>
            )}

            <div className="space-y-3">
              {yieldHoldings.map((holding) => {
                const ys = holding.yieldSource!;
                const isExpanded = expandedPositions.has(ys.yieldKey);
                const rateTypes: RateScenario["rateType"][] = [
                  "supply",
                  "borrow",
                  "supplyIncentive",
                  "borrowIncentive",
                ];

                // Count how many rate scenarios are configured for this position
                const configuredCount = rateTypes.filter(
                  (rt) => !!rateScenarioMap[rateKey(ys.yieldKey, rt)]
                ).length;

                return (
                  <div
                    key={ys.yieldKey}
                    className={`rounded-xl border transition-colors ${
                      configuredCount > 0
                        ? "border-[#5382E3]/30 bg-[#5382E3]/5"
                        : "border-gray-200"
                    }`}
                  >
                    {/* Position header (clickable to expand) */}
                    <button
                      onClick={() => togglePosition(ys.yieldKey)}
                      className="w-full flex items-center gap-2 p-3 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      )}
                      {holding.image ? (
                        <img
                          src={holding.image}
                          alt={holding.symbol}
                          className="w-6 h-6 rounded-full shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {holding.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#303549]">{holding.symbol}</span>
                          <span className="text-[10px] text-gray-400 truncate">
                            {ys.protocol.toUpperCase()} · {ys.networkName}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 truncate block">
                          {ys.yieldKey}
                        </span>
                      </div>
                      {configuredCount > 0 && (
                        <span className="text-[10px] font-medium text-[#5382E3] bg-[#5382E3]/10 px-1.5 py-0.5 rounded shrink-0">
                          {configuredCount} set
                        </span>
                      )}
                    </button>

                    {/* Expanded rate types */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        {rateTypes.map((rt) => {
                          const k = rateKey(ys.yieldKey, rt);
                          const isRtExpanded = expandedRateTypes.has(k);
                          const hasScenario = !!rateScenarioMap[k];
                          const currentRate = getCurrentRate(holding, rt);
                          const ed = getRateEditing(ys.yieldKey, rt, holding);

                          return (
                            <div
                              key={rt}
                              className={`rounded-lg border transition-colors ${
                                hasScenario
                                  ? "border-[#5382E3]/20 bg-white"
                                  : "border-gray-100 bg-[#F5F5FA]"
                              }`}
                            >
                              {/* Rate type header */}
                              <button
                                onClick={() => toggleRateType(k)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                              >
                                {isRtExpanded ? (
                                  <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                                )}
                                <span className="text-[11px] font-medium text-[#303549] flex-1">
                                  {RATE_TYPE_LABELS[rt]}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  Current: {formatAPY(currentRate)}
                                </span>
                                {hasScenario && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      resetRateScenario(ys.yieldKey, rt);
                                    }}
                                    className="p-0.5 rounded hover:bg-gray-100 text-gray-400"
                                    title="Reset"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </button>

                              {/* Rate type editing form */}
                              {isRtExpanded && (
                                <div className="px-3 pb-3 space-y-2">
                                  {/* Mode selector */}
                                  <div className="flex items-center gap-1">
                                    {(Object.keys(RATE_MODE_LABELS) as RateScenarioMode[]).map((m) => (
                                      <button
                                        key={m}
                                        onClick={() => updateRateEditing(ys.yieldKey, rt, holding, { mode: m })}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                          ed.mode === m
                                            ? "bg-[#303549] text-white"
                                            : "text-gray-500 hover:bg-gray-100 bg-gray-50"
                                        }`}
                                      >
                                        {RATE_MODE_LABELS[m]}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Mode-specific inputs */}
                                  {ed.mode === "fixed" && (
                                    <div className="flex items-center gap-2">
                                      <label className="text-[11px] text-gray-500 w-16 shrink-0">Rate</label>
                                      <div className="relative flex-1">
                                        <input
                                          type="number"
                                          value={ed.startRate}
                                          onChange={(e) => updateRateEditing(ys.yieldKey, rt, holding, { startRate: e.target.value })}
                                          className="w-full pl-2 pr-6 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                          step="0.01"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                                      </div>
                                    </div>
                                  )}

                                  {ed.mode === "linear" && (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <label className="text-[11px] text-gray-500 w-16 shrink-0">Start</label>
                                        <div className="relative flex-1">
                                          <input
                                            type="number"
                                            value={ed.startRate}
                                            onChange={(e) => updateRateEditing(ys.yieldKey, rt, holding, { startRate: e.target.value })}
                                            className="w-full pl-2 pr-6 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                            step="0.01"
                                          />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <label className="text-[11px] text-gray-500 w-16 shrink-0">End</label>
                                        <div className="relative flex-1">
                                          <input
                                            type="number"
                                            value={ed.endRate}
                                            onChange={(e) => updateRateEditing(ys.yieldKey, rt, holding, { endRate: e.target.value })}
                                            className="w-full pl-2 pr-6 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                            step="0.01"
                                          />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {ed.mode === "sinusoidal" && (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <label className="text-[11px] text-gray-500 w-16 shrink-0">Min</label>
                                        <div className="relative flex-1">
                                          <input
                                            type="number"
                                            value={ed.minRate}
                                            onChange={(e) => updateRateEditing(ys.yieldKey, rt, holding, { minRate: e.target.value })}
                                            className="w-full pl-2 pr-6 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                            step="0.01"
                                          />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <label className="text-[11px] text-gray-500 w-16 shrink-0">Max</label>
                                        <div className="relative flex-1">
                                          <input
                                            type="number"
                                            value={ed.maxRate}
                                            onChange={(e) => updateRateEditing(ys.yieldKey, rt, holding, { maxRate: e.target.value })}
                                            className="w-full pl-2 pr-6 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                            step="0.01"
                                          />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <label className="text-[11px] text-gray-500 w-16 shrink-0">Cycle</label>
                                        <div className="relative flex-1">
                                          <input
                                            type="number"
                                            value={ed.cycleDays}
                                            onChange={(e) => updateRateEditing(ys.yieldKey, rt, holding, { cycleDays: e.target.value })}
                                            className="w-full pl-2 pr-8 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#5382E3]"
                                            min={1}
                                          />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">days</span>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Apply button */}
                                  <div className="flex justify-end mt-1">
                                    <Button
                                      size="sm"
                                      onClick={() => applyRateScenario(ys.yieldKey, rt, holding)}
                                      className="h-7 px-3 text-[11px] bg-[#303549] hover:bg-[#1e2333]"
                                    >
                                      <Check className="w-3 h-3 mr-1" />
                                      Apply
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {yieldHoldings.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-6">
                  No yield positions found. Add DeFi positions with yield sources to configure rate scenarios.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TokenPriceRatesModal;
