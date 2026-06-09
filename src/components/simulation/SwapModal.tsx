"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import {
  SimAction,
  AssetDetails,
  FormattedReserve,
  RawUserReserve,
  BaseCurrencyData,
} from "@/src/lib/aave/types";
import {
  recalculatePosition,
  applyWithdraw,
  applySupply,
} from "@/src/lib/aave/calculator";
import { EngineState } from "@/src/lib/simulation/types";
import { AlertTriangle, ArrowDownUp, ChevronDown } from "lucide-react";
import { formatQty, formatUSD } from "@/src/lib/format";
import TokenIcon from "@/src/components/ui/TokenIcon";
import { EmodeCategory } from "@/src/lib/aave/emode";

interface SimulationStateForPreview {
  rawUserReserves: RawUserReserve[];
  formattedPoolReserves: FormattedReserve[];
  baseCurrencyData: BaseCurrencyData;
  userEmodeCategoryId: number;
  marketReferenceCurrencyPriceInUSD: number;
}

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (action: SimAction) => void;
  sourceAsset: AssetDetails;
  sourceBalance: number;
  availableTargets: AssetDetails[];
  currentHF: number;
  simulationState?: SimulationStateForPreview;
  durationDays?: number;
  effectivePrices: Record<string, number>;
  currentEmodeCategoryId: number;
  emodeCategories: EmodeCategory[];
}

const SwapModal: React.FC<SwapModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  sourceAsset,
  sourceBalance,
  availableTargets,
  currentHF,
  simulationState,
  durationDays,
  effectivePrices,
  currentEmodeCategoryId,
  emodeCategories,
}) => {
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5); // 0.5% default
  const [targetSymbol, setTargetSymbol] = useState("");
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setSlippage(0.5);
      setTargetSymbol(availableTargets[0]?.symbol || "");
      setShowTargetPicker(false);
      setTargetSearch("");
    }
  }, [isOpen, availableTargets]);

  const numAmount = parseFloat(amount || "0");
  const sourcePrice = effectivePrices[sourceAsset.symbol] ?? sourceAsset.priceInUSD;
  const targetAsset = availableTargets.find((a) => a.symbol === targetSymbol);
  const targetPrice = targetAsset ? (effectivePrices[targetAsset.symbol] ?? targetAsset.priceInUSD) : 0;

  // Calculate output amount after slippage
  const rawOutputAmount = targetPrice > 0 ? (numAmount * sourcePrice) / targetPrice : 0;
  const outputAmount = rawOutputAmount * (1 - slippage / 100);
  const slippageImpactUSD = rawOutputAmount * targetPrice - outputAmount * targetPrice;

  // Check if target is collateralizable
  const targetIsCollateral = targetAsset?.usageAsCollateralEnabled ?? false;

  // Check e-mode compatibility
  const emodeInfo = useMemo(() => {
    if (currentEmodeCategoryId === 0 || !targetAsset) return null;
    const category = emodeCategories.find((c) => c.id === currentEmodeCategoryId);
    if (!category) return null;
    const targetInEmode = category.assets.some(
      (a) => a.symbol === targetAsset.symbol
    );
    return {
      categoryLabel: category.label,
      targetInEmode,
    };
  }, [currentEmodeCategoryId, emodeCategories, targetAsset]);

  // HF projection
  const [hfProjection, setHfProjection] = useState<{
    immediateHF: number;
    lowestHF: number;
    lowestHFDay: number;
    liquidationDay?: number;
    simDays: number;
  } | null>(null);
  const [hfLoading, setHfLoading] = useState(false);
  const hfRequestIdRef = useRef(0);

  useEffect(() => {
    if (!simulationState || !numAmount || numAmount <= 0 || !targetAsset) {
      setHfProjection(null);
      return;
    }

    const reserves = simulationState.formattedPoolReserves;
    const sourceReserve = reserves.find((r: FormattedReserve) => r.symbol === sourceAsset.symbol);
    const targetReserve = reserves.find((r: FormattedReserve) => r.symbol === targetAsset.symbol);
    if (!sourceReserve?.underlyingAsset || !targetReserve?.underlyingAsset) {
      setHfProjection(null);
      return;
    }

    // Clone and apply: withdraw source, supply target
    let newRawReserves: RawUserReserve[] = JSON.parse(
      JSON.stringify(simulationState.rawUserReserves)
    );
    newRawReserves = applyWithdraw(newRawReserves, reserves, sourceReserve.underlyingAsset, numAmount);
    newRawReserves = applySupply(newRawReserves, reserves, targetReserve.underlyingAsset, outputAmount, true);

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const newHFData = recalculatePosition(
      newRawReserves,
      reserves,
      simulationState.baseCurrencyData,
      simulationState.userEmodeCategoryId,
      currentTimestamp
    );
    const immediateHF = newHFData.healthFactor;

    const simDays = Math.min(durationDays || 30, 90);
    setHfProjection({ immediateHF, lowestHF: immediateHF, lowestHFDay: 0, liquidationDay: undefined, simDays });

    const currentRequestId = ++hfRequestIdRef.current;
    setHfLoading(true);

    const initialState: EngineState = {
      rawUserReserves: newRawReserves,
      formattedPoolReserves: JSON.parse(JSON.stringify(reserves)),
      baseCurrencyData: JSON.parse(JSON.stringify(simulationState.baseCurrencyData)),
      userEmodeCategoryId: simulationState.userEmodeCategoryId,
      marketReferenceCurrencyPriceInUSD: simulationState.marketReferenceCurrencyPriceInUSD,
      healthFactorData: newHFData,
    };

    fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          durationDays: simDays,
          priceScenarios: [],
          rateScenarios: [],
          scheduledActions: [],
        },
        initialState,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (currentRequestId !== hfRequestIdRef.current || !data) return;
        setHfProjection({
          immediateHF,
          lowestHF: data.result.summary.lowestHealthFactor,
          lowestHFDay: data.result.summary.lowestHealthFactorDay,
          liquidationDay: data.result.summary.liquidationDay,
          simDays,
        });
      })
      .catch((err) => { console.warn("[SwapModal] HF projection failed:", err.message); })
      .finally(() => {
        if (currentRequestId === hfRequestIdRef.current) {
          setHfLoading(false);
        }
      });
  }, [simulationState, numAmount, sourceAsset.symbol, targetAsset, outputAmount, durationDays]);

  const handleExecute = () => {
    if (isNaN(numAmount) || numAmount <= 0 || !targetAsset) return;

    // Execute as two actions: withdraw source + supply target
    const withdrawAction: SimAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "withdraw",
      symbol: sourceAsset.symbol,
      amount: numAmount,
      timestamp: Date.now(),
    };
    onExecute(withdrawAction);

    const supplyAction: SimAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "supply",
      symbol: targetAsset.symbol,
      amount: outputAmount,
      useAsCollateral: true,
      timestamp: Date.now(),
    };
    onExecute(supplyAction);

    setAmount("");
    onClose();
  };

  const handleMax = () => {
    if (sourceBalance > 0) {
      setAmount(String(sourceBalance));
    }
  };

  const formatHF = (hf: number) => {
    if (!isFinite(hf) || hf > 1e10) return "∞";
    return hf.toFixed(2);
  };

  const hfColor = (hf: number) => {
    if (!isFinite(hf) || hf > 1e10) return "text-green-600";
    if (hf < 0.95) return "text-red-600";
    if (hf < 1) return "text-red-500";
    if (hf < 1.1) return "text-blue-800";
    if (hf < 1.5) return "text-blue-600";
    return "text-green-600";
  };

  const filteredTargets = useMemo(() => {
    if (!targetSearch.trim()) return availableTargets;
    const q = targetSearch.toLowerCase();
    return availableTargets.filter(
      (a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [availableTargets, targetSearch]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center flex items-center justify-center gap-2">
            <ArrowDownUp className="w-4 h-4" />
            Swap Supply
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Source */}
          <div className="p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={sourceAsset.symbol} size={24} />
                <span className="text-sm font-medium text-[#303549]">{sourceAsset.symbol}</span>
                <span className="text-xs text-gray-400">${formatUSD(sourcePrice)}</span>
              </div>
              {sourceBalance > 0 && (
                <button
                  type="button"
                  onClick={handleMax}
                  className="text-xs text-[#4F7FFA] font-medium hover:underline"
                >
                  MAX
                </button>
              )}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 rounded-lg text-sm p-3 border border-gray-300 focus:outline-sky-400"
              min="0"
              max={sourceBalance}
              step="any"
            />
            <div className="flex justify-between text-xs text-gray-400">
              {amount && (
                <span>≈ ${formatUSD(numAmount * sourcePrice)}</span>
              )}
              <span className="ml-auto">Balance: {formatQty(sourceBalance)} {sourceAsset.symbol}</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-[#F0F0F0] flex items-center justify-center">
              <ArrowDownUp className="w-4 h-4 text-gray-500" />
            </div>
          </div>

          {/* Target selector */}
          <div className="p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-[#303549]">Receive</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTargetPicker(!showTargetPicker)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  {targetAsset && <TokenIcon symbol={targetAsset.symbol} size={18} />}
                  <span className="text-sm font-medium">{targetSymbol || "Select"}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                {showTargetPicker && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        value={targetSearch}
                        onChange={(e) => setTargetSearch(e.target.value)}
                        placeholder="Search token..."
                        className="w-full h-7 text-xs px-2 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#4F7FFA]"
                        autoFocus
                      />
                    </div>
                    {filteredTargets.map((a) => (
                      <button
                        key={a.symbol}
                        type="button"
                        onClick={() => {
                          setTargetSymbol(a.symbol);
                          setShowTargetPicker(false);
                          setTargetSearch("");
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 text-xs ${
                          a.symbol === targetSymbol ? "bg-blue-50" : ""
                        }`}
                      >
                        <TokenIcon symbol={a.symbol} size={18} />
                        <div className="flex-1">
                          <span className="font-medium">{a.symbol}</span>
                          {!a.usageAsCollateralEnabled && (
                            <span className="text-gray-400 ml-1">(no collateral)</span>
                          )}
                        </div>
                        <span className="text-gray-400">${formatUSD(effectivePrices[a.symbol] ?? a.priceInUSD)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Output preview */}
            <div className="bg-gray-50 rounded-md p-2.5">
              <p className="text-lg font-semibold text-[#303549]">
                {outputAmount > 0 ? formatQty(outputAmount) : "0.00"} {targetSymbol}
              </p>
              {outputAmount > 0 && (
                <p className="text-xs text-gray-400">
                  ≈ ${formatUSD(outputAmount * targetPrice)}
                </p>
              )}
            </div>

            {/* Collateral info */}
            {targetAsset && !targetIsCollateral && (
              <div className="flex items-center gap-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{targetAsset.symbol} cannot be used as collateral</span>
              </div>
            )}

            {/* E-Mode warning */}
            {emodeInfo && !emodeInfo.targetInEmode && (
              <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{targetAsset?.symbol} is not in E-Mode {emodeInfo.categoryLabel} — LTV/LT will differ</span>
              </div>
            )}
          </div>

          {/* Slippage */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-500">Slippage tolerance</span>
            <div className="flex items-center gap-1.5">
              {[0.1, 0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlippage(s)}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    slippage === s
                      ? "bg-[#4F7FFA] text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {s}%
                </button>
              ))}
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                className="w-12 h-5 text-[10px] text-center border border-gray-200 rounded px-1"
                min="0"
                max="50"
                step="0.1"
              />
            </div>
          </div>

          {/* Swap details */}
          {numAmount > 0 && targetAsset && (
            <div className="p-2.5 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Rate</span>
                <span>1 {sourceAsset.symbol} = {formatQty(sourcePrice / targetPrice)} {targetSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Slippage impact</span>
                <span className="text-amber-600">-${formatUSD(slippageImpactUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">You receive</span>
                <span className="font-medium">{formatQty(outputAmount)} {targetSymbol}</span>
              </div>
            </div>
          )}

          {/* Health Factor */}
          <div className="space-y-1.5 p-2.5 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg">
            <p className="text-xs font-medium text-[#303549]">Health Factor</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Current</span>
              <span className={`font-semibold ${hfColor(currentHF)}`}>
                {formatHF(currentHF)}
              </span>
            </div>
            {hfProjection && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">After swap</span>
                  <span className={`font-semibold ${hfColor(hfProjection.immediateHF)}`}>
                    {formatHF(hfProjection.immediateHF)}
                    {isFinite(hfProjection.immediateHF) && isFinite(currentHF) && hfProjection.immediateHF < 1e10 && currentHF < 1e10 && (
                      <span className="text-[11px] text-gray-400 font-normal ml-1">
                        ({hfProjection.immediateHF > currentHF ? "+" : ""}
                        {(hfProjection.immediateHF - currentHF).toFixed(2)})
                      </span>
                    )}
                  </span>
                </div>
                {hfLoading ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Lowest in {hfProjection.simDays}d</span>
                    <span className="text-gray-400 text-xs animate-pulse">computing...</span>
                  </div>
                ) : (
                  isFinite(hfProjection.lowestHF) && hfProjection.lowestHF < 1e10 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Lowest in {hfProjection.simDays}d</span>
                      <span className={`font-semibold ${hfColor(hfProjection.lowestHF)}`}>
                        {formatHF(hfProjection.lowestHF)}
                        <span className="text-[11px] text-gray-400 font-normal ml-1">
                          (day {hfProjection.lowestHFDay})
                        </span>
                      </span>
                    </div>
                  )
                )}
              </>
            )}

            {hfProjection && isFinite(hfProjection.immediateHF) && hfProjection.immediateHF < 0.95 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>HF &lt; 0.95 — 100% close factor, position can be fully liquidated</span>
              </div>
            )}
            {hfProjection && isFinite(hfProjection.immediateHF) && hfProjection.immediateHF >= 0.95 && hfProjection.immediateHF < 1 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>HF &lt; 1 — position is liquidatable (50% close factor)</span>
              </div>
            )}

            {hfProjection && isFinite(hfProjection.immediateHF) && hfProjection.immediateHF >= 1 && hfProjection.liquidationDay !== undefined && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Interest accrual would cause liquidation on day {hfProjection.liquidationDay}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-4">
            <Button
              onClick={handleExecute}
              disabled={!amount || numAmount <= 0 || !targetAsset || numAmount > sourceBalance}
              className="bg-[#4F7FFA] text-sm font-medium hover:bg-blue-600 w-1/2"
            >
              Swap
            </Button>
            <Button
              variant="outline"
              className="text-sm font-medium w-1/2"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SwapModal;
