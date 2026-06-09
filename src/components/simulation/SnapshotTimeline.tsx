"use client";

import React from "react";
import { SimSnapshot } from "@/src/lib/aave/types";
import { Button } from "@/src/components/ui/button";
import { RotateCcw, Undo2 } from "lucide-react";

interface SnapshotTimelineProps {
  snapshots: SimSnapshot[];
  onUndo: () => void;
  onReset: () => void;
}

function formatHF(hf: number): string {
  if (hf === Infinity || hf > 1e10) return "∞";
  return hf.toFixed(2);
}

function hfColor(hf: number): string {
  if (hf === Infinity || hf > 1e10) return "text-green-600";
  if (hf < 0.95) return "text-red-600";
  if (hf < 1) return "text-red-500";
  if (hf < 1.1) return "text-blue-800";
  if (hf < 1.5) return "text-blue-600";
  return "text-green-600";
}

function actionIcon(type: string | undefined): string {
  switch (type) {
    case "supply":
      return "↗";
    case "borrow":
      return "↙";
    case "repay":
      return "↖";
    case "withdraw":
      return "↘";
    case "price_change":
      return "💲";
    case "toggle_collateral":
      return "🔀";
    default:
      return "●";
  }
}

const SnapshotTimeline: React.FC<SnapshotTimelineProps> = ({
  snapshots,
  onUndo,
  onReset,
}) => {
  const lastIndex = snapshots.length - 1;

  return (
    <div className="space-y-3">
      {/* Controls: undo / reset only */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {snapshots.length - 1} action{snapshots.length > 2 ? "s" : ""}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={snapshots.length <= 1}
            className="h-7 px-2 text-xs"
          >
            <Undo2 className="w-3 h-3 mr-1" />
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={snapshots.length <= 1}
            className="h-7 px-2 text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Read-only snapshot list */}
      <div className="max-h-[400px] overflow-auto border border-slate-300 rounded-lg">
        {snapshots.map((snapshot, index) => {
          const isLast = index === lastIndex;
          const hf = snapshot.healthFactorData.healthFactor;

          return (
            <div
              key={snapshot.id}
              className={`flex items-center gap-3 px-3 py-2 border-b border-slate-200 last:border-b-0 ${
                isLast
                  ? "bg-blue-50 border-l-2 border-l-[#5382E3]"
                  : "opacity-70"
              }`}
            >
              {/* Step number */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isLast
                    ? "bg-[#5382E3] text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {index}
              </div>

              {/* Action info */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm">
                    {snapshot.action
                      ? actionIcon(snapshot.action.type)
                      : "●"}
                  </span>
                  <span
                    className={`text-xs truncate ${
                      isLast ? "font-semibold text-[#303549]" : "text-gray-600"
                    }`}
                  >
                    {snapshot.label}
                  </span>
                </div>
              </div>

              {/* Health factor */}
              <div className="flex-shrink-0 text-right">
                <span className={`text-xs font-mono font-semibold ${hfColor(hf)}`}>
                  HF {formatHF(hf)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SnapshotTimeline;
