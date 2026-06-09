"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useProjections, ProjectionSummary } from "@/src/hooks/useProjections";
import {
  Card,
  CardContent,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Check, Copy, Pencil, Trash2, ExternalLink, FolderOpen, Share2, X, Coins } from "lucide-react";
import Link from "next/link";
import { ProjectionType } from "@/src/hooks/useProjections";
import { useRecentWallets } from "@/src/hooks/useRecentWallets";
import NetworkBadge from "@/src/components/NetworkBadge";
import type { NetworkId } from "@/src/lib/aave/networks";
import AaveIcon from "@/src/components/icons/AaveIcon";
import ProtocolModal, { type ProtocolConfig } from "@/src/components/ProtocolModal";

const morphoModalConfig: ProtocolConfig = {
  id: "morpho",
  name: "Morpho",
  description: "Simulate your Morpho vault positions on Ethereum & Base",
  icon: (
    <svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#1E2B3A" />
      <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">M</text>
    </svg>
  ),
  gradient: "from-[#1E2B3A] to-[#3B5998]",
  accentColor: "#1E2B3A",
  placeholder: "0x... or vitalik.eth",
  supportsNetwork: false,
  navigateTo: (address, ens) => {
    const params = new URLSearchParams({ wallet: address });
    if (ens) params.set("ens", ens);
    return `/morpho?${params.toString()}`;
  },
};

const aaveModalConfig: ProtocolConfig = {
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

export default function ProjectionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { projections, isLoading, list, update, duplicate, remove } = useProjections();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ProjectionType | "all">("all");
  const [showAaveModal, setShowAaveModal] = useState(false);
  const [showMorphoModal, setShowMorphoModal] = useState(false);
  const { wallets: recents } = useRecentWallets();

  const filteredProjections = typeFilter === "all"
    ? projections
    : projections.filter((p) => p.type === typeFilter);

  const aaveCount = projections.filter((p) => p.type === "aave").length;
  const sandboxCount = projections.filter((p) => p.type === "sandbox").length;
  const morphoCount = projections.filter((p) => p.type === "morpho").length;

  useEffect(() => {
    if (session?.user) {
      list();
    }
  }, [session?.user, list]);

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
        <FolderOpen className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 text-sm">Sign in to view your saved projections.</p>
        <Link href="/sign-in">
          <Button className="bg-[#5382E3]">Sign In</Button>
        </Link>
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await remove(id);
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (p: ProjectionSummary) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDetails(p.details || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditDetails("");
  };

  const handleOpen = (p: ProjectionSummary) => {
    if (p.type === "sandbox") {
      router.push(`/tokens?projection=${p.id}`);
    } else if (p.type === "morpho") {
      const params = new URLSearchParams({ wallet: p.address!, projection: p.id });
      const match = recents.find((r) => r.address.toLowerCase() === p.address?.toLowerCase());
      if (match?.ensName) params.set("ens", match.ensName);
      router.push(`/morpho?${params.toString()}`);
    } else {
      const params = new URLSearchParams({ wallet: p.address!, projection: p.id });
      const match = recents.find((r) => r.address.toLowerCase() === p.address?.toLowerCase());
      if (match?.ensName) params.set("ens", match.ensName);
      if (p.network && p.network !== "ETHEREUM_V3") params.set("network", p.network);
      router.push(`/?${params.toString()}`);
    }
  };

  const handleShare = async (p: ProjectionSummary) => {
    setSharingId(p.id);
    try {
      const full = await fetch(`/api/projections/${p.id}`).then((r) => r.json());
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: p.address,
          name: p.name,
          details: p.details || undefined,
          config: full.config,
          type: p.type,
          aiSummary: full.aiSummary || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();
      await navigator.clipboard.writeText(data.url);
      setSharedId(p.id);
      setTimeout(() => setSharedId(null), 2500);
    } catch { /* silent */ }
    finally { setSharingId(null); }
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setIsSavingEdit(true);
    try {
      await update(editingId, {
        name: editName.trim(),
        details: editDetails.trim() || null,
      });
      setEditingId(null);
    } catch { /* silent */ }
    finally { setIsSavingEdit(false); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#303549]">Saved Projections</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAaveModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-[#303549] hover:border-gray-300 transition-colors cursor-pointer"
          >
            <AaveIcon size={14} />
            Aave V3
          </button>
          <button
            onClick={() => setShowMorphoModal(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-[#303549] hover:border-gray-300 transition-colors cursor-pointer"
          >
            <svg width={14} height={14} viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#1E2B3A" />
              <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">M</text>
            </svg>
            Morpho
          </button>
          <Link href="/tokens">
            <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-[#303549] hover:border-gray-300 transition-colors cursor-pointer">
              <Coins className="w-3.5 h-3.5 text-[#4F7FFA]" />
              Sandbox
            </button>
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      {projections.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4">
          {[
            { key: "all", label: "All", count: projections.length, dot: null },
            { key: "aave", label: "Aave V3", count: aaveCount, dot: "bg-[#B6509E]" },
            { key: "morpho", label: "Morpho", count: morphoCount, dot: "bg-[#1E2B3A]" },
            { key: "sandbox", label: "Sandbox", count: sandboxCount, dot: "bg-[#4F7FFA]" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key as ProjectionType | "all")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === tab.key
                  ? "bg-[#303549] text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {tab.dot && (
                <span className={`w-1.5 h-1.5 rounded-full ${typeFilter === tab.key ? "bg-white/60" : tab.dot}`} />
              )}
              {tab.label}
              <span className={`text-[10px] ${typeFilter === tab.key ? "text-white/60" : "text-gray-400"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

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
      ) : filteredProjections.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <FolderOpen className="w-10 h-10 text-gray-300" />
            {projections.length === 0 ? (
              <>
                <p className="text-sm text-gray-400">No projections saved yet.</p>
                <p className="text-xs text-gray-400">
                  Go to <Link href="/" className="text-[#5382E3] hover:underline">Portfolio</Link>, run a simulation, and click Save.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">No {typeFilter === "aave" ? "Aave V3" : "Sandbox"} projections.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredProjections.map((p: ProjectionSummary) => (
            <Card
              key={p.id}
              className="bg-white group"
            >
              <CardContent className="p-4">
                {editingId === p.id ? (
                  /* ── Edit mode ── */
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">Name</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEditing();
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">Notes</label>
                      <Textarea
                        value={editDetails}
                        onChange={(e) => setEditDetails(e.target.value)}
                        placeholder="Strategy notes, assumptions..."
                        className="text-sm resize-none h-16"
                      />
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={cancelEditing}
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 bg-[#5382E3]"
                        onClick={saveEdit}
                        disabled={isSavingEdit || !editName.trim()}
                      >
                        <Check className="w-3 h-3" />
                        {isSavingEdit ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Display mode ── */
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleOpen(p)}
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-[#303549] truncate">{p.name}</p>
                        {p.type === "aave" ? (
                          <>
                            <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-[#B6509E]/10 text-[#B6509E] shrink-0">
                              Aave V3
                            </span>
                            {p.network && (
                              <NetworkBadge networkId={p.network as NetworkId} size="sm" />
                            )}
                          </>
                        ) : p.type === "morpho" ? (
                          <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-[#1E2B3A]/10 text-[#1E2B3A] shrink-0">
                            Morpho
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-[#4F7FFA]/10 text-[#4F7FFA] shrink-0">
                            Sandbox
                          </span>
                        )}
                      </div>
                      {p.details && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.details}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        {(p.type === "aave" || p.type === "morpho") && p.address ? (() => {
                          const ensMatch = recents.find((r) => r.address.toLowerCase() === p.address?.toLowerCase());
                          return (
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              {ensMatch?.ensName && (
                                <span className="font-medium text-[#303549] font-sans">{ensMatch.ensName}</span>
                              )}
                              <span className="font-mono">{p.address.slice(0, 6)}...{p.address.slice(-4)}</span>
                            </span>
                          );
                        })() : p.type === "sandbox" ? (
                          <span className="text-[11px] text-gray-400">Portfolio</span>
                        ) : (
                          <span className="text-[11px] text-gray-400">No wallet</span>
                        )}
                        <span className="text-[11px] text-gray-300">
                          {new Date(p.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Open"
                        onClick={() => handleOpen(p)}
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Edit"
                        onClick={() => startEditing(p)}
                      >
                        <Pencil className="w-4 h-4 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Duplicate"
                        onClick={() => duplicate(p.id)}
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </Button>
                      {(p.type === "aave" || p.type === "morpho") && (
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Share"
                            disabled={sharingId === p.id}
                            onClick={() => handleShare(p)}
                          >
                            {sharedId === p.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Share2 className="w-4 h-4 text-gray-400" />
                            )}
                          </Button>
                          {sharedId === p.id && (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[#303549] text-white text-[10px] font-medium whitespace-nowrap animate-in fade-in slide-in-from-bottom-1">
                              Copied!
                            </span>
                          )}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Delete"
                        disabled={deletingId === p.id}
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Aave V3 modal */}
      {showAaveModal && (
        <ProtocolModal
          protocol={aaveModalConfig}
          open={showAaveModal}
          onOpenChange={(open) => { if (!open) setShowAaveModal(false); }}
        />
      )}

      {/* Morpho modal */}
      {showMorphoModal && (
        <ProtocolModal
          protocol={morphoModalConfig}
          open={showMorphoModal}
          onOpenChange={(open) => { if (!open) setShowMorphoModal(false); }}
        />
      )}
    </div>
  );
}
