"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { AiOutlineLoading } from "react-icons/ai";
import NetworkSelector from "./NetworkSelector";
import { NetworkId, DEFAULT_NETWORK, getNetworkById } from "@/src/lib/aave/networks";

// ── Protocol definitions (polymorphic) ──

export interface ProtocolConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string; // tailwind gradient or bg class
  accentColor: string; // hex for accents
  placeholder: string;
  navigateTo: (address: string, ensName?: string, network?: NetworkId) => string; // builds the target URL
  supportsNetwork?: boolean; // show network selector
  sandboxUrl?: string; // direct link to start without wallet
  sandboxLabel?: string; // label for the sandbox button
}

interface ProtocolModalProps {
  protocol: ProtocolConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAddress?: string;
  defaultEns?: string;
  defaultNetwork?: NetworkId;
}

function isENS(input: string): boolean {
  return /^[a-zA-Z0-9-]+\.[a-z]{2,}$/.test(input.trim());
}

function isAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input.trim());
}

const comingSoonProtocols = [
  { label: "Fluid", color: "#5B5FEF", letter: "F" },
  { label: "Venus", color: "#F2C94C", letter: "V" },
  { label: "f(x) Protocol", color: "#E14B4B", letter: "f" },
];

export default function ProtocolModal({ protocol, open, onOpenChange, defaultAddress, defaultEns, defaultNetwork }: ProtocolModalProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [ensName, setEnsName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>(defaultNetwork ?? DEFAULT_NETWORK);

  const networkMeta = getNetworkById(selectedNetwork);
  const ensSupported = networkMeta?.supportsENS ?? false;

  // Reset state when modal opens/closes, pre-fill if defaults provided
  useEffect(() => {
    if (open) {
      if (defaultAddress) {
        setInput(defaultEns || defaultAddress);
        setResolvedAddress(defaultAddress);
        setEnsName(defaultEns || null);
      }
      setSelectedNetwork(defaultNetwork ?? DEFAULT_NETWORK);
    } else {
      setInput("");
      setResolvedAddress(null);
      setEnsName(null);
      setError("");
      setResolving(false);
    }
  }, [open, defaultAddress, defaultEns, defaultNetwork]);

  // Auto-resolve ENS as user types (debounced)
  useEffect(() => {
    const trimmed = input.trim();
    setError("");

    if (isAddress(trimmed)) {
      setResolvedAddress(trimmed);
      setEnsName(null);
      return;
    }

    if (!isENS(trimmed)) {
      setResolvedAddress(null);
      setEnsName(null);
      return;
    }

    // ENS only works on Ethereum
    if (!ensSupported) {
      setError("ENS names are only supported on Ethereum. Please enter a 0x address.");
      setResolvedAddress(null);
      setEnsName(null);
      return;
    }

    // Debounce ENS resolution
    setResolving(true);
    setResolvedAddress(null);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/resolve-ens?name=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Could not resolve ENS name");
          setResolvedAddress(null);
          setEnsName(null);
        } else {
          const data = await res.json();
          setResolvedAddress(data.address);
          setEnsName(trimmed);
        }
      } catch {
        setError("Failed to resolve ENS name");
        setResolvedAddress(null);
      } finally {
        setResolving(false);
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      setResolving(false);
    };
  }, [input, ensSupported]);

  const handleSubmit = useCallback(() => {
    if (!resolvedAddress) return;
    onOpenChange(false);
    router.push(protocol.navigateTo(resolvedAddress, ensName ?? undefined, selectedNetwork));
  }, [resolvedAddress, ensName, selectedNetwork, onOpenChange, router, protocol]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && resolvedAddress && !resolving) {
      handleSubmit();
    }
  };

  const canSubmit = !!resolvedAddress && !resolving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        {/* Header with protocol branding */}
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background: `linear-gradient(135deg, ${protocol.accentColor}08 0%, ${protocol.accentColor}15 100%)`,
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${protocol.accentColor}15` }}
              >
                {protocol.icon}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#303549]">
                  {protocol.name}
                </DialogTitle>
                <p className="text-xs text-gray-500 mt-0.5">{protocol.description}</p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Network selector */}
          {protocol.supportsNetwork && (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                Network
              </label>
              <NetworkSelector selected={selectedNetwork} onChange={setSelectedNetwork} />
            </div>
          )}

          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {ensSupported ? "Wallet address or ENS name" : "Wallet address"}
          </label>
          <div className="relative mt-1.5">
            <input
              type="text"
              className="w-full h-11 rounded-lg text-sm px-4 pr-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5382E3]/40 focus:border-[#5382E3] transition-colors"
              placeholder={ensSupported ? protocol.placeholder : "0x..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {resolving && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <AiOutlineLoading className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
            {!resolving && resolvedAddress && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>

          {/* ENS resolved feedback — only show the address, ENS is already in the input */}
          {ensName && resolvedAddress && (
            <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              <span className="text-[11px] text-gray-500 font-mono">
                {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
              </span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-11 rounded-xl text-sm font-medium transition-colors mt-4 cursor-pointer disabled:cursor-not-allowed"
            style={{
              backgroundColor: canSubmit ? protocol.accentColor : `${protocol.accentColor}40`,
              color: "white",
            }}
          >
            {resolving ? (
              <AiOutlineLoading className="animate-spin mx-auto" />
            ) : (
              `Open in ${protocol.name}`
            )}
          </button>

          <p className="text-[10px] text-gray-400 text-center mt-3">
            Read-only. We never ask for private keys or signatures.
          </p>

          {/* Start without wallet */}
          {protocol.sandboxUrl && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  onOpenChange(false);
                  router.push(protocol.sandboxUrl!);
                }}
                className="w-full h-10 rounded-xl text-sm font-medium bg-white border-2 border-dashed border-gray-200 text-gray-500 hover:border-gray-300 hover:text-[#303549] transition-colors cursor-pointer"
              >
                {protocol.sandboxLabel || "Start without wallet"}
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                Build a custom portfolio from scratch — no wallet needed.
              </p>
            </div>
          )}

          {/* Coming soon protocols */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
              More protocols coming soon
            </p>
            <div className="flex flex-wrap gap-1.5">
              {comingSoonProtocols.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gray-50 border border-gray-100"
                >
                  <svg width={12} height={12} viewBox="0 0 20 20" fill="none" className="shrink-0">
                    <circle cx="10" cy="10" r="10" fill={p.color} />
                    <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">{p.letter}</text>
                  </svg>
                  <span className="text-[10px] text-gray-400 font-medium">{p.label}</span>
                </div>
              ))}
              <div className="flex items-center rounded-full px-2.5 py-1 bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-300 font-bold tracking-wider">...</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
