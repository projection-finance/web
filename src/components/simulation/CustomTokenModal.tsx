"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Switch } from "@/src/components/ui/switch";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import TokenIcon from "@/src/components/ui/TokenIcon";

export interface CustomToken {
  id: string;
  symbol: string;
  name: string;
  priceInUSD: number;
  supplyAPY: number;
  variableBorrowAPY: number;
  baseLTVasCollateral: number;
  reserveLiquidationThreshold: number;
  reserveFactor: number;
  borrowingEnabled: boolean;
  usageAsCollateralEnabled: boolean;
  availableLiquidity: number;
}

interface CustomTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: CustomToken[];
  onAdd: (token: Omit<CustomToken, "id">) => Promise<void>;
  onUpdate: (id: string, token: Partial<CustomToken>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type FormData = {
  symbol: string;
  name: string;
  priceInUSD: string;
  supplyAPY: string;
  variableBorrowAPY: string;
  baseLTVasCollateral: string;
  reserveLiquidationThreshold: string;
  reserveFactor: string;
  borrowingEnabled: boolean;
  usageAsCollateralEnabled: boolean;
  availableLiquidity: string;
};

const defaultForm: FormData = {
  symbol: "",
  name: "",
  priceInUSD: "",
  supplyAPY: "0",
  variableBorrowAPY: "0",
  baseLTVasCollateral: "75",
  reserveLiquidationThreshold: "80",
  reserveFactor: "10",
  borrowingEnabled: true,
  usageAsCollateralEnabled: true,
  availableLiquidity: "1000000",
};

const CustomTokenModal: React.FC<CustomTokenModalProps> = ({
  isOpen,
  onClose,
  tokens,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setError(null);
  };

  const openAdd = () => {
    resetForm();
    setView("form");
  };

  const openEdit = (token: CustomToken) => {
    setEditingId(token.id);
    setForm({
      symbol: token.symbol,
      name: token.name,
      priceInUSD: token.priceInUSD.toString(),
      supplyAPY: (token.supplyAPY * 100).toString(),
      variableBorrowAPY: (token.variableBorrowAPY * 100).toString(),
      baseLTVasCollateral: (token.baseLTVasCollateral * 100).toString(),
      reserveLiquidationThreshold: (token.reserveLiquidationThreshold * 100).toString(),
      reserveFactor: (token.reserveFactor * 100).toString(),
      borrowingEnabled: token.borrowingEnabled,
      usageAsCollateralEnabled: token.usageAsCollateralEnabled,
      availableLiquidity: token.availableLiquidity.toString(),
    });
    setError(null);
    setView("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const price = parseFloat(form.priceInUSD);
    if (!form.symbol.trim() || !form.name.trim() || isNaN(price) || price <= 0) {
      setError("Symbol, name, and a positive price are required.");
      return;
    }

    const payload = {
      symbol: form.symbol.toUpperCase(),
      name: form.name,
      priceInUSD: price,
      supplyAPY: (parseFloat(form.supplyAPY) || 0) / 100,
      variableBorrowAPY: (parseFloat(form.variableBorrowAPY) || 0) / 100,
      baseLTVasCollateral: (parseFloat(form.baseLTVasCollateral) || 75) / 100,
      reserveLiquidationThreshold: (parseFloat(form.reserveLiquidationThreshold) || 80) / 100,
      reserveFactor: (parseFloat(form.reserveFactor) || 10) / 100,
      borrowingEnabled: form.borrowingEnabled,
      usageAsCollateralEnabled: form.usageAsCollateralEnabled,
      availableLiquidity: parseFloat(form.availableLiquidity) || 1000000,
    };

    setSaving(true);
    try {
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onAdd(payload);
      }
      resetForm();
      setView("list");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
    } catch { /* silent */ }
  };

  const handleClose = () => {
    setView("list");
    resetForm();
    onClose();
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base text-[#303549] font-semibold flex items-center gap-2">
              {view === "form" && (
                <button onClick={() => { setView("list"); resetForm(); }} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {view === "list" ? "Custom Tokens" : editingId ? "Edit Token" : "New Custom Token"}
            </DialogTitle>
          </DialogHeader>

          {view === "list" ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              {tokens.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400 mb-3">
                    No custom tokens yet. Create fictitious tokens with custom price, APY, and risk parameters.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {tokens.map((token) => (
                    <div
                      key={token.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-slate-100"
                    >
                      <TokenIcon symbol={token.symbol} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#303549]">{token.symbol}</span>
                          <span className="text-xs text-gray-400">{token.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                          <span>${token.priceInUSD.toLocaleString()}</span>
                          <span>Supply {(token.supplyAPY * 100).toFixed(1)}%</span>
                          <span>Borrow {(token.variableBorrowAPY * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(token)}
                          className="p-1.5 hover:bg-slate-200 rounded text-gray-400 hover:text-[#5382E3]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(token.id)}
                          className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3">
                <Button
                  onClick={openAdd}
                  className="w-full bg-[#5382E3] hover:bg-[#4270D0] text-sm h-9 gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add custom token
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 space-y-3">
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              {/* Symbol & Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Symbol</label>
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={(e) => updateField("symbol", e.target.value)}
                    placeholder="e.g. TOTO"
                    className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#5382E3] uppercase"
                    required
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="e.g. Toto Token"
                    className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                    required
                  />
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Price (USD)</label>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    value={form.priceInUSD}
                    onChange={(e) => updateField("priceInUSD", e.target.value)}
                    placeholder="100"
                    className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                    required
                    min="0.000001"
                    step="any"
                  />
                </div>
              </div>

              {/* APY rates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Supply APY (%)</label>
                  <input
                    type="number"
                    value={form.supplyAPY}
                    onChange={(e) => updateField("supplyAPY", e.target.value)}
                    className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Borrow APY (%)</label>
                  <input
                    type="number"
                    value={form.variableBorrowAPY}
                    onChange={(e) => updateField("variableBorrowAPY", e.target.value)}
                    className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Risk parameters */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">LTV (%)</label>
                  <input
                    type="number"
                    value={form.baseLTVasCollateral}
                    onChange={(e) => updateField("baseLTVasCollateral", e.target.value)}
                    className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Liq. Threshold (%)</label>
                  <input
                    type="number"
                    value={form.reserveLiquidationThreshold}
                    onChange={(e) => updateField("reserveLiquidationThreshold", e.target.value)}
                    className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Reserve Factor (%)</label>
                  <input
                    type="number"
                    value={form.reserveFactor}
                    onChange={(e) => updateField("reserveFactor", e.target.value)}
                    className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <Switch
                    checked={form.borrowingEnabled}
                    onCheckedChange={(v) => updateField("borrowingEnabled", v)}
                    className="scale-75"
                  />
                  Borrowing enabled
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <Switch
                    checked={form.usageAsCollateralEnabled}
                    onCheckedChange={(v) => updateField("usageAsCollateralEnabled", v)}
                    className="scale-75"
                  />
                  Collateral enabled
                </label>
              </div>

              {/* Available liquidity */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Available Liquidity</label>
                <input
                  type="number"
                  value={form.availableLiquidity}
                  onChange={(e) => updateField("availableLiquidity", e.target.value)}
                  className="w-full h-8 text-sm border border-gray-200 rounded-md px-2.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                  min="0"
                  step="any"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-[#5382E3] hover:bg-[#4270D0] text-sm h-9"
                  disabled={saving}
                >
                  {saving ? "..." : editingId ? "Save changes" : "Create token"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-sm h-9"
                  onClick={() => { setView("list"); resetForm(); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
  );
};

export default CustomTokenModal;
