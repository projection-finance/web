"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import type {
  CompoundScheduledAction,
  CompoundActionType,
} from "@/src/lib/simulation/compound-types";
import type { CompoundMarketPosition } from "@/src/lib/compound/types";
import { Trash2, Plus } from "lucide-react";

interface CompoundActionSchedulerProps {
  markets: CompoundMarketPosition[];
  actions: CompoundScheduledAction[];
  durationDays: number;
  onAddAction: (action: CompoundScheduledAction) => void;
  onRemoveAction: (index: number) => void;
}

const ACTION_TYPES: CompoundActionType[] = [
  "supply",
  "withdraw",
  "borrow",
  "repay",
  "supplyCollateral",
  "withdrawCollateral",
];

const ACTION_COLORS: Record<CompoundActionType, string> = {
  supply: "text-green-600 bg-green-50",
  withdraw: "text-red-600 bg-red-50",
  borrow: "text-sky-600 bg-sky-50",
  repay: "text-blue-600 bg-blue-50",
  supplyCollateral: "text-emerald-600 bg-emerald-50",
  withdrawCollateral: "text-amber-600 bg-amber-50",
};

const ACTION_LABELS: Record<CompoundActionType, string> = {
  supply: "Supply",
  withdraw: "Withdraw",
  borrow: "Borrow",
  repay: "Repay",
  supplyCollateral: "Supply Collateral",
  withdrawCollateral: "Withdraw Collateral",
};

const COLLATERAL_ACTIONS: CompoundActionType[] = [
  "supplyCollateral",
  "withdrawCollateral",
];

const CompoundActionScheduler: React.FC<CompoundActionSchedulerProps> = ({
  markets,
  actions,
  durationDays,
  onAddAction,
  onRemoveAction,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [day, setDay] = useState("1");
  const [type, setType] = useState<CompoundActionType>("supply");
  const [marketId, setMarketId] = useState(markets[0]?.marketId ?? "");
  const [collateralSymbol, setCollateralSymbol] = useState("");
  const [amount, setAmount] = useState("");

  const isCollateralAction = COLLATERAL_ACTIONS.includes(type);

  const selectedMarket = useMemo(
    () => markets.find((m) => m.marketId === marketId),
    [markets, marketId],
  );

  const collateralAssets = useMemo(
    () => selectedMarket?.collateralAssets ?? [],
    [selectedMarket],
  );

  // Reset collateral selection when market or action type changes
  const handleMarketChange = (newMarketId: string) => {
    setMarketId(newMarketId);
    setCollateralSymbol("");
  };

  const handleTypeChange = (newType: CompoundActionType) => {
    setType(newType);
    if (!COLLATERAL_ACTIONS.includes(newType)) {
      setCollateralSymbol("");
    }
  };

  const handleAdd = () => {
    const dayNum = parseInt(day);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > durationDays) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!marketId) return;

    // For base asset actions, symbol is the base token
    // For collateral actions, symbol is the selected collateral
    let symbol: string;
    if (isCollateralAction) {
      if (!collateralSymbol) return;
      symbol = collateralSymbol;
    } else {
      symbol = selectedMarket?.baseSymbol ?? "";
      if (!symbol) return;
    }

    const existingOnDay = actions.filter((a) => a.day === dayNum);

    onAddAction({
      day: dayNum,
      orderInDay: existingOnDay.length,
      type,
      marketId,
      symbol,
      amount: amountNum,
    });

    setIsAdding(false);
    setAmount("");
  };

  const sortedActions = [...actions].sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay,
  );

  const marketLabel = (id: string) => {
    const m = markets.find((m) => m.marketId === id);
    if (!m) return id.slice(0, 10) + "...";
    return `${m.baseSymbol} (${m.chainName})`;
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
                {marketLabel(action.marketId)}
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
                  handleTypeChange(e.target.value as CompoundActionType)
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

          <div
            className={`grid gap-2 ${isCollateralAction ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <div>
              <label className="text-xs text-gray-600">Market</label>
              <select
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                value={marketId}
                onChange={(e) => handleMarketChange(e.target.value)}
              >
                {markets.map((m) => (
                  <option key={m.marketId} value={m.marketId}>
                    {m.baseSymbol} ({m.chainName})
                  </option>
                ))}
              </select>
            </div>

            {isCollateralAction && (
              <div>
                <label className="text-xs text-gray-600">Collateral</label>
                <select
                  className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                  value={collateralSymbol}
                  onChange={(e) => setCollateralSymbol(e.target.value)}
                >
                  <option value="">Select...</option>
                  {collateralAssets.map((c) => (
                    <option key={c.address} value={c.symbol}>
                      {c.symbol}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#4F7FFA] hover:bg-blue-600"
              onClick={handleAdd}
              disabled={
                !marketId ||
                !amount ||
                (isCollateralAction && !collateralSymbol)
              }
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

export default CompoundActionScheduler;
