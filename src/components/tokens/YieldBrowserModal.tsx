"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { formatAPY, formatUSD } from "@/src/lib/format";
import { Search, ChevronDown, ChevronUp, Wallet } from "lucide-react";
import Image from "next/image";
import type { YieldRow } from "@/src/app/api/yields/route";
import type { TokenHolding } from "@/src/lib/tokens/types";

interface YieldBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddYieldToken: (
    yieldRow: YieldRow,
    positionType: "supply" | "borrow",
    amount: number,
  ) => void;
  walletHoldings?: TokenHolding[];
}

type ProtocolFilter = "all" | "aave" | "morpho";
type CategoryFilter = "all" | "stablecoins" | "non-stablecoins";

const YieldBrowserModal: React.FC<YieldBrowserModalProps> = ({
  isOpen,
  onClose,
  onAddYieldToken,
  walletHoldings,
}) => {
  const [rows, setRows] = useState<YieldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [myTokensOnly, setMyTokensOnly] = useState(false);

  // Expanded row
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  // Build a set of coingeckoIds from wallet holdings for fast lookup
  const walletCoingeckoIds = useMemo(() => {
    if (!walletHoldings || walletHoldings.length === 0) return new Set<string>();
    return new Set(walletHoldings.map((h) => h.coingeckoId).filter(Boolean));
  }, [walletHoldings]);

  // Fallback: set of symbols (lowercase) for tokens without coingeckoId match
  const walletSymbols = useMemo(() => {
    if (!walletHoldings || walletHoldings.length === 0) return new Set<string>();
    return new Set(walletHoldings.map((h) => h.symbol.toLowerCase()));
  }, [walletHoldings]);

  const hasWallet = walletCoingeckoIds.size > 0 || walletSymbols.size > 0;

  // Check if a yield row matches a wallet holding
  const isInWallet = useCallback(
    (row: YieldRow): boolean => {
      if (!hasWallet) return false;
      // Primary: match by coingeckoId (reliable)
      if (row.coingeckoId && walletCoingeckoIds.has(row.coingeckoId)) return true;
      // Fallback: match by symbol (for orphan tokens without coingeckoId)
      if (!row.coingeckoId && walletSymbols.has(row.symbol.toLowerCase())) return true;
      return false;
    },
    [hasWallet, walletCoingeckoIds, walletSymbols],
  );

  // Find wallet holding quantity for a given yield row
  const walletQuantity = useCallback(
    (row: YieldRow): number => {
      if (!walletHoldings) return 0;
      // Match by coingeckoId first
      if (row.coingeckoId) {
        const h = walletHoldings.find((h) => h.coingeckoId === row.coingeckoId);
        if (h) return h.quantity;
      }
      // Fallback by symbol
      const h = walletHoldings.find(
        (h) => h.symbol.toLowerCase() === row.symbol.toLowerCase(),
      );
      return h?.quantity ?? 0;
    },
    [walletHoldings],
  );

  // Fetch yields on open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    setLoading(true);
    setError("");
    setRows([]);
    setExpandedKey(null);
    setAmount("");
    setSearchQuery("");
    setProtocolFilter("all");
    setCategoryFilter("all");
    setMyTokensOnly(false);

    fetch("/api/yields")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch yields");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const rows = data.rows ?? [];
        setRows(rows);
        // Show warning if no rows but there were errors (Alchemy/RPC issues)
        if (rows.length === 0 && data.errors?.length > 0) {
          setError(`Yield data temporarily unavailable — ${data.errors.length} network(s) failed to respond. Try again shortly.`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Build a unique key for each row (protocolUrl contains the vault address)
  const rowKey = useCallback(
    (r: YieldRow) =>
      r.protocolUrl ?? `${r.protocol}-${r.networkId}-${r.symbol}`,
    [],
  );

  // Filtered rows
  const filteredRows = useMemo(() => {
    let result = rows;

    if (myTokensOnly) {
      result = result.filter(isInWallet);
    }

    if (protocolFilter !== "all") {
      result = result.filter((r) => r.protocol === protocolFilter);
    }

    if (categoryFilter === "stablecoins") {
      result = result.filter((r) => r.isStablecoin);
    } else if (categoryFilter === "non-stablecoins") {
      result = result.filter((r) => !r.isStablecoin);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.networkName.toLowerCase().includes(q) ||
          r.protocol.toLowerCase().includes(q) ||
          (r.protocolLabel ?? "").toLowerCase().includes(q),
      );
    }

    return result;
  }, [rows, protocolFilter, categoryFilter, searchQuery, myTokensOnly, isInWallet]);

  const handleToggleExpand = (key: string, row: YieldRow) => {
    if (expandedKey === key) {
      setExpandedKey(null);
      setAmount("");
    } else {
      setExpandedKey(key);
      // Pre-fill amount with wallet balance if available
      const qty = walletQuantity(row);
      setAmount(qty > 0 ? String(qty) : "");
    }
  };

  const handleAdd = (row: YieldRow, positionType: "supply" | "borrow") => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    onAddYieldToken(row, positionType, numAmount);
    setExpandedKey(null);
    setAmount("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center">
            Browse Yield Opportunities
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-1.5 bg-[#F5F5FA] rounded-md px-2.5 py-1.5 flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token, network..."
              className="bg-transparent text-xs text-[#303549] focus:outline-none w-full placeholder:text-gray-400"
            />
          </div>

          {/* My tokens filter — only show if wallet was imported */}
          {hasWallet && (
            <button
              type="button"
              onClick={() => setMyTokensOnly((v) => !v)}
              className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                myTokensOnly
                  ? "bg-[#5382E3] text-white"
                  : "bg-[#F5F5FA] text-gray-400 hover:text-gray-600"
              }`}
            >
              <Wallet className="w-3 h-3" />
              My tokens
            </button>
          )}

          {/* Protocol filter */}
          <div className="flex gap-0.5 p-0.5 bg-[#F5F5FA] rounded-md">
            {(["all", "aave", "morpho"] as ProtocolFilter[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProtocolFilter(p)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded transition-colors capitalize ${
                  protocolFilter === p
                    ? "bg-white text-[#303549] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex gap-0.5 p-0.5 bg-[#F5F5FA] rounded-md">
            {(["all", "stablecoins", "non-stablecoins"] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded transition-colors ${
                  categoryFilter === c
                    ? "bg-white text-[#303549] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {c === "all" ? "All" : c === "stablecoins" ? "Stable" : "Non-stable"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-[#5382E3] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">Loading yields...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              </div>
              <p className="text-xs text-gray-500 text-center max-w-xs">{error}</p>
              <button
                onClick={() => {
                  setError("");
                  setLoading(true);
                  fetch("/api/yields")
                    .then((res) => res.ok ? res.json() : Promise.reject(new Error("Failed")))
                    .then((data) => {
                      setRows(data.rows ?? []);
                      if ((data.rows ?? []).length === 0 && data.errors?.length > 0) {
                        setError(`Still unavailable — ${data.errors.length} network(s) failing.`);
                      }
                    })
                    .catch((err) => setError(err instanceof Error ? err.message : "Unknown error"))
                    .finally(() => setLoading(false));
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-[#5382E3] text-white hover:bg-[#4372D3] transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredRows.length === 0 && rows.length > 0 && (
            <div className="flex items-center justify-center py-16">
              <p className="text-xs text-gray-400">No yields match your filters</p>
            </div>
          )}

          {!loading && !error && filteredRows.length > 0 && (
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-[10px] font-medium text-gray-400 text-left py-2 px-2">Token</th>
                  <th className="text-[10px] font-medium text-gray-400 text-left py-2 px-2">Network</th>
                  <th className="text-[10px] font-medium text-gray-400 text-left py-2 px-2">Name</th>
                  <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Supply APY</th>
                  <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Borrow APY</th>
                  <th className="text-[10px] font-medium text-gray-400 text-right py-2 px-2">Liquidity</th>
                  <th className="text-[10px] font-medium text-gray-400 text-center py-2 px-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const key = rowKey(row);
                  const isExpanded = expandedKey === key;
                  const inWallet = isInWallet(row);

                  return (
                    <React.Fragment key={key}>
                      <tr
                        className="border-b border-gray-50 hover:bg-[#F5F5FA]/50 cursor-pointer transition-colors"
                        onClick={() => handleToggleExpand(key, row)}
                      >
                        {/* Token */}
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-[#303549]">
                              {row.symbol}
                            </span>
                            {row.isStablecoin && (
                              <span className="text-[9px] bg-[#5382E3]/10 text-[#5382E3] rounded px-1 py-0.5">
                                stable
                              </span>
                            )}
                            {inWallet && (
                              <Wallet className="w-3 h-3 text-[#5382E3]" />
                            )}
                          </div>
                        </td>

                        {/* Network */}
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            {row.networkLogo && (
                              <Image
                                src={row.networkLogo}
                                alt={row.networkName}
                                width={14}
                                height={14}
                                className="rounded-full"
                              />
                            )}
                            <span className="text-[11px] text-gray-500">
                              {row.networkName}
                            </span>
                          </div>
                        </td>

                        {/* Name + protocol badge */}
                        <td className="py-2 px-2">
                          <span className="text-[11px] text-gray-500">
                            {row.protocolLabel ?? row.protocol.charAt(0).toUpperCase() + row.protocol.slice(1)}
                          </span>
                          <span className={`block mt-0.5 text-[9px] font-medium rounded px-1 py-0.5 w-fit capitalize ${
                            row.protocol === "morpho"
                              ? "bg-[#5382E3]/10 text-[#5382E3]"
                              : "bg-emerald-50 text-emerald-600"
                          }`}>
                            {row.protocol}
                          </span>
                        </td>

                        {/* Supply APY */}
                        <td className="py-2 px-2 text-right">
                          <span className="text-xs font-medium text-[#303549]">
                            {formatAPY(row.totalSupplyAPY)}
                          </span>
                          {row.merklSupplyAPR > 0 && (
                            <span className="text-[9px] text-[#5382E3] ml-1">
                              +{formatAPY(row.merklSupplyAPR)}
                            </span>
                          )}
                        </td>

                        {/* Borrow APY */}
                        <td className="py-2 px-2 text-right">
                          <span className="text-xs text-gray-500">
                            {formatAPY(row.variableBorrowAPY)}
                          </span>
                        </td>

                        {/* Liquidity */}
                        <td className="py-2 px-2 text-right">
                          <span className="text-[11px] text-gray-500">
                            ${formatUSD(row.availableLiquidityUSD)}
                          </span>
                        </td>

                        {/* Expand icon */}
                        <td className="py-2 px-1 text-center">
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-gray-400 inline-block" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 inline-block" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded section */}
                      {isExpanded && (
                        <tr className="bg-[#F5F5FA]/60">
                          <td colSpan={7} className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <label className="text-[10px] text-gray-400 mb-0.5 block">
                                  Amount ({row.symbol})
                                </label>
                                <input
                                  type="number"
                                  value={amount}
                                  onChange={(e) => setAmount(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full h-8 text-xs border border-gray-200 rounded-md px-2.5 bg-white focus:outline-none focus:border-[#5382E3]"
                                  min="0"
                                  step="any"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="flex items-end gap-2 pt-3.5">
                                <Button
                                  size="sm"
                                  className="h-8 px-4 text-[11px] font-medium bg-[#5382E3] hover:bg-[#4572D3] text-white"
                                  disabled={!amount || parseFloat(amount) <= 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdd(row, "supply");
                                  }}
                                >
                                  Supply
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-4 text-[11px] font-medium border-gray-200 text-[#303549] hover:bg-gray-50"
                                  disabled={!amount || parseFloat(amount) <= 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdd(row, "borrow");
                                  }}
                                >
                                  Borrow
                                </Button>
                              </div>
                            </div>
                            {row.merklRewardTokens.length > 0 && (
                              <p className="text-[10px] text-gray-400 mt-1.5">
                                Reward tokens: {row.merklRewardTokens.join(", ")}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">
              {filteredRows.length} of {rows.length} yields
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default YieldBrowserModal;
