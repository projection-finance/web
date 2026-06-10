"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Badge } from "@/src/components/ui/badge";
import { ChevronDown, ChevronUp, Eye, EyeOff, FolderOpen, Layers, Pencil, Plus, RotateCw, Save, Search, Settings2, Share2, Sparkles, Trash2, Wallet, X } from "lucide-react";
import { useTokenProjection } from "@/src/hooks/useTokenProjection";
import { useTokenProjectionSaves, TokenProjectionSave } from "@/src/hooks/useTokenProjectionSaves";
import { CoinGeckoSearchResult } from "@/src/lib/tokens/types";
import { formatQty, formatUSD } from "@/src/lib/format";
import TokenProjectionChart from "./TokenProjectionChart";
import TokenPriceRatesModal from "./TokenPriceModal";
import TokenActionModal from "./TokenActionModal";
import TokenSaveModal from "./TokenSaveModal";
import TokenLoadModal from "./TokenLoadModal";
import WalletImportModal from "./WalletImportModal";
import YieldBrowserModal from "./YieldBrowserModal";
import { usePlan } from "@/src/hooks/usePlan";
import { useRecentWallets } from "@/src/hooks/useRecentWallets";
import { useSession } from "next-auth/react";
import AISummaryModal from "@/src/components/simulation/AISummaryModal";
import ShareSummaryPrompt from "@/src/components/simulation/ShareSummaryPrompt";
import { AISummaryData, AISummaryRequest, AIModel } from "@/src/lib/ai/types";
import { getNetworkById } from "@/src/lib/aave/networks";
import Image from "next/image";

const DURATION_PRESETS = [7, 30, 90, 180, 365];

const ACTION_COLORS: Record<string, string> = {
  receive: "text-green-600 bg-green-50",
  send: "text-red-600 bg-red-50",
  swap: "text-sky-700 bg-sky-50",
  supply: "text-[#5382E3] bg-[#5382E3]/10",
  claim: "text-amber-600 bg-amber-50",
  borrow: "text-orange-600 bg-orange-50",
  repay: "text-teal-600 bg-teal-50",
};

const ACTION_LABELS: Record<string, string> = {
  receive: "Receive",
  send: "Send",
  swap: "Swap",
  supply: "Supply",
  claim: "Claim",
  borrow: "Borrow",
  repay: "Repay",
};

interface TokenPortfolioProps {
  projectionId?: string;
}

const TokenPortfolio: React.FC<TokenPortfolioProps> = ({ projectionId: projectionIdProp }) => {
  const { isFree, features } = usePlan();
  const { wallets: recentWallets, addRecentWallet } = useRecentWallets();
  const {
    holdings,
    config,
    result,
    isRunning,
    selectedDay,
    setSelectedDay,
    searchResults,
    isSearching,
    searchTokens,
    addToken,
    removeToken,
    updateQuantity,
    updateDuration,
    addPriceScenario,
    removePriceScenario,
    rateScenarios,
    addRateScenario,
    removeRateScenario,
    actions,
    addAction,
    removeAction,
    loadProjection,
    importFromWallet,
    importSource,
    clearImportSource,
    addYieldToken,
  } = useTokenProjection();

  const { data: session } = useSession();
  const { saves, save: saveProjection, load: loadSavedProjection, duplicate: duplicateProjection, remove: removeProjection } = useTokenProjectionSaves();
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [aiSummaryModalOpen, setAiSummaryModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummaryData | null>(null);
  const [shareSummaryPromptOpen, setShareSummaryPromptOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addQty, setAddQty] = useState<Record<string, string>>({});
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [yieldBrowserOpen, setYieldBrowserOpen] = useState(false);
  const [searchPrices, setSearchPrices] = useState<Record<string, number>>({});

  // Timeline state
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [timelineOpacity, setTimelineOpacity] = useState(false);

  // Debounced search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        searchTokens(query);
      }, 300);
    },
    [searchTokens]
  );

  const handleAddToken = useCallback(
    async (token: CoinGeckoSearchResult) => {
      const qty = parseFloat(addQty[token.id] || "1") || 1;
      const price = searchPrices[token.id] || undefined;

      if (selectedDay !== null && selectedDay > 0) {
        // Adding on a future day → create a "receive" action
        // Ensure the token exists in initial holdings (with 0 qty if new)
        const existsInHoldings = holdings.some((h) => h.coingeckoId === token.id);
        if (!existsInHoldings) {
          await addToken(token, 0, price);
        }
        addAction({
          day: selectedDay,
          type: "receive",
          symbol: token.symbol.toUpperCase(),
          amount: qty,
        });
      } else {
        // Day 0 or no day selected → add to initial holdings
        await addToken(token, qty, price);
      }

      setAddQty((prev) => {
        const next = { ...prev };
        delete next[token.id];
        return next;
      });
    },
    [addToken, addAction, addQty, searchPrices, selectedDay, holdings]
  );

  const sortedActions = useMemo(
    () => [...actions].sort((a, b) => a.day - b.day || a.orderInDay - b.orderInDay),
    [actions]
  );

  // Last action day — can only add actions at or after this day
  const lastActionDay = useMemo(
    () => (actions.length > 0 ? Math.max(...actions.map((a) => a.day)) : 0),
    [actions]
  );

  // Smart action day: auto-pick the best day for a new action
  const handleAddAction = useCallback(() => {
    // Pick the right day: selectedDay if valid, otherwise auto-pick
    let targetDay = selectedDay ?? 0;
    const minDay = Math.max(1, lastActionDay);
    if (targetDay < minDay) targetDay = minDay;
    setSelectedDay(targetDay);
    setActionModalOpen(true);
  }, [selectedDay, lastActionDay, setSelectedDay]);

  // Save / Load handlers
  const handleSave = useCallback(async (name: string, details: string) => {
    try {
      const saved = await saveProjection({
        name,
        details,
        holdings,
        actions,
        priceScenarios: config.priceScenarios,
        rateScenarios: config.rateScenarios,
        durationDays: config.durationDays,
        importSource,
      });
      setCurrentSaveId(saved.id);
    } catch { /* silent */ }
  }, [holdings, actions, config, importSource, saveProjection]);

  const handleLoad = useCallback(async (save: TokenProjectionSave) => {
    try {
      const full = await loadSavedProjection(save.id);
      loadProjection({
        holdings: full.holdings,
        actions: full.actions,
        priceScenarios: full.priceScenarios,
        rateScenarios: full.rateScenarios,
        durationDays: full.durationDays,
        importSource: full.importSource,
      });
      setCurrentSaveId(full.id);
      setHasInteracted(true);
    } catch { /* silent */ }
  }, [loadProjection, loadSavedProjection]);

  // Build AI Summary request from current sandbox simulation
  const buildSummaryRequest = useCallback((language: string, model?: AIModel): AISummaryRequest => {
    const day0 = result?.timeline[0];
    const dayN = result?.timeline[result.timeline.length - 1];
    return {
      type: "sandbox",
      language,
      model,
      address: importSource?.address,
      ensName: importSource?.ensName,
      network: importSource?.network,
      durationDays: config.durationDays,
      sandboxSummary: result?.summary,
      sandboxStartHoldings: day0?.holdings.filter((h) => h.quantity > 0).map((h) => ({
        symbol: h.symbol, quantity: h.quantity, valueUSD: h.valueUSD,
      })),
      sandboxEndHoldings: dayN?.holdings.filter((h) => h.quantity > 0).map((h) => ({
        symbol: h.symbol, quantity: h.quantity, valueUSD: h.valueUSD,
      })),
      priceChanges: config.priceScenarios.map((p) => ({
        symbol: p.symbol, mode: p.mode, startPrice: p.startPrice, endPrice: p.endPrice,
      })),
      sandboxActions: actions.map((a) => ({
        day: a.day, type: a.type, symbol: a.symbol, amount: a.amount, toSymbol: a.toSymbol,
      })),
    };
  }, [result, config, actions, importSource]);

  // Share sandbox with optional AI summary
  const handleShareWithSummary = useCallback(async (summaryToInclude: AISummaryData | null) => {
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: importSource?.address ?? "",
          network: importSource?.network ?? undefined,
          name: `Sandbox ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          type: "sandbox",
          config: {
            durationDays: config.durationDays,
            holdings,
            priceScenarios: config.priceScenarios,
            actions,
            importSource,
          },
          aiSummary: summaryToInclude,
        }),
      });
      if (!res.ok) throw new Error("Share failed");
      const data = await res.json();
      await navigator.clipboard.writeText(data.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch { /* silent */ }
    finally { setShareLoading(false); }
  }, [importSource, config, holdings, actions]);

  // Focus search input when opening
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Fetch prices for search results (merge into existing to avoid losing prices between searches)
  useEffect(() => {
    if (searchResults.length === 0) return;
    const ids = searchResults.map((t) => t.id).join(",");
    let cancelled = false;
    fetch(`/api/tokens/price?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, { usd?: number }>) => {
        if (cancelled) return;
        setSearchPrices((prev) => {
          const next = { ...prev };
          for (const t of searchResults) {
            next[t.id] = data[t.id]?.usd ?? prev[t.id] ?? 0;
          }
          return next;
        });
      })
      .catch((err) => { console.warn("[TokenPortfolio] Price fetch failed:", err.message); });
    return () => { cancelled = true; };
  }, [searchResults]);

  // Auto-open import modal on first visit (no holdings, no projection to load)
  const hasShownImport = useRef(false);
  useEffect(() => {
    if (hasShownImport.current || hasInteracted || projectionIdProp) return;
    if (holdings.length === 0) {
      hasShownImport.current = true;
      setImportModalOpen(true);
    }
  }, [holdings.length, hasInteracted, projectionIdProp]);

  // Auto-load from URL param
  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (!projectionIdProp || hasAutoLoaded.current) return;
    hasAutoLoaded.current = true;
    loadSavedProjection(projectionIdProp).then((full) => {
      loadProjection({
        holdings: full.holdings,
        actions: full.actions,
        priceScenarios: full.priceScenarios,
        rateScenarios: full.rateScenarios,
        durationDays: full.durationDays,
      });
      setCurrentSaveId(full.id);
    }).catch((err) => { console.error("[TokenPortfolio] Failed to load projection:", err.message); });
  }, [projectionIdProp, loadSavedProjection, loadProjection]);

  // Selected day snapshot
  const daySnapshot = useMemo(() => {
    if (selectedDay === null || !result) return null;
    return result.timeline[selectedDay] ?? null;
  }, [selectedDay, result]);

  // Display holdings: simulation state at selectedDay, or initial holdings
  const displayHoldings = useMemo(() => {
    if (daySnapshot) {
      return daySnapshot.holdings.map((h) => ({
        coingeckoId: h.coingeckoId,
        symbol: h.symbol,
        name: h.name,
        image: h.image,
        quantity: h.quantity,
        supplied: h.supplied,
        borrowed: h.borrowed,
        currentPriceUSD: h.priceUSD,
        valueUSD: h.valueUSD,
        supplyAPY: h.supplyAPY,
        borrowAPY: h.borrowAPY,
        yieldSource: holdings.find((ih) => ih.symbol === h.symbol)?.yieldSource,
      }));
    }
    return holdings.map((h) => ({
      coingeckoId: h.coingeckoId,
      symbol: h.symbol,
      name: h.name,
      image: h.image,
      quantity: h.quantity,
      supplied: 0,
      borrowed: 0,
      currentPriceUSD: h.currentPriceUSD,
      valueUSD: h.quantity * h.currentPriceUSD,
      supplyAPY: undefined as number | undefined,
      borrowAPY: undefined as number | undefined,
      yieldSource: h.yieldSource,
    }));
  }, [daySnapshot, holdings]);

  // Total portfolio value at current view
  const totalValue = useMemo(
    () => displayHoldings.reduce((sum, h) => sum + h.valueUSD, 0),
    [displayHoldings]
  );

  // Duration bounds
  const maxDuration = isFree ? features.maxProjectionDays : 365;
  const minDuration = lastActionDay > 0 ? lastActionDay + 1 : 1;

  const hasTimeline = result && holdings.length > 0;

  return (
    <div className={`flex-1 ${hasTimeline ? (timelineCollapsed ? "pb-[60px]" : "pb-[260px]") : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-[#303549]">Portfolio Sandbox</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {importSource ? (
              <>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#5382E3]/10 rounded-md">
                  {(() => {
                    const net = getNetworkById(importSource.network);
                    return net ? (
                      <Image src={net.logo} alt={net.name} width={12} height={12} />
                    ) : null;
                  })()}
                  <span className="text-[10px] text-[#5382E3] font-medium">
                    {getNetworkById(importSource.network)?.name}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {importSource.ensName || `${importSource.address.slice(0, 6)}...${importSource.address.slice(-4)}`}
                  </span>
                </div>
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="text-[10px] text-gray-400 hover:text-[#5382E3] flex items-center gap-0.5"
                  title="Rescan wallet"
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  Rescan
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                Build any token portfolio, simulate actions and strategies — no protocol required.
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportModalOpen(true)}
          className="h-7 px-3 text-[11px] gap-1"
        >
          <Wallet className="w-3 h-3" />
          Import Wallet
        </Button>
      </div>

      {/* Main 2-col layout: content + right sidebar */}
      <div className="flex gap-6">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Summary metrics bar */}
          {result && holdings.length > 0 && (
            <div className="flex items-center gap-0 rounded-lg px-4 py-2.5 bg-[#F5F5FA]">
              {[
                { label: "Start Value", value: `$${formatUSD(result.summary.startValueUSD)}` },
                { label: "End Value", value: `$${formatUSD(result.summary.endValueUSD)}` },
                { label: "Change", value: `${result.summary.changePercent >= 0 ? "+" : ""}${(result.summary.changePercent * 100).toFixed(2)}%`, color: result.summary.changePercent >= 0 ? "text-green-600" : "text-red-500" },
                { label: "P&L", value: `${result.summary.changeUSD >= 0 ? "+" : ""}$${formatUSD(Math.abs(result.summary.changeUSD))}`, color: result.summary.changeUSD >= 0 ? "text-green-600" : "text-red-500" },
                { label: "Highest", value: `$${formatUSD(result.summary.highestValueUSD)}` },
                { label: "Lowest", value: `$${formatUSD(result.summary.lowestValueUSD)}` },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-start min-w-0 flex-1">
                  <span className={`text-sm font-semibold ${item.color ?? "text-[#303549]"}`}>{item.value}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Holdings + Actions grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Holdings — shows simulation state at selectedDay */}
            <div className="bg-[#F5F5FA] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#303549]">
                    Holdings
                    {selectedDay !== null && selectedDay > 0 && (
                      <span className="text-[10px] text-gray-400 font-normal ml-1.5">Day {selectedDay}</span>
                    )}
                  </h2>
                  {displayHoldings.length > 0 && (
                    <span className="text-xs text-gray-500">
                      Total: <span className="font-medium text-[#303549]">${formatUSD(totalValue)}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setYieldBrowserOpen(true)}
                    className="h-7 px-2.5 text-[11px]"
                  >
                    <Layers className="w-3 h-3 mr-1" />
                    Yields
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setSearchOpen(true)}
                    className="h-7 px-3 text-[11px] bg-[#303549] hover:bg-[#1e2333]"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Token
                  </Button>
                </div>
              </div>

              {displayHoldings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] text-gray-500">Token</TableHead>
                      <TableHead className="text-[11px] text-gray-500 text-right">Wallet</TableHead>
                      {displayHoldings.some((h) => h.supplied > 0) && (
                        <TableHead className="text-[11px] text-gray-500 text-right">Supplied</TableHead>
                      )}
                      {displayHoldings.some((h) => h.borrowed > 0) && (
                        <TableHead className="text-[11px] text-gray-500 text-right">Borrowed</TableHead>
                      )}
                      <TableHead className="text-[11px] text-gray-500 text-right">Price</TableHead>
                      <TableHead className="text-[11px] text-gray-500 text-right">Value</TableHead>
                      <TableHead className="text-[11px] text-gray-500 text-right w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayHoldings.map((h) => {
                      const isInitial = holdings.some((ih) => ih.symbol === h.symbol);
                      return (
                        <TableRow key={h.coingeckoId} className="group">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {h.image ? (
                                <img src={h.image} alt={h.symbol} className="w-5 h-5 rounded-full" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold">
                                  {h.symbol.slice(0, 2)}
                                </div>
                              )}
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs font-medium text-[#303549]">{h.symbol}</span>
                                {!isInitial && (
                                  <span className="text-[8px] bg-sky-50 text-sky-600 rounded px-1 py-0.5 font-medium">
                                    NEW
                                  </span>
                                )}
                                {h.supplied > 0 && (
                                  <span className="text-[8px] bg-[#5382E3]/10 text-[#5382E3] rounded px-1 py-0.5 font-medium">
                                    SUPPLY
                                  </span>
                                )}
                                {h.borrowed > 0 && (
                                  <span className="text-[8px] bg-orange-50 text-orange-600 rounded px-1 py-0.5 font-medium">
                                    DEBT
                                  </span>
                                )}
                                {h.yieldSource && (
                                  <a
                                    href={h.yieldSource.protocolUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[8px] bg-[#5382E3]/10 text-[#5382E3] rounded px-1 py-0.5 font-medium hover:bg-[#5382E3]/20 transition-colors"
                                    title={`${h.yieldSource.protocol} on ${h.yieldSource.networkName}`}
                                  >
                                    {h.yieldSource.protocol === "aave" ? "Aave" : "Morpho"} · {h.yieldSource.networkName}
                                  </a>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          {/* Wallet qty — always show simulation value, pencil to edit initial */}
                          <TableCell className="text-right">
                            {editingQty === h.coingeckoId ? (
                              <input
                                type="number"
                                value={editQtyValue}
                                onChange={(e) => setEditQtyValue(e.target.value)}
                                onBlur={() => { const v = parseFloat(editQtyValue); if (v > 0) updateQuantity(h.coingeckoId, v); setEditingQty(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat(editQtyValue); if (v > 0) updateQuantity(h.coingeckoId, v); setEditingQty(null); } if (e.key === "Escape") setEditingQty(null); }}
                                className="w-20 text-right text-xs border border-[#5382E3] rounded px-1 py-0.5 focus:outline-none"
                                autoFocus step="any"
                              />
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-[#303549]">{formatQty(h.quantity)}</span>
                                {isInitial && (
                                  <button
                                    onClick={() => {
                                      const initial = holdings.find((ih) => ih.coingeckoId === h.coingeckoId);
                                      setEditingQty(h.coingeckoId);
                                      setEditQtyValue(initial?.quantity.toString() ?? h.quantity.toString());
                                    }}
                                    className="p-0.5 rounded hover:bg-gray-200 text-gray-300 hover:text-[#5382E3] opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Edit initial quantity"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </TableCell>
                          {displayHoldings.some((dh) => dh.supplied > 0) && (
                            <TableCell className="text-right">
                              {h.supplied > 0 ? (
                                <span className="text-xs text-[#5382E3]">{formatQty(h.supplied)}</span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </TableCell>
                          )}
                          {displayHoldings.some((dh) => dh.borrowed > 0) && (
                            <TableCell className="text-right">
                              {h.borrowed > 0 ? (
                                <span className="text-xs text-red-500">{formatQty(h.borrowed)}</span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </TableCell>
                          )}
                          {/* Price */}
                          <TableCell className="text-right">
                            <span className="text-xs text-[#303549]">${formatUSD(h.currentPriceUSD)}</span>
                          </TableCell>
                          {/* Value */}
                          <TableCell className="text-right text-xs font-medium text-[#303549]">
                            ${formatUSD(h.valueUSD)}
                          </TableCell>
                          {/* Delete — only initial tokens */}
                          <TableCell className="text-right">
                            {isInitial && (
                              <button
                                onClick={() => removeToken(h.coingeckoId)}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#5382E3]/10 flex items-center justify-center mb-3">
                    <Plus className="w-5 h-5 text-[#5382E3]" />
                  </div>
                  <p className="text-sm font-medium text-[#303549] mb-1">No tokens yet</p>
                  <p className="text-xs text-gray-500 max-w-xs">
                    Search and add any CoinGecko token to build your portfolio projection.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setSearchOpen(true)}
                    className="mt-3 h-7 px-4 text-[11px] bg-[#303549] hover:bg-[#1e2333]"
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Search tokens
                  </Button>
                </div>
              )}
            </div>

            {/* Scheduled Actions */}
            <div className="bg-[#F5F5FA] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#303549]">Scheduled Actions</h2>
                  <span className="text-[10px] text-gray-500">
                    Actions are chronological. New actions append at the end.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleAddAction}
                  disabled={holdings.length === 0}
                  title={holdings.length === 0 ? "Add tokens to your portfolio first" : `Add action at Day ${Math.max(selectedDay ?? 1, 1, lastActionDay)}`}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Action
                </Button>
              </div>

              {sortedActions.length === 0 && (
                <p className="text-xs text-gray-400">
                  {holdings.length === 0
                    ? "Add tokens first, then schedule actions."
                    : "No actions scheduled. Day 0 is your baseline — actions start at Day 1."}
                </p>
              )}

              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {sortedActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-lg group"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Day {action.day}
                      </Badge>
                      <Badge className={`text-[10px] px-1.5 py-0 ${ACTION_COLORS[action.type] ?? ""}`}>
                        {ACTION_LABELS[action.type] ?? action.type}
                      </Badge>
                      <span className="text-xs text-[#303549]">
                        {action.type === "swap"
                          ? `${action.fromAmount} ${action.fromSymbol} → ${action.toSymbol}`
                          : action.type === "supply"
                          ? `${action.amount} ${action.symbol} @ ${((action.supplyConfig?.apy ?? 0) * 100).toFixed(1)}% APY${action.supplyConfig?.locked ? ` (locked ${action.supplyConfig.lockDays}d)` : ""}`
                          : action.type === "borrow"
                          ? `${action.amount} ${action.symbol} @ ${((action.borrowConfig?.borrowAPY ?? 0) * 100).toFixed(1)}% APY`
                          : `${action.amount} ${action.symbol}`}
                      </span>
                    </div>
                    <button
                      onClick={() => removeAction(action.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Loading indicator */}
          {isRunning && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-3.5 h-3.5 border-2 border-[#5382E3] border-t-transparent rounded-full animate-spin" />
                Running simulation...
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar — always visible */}
        <div className="w-[280px] shrink-0 space-y-4">
          {/* Duration */}
          <div className="bg-[#F5F5FA] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#303549] mb-2">Projection Duration</h3>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((d) => {
                const tooShort = d < minDuration;
                const tooLong = d > maxDuration;
                const disabled = tooShort || tooLong;
                return (
                  <button
                    key={d}
                    onClick={() => !disabled && updateDuration(d)}
                    disabled={disabled}
                    title={tooShort ? `Actions exist up to Day ${lastActionDay}` : undefined}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      config.durationDays === d
                        ? "bg-[#303549] text-white"
                        : disabled
                        ? "text-gray-300 cursor-not-allowed bg-gray-50"
                        : "text-gray-500 hover:bg-gray-100 bg-white"
                    }`}
                  >
                    {d}d
                    {tooLong && isFree && (
                      <span className="ml-1 text-[8px] bg-gray-200 text-gray-400 rounded px-1">PRO</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              <input
                type="range"
                min={minDuration}
                max={maxDuration}
                value={config.durationDays}
                onChange={(e) => updateDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#5382E3]"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>{minDuration}d</span>
                <span className="font-medium text-[#303549]">{config.durationDays}d</span>
                <span>{maxDuration}d</span>
              </div>
            </div>
          </div>

          {/* Price scenarios */}
          <div className="bg-[#F5F5FA] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#303549] mb-2">Price Scenarios</h3>
            {config.priceScenarios.length > 0 && (
              <div className="space-y-1 mb-2">
                {config.priceScenarios.map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between bg-white rounded px-2 py-1">
                    <span className="text-[11px] font-medium text-[#303549]">{s.symbol}</span>
                    <span className="text-[10px] text-gray-500 capitalize">{s.mode}</span>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPriceModalOpen(true)}
              disabled={holdings.length === 0}
              className="w-full h-7 text-[11px]"
            >
              <Settings2 className="w-3 h-3 mr-1" />
              {config.priceScenarios.length > 0 ? "Edit Scenarios" : "Configure Prices"}
            </Button>
          </div>

          {/* Interest / Rewards / Borrow summary */}
          {result && (result.summary.totalInterestEarned > 0 || result.summary.totalRewardsEarned > 0 || result.summary.totalBorrowInterestPaid > 0 || result.summary.totalBorrowIncentivesEarned > 0) && (
            <div className="bg-[#F5F5FA] rounded-lg p-4 space-y-1.5">
              {result.summary.totalInterestEarned > 0 && (
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-500">Interest Earned</span>
                  <span className="text-xs font-medium text-green-600">+${formatUSD(result.summary.totalInterestEarned)}</span>
                </div>
              )}
              {result.summary.totalRewardsEarned > 0 && (
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-500">Rewards Earned</span>
                  <span className="text-xs font-medium text-[#5382E3]">+${formatUSD(result.summary.totalRewardsEarned)}</span>
                </div>
              )}
              {result.summary.totalBorrowInterestPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-500">Borrow Interest Paid</span>
                  <span className="text-xs font-medium text-red-500">-${formatUSD(result.summary.totalBorrowInterestPaid)}</span>
                </div>
              )}
              {result.summary.totalBorrowIncentivesEarned > 0 && (
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-500">Borrow Incentives</span>
                  <span className="text-xs font-medium text-green-600">+${formatUSD(result.summary.totalBorrowIncentivesEarned)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom timeline */}
      {hasTimeline && (
        <div className={`fixed bottom-0 left-0 right-0 z-30 border-t border-slate-300 ${
          timelineOpacity ? "bg-[#F5F5FA]/85 backdrop-blur-sm" : "bg-[#F5F5FA]"
        }`}>
          <div className="px-6 py-2">
            {/* Header — always visible */}
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setTimelineCollapsed((c) => !c)}
            >
              <div className="flex items-center gap-2">
                {timelineCollapsed ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                <p className="text-sm font-semibold text-[#303549]">Projection Timeline</p>
                {selectedDay !== null && (
                  <span className="text-[10px] text-gray-400">Day {selectedDay}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {result && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 gap-1"
                    onClick={() => setAiSummaryModalOpen(true)}
                  >
                    <Sparkles className="w-3 h-3 text-[#5382E3]" />
                    {aiSummary ? "Summary" : "AI Summary"}
                  </Button>
                )}
                {result && session?.user && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 gap-1"
                    disabled={shareLoading}
                    onClick={() => setShareSummaryPromptOpen(true)}
                  >
                    <Share2 className="w-3 h-3" />
                    {shareLoading ? "..." : shareCopied ? "Copied!" : "Share"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1"
                  onClick={() => setSaveModalOpen(true)}
                  disabled={holdings.length === 0}
                >
                  <Save className="w-3 h-3" />
                  {currentSaveId ? "Save" : "Save as"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1"
                  onClick={() => setLoadModalOpen(true)}
                >
                  <FolderOpen className="w-3 h-3" />
                  Load
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1"
                  onClick={() => setPriceModalOpen(true)}
                  disabled={holdings.length === 0}
                >
                  <Settings2 className="w-3 h-3" />
                  Configure
                </Button>
                <button
                  onClick={() => setTimelineOpacity((o) => !o)}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400"
                  title={timelineOpacity ? "Opaque" : "Transparent"}
                >
                  {timelineOpacity ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Chart — collapsible */}
            {!timelineCollapsed && (
              <div className="mt-1">
                <TokenProjectionChart
                  result={result}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  priceScenarios={config.priceScenarios}
                  actions={actions}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSearchOpen(false)} />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="border-b border-gray-100">
              <div className="flex items-center gap-2 px-4 py-3">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search any token (e.g. Bitcoin, ETH, Solana...)"
                  className="flex-1 text-sm focus:outline-none"
                />
                <button onClick={() => setSearchOpen(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              {selectedDay !== null && selectedDay > 0 && (
                <div className="px-4 pb-2">
                  <span className="text-[10px] text-green-600 bg-green-50 rounded-full px-2 py-0.5 font-medium">
                    Adding tokens will create a Receive action on Day {selectedDay}
                  </span>
                </div>
              )}
            </div>
            <div className="max-h-[350px] overflow-y-auto">
              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-4 h-4 border-2 border-[#5382E3] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!isSearching && searchResults.length === 0 && searchQuery.length > 0 && (
                <div className="text-center py-8"><p className="text-sm text-gray-400">No tokens found</p></div>
              )}
              {!isSearching && searchQuery.length === 0 && (
                <div className="text-center py-8"><p className="text-sm text-gray-400">Type to search CoinGecko tokens</p></div>
              )}
              {!isSearching && searchResults.map((token) => {
                const alreadyAdded = holdings.some((h) => h.coingeckoId === token.id);
                const isFutureDay = selectedDay !== null && selectedDay > 0;
                const isDisabled = alreadyAdded && !isFutureDay;
                const price = searchPrices[token.id] ?? 0;
                const qty = parseFloat(addQty[token.id] || "0");
                const usdValue = qty > 0 && price > 0 ? qty * price : 0;
                return (
                  <div key={token.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <img src={token.thumb} alt={token.symbol} className="w-7 h-7 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#303549]">{token.symbol}</span>
                        {token.market_cap_rank && (
                          <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1 py-0.5">#{token.market_cap_rank}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 truncate">{token.name}</span>
                        {price > 0 && (
                          <span className="text-[10px] text-gray-500 font-medium">${formatUSD(price)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={addQty[token.id] ?? ""}
                          onChange={(e) => setAddQty((prev) => ({ ...prev, [token.id]: e.target.value }))}
                          className="w-16 text-right text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-[#5382E3]"
                          step="any" min={0}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddToken(token)}
                          disabled={isDisabled}
                          className={`h-7 px-3 text-[11px] ${isDisabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : isFutureDay ? "bg-green-600 hover:bg-green-700" : "bg-[#303549] hover:bg-[#1e2333]"}`}
                        >
                          {isDisabled ? "Added" : isFutureDay ? "Receive" : "Add"}
                        </Button>
                      </div>
                      {usdValue > 0 && (
                        <span className="text-[10px] text-gray-400">≈ ${formatUSD(usdValue)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <YieldBrowserModal
        isOpen={yieldBrowserOpen}
        onClose={() => setYieldBrowserOpen(false)}
        onAddYieldToken={addYieldToken}
        walletHoldings={holdings}
      />
      <TokenPriceRatesModal
        isOpen={priceModalOpen}
        onClose={() => setPriceModalOpen(false)}
        holdings={holdings}
        priceScenarios={config.priceScenarios}
        onUpdatePriceScenario={addPriceScenario}
        onRemovePriceScenario={removePriceScenario}
        rateScenarios={rateScenarios}
        onUpdateRateScenario={addRateScenario}
        onRemoveRateScenario={removeRateScenario}
      />
      <TokenActionModal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        onExecute={addAction}
        holdings={holdings}
        existingActions={actions}
        currentDay={selectedDay ?? 0}
      />
      <AISummaryModal
        isOpen={aiSummaryModalOpen}
        onClose={() => setAiSummaryModalOpen(false)}
        existingSummary={aiSummary}
        onSave={setAiSummary}
        buildRequest={buildSummaryRequest}
      />
      <ShareSummaryPrompt
        isOpen={shareSummaryPromptOpen}
        onClose={() => setShareSummaryPromptOpen(false)}
        existingSummary={aiSummary}
        onShareWithSummary={handleShareWithSummary}
        onOpenSummaryModal={() => setAiSummaryModalOpen(true)}
        isSharing={shareLoading}
      />
      <TokenSaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSave}
        defaultName={holdings.map((h) => h.symbol).join(" + ") || "Token Projection"}
      />
      <TokenLoadModal
        isOpen={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        saves={saves}
        onLoad={handleLoad}
        onDuplicate={duplicateProjection}
        onDelete={removeProjection}
        currentId={currentSaveId}
      />
      <WalletImportModal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setHasInteracted(true);
        }}
        onImport={(walletHoldings, source) => {
          importFromWallet(walletHoldings, source);
          setHasInteracted(true);
        }}
        onStartFromScratch={() => {
          clearImportSource();
          setHasInteracted(true);
        }}
        recentWallets={recentWallets}
        onAddRecentWallet={addRecentWallet}
      />
    </div>
  );
};

export default TokenPortfolio;
