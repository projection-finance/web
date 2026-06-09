"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { Badge } from "@/src/components/ui/badge";
import { TemporalSimulationResult, PriceScenario, RateScenario, ScenarioSet } from "@/src/lib/simulation/types";
import { formatUSD } from "@/src/lib/format";
import { ChevronLeft, ChevronRight, GripVertical, Plus, RotateCcw, Search, Trash2, Undo2, X } from "lucide-react";

export interface TimelineAction {
  day: number;
  label: string;
  type: string;
}

export interface MarketAssetInfo {
  symbol: string;
  priceInUSD: number;
  supplyAPY: number;
  variableBorrowAPY: number;
}

interface ProjectionChartProps {
  result: TemporalSimulationResult;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  timelineActions?: TimelineAction[];
  startDate?: Date;
  priceScenarios?: PriceScenario[];
  rateScenarios?: RateScenario[];
  onRemovePriceScenario?: (symbol: string) => void;
  onRemoveRateScenario?: (symbol: string, rateType: "supply" | "borrow" | "supplyIncentive" | "borrowIncentive") => void;
  onUndoLastAction?: () => void;
  onClearAllActions?: () => void;
  onResetAllScenarios?: () => void;
  scheduledActionsCount?: number;
  allMarketAssets?: MarketAssetInfo[];
  // Multi-scenario overlay
  scenarioResults?: Map<string, TemporalSimulationResult>;
  scenarioSets?: ScenarioSet[];
  activeScenarioSetId?: string;
  onSetActiveScenario?: (id: string) => void;
  chartHeight?: number;
}

type SingleMetricKey = "healthFactor" | "netWorthUSD" | "totalCollateralUSD" | "totalBorrowsUSD";
type MultiMetricKey = "prices" | "supplyAPY" | "borrowAPY";
type MetricKey = SingleMetricKey | MultiMetricKey;

const SINGLE_METRIC_CONFIG: Record<SingleMetricKey, { label: string; color: string; format: (v: number) => string }> = {
  healthFactor: {
    label: "Health Factor",
    color: "#4F7FFA",
    format: (v) => (v > 1e10 || !isFinite(v) ? "\u221e" : v.toFixed(2)),
  },
  netWorthUSD: {
    label: "Net Worth",
    color: "#10B981",
    format: (v) => `$${formatUSD(v)}`,
  },
  totalCollateralUSD: {
    label: "Collateral",
    color: "#1E3A5F",
    format: (v) => `$${formatUSD(v)}`,
  },
  totalBorrowsUSD: {
    label: "Borrows",
    color: "#2C4F7C",
    format: (v) => `$${formatUSD(v)}`,
  },
};

const MULTI_METRIC_CONFIG: Record<MultiMetricKey, { label: string }> = {
  prices: { label: "Prices" },
  supplyAPY: { label: "Supply APY" },
  borrowAPY: { label: "Borrow APY" },
};

const TOKEN_COLORS = ["#4F7FFA", "#10B981", "#1E3A5F", "#EF4444", "#2C4F7C", "#3B82F6", "#14B8A6", "#0F172A"];

/** Max badges shown inline per day before collapsing */
const MAX_BADGES_PER_DAY = 3;

const ACTION_COLORS: Record<string, string> = {
  supply: "bg-green-100 text-green-700 border-green-300",
  borrow: "bg-sky-100 text-sky-700 border-sky-300",
  withdraw: "bg-red-100 text-red-700 border-red-300",
  repay: "bg-blue-100 text-blue-700 border-blue-300",
  set_emode: "bg-purple-100 text-purple-700 border-purple-300",
  price_change: "bg-blue-50 text-blue-800 border-blue-300",
  rate_change: "bg-slate-100 text-slate-700 border-slate-300",
  toggle_collateral: "bg-slate-100 text-slate-700 border-slate-300",
};

function isSingleMetric(key: MetricKey): key is SingleMetricKey {
  return key in SINGLE_METRIC_CONFIG;
}

/** Convert a day offset to a formatted date string */
function dayToDate(day: number, start: Date): string {
  const d = new Date(start);
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ProjectionChart: React.FC<ProjectionChartProps> = ({
  result,
  selectedDay,
  onSelectDay,
  timelineActions,
  startDate,
  priceScenarios,
  rateScenarios,
  onRemovePriceScenario,
  onRemoveRateScenario,
  onUndoLastAction,
  onClearAllActions,
  onResetAllScenarios,
  scheduledActionsCount = 0,
  allMarketAssets,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  scenarioResults,
  scenarioSets,
  activeScenarioSetId,
  onSetActiveScenario,
  chartHeight = 170,
}) => {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("healthFactor");
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [extraTokens, setExtraTokens] = useState<Set<string>>(new Set());
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Tracks which day-group detail popover is open: "scenario-3" or "action-0"
  const [expandedBadgeGroup, setExpandedBadgeGroup] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const maxDay = result.timeline.length - 1;
  const origin = useMemo(() => startDate ?? new Date(), [startDate]);

  // Actual user-position tokens (supply / borrow) — NOT scenario-only tokens
  const positionTokens = useMemo(() => {
    const day0 = result.timeline[0];
    if (!day0) return new Set<string>();
    const syms = new Set<string>();
    for (const s of day0.supplies) { if (s.balance > 0) syms.add(s.symbol); }
    for (const b of day0.borrows) { if (b.debt > 0) syms.add(b.symbol); }
    return syms;
  }, [result.timeline]);

  // All tokens present in timeline data (positions + scenarios)
  const userTokens = useMemo(() => {
    const day0 = result.timeline[0];
    if (!day0) return { prices: [] as string[], rates: [] as string[] };
    return {
      prices: [...new Set(day0.prices.map((p) => p.symbol))],
      rates: [...new Set(day0.rates.map((r) => r.symbol))],
    };
  }, [result.timeline]);

  // All market symbols
  const allMarketSymbols = useMemo(
    () => (allMarketAssets ?? []).map((a) => a.symbol),
    [allMarketAssets]
  );

  // Static data lookup for market assets not in timeline
  const marketAssetMap = useMemo(() => {
    const map = new Map<string, MarketAssetInfo>();
    for (const a of allMarketAssets ?? []) {
      map.set(a.symbol, a);
    }
    return map;
  }, [allMarketAssets]);

  // Visible tokens = user tokens + extra tokens added by search
  const visibleTokens = useMemo((): Record<MultiMetricKey, string[]> => {
    const build = (userList: string[]) => {
      const set = new Set(userList);
      for (const t of extraTokens) set.add(t);
      return [...set];
    };
    return {
      prices: build(userTokens.prices),
      supplyAPY: build(userTokens.rates),
      borrowAPY: build(userTokens.rates),
    };
  }, [userTokens, extraTokens]);

  // Currently active (selected) tokens for chart rendering
  const currentTokens = useMemo(() => {
    if (isSingleMetric(activeMetric)) return [];
    const visible = visibleTokens[activeMetric];
    if (selectedTokens.size === 0 && visible.length > 0) return visible;
    return visible.filter((t) => selectedTokens.has(t));
  }, [activeMetric, visibleTokens, selectedTokens]);

  const handleMetricChange = (key: MetricKey) => {
    setActiveMetric(key);
    if (!isSingleMetric(key)) {
      // Only auto-select user-position tokens, not scenario-only tokens
      setSelectedTokens(new Set(positionTokens));
    }
  };

  const toggleToken = (symbol: string) => {
    setSelectedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  // Double-click = solo this token only
  const soloToken = (symbol: string) => {
    setSelectedTokens(new Set([symbol]));
  };

  // "All" = select only user-position tokens (supply/borrow)
  const selectUserTokens = () => {
    if (!isSingleMetric(activeMetric)) {
      setSelectedTokens(new Set(positionTokens));
    }
  };

  // Add a single token from the search
  const addToken = (symbol: string) => {
    setExtraTokens((prev) => new Set(prev).add(symbol));
    setSelectedTokens((prev) => new Set(prev).add(symbol));
    setSearchOpen(false);
    setSearchQuery("");
  };

  // Remove an extra token
  const removeExtraToken = (symbol: string) => {
    setExtraTokens((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
    setSelectedTokens((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
  };

  // Searchable tokens = all market tokens not already in visible list
  const searchableTokens = useMemo(() => {
    if (isSingleMetric(activeMetric)) return [];
    const visible = new Set(visibleTokens[activeMetric]);
    return allMarketSymbols
      .filter((s) => !visible.has(s))
      .filter((s) => !searchQuery || s.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [activeMetric, visibleTokens, allMarketSymbols, searchQuery]);

  const isAllUserSelected = useMemo(() => {
    if (isSingleMetric(activeMetric)) return false;
    return positionTokens.size > 0 && [...positionTokens].every((t) => selectedTokens.has(t));
  }, [activeMetric, positionTokens, selectedTokens]);

  // Build chart data with dynamic keys for prices and rates
  // For extra tokens not in timeline, inject flat-line static data
  const chartData = useMemo(() => {
    return result.timeline.map((snap) => {
      const row: Record<string, number | null> = {
        day: snap.day,
        healthFactor: snap.healthFactor > 1e10 || !isFinite(snap.healthFactor)
          ? null
          : snap.healthFactor,
        netWorthUSD: snap.netWorthUSD,
        totalCollateralUSD: snap.totalCollateralUSD,
        totalBorrowsUSD: snap.totalBorrowsUSD,
      };

      // Add per-token prices from engine
      const priceSet = new Set<string>();
      for (const p of snap.prices) {
        row[`price_${p.symbol}`] = p.priceUSD;
        priceSet.add(p.symbol);
      }

      // Add per-token rates from engine
      const rateSet = new Set<string>();
      for (const r of snap.rates) {
        row[`supplyAPY_${r.symbol}`] = r.supplyAPY * 100;
        row[`borrowAPY_${r.symbol}`] = r.variableBorrowAPY * 100;
        rateSet.add(r.symbol);
      }

      // Inject static data for extra tokens not in the engine timeline
      for (const sym of extraTokens) {
        const asset = marketAssetMap.get(sym);
        if (!asset) continue;
        if (!priceSet.has(sym)) {
          row[`price_${sym}`] = asset.priceInUSD;
        }
        if (!rateSet.has(sym)) {
          row[`supplyAPY_${sym}`] = asset.supplyAPY * 100;
          row[`borrowAPY_${sym}`] = asset.variableBorrowAPY * 100;
        }
      }

      return row;
    });
  }, [result.timeline, extraTokens, marketAssetMap]);

  // Find days with actions for markers
  const actionDays = useMemo(
    () => result.timeline.filter((s) => s.actionsExecuted.length > 0).map((s) => s.day),
    [result.timeline]
  );

  // Unique days that have user-defined actions (from timelineActions prop)
  const userActionDays = useMemo(
    () => [...new Set((timelineActions ?? []).map((a) => a.day))],
    [timelineActions]
  );

  // Group timeline actions by day for badge display — separate actions from scenarios
  const { actionsByDay } = useMemo(() => {
    const actions = new Map<number, TimelineAction[]>();
    for (const a of timelineActions ?? []) {
      const isScenario = a.type === "price_change" || a.type === "rate_change";
      if (isScenario) continue;
      const list = actions.get(a.day) ?? [];
      list.push(a);
      actions.set(a.day, list);
    }
    return { actionsByDay: actions };
  }, [timelineActions]);

  // Agenda: all days with events (actions + scenarios), merged and sorted
  type AgendaEvent = { label: string; colorClass: string };
  const agendaDays = useMemo(() => {
    const map = new Map<number, AgendaEvent[]>();

    // Actions
    for (const a of timelineActions ?? []) {
      const isScenario = a.type === "price_change" || a.type === "rate_change";
      if (isScenario) continue;
      const list = map.get(a.day) ?? [];
      list.push({
        label: a.label,
        colorClass: ACTION_COLORS[a.type] ?? "bg-gray-100 text-gray-700 border-gray-300",
      });
      map.set(a.day, list);
    }

    // Price scenarios — show at the day the target price is first reached
    const lastDay = result.timeline.length > 0 ? result.timeline[result.timeline.length - 1].day : 0;
    for (const s of priceScenarios ?? []) {
      const targetPrice = s.endPrice ?? s.startPrice;
      const manualTargetDay = s.manualPrices?.findIndex((p) => Math.abs(p - targetPrice) < 0.01);
      const day = s.mode === "manual" && manualTargetDay && manualTargetDay > 0
        ? manualTargetDay
        : s.mode === "linear"
        ? lastDay
        : (s.fromDay ?? 0);
      const list = map.get(day) ?? [];
      list.push({
        label: `${s.symbol} → $${formatUSD(targetPrice)}`,
        colorClass: "bg-blue-50 text-blue-800 border-blue-300",
      });
      map.set(day, list);
    }

    // Rate scenarios
    for (const s of rateScenarios ?? []) {
      const day = s.fromDay ?? 0;
      const list = map.get(day) ?? [];
      list.push({
        label: `${s.symbol} ${s.rateType} ${(s.startRate * 100).toFixed(1)}%`,
        colorClass: "bg-slate-100 text-slate-700 border-slate-300",
      });
      map.set(day, list);
    }

    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [timelineActions, priceScenarios, rateScenarios]);

  // Scenario marker days for reference lines
  const scenarioDays = useMemo(() => {
    const days = new Set<number>();
    for (const s of priceScenarios ?? []) days.add(s.fromDay ?? 0);
    for (const s of rateScenarios ?? []) days.add(s.fromDay ?? 0);
    return [...days];
  }, [priceScenarios, rateScenarios]);

  // For health factor, find range where HF < 1
  const dangerZones = useMemo(() => {
    if (activeMetric !== "healthFactor") return [];
    const zones: { start: number; end: number }[] = [];
    let inDanger = false;
    let start = 0;
    for (const snap of result.timeline) {
      const hf = snap.healthFactor;
      if (isFinite(hf) && hf < 0.95) {
        if (!inDanger) { start = snap.day; inDanger = true; }
      } else {
        if (inDanger) { zones.push({ start, end: snap.day }); inDanger = false; }
      }
    }
    if (inDanger) zones.push({ start, end: result.timeline[result.timeline.length - 1].day });
    return zones;
  }, [activeMetric, result.timeline]);

  // Selected day snapshot for quick stats
  const selectedSnap = selectedDay !== null ? result.timeline[selectedDay] : null;

  // Y-axis formatter
  const yAxisFormatter = (v: number) => {
    if (activeMetric === "healthFactor") return v.toFixed(1);
    if (activeMetric === "prices") return `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`;
    if (activeMetric === "supplyAPY" || activeMetric === "borrowAPY") return `${v.toFixed(1)}%`;
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return v.toFixed(0);
  };

  // Tooltip formatter
  const tooltipFormatter = (value: number, name: string) => {
    if (activeMetric === "prices") {
      return [`$${formatUSD(value)}`, name.replace("price_", "")];
    }
    if (activeMetric === "supplyAPY") {
      return [`${value.toFixed(2)}%`, `${name.replace("supplyAPY_", "")} Supply`];
    }
    if (activeMetric === "borrowAPY") {
      return [`${value.toFixed(2)}%`, `${name.replace("borrowAPY_", "")} Borrow`];
    }
    const cfg = SINGLE_METRIC_CONFIG[activeMetric as SingleMetricKey];
    return [cfg.format(value ?? 0), cfg.label];
  };

  const dataKeyPrefix = activeMetric === "prices" ? "price_" : activeMetric === "supplyAPY" ? "supplyAPY_" : activeMetric === "borrowAPY" ? "borrowAPY_" : "";

  return (
    <div className="space-y-2">
      {/* Top bar: metric selector + selected day badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(SINGLE_METRIC_CONFIG) as SingleMetricKey[]).map((key) => (
            <Badge
              key={key}
              className={`text-[11px] cursor-pointer px-2 py-0.5 ${
                activeMetric === key
                  ? "bg-[#5382E3] text-white hover:bg-[#4371D0]"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              onClick={() => handleMetricChange(key)}
            >
              {SINGLE_METRIC_CONFIG[key].label}
            </Badge>
          ))}

          <span className="text-slate-300 mx-0.5">|</span>

          {(Object.keys(MULTI_METRIC_CONFIG) as MultiMetricKey[]).map((key) => (
            <Badge
              key={key}
              className={`text-[11px] cursor-pointer px-2 py-0.5 ${
                activeMetric === key
                  ? "bg-[#5382E3] text-white hover:bg-[#4371D0]"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              onClick={() => handleMetricChange(key)}
            >
              {MULTI_METRIC_CONFIG[key].label}
            </Badge>
          ))}
        </div>

        {selectedSnap && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-400">
              NW <span className="font-semibold text-[#303549]">${formatUSD(selectedSnap.netWorthUSD)}</span>
            </span>
            <span className="text-gray-400">
              HF <span className={`font-semibold ${
                !isFinite(selectedSnap.healthFactor) || selectedSnap.healthFactor > 1e10
                  ? "text-green-600"
                  : selectedSnap.healthFactor < 0.95 ? "text-red-600"
                  : selectedSnap.healthFactor < 1 ? "text-red-500"
                  : selectedSnap.healthFactor < 1.1 ? "text-blue-800" : "text-green-600"
              }`}>
                {!isFinite(selectedSnap.healthFactor) || selectedSnap.healthFactor > 1e10
                  ? "\u221e" : selectedSnap.healthFactor.toFixed(2)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Scenario set legend */}
      {scenarioSets && scenarioSets.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {scenarioSets.map((set) => {
            const isActive = set.id === (activeScenarioSetId ?? scenarioSets[0]?.id);
            const clickable = !!onSetActiveScenario;
            return (
              <button
                key={set.id}
                type="button"
                className={`inline-flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5 transition-colors ${
                  isActive
                    ? "font-semibold text-[#303549] bg-slate-200"
                    : clickable
                    ? "text-gray-400 hover:bg-slate-100 hover:text-gray-600 cursor-pointer"
                    : "text-gray-400"
                }`}
                onClick={() => onSetActiveScenario?.(set.id)}
                disabled={!clickable}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: set.color }}
                />
                {set.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Token sub-selector for multi-metric modes */}
      {!isSingleMetric(activeMetric) && (
        <div className="flex items-center gap-1 flex-wrap">
          {/* "All" = user-position tokens only */}
          <Badge
            className={`text-[10px] cursor-pointer px-1.5 py-0.5 ${
              isAllUserSelected
                ? "bg-[#303549] text-white hover:bg-[#404560]"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            onClick={selectUserTokens}
          >
            All
          </Badge>

          <span className="text-slate-200 mx-0.5">|</span>

          {/* Individual token pills — click to toggle, double-click to solo */}
          {visibleTokens[activeMetric].map((symbol, idx) => {
            const isExtra = extraTokens.has(symbol);
            const isActive = currentTokens.includes(symbol);
            return (
              <span key={symbol} className="inline-flex items-center">
                <Badge
                  className={`text-[10px] cursor-pointer px-1.5 py-0.5 select-none ${
                    isActive
                      ? "text-white hover:opacity-80"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  style={isActive ? { backgroundColor: TOKEN_COLORS[idx % TOKEN_COLORS.length] } : undefined}
                  title="Click to toggle \u2022 Double-click to solo"
                  onClick={() => toggleToken(symbol)}
                  onDoubleClick={() => soloToken(symbol)}
                >
                  {symbol}
                </Badge>
                {isExtra && (
                  <button
                    className="text-slate-400 hover:text-red-500 transition-colors ml-[-2px]"
                    onClick={() => removeExtraToken(symbol)}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            );
          })}

          {/* Add token button + dropdown */}
          {allMarketSymbols.length > 0 && (
            <div className="relative" ref={searchRef}>
              <Badge
                className="text-[10px] cursor-pointer px-1.5 py-0.5 bg-slate-100 text-slate-500 hover:bg-slate-200 gap-0.5"
                onClick={() => { setSearchOpen((v) => !v); setSearchQuery(""); }}
              >
                <Plus className="w-2.5 h-2.5" />
              </Badge>

              {searchOpen && (
                <div className="absolute bottom-full mb-1 left-0 z-50 bg-white border border-slate-200 rounded-lg w-48">
                  <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100">
                    <Search className="w-3 h-3 text-slate-400" />
                    <input
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search token..."
                      className="text-xs flex-1 outline-none bg-transparent"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }
                      }}
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {searchableTokens.length > 0 ? (
                      searchableTokens.slice(0, 20).map((sym) => (
                        <button
                          key={sym}
                          className="w-full text-left text-xs px-3 py-1.5 hover:bg-slate-50 transition-colors"
                          onClick={() => addToken(sym)}
                        >
                          {sym}
                          <span className="text-slate-400 ml-1">
                            ${formatUSD(marketAssetMap.get(sym)?.priceInUSD ?? 0)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-400 px-3 py-2">No tokens found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div style={{ width: "100%", height: chartHeight }} className="cursor-col-resize">
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            onClick={(e) => {
              if (e?.activePayload?.[0]) onSelectDay(e.activePayload[0].payload.day);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
              tickFormatter={(day) => dayToDate(day, origin)}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
              tickFormatter={yAxisFormatter}
            />
            <Tooltip
              formatter={tooltipFormatter}
              labelFormatter={(day) => `${dayToDate(Number(day), origin)} (Day ${day})`}
              contentStyle={{ fontSize: 12 }}
            />

            {dangerZones.map((zone, idx) => (
              <ReferenceArea key={idx} x1={zone.start} x2={zone.end} fill="#FEE2E2" fillOpacity={0.5} />
            ))}

            {activeMetric === "healthFactor" && (
              <ReferenceLine
                y={1}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{ value: "Liquidation", position: "right", fontSize: 10, fill: "#EF4444" }}
              />
            )}

            {result.summary.liquidationOccurred && result.summary.liquidationDay !== undefined && (
              <ReferenceLine
                x={result.summary.liquidationDay}
                stroke="#EF4444"
                strokeWidth={3}
                strokeOpacity={0.8}
                label={{ value: `Liquidation D${result.summary.liquidationDay}`, position: "top", fontSize: 10, fontWeight: 700, fill: "#EF4444" }}
              />
            )}

            {scenarioDays.map((d) => (
              <ReferenceLine key={`scenario-${d}`} x={d} stroke="#1E3A5F" strokeWidth={1.5} strokeDasharray="6 3" strokeOpacity={0.6} />
            ))}

            {userActionDays.map((d) => (
              <ReferenceLine key={`user-action-${d}`} x={d} stroke="#2C4F7C" strokeWidth={2} strokeDasharray="4 2" />
            ))}

            {actionDays
              .filter((d) => !userActionDays.includes(d))
              .map((d) => (
                <ReferenceLine key={`action-${d}`} x={d} stroke="#1E3A5F" strokeDasharray="2 2" strokeOpacity={0.5} />
              ))}

            {selectedDay !== null && (
              <ReferenceLine
                x={selectedDay}
                stroke="#4F7FFA"
                strokeWidth={2}
                label={{ value: dayToDate(selectedDay, origin), position: "top", fontSize: 10, fontWeight: 600, fill: "#4F7FFA" }}
              />
            )}

            {isSingleMetric(activeMetric) && (
              <Line
                type="monotone"
                dataKey={activeMetric}
                stroke={SINGLE_METRIC_CONFIG[activeMetric].color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            )}

            {!isSingleMetric(activeMetric) && currentTokens.map((symbol, idx) => (
              <Line
                key={`${dataKeyPrefix}${symbol}`}
                type="monotone"
                dataKey={`${dataKeyPrefix}${symbol}`}
                stroke={TOKEN_COLORS[idx % TOKEN_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name={`${dataKeyPrefix}${symbol}`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario badges for current day only — collapsed when too many */}
      {(() => {
        const currentDay = selectedDay ?? 0;
        type ScenarioItem = { type: "price" | "rate"; label: string; symbol: string; rateType?: "supply" | "borrow" | "supplyIncentive" | "borrowIncentive" };
        const items: ScenarioItem[] = [];
        for (const s of priceScenarios ?? []) {
          const tp = s.endPrice ?? s.startPrice;
          const manualDay = s.manualPrices?.findIndex((p) => Math.abs(p - tp) < 0.01);
          const td = result.timeline.length > 0 ? result.timeline[result.timeline.length - 1].day : 0;
          const displayDay = s.mode === "manual" && manualDay && manualDay > 0
            ? manualDay
            : s.mode === "linear" ? td : (s.fromDay ?? 0);
          if (displayDay === currentDay) {
            items.push({ type: "price", label: `${s.symbol} → $${formatUSD(tp)}`, symbol: s.symbol });
          }
        }
        for (const s of rateScenarios ?? []) {
          if ((s.fromDay ?? 0) === currentDay) {
            items.push({ type: "rate", label: `${s.symbol} ${s.rateType} ${(s.startRate * 100).toFixed(1)}%`, symbol: s.symbol, rateType: s.rateType });
          }
        }
        if (items.length === 0) return null;

        const groupKey = `scenario-${currentDay}`;
        const isExpanded = expandedBadgeGroup === groupKey;
        const needsCollapse = items.length > MAX_BADGES_PER_DAY;
        const visible = needsCollapse && !isExpanded ? items.slice(0, MAX_BADGES_PER_DAY) : items;
        const hiddenCount = items.length - MAX_BADGES_PER_DAY;

        const clearAllForDay = () => {
          for (const item of items) {
            if (item.type === "price") onRemovePriceScenario?.(item.symbol);
            else onRemoveRateScenario?.(item.symbol, item.rateType!);
          }
          setExpandedBadgeGroup(null);
        };

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 mr-0.5 min-w-[50px]">{dayToDate(currentDay, origin)}:</span>
            {visible.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-0.5">
                <button
                  className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 transition-opacity ${
                    item.type === "price"
                      ? "bg-blue-50 text-blue-800 border-blue-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}
                >
                  {item.label}
                </button>
                <button
                  className="text-[10px] text-red-400 hover:text-red-600 transition-colors px-0.5"
                  onClick={() => {
                    if (item.type === "price") onRemovePriceScenario?.(item.symbol);
                    else onRemoveRateScenario?.(item.symbol, item.rateType!);
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {needsCollapse && !isExpanded && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 transition-colors"
                title="Click to see all scenarios"
                onClick={() => setExpandedBadgeGroup(groupKey)}
              >
                +{hiddenCount} more...
              </button>
            )}
            {needsCollapse && isExpanded && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 transition-colors"
                onClick={() => setExpandedBadgeGroup(null)}
              >
                Show less
              </button>
            )}
            {items.length > 1 && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer bg-red-50 text-red-500 border-red-200 hover:bg-red-100 transition-colors"
                title="Remove all scenarios for this day"
                onClick={clearAllForDay}
              >
                Clear all
              </button>
            )}
          </div>
        );
      })()}

      {/* Action badges for current day only — collapsed when too many */}
      {(() => {
        const currentDay = selectedDay ?? 0;
        const actions = actionsByDay.get(currentDay);
        if (!actions || actions.length === 0) return null;

        const groupKey = `action-${currentDay}`;
        const isExpanded = expandedBadgeGroup === groupKey;
        const needsCollapse = actions.length > MAX_BADGES_PER_DAY;
        const visible = needsCollapse && !isExpanded ? actions.slice(0, MAX_BADGES_PER_DAY) : actions;
        const hiddenCount = actions.length - MAX_BADGES_PER_DAY;

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 mr-0.5 min-w-[50px]">{dayToDate(currentDay, origin)}:</span>
            {visible.map((action, idx) => (
              <button
                key={idx}
                className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 transition-opacity ${
                  ACTION_COLORS[action.type] ?? "bg-gray-100 text-gray-700 border-gray-300"
                }`}
              >
                {action.label}
              </button>
            ))}
            {needsCollapse && !isExpanded && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 transition-colors"
                title="Click to see all actions"
                onClick={() => setExpandedBadgeGroup(groupKey)}
              >
                +{hiddenCount} more...
              </button>
            )}
            {needsCollapse && isExpanded && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded border cursor-pointer bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 transition-colors"
                onClick={() => setExpandedBadgeGroup(null)}
              >
                Show less
              </button>
            )}
          </div>
        );
      })()}

      {/* Agenda strip — all days with events */}
      {agendaDays.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
          {agendaDays.map(([day, events]) => {
            const isSelected = (selectedDay ?? 0) === day;
            const MAX_AGENDA_BADGES = 2;
            const shown = events.slice(0, MAX_AGENDA_BADGES);
            const overflow = events.length - MAX_AGENDA_BADGES;
            return (
              <button
                key={`agenda-${day}`}
                className={`flex-shrink-0 flex flex-col items-start gap-0.5 px-2 py-1 rounded-md border cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#4F7FFA]/10 border-[#4F7FFA] ring-1 ring-[#4F7FFA]/30"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
                onClick={() => onSelectDay(day)}
              >
                <span className={`text-[9px] font-semibold ${isSelected ? "text-[#4F7FFA]" : "text-slate-500"}`}>
                  {dayToDate(day, origin)} <span className="font-normal opacity-60">D{day}</span>
                </span>
                {shown.map((evt, idx) => (
                  <span
                    key={idx}
                    className={`text-[9px] leading-tight px-1 py-px rounded border truncate max-w-[120px] ${evt.colorClass}`}
                  >
                    {evt.label}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="text-[9px] text-slate-400">+{overflow} more</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Quick controls */}
      {(scheduledActionsCount > 0 || (priceScenarios && priceScenarios.length > 0) || (rateScenarios && rateScenarios.length > 0)) && (
        <div className="flex items-center gap-1.5 text-[10px]">
          {scheduledActionsCount > 0 && (
            <>
              {!confirmUndo ? (
                <button
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Undo last scheduled action"
                  onClick={() => setConfirmUndo(true)}
                >
                  <Undo2 className="w-2.5 h-2.5" />
                  Undo last
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  onClick={() => { onUndoLastAction?.(); setConfirmUndo(false); }}
                  onBlur={() => setConfirmUndo(false)}
                  autoFocus
                >
                  <Undo2 className="w-2.5 h-2.5" />
                  Confirm?
                </button>
              )}
              <button
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                title="Remove all scheduled actions"
                onClick={() => onClearAllActions?.()}
              >
                <Trash2 className="w-2.5 h-2.5" />
                Clear actions ({scheduledActionsCount})
              </button>
            </>
          )}
          {((priceScenarios && priceScenarios.length > 0) || (rateScenarios && rateScenarios.length > 0)) && (
            <button
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              title="Reset all prices &amp; rates to original market values"
              onClick={() => onResetAllScenarios?.()}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Reset prices &amp; rates
            </button>
          )}
        </div>
      )}

      {/* Day navigator */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
        <button
          onClick={() => onSelectDay(Math.max(0, (selectedDay ?? 0) - 1))}
          className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="bg-[#4F7FFA] text-white text-[11px] font-semibold px-2.5 py-0.5 rounded min-w-[80px] text-center">
          {dayToDate(selectedDay ?? 0, origin)}
          <span className="opacity-70 ml-1">D{selectedDay ?? 0}</span>
        </div>

        <input
          type="range"
          min={0}
          max={maxDay}
          value={selectedDay ?? 0}
          onChange={(e) => onSelectDay(parseInt(e.target.value))}
          className="flex-1 h-1 accent-[#4F7FFA] cursor-pointer"
        />

        <span className="text-[10px] text-gray-400 whitespace-nowrap">{dayToDate(maxDay, origin)}</span>

        <button
          onClick={() => onSelectDay(Math.min(maxDay, (selectedDay ?? 0) + 1))}
          className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="border-l border-slate-200 pl-2 ml-1">
          <GripVertical className="w-3.5 h-3.5 text-slate-300" />
        </div>
        <span className="text-[10px] text-slate-400 hidden sm:inline">Click chart or drag slider</span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="p-1.5 bg-white border border-slate-200 rounded">
          <p className="text-[10px] text-gray-400">Start Net Worth</p>
          <p className="text-xs font-semibold">${formatUSD(result.summary.startNetWorth)}</p>
        </div>
        <div className="p-1.5 bg-white border border-slate-200 rounded">
          <p className="text-[10px] text-gray-400">End Net Worth</p>
          <p className="text-xs font-semibold">${formatUSD(result.summary.endNetWorth)}</p>
        </div>
        <div className="p-1.5 bg-white border border-slate-200 rounded">
          <p className="text-[10px] text-gray-400">Lowest HF</p>
          <p className={`text-xs font-semibold ${result.summary.lowestHealthFactor < 1.1 && isFinite(result.summary.lowestHealthFactor) ? "text-red-500" : ""}`}>
            {!isFinite(result.summary.lowestHealthFactor) ? "\u221e" : result.summary.lowestHealthFactor.toFixed(2)}
            {isFinite(result.summary.lowestHealthFactor) && (
              <span className="text-[10px] text-gray-400 ml-1">({dayToDate(result.summary.lowestHealthFactorDay, origin)})</span>
            )}
          </p>
        </div>
        <div className="p-1.5 bg-white border border-slate-200 rounded">
          <p className="text-[10px] text-gray-400">Liquidation</p>
          <p className={`text-xs font-semibold ${result.summary.liquidationOccurred ? "text-red-500" : "text-green-600"}`}>
            {result.summary.liquidationOccurred ? dayToDate(result.summary.liquidationDay!, origin) : "None"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProjectionChart;
