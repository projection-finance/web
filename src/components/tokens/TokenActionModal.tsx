"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import {
  TokenAction,
  TokenActionType,
  TokenHolding,
  CoinGeckoSearchResult,
} from "@/src/lib/tokens/types";
import { formatQty, formatUSD } from "@/src/lib/format";
import { Search, X } from "lucide-react";

const ACTION_TYPES: TokenActionType[] = ["receive", "send", "swap", "supply", "claim", "borrow", "repay"];

const ACTION_LABELS: Record<TokenActionType, string> = {
  receive: "Receive",
  send: "Send",
  swap: "Swap",
  supply: "Supply",
  claim: "Claim",
  borrow: "Borrow",
  repay: "Repay",
};

interface AvailableToken {
  symbol: string;
  coingeckoId: string;
  name: string;
  image?: string;
  balance: number;
  priceUSD: number;
}

interface TokenActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (action: Omit<TokenAction, "id" | "orderInDay">) => void;
  holdings: TokenHolding[];
  existingActions: TokenAction[];
  currentDay: number;
}

/**
 * Compute all tokens available at a given day with their projected balances.
 * Includes initial holdings + tokens gained from receives/swaps/bonus rewards.
 */
function getAvailableTokens(
  atDay: number,
  holdings: TokenHolding[],
  actions: TokenAction[]
): AvailableToken[] {
  const balances: Record<string, { balance: number; coingeckoId: string; name: string; image?: string; priceUSD: number }> = {};

  // Seed from initial holdings
  for (const h of holdings) {
    balances[h.symbol] = {
      balance: h.quantity,
      coingeckoId: h.coingeckoId,
      name: h.name,
      image: h.image,
      priceUSD: h.currentPriceUSD,
    };
  }

  // Apply all actions up to atDay
  const sorted = [...actions].sort((a, b) => a.day - b.day || a.orderInDay - b.orderInDay);

  for (const action of sorted) {
    if (action.day > atDay) break;

    switch (action.type) {
      case "receive": {
        if (!balances[action.symbol]) {
          balances[action.symbol] = { balance: 0, coingeckoId: action.symbol, name: action.symbol, priceUSD: 0 };
        }
        balances[action.symbol].balance += action.amount;
        break;
      }
      case "send": {
        if (balances[action.symbol]) {
          balances[action.symbol].balance -= action.amount;
        }
        break;
      }
      case "swap": {
        if (action.fromSymbol && balances[action.fromSymbol]) {
          balances[action.fromSymbol].balance -= action.fromAmount ?? 0;
        }
        // Swap-to token: mark as present with metadata from the action
        if (action.toSymbol && !balances[action.toSymbol]) {
          balances[action.toSymbol] = {
            balance: 0,
            coingeckoId: action.toCoingeckoId ?? action.toSymbol,
            name: action.toName ?? action.toSymbol,
            image: action.toImage,
            priceUSD: action.toCurrentPriceUSD ?? 0,
          };
        }
        break;
      }
      case "supply": {
        if (balances[action.symbol]) {
          balances[action.symbol].balance -= action.amount;
        }
        break;
      }
      case "claim":
        break;
      case "borrow": {
        if (!balances[action.symbol]) {
          balances[action.symbol] = { balance: 0, coingeckoId: action.symbol, name: action.symbol, priceUSD: 0 };
        }
        balances[action.symbol].balance += action.amount;
        break;
      }
      case "repay": {
        if (balances[action.symbol]) {
          balances[action.symbol].balance -= action.amount;
        }
        break;
      }
    }
  }

  return Object.entries(balances)
    .map(([symbol, data]) => ({ symbol, ...data }))
    .filter((t) => t.balance > 0 || holdings.some((h) => h.symbol === t.symbol));
}

const TokenActionModal: React.FC<TokenActionModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  holdings,
  existingActions,
  currentDay,
}) => {
  const [actionType, setActionType] = useState<TokenActionType>("receive");
  const [amount, setAmount] = useState("");

  // Send / Supply / Claim — portfolio tokens only
  const [symbol, setSymbol] = useState("");

  // Receive — any token (search)
  const [receiveToken, setReceiveToken] = useState<{ symbol: string; coingeckoId: string; name: string; image?: string } | null>(null);
  const [receiveSearch, setReceiveSearch] = useState("");
  const [receiveResults, setReceiveResults] = useState<CoinGeckoSearchResult[]>([]);
  const [isSearchingReceive, setIsSearchingReceive] = useState(false);
  const [receiveDropdownOpen, setReceiveDropdownOpen] = useState(false);
  const receiveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const receiveContainerRef = useRef<HTMLDivElement>(null);

  // Swap — From: portfolio, To: any token (search)
  const [swapFromSymbol, setSwapFromSymbol] = useState("");
  const [swapToToken, setSwapToToken] = useState<{ symbol: string; coingeckoId: string; name: string; image?: string } | null>(null);
  const [swapToSearch, setSwapToSearch] = useState("");
  const [swapToResults, setSwapToResults] = useState<CoinGeckoSearchResult[]>([]);
  const [isSearchingSwapTo, setIsSearchingSwapTo] = useState(false);
  const [swapToDropdownOpen, setSwapToDropdownOpen] = useState(false);
  const swapToDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const swapToContainerRef = useRef<HTMLDivElement>(null);

  // Swap slippage & gas
  const [swapFeePercent, setSwapFeePercent] = useState("0.3");
  const [feeTokenSymbol, setFeeTokenSymbol] = useState("");
  const [feeTokenAmount, setFeeTokenAmount] = useState("");

  // Token B price (fetched)
  const [toTokenPrice, setToTokenPrice] = useState<number | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen && holdings.length > 0) {
      setSymbol(holdings[0].symbol);
      setSwapFromSymbol(holdings[0].symbol);
      setSwapToToken(null);
      setReceiveToken(null);
      setAmount("");
      setSwapFeePercent("0.3");
      setFeeTokenSymbol("");
      setFeeTokenAmount("");
      setToTokenPrice(null);
      setBorrowApy("");
      setBorrowIncentives([]);
    }
  }, [isOpen, holdings]);

  // Fetch price when swap To token changes
  useEffect(() => {
    if (!swapToToken?.coingeckoId) { setToTokenPrice(null); return; }
    let cancelled = false;
    setIsFetchingPrice(true);
    fetch(`/api/tokens/price?ids=${encodeURIComponent(swapToToken.coingeckoId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        const price = data?.[swapToToken.coingeckoId]?.usd ?? null;
        setToTokenPrice(price);
      })
      .catch(() => { if (!cancelled) setToTokenPrice(null); })
      .finally(() => { if (!cancelled) setIsFetchingPrice(false); });
    return () => { cancelled = true; };
  }, [swapToToken?.coingeckoId]);

  // Supply config
  const [supplyApy, setSupplyApy] = useState("");
  const [supplyLocked, setSupplyLocked] = useState(false);
  const [supplyLockDays, setSupplyLockDays] = useState("");
  const [supplyClaimFreq, setSupplyClaimFreq] = useState<"continuous" | "end_of_lock" | "monthly" | "yearly">("continuous");

  // Bonus rewards
  const [bonusSymbol, setBonusSymbol] = useState("");
  const [bonusCoingeckoId, setBonusCoingeckoId] = useState("");
  const [bonusApr, setBonusApr] = useState("");
  const [bonusRewards, setBonusRewards] = useState<{ symbol: string; coingeckoId: string; apr: number }[]>([]);

  // Borrow config
  const [borrowApy, setBorrowApy] = useState("");
  const [borrowIncentiveSymbol, setBorrowIncentiveSymbol] = useState("");
  const [borrowIncentiveId, setBorrowIncentiveId] = useState("");
  const [borrowIncentiveApr, setBorrowIncentiveApr] = useState("");
  const [borrowIncentives, setBorrowIncentives] = useState<{ symbol: string; coingeckoId: string; apr: number }[]>([]);

  const numAmount = parseFloat(amount || "0");

  // --- Available tokens at selected day ---
  const availableTokens = useMemo(
    () => getAvailableTokens(currentDay, holdings, existingActions),
    [currentDay, holdings, existingActions]
  );

  // Active symbol for display
  const activeSymbol = actionType === "swap" ? swapFromSymbol : actionType === "receive" ? receiveToken?.symbol : symbol;
  const activeToken = activeSymbol ? availableTokens.find((t) => t.symbol === activeSymbol) : undefined;

  // Max amount
  const maxAmount = useMemo(() => {
    if (actionType === "receive") return undefined;
    if (actionType === "claim") return undefined;
    if (actionType === "borrow") return undefined;
    return activeToken?.balance ?? 0;
  }, [actionType, activeToken]);

  // Swap preview: how much token B the user receives
  const swapPreview = useMemo(() => {
    if (actionType !== "swap" || numAmount <= 0 || !activeToken || !toTokenPrice || toTokenPrice <= 0) return null;
    const fromPrice = activeToken.priceUSD;
    if (fromPrice <= 0) return null;
    const feeMultiplier = 1 - (parseFloat(swapFeePercent) || 0) / 100;
    const toAmount = (numAmount * fromPrice / toTokenPrice) * feeMultiplier;
    return { toAmount, fromPrice, toPrice: toTokenPrice };
  }, [actionType, numAmount, activeToken, toTokenPrice, swapFeePercent]);

  // Gas fee validation
  const feeTokenBalance = useMemo(() => {
    if (!feeTokenSymbol) return undefined;
    const token = availableTokens.find((t) => t.symbol === feeTokenSymbol);
    return token?.balance ?? 0;
  }, [feeTokenSymbol, availableTokens]);

  const feeAmount = parseFloat(feeTokenAmount) || 0;
  const hasInsufficientGas = feeTokenSymbol && feeAmount > 0 && feeTokenBalance !== undefined && feeTokenBalance < feeAmount;

  // Amount exceeds available balance
  const exceedsMax = actionType !== "receive" && actionType !== "borrow" && maxAmount !== undefined && numAmount > maxAmount && maxAmount >= 0;

  // --- Token search (shared by receive & swap-to) ---
  const handleTokenSearch = useCallback((
    query: string,
    setSearch: (v: string) => void,
    setResults: (v: CoinGeckoSearchResult[]) => void,
    setSearching: (v: boolean) => void,
    setDropdown: (v: boolean) => void,
    debounceRef: React.MutableRefObject<NodeJS.Timeout | null>,
  ) => {
    setSearch(query);
    setDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 1) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } catch { /* silent */ } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleReceiveSearch = useCallback((q: string) => {
    handleTokenSearch(q, setReceiveSearch, setReceiveResults, setIsSearchingReceive, setReceiveDropdownOpen, receiveDebounceRef);
  }, [handleTokenSearch]);

  const handleSwapToSearch = useCallback((q: string) => {
    handleTokenSearch(q, setSwapToSearch, setSwapToResults, setIsSearchingSwapTo, setSwapToDropdownOpen, swapToDebounceRef);
  }, [handleTokenSearch]);

  const selectToken = useCallback((token: CoinGeckoSearchResult, setter: (t: { symbol: string; coingeckoId: string; name: string; image?: string } | null) => void, setSearch: (v: string) => void, setResults: (v: CoinGeckoSearchResult[]) => void, setDropdown: (v: boolean) => void) => {
    setter({ symbol: token.symbol, coingeckoId: token.id, name: token.name, image: token.large || token.thumb });
    setSearch(""); setResults([]); setDropdown(false);
  }, []);

  const selectReceiveToken = useCallback((token: CoinGeckoSearchResult) => {
    selectToken(token, setReceiveToken, setReceiveSearch, setReceiveResults, setReceiveDropdownOpen);
  }, [selectToken]);

  const selectSwapToToken = useCallback((token: CoinGeckoSearchResult) => {
    selectToken(token, setSwapToToken, setSwapToSearch, setSwapToResults, setSwapToDropdownOpen);
  }, [selectToken]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (swapToContainerRef.current && !swapToContainerRef.current.contains(e.target as Node)) setSwapToDropdownOpen(false);
      if (receiveContainerRef.current && !receiveContainerRef.current.contains(e.target as Node)) setReceiveDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleMax = () => {
    if (maxAmount !== undefined && maxAmount > 0) setAmount(String(maxAmount));
  };

  const handleExecute = () => {
    if (actionType === "receive") {
      if (!receiveToken || numAmount <= 0) return;
      onExecute({ type: "receive", day: currentDay, symbol: receiveToken.symbol, amount: numAmount });
    } else if (actionType === "swap") {
      if (!swapFromSymbol || !swapToToken || numAmount <= 0) return;
      if (hasInsufficientGas) return;
      const feePercent = parseFloat(swapFeePercent) || 0;
      onExecute({
        type: "swap", day: currentDay, symbol: swapFromSymbol, amount: numAmount,
        fromSymbol: swapFromSymbol, fromAmount: numAmount, toSymbol: swapToToken.symbol,
        toCoingeckoId: swapToToken.coingeckoId,
        toName: swapToToken.name,
        toImage: swapToToken.image,
        toCurrentPriceUSD: toTokenPrice ?? undefined,
        swapConfig: {
          feePercent,
          feeTokenSymbol: feeTokenSymbol || undefined,
          feeTokenAmount: feeAmount > 0 ? feeAmount : undefined,
        },
      });
    } else if (actionType === "supply") {
      const apy = parseFloat(supplyApy);
      if (!symbol || numAmount <= 0 || isNaN(apy)) return;
      onExecute({
        type: "supply", day: currentDay, symbol, amount: numAmount,
        supplyConfig: {
          apy: apy / 100, locked: supplyLocked,
          lockDays: supplyLocked ? parseInt(supplyLockDays) || undefined : undefined,
          claimFrequency: supplyClaimFreq,
          bonusRewards: bonusRewards.length > 0 ? bonusRewards.map((b) => ({ ...b, apr: b.apr / 100 })) : undefined,
        },
      });
    } else if (actionType === "borrow") {
      const apy = parseFloat(borrowApy);
      if (!symbol || numAmount <= 0 || isNaN(apy)) return;
      onExecute({
        type: "borrow", day: currentDay, symbol, amount: numAmount,
        borrowConfig: {
          borrowAPY: apy / 100,
          borrowIncentives: borrowIncentives.length > 0 ? borrowIncentives.map((b) => ({ ...b, apr: b.apr / 100 })) : undefined,
        },
      });
    } else if (actionType === "repay") {
      if (!symbol || numAmount <= 0) return;
      onExecute({ type: "repay", day: currentDay, symbol, amount: numAmount });
    } else {
      if (!symbol || numAmount <= 0) return;
      onExecute({ type: actionType, day: currentDay, symbol, amount: numAmount });
    }

    setAmount("");
    setBonusRewards([]);
    setBorrowApy("");
    setBorrowIncentives([]);
    setSupplyApy("");
    setSupplyLocked(false);
    setSupplyLockDays("");
    onClose();
  };

  const title = (() => {
    switch (actionType) {
      case "receive": return receiveToken ? `Receive ${receiveToken.symbol}` : "Receive Tokens";
      case "send": return `Send ${symbol}`;
      case "swap": return `Swap ${swapFromSymbol}${swapToToken ? ` ${swapToToken.symbol}` : ""}`;
      case "supply": return `Supply ${symbol}`;
      case "claim": return `Claim ${symbol}`;
      case "borrow": return `Borrow ${symbol}`;
      case "repay": return `Repay ${symbol}`;
    }
  })();

  const canExecute = (() => {
    if (numAmount <= 0) return false;
    if (exceedsMax) return false;
    if (actionType === "receive" && !receiveToken) return false;
    if (actionType === "supply" && !supplyApy) return false;
    if (actionType === "borrow" && !borrowApy) return false;
    if (actionType === "swap" && !swapToToken) return false;
    if (actionType === "swap" && hasInsufficientGas) return false;
    return true;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action type selector */}
          <div className="flex gap-1 p-1 bg-[#F0F0F0] rounded-lg">
            {ACTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setActionType(t); setAmount(""); }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                  actionType === t ? "bg-white text-[#303549] shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {ACTION_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Day — read-only, tied to timeline selectedDay */}
          <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
            <p className="text-sm text-[#303549] font-medium">Day</p>
            <p className="text-sm font-semibold text-[#303549]">{currentDay}</p>
          </div>

          {/* Token selector — send/supply/claim: portfolio tokens with balance */}
          {(actionType === "send" || actionType === "supply" || actionType === "claim" || actionType === "borrow" || actionType === "repay") && (
            <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
              <p className="text-sm text-[#303549] font-medium">Token</p>
              <div className="flex items-center gap-2">
                {activeToken && (
                  <span className="text-[10px] text-gray-400">{formatQty(activeToken.balance)} available</span>
                )}
                <select
                  className="text-sm bg-transparent focus:outline-none font-normal text-[#939393] text-right"
                  value={symbol}
                  onChange={(e) => { setSymbol(e.target.value); setAmount(""); }}
                >
                  {availableTokens.map((t) => (
                    <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Token selector — receive: any token via search */}
          {actionType === "receive" && (
            <div ref={receiveContainerRef} className="relative">
              <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
                <p className="text-sm text-[#303549] font-medium">Token</p>
                {receiveToken && !receiveDropdownOpen ? (
                  <button
                    type="button"
                    onClick={() => { setReceiveDropdownOpen(true); setReceiveSearch(""); }}
                    className="flex items-center gap-1.5 text-sm font-normal text-[#939393] hover:text-[#303549] transition-colors"
                  >
                    {receiveToken.image && (
                      <img src={receiveToken.image} alt={receiveToken.symbol} className="w-4 h-4 rounded-full" />
                    )}
                    {receiveToken.symbol}
                    <span className="text-[10px] text-[#4F7FFA] ml-0.5">change</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text" value={receiveSearch}
                      onChange={(e) => handleReceiveSearch(e.target.value)}
                      onFocus={() => setReceiveDropdownOpen(true)}
                      placeholder="Search token..."
                      className="w-32 text-right text-sm bg-transparent focus:outline-none font-normal text-[#939393]"
                      autoFocus={receiveDropdownOpen}
                    />
                  </div>
                )}
              </div>

              {receiveDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                  {receiveSearch.length === 0 && (
                    <>
                      <p className="text-[10px] text-gray-400 px-3 pt-2 pb-1">Your tokens</p>
                      {holdings.map((h) => (
                        <button
                          key={h.coingeckoId} type="button"
                          onClick={() => selectReceiveToken({ id: h.coingeckoId, symbol: h.symbol, name: h.name, thumb: h.image ?? "", large: h.image ?? "", market_cap_rank: null })}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left transition-colors"
                        >
                          {h.image && <img src={h.image} alt={h.symbol} className="w-5 h-5 rounded-full" />}
                          <span className="text-xs font-medium text-[#303549]">{h.symbol}</span>
                          <span className="text-[10px] text-gray-400">{h.name}</span>
                        </button>
                      ))}
                      <div className="border-t border-gray-100 my-1" />
                      <p className="text-[10px] text-gray-400 px-3 py-1">Type to search any token</p>
                    </>
                  )}

                  {isSearchingReceive && (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-3.5 h-3.5 border-2 border-[#4F7FFA] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {!isSearchingReceive && receiveSearch.length > 0 && receiveResults.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No tokens found</p>
                  )}

                  {!isSearchingReceive && receiveResults.map((token) => (
                    <button
                      key={token.id} type="button"
                      onClick={() => selectReceiveToken(token)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left transition-colors"
                    >
                      <img src={token.thumb} alt={token.symbol} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <span className="text-xs font-medium text-[#303549]">{token.symbol}</span>
                      <span className="text-[10px] text-gray-400 truncate">{token.name}</span>
                      {token.market_cap_rank && (
                        <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1 py-0.5 ml-auto">#{token.market_cap_rank}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Swap selectors */}
          {actionType === "swap" && (
            <>
              {/* From — only tokens you own */}
              <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
                <p className="text-sm text-[#303549] font-medium">From</p>
                <div className="flex items-center gap-2">
                  {activeToken && (
                    <span className="text-[10px] text-gray-400">{formatQty(activeToken.balance)} available</span>
                  )}
                  <select
                    className="text-sm bg-transparent focus:outline-none font-normal text-[#939393] text-right"
                    value={swapFromSymbol}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSwapFromSymbol(v);
                      setAmount("");
                      if (swapToToken?.symbol === v) setSwapToToken(null);
                    }}
                  >
                    {availableTokens.filter((t) => t.balance > 0).map((t) => (
                      <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* To — search any token (exclude fromSymbol) */}
              <div ref={swapToContainerRef} className="relative">
                <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
                  <p className="text-sm text-[#303549] font-medium">To</p>
                  {swapToToken && !swapToDropdownOpen ? (
                    <button
                      type="button"
                      onClick={() => { setSwapToDropdownOpen(true); setSwapToSearch(""); }}
                      className="flex items-center gap-1.5 text-sm font-normal text-[#939393] hover:text-[#303549] transition-colors"
                    >
                      {swapToToken.image && (
                        <img src={swapToToken.image} alt={swapToToken.symbol} className="w-4 h-4 rounded-full" />
                      )}
                      {swapToToken.symbol}
                      {toTokenPrice !== null && (
                        <span className="text-[10px] text-gray-400">${formatUSD(toTokenPrice)}</span>
                      )}
                      <span className="text-[10px] text-[#4F7FFA] ml-0.5">change</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text" value={swapToSearch}
                        onChange={(e) => handleSwapToSearch(e.target.value)}
                        onFocus={() => setSwapToDropdownOpen(true)}
                        placeholder="Search token..."
                        className="w-32 text-right text-sm bg-transparent focus:outline-none font-normal text-[#939393]"
                        autoFocus={swapToDropdownOpen}
                      />
                    </div>
                  )}
                </div>

                {swapToDropdownOpen && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {swapToSearch.length === 0 && (
                      <>
                        <p className="text-[10px] text-gray-400 px-3 pt-2 pb-1">Your tokens</p>
                        {availableTokens.filter((t) => t.symbol !== swapFromSymbol).map((t) => (
                          <button
                            key={t.symbol} type="button"
                            onClick={() => selectSwapToToken({ id: t.coingeckoId, symbol: t.symbol, name: t.name, thumb: t.image ?? "", large: t.image ?? "", market_cap_rank: null })}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left transition-colors"
                          >
                            {t.image && <img src={t.image} alt={t.symbol} className="w-5 h-5 rounded-full" />}
                            <span className="text-xs font-medium text-[#303549]">{t.symbol}</span>
                            <span className="text-[10px] text-gray-400">{t.name}</span>
                          </button>
                        ))}
                        <div className="border-t border-gray-100 my-1" />
                        <p className="text-[10px] text-gray-400 px-3 py-1">Type to search any token</p>
                      </>
                    )}

                    {isSearchingSwapTo && (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-3.5 h-3.5 border-2 border-[#4F7FFA] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    {!isSearchingSwapTo && swapToSearch.length > 0 && swapToResults.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No tokens found</p>
                    )}

                    {!isSearchingSwapTo && swapToResults
                      .filter((token) => token.symbol !== swapFromSymbol)
                      .map((token) => (
                      <button
                        key={token.id} type="button"
                        onClick={() => selectSwapToToken(token)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left transition-colors"
                      >
                        <img src={token.thumb} alt={token.symbol} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <span className="text-xs font-medium text-[#303549]">{token.symbol}</span>
                        <span className="text-[10px] text-gray-400 truncate">{token.name}</span>
                        {token.market_cap_rank && (
                          <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1 py-0.5 ml-auto">#{token.market_cap_rank}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap preview */}
              {swapPreview && swapToToken && (
                <div className="p-3 bg-[#4F7FFA]/5 border border-[#4F7FFA]/20 rounded-lg">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">You receive</span>
                    <span className="font-semibold text-[#303549]">
                      {formatQty(swapPreview.toAmount)} {swapToToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-gray-400">Rate</span>
                    <span className="text-gray-500">
                      1 {swapFromSymbol} = {formatQty(swapPreview.fromPrice / swapPreview.toPrice)} {swapToToken.symbol}
                    </span>
                  </div>
                  {parseFloat(swapFeePercent) > 0 && (
                    <div className="flex justify-between text-[10px] mt-0.5">
                      <span className="text-gray-400">Slippage</span>
                      <span className="text-gray-500">-{swapFeePercent}%</span>
                    </div>
                  )}
                </div>
              )}

              {isFetchingPrice && swapToToken && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-3 border-2 border-[#4F7FFA] border-t-transparent rounded-full animate-spin" />
                  Fetching {swapToToken.symbol} price...
                </div>
              )}

              {/* Slippage & gas config */}
              <div className="p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-2">
                <p className="text-xs font-medium text-[#303549]">Fees</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500">Slippage (%)</label>
                    <input
                      type="number" value={swapFeePercent} onChange={(e) => setSwapFeePercent(e.target.value)}
                      placeholder="0.3" className="w-full h-7 text-xs border border-gray-300 rounded px-2 mt-0.5"
                      min="0" max="100" step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Gas token</label>
                    <select
                      className="w-full h-7 text-xs border border-gray-300 rounded px-2 mt-0.5"
                      value={feeTokenSymbol}
                      onChange={(e) => setFeeTokenSymbol(e.target.value)}
                    >
                      <option value="">None</option>
                      {availableTokens.map((t) => (
                        <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {feeTokenSymbol && (
                  <div>
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-gray-500">Gas amount ({feeTokenSymbol})</label>
                      {feeTokenBalance !== undefined && (
                        <span className="text-[10px] text-gray-400">{formatQty(feeTokenBalance)} available</span>
                      )}
                    </div>
                    <input
                      type="number" value={feeTokenAmount} onChange={(e) => setFeeTokenAmount(e.target.value)}
                      placeholder="0.005" className="w-full h-7 text-xs border border-gray-300 rounded px-2 mt-0.5"
                      min="0" step="any"
                    />
                  </div>
                )}

                {/* Insufficient gas warning */}
                {hasInsufficientGas && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    <p className="font-medium">Insufficient {feeTokenSymbol} for gas fees</p>
                    <p className="text-[10px] mt-0.5">
                      You have {formatQty(feeTokenBalance!)} {feeTokenSymbol} but need {feeTokenAmount}.
                      Add a <strong>Receive {feeTokenSymbol}</strong> action before this swap, or reduce the gas amount.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Amount input */}
          <div className="p-4 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm text-[#303549] font-medium">
                Amount{activeSymbol ? ` (${activeSymbol})` : ""}
              </label>
              {maxAmount !== undefined && maxAmount > 0 && (
                <button type="button" onClick={handleMax} className="text-xs text-[#4F7FFA] font-medium hover:underline">
                  MAX
                </button>
              )}
            </div>
            <input
              type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 rounded-lg text-sm p-3 border border-gray-300 focus:outline-sky-400"
              min="0" step="any"
            />
            <div className="flex justify-between">
              {numAmount > 0 && activeToken && activeToken.priceUSD > 0 && (
                <p className="text-xs text-gray-500">
                  ≈ ${formatUSD(numAmount * activeToken.priceUSD)}
                </p>
              )}
              {maxAmount !== undefined && maxAmount > 0 && (
                <p className="text-xs text-gray-400 ml-auto">
                  Max: {formatQty(maxAmount)} {activeSymbol}
                </p>
              )}
              {actionType === "receive" && (
                <p className="text-xs text-gray-400 ml-auto">No limit (external receive)</p>
              )}
            </div>
            {exceedsMax && (
              <p className="text-xs text-red-600 font-medium">
                Insufficient {activeSymbol} balance — you only have {formatQty(maxAmount!)} available at Day {currentDay}
              </p>
            )}
          </div>

          {/* Supply config */}
          {actionType === "supply" && (
            <div className="p-4 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-3">
              <p className="text-xs font-medium text-[#303549]">Supply Configuration</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">APY (%)</label>
                  <input type="number" value={supplyApy} onChange={(e) => setSupplyApy(e.target.value)}
                    placeholder="5.0" className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5" min="0" step="0.01" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Claim Frequency</label>
                  <select className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5"
                    value={supplyClaimFreq} onChange={(e) => setSupplyClaimFreq(e.target.value as typeof supplyClaimFreq)}>
                    <option value="continuous">Continuous</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="end_of_lock">End of Lock</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={supplyLocked} onChange={(e) => setSupplyLocked(e.target.checked)}
                    className="rounded border-gray-300" id="supply-locked-modal" />
                  <label htmlFor="supply-locked-modal" className="text-xs text-gray-600">Locked</label>
                </div>
                {supplyLocked && (
                  <div className="flex-1">
                    <input type="number" value={supplyLockDays} onChange={(e) => setSupplyLockDays(e.target.value)}
                      placeholder="Lock duration (days)" className="w-full h-8 text-xs border border-gray-300 rounded px-2" min="1" step="1" />
                  </div>
                )}
              </div>

              {/* Bonus rewards */}
              <div className="border-t border-gray-200 pt-2">
                <p className="text-[10px] text-gray-500 mb-1.5">Bonus Rewards (optional)</p>
                {bonusRewards.map((b, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#4F7FFA]/5 rounded px-2 py-1 mb-1">
                    <span className="text-[11px] text-[#4F7FFA]">{b.symbol} — {b.apr}% APR</span>
                    <button onClick={() => setBonusRewards((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-4 gap-1">
                  <input type="text" value={bonusSymbol} onChange={(e) => setBonusSymbol(e.target.value)}
                    placeholder="Symbol" className="h-7 text-[10px] border border-gray-300 rounded px-1.5" />
                  <input type="text" value={bonusCoingeckoId} onChange={(e) => setBonusCoingeckoId(e.target.value)}
                    placeholder="CoinGecko ID" className="h-7 text-[10px] border border-gray-300 rounded px-1.5" />
                  <input type="number" value={bonusApr} onChange={(e) => setBonusApr(e.target.value)}
                    placeholder="APR %" className="h-7 text-[10px] border border-gray-300 rounded px-1.5" min="0" step="0.01" />
                  <Button size="sm" variant="outline" className="h-7 text-[10px]"
                    onClick={() => {
                      if (bonusSymbol && bonusCoingeckoId && parseFloat(bonusApr) > 0) {
                        setBonusRewards((prev) => [...prev, { symbol: bonusSymbol, coingeckoId: bonusCoingeckoId, apr: parseFloat(bonusApr) }]);
                        setBonusSymbol(""); setBonusCoingeckoId(""); setBonusApr("");
                      }
                    }}>+</Button>
                </div>
              </div>
            </div>
          )}

          {/* Borrow config */}
          {actionType === "borrow" && (
            <div className="p-4 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-3">
              <p className="text-xs font-medium text-[#303549]">Borrow Configuration</p>
              <div>
                <label className="text-xs text-gray-500">Borrow APY (%)</label>
                <input type="number" value={borrowApy} onChange={(e) => setBorrowApy(e.target.value)}
                  placeholder="3.5" className="w-full h-8 text-xs border border-gray-300 rounded px-2 mt-0.5" min="0" step="0.01" />
              </div>
              {/* Borrow incentives section */}
              <div className="border-t border-gray-200 pt-2">
                <p className="text-[10px] text-gray-500 mb-1.5">Borrow Incentives (optional)</p>
                {borrowIncentives.map((b, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#5382E3]/5 rounded px-2 py-1 mb-1">
                    <span className="text-[11px] text-[#5382E3]">{b.symbol} — {b.apr}% APR</span>
                    <button onClick={() => setBorrowIncentives((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-4 gap-1">
                  <input type="text" value={borrowIncentiveSymbol} onChange={(e) => setBorrowIncentiveSymbol(e.target.value)}
                    placeholder="Symbol" className="h-7 text-[10px] border border-gray-300 rounded px-1.5" />
                  <input type="text" value={borrowIncentiveId} onChange={(e) => setBorrowIncentiveId(e.target.value)}
                    placeholder="CoinGecko ID" className="h-7 text-[10px] border border-gray-300 rounded px-1.5" />
                  <input type="number" value={borrowIncentiveApr} onChange={(e) => setBorrowIncentiveApr(e.target.value)}
                    placeholder="APR %" className="h-7 text-[10px] border border-gray-300 rounded px-1.5" min="0" step="0.01" />
                  <Button size="sm" variant="outline" className="h-7 text-[10px]"
                    onClick={() => {
                      if (borrowIncentiveSymbol && borrowIncentiveId && parseFloat(borrowIncentiveApr) > 0) {
                        setBorrowIncentives((prev) => [...prev, { symbol: borrowIncentiveSymbol, coingeckoId: borrowIncentiveId, apr: parseFloat(borrowIncentiveApr) }]);
                        setBorrowIncentiveSymbol(""); setBorrowIncentiveId(""); setBorrowIncentiveApr("");
                      }
                    }}>+</Button>
                </div>
              </div>
            </div>
          )}

          {/* Execute / Cancel */}
          <div className="flex justify-between gap-4">
            <Button onClick={handleExecute} disabled={!canExecute}
              className="bg-[#4F7FFA] text-sm font-medium hover:bg-blue-600 w-1/2">
              Schedule
            </Button>
            <Button variant="outline" className="text-sm font-medium w-1/2" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TokenActionModal;
