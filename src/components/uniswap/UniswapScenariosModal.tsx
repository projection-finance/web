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
import type {
  VolumeScenario,
  UniswapPositionEngineEntry,
} from "@/src/lib/simulation/uniswap-types";

type ScenarioMode = "fixed" | "linear" | "sinusoidal";

const UNI_PINK = "#FF007A";

interface UniswapScenariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  durationDays: number;
  positions: UniswapPositionEngineEntry[];
  priceScenarios: PriceScenario[];
  volumeScenarios: VolumeScenario[];
  onUpdatePriceScenario: (s: PriceScenario) => void;
  onRemovePriceScenario: (symbol: string) => void;
  onUpdateVolumeScenario: (s: VolumeScenario) => void;
  onRemoveVolumeScenario: (poolAddress: string) => void;
}

export default function UniswapScenariosModal({
  isOpen,
  onClose,
  durationDays,
  positions,
  priceScenarios,
  volumeScenarios,
  onUpdatePriceScenario,
  onRemovePriceScenario,
  onUpdateVolumeScenario,
  onRemoveVolumeScenario,
}: UniswapScenariosModalProps) {
  const [tab, setTab] = useState<"prices" | "volume">("prices");
  const [mode, setMode] = useState<ScenarioMode>("fixed");
  const [search, setSearch] = useState("");

  // ── Price editing state ──
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [editingPriceMin, setEditingPriceMin] = useState<Record<string, string>>({});
  const [editingPriceMax, setEditingPriceMax] = useState<Record<string, string>>({});

  // ── Volume editing state ──
  const [editingVolumes, setEditingVolumes] = useState<Record<string, string>>({});
  const [editingVolumeMin, setEditingVolumeMin] = useState<Record<string, string>>({});
  const [editingVolumeMax, setEditingVolumeMax] = useState<Record<string, string>>({});

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

  // ── Unique token symbols from all positions ──
  const uniqueAssets = useMemo(() => {
    const map = new Map<string, { symbol: string; estimatedPrice: number }>();
    for (const pos of positions) {
      if (!map.has(pos.token0Symbol)) {
        const existing = priceScenarios.find((p) => p.symbol === pos.token0Symbol);
        map.set(pos.token0Symbol, {
          symbol: pos.token0Symbol,
          estimatedPrice: existing?.originalPrice ?? existing?.startPrice ?? pos.token0PriceUSD,
        });
      }
      if (!map.has(pos.token1Symbol)) {
        const existing = priceScenarios.find((p) => p.symbol === pos.token1Symbol);
        map.set(pos.token1Symbol, {
          symbol: pos.token1Symbol,
          estimatedPrice: existing?.originalPrice ?? existing?.startPrice ?? pos.token1PriceUSD,
        });
      }
    }
    return [...map.values()];
  }, [positions, priceScenarios]);

  // ── Unique pools for volume tab ──
  const uniquePools = useMemo(() => {
    const map = new Map<
      string,
      {
        poolAddress: string;
        label: string;
        dailyVolumeUSD: number;
        feeTier: number;
      }
    >();
    for (const pos of positions) {
      if (!map.has(pos.poolAddress)) {
        map.set(pos.poolAddress, {
          poolAddress: pos.poolAddress,
          label: `${pos.token0Symbol}/${pos.token1Symbol}`,
          dailyVolumeUSD: pos.dailyVolumeUSD,
          feeTier: pos.feeTier,
        });
      }
    }
    return [...map.values()];
  }, [positions]);

  // ── Filtered lists ──
  const filteredAssets = useMemo(() => {
    if (!search) return uniqueAssets;
    const q = search.toLowerCase();
    return uniqueAssets.filter((a) => a.symbol.toLowerCase().includes(q));
  }, [uniqueAssets, search]);

  const filteredPools = useMemo(() => {
    if (!search) return uniquePools;
    const q = search.toLowerCase();
    return uniquePools.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.poolAddress.toLowerCase().includes(q),
    );
  }, [uniquePools, search]);

  const getPriceScenario = (symbol: string) =>
    priceScenarios.find((s) => s.symbol === symbol);

  const getVolumeScenario = (poolAddress: string) =>
    volumeScenarios.find((s) => s.poolAddress === poolAddress);

  // ── Price handlers ──

  const handleFixedPriceBlur = (symbol: string, currentPrice: number) => {
    const raw = editingPrices[symbol];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingPrices, symbol);
      return;
    }
    if (Math.abs(val - currentPrice) < 0.000001) {
      onRemovePriceScenario(symbol);
    } else {
      onUpdatePriceScenario({
        symbol,
        mode: "fixed",
        startPrice: val,
        originalPrice: currentPrice,
      });
      flashSaved(`price-${symbol}`);
    }
    clearEditing(setEditingPrices, symbol);
  };

  const handleLinearPriceBlur = (symbol: string, currentPrice: number) => {
    const raw = editingPrices[symbol];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingPrices, symbol);
      return;
    }
    if (Math.abs(val - currentPrice) < 0.000001) {
      onRemovePriceScenario(symbol);
    } else {
      onUpdatePriceScenario({
        symbol,
        mode: "linear",
        startPrice: currentPrice,
        endPrice: val,
        originalPrice: currentPrice,
      });
      flashSaved(`price-${symbol}`);
    }
    clearEditing(setEditingPrices, symbol);
  };

  const handleSinPriceBlur = (symbol: string, currentPrice: number) => {
    const rawMin = editingPriceMin[symbol];
    const rawMax = editingPriceMax[symbol];
    if (rawMin === undefined && rawMax === undefined) return;
    const existing = getPriceScenario(symbol);
    const min =
      rawMin !== undefined
        ? parseFloat(rawMin)
        : (existing?.minPrice ?? currentPrice);
    const max =
      rawMax !== undefined
        ? parseFloat(rawMax)
        : (existing?.maxPrice ?? currentPrice);
    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      clearEditing(setEditingPriceMin, symbol);
      clearEditing(setEditingPriceMax, symbol);
      return;
    }
    if (
      Math.abs(min - currentPrice) < 0.000001 &&
      Math.abs(max - currentPrice) < 0.000001
    ) {
      onRemovePriceScenario(symbol);
    } else {
      onUpdatePriceScenario({
        symbol,
        mode: "sinusoidal",
        startPrice: currentPrice,
        minPrice: Math.min(min, max),
        maxPrice: Math.max(min, max),
        cycleDays: durationDays,
        originalPrice: currentPrice,
      });
      flashSaved(`price-${symbol}`);
    }
    clearEditing(setEditingPriceMin, symbol);
    clearEditing(setEditingPriceMax, symbol);
  };

  // ── Volume handlers ──

  const handleFixedVolumeBlur = (poolAddress: string, currentVolume: number) => {
    const raw = editingVolumes[poolAddress];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingVolumes, poolAddress);
      return;
    }
    if (Math.abs(val - currentVolume) < 0.01) {
      onRemoveVolumeScenario(poolAddress);
    } else {
      onUpdateVolumeScenario({
        poolAddress,
        mode: "fixed",
        startVolume: val,
        originalVolume: currentVolume,
      });
      flashSaved(`vol-${poolAddress}`);
    }
    clearEditing(setEditingVolumes, poolAddress);
  };

  const handleLinearVolumeBlur = (
    poolAddress: string,
    currentVolume: number,
  ) => {
    const raw = editingVolumes[poolAddress];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingVolumes, poolAddress);
      return;
    }
    if (Math.abs(val - currentVolume) < 0.01) {
      onRemoveVolumeScenario(poolAddress);
    } else {
      onUpdateVolumeScenario({
        poolAddress,
        mode: "linear",
        startVolume: currentVolume,
        endVolume: val,
        originalVolume: currentVolume,
      });
      flashSaved(`vol-${poolAddress}`);
    }
    clearEditing(setEditingVolumes, poolAddress);
  };

  const handleSinVolumeBlur = (poolAddress: string, currentVolume: number) => {
    const rawMin = editingVolumeMin[poolAddress];
    const rawMax = editingVolumeMax[poolAddress];
    if (rawMin === undefined && rawMax === undefined) return;
    const existing = getVolumeScenario(poolAddress);
    const min =
      rawMin !== undefined
        ? parseFloat(rawMin)
        : (existing?.minVolume ?? currentVolume);
    const max =
      rawMax !== undefined
        ? parseFloat(rawMax)
        : (existing?.maxVolume ?? currentVolume);
    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      clearEditing(setEditingVolumeMin, poolAddress);
      clearEditing(setEditingVolumeMax, poolAddress);
      return;
    }
    if (
      Math.abs(min - currentVolume) < 0.01 &&
      Math.abs(max - currentVolume) < 0.01
    ) {
      onRemoveVolumeScenario(poolAddress);
    } else {
      onUpdateVolumeScenario({
        poolAddress,
        mode: "sinusoidal",
        startVolume: currentVolume,
        minVolume: Math.min(min, max),
        maxVolume: Math.max(min, max),
        cycleDays: durationDays,
        originalVolume: currentVolume,
      });
      flashSaved(`vol-${poolAddress}`);
    }
    clearEditing(setEditingVolumeMin, poolAddress);
    clearEditing(setEditingVolumeMax, poolAddress);
  };

  // ── Bulk apply ──

  const handleBulkApply = () => {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) return;
    const factor = 1 + pct / 100;

    if (tab === "prices") {
      for (const a of uniqueAssets) {
        const current =
          getPriceScenario(a.symbol)?.startPrice ?? a.estimatedPrice;
        onUpdatePriceScenario({
          symbol: a.symbol,
          mode: "fixed",
          startPrice: current * factor,
          originalPrice: a.estimatedPrice,
        });
      }
    } else {
      for (const pool of uniquePools) {
        const existing = getVolumeScenario(pool.poolAddress);
        const current = existing?.startVolume ?? pool.dailyVolumeUSD;
        onUpdateVolumeScenario({
          poolAddress: pool.poolAddress,
          mode: "fixed",
          startVolume: Math.max(0, current * factor),
          originalVolume: pool.dailyVolumeUSD,
        });
      }
    }
    setBulkPct("");
    setBulkOpen(false);
  };

  // ── Key handler ──
  const handleKeyDown = (e: React.KeyboardEvent, onBlur: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onBlur();
    }
    if (e.key === "Escape") {
      (e.target as HTMLInputElement).blur();
    }
  };

  // ── Formatting helpers ──
  const formatVolume = (v: number): string => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  };

  const formatFeeTier = (fee: number): string => {
    return `${(fee * 100).toFixed(2)}%`;
  };

  // ── Mode description ──
  const modeDesc =
    mode === "fixed"
      ? "Set a constant value from today through the projection."
      : mode === "linear"
        ? `Interpolate linearly from current value to target over ${durationDays} days.`
        : `Oscillate between min and max over a full ${durationDays}-day cycle.`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold">
            Price & Volume Scenarios
          </DialogTitle>
        </DialogHeader>

        {/* Tabs + Mode selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Price / Volume tab */}
          <div className="flex gap-0.5 p-0.5 bg-[#F5F5FA] rounded-md">
            {(["prices", "volume"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`text-[11px] font-medium px-3 py-1 rounded transition-colors capitalize ${
                  tab === t
                    ? "bg-white text-[#303549] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "prices" ? "Prices" : "Volume"}
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
                  mode === m
                    ? "bg-white text-[#303549] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {m === "sinusoidal"
                  ? "Wave"
                  : m.charAt(0).toUpperCase() + m.slice(1)}
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
            Bulk{" "}
            {bulkOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
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
            <span className="text-[11px] text-gray-500">
              % to all {tab === "prices" ? "prices" : "volumes"}
            </span>
            <Button
              size="sm"
              className="h-7 text-xs"
              style={{ backgroundColor: UNI_PINK }}
              onClick={handleBulkApply}
              disabled={!bulkPct}
            >
              Apply
            </Button>
          </div>
        )}

        {/* Mode description */}
        <p className="text-[10px] text-gray-400">{modeDesc}</p>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === "prices" ? (
            /* ── PRICES TABLE ── */
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-[10px] font-medium text-gray-400 text-left py-2 px-2">
                    Asset
                  </th>
                  <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                    Current
                  </th>
                  {mode === "sinusoidal" ? (
                    <>
                      <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                        Min
                      </th>
                      <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                        Max
                      </th>
                    </>
                  ) : (
                    <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                      {mode === "fixed"
                        ? "New Price"
                        : `Target (D${durationDays})`}
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
                    <tr
                      key={asset.symbol}
                      className={`border-b border-gray-50 ${hasScenario ? `bg-[${UNI_PINK}]/5` : ""}`}
                    >
                      <td className="py-2 px-2">
                        <span className="text-xs font-semibold text-[#303549]">
                          {asset.symbol}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="text-[11px] text-gray-400">
                          ${currentPrice.toFixed(currentPrice < 1 ? 4 : 2)}
                        </span>
                      </td>
                      {mode === "sinusoidal" ? (
                        <>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              className={`w-20 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[${UNI_PINK}]`}
                              value={
                                editingPriceMin[asset.symbol] ??
                                (ps?.minPrice?.toFixed(2) ?? "")
                              }
                              onChange={(e) =>
                                setEditingPriceMin((p) => ({
                                  ...p,
                                  [asset.symbol]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                handleSinPriceBlur(asset.symbol, currentPrice)
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, () =>
                                  handleSinPriceBlur(asset.symbol, currentPrice),
                                )
                              }
                              placeholder={currentPrice.toFixed(2)}
                              step="any"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              className={`w-20 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[${UNI_PINK}]`}
                              value={
                                editingPriceMax[asset.symbol] ??
                                (ps?.maxPrice?.toFixed(2) ?? "")
                              }
                              onChange={(e) =>
                                setEditingPriceMax((p) => ({
                                  ...p,
                                  [asset.symbol]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                handleSinPriceBlur(asset.symbol, currentPrice)
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, () =>
                                  handleSinPriceBlur(asset.symbol, currentPrice),
                                )
                              }
                              placeholder={currentPrice.toFixed(2)}
                              step="any"
                            />
                          </td>
                        </>
                      ) : (
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            className={`w-24 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[${UNI_PINK}]`}
                            value={
                              editingPrices[asset.symbol] ??
                              (ps
                                ? (mode === "linear"
                                    ? ps.endPrice
                                    : ps.startPrice
                                  )?.toFixed(2)
                                : "")
                            }
                            onChange={(e) =>
                              setEditingPrices((p) => ({
                                ...p,
                                [asset.symbol]: e.target.value,
                              }))
                            }
                            onBlur={() =>
                              mode === "fixed"
                                ? handleFixedPriceBlur(
                                    asset.symbol,
                                    currentPrice,
                                  )
                                : handleLinearPriceBlur(
                                    asset.symbol,
                                    currentPrice,
                                  )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, () =>
                                mode === "fixed"
                                  ? handleFixedPriceBlur(
                                      asset.symbol,
                                      currentPrice,
                                    )
                                  : handleLinearPriceBlur(
                                      asset.symbol,
                                      currentPrice,
                                    ),
                              )
                            }
                            placeholder={currentPrice.toFixed(2)}
                            step="any"
                          />
                        </td>
                      )}
                      <td className="py-2 px-1 text-center w-8">
                        {isSaved ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 inline-block" />
                        ) : hasScenario ? (
                          <button
                            onClick={() =>
                              onRemovePriceScenario(asset.symbol)
                            }
                            className="text-gray-300 hover:text-red-400"
                          >
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
            /* ── VOLUME TABLE ── */
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-[10px] font-medium text-gray-400 text-left py-2 px-2">
                    Pool
                  </th>
                  <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                    Current Daily Vol
                  </th>
                  {mode === "sinusoidal" ? (
                    <>
                      <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                        Min
                      </th>
                      <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                        Max
                      </th>
                    </>
                  ) : (
                    <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">
                      {mode === "fixed"
                        ? "New Volume"
                        : `Target (D${durationDays})`}
                    </th>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredPools.map((pool) => {
                  const vs = getVolumeScenario(pool.poolAddress);
                  const currentVolume = pool.dailyVolumeUSD;
                  const hasScenario = !!vs;
                  const isSaved = savedFlash === `vol-${pool.poolAddress}`;

                  return (
                    <tr
                      key={pool.poolAddress}
                      className={`border-b border-gray-50 ${hasScenario ? `bg-[${UNI_PINK}]/5` : ""}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-[#303549]">
                            {pool.label}
                          </span>
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {formatFeeTier(pool.feeTier)}
                          </span>
                        </div>
                        <div
                          className="text-[9px] text-gray-400 truncate max-w-[200px]"
                          title={pool.poolAddress}
                        >
                          {pool.poolAddress.slice(0, 8)}...
                          {pool.poolAddress.slice(-6)}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="text-[11px] text-gray-400">
                          ${formatVolume(currentVolume)}
                        </span>
                      </td>
                      {mode === "sinusoidal" ? (
                        <>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              className={`w-20 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[${UNI_PINK}]`}
                              value={
                                editingVolumeMin[pool.poolAddress] ??
                                (vs?.minVolume != null
                                  ? formatVolume(vs.minVolume)
                                  : "")
                              }
                              onChange={(e) =>
                                setEditingVolumeMin((p) => ({
                                  ...p,
                                  [pool.poolAddress]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                handleSinVolumeBlur(
                                  pool.poolAddress,
                                  currentVolume,
                                )
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, () =>
                                  handleSinVolumeBlur(
                                    pool.poolAddress,
                                    currentVolume,
                                  ),
                                )
                              }
                              placeholder={formatVolume(currentVolume)}
                              step="any"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              className={`w-20 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[${UNI_PINK}]`}
                              value={
                                editingVolumeMax[pool.poolAddress] ??
                                (vs?.maxVolume != null
                                  ? formatVolume(vs.maxVolume)
                                  : "")
                              }
                              onChange={(e) =>
                                setEditingVolumeMax((p) => ({
                                  ...p,
                                  [pool.poolAddress]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                handleSinVolumeBlur(
                                  pool.poolAddress,
                                  currentVolume,
                                )
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, () =>
                                  handleSinVolumeBlur(
                                    pool.poolAddress,
                                    currentVolume,
                                  ),
                                )
                              }
                              placeholder={formatVolume(currentVolume)}
                              step="any"
                            />
                          </td>
                        </>
                      ) : (
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            className={`w-24 h-7 text-xs text-right border border-gray-200 rounded px-1.5 bg-white focus:outline-none focus:border-[${UNI_PINK}]`}
                            value={
                              editingVolumes[pool.poolAddress] ??
                              (vs
                                ? (mode === "linear"
                                    ? vs.endVolume
                                    : vs.startVolume
                                  )?.toString()
                                : "")
                            }
                            onChange={(e) =>
                              setEditingVolumes((p) => ({
                                ...p,
                                [pool.poolAddress]: e.target.value,
                              }))
                            }
                            onBlur={() =>
                              mode === "fixed"
                                ? handleFixedVolumeBlur(
                                    pool.poolAddress,
                                    currentVolume,
                                  )
                                : handleLinearVolumeBlur(
                                    pool.poolAddress,
                                    currentVolume,
                                  )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, () =>
                                mode === "fixed"
                                  ? handleFixedVolumeBlur(
                                      pool.poolAddress,
                                      currentVolume,
                                    )
                                  : handleLinearVolumeBlur(
                                      pool.poolAddress,
                                      currentVolume,
                                    ),
                              )
                            }
                            placeholder={formatVolume(currentVolume)}
                            step="any"
                          />
                        </td>
                      )}
                      <td className="py-2 px-1 text-center w-8">
                        {isSaved ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 inline-block" />
                        ) : hasScenario ? (
                          <button
                            onClick={() =>
                              onRemoveVolumeScenario(pool.poolAddress)
                            }
                            className="text-gray-300 hover:text-red-400"
                          >
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
              : `${volumeScenarios.length} volume scenario${volumeScenarios.length !== 1 ? "s" : ""} active`}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
