"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { SimAction } from "@/src/lib/aave/types";

interface PriceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (action: SimAction) => void;
  symbol: string;
  currentPrice: number;
  initialPrice: number;
}

const PriceEditor: React.FC<PriceEditorProps> = ({
  isOpen,
  onClose,
  onExecute,
  symbol,
  currentPrice,
  initialPrice,
}) => {
  const [newPrice, setNewPrice] = useState(String(currentPrice));
  const [percentChange, setPercentChange] = useState("0");

  const handlePriceChange = (value: string) => {
    setNewPrice(value);
    const num = parseFloat(value);
    if (!isNaN(num) && currentPrice > 0) {
      setPercentChange((((num - currentPrice) / currentPrice) * 100).toFixed(1));
    }
  };

  const handlePercentChange = (value: string) => {
    setPercentChange(value);
    const pct = parseFloat(value);
    if (!isNaN(pct)) {
      const computed = currentPrice * (1 + pct / 100);
      setNewPrice(computed.toFixed(2));
    }
  };

  const handleApply = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;

    const action: SimAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "price_change",
      symbol,
      newPriceUSD: price,
      timestamp: Date.now(),
    };

    onExecute(action);
    onClose();
  };

  const presets = [-50, -25, -10, 10, 25, 50];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center">
            Edit {symbol} Price
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
            <p className="text-sm text-[#303549] font-medium">Initial price</p>
            <p className="text-sm font-normal text-[#939393]">
              ${initialPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Price input */}
          <div className="p-4 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-3">
            <div>
              <label className="text-sm text-[#303549] font-medium">
                New price (USD)
              </label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="w-full h-10 rounded-lg text-sm p-3 border border-gray-300 focus:outline-sky-400 mt-1"
                min="0"
                step="any"
              />
            </div>
            <div>
              <label className="text-sm text-[#303549] font-medium">
                % change from current
              </label>
              <input
                type="number"
                value={percentChange}
                onChange={(e) => handlePercentChange(e.target.value)}
                className="w-full h-10 rounded-lg text-sm p-3 border border-gray-300 focus:outline-sky-400 mt-1"
                step="any"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 justify-center">
            {presets.map((pct) => (
              <Button
                key={pct}
                variant="outline"
                size="sm"
                className={`text-xs px-3 ${
                  pct < 0
                    ? "text-red-600 hover:bg-red-50"
                    : "text-green-600 hover:bg-green-50"
                }`}
                onClick={() => handlePercentChange(String(pct))}
              >
                {pct > 0 ? "+" : ""}
                {pct}%
              </Button>
            ))}
          </div>

          <div className="flex justify-between gap-4">
            <Button
              onClick={handleApply}
              disabled={!newPrice || parseFloat(newPrice) <= 0}
              className="bg-[#4F7FFA] text-sm font-medium hover:bg-blue-600 w-1/2"
            >
              Apply
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

export default PriceEditor;
