"use client";

import React, { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import type { MorphoScheduledAction } from "@/src/lib/simulation/morpho-types";
import type { MorphoVaultPosition } from "@/src/lib/morpho/types";
import { Trash2, Plus } from "lucide-react";

interface MorphoActionSchedulerProps {
  vaults: MorphoVaultPosition[];
  actions: MorphoScheduledAction[];
  durationDays: number;
  onAddAction: (action: MorphoScheduledAction) => void;
  onRemoveAction: (index: number) => void;
}

const ACTION_TYPES = ["deposit", "withdraw"] as const;

const ACTION_COLORS: Record<string, string> = {
  deposit: "text-emerald-600 bg-emerald-50",
  withdraw: "text-amber-600 bg-amber-50",
};

const ACTION_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
};

const MorphoActionScheduler: React.FC<MorphoActionSchedulerProps> = ({
  vaults,
  actions,
  durationDays,
  onAddAction,
  onRemoveAction,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [day, setDay] = useState("1");
  const [type, setType] = useState<(typeof ACTION_TYPES)[number]>("deposit");
  const [vaultAddress, setVaultAddress] = useState(vaults[0]?.vaultAddress ?? "");
  const [amount, setAmount] = useState("");

  const handleAdd = () => {
    const dayNum = parseInt(day);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > durationDays) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!vaultAddress) return;

    const existingOnDay = actions.filter((a) => a.day === dayNum);

    onAddAction({
      day: dayNum,
      orderInDay: existingOnDay.length,
      type,
      vaultAddress,
      amount: amountNum,
    });

    setIsAdding(false);
    setAmount("");
  };

  const sortedActions = [...actions].sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay,
  );

  const vaultName = (addr: string) => {
    const v = vaults.find((v) => v.vaultAddress === addr);
    return v?.vaultName || addr.slice(0, 10) + "...";
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
            No actions scheduled. The simulation will only track APY compounding and price changes.
          </p>
          <p className="text-xs text-[#4F7FFA] bg-[#4F7FFA]/5 border border-[#4F7FFA]/20 rounded px-2 py-1">
            <strong>Tip:</strong> Day 0 is your baseline. Schedule deposits or withdrawals on future days to see their impact.
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
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                Day {action.day}
              </Badge>
              <Badge
                className={`text-[10px] px-1.5 py-0 shrink-0 ${ACTION_COLORS[action.type] ?? ""}`}
              >
                {ACTION_LABELS[action.type] ?? action.type}
              </Badge>
              <span className="text-xs truncate">
                ${action.amount.toLocaleString()} — {vaultName(action.vaultAddress)}
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600">Vault</label>
              <select
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                value={vaultAddress}
                onChange={(e) => setVaultAddress(e.target.value)}
              >
                {vaults.map((v) => (
                  <option key={v.vaultAddress} value={v.vaultAddress}>
                    {v.vaultName} ({v.assetSymbol})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Amount (USD)</label>
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
              disabled={!vaultAddress || !amount}
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

export default MorphoActionScheduler;
