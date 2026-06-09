"use client";

import React, { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { ScheduledAction } from "@/src/lib/simulation/types";
import { AssetDetails } from "@/src/lib/aave/types";
import { EmodeCategory } from "@/src/lib/aave/emode";
import { Trash2, Plus } from "lucide-react";

interface ActionSchedulerProps {
  availableAssets: AssetDetails[];
  actions: ScheduledAction[];
  durationDays: number;
  onAddAction: (action: ScheduledAction) => void;
  onRemoveAction: (index: number) => void;
  emodeCategories?: EmodeCategory[];
}

const ACTION_TYPES = ["supply", "borrow", "repay", "withdraw", "set_emode"] as const;

const ACTION_COLORS: Record<string, string> = {
  supply: "text-green-600 bg-green-50",
  borrow: "text-sky-700 bg-sky-50",
  repay: "text-blue-600 bg-blue-50",
  withdraw: "text-red-600 bg-red-50",
  set_emode: "text-purple-600 bg-purple-50",
};

const ACTION_LABELS: Record<string, string> = {
  supply: "Supply",
  borrow: "Borrow",
  repay: "Repay",
  withdraw: "Withdraw",
  set_emode: "Set E-Mode",
};

const ActionScheduler: React.FC<ActionSchedulerProps> = ({
  availableAssets,
  actions,
  durationDays,
  onAddAction,
  onRemoveAction,
  emodeCategories,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [day, setDay] = useState("1");
  const [type, setType] = useState<(typeof ACTION_TYPES)[number]>("supply");
  const [symbol, setSymbol] = useState(availableAssets[0]?.symbol ?? "");
  const [amount, setAmount] = useState("");
  const [emodeCategoryId, setEmodeCategoryId] = useState("0");

  const isEmodeAction = type === "set_emode";

  const handleAdd = () => {
    const dayNum = parseInt(day);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > durationDays) return;

    if (isEmodeAction) {
      const catId = parseInt(emodeCategoryId);
      if (isNaN(catId)) return;

      const existingOnDay = actions.filter((a) => a.day === dayNum);
      const cat = emodeCategories?.find((c) => c.id === catId);

      onAddAction({
        day: dayNum,
        orderInDay: existingOnDay.length,
        type: "set_emode",
        symbol: cat?.label ?? `E-Mode ${catId}`,
        amount: 0,
        emodeCategoryId: catId,
      });
    } else {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) return;
      if (!symbol) return;

      const existingOnDay = actions.filter((a) => a.day === dayNum);

      onAddAction({
        day: dayNum,
        orderInDay: existingOnDay.length,
        type,
        symbol,
        amount: amountNum,
        useAsCollateral: type === "supply" ? true : undefined,
      });
    }

    setIsAdding(false);
    setAmount("");
  };

  // Sort actions by day, then orderInDay
  const sortedActions = [...actions].sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay
  );

  const formatActionLabel = (action: ScheduledAction) => {
    if (action.type === "set_emode") {
      return action.emodeCategoryId === 0
        ? "Disable E-Mode"
        : action.symbol;
    }
    return `${action.amount} ${action.symbol}`;
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
            No actions scheduled. The simulation will only track price changes and interest accrual.
          </p>
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
            💡 <strong>Tip:</strong> Day 0 is your baseline. Use the timeline slider below to compare Day 0 (baseline) with any other day after applying actions.
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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Day {action.day}
              </Badge>
              <Badge
                className={`text-[10px] px-1.5 py-0 ${ACTION_COLORS[action.type] ?? ""}`}
              >
                {ACTION_LABELS[action.type] ?? action.type}
              </Badge>
              <span className="text-xs">
                {formatActionLabel(action)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onRemoveAction(originalIndex)}
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </Button>
          </div>
        );
      })}

      {isAdding && (
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
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
                onChange={(e) =>
                  setType(e.target.value as (typeof ACTION_TYPES)[number])
                }
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTION_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isEmodeAction ? (
            <div>
              <label className="text-xs text-gray-600">E-Mode Category</label>
              <select
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                value={emodeCategoryId}
                onChange={(e) => setEmodeCategoryId(e.target.value)}
              >
                {(emodeCategories ?? []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}{cat.id === 0 ? " (Disabled)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600">Asset</label>
                <select
                  className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                >
                  {availableAssets.map((a) => (
                    <option key={a.symbol} value={a.symbol}>
                      {a.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                  min="0"
                  step="any"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#4F7FFA] hover:bg-blue-600"
              onClick={handleAdd}
              disabled={isEmodeAction ? false : (!symbol || !amount)}
            >
              Schedule
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionScheduler;
