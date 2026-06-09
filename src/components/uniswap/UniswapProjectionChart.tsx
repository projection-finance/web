"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
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
import type {
  UniswapSimulationResult,
  UniswapDaySnapshot,
} from "@/src/lib/simulation/uniswap-types";

type ChartTab = "netValue" | "ilVsFees" | "priceRange" | "breakdown";

const UNI_PINK = "#FF007A";
const FEES_GREEN = "#10B981";
const IL_RED = "#EF4444";
const HODL_GRAY = "#9CA3AF";
const RANGE_GREEN = "rgba(16,185,129,0.08)";
const RANGE_RED = "rgba(239,68,68,0.08)";

// Palette for multi-position stacked chart
const POSITION_COLORS = [
  "#FF007A",
  "#8B5CF6",
  "#3B82F6",
  "#F59E0B",
  "#10B981",
  "#EC4899",
];

function formatUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

function formatPrice(v: number): string {
  if (v >= 1_000) return formatUSD(v);
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.001) return v.toFixed(4);
  return v.toFixed(6);
}

interface UniswapProjectionChartProps {
  result: UniswapSimulationResult;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  chartHeight?: number;
}

export default function UniswapProjectionChart({
  result,
  selectedDay,
  onSelectDay,
  chartHeight = 240,
}: UniswapProjectionChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>("netValue");

  const hasMultiplePositions = (result.timeline[0]?.positions.length ?? 0) > 1;

  // ── Net Value / HODL data ──
  const netValueData = useMemo(
    () =>
      result.timeline.map((snap: UniswapDaySnapshot) => ({
        day: snap.day,
        netValue: snap.totalNetValueUSD,
        holdValue: snap.totalHoldValueUSD,
      })),
    [result],
  );

  // ── IL vs Fees data ──
  const ilFeesData = useMemo(
    () =>
      result.timeline.map((snap: UniswapDaySnapshot) => ({
        day: snap.day,
        cumulativeFees: snap.totalFeesUSD,
        ilAbsolute: -Math.abs(snap.totalILAbsolute), // negative for display
      })),
    [result],
  );

  // ── Price & Range data (uses first position's price) ──
  const priceRangeData = useMemo(() => {
    return result.timeline.map((snap: UniswapDaySnapshot) => {
      const pos = snap.positions[0];
      return {
        day: snap.day,
        price: pos?.currentPrice ?? 0,
        priceLower: pos?.priceLower ?? 0,
        priceUpper: pos?.priceUpper ?? 0,
        inRange: pos?.inRange ?? false,
      };
    });
  }, [result]);

  // ── Position Breakdown data ──
  const breakdownData = useMemo(() => {
    if (!hasMultiplePositions) return [];
    return result.timeline.map((snap: UniswapDaySnapshot) => {
      const entry: Record<string, number> = { day: snap.day };
      snap.positions.forEach((pos, i) => {
        entry[`pos${i}`] = pos.netValueUSD;
      });
      return entry;
    });
  }, [result, hasMultiplePositions]);

  const positionLabels = useMemo(() => {
    const first = result.timeline[0];
    if (!first) return [];
    return first.positions.map(
      (p, i) => `${p.token0Symbol}/${p.token1Symbol} #${i + 1}`,
    );
  }, [result]);

  // ── Price domain ──
  const priceDomain = useMemo(() => {
    const prices = priceRangeData.map((d) => d.price);
    const lowers = priceRangeData.map((d) => d.priceLower);
    const uppers = priceRangeData.map((d) => d.priceUpper);
    const all = [...prices, ...lowers, ...uppers].filter((v) => v > 0);
    if (!all.length) return [0, 1];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.1;
    return [Math.max(0, min - pad), max + pad];
  }, [priceRangeData]);

  // ── Break-even day for IL vs Fees ──
  const breakEvenDay = result.summary.breakEvenDay;

  // ── Summary values ──
  const startValue = result.summary.startNetValue;
  const endValue = result.summary.endNetValue;
  const totalFees = result.summary.totalFeesEarned;
  const totalIL = result.summary.totalIL;
  const ilPct =
    startValue > 0 ? (Math.abs(totalIL) / startValue) * 100 : 0;

  const tabs: { key: ChartTab; label: string; hidden?: boolean }[] = [
    { key: "netValue", label: "Net Value" },
    { key: "ilVsFees", label: "IL vs Fees" },
    { key: "priceRange", label: "Price & Range" },
    { key: "breakdown", label: "Position Breakdown", hidden: !hasMultiplePositions },
  ];

  const sharedXAxis = (
    <XAxis
      dataKey="day"
      tick={{ fontSize: 10, fill: "#9CA3AF" }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v: number) => `D${v}`}
    />
  );

  const sharedGrid = (
    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
  );

  const tooltipStyle = {
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "11px",
    padding: "8px 12px",
  };

  const handleChartClick = (e: { activeLabel?: string | number } | null) => {
    if (e?.activeLabel !== undefined) onSelectDay(Number(e.activeLabel));
  };

  // ── Build reference areas for in-range / out-of-range segments ──
  const rangeSegments = useMemo(() => {
    const segs: { x1: number; x2: number; inRange: boolean }[] = [];
    if (!priceRangeData.length) return segs;
    let current = priceRangeData[0].inRange;
    let start = priceRangeData[0].day;
    for (let i = 1; i < priceRangeData.length; i++) {
      if (priceRangeData[i].inRange !== current) {
        segs.push({ x1: start, x2: priceRangeData[i - 1].day, inRange: current });
        current = priceRangeData[i].inRange;
        start = priceRangeData[i].day;
      }
    }
    segs.push({
      x1: start,
      x2: priceRangeData[priceRangeData.length - 1].day,
      inRange: current,
    });
    return segs;
  }, [priceRangeData]);

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Start Value
          </p>
          <p className="text-sm font-bold text-[#303549] mt-0.5">
            ${formatUSD(startValue)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            End Value
          </p>
          <p className="text-sm font-bold text-[#303549] mt-0.5">
            ${formatUSD(endValue)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Total Fees
          </p>
          <p className="text-sm font-bold text-emerald-600 mt-0.5">
            +${formatUSD(totalFees)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Impermanent Loss
          </p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <p
              className={`text-sm font-bold ${
                totalIL >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {totalIL >= 0 ? "+" : "-"}${formatUSD(Math.abs(totalIL))}
            </p>
            <span
              className={`text-[10px] font-medium ${
                totalIL >= 0 ? "text-emerald-500" : "text-red-400"
              }`}
            >
              {ilPct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-0.5 w-fit">
        {tabs
          .filter((t) => !t.hidden)
          .map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-[#303549] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {/* ── Net Value Chart ── */}
      {activeTab === "netValue" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={netValueData} onClick={handleChartClick}>
            <defs>
              <linearGradient id="uni-nv-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={UNI_PINK} stopOpacity={0.15} />
                <stop offset="100%" stopColor={UNI_PINK} stopOpacity={0} />
              </linearGradient>
            </defs>
            {sharedGrid}
            {sharedXAxis}
            <YAxis
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v: number) => `$${formatUSD(v)}`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  netValue: "Net Value",
                  holdValue: "HODL Value",
                };
                return [`$${formatUSD(value)}`, labels[name] || name];
              }}
              labelFormatter={(day) => `Day ${day}`}
            />
            <Area
              type="monotone"
              dataKey="netValue"
              stroke={UNI_PINK}
              strokeWidth={2}
              fill="url(#uni-nv-grad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="holdValue"
              stroke={HODL_GRAY}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 2 }}
            />
            {selectedDay !== null && (
              <ReferenceLine
                x={selectedDay}
                stroke="#303549"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Net Value legend */}
      {activeTab === "netValue" && (
        <div className="flex gap-4 mt-2">
          {[
            { color: UNI_PINK, label: "Net Value" },
            { color: HODL_GRAY, label: "HODL", dashed: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="w-4 h-0.5"
                style={{
                  backgroundColor: item.color,
                  ...(item.dashed
                    ? {
                        backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0, ${item.color} 4px, transparent 4px, transparent 7px)`,
                        backgroundColor: "transparent",
                      }
                    : {}),
                }}
              />
              <span className="text-[10px] text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── IL vs Fees Chart ── */}
      {activeTab === "ilVsFees" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={ilFeesData} onClick={handleChartClick}>
            <defs>
              <linearGradient id="uni-fees-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={FEES_GREEN} stopOpacity={0.15} />
                <stop offset="100%" stopColor={FEES_GREEN} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="uni-il-grad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={IL_RED} stopOpacity={0.15} />
                <stop offset="100%" stopColor={IL_RED} stopOpacity={0} />
              </linearGradient>
            </defs>
            {sharedGrid}
            {sharedXAxis}
            <YAxis
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v: number) => `$${formatUSD(v)}`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  cumulativeFees: "Cumulative Fees",
                  ilAbsolute: "Impermanent Loss",
                };
                return [`$${formatUSD(value)}`, labels[name] || name];
              }}
              labelFormatter={(day) => `Day ${day}`}
            />
            <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
            <Area
              type="monotone"
              dataKey="cumulativeFees"
              stroke={FEES_GREEN}
              strokeWidth={2}
              fill="url(#uni-fees-grad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="ilAbsolute"
              stroke={IL_RED}
              strokeWidth={2}
              fill="url(#uni-il-grad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
            {breakEvenDay !== null && (
              <ReferenceLine
                x={breakEvenDay}
                stroke={FEES_GREEN}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{
                  value: "Break-even",
                  position: "top",
                  fontSize: 10,
                  fill: FEES_GREEN,
                }}
              />
            )}
            {selectedDay !== null && (
              <ReferenceLine
                x={selectedDay}
                stroke="#303549"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* IL vs Fees legend */}
      {activeTab === "ilVsFees" && (
        <div className="flex gap-4 mt-2">
          {[
            { color: FEES_GREEN, label: "Cumulative Fees" },
            { color: IL_RED, label: "Impermanent Loss" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[10px] text-gray-500">{item.label}</span>
            </div>
          ))}
          {breakEvenDay !== null && (
            <span className="text-[10px] text-emerald-600 font-medium">
              Break-even: Day {breakEvenDay}
            </span>
          )}
        </div>
      )}

      {/* ── Price & Range Chart ── */}
      {activeTab === "priceRange" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={priceRangeData} onClick={handleChartClick}>
            {sharedGrid}
            {sharedXAxis}
            <YAxis
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={false}
              width={60}
              domain={priceDomain as [number, number]}
              tickFormatter={(v: number) => formatPrice(v)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  price: "Price",
                  priceLower: "Range Lower",
                  priceUpper: "Range Upper",
                };
                return [formatPrice(value), labels[name] || name];
              }}
              labelFormatter={(day) => `Day ${day}`}
            />
            {/* In-range / out-of-range background segments */}
            {rangeSegments.map((seg, i) => (
              <ReferenceArea
                key={`seg-${i}`}
                x1={seg.x1}
                x2={seg.x2}
                fill={seg.inRange ? RANGE_GREEN : RANGE_RED}
                fillOpacity={1}
                strokeOpacity={0}
              />
            ))}
            {/* Range bounds as dashed lines */}
            {priceRangeData.length > 0 && (
              <>
                <ReferenceLine
                  y={priceRangeData[0].priceLower}
                  stroke={FEES_GREEN}
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{
                    value: `Lower: ${formatPrice(priceRangeData[0].priceLower)}`,
                    position: "right",
                    fontSize: 9,
                    fill: FEES_GREEN,
                  }}
                />
                <ReferenceLine
                  y={priceRangeData[0].priceUpper}
                  stroke={FEES_GREEN}
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{
                    value: `Upper: ${formatPrice(priceRangeData[0].priceUpper)}`,
                    position: "right",
                    fontSize: 9,
                    fill: FEES_GREEN,
                  }}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="price"
              stroke={UNI_PINK}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            {selectedDay !== null && (
              <ReferenceLine
                x={selectedDay}
                stroke="#303549"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Price & Range legend */}
      {activeTab === "priceRange" && (
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: UNI_PINK }} />
            <span className="text-[10px] text-gray-500">Price</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RANGE_GREEN.replace("0.08", "0.3") }} />
            <span className="text-[10px] text-gray-500">In Range</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RANGE_RED.replace("0.08", "0.3") }} />
            <span className="text-[10px] text-gray-500">Out of Range</span>
          </div>
        </div>
      )}

      {/* ── Position Breakdown Chart ── */}
      {activeTab === "breakdown" && hasMultiplePositions && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={breakdownData} onClick={handleChartClick}>
            <defs>
              {positionLabels.map((_, i) => (
                <linearGradient
                  key={`pos-grad-${i}`}
                  id={`uni-pos-grad-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={POSITION_COLORS[i % POSITION_COLORS.length]}
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="100%"
                    stopColor={POSITION_COLORS[i % POSITION_COLORS.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            {sharedGrid}
            {sharedXAxis}
            <YAxis
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v: number) => `$${formatUSD(v)}`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                const idx = parseInt(name.replace("pos", ""), 10);
                const label = positionLabels[idx] ?? name;
                return [`$${formatUSD(value)}`, label];
              }}
              labelFormatter={(day) => `Day ${day}`}
            />
            {positionLabels.map((_, i) => (
              <Area
                key={`pos${i}`}
                type="monotone"
                dataKey={`pos${i}`}
                stackId="positions"
                stroke={POSITION_COLORS[i % POSITION_COLORS.length]}
                strokeWidth={1.5}
                fill={`url(#uni-pos-grad-${i})`}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
            {selectedDay !== null && (
              <ReferenceLine
                x={selectedDay}
                stroke="#303549"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Breakdown legend */}
      {activeTab === "breakdown" && hasMultiplePositions && (
        <div className="flex flex-wrap gap-3 mt-2">
          {positionLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: POSITION_COLORS[i % POSITION_COLORS.length],
                }}
              />
              <span className="text-[10px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Day navigator */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => onSelectDay(Math.max(0, (selectedDay ?? 0) - 1))}
          disabled={selectedDay === 0 || selectedDay === null}
          className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#303549] hover:border-gray-300 transition-colors disabled:opacity-30"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <input
          type="range"
          min={0}
          max={result.timeline.length - 1}
          value={selectedDay ?? 0}
          onChange={(e) => onSelectDay(Number(e.target.value))}
          className="flex-1 h-1"
          style={{ accentColor: UNI_PINK }}
        />
        <button
          onClick={() =>
            onSelectDay(
              Math.min(result.timeline.length - 1, (selectedDay ?? 0) + 1),
            )
          }
          disabled={selectedDay === result.timeline.length - 1}
          className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#303549] hover:border-gray-300 transition-colors disabled:opacity-30"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <span className="text-xs text-gray-400 w-12 text-center">
          Day {selectedDay ?? 0}
        </span>
      </div>
    </div>
  );
}
