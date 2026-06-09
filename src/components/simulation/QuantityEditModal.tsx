"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import TokenIcon from "@/src/components/ui/TokenIcon";

interface QuantityEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentBalance: number;
  currentBalanceUSD: number;
  priceUSD: number;
  onConfirm: (newBalance: number) => void;
  mode?: "wallet" | "supply";
}

export default function QuantityEditModal({
  isOpen,
  onClose,
  symbol,
  currentBalance,
  currentBalanceUSD,
  priceUSD,
  onConfirm,
  mode = "wallet",
}: QuantityEditModalProps) {
  const isSupply = mode === "supply";
  const [newBalance, setNewBalance] = useState("");

  useEffect(() => {
    if (isOpen) {
      setNewBalance(currentBalance.toString());
    }
  }, [isOpen, currentBalance]);

  const handleConfirm = () => {
    const value = parseFloat(newBalance);
    if (isNaN(value) || value < 0) return;
    onConfirm(value);
    onClose();
  };

  const newBalanceUSD = (parseFloat(newBalance) || 0) * priceUSD;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TokenIcon symbol={symbol} size={24} />
            <span>Edit {symbol} {isSupply ? "Supply" : "Wallet"} Balance</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Balance */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-gray-500">Current {isSupply ? "Supply" : "Wallet"} Balance</p>
            <p className="text-sm font-medium">{currentBalance.toFixed(6)} {symbol}</p>
            <p className="text-xs text-gray-500">${currentBalanceUSD.toFixed(2)}</p>
          </div>

          {/* New Balance Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Simulated {isSupply ? "Supply" : "Wallet"} Balance</label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="0.00"
                step="any"
                min="0"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewBalance("0")}
              >
                Zero
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              ≈ ${newBalanceUSD.toFixed(2)} at ${priceUSD.toFixed(2)}/token
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              This simulates having <strong>{parseFloat(newBalance) || 0}</strong> {symbol} {isSupply ? "supplied" : "in your wallet"} for simulation purposes.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleConfirm}
              disabled={parseFloat(newBalance) < 0 || isNaN(parseFloat(newBalance))}
              className="flex-1 bg-[#4F7FFA] hover:bg-blue-600"
            >
              Confirm
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
