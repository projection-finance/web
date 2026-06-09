"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import type {
  MorphoBlueScheduledAction,
  MorphoBlueActionType,
} from "@/src/lib/simulation/morpho-blue-types";
import type { MorphoBlueMarketPosition } from "@/src/lib/morpho-blue/types";
import { Trash2, Plus } from "lucide-react";

interface MorphoBlueActionSchedulerProps {
  markets: MorphoBlueMarketPosition[];
  actions: MorphoBlueScheduledAction[];
  durationDays: number;
  onAddAction: (action: MorphoBlueScheduledAction) => void;
  onRemoveAction: (index: number) => void;
}

const ACTION_TYPES: MorphoBlueActionType[] = [
  "supply",
  "withdraw",
  "borrow",
  "repay",
  "supplyCollateral",
  "withdrawCollateral",
];

const ACTION_COLORS: Record<MorphoBlueActionType, string> = {
  supply: "text-green-600 bg-green-50",
  withdraw: "text-red-600 bg-red-50",
  borrow: "text-sky-600 bg-sky-50",
  repay: "text-blue-600 bg-blue-50",
  supplyCollateral: "text-emerald-600 bg-emerald-50",
  withdrawCollateral: "text-amber-600 bg-amber-50",
};

const ACTION_LABELS: Record<MorphoBlueActionType, string> = {
  supply: "Supply",
  withdraw: "Withdraw",
  borrow: "Borrow",
  repay: "Repay",
  supplyCollateral: "Supply Collateral",
  withdrawCollateral: "Withdraw Collateral",
};

const COLLATERAL_ACTIONS: MorphoBlueActionType[] = [
  "supplyCollateral",
  "withdrawCollateral",
];

const MorphoBlueActionScheduler: React.FC<MorphoBlueActionSchedulerProps> = ({
  markets,
  actions,
  durationDays,
  onAddAction,
  onRemoveAction,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [day, setDay] = useState("1");
  const [type, setType] = useState<MorphoBlueActionType>("supply");
  const [uniqueKey, setUniqueKey] = useState(markets[0]?.uniqueKey ?? "");
  const [amount, setAmount] = useState("");

  const isCollateralAction = COLLATERAL_ACTIONS.includes(type);

  const selectedMarket = useMemo(
    () => markets.find((m) => m.uniqueKey === uniqueKey),
    [markets, uniqueKey],
  );

  const handleAdd = () => {
    const dayNum = parseInt(day);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > durationDays) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!uniqueKey) return;

    // For base asset actions, symbol is the loan token
    // For collateral actions, symbol is the collateral token (1 per market, no dropdown)
    let symbol: string;
    if (isCollateralAction) {
      symbol = selectedMarket?.collateralSymbol ?? "";
    } else {
      symbol = selectedMarket?.loanSymbol ?? "";
    }
    if (!symbol) return;

    const existingOnDay = actions.filter((a) => a.day === dayNum);

    onAddAction({
      day: dayNum,
      orderInDay: existingOnDay.length,
      type,
      uniqueKey,
      symbol,
      amount: amountNum,
    });

    setIsAdding(false);
    setAmount("");
  };

  const sortedActions = [...actions].sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay,
  );

  const marketLabel = (key: string) => {
    const m = markets.find((m) => m.uniqueKey === key);
    if (!m) return key.slice(0, 10) + "...";
    return `${m.loanSymbol}/${m.collateralSymbol}`;
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
            No actions scheduled. The simulation will only track APY compounding
            and price changes.
          </p>
          <p className="text-xs text-[#4F7FFA] bg-[#4F7FFA]/5 border border-[#4F7FFA]/20 rounded px-2 py-1">
            <strong>Tip:</strong> Day 0 is your baseline. Schedule supply,
            borrow, or collateral actions on future days to see their impact.
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
              <span className="text-xs truncate">
                {action.amount.toLocaleString()} {action.symbol} &mdash;{" "}
                {marketLabel(action.uniqueKey)}
              </span>
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
                  setType(e.target.value as MorphoBlueActionType)
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">Market</label>
              <select
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                value={uniqueKey}
                onChange={(e) => setUniqueKey(e.target.value)}
              >
                {markets.map((m) => (
                  <option key={m.uniqueKey} value={m.uniqueKey}>
                    {m.loanSymbol}/{m.collateralSymbol}
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

          {isCollateralAction && selectedMarket && (
            <p className="text-[10px] text-gray-400">
              Collateral asset: <span className="font-medium text-[#303549]">{selectedMarket.collateralSymbol}</span>
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#4F7FFA] hover:bg-blue-600"
              onClick={handleAdd}
              disabled={!uniqueKey || !amount}
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

export default MorphoBlueActionScheduler;
