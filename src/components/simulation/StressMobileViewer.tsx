"use client";

import React, { useMemo } from "react";
import {
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent } from "@/src/components/ui/card";
import { formatUSD } from "@/src/lib/format";
import {
  ArrowLeft,
  Monitor,
  Shield,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Wallet,
  Globe,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StressMobileViewerProps {
  address: string;
  networkId: string;
  networkName: string;
  ensName?: string;
  currentHF: number;
  result: {
    timeline: Array<{
      day: number;
      healthFactor: number;
      totalCollateralUSD: number;
      totalBorrowsUSD: number;
      netWorthUSD: number;
    }>;
    summary: {
      startNetWorth: number;
      endNetWorth: number;
      lowestHealthFactor: number;
      lowestHealthFactorDay: number;
      liquidationOccurred: boolean;
      liquidationDay?: number;
    };
  } | null;
  priceScenarios: Array<{
    symbol: string;
    endPrice?: number;
    startPrice: number;
  }>;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatHF(value: number): string {
  if (!isFinite(value) || value > 1e10) return "\u221E";
  return value.toFixed(2);
}

function pnlPercent(start: number, end: number): number {
  if (start === 0) return 0;
  return ((end - start) / Math.abs(start)) * 100;
}

function priceChangePercent(start: number, end: number): number {
  if (start === 0) return 0;
  return ((end - start) / start) * 100;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const StressMobileViewer: React.FC<StressMobileViewerProps> = ({
  address,
  networkName,
  ensName,
  currentHF,
  result,
  priceScenarios,
  onBack,
}) => {
  const summary = result?.summary ?? null;
  const timeline = result?.timeline ?? [];

  /* ---------- Chart data ---------- */
  const chartData = useMemo(() => {
    return timeline.map((snap) => ({
      day: snap.day,
      hf:
        snap.healthFactor > 1e10 || !isFinite(snap.healthFactor)
          ? null
          : snap.healthFactor,
      // For the danger area below 1.0 we need a separate key
      hfDanger:
        isFinite(snap.healthFactor) && snap.healthFactor < 1.0
          ? snap.healthFactor
          : null,
    }));
  }, [timeline]);

  /* ---------- PNL ---------- */
  const pnl = summary ? pnlPercent(summary.startNetWorth, summary.endNetWorth) : 0;
  const pnlPositive = pnl >= 0;

  /* ---------- HF color ---------- */
  const hfColor = (hf: number): string => {
    if (!isFinite(hf) || hf > 1e10) return "text-green-600";
    if (hf < 0.95) return "text-red-600";
    if (hf < 1.0) return "text-red-500";
    if (hf < 1.1) return "text-amber-600";
    return "text-green-600";
  };

  /* ---------- Y-axis domain ---------- */
  const yDomain = useMemo(() => {
    const values = chartData
      .map((d) => d.hf)
      .filter((v): v is number => v !== null);
    if (values.length === 0) return [0, 2];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [Math.max(0, Math.floor(min * 10 - 1) / 10), Math.ceil(max * 10 + 1) / 10];
  }, [chartData]);

  return (
    <div className="min-h-screen bg-[#F5F5FA] px-3 py-4 space-y-3">
      {/* ============================================================ */}
      {/*  TOP BAR                                                      */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Network badge */}
          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600 shrink-0">
            <Globe className="w-3 h-3 text-[#5382E3]" />
            {networkName}
          </span>

          {/* Address */}
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 truncate">
            <Wallet className="w-3 h-3 shrink-0" />
            <span className="truncate font-mono text-[11px]">
              {ensName || truncateAddress(address)}
            </span>
          </span>
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#5382E3] bg-white border border-[#5382E3]/30 rounded-lg px-3 py-1.5 hover:bg-[#5382E3]/5 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Radar
        </button>
      </div>

      {/* ============================================================ */}
      {/*  CURRENT HEALTH FACTOR BADGE                                  */}
      {/* ============================================================ */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#5382E3]" />
            <span className="text-xs text-slate-500">Current Health Factor</span>
          </div>
          <span className={`text-sm font-bold ${hfColor(currentHF)}`}>
            {formatHF(currentHF)}
          </span>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  PNL SUMMARY — 2x2 grid                                      */}
      {/* ============================================================ */}
      {summary && (
      <div className="grid grid-cols-2 gap-2">
        {/* Start Net Worth */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              Start Net Worth
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              ${formatUSD(summary.startNetWorth)}
            </p>
          </CardContent>
        </Card>

        {/* End Net Worth */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              End Net Worth
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              ${formatUSD(summary.endNetWorth)}
            </p>
          </CardContent>
        </Card>

        {/* PNL % */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              PNL
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {pnlPositive ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              )}
              <span
                className={`text-sm font-semibold ${
                  pnlPositive ? "text-green-600" : "text-red-500"
                }`}
              >
                {pnlPositive ? "+" : ""}
                {pnl.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Liquidation / Lowest HF */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            {summary.liquidationOccurred ? (
              <>
                <p className="text-[10px] text-red-400 uppercase tracking-wide">
                  Liquidation
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-sm font-semibold text-red-500">
                    Day {summary.liquidationDay}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                  Lowest HF
                </p>
                <p
                  className={`text-sm font-semibold mt-0.5 ${
                    isFinite(summary.lowestHealthFactor) &&
                    summary.lowestHealthFactor < 1.1
                      ? "text-amber-600"
                      : "text-green-600"
                  }`}
                >
                  {formatHF(summary.lowestHealthFactor)}
                  {isFinite(summary.lowestHealthFactor) && (
                    <span className="text-[10px] text-slate-400 ml-1">
                      D{summary.lowestHealthFactorDay}
                    </span>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* ============================================================ */}
      {/*  HEALTH FACTOR CHART                                          */}
      {/* ============================================================ */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <p className="text-xs font-medium text-slate-600 mb-2">
            Health Factor Evolution
          </p>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                  tickFormatter={(d) => `D${d}`}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                  domain={yDomain}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatHF(value),
                    "Health Factor",
                  ]}
                  labelFormatter={(day) => `Day ${day}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />

                {/* Danger area fill below 1.0 */}
                <Area
                  type="monotone"
                  dataKey="hfDanger"
                  stroke="none"
                  fill="#FEE2E2"
                  fillOpacity={0.6}
                  connectNulls={false}
                  isAnimationActive={false}
                />

                {/* Reference lines */}
                <ReferenceLine
                  y={1.0}
                  stroke="#EF4444"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: "1.0",
                    position: "right",
                    fontSize: 10,
                    fill: "#EF4444",
                  }}
                />
                <ReferenceLine
                  y={0.95}
                  stroke="#EF4444"
                  strokeDasharray="2 2"
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  label={{
                    value: "0.95",
                    position: "right",
                    fontSize: 9,
                    fill: "#EF4444",
                  }}
                />

                {/* Liquidation day marker */}
                {summary?.liquidationOccurred &&
                  summary?.liquidationDay !== undefined && (
                    <ReferenceLine
                      x={summary?.liquidationDay}
                      stroke="#EF4444"
                      strokeWidth={2}
                      strokeOpacity={0.8}
                      label={{
                        value: `Liq D${summary?.liquidationDay}`,
                        position: "top",
                        fontSize: 10,
                        fontWeight: 700,
                        fill: "#EF4444",
                      }}
                    />
                  )}

                {/* HF line */}
                <Line
                  type="monotone"
                  dataKey="hf"
                  stroke="#5382E3"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  STRESSED TOKENS                                              */}
      {/* ============================================================ */}
      {priceScenarios.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-slate-600 mb-2">
              Stressed Tokens
            </p>
            <div className="flex flex-wrap gap-1.5">
              {priceScenarios.map((scenario) => {
                const endPrice = scenario.endPrice ?? scenario.startPrice;
                const change = priceChangePercent(
                  scenario.startPrice,
                  endPrice
                );
                const isNegative = change < 0;

                return (
                  <span
                    key={scenario.symbol}
                    className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-1 ${
                      isNegative
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-green-50 text-green-700 border border-green-200"
                    }`}
                  >
                    <span className="font-semibold">{scenario.symbol}</span>
                    <span className="opacity-70">
                      {isNegative ? "" : "+"}
                      {change.toFixed(1)}%
                    </span>
                    <span className="text-[10px] opacity-50">
                      ${formatUSD(scenario.startPrice)} &rarr; $
                      {formatUSD(endPrice)}
                    </span>
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/*  BOTTOM: DESKTOP HINT                                         */}
      {/* ============================================================ */}
      <div className="flex items-center justify-center gap-2 py-4">
        <Monitor className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-400">
          Open full projection on desktop for interactive controls
        </span>
      </div>
    </div>
  );
};

export default StressMobileViewer;
