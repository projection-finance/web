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
import { PriceScenario, RateScenario, ScenarioSet } from "@/src/lib/simulation/types";
import { AssetDetails } from "@/src/lib/aave/types";
import { EmodeCategory, isStablecoin } from "@/src/lib/aave/emode";
import { Check, Search, RotateCcw, ChevronDown, ChevronUp, Lock, Plus, Copy, ArrowLeftRight, Trash2 } from "lucide-react";
import TokenIcon from "@/src/components/ui/TokenIcon";
import { Switch } from "@/src/components/ui/switch";
import { formatUSD } from "@/src/lib/format";
import { createEmptyScenarioSet } from "@/src/lib/simulation/scenarios";
import { usePlan } from "@/src/hooks/usePlan";

type ScenarioMode = "fixed" | "linear" | "sinusoidal";

interface SupplyRow {
  symbol: string;
  balance: number;
  balanceUSD: number;
}

interface BorrowRow {
  symbol: string;
  debt: number;
  debtUSD: number;
}

interface PriceRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDay: number | null;
  durationDays: number;
  availableAssets: AssetDetails[];
  userSupplies: SupplyRow[];
  userBorrows: BorrowRow[];
  walletBalances: Record<string, number>;
  priceScenarios: PriceScenario[];
  rateScenarios: RateScenario[];
  onUpdatePriceScenario: (scenario: PriceScenario) => void;
  onRemovePriceScenario: (symbol: string) => void;
  onUpdateRateScenario: (scenario: RateScenario) => void;
  onRemoveRateScenario: (symbol: string, rateType: "supply" | "borrow" | "supplyIncentive" | "borrowIncentive") => void;
  emodeCategories?: EmodeCategory[];
  incentiveAPRs?: Record<string, { supply: number; borrow: number }>;
  // Multi-scenario props
  scenarioSets?: ScenarioSet[];
  activeScenarioSetId?: string;
  onSetActiveScenario?: (id: string) => void;
  onAddScenarioSet?: (set: ScenarioSet) => void;
  onRemoveScenarioSet?: (id: string) => void;
  onRenameScenarioSet?: (id: string, name: string) => void;
  onDuplicateScenarioSet?: (id: string) => void;
  onGenerateInverse?: (sourceId: string) => void;
  onInitScenarioSets?: () => void;
}

const PriceRatesModal: React.FC<PriceRatesModalProps> = ({
  isOpen,
  onClose,
  selectedDay,
  durationDays,
  availableAssets,
  userSupplies,
  userBorrows,
  walletBalances,
  priceScenarios,
  rateScenarios,
  onUpdatePriceScenario,
  onRemovePriceScenario,
  onUpdateRateScenario,
  onRemoveRateScenario,
  emodeCategories,
  incentiveAPRs,
  scenarioSets,
  activeScenarioSetId,
  onSetActiveScenario,
  onAddScenarioSet,
  onRemoveScenarioSet,
  onRenameScenarioSet,
  onDuplicateScenarioSet,
  onGenerateInverse,
  onInitScenarioSets,
}) => {
  const [search, setSearch] = useState("");
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [mode, setMode] = useState<ScenarioMode>("fixed");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPct, setBulkPct] = useState("");
  const [bulkTargets, setBulkTargets] = useState({ price: true, supplyAPY: true, borrowAPY: true });

  // Local editing state: track which fields are being edited
  // Fixed mode: single value
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [editingSupplyAPY, setEditingSupplyAPY] = useState<Record<string, string>>({});
  const [editingBorrowAPY, setEditingBorrowAPY] = useState<Record<string, string>>({});
  // Sinusoidal mode: min/max
  const [editingPriceMin, setEditingPriceMin] = useState<Record<string, string>>({});
  const [editingPriceMax, setEditingPriceMax] = useState<Record<string, string>>({});
  const [editingSupplyMin, setEditingSupplyMin] = useState<Record<string, string>>({});
  const [editingSupplyMax, setEditingSupplyMax] = useState<Record<string, string>>({});
  const [editingBorrowMin, setEditingBorrowMin] = useState<Record<string, string>>({});
  const [editingBorrowMax, setEditingBorrowMax] = useState<Record<string, string>>({});
  // Incentive APR editing state
  const [editingSupplyIncentive, setEditingSupplyIncentive] = useState<Record<string, string>>({});
  const [editingBorrowIncentive, setEditingBorrowIncentive] = useState<Record<string, string>>({});

  // Scenario set tab state
  const [renamingSetId, setRenamingSetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activeSetId = activeScenarioSetId ?? scenarioSets?.[0]?.id;

  const { features, isFree } = usePlan();

  // Open-source & free: no gating. Kept as a no-op so existing call sites stay inert.
  const openUpgrade = (feature: string) => { void feature; };

  // Count distinct tokens with any active scenario (price or rate combined)
  const activeScenarioTokens = useMemo(() => {
    const tokens = new Set<string>();
    for (const s of priceScenarios) tokens.add(s.symbol);
    for (const s of rateScenarios) tokens.add(s.symbol);
    return tokens;
  }, [priceScenarios, rateScenarios]);
  const activeScenarioTokenCount = activeScenarioTokens.size;

  // Saved flash indicator
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const flashSaved = (key: string) => {
    setSavedFlash(key);
    setTimeout(() => setSavedFlash(null), 1200);
  };

  // The effective day this change applies from
  const effectiveDay = selectedDay ?? 0;

  // Build a set of symbols that have a balance
  const symbolsWithBalance = useMemo(() => {
    const set = new Set<string>();
    for (const s of userSupplies) {
      if (s.balance > 0) set.add(s.symbol);
    }
    for (const b of userBorrows) {
      if (b.debt > 0) set.add(b.symbol);
    }
    for (const [symbol, bal] of Object.entries(walletBalances)) {
      if (bal > 0) set.add(symbol);
    }
    return set;
  }, [userSupplies, userBorrows, walletBalances]);

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let assets = availableAssets.filter((a) => a.isActive);

    if (search) {
      const q = search.toLowerCase();
      assets = assets.filter((a) => a.symbol.toLowerCase().includes(q));
    }

    if (onlyWithBalance) {
      assets = assets.filter((a) => symbolsWithBalance.has(a.symbol));
    }

    // Sort: assets with balance first, then alphabetical
    return assets.sort((a, b) => {
      const aHas = symbolsWithBalance.has(a.symbol) ? 0 : 1;
      const bHas = symbolsWithBalance.has(b.symbol) ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [availableAssets, search, onlyWithBalance, symbolsWithBalance]);

  // Helpers to get current scenario values
  const getPriceScenario = (symbol: string) =>
    priceScenarios.find((s) => s.symbol === symbol);

  const getRateScenario = (symbol: string, rateType: "supply" | "borrow") =>
    rateScenarios.find((s) => s.symbol === symbol && s.rateType === rateType);

  // Count active = distinct tokens with any modification (not individual entries)
  const activeCount = activeScenarioTokenCount;

  // --- Helper to clear an editing key ---
  const clearEditing = (
    setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    symbol: string
  ) => {
    setter((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  };

  // ─── Fixed mode handlers ───

  // Gate: check if adding a NEW token (price or rate) exceeds the shared limit
  const canModifyToken = (symbol: string): boolean => {
    if (activeScenarioTokens.has(symbol)) return true; // already modified → allowed
    if (activeScenarioTokenCount >= features.maxPriceTokens) {
      openUpgrade("unlimited price & rate modifications");
      return false;
    }
    return true;
  };

  const handleFixedPriceBlur = (asset: AssetDetails) => {
    const raw = editingPrices[asset.symbol];
    if (raw === undefined) return;

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingPrices, asset.symbol);
      return;
    }

    if (Math.abs(val - asset.priceInUSD) < 0.000001) {
      onRemovePriceScenario(asset.symbol);
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingPrices, asset.symbol); return; }
      onUpdatePriceScenario({
        symbol: asset.symbol,
        mode: "fixed",
        startPrice: val,
        fromDay: effectiveDay,
        originalPrice: asset.priceInUSD,
      });
      flashSaved(`price-${asset.symbol}`);
    }

    clearEditing(setEditingPrices, asset.symbol);
  };

  const handleFixedSupplyAPYBlur = (asset: AssetDetails) => {
    const raw = editingSupplyAPY[asset.symbol];
    if (raw === undefined) return;

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingSupplyAPY, asset.symbol);
      return;
    }

    const rateDecimal = val / 100;
    const originalRate = asset.supplyAPY ?? 0;

    if (Math.abs(rateDecimal - originalRate) < 0.000001) {
      onRemoveRateScenario(asset.symbol, "supply");
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingSupplyAPY, asset.symbol); return; }
      onUpdateRateScenario({
        symbol: asset.symbol,
        rateType: "supply",
        mode: "fixed",
        startRate: rateDecimal,
        fromDay: effectiveDay,
        originalRate,
      });
      flashSaved(`supply-${asset.symbol}`);
    }

    clearEditing(setEditingSupplyAPY, asset.symbol);
  };

  const handleFixedBorrowAPYBlur = (asset: AssetDetails) => {
    const raw = editingBorrowAPY[asset.symbol];
    if (raw === undefined) return;

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingBorrowAPY, asset.symbol);
      return;
    }

    const rateDecimal = val / 100;
    const originalRate = asset.variableBorrowAPY ?? 0;

    if (Math.abs(rateDecimal - originalRate) < 0.000001) {
      onRemoveRateScenario(asset.symbol, "borrow");
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingBorrowAPY, asset.symbol); return; }
      flashSaved(`borrow-${asset.symbol}`);
      onUpdateRateScenario({
        symbol: asset.symbol,
        rateType: "borrow",
        mode: "fixed",
        startRate: rateDecimal,
        fromDay: effectiveDay,
        originalRate,
      });
    }

    clearEditing(setEditingBorrowAPY, asset.symbol);
  };

  // ─── Linear mode handlers ───

  const handleLinearPriceBlur = (asset: AssetDetails) => {
    const raw = editingPrices[asset.symbol];
    if (raw === undefined) return;

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingPrices, asset.symbol);
      return;
    }

    if (Math.abs(val - asset.priceInUSD) < 0.000001) {
      onRemovePriceScenario(asset.symbol);
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingPrices, asset.symbol); return; }
      onUpdatePriceScenario({
        symbol: asset.symbol,
        mode: "linear",
        startPrice: asset.priceInUSD,
        endPrice: val,
        originalPrice: asset.priceInUSD,
      });
    }

    clearEditing(setEditingPrices, asset.symbol);
  };

  const handleLinearSupplyAPYBlur = (asset: AssetDetails) => {
    const raw = editingSupplyAPY[asset.symbol];
    if (raw === undefined) return;

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingSupplyAPY, asset.symbol);
      return;
    }

    const rateDecimal = val / 100;
    const originalRate = asset.supplyAPY ?? 0;

    if (Math.abs(rateDecimal - originalRate) < 0.000001) {
      onRemoveRateScenario(asset.symbol, "supply");
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingSupplyAPY, asset.symbol); return; }
      onUpdateRateScenario({
        symbol: asset.symbol,
        rateType: "supply",
        mode: "linear",
        startRate: originalRate,
        endRate: rateDecimal,
        originalRate,
      });
    }

    clearEditing(setEditingSupplyAPY, asset.symbol);
  };

  const handleLinearBorrowAPYBlur = (asset: AssetDetails) => {
    const raw = editingBorrowAPY[asset.symbol];
    if (raw === undefined) return;

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setEditingBorrowAPY, asset.symbol);
      return;
    }

    const rateDecimal = val / 100;
    const originalRate = asset.variableBorrowAPY ?? 0;

    if (Math.abs(rateDecimal - originalRate) < 0.000001) {
      onRemoveRateScenario(asset.symbol, "borrow");
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingBorrowAPY, asset.symbol); return; }
      onUpdateRateScenario({
        symbol: asset.symbol,
        rateType: "borrow",
        mode: "linear",
        startRate: originalRate,
        endRate: rateDecimal,
        originalRate,
      });
    }

    clearEditing(setEditingBorrowAPY, asset.symbol);
  };

  // ─── Sinusoidal mode handlers ───

  const handleSinPriceBlur = (asset: AssetDetails) => {
    const rawMin = editingPriceMin[asset.symbol];
    const rawMax = editingPriceMax[asset.symbol];
    // Only commit if at least one was edited
    if (rawMin === undefined && rawMax === undefined) return;

    const existing = getPriceScenario(asset.symbol);
    const min = rawMin !== undefined ? parseFloat(rawMin) : (existing?.minPrice ?? asset.priceInUSD);
    const max = rawMax !== undefined ? parseFloat(rawMax) : (existing?.maxPrice ?? asset.priceInUSD);

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      clearEditing(setEditingPriceMin, asset.symbol);
      clearEditing(setEditingPriceMax, asset.symbol);
      return;
    }

    if (Math.abs(min - asset.priceInUSD) < 0.000001 && Math.abs(max - asset.priceInUSD) < 0.000001) {
      onRemovePriceScenario(asset.symbol);
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingPriceMin, asset.symbol); clearEditing(setEditingPriceMax, asset.symbol); return; }
      onUpdatePriceScenario({
        symbol: asset.symbol,
        mode: "sinusoidal",
        startPrice: asset.priceInUSD,
        minPrice: Math.min(min, max),
        maxPrice: Math.max(min, max),
        cycleDays: durationDays,
        originalPrice: asset.priceInUSD,
      });
    }

    clearEditing(setEditingPriceMin, asset.symbol);
    clearEditing(setEditingPriceMax, asset.symbol);
  };

  const handleSinSupplyAPYBlur = (asset: AssetDetails) => {
    const rawMin = editingSupplyMin[asset.symbol];
    const rawMax = editingSupplyMax[asset.symbol];
    if (rawMin === undefined && rawMax === undefined) return;

    const existing = getRateScenario(asset.symbol, "supply");
    const originalRate = asset.supplyAPY ?? 0;
    const min = rawMin !== undefined ? parseFloat(rawMin) / 100 : (existing?.minRate ?? originalRate);
    const max = rawMax !== undefined ? parseFloat(rawMax) / 100 : (existing?.maxRate ?? originalRate);

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      clearEditing(setEditingSupplyMin, asset.symbol);
      clearEditing(setEditingSupplyMax, asset.symbol);
      return;
    }

    if (Math.abs(min - originalRate) < 0.000001 && Math.abs(max - originalRate) < 0.000001) {
      onRemoveRateScenario(asset.symbol, "supply");
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingSupplyMin, asset.symbol); clearEditing(setEditingSupplyMax, asset.symbol); return; }
      onUpdateRateScenario({
        symbol: asset.symbol,
        rateType: "supply",
        mode: "sinusoidal",
        startRate: originalRate,
        minRate: Math.min(min, max),
        maxRate: Math.max(min, max),
        cycleDays: durationDays,
        originalRate,
      });
    }

    clearEditing(setEditingSupplyMin, asset.symbol);
    clearEditing(setEditingSupplyMax, asset.symbol);
  };

  const handleSinBorrowAPYBlur = (asset: AssetDetails) => {
    const rawMin = editingBorrowMin[asset.symbol];
    const rawMax = editingBorrowMax[asset.symbol];
    if (rawMin === undefined && rawMax === undefined) return;

    const existing = getRateScenario(asset.symbol, "borrow");
    const originalRate = asset.variableBorrowAPY ?? 0;
    const min = rawMin !== undefined ? parseFloat(rawMin) / 100 : (existing?.minRate ?? originalRate);
    const max = rawMax !== undefined ? parseFloat(rawMax) / 100 : (existing?.maxRate ?? originalRate);

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      clearEditing(setEditingBorrowMin, asset.symbol);
      clearEditing(setEditingBorrowMax, asset.symbol);
      return;
    }

    if (Math.abs(min - originalRate) < 0.000001 && Math.abs(max - originalRate) < 0.000001) {
      onRemoveRateScenario(asset.symbol, "borrow");
    } else {
      if (!canModifyToken(asset.symbol)) { clearEditing(setEditingBorrowMin, asset.symbol); clearEditing(setEditingBorrowMax, asset.symbol); return; }
      onUpdateRateScenario({
        symbol: asset.symbol,
        rateType: "borrow",
        mode: "sinusoidal",
        startRate: originalRate,
        minRate: Math.min(min, max),
        maxRate: Math.max(min, max),
        cycleDays: durationDays,
        originalRate,
      });
    }

    clearEditing(setEditingBorrowMin, asset.symbol);
    clearEditing(setEditingBorrowMax, asset.symbol);
  };

  // ─── Generic key handlers ───

  const handleKeyDown = (e: React.KeyboardEvent, blurHandler: () => void, symbol: string, setter: React.Dispatch<React.SetStateAction<Record<string, string>>>) => {
    if (e.key === "Enter") blurHandler();
    if (e.key === "Escape") clearEditing(setter, symbol);
  };

  // ─── Reset helpers ───

  const resetPrice = (asset: AssetDetails) => {
    onRemovePriceScenario(asset.symbol);
    clearEditing(setEditingPrices, asset.symbol);
    clearEditing(setEditingPriceMin, asset.symbol);
    clearEditing(setEditingPriceMax, asset.symbol);
  };

  const resetSupplyAPY = (asset: AssetDetails) => {
    onRemoveRateScenario(asset.symbol, "supply");
    clearEditing(setEditingSupplyAPY, asset.symbol);
    clearEditing(setEditingSupplyMin, asset.symbol);
    clearEditing(setEditingSupplyMax, asset.symbol);
  };

  const resetSupplyIncentive = (symbol: string) => {
    onRemoveRateScenario(symbol, "supplyIncentive");
    clearEditing(setEditingSupplyIncentive, symbol);
  };

  const resetBorrowIncentive = (symbol: string) => {
    onRemoveRateScenario(symbol, "borrowIncentive");
    clearEditing(setEditingBorrowIncentive, symbol);
  };

  // Incentive scenario helpers
  const getIncentiveScenario = (symbol: string, rateType: "supplyIncentive" | "borrowIncentive") =>
    rateScenarios.find((s) => s.symbol === symbol && s.rateType === rateType);

  const handleFixedIncentiveBlur = (symbol: string, rateType: "supplyIncentive" | "borrowIncentive") => {
    const editingState = rateType === "supplyIncentive" ? editingSupplyIncentive : editingBorrowIncentive;
    const setter = rateType === "supplyIncentive" ? setEditingSupplyIncentive : setEditingBorrowIncentive;
    const raw = editingState[symbol];
    if (raw === undefined) return;

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setter, symbol);
      return;
    }

    const rateDecimal = val / 100;
    const originalRate = rateType === "supplyIncentive"
      ? (incentiveAPRs?.[symbol]?.supply ?? 0)
      : (incentiveAPRs?.[symbol]?.borrow ?? 0);

    if (Math.abs(rateDecimal - originalRate) < 0.000001) {
      onRemoveRateScenario(symbol, rateType);
    } else {
      if (!canModifyToken(symbol)) { clearEditing(setter, symbol); return; }
      onUpdateRateScenario({
        symbol,
        rateType,
        mode: "fixed",
        startRate: rateDecimal,
        fromDay: effectiveDay,
        originalRate,
      });
      flashSaved(`${rateType}-${symbol}`);
    }

    clearEditing(setter, symbol);
  };

  const handleLinearIncentiveBlur = (symbol: string, rateType: "supplyIncentive" | "borrowIncentive") => {
    const editingState = rateType === "supplyIncentive" ? editingSupplyIncentive : editingBorrowIncentive;
    const setter = rateType === "supplyIncentive" ? setEditingSupplyIncentive : setEditingBorrowIncentive;
    const raw = editingState[symbol];
    if (raw === undefined) return;

    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      clearEditing(setter, symbol);
      return;
    }

    const rateDecimal = val / 100;
    const originalRate = rateType === "supplyIncentive"
      ? (incentiveAPRs?.[symbol]?.supply ?? 0)
      : (incentiveAPRs?.[symbol]?.borrow ?? 0);

    if (Math.abs(rateDecimal - originalRate) < 0.000001) {
      onRemoveRateScenario(symbol, rateType);
    } else {
      if (!canModifyToken(symbol)) { clearEditing(setter, symbol); return; }
      onUpdateRateScenario({
        symbol,
        rateType,
        mode: "linear",
        startRate: originalRate,
        endRate: rateDecimal,
        originalRate,
      });
    }

    clearEditing(setter, symbol);
  };

  const resetBorrowAPY = (asset: AssetDetails) => {
    onRemoveRateScenario(asset.symbol, "borrow");
    clearEditing(setEditingBorrowAPY, asset.symbol);
    clearEditing(setEditingBorrowMin, asset.symbol);
    clearEditing(setEditingBorrowMax, asset.symbol);
  };

  // ─── Display value helpers ───

  const getDisplayPrice = (asset: AssetDetails): number => {
    const scenario = getPriceScenario(asset.symbol);
    if (!scenario) return asset.priceInUSD;
    if (scenario.mode === "linear") return scenario.endPrice ?? scenario.startPrice;
    return scenario.startPrice;
  };

  const getDisplaySupplyAPY = (asset: AssetDetails): number => {
    const scenario = getRateScenario(asset.symbol, "supply");
    if (!scenario) return asset.supplyAPY ?? 0;
    if (scenario.mode === "linear") return scenario.endRate ?? scenario.startRate;
    return scenario.startRate;
  };

  const getDisplayBorrowAPY = (asset: AssetDetails): number => {
    const scenario = getRateScenario(asset.symbol, "borrow");
    if (!scenario) return asset.variableBorrowAPY ?? 0;
    if (scenario.mode === "linear") return scenario.endRate ?? scenario.startRate;
    return scenario.startRate;
  };

  // ─── Bulk Apply ───

  const applyBulk = () => {
    if (isFree) {
      openUpgrade("bulk scenario apply");
      return;
    }

    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) return;

    for (const asset of filteredAssets) {
      if (bulkTargets.price) {
        const price = asset.priceInUSD;
        if (mode === "fixed") {
          onUpdatePriceScenario({
            symbol: asset.symbol,
            mode: "fixed",
            startPrice: price * (1 + pct / 100),
            fromDay: effectiveDay,
            originalPrice: price,
          });
        } else if (mode === "linear") {
          onUpdatePriceScenario({
            symbol: asset.symbol,
            mode: "linear",
            startPrice: price,
            endPrice: price * (1 + pct / 100),
            originalPrice: price,
          });
        } else if (mode === "sinusoidal") {
          const absPct = Math.abs(pct);
          onUpdatePriceScenario({
            symbol: asset.symbol,
            mode: "sinusoidal",
            startPrice: price,
            minPrice: price * (1 - absPct / 100),
            maxPrice: price * (1 + absPct / 100),
            cycleDays: durationDays,
            originalPrice: price,
          });
        }
      }

      if (bulkTargets.supplyAPY) {
        const rate = asset.supplyAPY ?? 0;
        if (mode === "fixed") {
          onUpdateRateScenario({
            symbol: asset.symbol,
            rateType: "supply",
            mode: "fixed",
            startRate: rate * (1 + pct / 100),
            fromDay: effectiveDay,
            originalRate: rate,
          });
        } else if (mode === "linear") {
          onUpdateRateScenario({
            symbol: asset.symbol,
            rateType: "supply",
            mode: "linear",
            startRate: rate,
            endRate: rate * (1 + pct / 100),
            originalRate: rate,
          });
        } else if (mode === "sinusoidal") {
          const absPct = Math.abs(pct);
          onUpdateRateScenario({
            symbol: asset.symbol,
            rateType: "supply",
            mode: "sinusoidal",
            startRate: rate,
            minRate: rate * (1 - absPct / 100),
            maxRate: rate * (1 + absPct / 100),
            cycleDays: durationDays,
            originalRate: rate,
          });
        }
      }

      if (bulkTargets.borrowAPY) {
        const rate = asset.variableBorrowAPY ?? 0;
        if (mode === "fixed") {
          onUpdateRateScenario({
            symbol: asset.symbol,
            rateType: "borrow",
            mode: "fixed",
            startRate: rate * (1 + pct / 100),
            fromDay: effectiveDay,
            originalRate: rate,
          });
        } else if (mode === "linear") {
          onUpdateRateScenario({
            symbol: asset.symbol,
            rateType: "borrow",
            mode: "linear",
            startRate: rate,
            endRate: rate * (1 + pct / 100),
            originalRate: rate,
          });
        } else if (mode === "sinusoidal") {
          const absPct = Math.abs(pct);
          onUpdateRateScenario({
            symbol: asset.symbol,
            rateType: "borrow",
            mode: "sinusoidal",
            startRate: rate,
            minRate: rate * (1 - absPct / 100),
            maxRate: rate * (1 + absPct / 100),
            cycleDays: durationDays,
            originalRate: rate,
          });
        }
      }
    }
  };

  // Day label for the header
  const dayLabel = effectiveDay > 0
    ? `D${effectiveDay} — ${new Date(Date.now() + effectiveDay * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "D0 (Today)";

  // ─── Column headers based on mode ───

  const priceColLabel = mode === "linear" ? `Price at D${durationDays}` : mode === "sinusoidal" ? "Price Min / Max" : "Price (USD)";
  const supplyColLabel = mode === "linear" ? `Supply APY at D${durationDays}` : mode === "sinusoidal" ? "Supply APY Min / Max" : "Supply APY";
  const borrowColLabel = mode === "linear" ? `Borrow APY at D${durationDays}` : mode === "sinusoidal" ? "Borrow APY Min / Max" : "Borrow APY";

  // Grid columns — sinusoidal needs wider columns
  const gridCols = mode === "sinusoidal"
    ? "grid-cols-[1fr_180px_160px_160px]"
    : "grid-cols-[1.2fr_150px_130px_130px]";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base text-[#303549] font-semibold flex items-center gap-2">
            Prices & Rates
            {activeCount > 0 && (
              <Badge className="bg-[#5382E31F] text-[#5382E3] text-[10px] px-1.5 py-0">
                {activeCount} token{activeCount !== 1 ? "s" : ""} modified
              </Badge>
            )}
            <span className="ml-auto" />
          </DialogTitle>
        </DialogHeader>

        {/* Scenario set tabs */}
        {scenarioSets && scenarioSets.length > 0 && (
          <div className="flex items-center gap-1 pb-1 border-b border-slate-100 min-w-0 shrink-0 flex-wrap relative">
            {scenarioSets.map((set) => {
              const isActive = set.id === activeSetId;
              const isRenaming = renamingSetId === set.id;

              return (
                <div key={set.id} className="flex items-center shrink-0">
                  <button
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-slate-100 text-[#303549] ring-1 ring-slate-200"
                        : "text-gray-500 hover:bg-slate-50 hover:text-gray-700"
                    }`}
                    onClick={() => onSetActiveScenario?.(set.id)}
                    onDoubleClick={() => {
                      setRenameValue(set.name);
                      setRenamingSetId(set.id);
                    }}
                    title="Click to select · Double-click to rename"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: set.color }}
                    />
                    {isRenaming ? (
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                          if (renameValue.trim()) onRenameScenarioSet?.(set.id, renameValue.trim());
                          setRenamingSetId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (renameValue.trim()) onRenameScenarioSet?.(set.id, renameValue.trim());
                            setRenamingSetId(null);
                          }
                          if (e.key === "Escape") setRenamingSetId(null);
                        }}
                        className="w-20 text-xs bg-white border border-slate-200 rounded px-1 py-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span>{set.name}</span>
                    )}
                    {set.priceScenarios.length > 0 && (
                      <span className="text-[9px] text-gray-400">
                        ({set.priceScenarios.length})
                      </span>
                    )}
                  </button>

                  {/* Inline action icons for active tab */}
                  {isActive && !isRenaming && (
                    <div className="flex items-center ml-0.5 gap-px">
                      <button
                        className="p-0.5 rounded hover:bg-slate-100 text-gray-300 hover:text-gray-500 transition-colors"
                        onClick={() => onDuplicateScenarioSet?.(set.id)}
                        title="Duplicate scenario"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {set.priceScenarios.length > 0 && (
                        <button
                          className="p-0.5 rounded hover:bg-slate-100 text-gray-300 hover:text-gray-500 transition-colors"
                          onClick={() => onGenerateInverse?.(set.id)}
                          title="Generate inverse scenario"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                        </button>
                      )}
                      {scenarioSets.length > 1 && (
                        <button
                          className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                          onClick={() => onRemoveScenarioSet?.(set.id)}
                          title="Delete scenario"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add scenario set button */}
            <button
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-[#5382E3] hover:bg-slate-50 rounded-md transition-colors shrink-0 whitespace-nowrap"
              onClick={() => {
                if (isFree) {
                  openUpgrade("multiple scenario sets");
                  return;
                }
                if (!scenarioSets || scenarioSets.length === 0) {
                  onInitScenarioSets?.();
                }
                const newSet = createEmptyScenarioSet(scenarioSets?.length ?? 0);
                onAddScenarioSet?.(newSet);
                onSetActiveScenario?.(newSet.id);
              }}
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
            <span className="text-[9px] text-gray-300 ml-auto self-center italic select-none">
              double-click to rename
            </span>
          </div>
        )}

        {/* Init scenario sets button (when none exist) */}
        {(!scenarioSets || scenarioSets.length === 0) && onInitScenarioSets && (
          <div className="flex items-center justify-end mt-1">
            <button
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#5382E3] transition-colors"
              onClick={() => {
                if (isFree) {
                  openUpgrade("multiple scenario sets");
                  return;
                }
                onInitScenarioSets();
              }}
            >
              <Plus className="w-3 h-3" />
              Enable multi-scenario
            </button>
          </div>
        )}

        {/* Mode selector + day context */}
        <div className="flex items-center justify-between mt-1 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">Mode:</span>
            {(["fixed", "linear", "sinusoidal"] as ScenarioMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  mode === m
                    ? "bg-[#4F7FFA] text-white"
                    : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {isFree && (
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${
                activeScenarioTokenCount >= features.maxPriceTokens
                  ? "bg-red-50 border-red-200 text-red-600"
                  : "bg-blue-50 border-blue-200 text-[#5382E3]"
              }`}>
                <span>{activeScenarioTokenCount}/{features.maxPriceTokens}</span>
                <span className="font-normal">token{features.maxPriceTokens !== 1 ? "s" : ""}</span>
              </div>
              <button
                onClick={() => openUpgrade("unlimited price & rate modifications")}
                className="flex items-center gap-1 text-[10px] font-semibold text-[#5382E3] hover:text-[#4270D0] bg-[#5382E3]/10 hover:bg-[#5382E3]/20 px-2 py-1 rounded-md transition-colors"
              >
                <Lock className="w-3 h-3" />
                Unlock unlimited
              </button>
            </div>
          )}
        </div>

        {/* Day context — explains what the mode does */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 mt-1 shrink-0">
          {mode === "fixed" && (
            <p className="text-[11px] text-gray-500">
              Set a <span className="font-semibold text-[#303549]">fixed price/rate</span> applied from{" "}
              <span className="font-semibold text-[#4F7FFA]">{dayLabel}</span> through{" "}
              <span className="font-semibold text-[#4F7FFA]">D{durationDays} (max)</span>
            </p>
          )}
          {mode === "linear" && (
            <p className="text-[11px] text-gray-500">
              Price/rate moves linearly from <span className="font-semibold text-[#4F7FFA]">start value at D0</span> to{" "}
              <span className="font-semibold text-[#4F7FFA]">target value at D{durationDays} (max)</span>
            </p>
          )}
          {mode === "sinusoidal" && (
            <p className="text-[11px] text-gray-500">
              Price/rate oscillates between <span className="font-semibold text-[#4F7FFA]">min</span> and{" "}
              <span className="font-semibold text-[#4F7FFA]">max</span> over a full cycle across{" "}
              <span className="font-semibold text-[#4F7FFA]">D0 → D{durationDays} (max)</span>
            </p>
          )}
        </div>

        {/* Bulk Apply */}
        <div className={`border rounded-lg mt-2 shrink-0 ${isFree ? "border-slate-100 opacity-50" : "border-slate-200"}`}>
          <button
            className={`flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg ${
              isFree
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:bg-slate-50"
            }`}
            onClick={() => {
              if (isFree) { openUpgrade("bulk scenario apply"); return; }
              setBulkOpen((o) => !o);
            }}
          >
            <span>Bulk Apply {isFree && <span className="text-[10px] text-gray-300 ml-1">PRO</span>}</span>
            {bulkOpen && !isFree ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {bulkOpen && (
            <div className="px-3 pb-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={bulkPct}
                  onChange={(e) => setBulkPct(e.target.value)}
                  placeholder="e.g. +10"
                  className="w-20 h-7 text-xs border border-gray-200 rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-[#4F7FFA]"
                  step="any"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkTargets.price}
                  onChange={(e) => setBulkTargets((t) => ({ ...t, price: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-[#4F7FFA] focus:ring-[#4F7FFA]"
                />
                Price
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkTargets.supplyAPY}
                  onChange={(e) => setBulkTargets((t) => ({ ...t, supplyAPY: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-[#4F7FFA] focus:ring-[#4F7FFA]"
                />
                Supply APY
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkTargets.borrowAPY}
                  onChange={(e) => setBulkTargets((t) => ({ ...t, borrowAPY: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-[#4F7FFA] focus:ring-[#4F7FFA]"
                />
                Borrow APY
              </label>
              <Button
                size="sm"
                className="bg-[#4F7FFA] text-white text-xs h-7 px-3"
                onClick={applyBulk}
                disabled={!bulkPct}
              >
                Apply
              </Button>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-4 mt-2 shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token..."
              className="w-full h-9 text-sm border border-gray-300 rounded-lg pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-[#4F7FFA]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
            <Switch
              checked={onlyWithBalance}
              onCheckedChange={setOnlyWithBalance}
              className="scale-75"
            />
            Only with balance
          </label>
        </div>

        {/* Column headers */}
        <div className={`grid ${gridCols} gap-4 px-3 mt-3 pb-2 border-b border-slate-200 text-[11px] font-medium text-[#62677B] uppercase tracking-wide shrink-0`}>
          <span>Token</span>
          <span className="text-center">{priceColLabel}</span>
          <span className="text-center">{supplyColLabel}</span>
          <span className="text-center">{borrowColLabel}</span>
        </div>

        {/* Token list */}
        <div className="flex-1 overflow-y-auto min-h-0 mt-1 pr-1">
          {filteredAssets.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">
              No tokens found
            </p>
          )}

          {filteredAssets.map((asset) => {
            const hasPriceScenario = !!getPriceScenario(asset.symbol);
            const hasSupplyScenario = !!getRateScenario(asset.symbol, "supply");
            const hasBorrowScenario = !!getRateScenario(asset.symbol, "borrow");
            const priceScenario = getPriceScenario(asset.symbol);
            const supplyScenario = getRateScenario(asset.symbol, "supply");
            const borrowScenario = getRateScenario(asset.symbol, "borrow");

            return (
              <React.Fragment key={`frag-${asset.symbol}`}>
              <div
                className={`grid ${gridCols} gap-4 items-center px-3 py-2.5 rounded-lg hover:bg-slate-50 border-b border-slate-100`}
              >
                {/* Token icon + symbol */}
                <div className="flex items-center gap-2.5">
                  <TokenIcon symbol={asset.symbol} size={28} />
                  <div>
                    <span className="text-sm font-medium text-[#303549]">
                      {asset.symbol}
                    </span>
                    {symbolsWithBalance.has(asset.symbol) && (
                      <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[#4F7FFA] inline-block" />
                    )}
                    {asset.isRewardToken && (
                      <Badge className="ml-1.5 bg-green-50 text-green-600 text-[9px] px-1.5 py-0 font-normal">
                        Reward
                      </Badge>
                    )}
                    {emodeCategories && isStablecoin(asset.symbol, emodeCategories) && (
                      <Badge className="ml-1.5 bg-blue-50 text-blue-600 text-[9px] px-1.5 py-0 font-normal">
                        Stablecoin
                      </Badge>
                    )}
                  </div>
                </div>

                {/* ─── Price column ─── */}
                {mode === "fixed" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      value={editingPrices[asset.symbol] !== undefined ? editingPrices[asset.symbol] : getDisplayPrice(asset).toString()}
                      onChange={(e) => setEditingPrices((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                      onBlur={() => handleFixedPriceBlur(asset)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleFixedPriceBlur(asset), asset.symbol, setEditingPrices)}
                      onFocus={() => {
                        if (editingPrices[asset.symbol] === undefined)
                          setEditingPrices((prev) => ({ ...prev, [asset.symbol]: getDisplayPrice(asset).toString() }));
                      }}
                      className={`w-full h-7 text-xs border rounded-md px-2 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasPriceScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                      min="0"
                      step="any"
                    />
                    {savedFlash === `price-${asset.symbol}` ? (
                      <Check className="w-4 h-4 text-green-500 animate-in fade-in" />
                    ) : hasPriceScenario ? (
                      <button onClick={() => resetPrice(asset)} className="p-1 hover:bg-slate-200 rounded" title={`Reset to $${formatUSD(asset.priceInUSD)}`}>
                        <RotateCcw className="w-3 h-3 text-gray-400" />
                      </button>
                    ) : <span className="w-5" />}
                  </div>
                )}

                {mode === "linear" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 shrink-0">${formatUSD(asset.priceInUSD)}→</span>
                    <input
                      type="number"
                      value={editingPrices[asset.symbol] !== undefined ? editingPrices[asset.symbol] : (priceScenario?.endPrice ?? asset.priceInUSD).toString()}
                      onChange={(e) => setEditingPrices((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                      onBlur={() => handleLinearPriceBlur(asset)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleLinearPriceBlur(asset), asset.symbol, setEditingPrices)}
                      onFocus={() => {
                        if (editingPrices[asset.symbol] === undefined)
                          setEditingPrices((prev) => ({ ...prev, [asset.symbol]: (priceScenario?.endPrice ?? asset.priceInUSD).toString() }));
                      }}
                      className={`w-full h-7 text-xs border rounded-md px-2 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasPriceScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                      min="0"
                      step="any"
                    />
                    {hasPriceScenario ? (
                      <button onClick={() => resetPrice(asset)} className="p-1 hover:bg-slate-200 rounded" title="Reset">
                        <RotateCcw className="w-3 h-3 text-gray-400" />
                      </button>
                    ) : <span className="w-5" />}
                  </div>
                )}

                {mode === "sinusoidal" && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 shrink-0">Min</span>
                      <input
                        type="number"
                        value={editingPriceMin[asset.symbol] !== undefined ? editingPriceMin[asset.symbol] : (priceScenario?.minPrice ?? asset.priceInUSD).toString()}
                        onChange={(e) => setEditingPriceMin((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                        onBlur={() => handleSinPriceBlur(asset)}
                        onKeyDown={(e) => handleKeyDown(e, () => handleSinPriceBlur(asset), asset.symbol, setEditingPriceMin)}
                        onFocus={() => {
                          if (editingPriceMin[asset.symbol] === undefined)
                            setEditingPriceMin((prev) => ({ ...prev, [asset.symbol]: (priceScenario?.minPrice ?? asset.priceInUSD).toString() }));
                        }}
                        className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasPriceScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                        min="0"
                        step="any"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 shrink-0">Max</span>
                      <input
                        type="number"
                        value={editingPriceMax[asset.symbol] !== undefined ? editingPriceMax[asset.symbol] : (priceScenario?.maxPrice ?? asset.priceInUSD).toString()}
                        onChange={(e) => setEditingPriceMax((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                        onBlur={() => handleSinPriceBlur(asset)}
                        onKeyDown={(e) => handleKeyDown(e, () => handleSinPriceBlur(asset), asset.symbol, setEditingPriceMax)}
                        onFocus={() => {
                          if (editingPriceMax[asset.symbol] === undefined)
                            setEditingPriceMax((prev) => ({ ...prev, [asset.symbol]: (priceScenario?.maxPrice ?? asset.priceInUSD).toString() }));
                        }}
                        className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasPriceScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                        min="0"
                        step="any"
                      />
                      {hasPriceScenario ? (
                        <button onClick={() => resetPrice(asset)} className="p-0.5 hover:bg-slate-200 rounded" title="Reset">
                          <RotateCcw className="w-3 h-3 text-gray-400" />
                        </button>
                      ) : <span className="w-4" />}
                    </div>
                  </div>
                )}

                {/* ─── Supply APY column ─── */}
                {mode === "fixed" && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={editingSupplyAPY[asset.symbol] !== undefined ? editingSupplyAPY[asset.symbol] : (getDisplaySupplyAPY(asset) * 100).toFixed(2)}
                      onChange={(e) => setEditingSupplyAPY((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                      onBlur={() => handleFixedSupplyAPYBlur(asset)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleFixedSupplyAPYBlur(asset), asset.symbol, setEditingSupplyAPY)}
                      onFocus={() => {
                        if (editingSupplyAPY[asset.symbol] === undefined)
                          setEditingSupplyAPY((prev) => ({ ...prev, [asset.symbol]: (getDisplaySupplyAPY(asset) * 100).toFixed(2) }));
                      }}
                      className={`w-full h-7 text-xs border rounded-md px-2 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasSupplyScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                      min="0"
                      step="0.01"
                    />
                    <span className="text-xs text-gray-400">%</span>
                    {savedFlash === `supply-${asset.symbol}` ? (
                      <Check className="w-4 h-4 text-green-500 animate-in fade-in" />
                    ) : hasSupplyScenario ? (
                      <button onClick={() => resetSupplyAPY(asset)} className="p-1 hover:bg-slate-200 rounded" title={`Reset to ${((asset.supplyAPY ?? 0) * 100).toFixed(2)}%`}>
                        <RotateCcw className="w-3 h-3 text-gray-400" />
                      </button>
                    ) : <span className="w-5" />}
                  </div>
                )}

                {mode === "linear" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 shrink-0">{((asset.supplyAPY ?? 0) * 100).toFixed(1)}→</span>
                    <input
                      type="number"
                      value={editingSupplyAPY[asset.symbol] !== undefined ? editingSupplyAPY[asset.symbol] : ((supplyScenario?.endRate ?? (asset.supplyAPY ?? 0)) * 100).toFixed(2)}
                      onChange={(e) => setEditingSupplyAPY((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                      onBlur={() => handleLinearSupplyAPYBlur(asset)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleLinearSupplyAPYBlur(asset), asset.symbol, setEditingSupplyAPY)}
                      onFocus={() => {
                        if (editingSupplyAPY[asset.symbol] === undefined)
                          setEditingSupplyAPY((prev) => ({ ...prev, [asset.symbol]: ((supplyScenario?.endRate ?? (asset.supplyAPY ?? 0)) * 100).toFixed(2) }));
                      }}
                      className={`w-full h-7 text-xs border rounded-md px-2 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasSupplyScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                      min="0"
                      step="0.01"
                    />
                    <span className="text-xs text-gray-400">%</span>
                    {hasSupplyScenario ? (
                      <button onClick={() => resetSupplyAPY(asset)} className="p-1 hover:bg-slate-200 rounded" title="Reset">
                        <RotateCcw className="w-3 h-3 text-gray-400" />
                      </button>
                    ) : <span className="w-5" />}
                  </div>
                )}

                {mode === "sinusoidal" && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 shrink-0">Min</span>
                      <input
                        type="number"
                        value={editingSupplyMin[asset.symbol] !== undefined ? editingSupplyMin[asset.symbol] : ((supplyScenario?.minRate ?? (asset.supplyAPY ?? 0)) * 100).toFixed(2)}
                        onChange={(e) => setEditingSupplyMin((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                        onBlur={() => handleSinSupplyAPYBlur(asset)}
                        onKeyDown={(e) => handleKeyDown(e, () => handleSinSupplyAPYBlur(asset), asset.symbol, setEditingSupplyMin)}
                        onFocus={() => {
                          if (editingSupplyMin[asset.symbol] === undefined)
                            setEditingSupplyMin((prev) => ({ ...prev, [asset.symbol]: ((supplyScenario?.minRate ?? (asset.supplyAPY ?? 0)) * 100).toFixed(2) }));
                        }}
                        className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasSupplyScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                        min="0"
                        step="0.01"
                      />
                      <span className="text-[10px] text-gray-400">%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 shrink-0">Max</span>
                      <input
                        type="number"
                        value={editingSupplyMax[asset.symbol] !== undefined ? editingSupplyMax[asset.symbol] : ((supplyScenario?.maxRate ?? (asset.supplyAPY ?? 0)) * 100).toFixed(2)}
                        onChange={(e) => setEditingSupplyMax((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                        onBlur={() => handleSinSupplyAPYBlur(asset)}
                        onKeyDown={(e) => handleKeyDown(e, () => handleSinSupplyAPYBlur(asset), asset.symbol, setEditingSupplyMax)}
                        onFocus={() => {
                          if (editingSupplyMax[asset.symbol] === undefined)
                            setEditingSupplyMax((prev) => ({ ...prev, [asset.symbol]: ((supplyScenario?.maxRate ?? (asset.supplyAPY ?? 0)) * 100).toFixed(2) }));
                        }}
                        className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasSupplyScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                        min="0"
                        step="0.01"
                      />
                      <span className="text-[10px] text-gray-400">%</span>
                      {hasSupplyScenario ? (
                        <button onClick={() => resetSupplyAPY(asset)} className="p-0.5 hover:bg-slate-200 rounded" title="Reset">
                          <RotateCcw className="w-3 h-3 text-gray-400" />
                        </button>
                      ) : <span className="w-4" />}
                    </div>
                  </div>
                )}

                {/* ─── Borrow APY column ─── */}
                {mode === "fixed" && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={editingBorrowAPY[asset.symbol] !== undefined ? editingBorrowAPY[asset.symbol] : (getDisplayBorrowAPY(asset) * 100).toFixed(2)}
                      onChange={(e) => setEditingBorrowAPY((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                      onBlur={() => handleFixedBorrowAPYBlur(asset)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleFixedBorrowAPYBlur(asset), asset.symbol, setEditingBorrowAPY)}
                      onFocus={() => {
                        if (editingBorrowAPY[asset.symbol] === undefined)
                          setEditingBorrowAPY((prev) => ({ ...prev, [asset.symbol]: (getDisplayBorrowAPY(asset) * 100).toFixed(2) }));
                      }}
                      className={`w-full h-7 text-xs border rounded-md px-2 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasBorrowScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                      min="0"
                      step="0.01"
                    />
                    <span className="text-xs text-gray-400">%</span>
                    {savedFlash === `borrow-${asset.symbol}` ? (
                      <Check className="w-4 h-4 text-green-500 animate-in fade-in" />
                    ) : hasBorrowScenario ? (
                      <button onClick={() => resetBorrowAPY(asset)} className="p-1 hover:bg-slate-200 rounded" title={`Reset to ${((asset.variableBorrowAPY ?? 0) * 100).toFixed(2)}%`}>
                        <RotateCcw className="w-3 h-3 text-gray-400" />
                      </button>
                    ) : <span className="w-5" />}
                  </div>
                )}

                {mode === "linear" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 shrink-0">{((asset.variableBorrowAPY ?? 0) * 100).toFixed(1)}→</span>
                    <input
                      type="number"
                      value={editingBorrowAPY[asset.symbol] !== undefined ? editingBorrowAPY[asset.symbol] : ((borrowScenario?.endRate ?? (asset.variableBorrowAPY ?? 0)) * 100).toFixed(2)}
                      onChange={(e) => setEditingBorrowAPY((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                      onBlur={() => handleLinearBorrowAPYBlur(asset)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleLinearBorrowAPYBlur(asset), asset.symbol, setEditingBorrowAPY)}
                      onFocus={() => {
                        if (editingBorrowAPY[asset.symbol] === undefined)
                          setEditingBorrowAPY((prev) => ({ ...prev, [asset.symbol]: ((borrowScenario?.endRate ?? (asset.variableBorrowAPY ?? 0)) * 100).toFixed(2) }));
                      }}
                      className={`w-full h-7 text-xs border rounded-md px-2 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasBorrowScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                      min="0"
                      step="0.01"
                    />
                    <span className="text-xs text-gray-400">%</span>
                    {hasBorrowScenario ? (
                      <button onClick={() => resetBorrowAPY(asset)} className="p-1 hover:bg-slate-200 rounded" title="Reset">
                        <RotateCcw className="w-3 h-3 text-gray-400" />
                      </button>
                    ) : <span className="w-5" />}
                  </div>
                )}

                {mode === "sinusoidal" && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 shrink-0">Min</span>
                      <input
                        type="number"
                        value={editingBorrowMin[asset.symbol] !== undefined ? editingBorrowMin[asset.symbol] : ((borrowScenario?.minRate ?? (asset.variableBorrowAPY ?? 0)) * 100).toFixed(2)}
                        onChange={(e) => setEditingBorrowMin((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                        onBlur={() => handleSinBorrowAPYBlur(asset)}
                        onKeyDown={(e) => handleKeyDown(e, () => handleSinBorrowAPYBlur(asset), asset.symbol, setEditingBorrowMin)}
                        onFocus={() => {
                          if (editingBorrowMin[asset.symbol] === undefined)
                            setEditingBorrowMin((prev) => ({ ...prev, [asset.symbol]: ((borrowScenario?.minRate ?? (asset.variableBorrowAPY ?? 0)) * 100).toFixed(2) }));
                        }}
                        className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasBorrowScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                        min="0"
                        step="0.01"
                      />
                      <span className="text-[10px] text-gray-400">%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 shrink-0">Max</span>
                      <input
                        type="number"
                        value={editingBorrowMax[asset.symbol] !== undefined ? editingBorrowMax[asset.symbol] : ((borrowScenario?.maxRate ?? (asset.variableBorrowAPY ?? 0)) * 100).toFixed(2)}
                        onChange={(e) => setEditingBorrowMax((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                        onBlur={() => handleSinBorrowAPYBlur(asset)}
                        onKeyDown={(e) => handleKeyDown(e, () => handleSinBorrowAPYBlur(asset), asset.symbol, setEditingBorrowMax)}
                        onFocus={() => {
                          if (editingBorrowMax[asset.symbol] === undefined)
                            setEditingBorrowMax((prev) => ({ ...prev, [asset.symbol]: ((borrowScenario?.maxRate ?? (asset.variableBorrowAPY ?? 0)) * 100).toFixed(2) }));
                        }}
                        className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] ${hasBorrowScenario ? "border-[#4F7FFA] bg-blue-50" : "border-gray-200"}`}
                        min="0"
                        step="0.01"
                      />
                      <span className="text-[10px] text-gray-400">%</span>
                      {hasBorrowScenario ? (
                        <button onClick={() => resetBorrowAPY(asset)} className="p-0.5 hover:bg-slate-200 rounded" title="Reset">
                          <RotateCcw className="w-3 h-3 text-gray-400" />
                        </button>
                      ) : <span className="w-4" />}
                    </div>
                  </div>
                )}
              </div>

              {/* Incentive APR sub-row — only for assets with incentives */}
              {(() => {
                const supplyInc = incentiveAPRs?.[asset.symbol]?.supply ?? 0;
                const borrowInc = incentiveAPRs?.[asset.symbol]?.borrow ?? 0;
                if (supplyInc <= 0 && borrowInc <= 0 && !getIncentiveScenario(asset.symbol, "supplyIncentive") && !getIncentiveScenario(asset.symbol, "borrowIncentive")) return null;

                const hasSupplyIncScenario = !!getIncentiveScenario(asset.symbol, "supplyIncentive");
                const hasBorrowIncScenario = !!getIncentiveScenario(asset.symbol, "borrowIncentive");
                const supplyIncScenario = getIncentiveScenario(asset.symbol, "supplyIncentive");
                const borrowIncScenario = getIncentiveScenario(asset.symbol, "borrowIncentive");

                const getDisplaySupplyInc = () => {
                  if (!supplyIncScenario) return supplyInc;
                  if (supplyIncScenario.mode === "linear") return supplyIncScenario.endRate ?? supplyIncScenario.startRate;
                  return supplyIncScenario.startRate;
                };
                const getDisplayBorrowInc = () => {
                  if (!borrowIncScenario) return borrowInc;
                  if (borrowIncScenario.mode === "linear") return borrowIncScenario.endRate ?? borrowIncScenario.startRate;
                  return borrowIncScenario.startRate;
                };

                return (
                  <div className="flex items-center gap-4 px-3 py-1.5 bg-green-50/50 border-b border-green-100 rounded-b-lg -mt-px">
                    <div className="flex items-center gap-1.5 min-w-0" style={{ flex: "1.2" }}>
                      <Badge className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0 shrink-0">Incentive APR</Badge>
                    </div>
                    {/* Spacer for price column */}
                    <div style={{ width: "150px" }} className="shrink-0" />

                    {/* Supply Incentive */}
                    {supplyInc > 0 || hasSupplyIncScenario ? (
                      <div className="flex items-center gap-1" style={{ width: "130px" }}>
                        {mode === "fixed" && (
                          <>
                            <input
                              type="number"
                              value={editingSupplyIncentive[asset.symbol] !== undefined ? editingSupplyIncentive[asset.symbol] : (getDisplaySupplyInc() * 100).toFixed(2)}
                              onChange={(e) => setEditingSupplyIncentive((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                              onBlur={() => handleFixedIncentiveBlur(asset.symbol, "supplyIncentive")}
                              onKeyDown={(e) => handleKeyDown(e, () => handleFixedIncentiveBlur(asset.symbol, "supplyIncentive"), asset.symbol, setEditingSupplyIncentive)}
                              onFocus={() => {
                                if (editingSupplyIncentive[asset.symbol] === undefined)
                                  setEditingSupplyIncentive((prev) => ({ ...prev, [asset.symbol]: (getDisplaySupplyInc() * 100).toFixed(2) }));
                              }}
                              className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${hasSupplyIncScenario ? "border-green-500 bg-green-50" : "border-green-200"}`}
                              min="0"
                              step="0.01"
                            />
                            <span className="text-[10px] text-green-600">%</span>
                            {hasSupplyIncScenario ? (
                              <button onClick={() => resetSupplyIncentive(asset.symbol)} className="p-0.5 hover:bg-green-100 rounded">
                                <RotateCcw className="w-3 h-3 text-green-500" />
                              </button>
                            ) : <span className="w-4" />}
                          </>
                        )}
                        {mode === "linear" && (
                          <>
                            <span className="text-[10px] text-green-600 shrink-0">{(supplyInc * 100).toFixed(1)}→</span>
                            <input
                              type="number"
                              value={editingSupplyIncentive[asset.symbol] !== undefined ? editingSupplyIncentive[asset.symbol] : ((supplyIncScenario?.endRate ?? supplyInc) * 100).toFixed(2)}
                              onChange={(e) => setEditingSupplyIncentive((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                              onBlur={() => handleLinearIncentiveBlur(asset.symbol, "supplyIncentive")}
                              onKeyDown={(e) => handleKeyDown(e, () => handleLinearIncentiveBlur(asset.symbol, "supplyIncentive"), asset.symbol, setEditingSupplyIncentive)}
                              onFocus={() => {
                                if (editingSupplyIncentive[asset.symbol] === undefined)
                                  setEditingSupplyIncentive((prev) => ({ ...prev, [asset.symbol]: ((supplyIncScenario?.endRate ?? supplyInc) * 100).toFixed(2) }));
                              }}
                              className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${hasSupplyIncScenario ? "border-green-500 bg-green-50" : "border-green-200"}`}
                              min="0"
                              step="0.01"
                              placeholder="0 = diluted"
                            />
                            <span className="text-[10px] text-green-600">%</span>
                            {hasSupplyIncScenario ? (
                              <button onClick={() => resetSupplyIncentive(asset.symbol)} className="p-0.5 hover:bg-green-100 rounded">
                                <RotateCcw className="w-3 h-3 text-green-500" />
                              </button>
                            ) : <span className="w-4" />}
                          </>
                        )}
                        {mode === "sinusoidal" && (
                          <span className="text-[10px] text-green-600">{(supplyInc * 100).toFixed(2)}%</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ width: "130px" }} className="shrink-0" />
                    )}

                    {/* Borrow Incentive */}
                    {borrowInc > 0 || hasBorrowIncScenario ? (
                      <div className="flex items-center gap-1" style={{ width: "130px" }}>
                        {mode === "fixed" && (
                          <>
                            <input
                              type="number"
                              value={editingBorrowIncentive[asset.symbol] !== undefined ? editingBorrowIncentive[asset.symbol] : (getDisplayBorrowInc() * 100).toFixed(2)}
                              onChange={(e) => setEditingBorrowIncentive((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                              onBlur={() => handleFixedIncentiveBlur(asset.symbol, "borrowIncentive")}
                              onKeyDown={(e) => handleKeyDown(e, () => handleFixedIncentiveBlur(asset.symbol, "borrowIncentive"), asset.symbol, setEditingBorrowIncentive)}
                              onFocus={() => {
                                if (editingBorrowIncentive[asset.symbol] === undefined)
                                  setEditingBorrowIncentive((prev) => ({ ...prev, [asset.symbol]: (getDisplayBorrowInc() * 100).toFixed(2) }));
                              }}
                              className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${hasBorrowIncScenario ? "border-green-500 bg-green-50" : "border-green-200"}`}
                              min="0"
                              step="0.01"
                            />
                            <span className="text-[10px] text-green-600">%</span>
                            {hasBorrowIncScenario ? (
                              <button onClick={() => resetBorrowIncentive(asset.symbol)} className="p-0.5 hover:bg-green-100 rounded">
                                <RotateCcw className="w-3 h-3 text-green-500" />
                              </button>
                            ) : <span className="w-4" />}
                          </>
                        )}
                        {mode === "linear" && (
                          <>
                            <span className="text-[10px] text-green-600 shrink-0">{(borrowInc * 100).toFixed(1)}→</span>
                            <input
                              type="number"
                              value={editingBorrowIncentive[asset.symbol] !== undefined ? editingBorrowIncentive[asset.symbol] : ((borrowIncScenario?.endRate ?? borrowInc) * 100).toFixed(2)}
                              onChange={(e) => setEditingBorrowIncentive((prev) => ({ ...prev, [asset.symbol]: e.target.value }))}
                              onBlur={() => handleLinearIncentiveBlur(asset.symbol, "borrowIncentive")}
                              onKeyDown={(e) => handleKeyDown(e, () => handleLinearIncentiveBlur(asset.symbol, "borrowIncentive"), asset.symbol, setEditingBorrowIncentive)}
                              onFocus={() => {
                                if (editingBorrowIncentive[asset.symbol] === undefined)
                                  setEditingBorrowIncentive((prev) => ({ ...prev, [asset.symbol]: ((borrowIncScenario?.endRate ?? borrowInc) * 100).toFixed(2) }));
                              }}
                              className={`w-full h-6 text-[11px] border rounded px-1.5 text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${hasBorrowIncScenario ? "border-green-500 bg-green-50" : "border-green-200"}`}
                              min="0"
                              step="0.01"
                              placeholder="0 = diluted"
                            />
                            <span className="text-[10px] text-green-600">%</span>
                            {hasBorrowIncScenario ? (
                              <button onClick={() => resetBorrowIncentive(asset.symbol)} className="p-0.5 hover:bg-green-100 rounded">
                                <RotateCcw className="w-3 h-3 text-green-500" />
                              </button>
                            ) : <span className="w-4" />}
                          </>
                        )}
                        {mode === "sinusoidal" && (
                          <span className="text-[10px] text-green-600">{(borrowInc * 100).toFixed(2)}%</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ width: "130px" }} className="shrink-0" />
                    )}
                  </div>
                );
              })()}
            </React.Fragment>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-200 mt-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 px-4"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PriceRatesModal;
