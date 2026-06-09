"use client";

import React, { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { PriceScenario, PriceMode } from "@/src/lib/simulation/types";
import { AssetDetails } from "@/src/lib/aave/types";
import { Trash2, Plus } from "lucide-react";
import TokenIcon from "@/src/components/ui/TokenIcon";
import { formatUSD } from "@/src/lib/format";

interface PriceConfiguratorProps {
  availableAssets: AssetDetails[];
  scenarios: PriceScenario[];
  onAddScenario: (scenario: PriceScenario) => void;
  onRemoveScenario: (symbol: string) => void;
}

const MODE_LABELS: Record<PriceMode, string> = {
  fixed: "Fixed",
  linear: "Linear",
  sinusoidal: "Sinusoidal",
  gbm: "GBM (Stochastic)",
  manual: "Manual",
};

const PriceConfigurator: React.FC<PriceConfiguratorProps> = ({
  availableAssets,
  scenarios,
  onAddScenario,
  onRemoveScenario,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [mode, setMode] = useState<PriceMode>("fixed");
  const [endPrice, setEndPrice] = useState("");
  const [mu, setMu] = useState("0.05");
  const [sigma, setSigma] = useState("0.5");
  const [seed, setSeed] = useState("42");

  const configuredSymbols = new Set(scenarios.map((s) => s.symbol));
  const unConfiguredAssets = availableAssets.filter(
    (a) => !configuredSymbols.has(a.symbol)
  );

  const selectedAsset = availableAssets.find((a) => a.symbol === selectedSymbol);

  const handleAdd = () => {
    if (!selectedAsset) return;

    const scenario: PriceScenario = {
      symbol: selectedAsset.symbol,
      mode,
      startPrice: selectedAsset.priceInUSD,
    };

    if (mode === "linear") {
      scenario.endPrice = parseFloat(endPrice) || selectedAsset.priceInUSD;
    }
    if (mode === "gbm") {
      scenario.mu = parseFloat(mu) || 0;
      scenario.sigma = parseFloat(sigma) || 0.5;
      scenario.seed = parseInt(seed) || 42;
    }

    onAddScenario(scenario);
    setIsAdding(false);
    setSelectedSymbol("");
    setMode("fixed");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#303549]">Price Scenarios</p>
        {!isAdding && unConfiguredAssets.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setIsAdding(true);
              setSelectedSymbol(unConfiguredAssets[0]?.symbol ?? "");
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {/* Existing scenarios */}
      {scenarios.length === 0 && !isAdding && (
        <p className="text-xs text-gray-400">
          No price scenarios configured. All prices will stay at current levels.
        </p>
      )}

      {scenarios.map((s) => {
        const asset = availableAssets.find((a) => a.symbol === s.symbol);
        return (
          <div
            key={s.symbol}
            className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <TokenIcon symbol={s.symbol} size={24} />
              <div>
                <p className="text-xs font-medium">{s.symbol}</p>
                <p className="text-[10px] text-gray-400">
                  ${asset ? formatUSD(asset.priceInUSD) : "?"} →{" "}
                  {s.mode === "fixed" && `Fixed`}
                  {s.mode === "linear" &&
                    `$${s.endPrice != null ? formatUSD(s.endPrice) : "?"}`}
                  {s.mode === "gbm" &&
                    `GBM (μ=${s.mu}, σ=${s.sigma})`}
                  {s.mode === "manual" && `Manual`}
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
                onClick={() => onRemoveScenario(s.symbol)}
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </Button>
            </div>
          </div>
        );
      })}

      {/* Add form */}
      {isAdding && (
        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
          <div>
            <label className="text-xs text-gray-600">Asset</label>
            <select
              className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
            >
              {unConfiguredAssets.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} — ${formatUSD(a.priceInUSD)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">Mode</label>
            <select
              className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
              value={mode}
              onChange={(e) => setMode(e.target.value as PriceMode)}
            >
              {(Object.keys(MODE_LABELS) as PriceMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {mode === "linear" && (
            <div>
              <label className="text-xs text-gray-600">
                Target price (USD)
              </label>
              <input
                type="number"
                value={endPrice}
                onChange={(e) => setEndPrice(e.target.value)}
                placeholder={String(selectedAsset?.priceInUSD ?? 0)}
                className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                min="0"
                step="any"
              />
            </div>
          )}

          {mode === "gbm" && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-600">Drift (μ)</label>
                <input
                  type="number"
                  value={mu}
                  onChange={(e) => setMu(e.target.value)}
                  className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Vol (σ)</label>
                <input
                  type="number"
                  value={sigma}
                  onChange={(e) => setSigma(e.target.value)}
                  className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Seed</label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                  step="1"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#4F7FFA] hover:bg-blue-600"
              onClick={handleAdd}
              disabled={!selectedSymbol}
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

export default PriceConfigurator;
