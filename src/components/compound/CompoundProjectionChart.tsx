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
  CompoundSimulationResult,
  CompoundDaySnapshot,
} from "@/src/lib/simulation/compound-types";

type ChartTab = "netWorth" | "healthFactor" | "supplyBorrow";

const COMPOUND_GREEN = "#00D395";
const HF_DANGER = "#EF4444";
const SUPPLY_COLOR = "#00D395";
const BORROW_COLOR = "#EF4444";
const COLLATERAL_COLOR = "#3B82F6";

function formatUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

interface CompoundProjectionChartProps {
  result: CompoundSimulationResult;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  chartHeight?: number;
}

export default function CompoundProjectionChart({
  result,
  selectedDay,
  onSelectDay,
  chartHeight = 240,
}: CompoundProjectionChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>("netWorth");

  const chartData = useMemo(() => {
    return result.timeline.map((snap: CompoundDaySnapshot) => ({
      day: snap.day,
      netWorth: snap.netWorthUSD,
      totalSupply: snap.totalSupplyUSD,
      totalBorrow: snap.totalBorrowUSD,
      totalCollateral: snap.totalCollateralUSD,
      healthFactor: snap.lowestHealthFactor === Infinity ? 10 : snap.lowestHealthFactor,
    }));
  }, [result]);

  const startNetWorth = result.timeline[0]?.netWorthUSD ?? 0;

  const hfMin = useMemo(() => {
    const vals = chartData.map((d) => d.healthFactor).filter((v) => v > 0);
    return vals.length ? Math.min(...vals) : 0;
  }, [chartData]);

  const hfMax = useMemo(() => {
    const vals = chartData.map((d) => d.healthFactor);
    return vals.length ? Math.max(...vals) : 5;
  }, [chartData]);

  const tabs: { key: ChartTab; label: string }[] = [
    { key: "netWorth", label: "Net Worth" },
    { key: "healthFactor", label: "Health Factor" },
    { key: "supplyBorrow", label: "Supply vs Borrow" },
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

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Start</p>
          <p className="text-sm font-bold text-[#303549] mt-0.5">${formatUSD(result.summary.startNetWorth)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">End</p>
          <p className="text-sm font-bold text-[#303549] mt-0.5">${formatUSD(result.summary.endNetWorth)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">PnL</p>
          {(() => {
            const pnl = (result.summary.endNetWorth ?? 0) - (result.summary.startNetWorth ?? 0);
            const pnlPct = (result.summary.startNetWorth ?? 0) > 0
              ? (pnl / result.summary.startNetWorth) * 100
              : 0;
            return (
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <p className={`text-sm font-bold ${pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {pnl >= 0 ? "+" : ""}${formatUSD(pnl)}
                </p>
                <span className={`text-[10px] font-medium ${pnl >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                  {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                </span>
              </div>
            );
          })()}
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Lowest HF</p>
          {(() => {
            const hf = result.summary.lowestHealthFactor;
            const hfDisplay = hf === Infinity ? "Safe" : hf.toFixed(2);
            const hfColor = hf < 1.1 ? "text-red-500" : hf < 1.5 ? "text-amber-500" : "text-emerald-600";
            return (
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <p className={`text-sm font-bold ${hfColor}`}>{hfDisplay}</p>
                {hf !== Infinity && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    Day {result.summary.lowestHealthFactorDay}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-0.5 w-fit">
        {tabs.map((tab) => (
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

      {/* Net Worth chart */}
      {activeTab === "netWorth" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={chartData} onClick={handleChartClick}>
            <defs>
              <linearGradient id="compound-nw-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COMPOUND_GREEN} stopOpacity={0.15} />
                <stop offset="100%" stopColor={COMPOUND_GREEN} stopOpacity={0} />
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
              formatter={(value: number) => [`$${formatUSD(value)}`, "Net Worth"]}
              labelFormatter={(day) => `Day ${day}`}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke={COMPOUND_GREEN}
              strokeWidth={2}
              fill="url(#compound-nw-grad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
            {startNetWorth > 0 && (
              <ReferenceLine
                y={startNetWorth}
                stroke="#9CA3AF"
                strokeDasharray="3 3"
                strokeWidth={1}
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

      {/* Health Factor chart */}
      {activeTab === "healthFactor" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData} onClick={handleChartClick}>
            {sharedGrid}
            {sharedXAxis}
            <YAxis
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[Math.max(0, hfMin - 0.5), hfMax + 0.5]}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [value.toFixed(2), "Health Factor"]}
              labelFormatter={(day) => `Day ${day}`}
            />
            {/* Red danger zone below HF 1 */}
            <ReferenceArea
              y1={0}
              y2={1}
              fill={HF_DANGER}
              fillOpacity={0.06}
              strokeOpacity={0}
            />
            <ReferenceLine
              y={1}
              stroke={HF_DANGER}
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{ value: "Liquidation", position: "right", fontSize: 10, fill: HF_DANGER }}
            />
            <Line
              type="monotone"
              dataKey="healthFactor"
              stroke={COMPOUND_GREEN}
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

      {/* Supply vs Borrow chart */}
      {activeTab === "supplyBorrow" && (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart data={chartData} onClick={handleChartClick}>
            <defs>
              <linearGradient id="compound-supply-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SUPPLY_COLOR} stopOpacity={0.12} />
                <stop offset="100%" stopColor={SUPPLY_COLOR} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="compound-collateral-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLLATERAL_COLOR} stopOpacity={0.12} />
                <stop offset="100%" stopColor={COLLATERAL_COLOR} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="compound-borrow-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BORROW_COLOR} stopOpacity={0.12} />
                <stop offset="100%" stopColor={BORROW_COLOR} stopOpacity={0} />
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
                  totalSupply: "Supply",
                  totalCollateral: "Collateral",
                  totalBorrow: "Borrow",
                };
                return [`$${formatUSD(value)}`, labels[name] || name];
              }}
              labelFormatter={(day) => `Day ${day}`}
            />
            <Area
              type="monotone"
              dataKey="totalSupply"
              stroke={SUPPLY_COLOR}
              strokeWidth={2}
              fill="url(#compound-supply-grad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="totalCollateral"
              stroke={COLLATERAL_COLOR}
              strokeWidth={2}
              fill="url(#compound-collateral-grad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="totalBorrow"
              stroke={BORROW_COLOR}
              strokeWidth={2}
              fill="url(#compound-borrow-grad)"
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
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Supply vs Borrow legend */}
      {activeTab === "supplyBorrow" && (
        <div className="flex gap-4 mt-2">
          {[
            { color: SUPPLY_COLOR, label: "Supply" },
            { color: COLLATERAL_COLOR, label: "Collateral" },
            { color: BORROW_COLOR, label: "Borrow" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] text-gray-500">{item.label}</span>
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
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <input
          type="range"
          min={0}
          max={result.timeline.length - 1}
          value={selectedDay ?? 0}
          onChange={(e) => onSelectDay(Number(e.target.value))}
          className="flex-1 h-1 accent-[#00D395]"
        />
        <button
          onClick={() => onSelectDay(Math.min(result.timeline.length - 1, (selectedDay ?? 0) + 1))}
          disabled={selectedDay === result.timeline.length - 1}
          className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#303549] hover:border-gray-300 transition-colors disabled:opacity-30"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <span className="text-xs text-gray-400 w-12 text-center">
          Day {selectedDay ?? 0}
        </span>
      </div>
    </div>
  );
}
