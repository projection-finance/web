"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import type {
  UniswapScheduledAction,
  UniswapActionType,
  UniswapPositionEngineEntry,
} from "@/src/lib/simulation/uniswap-types";
import { Trash2, Plus } from "lucide-react";

interface UniswapActionSchedulerProps {
  positions: UniswapPositionEngineEntry[];
  actions: UniswapScheduledAction[];
  durationDays: number;
  onAddAction: (action: UniswapScheduledAction) => void;
  onRemoveAction: (index: number) => void;
}

const ACTION_TYPES: UniswapActionType[] = [
  "createPosition",
  "addLiquidity",
  "removeLiquidity",
  "collectFees",
  "closePosition",
];

const ACTION_COLORS: Record<UniswapActionType, string> = {
  createPosition: "text-emerald-600 bg-emerald-50",
  addLiquidity: "text-green-600 bg-green-50",
  removeLiquidity: "text-amber-600 bg-amber-50",
  collectFees: "text-sky-600 bg-sky-50",
  closePosition: "text-red-600 bg-red-50",
};

const ACTION_LABELS: Record<UniswapActionType, string> = {
  createPosition: "Create Position",
  addLiquidity: "Add Liquidity",
  removeLiquidity: "Remove Liquidity",
  collectFees: "Collect Fees",
  closePosition: "Close Position",
};

const PERCENTAGE_PRESETS = [25, 50, 75, 100];

// Actions that require selecting an existing position
const POSITION_ACTIONS: UniswapActionType[] = [
  "addLiquidity",
  "removeLiquidity",
  "collectFees",
  "closePosition",
];

const UniswapActionScheduler: React.FC<UniswapActionSchedulerProps> = ({
  positions,
  actions,
  durationDays,
  onAddAction,
  onRemoveAction,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [day, setDay] = useState("1");
  const [type, setType] = useState<UniswapActionType>("createPosition");
  const [positionIndex, setPositionIndex] = useState(0);

  // createPosition fields
  const [priceLower, setPriceLower] = useState("");
  const [priceUpper, setPriceUpper] = useState("");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");

  // addLiquidity fields
  const [addAmount0, setAddAmount0] = useState("");
  const [addAmount1, setAddAmount1] = useState("");

  // removeLiquidity field
  const [liquidityPercent, setLiquidityPercent] = useState(100);

  const needsPosition = POSITION_ACTIONS.includes(type);

  const selectedPosition = useMemo(
    () => (needsPosition ? positions[positionIndex] : undefined),
    [positions, positionIndex, needsPosition],
  );

  const positionLabel = (pos: UniswapPositionEngineEntry) =>
    `${pos.token0Symbol}/${pos.token1Symbol} [${pos.priceLower.toFixed(2)} - ${pos.priceUpper.toFixed(2)}]`;

  const handleAdd = () => {
    const dayNum = parseInt(day);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > durationDays) return;

    const existingOnDay = actions.filter((a) => a.day === dayNum);
    const base: UniswapScheduledAction = {
      day: dayNum,
      orderInDay: existingOnDay.length,
      type,
      positionIndex: needsPosition ? positionIndex : positions.length, // new positions get next index
    };

    if (type === "createPosition") {
      const pl = parseFloat(priceLower);
      const pu = parseFloat(priceUpper);
      const a0 = parseFloat(amount0);
      const a1 = parseFloat(amount1);
      if (isNaN(pl) || isNaN(pu) || pl <= 0 || pu <= 0 || pu <= pl) return;
      if (isNaN(a0) || isNaN(a1) || (a0 <= 0 && a1 <= 0)) return;
      base.priceLower = pl;
      base.priceUpper = pu;
      base.amount0 = a0;
      base.amount1 = a1;
    } else if (type === "addLiquidity") {
      const a0 = parseFloat(addAmount0);
      const a1 = parseFloat(addAmount1);
      if (isNaN(a0) || isNaN(a1) || (a0 <= 0 && a1 <= 0)) return;
      base.addAmount0 = a0;
      base.addAmount1 = a1;
    } else if (type === "removeLiquidity") {
      if (liquidityPercent <= 0 || liquidityPercent > 100) return;
      base.liquidityPercent = liquidityPercent;
    }
    // collectFees and closePosition require no extra fields

    onAddAction(base);
    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setPriceLower("");
    setPriceUpper("");
    setAmount0("");
    setAmount1("");
    setAddAmount0("");
    setAddAmount1("");
    setLiquidityPercent(100);
  };

  const sortedActions = [...actions].sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay,
  );

  const actionSummary = (action: UniswapScheduledAction): string => {
    const pos = positions[action.positionIndex];
    const posTag = pos
      ? `${pos.token0Symbol}/${pos.token1Symbol}`
      : `Position #${action.positionIndex + 1}`;

    switch (action.type) {
      case "createPosition":
        return `[${action.priceLower?.toFixed(2)} - ${action.priceUpper?.toFixed(2)}] ${action.amount0 ?? 0} / ${action.amount1 ?? 0}`;
      case "addLiquidity":
        return `${posTag} +${action.addAmount0 ?? 0} / +${action.addAmount1 ?? 0}`;
      case "removeLiquidity":
        return `${posTag} ${action.liquidityPercent}%`;
      case "collectFees":
        return posTag;
      case "closePosition":
        return posTag;
      default:
        return "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#303549]">Scheduled Actions</p>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {sortedActions.length === 0 && !isAdding && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400">
            No actions scheduled. The simulation will only track fee accrual,
            price movements, and IL.
          </p>
          <p className="text-xs text-[#FF007A] bg-[#FF007A]/5 border border-[#FF007A]/20 rounded px-2 py-1">
            <strong>Tip:</strong> Schedule liquidity changes, fee collections, or
            new positions on future days to see their impact.
          </p>
        </div>
      )}

      {sortedActions.map((action, idx) => {
        const originalIndex = actions.indexOf(action);
        return (
          <div
            key={idx}
            className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 shrink-0"
              >
                Day {action.day}
              </Badge>
              <Badge
                className={`text-[10px] px-1.5 py-0 shrink-0 ${ACTION_COLORS[action.type] ?? ""}`}
              >
                {ACTION_LABELS[action.type] ?? action.type}
              </Badge>
              <span className="text-xs truncate">{actionSummary(action)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 shrink-0"
              onClick={() => onRemoveAction(originalIndex)}
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </Button>
          </div>
        );
      })}

      {isAdding && (
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          {/* Row 1: Day + Action type */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">Day</label>
              <input
                type="number"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                min="1"
                max={durationDays}
                step="1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Action</label>
              <select
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                value={type}
                onChange={(e) => setType(e.target.value as UniswapActionType)}
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTION_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Position selector for actions that need it */}
          {needsPosition && positions.length > 0 && (
            <div>
              <label className="text-xs text-gray-600">Position</label>
              <select
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                value={positionIndex}
                onChange={(e) => setPositionIndex(parseInt(e.target.value))}
              >
                {positions.map((pos, i) => (
                  <option key={i} value={i}>
                    {positionLabel(pos)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {needsPosition && positions.length === 0 && (
            <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
              No existing positions. Schedule a &quot;Create Position&quot; first.
            </p>
          )}

          {/* ── createPosition fields ── */}
          {type === "createPosition" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Price Lower</label>
                  <input
                    type="number"
                    value={priceLower}
                    onChange={(e) => setPriceLower(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                    min="0"
                    step="any"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Price Upper</label>
                  <input
                    type="number"
                    value={priceUpper}
                    onChange={(e) => setPriceUpper(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                    min="0"
                    step="any"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Amount Token0</label>
                  <input
                    type="number"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                    min="0"
                    step="any"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Amount Token1</label>
                  <input
                    type="number"
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                    min="0"
                    step="any"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── addLiquidity fields ── */}
          {type === "addLiquidity" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600">
                  Amount {selectedPosition?.token0Symbol ?? "Token0"}
                </label>
                <input
                  type="number"
                  value={addAmount0}
                  onChange={(e) => setAddAmount0(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                  min="0"
                  step="any"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">
                  Amount {selectedPosition?.token1Symbol ?? "Token1"}
                </label>
                <input
                  type="number"
                  value={addAmount1}
                  onChange={(e) => setAddAmount1(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                  min="0"
                  step="any"
                />
              </div>
            </div>
          )}

          {/* ── removeLiquidity fields ── */}
          {type === "removeLiquidity" && (
            <div>
              <label className="text-xs text-gray-600">
                Liquidity to Remove: {liquidityPercent}%
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={liquidityPercent}
                  onChange={(e) => setLiquidityPercent(parseInt(e.target.value))}
                  className="flex-1 h-1"
                  style={{ accentColor: "#FF007A" }}
                />
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {PERCENTAGE_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setLiquidityPercent(pct)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-colors ${
                      liquidityPercent === pct
                        ? "border-[#FF007A] text-[#FF007A] bg-[#FF007A]/5"
                        : "border-gray-200 text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* collectFees / closePosition need no extra fields */}
          {(type === "collectFees" || type === "closePosition") &&
            selectedPosition && (
              <p className="text-[10px] text-gray-400">
                {type === "collectFees"
                  ? `Collect all unclaimed fees from ${selectedPosition.token0Symbol}/${selectedPosition.token1Symbol}`
                  : `Close and withdraw all liquidity from ${selectedPosition.token0Symbol}/${selectedPosition.token1Symbol}`}
              </p>
            )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#FF007A] hover:bg-[#E00070]"
              onClick={handleAdd}
              disabled={
                needsPosition && positions.length === 0
              }
            >
              Schedule
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setIsAdding(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniswapActionScheduler;
