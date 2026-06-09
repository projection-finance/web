"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { NetworkId, DEFAULT_NETWORK } from "@/src/lib/aave/networks";
import { TokenHolding, ImportSource } from "@/src/lib/tokens/types";
import { type RecentWallet } from "@/src/hooks/useRecentWallets";
import NetworkSelector from "@/src/components/NetworkSelector";
import { formatUSD, formatQty } from "@/src/lib/format";
import { Search, Wallet, RotateCw, X, Check, AlertCircle } from "lucide-react";
import Image from "next/image";
import { getNetworkById } from "@/src/lib/aave/networks";

interface ScanResult {
  holdings: TokenHolding[];
  address: string;
  network: NetworkId;
  totalValueUSD: number;
}

interface WalletImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (holdings: TokenHolding[], source: ImportSource) => void;
  onStartFromScratch: () => void;
  recentWallets: RecentWallet[];
  onAddRecentWallet: (address: string, ensName?: string) => void;
}

const WalletImportModal: React.FC<WalletImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onStartFromScratch,
  recentWallets,
  onAddRecentWallet,
}) => {
  const [mode, setMode] = useState<"choose" | "scan" | "results">("choose");
  const [addressInput, setAddressInput] = useState("");
  const [network, setNetwork] = useState<NetworkId>(DEFAULT_NETWORK);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering scan mode
  useEffect(() => {
    if (mode === "scan" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  const isValidInput = useCallback((input: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(input) || input.endsWith(".eth") || input.includes(".");
  }, []);

  const handleScan = useCallback(async () => {
    if (!addressInput.trim()) return;
    setIsScanning(true);
    setError("");

    try {
      const res = await fetch(
        `/api/tokens/scan?address=${encodeURIComponent(addressInput.trim())}&network=${network}`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to scan wallet");
      }

      const data: ScanResult = await res.json();
      setScanResult(data);
      setSelected(new Set(data.holdings.map((h) => h.coingeckoId)));
      setMode("results");

      // Save to recent wallets
      const ensName = addressInput.endsWith(".eth") ? addressInput : undefined;
      onAddRecentWallet(data.address, ensName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  }, [addressInput, network]);

  const handleRescan = useCallback(() => {
    setMode("scan");
    setScanResult(null);
    setError("");
  }, []);

  const handleImport = useCallback(() => {
    if (!scanResult) return;

    const selectedHoldings = scanResult.holdings.filter((h) =>
      selected.has(h.coingeckoId)
    );

    const source: ImportSource = {
      address: scanResult.address,
      ensName: addressInput.endsWith(".eth") ? addressInput : undefined,
      network: scanResult.network,
      importedAt: new Date().toISOString(),
    };

    onImport(selectedHoldings, source);
    onClose();
  }, [scanResult, selected, addressInput, onImport, onClose]);

  const handleStartFromScratch = useCallback(() => {
    onStartFromScratch();
    onClose();
  }, [onStartFromScratch, onClose]);

  const toggleToken = useCallback((coingeckoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(coingeckoId)) {
        next.delete(coingeckoId);
      } else {
        next.add(coingeckoId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!scanResult) return;
    if (selected.size === scanResult.holdings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(scanResult.holdings.map((h) => h.coingeckoId)));
    }
  }, [scanResult, selected]);

  const handleRecentWallet = useCallback((address: string, ensName?: string) => {
    setAddressInput(ensName || address);
    setMode("scan");
  }, []);

  if (!isOpen) return null;

  const networkMeta = getNetworkById(network);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-[#303549]">
              {mode === "results" ? "Scan Results" : "Start your portfolio"}
            </h2>
            {mode === "results" && scanResult && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {scanResult.holdings.length} tokens found on {networkMeta?.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Choose mode */}
        {mode === "choose" && (
          <div className="p-5 space-y-4">
            <button
              onClick={handleStartFromScratch}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-[#5382E3] hover:bg-[#5382E3]/5 transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#5382E3]/10 flex items-center justify-center">
                <Search className="w-4 h-4 text-gray-500 group-hover:text-[#5382E3]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#303549]">Start from scratch</p>
                <p className="text-[11px] text-gray-400">
                  Manually search and add tokens to build your portfolio
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode("scan")}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-[#5382E3] hover:bg-[#5382E3]/5 transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#5382E3]/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-gray-500 group-hover:text-[#5382E3]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#303549]">Import from wallet</p>
                <p className="text-[11px] text-gray-400">
                  Scan a wallet address or ENS name to import token holdings
                </p>
              </div>
            </button>

            {/* Recent wallets */}
            {recentWallets.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Recent wallets
                </p>
                <div className="space-y-1">
                  {recentWallets.slice(0, 5).map((w) => (
                    <button
                      key={w.address}
                      onClick={() => handleRecentWallet(w.address, w.ensName)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <Wallet className="w-3 h-3 text-gray-300" />
                      <span className="text-xs text-[#303549] font-mono">
                        {w.ensName || `${w.address.slice(0, 6)}...${w.address.slice(-4)}`}
                      </span>
                      <span className="text-[10px] text-gray-300 ml-auto">
                        {new Date(w.lastUsed).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scan mode */}
        {mode === "scan" && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">
                Wallet Address or ENS
              </label>
              <input
                ref={inputRef}
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isValidInput(addressInput)) handleScan();
                }}
                placeholder="0x... or vitalik.eth"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#5382E3] font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">
                Network
              </label>
              <NetworkSelector selected={network} onChange={setNetwork} />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-xs text-red-600">{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("choose")}
                className="h-9 text-xs"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleScan}
                disabled={!isValidInput(addressInput) || isScanning}
                className="flex-1 h-9 text-xs bg-[#303549] hover:bg-[#1e2333]"
              >
                {isScanning ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                    Scanning {networkMeta?.name}...
                  </>
                ) : (
                  <>
                    <Search className="w-3 h-3 mr-1.5" />
                    Scan Wallet
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Results mode */}
        {mode === "results" && scanResult && (
          <div className="flex flex-col">
            {/* Wallet info bar */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {networkMeta && (
                  <Image
                    src={networkMeta.logo}
                    alt={networkMeta.name}
                    width={16}
                    height={16}
                  />
                )}
                <span className="text-xs font-mono text-gray-500">
                  {addressInput.endsWith(".eth")
                    ? addressInput
                    : `${scanResult.address.slice(0, 6)}...${scanResult.address.slice(-4)}`}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#303549]">
                ${formatUSD(scanResult.totalValueUSD)}
              </span>
            </div>

            {/* Token list */}
            <div className="max-h-[350px] overflow-y-auto">
              {scanResult.holdings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No tokens found above $1</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Try a different network or wallet address
                  </p>
                </div>
              ) : (
                <>
                  {/* Select all header */}
                  <button
                    onClick={toggleAll}
                    className="w-full flex items-center gap-2 px-5 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selected.size === scanResult.holdings.length
                          ? "bg-[#5382E3] border-[#5382E3]"
                          : "border-gray-300"
                      }`}
                    >
                      {selected.size === scanResult.holdings.length && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500">
                      {selected.size === scanResult.holdings.length
                        ? `All ${scanResult.holdings.length} selected`
                        : `${selected.size} of ${scanResult.holdings.length} selected`}
                    </span>
                  </button>

                  {scanResult.holdings.map((h) => {
                    const isSelected = selected.has(h.coingeckoId);
                    const valueUSD = h.quantity * h.currentPriceUSD;
                    return (
                      <button
                        key={h.coingeckoId}
                        onClick={() => toggleToken(h.coingeckoId)}
                        className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-[#5382E3] border-[#5382E3]"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {h.image ? (
                          <img
                            src={h.image}
                            alt={h.symbol}
                            className="w-6 h-6 rounded-full shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold shrink-0">
                            {h.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-xs font-medium text-[#303549]">
                            {h.symbol}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-1.5 truncate">
                            {h.name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium text-[#303549]">
                            ${formatUSD(valueUSD)}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {formatQty(h.quantity)} @ ${formatUSD(h.currentPriceUSD)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRescan}
                className="h-8 text-xs gap-1"
              >
                <RotateCw className="w-3 h-3" />
                Rescan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartFromScratch}
                className="h-8 text-xs"
              >
                Start from scratch
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={selected.size === 0}
                className="flex-1 h-8 text-xs bg-[#303549] hover:bg-[#1e2333]"
              >
                Import ({selected.size})
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletImportModal;
