"use client";

import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { AlertTriangle } from "lucide-react";
import {
  SimAction,
  RawUserReserve,
  FormattedReserve,
  BaseCurrencyData,
} from "@/src/lib/aave/types";
import {
  recalculatePosition,
  applyCollateralToggle,
} from "@/src/lib/aave/calculator";
import { formatQty, formatUSD } from "@/src/lib/format";

interface CollateralToggleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (action: SimAction) => void;
  symbol: string;
  underlyingAsset: string;
  currentlyEnabled: boolean;
  supplyBalance: number;
  supplyBalanceUSD: number;
  currentHF: number;
  // Simulation state for HF preview
  rawUserReserves: RawUserReserve[];
  formattedPoolReserves: FormattedReserve[];
  baseCurrencyData: BaseCurrencyData;
  userEmodeCategoryId: number;
}

const CollateralToggleModal: React.FC<CollateralToggleModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  symbol,
  underlyingAsset,
  currentlyEnabled,
  supplyBalance,
  supplyBalanceUSD,
  currentHF,
  rawUserReserves,
  formattedPoolReserves,
  baseCurrencyData,
  userEmodeCategoryId,
}) => {
  const newState = !currentlyEnabled;

  // Compute projected HF after toggle
  const projection = useMemo(() => {
    const clonedReserves: RawUserReserve[] = JSON.parse(
      JSON.stringify(rawUserReserves)
    );
    const updatedReserves = applyCollateralToggle(
      clonedReserves,
      underlyingAsset,
      newState
    );

    const newHFData = recalculatePosition(
      updatedReserves,
      formattedPoolReserves,
      baseCurrencyData,
      userEmodeCategoryId
    );

    return {
      newHF: newHFData.healthFactor,
      newAvailableBorrows: newHFData.availableBorrowsUSD,
      newTotalCollateralMRC: newHFData.totalCollateralMarketReferenceCurrency,
    };
  }, [
    rawUserReserves,
    formattedPoolReserves,
    baseCurrencyData,
    userEmodeCategoryId,
    underlyingAsset,
    newState,
  ]);

  const handleConfirm = () => {
    const action: SimAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "toggle_collateral",
      symbol,
      useAsCollateral: newState,
      timestamp: Date.now(),
    };
    onExecute(action);
    onClose();
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

  const wouldLiquidate =
    isFinite(projection.newHF) && projection.newHF < 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center">
            {newState ? "Enable" : "Disable"} {symbol} as collateral
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Asset info */}
          <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
            <p className="text-sm text-[#303549] font-medium">Supply balance</p>
            <p className="text-sm font-normal text-[#939393]">
              {formatQty(supplyBalance)} {symbol}{" "}
              <span className="text-gray-400">(${formatUSD(supplyBalanceUSD)})</span>
            </p>
          </div>

          {/* Explanation */}
          <div className="p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg text-xs text-gray-600">
            {newState ? (
              <p>
                Enabling collateral means this asset will back your borrows, increasing your borrowing capacity and health factor.
              </p>
            ) : (
              <p>
                Disabling collateral means this asset will no longer back your borrows. Your health factor and borrowing capacity will decrease.
              </p>
            )}
          </div>

          {/* HF impact */}
          <div className="space-y-2 p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg">
            <p className="text-xs font-medium text-[#303549] mb-1">
              Health Factor Impact
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Current</span>
              <span className={`font-semibold ${hfColor(currentHF)}`}>
                {formatHF(currentHF)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">After toggle</span>
              <span className={`font-semibold ${hfColor(projection.newHF)}`}>
                {formatHF(projection.newHF)}
                {isFinite(projection.newHF) &&
                  isFinite(currentHF) &&
                  projection.newHF < 1e10 &&
                  currentHF < 1e10 && (
                    <span className="text-[11px] text-gray-400 font-normal ml-1">
                      ({projection.newHF > currentHF ? "+" : ""}
                      {(projection.newHF - currentHF).toFixed(2)})
                    </span>
                  )}
              </span>
            </div>
          </div>

          {/* Warning */}
          {wouldLiquidate && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Disabling collateral would trigger liquidation (HF &lt; 1)
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-4">
            <Button
              onClick={handleConfirm}
              disabled={wouldLiquidate}
              className="bg-[#4F7FFA] text-sm font-medium hover:bg-blue-600 w-1/2"
            >
              {newState ? "Enable" : "Disable"}
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

export default CollateralToggleModal;
