"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Check, Search, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { PriceScenario } from "@/src/lib/simulation/types";
import type { CompoundRateScenario } from "@/src/lib/simulation/compound-types";
import type { CompoundMarketPosition } from "@/src/lib/compound/types";

type ScenarioMode = "fixed" | "linear" | "sinusoidal";

interface CompoundPriceRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  durationDays: number;
  markets: CompoundMarketPosition[];
  priceScenarios: PriceScenario[];
  rateScenarios: CompoundRateScenario[];
  onUpdatePriceScenario: (scenario: PriceScenario) => void;
  onRemovePriceScenario: (symbol: string) => void;
  onUpdateRateScenario: (scenario: CompoundRateScenario) => void;
  onRemoveRateScenario: (marketId: string, rateType: "supply" | "borrow") => void;
}

export default function CompoundPriceRatesModal({
  isOpen,
  onClose,
  durationDays,
  markets,
  priceScenarios,
  rateScenarios,
  onUpdatePriceScenario,
  onRemovePriceScenario,
  onUpdateRateScenario,
  onRemoveRateScenario,
}: CompoundPriceRatesModalProps) {
  const [tab, setTab] = useState<"prices" | "rates">("prices");
  const [mode, setMode] = useState<ScenarioMode>("fixed");
  const [search, setSearch] = useState("");

  // Editing state -- prices
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [editingPriceMin, setEditingPriceMin] = useState<Record<string, string>>({});
  const [editingPriceMax, setEditingPriceMax] = useState<Record<string, string>>({});

  // Editing state -- rates (keyed by `${marketId}-${rateType}`)
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});
  const [editingRateMin, setEditingRateMin] = useState<Record<string, string>>({});
  const [editingRateMax, setEditingRateMax] = useState<Record<string, string>>({});

  // Bulk apply
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPct, setBulkPct] = useState("");

  // Flash saved indicator
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const flashSaved = (key: string) => {
    setSavedFlash(key);
    setTimeout(() => setSavedFlash(null), 1200);
  };

  const clearEditing = (
    setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    key: string,
  ) => {
    setter((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ── Unique assets from all markets (base + collateral) for price tab ──
  const uniqueAssets = useMemo(() => {
    const map = new Map<string, { symbol: string; estimatedPrice: number }>();
    for (const m of markets) {
      // Base asset
      if (!map.has(m.baseSymbol)) {
        const existing = priceScenarios.find((p) => p.symbol === m.baseSymbol);
        map.set(m.baseSymbol, {
          symbol: m.baseSymbol,
          estimatedPrice: existing?.originalPrice ?? existing?.startPrice ?? m.basePriceUSD,
        });
      }
      // Collateral assets
      for (const c of m.collaterals) {
        if (!map.has(c.symbol)) {
          const existing = priceScenarios.find((p) => p.symbol === c.symbol);
          map.set(c.symbol, {
            symbol: c.symbol,
            estimatedPrice: existing?.originalPrice ?? existing?.startPrice ?? c.priceUSD,
          });
        }
      }
      // Also include collateral asset definitions (may have assets user hasn't deposited yet)
      for (const ca of m.collateralAssets) {
        if (!map.has(ca.symbol)) {
          const existing = priceScenarios.find((p) => p.symbol === ca.symbol);
          map.set(ca.symbol, {
            symbol: ca.symbol,
            estimatedPrice: existing?.originalPrice ?? existing?.startPrice ?? ca.priceUSD,
          });
        }
      }
    }
    return [...map.values()];
  }, [markets, priceScenarios]);

  // ── Rate rows: each market contributes TWO rows (supply + borrow) ──
  const rateRows = useMemo(() => {
    const rows: {
      key: string;
      marketId: string;
      rateType: "supply" | "borrow";
      label: string;
      baseSymbol: string;
      currentRate: number;
    }[] = [];
    for (const m of markets) {
      rows.push({
        key: `${m.marketId}-supply`,
        marketId: m.marketId,
        rateType: "supply",
        label: `${m.baseSymbol} Supply`,
        baseSymbol: m.baseSymbol,
        currentRate: m.supplyAPY,
      });
      rows.push({
        key: `${m.marketId}-borrow`,
        marketId: m.marketId,
        rateType: "borrow",
        label: `${m.baseSymbol} Borrow`,
        baseSymbol: m.baseSymbol,
        currentRate: m.borrowAPY,
      });
    }
    return rows;
  }, [markets]);

  const filteredAssets = useMemo(() => {
    if (!search) return uniqueAssets;
    const q = search.toLowerCase();
    return uniqueAssets.filter((a) => a.symbol.toLowerCase().includes(q));
  }, [uniqueAssets, search]);

  const filteredRateRows = useMemo(() => {
    if (!search) return rateRows;
    const q = search.toLowerCase();
    return rateRows.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.baseSymbol.toLowerCase().includes(q) ||
        r.marketId.toLowerCase().includes(q),
    );
  }, [rateRows, search]);

  const getPriceScenario = (symbol: string) =>
    priceScenarios.find((s) => s.symbol === symbol);

  const getRateScenario = (marketId: string, rateType: "supply" | "borrow") =>
    rateScenarios.find((s) => s.marketId === marketId && s.rateType === rateType);

  // ── Price handlers ──

  const handleFixedPriceBlur = (symbol: string, currentPrice: number) => {
    const raw = editingPrices[symbol];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) { clearEditing(setEditingPrices, symbol); return; }
    if (Math.abs(val - currentPrice) < 0.000001) {
      onRemovePriceScenario(symbol);
    } else {
      onUpdatePriceScenario({ symbol, mode: "fixed", startPrice: val, originalPrice: currentPrice });
      flashSaved(`price-${symbol}`);
    }
    clearEditing(setEditingPrices, symbol);
  };

  const handleLinearPriceBlur = (symbol: string, currentPrice: number) => {
    const raw = editingPrices[symbol];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) { clearEditing(setEditingPrices, symbol); return; }
    if (Math.abs(val - currentPrice) < 0.000001) {
      onRemovePriceScenario(symbol);
    } else {
      onUpdatePriceScenario({ symbol, mode: "linear", startPrice: currentPrice, endPrice: val, originalPrice: currentPrice });
      flashSaved(`price-${symbol}`);
    }
    clearEditing(setEditingPrices, symbol);
  };

  const handleSinPriceBlur = (symbol: string, currentPrice: number) => {
    const rawMin = editingPriceMin[symbol];
    const rawMax = editingPriceMax[symbol];
    if (rawMin === undefined && rawMax === undefined) return;
    const existing = getPriceScenario(symbol);
    const min = rawMin !== undefined ? parseFloat(rawMin) : (existing?.minPrice ?? currentPrice);
    const max = rawMax !== undefined ? parseFloat(rawMax) : (existing?.maxPrice ?? currentPrice);
    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      clearEditing(setEditingPriceMin, symbol);
      clearEditing(setEditingPriceMax, symbol);
      return;
    }
    if (Math.abs(min - currentPrice) < 0.000001 && Math.abs(max - currentPrice) < 0.000001) {
      onRemovePriceScenario(symbol);
    } else {
      onUpdatePriceScenario({
        symbol, mode: "sinusoidal", startPrice: currentPrice,
        minPrice: Math.min(min, max), maxPrice: Math.max(min, max),
        cycleDays: durationDays, originalPrice: currentPrice,
      });
      flashSaved(`price-${symbol}`);
    }
    clearEditing(setEditingPriceMin, symbol);
    clearEditing(setEditingPriceMax, symbol);
  };

  // ── Rate handlers ──

  const rateKey = (marketId: string, rateType: "supply" | "borrow") => `${marketId}-${rateType}`;

  const handleFixedRateBlur = (marketId: string, rateType: "supply" | "borrow", currentRate: number) => {
    const k = rateKey(marketId, rateType);
    const raw = editingRates[k];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) { clearEditing(setEditingRates, k); return; }
    const rateDecimal = val / 100;
    if (Math.abs(rateDecimal - currentRate) < 0.000001) {
      onRemoveRateScenario(marketId, rateType);
    } else {
      onUpdateRateScenario({ marketId, rateType, mode: "fixed", startRate: rateDecimal, originalRate: currentRate });
      flashSaved(`rate-${k}`);
    }
    clearEditing(setEditingRates, k);
  };

  const handleLinearRateBlur = (marketId: string, rateType: "supply" | "borrow", currentRate: number) => {
    const k = rateKey(marketId, rateType);
    const raw = editingRates[k];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) { clearEditing(setEditingRates, k); return; }
    const rateDecimal = val / 100;
    if (Math.abs(rateDecimal - currentRate) < 0.000001) {
      onRemoveRateScenario(marketId, rateType);
    } else {
      onUpdateRateScenario({ marketId, rateType, mode: "linear", startRate: currentRate, endRate: rateDecimal, originalRate: currentRate });
      flashSaved(`rate-${k}`);
    }
    clearEditing(setEditingRates, k);
  };

  const handleSinRateBlur = (marketId: string, rateType: "supply" | "borrow", currentRate: number) => {
    const k = rateKey(marketId, rateType);
    const rawMin = editingRateMin[k];
    const rawMax = editingRateMax[k];
    if (rawMin === undefined && rawMax === undefined) return;
    const existing = getRateScenario(marketId, rateType);
    const min = rawMin !== undefined ? parseFloat(rawMin) / 100 : (existing?.minRate ?? currentRate);
    const max = rawMax !== undefined ? parseFloat(rawMax) / 100 : (existing?.maxRate ?? currentRate);
    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      clearEditing(setEditingRateMin, k);
      clearEditing(setEditingRateMax, k);
      return;
    }
    if (Math.abs(min - currentRate) < 0.000001 && Math.abs(max - currentRate) < 0.000001) {
      onRemoveRateScenario(marketId, rateType);
    } else {
      onUpdateRateScenario({
        marketId, rateType, mode: "sinusoidal", startRate: currentRate,
        minRate: Math.min(min, max), maxRate: Math.max(min, max),
        cycleDays: durationDays, originalRate: currentRate,
      });
      flashSaved(`rate-${k}`);
    }
    clearEditing(setEditingRateMin, k);
    clearEditing(setEditingRateMax, k);
  };

  // ── Bulk apply ──

  const handleBulkApply = () => {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) return;
    const factor = 1 + pct / 100;

    if (tab === "prices") {
      for (const a of uniqueAssets) {
        const current = getPriceScenario(a.symbol)?.startPrice ?? a.estimatedPrice;
        onUpdatePriceScenario({
          symbol: a.symbol, mode: "fixed",
          startPrice: current * factor, originalPrice: a.estimatedPrice,
        });
      }
    } else {
      for (const row of rateRows) {
        const existing = getRateScenario(row.marketId, row.rateType);
        const current = existing?.startRate ?? row.currentRate;
        onUpdateRateScenario({
          marketId: row.marketId, rateType: row.rateType, mode: "fixed",
          startRate: Math.max(0, current * factor), originalRate: row.currentRate,
        });
      }
    }
    setBulkPct("");
    setBulkOpen(false);
  };

  // ── Key handler for inline inputs ──
  const handleKeyDown = (e: React.KeyboardEvent, onBlur: () => void) => {
    if (e.key === "Enter") { e.preventDefault(); onBlur(); }
    if (e.key === "Escape") { (e.target as HTMLInputElement).blur(); }
  };

  // ── Mode description ──
  const modeDesc = mode === "fixed"
    ? "Set a constant value from today through the projection."
    : mode === "linear"
      ? `Interpolate linearly from current value to target over ${durationDays} days.`
      : `Oscillate between min and max over a full ${durationDays}-day cycle.`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold">
            Price & Rate Scenarios
          </DialogTitle>
        </DialogHeader>

        {/* Tabs + Mode selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Price / Rates tab */}
          <div className="flex gap-0.5 p-0.5 bg-[#F5F5FA] rounded-md">
            {(["prices", "rates"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`text-[11px] font-medium px-3 py-1 rounded transition-colors capitalize ${
                  tab === t ? "bg-white text-[#303549] shadow-sm" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "prices" ? "Prices" : "Market APYs"}
              </button>
            ))}
          </div>

          {/* Mode selector */}
          <div className="flex gap-0.5 p-0.5 bg-[#F5F5FA] rounded-md">
            {(["fixed", "linear", "sinusoidal"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded transition-colors capitalize ${
                  mode === m ? "bg-white text-[#303549] shadow-sm" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {m === "sinusoidal" ? "Wave" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-1.5 bg-[#F5F5FA] rounded-md px-2.5 py-1.5 flex-1 min-w-[120px]">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-xs text-[#303549] focus:outline-none w-full placeholder:text-gray-400"
            />
          </div>

          {/* Bulk apply toggle */}
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            Bulk {bulkOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Bulk apply bar */}
        {bulkOpen && (
          <div className="flex items-center gap-2 bg-[#F5F5FA] rounded-md px-3 py-2">
            <span className="text-[11px] text-gray-500">Apply</span>
            <input
              type="number"
              value={bulkPct}
              onChange={(e) => setBulkPct(e.target.value)}
              placeholder="+10"
              className="w-16 h-7 text-xs border border-gray-200 rounded px-2 bg-white text-center"
              step="any"
            />
            <span className="text-[11px] text-gray-500">% to all {tab === "prices" ? "prices" : "APYs"}</span>
            <Button size="sm" className="h-7 text-xs bg-[#00D395] hover:bg-[#00b880]" onClick={handleBulkApply} disabled={!bulkPct}>
              Apply
            </Button>
          </div>
        )}

        {/* Mode description */}
        <p className="text-[10px] text-gray-400">{modeDesc}</p>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === "prices" ? (
            /* -- PRICES TABLE -- */
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-[10px] font-medium text-gray-400 text-left py-2 px-2">Asset</th>
                  <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Current</th>
                  {mode === "sinusoidal" ? (
                    <>
                      <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Min</th>
                      <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Max</th>
                    </>
                  ) : (
                    <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                      {mode === "fixed" ? "New Price" : "Target (D" + durationDays + ")"}
                    </th>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const ps = getPriceScenario(asset.symbol);
                  const currentPrice = asset.estimatedPrice;
                  const hasScenario = !!ps;
                  const isSaved = savedFlash === `price-${asset.symbol}`;

                  return (
                    <tr key={asset.symbol} className={`border-b border-gray-50 ${hasScenario ? "bg-[#00D395]/5" : ""}`}>
                      <td className="py-2 px-2">
                        <span className="text-xs font-semibold text-[#303549]">{asset.symbol}</span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="text-[11px] text-gray-400">${currentPrice.toFixed(currentPrice < 1 ? 4 : 2)}</span>
                      </td>
                      {mode === "sinusoidal" ? (
                        <>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              className="w-20 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[#00D395]"
                              value={editingPriceMin[asset.symbol] ?? (ps?.minPrice?.toFixed(2) ?? "")}
                              onChange={(e) => setEditingPriceMin((p) => ({ ...p, [asset.symbol]: e.target.value }))}
                              onBlur={() => handleSinPriceBlur(asset.symbol, currentPrice)}
                              onKeyDown={(e) => handleKeyDown(e, () => handleSinPriceBlur(asset.symbol, currentPrice))}
                              placeholder={currentPrice.toFixed(2)}
                              step="any"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              className="w-20 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[#00D395]"
                              value={editingPriceMax[asset.symbol] ?? (ps?.maxPrice?.toFixed(2) ?? "")}
                              onChange={(e) => setEditingPriceMax((p) => ({ ...p, [asset.symbol]: e.target.value }))}
                              onBlur={() => handleSinPriceBlur(asset.symbol, currentPrice)}
                              onKeyDown={(e) => handleKeyDown(e, () => handleSinPriceBlur(asset.symbol, currentPrice))}
                              placeholder={currentPrice.toFixed(2)}
                              step="any"
                            />
                          </td>
                        </>
                      ) : (
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            className="w-24 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[#00D395]"
                            value={editingPrices[asset.symbol] ?? (ps ? (mode === "linear" ? ps.endPrice : ps.startPrice)?.toFixed(2) : "")}
                            onChange={(e) => setEditingPrices((p) => ({ ...p, [asset.symbol]: e.target.value }))}
                            onBlur={() => mode === "fixed" ? handleFixedPriceBlur(asset.symbol, currentPrice) : handleLinearPriceBlur(asset.symbol, currentPrice)}
                            onKeyDown={(e) => handleKeyDown(e, () => mode === "fixed" ? handleFixedPriceBlur(asset.symbol, currentPrice) : handleLinearPriceBlur(asset.symbol, currentPrice))}
                            placeholder={currentPrice.toFixed(2)}
                            step="any"
                          />
                        </td>
                      )}
                      <td className="py-2 px-1 text-center w-8">
                        {isSaved ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 inline-block" />
                        ) : hasScenario ? (
                          <button onClick={() => onRemovePriceScenario(asset.symbol)} className="text-gray-300 hover:text-red-400">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* -- RATES TABLE -- */
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-[10px] font-medium text-gray-400 text-left py-2 px-2">Market / Rate</th>
                  <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Current APY</th>
                  {mode === "sinusoidal" ? (
                    <>
                      <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Min %</th>
                      <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Max %</th>
                    </>
                  ) : (
                    <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                      {mode === "fixed" ? "New APY %" : "Target % (D" + durationDays + ")"}
                    </th>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredRateRows.map((row) => {
                  const k = row.key;
                  const rs = getRateScenario(row.marketId, row.rateType);
                  const hasScenario = !!rs;
                  const isSaved = savedFlash === `rate-${k}`;
                  const isSupply = row.rateType === "supply";

                  return (
                    <tr key={k} className={`border-b border-gray-50 ${hasScenario ? "bg-[#00D395]/5" : ""}`}>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-[#303549]">{row.label}</span>
                          <span
                            className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                              isSupply
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {isSupply ? "Supply" : "Borrow"}
                          </span>
                        </div>
                        <div className="text-[9px] text-gray-400 truncate max-w-[200px]" title={row.marketId}>
                          {row.marketId.slice(0, 8)}...{row.marketId.slice(-6)}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={`text-[11px] ${isSupply ? "text-emerald-600" : "text-amber-600"}`}>
                          {(row.currentRate * 100).toFixed(2)}%
                        </span>
                      </td>
                      {mode === "sinusoidal" ? (
                        <>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              className="w-20 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[#00D395]"
                              value={editingRateMin[k] ?? (rs?.minRate != null ? (rs.minRate * 100).toFixed(2) : "")}
                              onChange={(e) => setEditingRateMin((p) => ({ ...p, [k]: e.target.value }))}
                              onBlur={() => handleSinRateBlur(row.marketId, row.rateType, row.currentRate)}
                              onKeyDown={(e) => handleKeyDown(e, () => handleSinRateBlur(row.marketId, row.rateType, row.currentRate))}
                              placeholder={(row.currentRate * 100).toFixed(2)}
                              step="any"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              className="w-20 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[#00D395]"
                              value={editingRateMax[k] ?? (rs?.maxRate != null ? (rs.maxRate * 100).toFixed(2) : "")}
                              onChange={(e) => setEditingRateMax((p) => ({ ...p, [k]: e.target.value }))}
                              onBlur={() => handleSinRateBlur(row.marketId, row.rateType, row.currentRate)}
                              onKeyDown={(e) => handleKeyDown(e, () => handleSinRateBlur(row.marketId, row.rateType, row.currentRate))}
                              placeholder={(row.currentRate * 100).toFixed(2)}
                              step="any"
                            />
                          </td>
                        </>
                      ) : (
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            className="w-24 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[#00D395]"
                            value={editingRates[k] ?? (rs ? (mode === "linear" ? (rs.endRate ?? rs.startRate) : rs.startRate) * 100 : "").toString()}
                            onChange={(e) => setEditingRates((p) => ({ ...p, [k]: e.target.value }))}
                            onBlur={() => mode === "fixed" ? handleFixedRateBlur(row.marketId, row.rateType, row.currentRate) : handleLinearRateBlur(row.marketId, row.rateType, row.currentRate)}
                            onKeyDown={(e) => handleKeyDown(e, () => mode === "fixed" ? handleFixedRateBlur(row.marketId, row.rateType, row.currentRate) : handleLinearRateBlur(row.marketId, row.rateType, row.currentRate))}
                            placeholder={(row.currentRate * 100).toFixed(2)}
                            step="any"
                          />
                        </td>
                      )}
                      <td className="py-2 px-1 text-center w-8">
                        {isSaved ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 inline-block" />
                        ) : hasScenario ? (
                          <button onClick={() => onRemoveRateScenario(row.marketId, row.rateType)} className="text-gray-300 hover:text-red-400">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">
            {tab === "prices"
              ? `${priceScenarios.length} price scenario${priceScenarios.length !== 1 ? "s" : ""} active`
              : `${rateScenarios.length} rate scenario${rateScenarios.length !== 1 ? "s" : ""} active`}
          </p>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
