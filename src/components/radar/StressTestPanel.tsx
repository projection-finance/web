"use client";

import { useState, useMemo, useCallback } from "react";
import { X, RotateCcw, Search, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import TokenIcon from "@/src/components/ui/TokenIcon";
import { isStablecoinSymbol, type PriceChange } from "@/src/lib/radar/stressTest";

interface StressTestPanelProps {
  availableAssets: string[];
  priceChanges: PriceChange[];
  onChange: (changes: PriceChange[]) => void;
}

interface Preset {
  label: string;
  description: string;
  changes: (assets: string[]) => PriceChange[];
}

// ── Token relationship detection ──

function findRelatedTokens(symbol: string, allAssets: string[]): string[] {
  const lower = symbol.toLowerCase();
  const related: string[] = [];

  for (const other of allAssets) {
    if (other === symbol) continue;
    const otherLower = other.toLowerCase();

    // Direct substring match (USDe → PT-sUSDE, sUSDe, etc.)
    if (otherLower.includes(lower) || lower.includes(otherLower)) {
      related.push(other);
      continue;
    }

    // ETH family: ETH, WETH, stETH, wstETH, cbETH, rETH, ezETH, osETH, rsETH, weETH, eETH
    const ethFamily = ["eth", "weth", "steth", "wsteth", "cbeth", "reth", "ezeth", "oseth", "rseth", "weeth", "eeth", "meth", "sweth"];
    if (ethFamily.includes(lower) && ethFamily.includes(otherLower)) {
      related.push(other);
      continue;
    }

    // BTC family: BTC, WBTC, tBTC, cbBTC, LBTC, sBTC
    const btcFamily = ["btc", "wbtc", "tbtc", "cbbtc", "lbtc", "sbtc"];
    if (btcFamily.includes(lower) && btcFamily.includes(otherLower)) {
      related.push(other);
      continue;
    }

    // USD stable family
    const usdFamily = ["usdc", "usdt", "dai", "usde", "susde", "gho", "frax", "lusd", "pyusd", "crvusd", "fdusd", "usds", "susds"];
    if (usdFamily.includes(lower) && usdFamily.includes(otherLower)) {
      related.push(other);
      continue;
    }

    // Pendle PT tokens: if one is "PT-xxx" and xxx relates to symbol
    if (otherLower.startsWith("pt-") && otherLower.includes(lower)) {
      related.push(other);
    } else if (lower.startsWith("pt-") && lower.includes(otherLower)) {
      related.push(other);
    }
  }

  return related;
}

const PRESETS: Preset[] = [
  {
    label: "ETH -20%",
    description: "Ethereum + LSTs drop 20%",
    changes: (assets) => {
      const ethFamily = new Set(["ETH", "WETH", "stETH", "wstETH", "cbETH", "rETH", "ezETH", "osETH", "rsETH", "weETH", "eETH", "mETH", "swETH"]);
      return assets.filter((s) => ethFamily.has(s)).map((s) => ({ symbol: s, percentChange: -20 }));
    },
  },
  {
    label: "ETH -40%",
    description: "Ethereum crash",
    changes: (assets) => {
      const ethFamily = new Set(["ETH", "WETH", "stETH", "wstETH", "cbETH", "rETH", "ezETH", "osETH", "rsETH", "weETH", "eETH", "mETH", "swETH"]);
      return assets.filter((s) => ethFamily.has(s)).map((s) => ({ symbol: s, percentChange: -40 }));
    },
  },
  {
    label: "BTC -30%",
    description: "Bitcoin + wrappers drop 30%",
    changes: (assets) => {
      const btcFamily = new Set(["BTC", "WBTC", "tBTC", "cbBTC", "LBTC", "sBTC"]);
      return assets.filter((s) => btcFamily.has(s)).map((s) => ({ symbol: s, percentChange: -30 }));
    },
  },
  {
    label: "Crash -30%",
    description: "All non-stablecoins -30%",
    changes: (assets) => assets.filter((s) => !isStablecoinSymbol(s)).map((s) => ({ symbol: s, percentChange: -30 })),
  },
  {
    label: "Depeg USDe -10%",
    description: "USDe depeg scenario",
    changes: (assets) => assets.filter((s) => s.toLowerCase().includes("usde")).map((s) => ({ symbol: s, percentChange: -10 })),
  },
  {
    label: "Recovery +20%",
    description: "All non-stablecoins +20%",
    changes: (assets) => assets.filter((s) => !isStablecoinSymbol(s)).map((s) => ({ symbol: s, percentChange: 20 })),
  },
];

export default function StressTestPanel({ availableAssets, priceChanges, onChange }: StressTestPanelProps) {
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const changeMap = useMemo(() => new Map(priceChanges.map((p) => [p.symbol, p.percentChange])), [priceChanges]);

  const filteredAssets = useMemo(() => {
    const notSelected = availableAssets.filter((s) => !changeMap.has(s));
    if (!assetSearch.trim()) return notSelected;
    const q = assetSearch.toLowerCase();
    return notSelected.filter((s) => s.toLowerCase().includes(q));
  }, [availableAssets, assetSearch, changeMap]);

  // Suggestions: when adding a token, suggest related tokens
  const [suggestions, setSuggestions] = useState<{ symbol: string; relatedTo: string }[]>([]);

  const addAsset = useCallback((symbol: string, pct = -10) => {
    const newChanges = [...priceChanges, { symbol, percentChange: pct }];
    onChange(newChanges);

    // Find related tokens not yet added
    const alreadyAdded = new Set(newChanges.map((p) => p.symbol));
    const related = findRelatedTokens(symbol, availableAssets)
      .filter((s) => !alreadyAdded.has(s));
    if (related.length > 0) {
      setSuggestions(related.map((s) => ({ symbol: s, relatedTo: symbol })));
    }
    setShowAssetPicker(false);
    setAssetSearch("");
  }, [priceChanges, onChange, availableAssets]);

  const addSuggested = useCallback((symbol: string, relatedTo: string) => {
    const relatedPct = changeMap.get(relatedTo) ?? -10;
    onChange([...priceChanges, { symbol, percentChange: relatedPct }]);
    setSuggestions((prev) => prev.filter((s) => s.symbol !== symbol));
  }, [priceChanges, onChange, changeMap]);

  const dismissSuggestions = () => setSuggestions([]);

  const updateAsset = (symbol: string, pct: number) => {
    onChange(priceChanges.map((p) => (p.symbol === symbol ? { ...p, percentChange: pct } : p)));
  };

  const removeAsset = (symbol: string) => {
    onChange(priceChanges.filter((p) => p.symbol !== symbol));
    setSuggestions([]);
  };

  const applyPreset = (preset: Preset) => {
    onChange(preset.changes(availableAssets));
    setSuggestions([]);
  };

  const reset = () => { onChange([]); setSuggestions([]); };

  // Show max 6 tokens inline, rest behind "expand"
  const INLINE_MAX = 6;
  const visibleChanges = expanded ? priceChanges : priceChanges.slice(0, INLINE_MAX);
  const hiddenCount = priceChanges.length - INLINE_MAX;

  return (
    <div className="space-y-2">
      {/* Row 1: Presets + search + reset */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mr-0.5">Presets</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset)}
            title={preset.description}
            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white border border-gray-200 text-gray-600 hover:border-[#5382E3] hover:text-[#5382E3] transition-colors cursor-pointer"
          >
            {preset.label}
          </button>
        ))}

        {/* Inline search */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowAssetPicker(!showAssetPicker)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-gray-300 text-[10px] text-gray-400 hover:border-[#5382E3] hover:text-[#5382E3] transition-colors cursor-pointer"
          >
            <Search className="w-3 h-3" />
            Add token
          </button>
          {showAssetPicker && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto">
              <div className="p-1.5 border-b border-gray-100 sticky top-0 bg-white">
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="Search token..."
                  className="w-full h-6 text-xs px-2 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                  autoFocus
                />
              </div>
              {filteredAssets.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => addAsset(symbol)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 text-[11px] hover:bg-gray-50 text-left"
                >
                  <TokenIcon symbol={symbol} size={14} />
                  <span className="font-medium flex-1">{symbol}</span>
                  {isStablecoinSymbol(symbol) && (
                    <span className="text-[8px] text-gray-300">stable</span>
                  )}
                </button>
              ))}
              {filteredAssets.length === 0 && (
                <p className="text-[10px] text-gray-300 text-center py-2">No tokens found</p>
              )}
            </div>
          )}
        </div>

        {priceChanges.length > 0 && (
          <button
            onClick={reset}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>
        )}
      </div>

      {/* Row 2: Compact token pills (horizontal, limited height) */}
      {priceChanges.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {visibleChanges.map((pc) => (
            <div
              key={pc.symbol}
              className="flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5"
            >
              <TokenIcon symbol={pc.symbol} size={12} />
              <span className="text-[10px] font-medium text-[#303549] max-w-[60px] truncate">{pc.symbol}</span>
              <input
                type="number"
                value={pc.percentChange}
                onChange={(e) => updateAsset(pc.symbol, Number(e.target.value) || 0)}
                className={`w-12 h-4 text-[10px] text-center font-semibold rounded border outline-none ${
                  pc.percentChange < 0
                    ? "border-red-200 text-red-600 bg-red-50"
                    : pc.percentChange > 0
                    ? "border-green-200 text-green-600 bg-green-50"
                    : "border-gray-200 text-gray-400"
                }`}
                step="5"
              />
              <span className="text-[8px] text-gray-300">%</span>
              <button
                onClick={() => removeAsset(pc.symbol)}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {!expanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-0.5 text-[10px] text-[#5382E3] font-medium hover:underline cursor-pointer"
            >
              +{hiddenCount} more
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          {expanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Collapse
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Suggestions: related tokens */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap bg-blue-50 border border-blue-100 rounded-md px-2 py-1">
          <Link2 className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="text-[10px] text-blue-600 mr-0.5">Related:</span>
          {suggestions.map((s) => (
            <button
              key={s.symbol}
              onClick={() => addSuggested(s.symbol, s.relatedTo)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <TokenIcon symbol={s.symbol} size={12} />
              {s.symbol}
            </button>
          ))}
          <button onClick={dismissSuggestions} className="text-blue-300 hover:text-blue-500 ml-auto">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {priceChanges.length === 0 && (
        <p className="text-[10px] text-gray-400">
          Select a preset or add tokens to simulate price changes.
        </p>
      )}
    </div>
  );
}
