"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TokenSimulationResult, TokenAction } from "@/src/lib/tokens/types";
import { PriceScenario } from "@/src/lib/simulation/types";
import { formatUSD } from "@/src/lib/format";

const ACTION_COLORS: Record<string, string> = {
  receive: "bg-green-50 text-green-700 border-green-200",
  send: "bg-red-50 text-red-700 border-red-200",
  swap: "bg-sky-50 text-sky-700 border-sky-200",
  supply: "bg-[#5382E3]/10 text-[#5382E3] border-[#5382E3]/20",
  claim: "bg-amber-50 text-amber-700 border-amber-200",
  borrow: "bg-orange-50 text-orange-700 border-orange-200",
  repay: "bg-teal-50 text-teal-700 border-teal-200",
};

const ACTION_LABELS: Record<string, string> = {
  receive: "Receive",
  send: "Send",
  swap: "Swap",
  supply: "Supply",
  claim: "Claim",
  borrow: "Borrow",
  repay: "Repay",
};

type MetricKey = "totalValue" | "prices";

const TOKEN_COLORS = ["#4F7FFA", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#0F172A"];

interface TokenProjectionChartProps {
  result: TokenSimulationResult;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  priceScenarios?: PriceScenario[];
  actions?: TokenAction[];
  startDate?: Date;
  chartHeight?: number;
}

function dayToDate(day: number, start: Date): string {
  const d = new Date(start);
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TokenProjectionChart: React.FC<TokenProjectionChartProps> = ({
  result,
  selectedDay,
  onSelectDay,
  priceScenarios,
  actions = [],
  startDate,
  chartHeight = 170,
}) => {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("totalValue");
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const origin = useMemo(() => startDate ?? new Date(), [startDate]);
  const maxDay = result.timeline.length - 1;

  // All tokens in the portfolio
  const allTokens = useMemo(() => {
    const day0 = result.timeline[0];
    if (!day0) return [];
    return day0.holdings.map((h) => h.symbol);
  }, [result.timeline]);

  // Currently displayed tokens
  const currentTokens = useMemo(() => {
    if (activeMetric !== "prices") return [];
    if (selectedTokens.size === 0) return allTokens;
    return allTokens.filter((t) => selectedTokens.has(t));
  }, [activeMetric, allTokens, selectedTokens]);

  const toggleToken = (symbol: string) => {
    setSelectedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  // Build chart data
  const chartData = useMemo(() => {
    return result.timeline.map((snap) => {
      const row: Record<string, number> = {
        day: snap.day,
        totalValue: snap.totalValueUSD,
      };
      for (const h of snap.holdings) {
        row[`price_${h.symbol}`] = h.priceUSD;
        row[`value_${h.symbol}`] = h.valueUSD;
      }
      return row;
    });
  }, [result.timeline]);

  // Format for Y axis
  const formatY = (v: number) => `$${formatUSD(v)}`;

  // Active scenarios count per token
  const scenarioMap = useMemo(() => {
    const map: Record<string, PriceScenario> = {};
    for (const s of priceScenarios ?? []) {
      map[s.symbol] = s;
    }
    return map;
  }, [priceScenarios]);

  // Days with actions
  const actionDays = useMemo(
    () => [...new Set(actions.map((a) => a.day))].sort((a, b) => a - b),
    [actions]
  );

  // Actions grouped by day for badges
  const actionsByDay = useMemo(() => {
    const map: Record<number, TokenAction[]> = {};
    for (const a of actions) {
      if (!map[a.day]) map[a.day] = [];
      map[a.day].push(a);
    }
    return map;
  }, [actions]);

  const startValue = result.summary.startValueUSD;
  const endValue = result.summary.endValueUSD;
  const change = result.summary.changePercent;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#303549]">Portfolio Projection</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">
              Day 0: <span className="font-medium text-[#303549]">${formatUSD(startValue)}</span>
            </span>
            <span className="text-xs text-gray-500">→</span>
            <span className="text-xs text-gray-500">
              Day {maxDay}: <span className="font-medium text-[#303549]">${formatUSD(endValue)}</span>
            </span>
            <span className={`text-xs font-semibold ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
              {change >= 0 ? "+" : ""}{(change * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Metric tabs */}
      <div className="flex items-center gap-1.5 mb-3">
        <button
          onClick={() => setActiveMetric("totalValue")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeMetric === "totalValue"
              ? "bg-[#303549] text-white"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          Total Value
        </button>
        <button
          onClick={() => {
            setActiveMetric("prices");
            setSelectedTokens(new Set());
          }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeMetric === "prices"
              ? "bg-[#303549] text-white"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          Prices
        </button>
      </div>

      {/* Token selectors for prices */}
      {activeMetric === "prices" && allTokens.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <button
            onClick={() => setSelectedTokens(new Set())}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              selectedTokens.size === 0
                ? "bg-[#303549] text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {allTokens.map((symbol, i) => {
            const isSelected = selectedTokens.size === 0 || selectedTokens.has(symbol);
            const color = TOKEN_COLORS[i % TOKEN_COLORS.length];
            return (
              <button
                key={symbol}
                onClick={() => toggleToken(symbol)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  isSelected
                    ? "text-white"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                }`}
                style={isSelected ? { backgroundColor: color } : undefined}
              >
                {symbol}
                {scenarioMap[symbol] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            onClick={(e) => {
              if (e?.activePayload?.[0]?.payload) {
                onSelectDay(e.activePayload[0].payload.day);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickFormatter={(d) => dayToDate(d, origin)}
              interval={Math.max(1, Math.floor(maxDay / 6))}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickFormatter={formatY}
              width={80}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                fontSize: 12,
                padding: "8px 12px",
              }}
              formatter={(value: number, name: string) => {
                if (name === "totalValue") return [`$${formatUSD(value)}`, "Total Value"];
                const symbol = name.replace("price_", "");
                return [`$${formatUSD(value)}`, symbol];
              }}
              labelFormatter={(day) => `Day ${day} — ${dayToDate(day as number, origin)}`}
            />

            {/* Action day markers */}
            {actionDays.map((d) => (
              <ReferenceLine
                key={`action-${d}`}
                x={d}
                stroke="#2C4F7C"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            ))}

            {/* Selected day marker */}
            {selectedDay !== null && (
              <ReferenceLine
                x={selectedDay}
                stroke="#4F7FFA"
                strokeWidth={2}
                label={{ value: `D${selectedDay}`, position: "top", fontSize: 10, fontWeight: 600, fill: "#4F7FFA" }}
              />
            )}

            {activeMetric === "totalValue" && (
              <Line
                type="monotone"
                dataKey="totalValue"
                stroke="#4F7FFA"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}

            {activeMetric === "prices" &&
              currentTokens.map((symbol) => (
                <Line
                  key={symbol}
                  type="monotone"
                  dataKey={`price_${symbol}`}
                  stroke={TOKEN_COLORS[allTokens.indexOf(symbol) % TOKEN_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Day slider */}
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={maxDay}
          value={selectedDay ?? 0}
          onChange={(e) => onSelectDay(parseInt(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#5382E3]"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>{dayToDate(0, origin)}</span>
          <span className="font-medium text-[#303549]">
            {selectedDay !== null ? `Day ${selectedDay} — ${dayToDate(selectedDay, origin)}` : "Select a day"}
          </span>
          <span>{dayToDate(maxDay, origin)}</span>
        </div>
      </div>

      {/* Action badges for the selected day */}
      {selectedDay !== null && actionsByDay[selectedDay] && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <span className="text-[10px] text-gray-400 mr-0.5">
            Day {selectedDay}:
          </span>
          {actionsByDay[selectedDay].map((a) => {
            const label = a.type === "swap"
              ? `${ACTION_LABELS[a.type]} ${a.fromAmount} ${a.fromSymbol} → ${a.toSymbol}`
              : `${ACTION_LABELS[a.type]} ${a.amount} ${a.symbol}`;
            return (
              <span
                key={a.id}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${ACTION_COLORS[a.type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* All action days overview */}
      {actionDays.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mt-2">
          <span className="text-[10px] text-gray-400 mr-0.5">Actions:</span>
          {actionDays.map((d) => {
            const dayActions = actionsByDay[d];
            const isSelected = selectedDay === d;
            return (
              <button
                key={d}
                onClick={() => onSelectDay(d)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  isSelected
                    ? "bg-[#4F7FFA] text-white border-[#4F7FFA]"
                    : "bg-white text-[#303549] border-gray-200 hover:border-[#4F7FFA]/50"
                }`}
              >
                D{d}
                <span className={`ml-0.5 ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                  ({dayActions.length})
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TokenProjectionChart;
