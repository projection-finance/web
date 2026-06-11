"use client";

import React from "react";
import { Badge } from "@/src/components/ui/badge";
import { DaySnapshot } from "@/src/lib/simulation/types";
import { formatQty, formatUSD } from "@/src/lib/format";

interface DayDetailProps {
  snapshot: DaySnapshot;
}

const DayDetail: React.FC<DayDetailProps> = ({ snapshot }) => {
  const hf = snapshot.healthFactor;
  const hfDisplay = !isFinite(hf) || hf > 1e10 ? "∞" : hf.toFixed(4);
  const hfColor =
    !isFinite(hf) || hf > 1e10
      ? "text-green-600"
      : hf < 1
        ? "text-red-600"
        : hf < 1.1
          ? "text-blue-800"
          : "text-green-600";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#303549]">Day {snapshot.day}</p>
        <span className={`text-sm font-mono font-semibold ${hfColor}`}>
          HF {hfDisplay}
        </span>
      </div>

      {/* Position summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 bg-white border border-slate-200 rounded">
          <p className="text-gray-400">Net Worth</p>
          <p className="font-semibold">${formatUSD(snapshot.netWorthUSD)}</p>
        </div>
        <div className="p-2 bg-white border border-slate-200 rounded">
          <p className="text-gray-400">LTV</p>
          <p className="font-semibold">{(snapshot.currentLTV * 100).toFixed(2)}%</p>
        </div>
        <div className="p-2 bg-white border border-slate-200 rounded">
          <p className="text-gray-400">Collateral</p>
          <p className="font-semibold">${formatUSD(snapshot.totalCollateralUSD)}</p>
        </div>
        <div className="p-2 bg-white border border-slate-200 rounded">
          <p className="text-gray-400">Borrows</p>
          <p className="font-semibold">${formatUSD(snapshot.totalBorrowsUSD)}</p>
        </div>
      </div>

      {/* Prices */}
      {snapshot.prices.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Prices</p>
          <div className="flex flex-wrap gap-1">
            {snapshot.prices.map((p) => (
              <Badge
                key={p.symbol}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                {p.symbol}: ${formatUSD(p.priceUSD)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Rates */}
      {snapshot.rates.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Rates</p>
          <div className="flex flex-wrap gap-1">
            {snapshot.rates.map((r) => (
              <Badge
                key={r.symbol}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                {r.symbol}: S {(r.supplyAPY * 100).toFixed(2)}%
                {r.supplyIncentiveAPR > 0 && (
                  <span className="text-green-600"> +{(r.supplyIncentiveAPR * 100).toFixed(2)}%</span>
                )}
                {" / B "}{(r.variableBorrowAPY * 100).toFixed(2)}%
                {r.borrowIncentiveAPR > 0 && (
                  <span className="text-green-600"> +{(r.borrowIncentiveAPR * 100).toFixed(2)}%</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Supplies */}
      {snapshot.supplies.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Supplies</p>
          <div className="space-y-1">
            {snapshot.supplies.map((s) => (
              <div
                key={s.symbol}
                className="text-xs p-1.5 bg-white border border-slate-200 rounded"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.symbol}</span>
                  <div className="text-right">
                    <span>{formatQty(s.balance)}</span>
                    <span className="text-gray-400 ml-1">(${formatUSD(s.balanceUSD)})</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400">
                  <span>{(s.supplyAPY * 100).toFixed(2)}% APY</span>
                  {s.incentiveAPR > 0 && (
                    <span className="text-green-600 font-medium">+{(s.incentiveAPR * 100).toFixed(2)}% incentives</span>
                  )}
                </div>
                {s.incentives.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {s.incentives.map((inc, i) => (
                      <Badge key={i} className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
                        {inc.rewardTokenSymbol} {(inc.incentiveAPR * 100).toFixed(1)}% ({inc.source})
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Borrows */}
      {snapshot.borrows.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Borrows</p>
          <div className="space-y-1">
            {snapshot.borrows.map((b) => (
              <div
                key={b.symbol}
                className="text-xs p-1.5 bg-white border border-slate-200 rounded"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{b.symbol}</span>
                  <div className="text-right">
                    <span>{formatQty(b.debt)}</span>
                    <span className="text-gray-400 ml-1">(${formatUSD(b.debtUSD)})</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400">
                  <span>{(b.borrowAPY * 100).toFixed(2)}% APY</span>
                  {b.incentiveAPR > 0 && (
                    <span className="text-green-600 font-medium">+{(b.incentiveAPR * 100).toFixed(2)}% incentives</span>
                  )}
                </div>
                {b.incentives.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {b.incentives.map((inc, i) => (
                      <Badge key={i} className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
                        {inc.rewardTokenSymbol} {(inc.incentiveAPR * 100).toFixed(1)}% ({inc.source})
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions executed */}
      {snapshot.actionsExecuted.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Actions</p>
          <div className="space-y-1">
            {snapshot.actionsExecuted.map((a, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs p-1.5 bg-white border border-slate-200 rounded"
              >
                <div className="flex items-center gap-1">
                  <Badge
                    className={`text-[10px] px-1 py-0 ${
                      a.status === "success"
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {a.type}
                  </Badge>
                  <span>
                    {formatQty(a.amount)} {a.symbol}
                  </span>
                </div>
                {a.reason && (
                  <span className="text-gray-400 text-[10px]">{a.reason}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liquidations */}
      {snapshot.liquidationEvents && snapshot.liquidationEvents.length > 0 && (
        <div>
          <p className="text-xs font-medium text-red-600 mb-1">⚠ Liquidations</p>
          <div className="space-y-1">
            {snapshot.liquidationEvents.map((ev, idx) => (
              <div
                key={idx}
                className="text-xs p-2 bg-red-50 border border-red-200 rounded space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-red-700">
                    Liquidation #{ev.round}
                  </span>
                  <span className="text-[10px] text-red-500">
                    +{(ev.liquidationBonus * 100).toFixed(1)}% bonus
                  </span>
                </div>
                <div className="flex items-center justify-between text-red-600">
                  <span>Debt repaid</span>
                  <span>
                    {formatQty(ev.debtRepaid)} {ev.debtSymbol}{" "}
                    <span className="text-red-400">(${formatUSD(ev.debtRepaidUSD)})</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-red-600">
                  <span>Collateral seized</span>
                  <span>
                    {formatQty(ev.collateralSeized)} {ev.collateralSymbol}{" "}
                    <span className="text-red-400">(${formatUSD(ev.collateralSeizedUSD)})</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-red-400">
                  <span>HF after</span>
                  <span className="font-mono">
                    {!isFinite(ev.healthFactorAfter) || ev.healthFactorAfter > 1e10
                      ? "∞"
                      : ev.healthFactorAfter.toFixed(4)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings (liquidation strings are shown structurally above) */}
      {snapshot.warnings.filter((w) => !w.startsWith("Liquidated:")).length > 0 && (
        <div className="space-y-1">
          {snapshot.warnings
            .filter((w) => !w.startsWith("Liquidated:"))
            .map((w, idx) => (
              <div
                key={idx}
                className="text-xs p-2 bg-red-50 border border-red-200 rounded text-red-600"
              >
                {w}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default DayDetail;
