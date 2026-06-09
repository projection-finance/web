"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  RefreshCw,
  Bell,
  Activity,
  ShieldCheck,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import AaveIcon from "@/src/components/icons/AaveIcon";
import NetworkBadge from "@/src/components/NetworkBadge";
import NetworkSelector from "@/src/components/NetworkSelector";
import { type NetworkId, DEFAULT_NETWORK, getNetworkById } from "@/src/lib/aave/networks";
import { AiOutlineLoading } from "react-icons/ai";

// ── Types ──

interface HfEntry {
  hf: number | null;
  at: string;
}

interface FavoriteWallet {
  id: string;
  address: string;
  label: string;
  lastHealthFactor: number | null;
  lastHealthFactorAt: string | null;
  healthFactors: Record<string, HfEntry> | null;
  monitoredNetworks: string[] | null;
}

type Tab = "health-factor";

// ── Helpers ──

function getHfColor(hf: number): string {
  if (hf >= 1.5) return "bg-emerald-100 text-emerald-700";
  if (hf >= 1.0) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function formatHf(hf: number | null): string {
  if (hf === null) return "—";
  if (!isFinite(hf)) return "\u221E";
  return hf.toFixed(2);
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
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

function isAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input.trim());
}

function isENS(input: string): boolean {
  return /^[a-zA-Z0-9-]+\.[a-z]{2,}$/.test(input.trim());
}

// ── Tabs config ──

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "health-factor",
    label: "Health Factor",
    icon: <AaveIcon size={14} />,
  },
];

const comingSoonTabs = [
  { label: "Liquidation Distance", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { label: "Rate Changes", icon: <Activity className="w-3.5 h-3.5" /> },
  { label: "Price Alerts", icon: <Bell className="w-3.5 h-3.5" /> },
];

export default function MonitoringPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("health-factor");
  const [wallets, setWallets] = useState<FavoriteWallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Add wallet modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addNetwork, setAddNetwork] = useState<NetworkId>(DEFAULT_NETWORK);
  const [addResolving, setAddResolving] = useState(false);
  const [addResolvedAddress, setAddResolvedAddress] = useState<string | null>(null);
  const [addEnsName, setAddEnsName] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Add network modal
  const [addNetworkWalletId, setAddNetworkWalletId] = useState<string | null>(null);
  const [addNetworkSelection, setAddNetworkSelection] = useState<NetworkId>(DEFAULT_NETWORK);
  const [addNetworkScanning, setAddNetworkScanning] = useState(false);

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

  // ── ENS resolution for add modal ──
  useEffect(() => {
    const trimmed = addInput.trim();
    setAddError("");

    if (isAddress(trimmed)) {
      setAddResolvedAddress(trimmed);
      setAddEnsName(null);
      setAddResolving(false);
      return;
    }

    if (!isENS(trimmed)) {
      setAddResolvedAddress(null);
      setAddEnsName(null);
      setAddResolving(false);
      return;
    }

    const networkMeta = getNetworkById(addNetwork);
    if (!networkMeta?.supportsENS) {
      setAddError("ENS names are only supported on Ethereum. Please enter a 0x address.");
      setAddResolvedAddress(null);
      setAddEnsName(null);
      return;
    }

    setAddResolving(true);
    setAddResolvedAddress(null);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/resolve-ens?name=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          const data = await res.json();
          setAddError(data.error || "Could not resolve ENS name");
          setAddResolvedAddress(null);
          setAddEnsName(null);
        } else {
          const data = await res.json();
          setAddResolvedAddress(data.address);
          setAddEnsName(trimmed);
        }
      } catch {
        setAddError("Failed to resolve ENS name");
        setAddResolvedAddress(null);
      } finally {
        setAddResolving(false);
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      setAddResolving(false);
    };
  }, [addInput, addNetwork]);

  // ── Actions ──

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/favorite-wallets/${id}/refresh`, { method: "POST" });
      if (res.ok) {
        const updated: FavoriteWallet = await res.json();
        setWallets((prev) => prev.map((w) => (w.id === id ? updated : w)));
      }
    } catch { /* silent */ }
    finally { setRefreshingId(null); }
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    for (const w of wallets) {
      try {
        const res = await fetch(`/api/favorite-wallets/${w.id}/refresh`, { method: "POST" });
        if (res.ok) {
          const updated: FavoriteWallet = await res.json();
          setWallets((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        }
      } catch { /* silent */ }
    }
    setRefreshingAll(false);
  };

  const handleAddWallet = async () => {
    if (!addResolvedAddress) return;
    setAddSaving(true);
    setAddError("");
    try {
      const label = addEnsName || truncAddr(addResolvedAddress);
      const res = await fetch("/api/favorite-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addResolvedAddress,
          label,
          networks: [addNetwork],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error || "Failed to add wallet");
        return;
      }
      const wallet: FavoriteWallet = await res.json();
      setWallets((prev) => [wallet, ...prev]);
      setShowAddModal(false);
      resetAddModal();
      // Auto-refresh to get HF data
      handleRefresh(wallet.id);
    } catch {
      setAddError("Failed to add wallet");
    } finally {
      setAddSaving(false);
    }
  };

  const resetAddModal = () => {
    setAddInput("");
    setAddNetwork(DEFAULT_NETWORK);
    setAddResolvedAddress(null);
    setAddEnsName(null);
    setAddError("");
    setAddResolving(false);
  };

  const handleAddNetworkToWallet = async (walletId: string, network: NetworkId) => {
    setAddNetworkScanning(true);
    try {
      // Add network to wallet
      const patchRes = await fetch(`/api/favorite-wallets/${walletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addNetwork: network }),
      });
      if (patchRes.ok) {
        const updated: FavoriteWallet = await patchRes.json();
        setWallets((prev) => prev.map((w) => (w.id === walletId ? updated : w)));
        // Refresh to scan the new network
        handleRefresh(walletId);
      }
    } catch { /* silent */ }
    finally {
      setAddNetworkScanning(false);
      setAddNetworkWalletId(null);
    }
  };

  const handleRemoveNetwork = async (walletId: string, network: string) => {
    try {
      const res = await fetch(`/api/favorite-wallets/${walletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeNetwork: network }),
      });
      if (res.ok) {
        const updated: FavoriteWallet = await res.json();
        setWallets((prev) => prev.map((w) => (w.id === walletId ? updated : w)));
      }
    } catch { /* silent */ }
  };

  const handleDeleteWallet = async (id: string) => {
    try {
      const res = await fetch(`/api/favorite-wallets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWallets((prev) => prev.filter((w) => w.id !== id));
      }
    } catch { /* silent */ }
  };

  const monitoredWallets = wallets;

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
        <Activity className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 text-sm">Sign in to monitor your positions.</p>
        <Link href="/sign-in">
          <Button className="bg-[#5382E3]">Sign In</Button>
        </Link>
      </div>
    );
  }

  const canSubmitAdd = !!addResolvedAddress && !addResolving && !addSaving;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#303549]">Monitoring</h1>
        <div className="flex items-center gap-3">
          {monitoredWallets.length > 0 && activeTab === "health-factor" && (
            <button
              onClick={handleRefreshAll}
              disabled={refreshingAll}
              className="flex items-center gap-1.5 text-xs font-medium text-[#5382E3] hover:text-[#4270D0] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingAll ? "animate-spin" : ""}`} />
              Refresh all
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#303549] text-white hover:bg-[#1e2333] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add wallet
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[#303549] text-white"
                : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        {comingSoonTabs.map((tab) => (
          <div
            key={tab.label}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-white border border-gray-100 text-gray-300 cursor-default"
          >
            {tab.icon}
            {tab.label}
            <span className="text-[8px] bg-amber-100 text-amber-700 rounded px-1 py-0.5 font-bold leading-none">
              SOON
            </span>
          </div>
        ))}
      </div>

      {/* Health Factor tab content */}
      {activeTab === "health-factor" && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse bg-white">
                  <CardContent className="p-4">
                    <div className="h-5 bg-gray-100 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-gray-50 rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : monitoredWallets.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <Activity className="w-10 h-10 text-gray-300" />
                <p className="text-sm text-gray-400">No wallets being monitored.</p>
                <p className="text-xs text-gray-400 text-center max-w-sm">
                  Click &quot;Add wallet&quot; to start monitoring health factors on Aave V3.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-[#303549] text-white hover:bg-[#1e2333] transition-colors cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add wallet
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Protocol header */}
              <div className="flex items-center gap-2 mb-1 px-1">
                <AaveIcon size={16} />
                <span className="text-xs font-semibold text-[#303549]">Aave V3</span>
              </div>

              {monitoredWallets.map((w) => {
                const isRefreshing = refreshingId === w.id || refreshingAll;
                const hfMap = w.healthFactors;
                const monitored = w.monitoredNetworks as string[] | null;
                // Show networks from healthFactors (scanned results)
                const networkIds = hfMap ? Object.keys(hfMap) : [];
                const hasNetworks = networkIds.length > 0;
                // Legacy: old data had HF from Ethereum only, without healthFactors JSON
                const isLegacy = !hfMap && w.lastHealthFactor !== null && !monitored;

                return (
                  <Card key={w.id} className="bg-white group hover:border-gray-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <p className="font-medium text-sm text-[#303549] truncate">
                              {w.label}
                            </p>
                          </div>

                          {/* Per-network HF breakdown */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {hasNetworks ? (
                              networkIds.map((netId) => {
                                const entry = hfMap![netId];
                                return (
                                  <div key={netId} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2 py-1 group/net">
                                    <NetworkBadge networkId={netId as NetworkId} size="sm" showLabel />
                                    {entry.hf !== null ? (
                                      <span className={`text-[11px] font-bold rounded px-1.5 py-0.5 ${getHfColor(entry.hf)}`}>
                                        {formatHf(entry.hf)}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-gray-400 font-medium px-1.5">—</span>
                                    )}
                                    {monitored && (
                                      <button
                                        onClick={() => handleRemoveNetwork(w.id, netId)}
                                        className="opacity-0 group-hover/net:opacity-100 transition-opacity text-gray-300 hover:text-red-400 cursor-pointer"
                                        title="Remove network"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            ) : isLegacy ? (
                              <div className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2 py-1">
                                <NetworkBadge networkId={"ETHEREUM_V3" as NetworkId} size="sm" showLabel />
                                <span className={`text-[11px] font-bold rounded px-1.5 py-0.5 ${getHfColor(w.lastHealthFactor!)}`}>
                                  {formatHf(w.lastHealthFactor)}
                                </span>
                                <span className="text-[9px] text-gray-400 ml-1">refresh for full scan</span>
                              </div>
                            ) : w.lastHealthFactorAt ? (
                              <span className="text-[11px] text-gray-400">No active borrows on monitored networks</span>
                            ) : (
                              <span className="text-[11px] text-gray-400">Not yet scanned — click refresh</span>
                            )}

                            {/* Add network button */}
                            <button
                              onClick={() => {
                                setAddNetworkWalletId(w.id);
                                setAddNetworkSelection(DEFAULT_NETWORK);
                              }}
                              className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-gray-400 border border-dashed border-gray-200 hover:border-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                              title="Add network"
                            >
                              <Plus className="w-3 h-3" />
                              Network
                            </button>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] font-mono text-gray-400">
                              {truncAddr(w.address)}
                            </span>
                            <span className="text-[10px] text-gray-300">
                              {timeAgo(w.lastHealthFactorAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={isRefreshing}
                            onClick={() => handleRefresh(w.id)}
                            title="Refresh"
                          >
                            <RefreshCw
                              className={`w-4 h-4 text-gray-400 ${isRefreshing ? "animate-spin" : ""}`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteWallet(w.id)}
                            title="Remove wallet"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Info */}
          <div className="mt-6 px-1">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Health factors are scanned on the networks you select for each wallet.
              Networks with no active borrows show &quot;—&quot;.
              Legacy wallets (without explicit networks) scan all 17 networks on refresh.
            </p>
          </div>
        </>
      )}

      {/* Future: alerts banner */}
      <Card className="bg-white mt-8 border-dashed">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-[#5382E3]" />
            <h2 className="text-sm font-semibold text-[#303549]">Alerts</h2>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[#ECECF5] text-[#5382E3] border-0">
              Coming Soon
            </Badge>
          </div>
          <p className="text-xs text-gray-400">
            Get notified when health factor drops below a threshold, token prices cross targets, or rates change significantly.
          </p>
        </CardContent>
      </Card>

      {/* ── Add Wallet Modal ── */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) { setShowAddModal(false); resetAddModal(); } }}>
        <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
          <div
            className="px-6 pt-6 pb-4"
            style={{ background: "linear-gradient(135deg, #B6509E08 0%, #B6509E15 100%)" }}
          >
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#B6509E]/10">
                  <AaveIcon size={22} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-[#303549]">
                    Monitor wallet
                  </DialogTitle>
                  <p className="text-xs text-gray-500 mt-0.5">Track health factor on Aave V3</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            {/* Network selector */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                Network
              </label>
              <NetworkSelector selected={addNetwork} onChange={setAddNetwork} />
            </div>

            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getNetworkById(addNetwork)?.supportsENS ? "Wallet address or ENS name" : "Wallet address"}
            </label>
            <div className="relative mt-1.5">
              <input
                type="text"
                className="w-full h-11 rounded-lg text-sm px-4 pr-10 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5382E3]/40 focus:border-[#5382E3] transition-colors"
                placeholder={getNetworkById(addNetwork)?.supportsENS ? "0x... or vitalik.eth" : "0x..."}
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canSubmitAdd) handleAddWallet(); }}
                autoFocus
              />
              {addResolving && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <AiOutlineLoading className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              )}
              {!addResolving && addResolvedAddress && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>

            {addEnsName && addResolvedAddress && (
              <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-[11px] text-gray-500 font-mono">
                  {addResolvedAddress.slice(0, 6)}...{addResolvedAddress.slice(-4)}
                </span>
              </div>
            )}

            {addError && (
              <p className="text-xs text-red-500 mt-2">{addError}</p>
            )}

            <button
              onClick={handleAddWallet}
              disabled={!canSubmitAdd}
              className="w-full h-11 rounded-xl text-sm font-medium transition-colors mt-4 cursor-pointer disabled:cursor-not-allowed"
              style={{
                backgroundColor: canSubmitAdd ? "#303549" : "#30354940",
                color: "white",
              }}
            >
              {addSaving ? (
                <AiOutlineLoading className="animate-spin mx-auto" />
              ) : (
                "Add & scan"
              )}
            </button>

            <p className="text-[10px] text-gray-400 text-center mt-3">
              Read-only. We never ask for private keys or signatures.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Network Modal ── */}
      <Dialog open={!!addNetworkWalletId} onOpenChange={(open) => { if (!open) setAddNetworkWalletId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#303549]">
              Add network
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <NetworkSelector selected={addNetworkSelection} onChange={setAddNetworkSelection} />
            <button
              onClick={() => {
                if (addNetworkWalletId) {
                  handleAddNetworkToWallet(addNetworkWalletId, addNetworkSelection);
                }
              }}
              disabled={addNetworkScanning}
              className="w-full h-10 rounded-xl text-sm font-medium bg-[#303549] text-white hover:bg-[#1e2333] transition-colors cursor-pointer disabled:opacity-50"
            >
              {addNetworkScanning ? (
                <AiOutlineLoading className="animate-spin mx-auto" />
              ) : (
                "Add & scan"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
