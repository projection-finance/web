"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { AlertTriangle, Check, X } from "lucide-react";
import {
  SimAction,
  RawUserReserve,
  FormattedReserve,
  BaseCurrencyData,
  BorrowedAssetDataItem,
} from "@/src/lib/aave/types";
import { recalculatePosition } from "@/src/lib/aave/calculator";
import { EmodeCategory, isEModeAvailable } from "@/src/lib/aave/emode";

interface EmodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (action: SimAction) => void;
  currentEmodeCategoryId: number;
  emodeCategories: EmodeCategory[];
  userBorrows: BorrowedAssetDataItem[];
  currentHF: number;
  rawUserReserves: RawUserReserve[];
  formattedPoolReserves: FormattedReserve[];
  baseCurrencyData: BaseCurrencyData;
}

const EmodeModal: React.FC<EmodeModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  currentEmodeCategoryId,
  emodeCategories,
  userBorrows,
  currentHF,
  rawUserReserves,
  formattedPoolReserves,
  baseCurrencyData,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(
    currentEmodeCategoryId
  );

  const selectedCategory = emodeCategories.find(
    (c) => c.id === selectedCategoryId
  );

  // Check availability for each category
  const categoryAvailability = useMemo(() => {
    const borrowAssets = userBorrows.map((b) => ({
      underlyingAsset: b.asset.underlyingAsset ?? "",
      symbol: b.asset.symbol,
    }));

    return emodeCategories.map((cat) => ({
      ...cat,
      ...isEModeAvailable(cat.id, emodeCategories, borrowAssets),
    }));
  }, [emodeCategories, userBorrows]);

  // Compute projected HF
  const projection = useMemo(() => {
    if (selectedCategoryId === currentEmodeCategoryId) return null;

    const clonedReserves: RawUserReserve[] = JSON.parse(
      JSON.stringify(rawUserReserves)
    );

    const newHFData = recalculatePosition(
      clonedReserves,
      formattedPoolReserves,
      baseCurrencyData,
      selectedCategoryId
    );

    return {
      newHF: newHFData.healthFactor,
    };
  }, [
    rawUserReserves,
    formattedPoolReserves,
    baseCurrencyData,
    selectedCategoryId,
    currentEmodeCategoryId,
  ]);

  const handleConfirm = () => {
    if (selectedCategoryId === currentEmodeCategoryId) return;

    const action: SimAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "set_emode",
      symbol: "E-Mode",
      newEmodeCategoryId: selectedCategoryId,
      timestamp: Date.now(),
    };
    onExecute(action);
    onClose();
  };

  const formatHF = (hf: number) => {
    if (!isFinite(hf) || hf > 1e10) return "\u221E";
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
    projection && isFinite(projection.newHF) && projection.newHF < 1;

  const lowHFWarning =
    projection &&
    isFinite(projection.newHF) &&
    projection.newHF >= 1 &&
    projection.newHF < 1.01;

  const selectedAvailability = categoryAvailability.find(
    (c) => c.id === selectedCategoryId
  );
  const isUnavailable =
    selectedAvailability && !selectedAvailability.available;

  const hasChanged = selectedCategoryId !== currentEmodeCategoryId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center">
            E-Mode Configuration
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Current status */}
          <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
            <p className="text-sm text-[#303549] font-medium">Current E-Mode</p>
            <p className="text-sm font-normal text-[#939393]">
              {currentEmodeCategoryId === 0
                ? "Disabled"
                : emodeCategories.find((c) => c.id === currentEmodeCategoryId)
                    ?.label ?? `Category ${currentEmodeCategoryId}`}
            </p>
          </div>

          {/* Category selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[#303549]">
              Select E-Mode Category
            </p>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {categoryAvailability.map((cat) => {
                const isActive = cat.id === currentEmodeCategoryId;
                const isSelected = cat.id === selectedCategoryId;
                const isDisabled = !cat.available && cat.id !== currentEmodeCategoryId;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    title={isDisabled && cat.reason
                      ? `Repay your incompatible borrows first to enable this E-Mode category`
                      : undefined}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-[#4F7FFA] bg-blue-50/50"
                        : "border-slate-200 hover:border-slate-300"
                    } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#303549]">
                          {cat.label}
                        </span>
                        {isActive && (
                          <Badge className="bg-green-50 text-green-600 text-[9px] px-1.5 py-0">
                            Active
                          </Badge>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-[#4F7FFA] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    {cat.id !== 0 && (
                      <div className="flex gap-3 mt-1 text-[11px] text-gray-500">
                        <span>
                          LTV {(Number(cat.ltv) / 100).toFixed(0)}%
                        </span>
                        <span>
                          Liq. Threshold{" "}
                          {(Number(cat.liquidationThreshold) / 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {isDisabled && cat.reason && (
                      <div className="flex items-start gap-1.5 mt-1.5 p-1.5 bg-red-50 rounded text-[10px] text-red-600">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                        <span>
                          {cat.reason} — repay this position first to switch
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected category's eligible assets */}
          {selectedCategory && selectedCategory.id !== 0 && (
            <div className="p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg">
              <p className="text-xs font-medium text-[#303549] mb-2">
                Eligible Assets
              </p>
              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400 font-medium pb-1 border-b border-slate-100">
                  <span>Asset</span>
                  <span className="text-center">Collateral</span>
                  <span className="text-center">Borrowable</span>
                </div>
                {selectedCategory.assets.map((asset) => (
                  <div
                    key={asset.underlyingAsset}
                    className="grid grid-cols-3 gap-2 text-xs py-0.5"
                  >
                    <span className="text-[#303549] font-medium">
                      {asset.symbol}
                    </span>
                    <span className="text-center">
                      {asset.collateral ? (
                        <Check className="w-3.5 h-3.5 text-green-500 inline" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-400 inline" />
                      )}
                    </span>
                    <span className="text-center">
                      {asset.borrowable ? (
                        <Check className="w-3.5 h-3.5 text-green-500 inline" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-400 inline" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HF impact */}
          {hasChanged && (
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
              {projection && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">After change</span>
                  <span
                    className={`font-semibold ${hfColor(projection.newHF)}`}
                  >
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
              )}
            </div>
          )}

          {/* Warnings */}
          {wouldLiquidate && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                This E-Mode change would trigger liquidation (HF &lt; 1)
              </span>
            </div>
          )}

          {lowHFWarning && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Warning: Health factor would drop below 1.01 (
                {projection!.newHF.toFixed(4)})
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-4">
            <Button
              onClick={handleConfirm}
              disabled={
                !hasChanged || !!wouldLiquidate || !!isUnavailable
              }
              className="bg-[#4F7FFA] text-sm font-medium hover:bg-blue-600 w-1/2"
            >
              Apply E-Mode
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

export default EmodeModal;
