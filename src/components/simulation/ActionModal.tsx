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
  SimActionType,
  AssetDetails,
  FormattedReserve,
  RawUserReserve,
  BaseCurrencyData,
} from "@/src/lib/aave/types";
import { calculateRatesForReserve } from "@/src/lib/aave/rates";
import {
  recalculatePosition,
  applySupply,
  applyBorrow,
  applyRepay,
  applyWithdraw,
} from "@/src/lib/aave/calculator";
import { EngineState } from "@/src/lib/simulation/types";
import BigNumber from "bignumber.js";
import { AlertTriangle } from "lucide-react";
import { formatQty, formatUSD } from "@/src/lib/format";

export interface SimulationStateForPreview {
  rawUserReserves: RawUserReserve[];
  formattedPoolReserves: FormattedReserve[];
  baseCurrencyData: BaseCurrencyData;
  userEmodeCategoryId: number;
  marketReferenceCurrencyPriceInUSD: number;
}

type RepaySource = "wallet" | "collateral";

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (action: SimAction) => void;
  actionType: SimActionType;
  asset: AssetDetails;
  currentHF: number;
  maxAmount?: number;
  maxAmountCollateral?: number; // for repay from collateral
  formattedReserve?: FormattedReserve;
  simulationState?: SimulationStateForPreview;
  durationDays?: number;
  effectivePrice?: number;
}

const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  actionType,
  asset,
  currentHF,
  maxAmount,
  maxAmountCollateral,
  formattedReserve,
  simulationState,
  durationDays,
  effectivePrice,
}) => {
  const [amount, setAmount] = useState("");
  const [repaySource, setRepaySource] = useState<RepaySource>("wallet");

  const numAmount = parseFloat(amount || "0");

  const handleExecute = () => {
    if (isNaN(numAmount) || numAmount <= 0) return;

    const action: SimAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: actionType,
      symbol: asset.symbol,
      amount: numAmount,
      useAsCollateral: actionType === "supply" ? true : undefined,
      repayFromCollateral: actionType === "repay" && repaySource === "collateral" ? true : undefined,
      timestamp: Date.now(),
    };

    onExecute(action);
    setAmount("");
    onClose();
  };

  // Effective max depends on repay source
  const effectiveMax = actionType === "repay" && repaySource === "collateral"
    ? maxAmountCollateral
    : maxAmount;

  const handleMax = () => {
    if (effectiveMax !== undefined && effectiveMax > 0) {
      setAmount(String(effectiveMax));
    }
  };

  // Rate impact preview
  const rateImpact = useMemo(() => {
    if (!formattedReserve || !numAmount || numAmount <= 0) return null;
    if (actionType === "price_change") return null;

    const totalDebt = new BigNumber(formattedReserve.totalDebt || "0");
    const totalLiquidity = new BigNumber(formattedReserve.totalLiquidity || "0");

    let newDebt = totalDebt;
    let newLiquidity = totalLiquidity;

    switch (actionType) {
      case "supply":
        newLiquidity = totalLiquidity.plus(numAmount);
        break;
      case "withdraw":
        newLiquidity = BigNumber.max(totalLiquidity.minus(numAmount), 0);
        break;
      case "borrow":
        newDebt = totalDebt.plus(numAmount);
        break;
      case "repay":
        newDebt = BigNumber.max(totalDebt.minus(numAmount), 0);
        if (repaySource === "collateral") {
          // Collateral repay also withdraws from supply
          newLiquidity = BigNumber.max(totalLiquidity.minus(numAmount), 0);
        }
        break;
    }

    const currentRates = calculateRatesForReserve(formattedReserve, totalDebt, totalLiquidity);
    const newRates = calculateRatesForReserve(formattedReserve, newDebt, newLiquidity);

    return { current: currentRates, projected: newRates };
  }, [formattedReserve, numAmount, actionType, repaySource]);

  // Health factor projection: immediate + async temporal simulation
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
    if (!simulationState || !numAmount || numAmount <= 0) {
      setHfProjection(null);
      return;
    }
    if (actionType === "price_change") {
      setHfProjection(null);
      return;
    }

    const reserves = simulationState.formattedPoolReserves;
    const reserve = reserves.find((r: FormattedReserve) => r.symbol === asset.symbol);
    if (!reserve?.underlyingAsset) {
      setHfProjection(null);
      return;
    }

    // Deep clone and apply action
    let newRawReserves: RawUserReserve[] = JSON.parse(
      JSON.stringify(simulationState.rawUserReserves)
    );

    switch (actionType) {
      case "supply":
        newRawReserves = applySupply(newRawReserves, reserves, reserve.underlyingAsset, numAmount, true);
        break;
      case "borrow":
        newRawReserves = applyBorrow(newRawReserves, reserves, reserve.underlyingAsset, numAmount);
        break;
      case "repay":
        if (repaySource === "collateral") {
          newRawReserves = applyWithdraw(newRawReserves, reserves, reserve.underlyingAsset, numAmount);
        }
        newRawReserves = applyRepay(newRawReserves, reserves, reserve.underlyingAsset, numAmount);
        break;
      case "withdraw":
        newRawReserves = applyWithdraw(newRawReserves, reserves, reserve.underlyingAsset, numAmount);
        break;
    }

    // Compute immediate HF after action (stays client-side — uses open-source Aave formulas)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const newHFData = recalculatePosition(
      newRawReserves,
      reserves,
      simulationState.baseCurrencyData,
      simulationState.userEmodeCategoryId,
      currentTimestamp
    );
    const immediateHF = newHFData.healthFactor;

    // Show immediate HF right away, then fetch temporal projection
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
      .catch(() => {
        // On error, keep immediate HF projection
      })
      .finally(() => {
        if (currentRequestId === hfRequestIdRef.current) {
          setHfLoading(false);
        }
      });
  }, [simulationState, numAmount, actionType, asset.symbol, durationDays, repaySource]);

  const titles: Record<SimActionType, string> = {
    supply: `Supply ${asset.symbol}`,
    borrow: `Borrow ${asset.symbol}`,
    repay: `Repay ${asset.symbol}`,
    withdraw: `Withdraw ${asset.symbol}`,
    price_change: `Change ${asset.symbol} price`,
    toggle_collateral: `Toggle ${asset.symbol} collateral`,
    set_emode: `Set E-Mode`,
    set_wallet_balance: `Set ${asset.symbol} wallet balance`,
  };

  const formatAPY = (v: number) => (v * 100).toFixed(2) + "%";

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center">
            {titles[actionType]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
            <p className="text-sm text-[#303549] font-medium">Asset</p>
            <p className="text-sm font-normal text-[#939393]">
              {asset.symbol} — ${formatUSD(effectivePrice ?? asset.priceInUSD)}
            </p>
          </div>

          {/* Repay source toggle */}
          {actionType === "repay" && maxAmountCollateral !== undefined && maxAmountCollateral > 0 && (
            <div className="flex gap-2 p-1 bg-[#F0F0F0] rounded-lg">
              <button
                type="button"
                onClick={() => { setRepaySource("wallet"); setAmount(""); }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                  repaySource === "wallet"
                    ? "bg-white text-[#303549]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Wallet
              </button>
              <button
                type="button"
                onClick={() => { setRepaySource("collateral"); setAmount(""); }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                  repaySource === "collateral"
                    ? "bg-white text-[#303549]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Collateral
              </button>
            </div>
          )}

          <div className="p-4 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm text-[#303549] font-medium">
                Amount ({asset.symbol})
              </label>
              {effectiveMax !== undefined && effectiveMax > 0 && (
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
              className="w-full h-10 rounded-lg text-sm p-3 border border-gray-300 focus:outline-sky-400"
              min="0"
              step="any"
            />
            <div className="flex justify-between">
              {amount && (
                <p className="text-xs text-gray-500">
                  ≈ ${formatUSD(parseFloat(amount || "0") * (effectivePrice ?? asset.priceInUSD))}
                </p>
              )}
              {effectiveMax !== undefined && effectiveMax > 0 && (
                <p className="text-xs text-gray-400 ml-auto">
                  Max: {formatQty(effectiveMax)} {asset.symbol}
                  {actionType === "repay" && repaySource === "collateral" && (
                    <span className="text-gray-300 ml-1">(from supply)</span>
                  )}
                  {actionType === "repay" && repaySource === "wallet" && (
                    <span className="text-gray-300 ml-1">(from wallet)</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Health Factor Impact */}
          <div className="space-y-2 p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg">
            <p className="text-xs font-medium text-[#303549] mb-1">Health Factor</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Current</span>
              <span className={`font-semibold ${hfColor(currentHF)}`}>
                {formatHF(currentHF)}
              </span>
            </div>
            {hfProjection && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">After action</span>
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

                {/* Temporal projection warning */}
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

            {/* Warning banners */}
            {hfProjection && isFinite(hfProjection.immediateHF) && hfProjection.immediateHF < 0.95 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>HF &lt; 0.95 — 100% close factor, position can be fully liquidated in one call</span>
              </div>
            )}
            {hfProjection && isFinite(hfProjection.immediateHF) && hfProjection.immediateHF >= 0.95 && hfProjection.immediateHF < 1 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>HF &lt; 1 — position is liquidatable (50% close factor)</span>
              </div>
            )}

            {hfProjection &&
              isFinite(hfProjection.immediateHF) &&
              hfProjection.immediateHF >= 1 &&
              hfProjection.liquidationDay !== undefined && (
                <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Interest accrual would cause liquidation on day {hfProjection.liquidationDay}
                  </span>
                </div>
              )}

            {hfProjection &&
              isFinite(hfProjection.lowestHF) &&
              hfProjection.lowestHF >= 1 &&
              hfProjection.lowestHF < 1.1 &&
              hfProjection.liquidationDay === undefined && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    HF drops to {hfProjection.lowestHF.toFixed(2)} by day {hfProjection.lowestHFDay} — close to liquidation
                  </span>
                </div>
              )}
          </div>

          {/* Rate impact preview */}
          {rateImpact && (
            <div className="p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-1">
              <p className="text-xs font-medium text-[#303549] mb-1">Rate Impact</p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Supply APY</span>
                <span>
                  {formatAPY(rateImpact.current.supplyAPY)}
                  <span className="text-gray-400 mx-1">&rarr;</span>
                  <span className={
                    rateImpact.projected.supplyAPY > rateImpact.current.supplyAPY
                      ? "text-green-600"
                      : rateImpact.projected.supplyAPY < rateImpact.current.supplyAPY
                        ? "text-blue-800"
                        : ""
                  }>
                    {formatAPY(rateImpact.projected.supplyAPY)}
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Borrow APY</span>
                <span>
                  {formatAPY(rateImpact.current.variableBorrowAPY)}
                  <span className="text-gray-400 mx-1">&rarr;</span>
                  <span className={
                    rateImpact.projected.variableBorrowAPY < rateImpact.current.variableBorrowAPY
                      ? "text-green-600"
                      : rateImpact.projected.variableBorrowAPY > rateImpact.current.variableBorrowAPY
                        ? "text-blue-800"
                        : ""
                  }>
                    {formatAPY(rateImpact.projected.variableBorrowAPY)}
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Utilization</span>
                <span>
                  {(rateImpact.current.utilizationRate * 100).toFixed(1)}%
                  <span className="text-gray-400 mx-1">&rarr;</span>
                  {(rateImpact.projected.utilizationRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-4">
            <Button
              onClick={handleExecute}
              disabled={!amount || parseFloat(amount) <= 0}
              className="bg-[#4F7FFA] text-sm font-medium hover:bg-blue-600 w-1/2"
            >
              {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
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

export default ActionModal;
