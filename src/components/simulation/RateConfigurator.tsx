"use client";

import React, { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { RateScenario, RateMode } from "@/src/lib/simulation/types";
import { AssetDetails } from "@/src/lib/aave/types";
import { Trash2, Plus } from "lucide-react";
import TokenIcon from "@/src/components/ui/TokenIcon";

interface RateConfiguratorProps {
  availableAssets: AssetDetails[];
  scenarios: RateScenario[];
  onAddScenario: (scenario: RateScenario) => void;
  onRemoveScenario: (symbol: string, rateType: "supply" | "borrow" | "supplyIncentive" | "borrowIncentive") => void;
}

const MODE_LABELS: Record<RateMode, string> = {
  fixed: "Fixed",
  linear: "Linear",
  sinusoidal: "Sinusoidal",
  manual: "Manual",
};

const RateConfigurator: React.FC<RateConfiguratorProps> = ({
  availableAssets,
  scenarios,
  onAddScenario,
  onRemoveScenario,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [rateType, setRateType] = useState<"supply" | "borrow">("supply");
  const [mode, setMode] = useState<RateMode>("fixed");
  const [startRate, setStartRate] = useState("");
  const [endRate, setEndRate] = useState("");

  const getCurrentRate = (symbol: string, type: "supply" | "borrow"): number => {
    const asset = availableAssets.find((a) => a.symbol === symbol);
    if (!asset) return 0;
    return type === "supply" ? (asset.supplyAPY ?? 0) : (asset.variableBorrowAPY ?? 0);
  };

  const handleAdd = () => {
    if (!selectedSymbol) return;
    const rate = parseFloat(startRate);
    if (isNaN(rate)) return;

    const scenario: RateScenario = {
      symbol: selectedSymbol,
      rateType,
      mode,
      startRate: rate / 100, // Convert from % to decimal
    };

    if (mode === "linear") {
      scenario.endRate = (parseFloat(endRate) || rate) / 100;
    }

    onAddScenario(scenario);
    setIsAdding(false);
    setSelectedSymbol("");
    setMode("fixed");
    setStartRate("");
    setEndRate("");
  };

  const handleStartAdding = () => {
    setIsAdding(true);
    const firstAsset = availableAssets[0];
    if (firstAsset) {
      setSelectedSymbol(firstAsset.symbol);
      setStartRate((getCurrentRate(firstAsset.symbol, "supply") * 100).toFixed(2));
    }
  };

  const handleAssetChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    setStartRate((getCurrentRate(symbol, rateType) * 100).toFixed(2));
  };

  const handleRateTypeChange = (type: "supply" | "borrow") => {
    setRateType(type);
    if (selectedSymbol) {
      setStartRate((getCurrentRate(selectedSymbol, type) * 100).toFixed(2));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#303549]">Rate Scenarios</p>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleStartAdding}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Existing scenarios */}
      {scenarios.length === 0 && !isAdding && (
        <p className="text-xs text-gray-400">
          No rate scenarios. APY will follow current market rates (updated after actions).
        </p>
      )}

      {scenarios.map((s) => (
        <div
          key={`${s.symbol}-${s.rateType}`}
          className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <TokenIcon symbol={s.symbol} size={24} />
            <div>
              <p className="text-xs font-medium">
                {s.symbol}{" "}
                <span className="text-gray-400">
                  ({s.rateType === "supply" ? "Supply" : "Borrow"})
                </span>
              </p>
              <p className="text-[10px] text-gray-400">
                {(s.startRate * 100).toFixed(2)}%
                {s.mode === "linear" && s.endRate !== undefined && (
                  <> &rarr; {(s.endRate * 100).toFixed(2)}%</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {MODE_LABELS[s.mode]}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onRemoveScenario(s.symbol, s.rateType)}
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </Button>
          </div>
        </div>
      ))}

      {/* Add form */}
      {isAdding && (
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <div>
            <label className="text-xs text-gray-600">Asset</label>
            <select
              className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
              value={selectedSymbol}
              onChange={(e) => handleAssetChange(e.target.value)}
            >
              {availableAssets.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">Rate Type</label>
            <select
              className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
              value={rateType}
              onChange={(e) => handleRateTypeChange(e.target.value as "supply" | "borrow")}
            >
              <option value="supply">Supply APY</option>
              <option value="borrow">Borrow APY</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">Mode</label>
            <select
              className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
              value={mode}
              onChange={(e) => setMode(e.target.value as RateMode)}
            >
              {(Object.keys(MODE_LABELS) as RateMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">
              {mode === "linear" ? "Start Rate (%)" : "Rate (%)"}
            </label>
            <input
              type="number"
              value={startRate}
              onChange={(e) => setStartRate(e.target.value)}
              placeholder="e.g. 3.50"
              className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
              min="0"
              step="0.01"
            />
          </div>

          {mode === "linear" && (
            <div>
              <label className="text-xs text-gray-600">End Rate (%)</label>
              <input
                type="number"
                value={endRate}
                onChange={(e) => setEndRate(e.target.value)}
                placeholder="e.g. 5.00"
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                min="0"
                step="0.01"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#4F7FFA] hover:bg-blue-600"
              onClick={handleAdd}
              disabled={!selectedSymbol || !startRate}
            >
              Add Scenario
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

export default RateConfigurator;
