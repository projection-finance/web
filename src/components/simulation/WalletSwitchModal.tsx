"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { useSession } from "next-auth/react";
import { usePlan } from "@/src/hooks/usePlan";
import { Dice5, LogOut, Search } from "lucide-react";
import { AiOutlineLoading } from "react-icons/ai";
import NetworkSelector from "@/src/components/NetworkSelector";
import NetworkBadge from "@/src/components/NetworkBadge";
import { NetworkId, DEFAULT_NETWORK, getNetworkById } from "@/src/lib/aave/networks";

// Real Aave CDP addresses for random selection (shared with TrackWallet)
const RANDOM_AAVE_ADDRESSES = [
  "0x50fc9731dace42caa45d166bff404bbb7464bf21",
  "0x7cd0b7ed790f626ef1bd42db63b5ebeb5970c912",
  "0xfa5484533acf47bc9f5d9dc931fcdbbdcefb4011",
  "0x5be9a4959308a0d0c7bc0870e319314d8d957dbb",
  "0xabbd5b2b0b034781e58434736728b9d0673de7f1",
  "0xe40d278afd00e6187db21ff8c96d572359ef03bf",
  "0x0591926d5d3b9cc48ae6efb8db68025ddc3adfa5",
  "0xefad748654ec2c072b8735c010ae2fdea04aaf7d",
  "0xb3abe0777aa9685941e54744e704378b4b33eeaa",
  "0x7c697d6cff279f3f9c2401d0ea2ac7e7ede0e2c3",
  "0x99926ab8e1b589500ae87977632f13cf7f70f242",
  "0x64471d103a7f77262529383d53bdd28b260b1ae8",
  "0x989b96317735d70a7762bf96c034b203713aae18",
  "0xce344e5ad5bab578601cbf8ad103506588d38455",
  "0x96f49d0e9724dfd8780fa667ac37a993f005cb94",
];

function getRandomAddress(): string {
  return RANDOM_AAVE_ADDRESSES[Math.floor(Math.random() * RANDOM_AAVE_ADDRESSES.length)];
}

interface FavoriteWallet {
  id: string;
  address: string;
  label: string;
}

interface WalletSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: (address: string, network: NetworkId) => void;
  onClear: () => void;
  currentAddress: string;
  currentEns?: string;
  currentNetwork?: NetworkId;
}

const WalletSwitchModal: React.FC<WalletSwitchModalProps> = ({
  isOpen,
  onClose,
  onSwitch,
  onClear,
  currentAddress,
  currentEns,
  currentNetwork = DEFAULT_NETWORK,
}) => {
  const { data: session } = useSession();
  const { features } = usePlan();
  const [address, setAddress] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>(currentNetwork);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [favorites, setFavorites] = useState<FavoriteWallet[]>([]);

  const networkMeta = getNetworkById(selectedNetwork);
  const ensSupported = networkMeta?.supportsENS ?? false;

  // Reset network when modal opens
  useEffect(() => {
    if (isOpen) setSelectedNetwork(currentNetwork);
  }, [isOpen, currentNetwork]);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorite-wallets");
      if (res.ok) setFavorites(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (isOpen && session?.user && features.canSaveFavoriteWallets) {
      fetchFavorites();
    }
  }, [isOpen, session?.user, features.canSaveFavoriteWallets, fetchFavorites]);

  const isENS = (input: string) => /^[a-zA-Z0-9-]+\.[a-z]{2,}$/.test(input);

  const handleSwitch = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    if (isENS(trimmed)) {
      if (!ensSupported) {
        setResolveError("ENS names are only supported on Ethereum. Please enter a 0x address.");
        return;
      }
      setResolving(true);
      setResolveError("");
      try {
        const res = await fetch(`/api/resolve-ens?name=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          setResolveError("Could not resolve ENS name");
          return;
        }
        const data = await res.json();
        onSwitch(data.address, selectedNetwork);
      } catch {
        setResolveError("Failed to resolve ENS name");
        return;
      } finally {
        setResolving(false);
      }
    } else {
      onSwitch(trimmed, selectedNetwork);
    }
    setAddress("");
    onClose();
  };

  // Switch network only (keep same address)
  const handleNetworkSwitch = () => {
    if (selectedNetwork !== currentNetwork) {
      onSwitch(currentAddress, selectedNetwork);
      onClose();
    }
  };

  const handleFavoriteClick = (addr: string) => {
    onSwitch(addr, selectedNetwork);
    setAddress("");
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  const networkChanged = selectedNetwork !== currentNetwork;
  const canSwitchNetworkOnly = networkChanged && !address.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center">
            Switch wallet
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Current */}
          <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
            <p className="text-sm text-[#303549] font-medium">Current</p>
            <div className="flex items-center gap-1.5">
              <NetworkBadge networkId={currentNetwork} size="sm" />
              {currentEns && (
                <p className="text-xs font-medium text-[#303549]">{currentEns}</p>
              )}
              <p className="text-xs font-mono text-[#939393]">
                {currentAddress.slice(0, 6)}...{currentAddress.slice(-4)}
              </p>
            </div>
          </div>

          {/* Network selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#303549]">
              Network
            </label>
            <NetworkSelector selected={selectedNetwork} onChange={setSelectedNetwork} />
          </div>

          {/* Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#303549]">
              New address {!ensSupported && <span className="text-gray-400 font-normal">(ENS not available on this network)</span>}
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSwitch()}
                placeholder={ensSupported ? "0x... or ENS name" : "0x..."}
                className="w-full h-9 text-sm pl-8 pr-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4F7FFA] font-mono"
              />
            </div>
            {resolveError && (
              <p className="text-xs text-red-500 mt-1">{resolveError}</p>
            )}
          </div>

          {/* Random wallet */}
          <button
            type="button"
            onClick={() => {
              const addr = getRandomAddress();
              onSwitch(addr, selectedNetwork);
              setAddress("");
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-gray-500 hover:border-[#4F7FFA] hover:text-[#4F7FFA] transition-colors"
          >
            <Dice5 className="w-3.5 h-3.5" />
            Try a random wallet
          </button>

          {/* Favorites */}
          {session?.user && features.canSaveFavoriteWallets && favorites.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#303549]">Favorites</p>
              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                {favorites.map((w) => {
                  const isCurrent = w.address.toLowerCase() === currentAddress.toLowerCase() && !networkChanged;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => handleFavoriteClick(w.address)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                        isCurrent
                          ? "border-[#4F7FFA] bg-blue-50/50 opacity-60 cursor-default"
                          : "border-slate-200 hover:border-slate-300 cursor-pointer"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#303549] truncate">
                          {w.label}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {w.address.slice(0, 6)}...{w.address.slice(-4)}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="text-[9px] text-[#4F7FFA] font-medium shrink-0">
                          Current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3">
            {canSwitchNetworkOnly ? (
              <Button
                onClick={handleNetworkSwitch}
                className="bg-[#4F7FFA] text-sm font-medium hover:bg-blue-600 flex-1"
              >
                Switch to {networkMeta?.name}
              </Button>
            ) : (
              <Button
                onClick={handleSwitch}
                disabled={!address.trim() || resolving}
                className="bg-[#4F7FFA] text-sm font-medium hover:bg-blue-600 flex-1"
              >
                {resolving ? <AiOutlineLoading className="animate-spin" /> : "Switch"}
              </Button>
            )}
            <Button
              variant="outline"
              className="text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
              onClick={handleClear}
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Exit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletSwitchModal;
