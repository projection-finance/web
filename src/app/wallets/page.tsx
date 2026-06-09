"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import {
  Wallet,
  Copy,
  Check,
  Clock,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRecentWallets } from "@/src/hooks/useRecentWallets";
import AaveIcon from "@/src/components/icons/AaveIcon";
import ProtocolModal, { type ProtocolConfig } from "@/src/components/ProtocolModal";

// ── Protocol configs ──

const aaveProtocol: ProtocolConfig = {
  id: "aave",
  name: "Aave V3",
  description: "Simulate your Aave V3 position on any supported network",
  icon: <AaveIcon size={22} />,
  gradient: "from-[#B6509E] to-[#2EBAC6]",
  accentColor: "#B6509E",
  placeholder: "0x... or vitalik.eth",
  supportsNetwork: true,
  navigateTo: (address, ens, network) => {
    const params = new URLSearchParams({ wallet: address });
    if (ens) params.set("ens", ens);
    if (network && network !== "ETHEREUM_V3") params.set("network", network);
    return `/?${params.toString()}`;
  },
};

// ── Types ──

interface FavoriteWallet {
  id: string;
  address: string;
  label: string;
}

// ── Helpers ──

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ── Max recent displayed ──
const MAX_RECENTS = 5;

export default function WalletsPage() {
  const { data: session, status } = useSession();
  const [wallets, setWallets] = useState<FavoriteWallet[]>([]);
  const { wallets: recents } = useRecentWallets();
  const [isLoading, setIsLoading] = useState(true);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  // Protocol modal (opened when clicking a wallet)
  const [protocolModal, setProtocolModal] = useState<ProtocolConfig | null>(null);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [pendingEns, setPendingEns] = useState<string | undefined>(undefined);

  // Save flow
  const [savingAddress, setSavingAddress] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  // Delete flow
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch("/api/favorite-wallets");
      if (res.ok) setWallets(await res.json());
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (session?.user) fetchWallets();
    else setIsLoading(false);
  }, [session?.user, fetchWallets]);

  const handleCopy = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddr(address);
    setTimeout(() => setCopiedAddr(null), 1500);
  };

  // Click a wallet → open protocol chooser modal
  const handleWalletClick = (address: string, ensName?: string) => {
    setPendingAddress(address);
    setPendingEns(ensName);
    // For now only Aave V3 — open directly
    // Later: show a chooser if multiple protocols
    setProtocolModal({
      ...aaveProtocol,
      // Pre-fill the address in the navigateTo
      navigateTo: (addr, ens) => {
        const params = new URLSearchParams({ wallet: addr });
        if (ens) params.set("ens", ens);
        return `/?${params.toString()}`;
      },
    });
  };

  // Save a recent as favorite
  const handleSaveRecent = async (address: string) => {
    if (!saveLabel.trim()) return;
    setSaveBusy(true);
    try {
      const res = await fetch("/api/favorite-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, label: saveLabel.trim() }),
      });
      if (res.ok) {
        await fetchWallets();
        setSavingAddress(null);
        setSaveLabel("");
      }
    } catch { /* silent */ }
    finally { setSaveBusy(false); }
  };

  // Delete a favorite
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/favorite-wallets/${id}`, { method: "DELETE" });
      setWallets((prev) => prev.filter((w) => w.id !== id));
    } catch { /* silent */ }
    finally { setDeletingId(null); }
  };

  // ENS lookup from recents
  const ensFor = (address: string) =>
    recents.find((r) => r.address.toLowerCase() === address.toLowerCase())?.ensName;

  // Recents not in favorites, max 5
  const savedAddresses = new Set(wallets.map((w) => w.address.toLowerCase()));
  const unsavedRecents = recents
    .filter((r) => !savedAddresses.has(r.address.toLowerCase()))
    .slice(0, MAX_RECENTS);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Wallet className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 text-sm">Sign in to view your wallets.</p>
        <Link href="/sign-in">
          <Button className="bg-[#5382E3]">Sign In</Button>
        </Link>
      </div>
    );
  }

  const hasAnything = wallets.length > 0 || unsavedRecents.length > 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#303549]">Wallets</h1>
        <button
          onClick={() => setProtocolModal(aaveProtocol)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#5382E3] hover:text-[#4270D0] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse bg-white">
              <CardContent className="p-4">
                <div className="h-5 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-50 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasAnything ? (
        <Card className="bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Wallet className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-400">No wallets yet.</p>
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Use a protocol from the Simulate menu or add a wallet here — your recent addresses will appear automatically.
            </p>
            <button
              onClick={() => setProtocolModal(aaveProtocol)}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5382E3] hover:bg-[#4270D0] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add wallet
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* ── Saved wallets ── */}
          {wallets.map((w) => {
            const ens = ensFor(w.address);
            return (
              <div
                key={w.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 cursor-pointer transition-colors group"
                onClick={() => handleWalletClick(w.address, ens)}
              >
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#303549] truncate">{w.label}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {ens && ens.toLowerCase() !== w.label.toLowerCase() && (
                      <span className="text-[11px] font-medium text-[#303549]">{ens}</span>
                    )}
                    <span className="text-[11px] font-mono text-gray-400">{truncAddr(w.address)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleCopy(w.address); }}
                  >
                    {copiedAddr === w.address ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                    disabled={deletingId === w.id}
                    onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* ── Recents (not saved) ── */}
          {unsavedRecents.length > 0 && (
            <>
              {wallets.length > 0 && (
                <div className="flex items-center gap-2 mt-5 mb-1 px-1">
                  <Clock className="w-3 h-3 text-gray-300" />
                  <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wider">
                    Recent
                  </span>
                </div>
              )}
              {unsavedRecents.map((r) => {
                const isSaving = savingAddress === r.address;
                return (
                  <div
                    key={r.address}
                    className="rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors group"
                  >
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => !isSaving && handleWalletClick(r.address, r.ensName)}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <Wallet className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {r.ensName ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#303549]">{r.ensName}</span>
                            <span className="text-[11px] font-mono text-gray-400">{truncAddr(r.address)}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-mono text-[#303549]">{truncAddr(r.address)}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-300 shrink-0 mr-1">
                        {timeAgo(new Date(r.lastUsed).toISOString())}
                      </span>
                      {/* Save button (visible on hover) */}
                      {!isSaving && (
                        <button
                          className="text-[11px] text-[#5382E3] hover:text-[#4270D0] font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSavingAddress(r.address);
                            setSaveLabel(r.ensName || "");
                          }}
                        >
                          Save
                        </button>
                      )}
                    </div>
                    {/* Inline save form */}
                    {isSaving && (
                      <div className="px-4 pb-3 flex items-center gap-2">
                        <input
                          type="text"
                          value={saveLabel}
                          onChange={(e) => setSaveLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRecent(r.address);
                            if (e.key === "Escape") { setSavingAddress(null); setSaveLabel(""); }
                          }}
                          placeholder="Label (e.g. My main wallet)"
                          className="flex-1 h-8 text-xs border border-gray-200 rounded-lg px-2.5 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRecent(r.address)}
                          disabled={saveBusy || !saveLabel.trim()}
                          className="h-8 px-3 text-xs font-medium rounded-lg bg-[#5382E3] text-white hover:bg-[#4270D0] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {saveBusy ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => { setSavingAddress(null); setSaveLabel(""); }}
                          className="h-8 px-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Protocol modal — choose what to do with the wallet */}
      {protocolModal && (
        <ProtocolModal
          protocol={{
            ...protocolModal,
            // If we have a pending address, override navigateTo to pre-fill
          }}
          open={!!protocolModal}
          onOpenChange={(open) => {
            if (!open) {
              setProtocolModal(null);
              setPendingAddress(null);
              setPendingEns(undefined);
            }
          }}
          defaultAddress={pendingAddress ?? undefined}
          defaultEns={pendingEns}
        />
      )}
    </div>
  );
}
