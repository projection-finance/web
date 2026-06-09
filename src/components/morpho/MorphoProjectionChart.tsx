"use client";

import { useMemo } from "react";
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
} from "recharts";
import type { MorphoSimulationResult } from "@/src/lib/simulation/morpho-types";

const VAULT_COLORS = ["#4F7FFA", "#10B981", "#1E3A5F", "#EF4444", "#2C4F7C", "#3B82F6", "#14B8A6", "#0F172A"];

function formatUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

interface MorphoProjectionChartProps {
  result: MorphoSimulationResult;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  chartHeight?: number;
}

export default function MorphoProjectionChart({
  result,
  selectedDay,
  onSelectDay,
  chartHeight = 240,
}: MorphoProjectionChartProps) {
  const vaultAddresses = useMemo(() => {
    if (!result.timeline.length) return [];
    return result.timeline[0].vaults.map((v) => v.vaultAddress);
  }, [result]);

  const vaultNames = useMemo(() => {
    if (!result.timeline.length) return {};
    const map: Record<string, string> = {};
    result.timeline[0].vaults.forEach((v) => {
      map[v.vaultAddress] = v.vaultName;
    });
    return map;
  }, [result]);

  const chartData = useMemo(() => {
    return result.timeline.map((snap) => {
      const entry: Record<string, number> = {
        day: snap.day,
        netWorth: snap.netWorthUsd,
      };
      for (const vault of snap.vaults) {
        entry[vault.vaultAddress] = vault.balanceUsd;
      }
      return entry;
    });
  }, [result]);

  const startNetWorth = result.timeline[0]?.netWorthUsd ?? 0;

  return (
    <div>
      {/* Summary: Start State → Final State */}
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
            const pnl = result.summary.endNetWorth - result.summary.startNetWorth;
            const pnlPct = result.summary.startNetWorth > 0
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
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            {result.summary.avgApy > 0 ? "Avg APY" : "Interest"}
          </p>
          {result.summary.avgApy > 0 ? (
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <p className="text-sm font-bold text-[#303549]">{(result.summary.avgApy * 100).toFixed(2)}%</p>
              <span className="text-[10px] text-emerald-500 font-medium">
                +${formatUSD(result.summary.totalInterestEarned)}
              </span>
            </div>
          ) : (
            <p className="text-sm font-bold text-emerald-600 mt-0.5">+${formatUSD(result.summary.totalInterestEarned)}</p>
          )}
        </div>
      </div>

      {/* Net worth area chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart
          data={chartData}
          onClick={(e) => {
            if (e?.activeLabel !== undefined) onSelectDay(Number(e.activeLabel));
          }}
        >
          <defs>
            <linearGradient id="morpho-nw-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F7FFA" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#4F7FFA" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `D${v}`}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v) => `$${formatUSD(v)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "11px",
              padding: "8px 12px",
            }}
            formatter={(value: number, name: string) => {
              const label = name === "netWorth" ? "Net Worth" : (vaultNames[name] || name);
              return [`$${formatUSD(value)}`, label];
            }}
            labelFormatter={(day) => `Day ${day}`}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="#4F7FFA"
            strokeWidth={2}
            fill="url(#morpho-nw-grad)"
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

      {/* Per-vault breakdown */}
      {vaultAddresses.length > 1 && (
        <div className="mt-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
            Per-vault breakdown
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart
              data={chartData}
              onClick={(e) => {
                if (e?.activeLabel !== undefined) onSelectDay(Number(e.activeLabel));
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `D${v}`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(v) => `$${formatUSD(v)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "11px",
                  padding: "8px 12px",
                }}
                formatter={(value: number, name: string) => [
                  `$${formatUSD(value)}`,
                  vaultNames[name] || name,
                ]}
                labelFormatter={(day) => `Day ${day}`}
              />
              {vaultAddresses.map((addr, i) => (
                <Line
                  key={addr}
                  type="monotone"
                  dataKey={addr}
                  stroke={VAULT_COLORS[i % VAULT_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-1.5">
            {vaultAddresses.map((addr, i) => (
              <div key={addr} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: VAULT_COLORS[i % VAULT_COLORS.length] }}
                />
                <span className="text-[10px] text-gray-500">{vaultNames[addr]}</span>
              </div>
            ))}
          </div>
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
          className="flex-1 h-1 accent-[#4F7FFA]"
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
