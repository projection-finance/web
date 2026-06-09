"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FolderOpen, Pencil, Save, Share2, Loader2, Plus, Search, Trash2, X, SlidersHorizontal, CalendarPlus } from "lucide-react";
import type { MorphoPositionData, MorphoVaultPosition } from "@/src/lib/morpho/types";
import { useMorphoSimulation } from "@/src/hooks/useMorphoSimulation";
import { useProjections } from "@/src/hooks/useProjections";
import ProjectionChart from "@/src/components/simulation/ProjectionChart";
import ProjectionTimelineWrapper from "@/src/components/simulation/ProjectionTimelineWrapper";
import { adaptMorphoVaultsResult } from "@/src/lib/simulation/chart-adapter";
import MorphoActionScheduler from "./MorphoActionScheduler";
import MorphoPriceRatesModal from "./MorphoPriceRatesModal";
import SaveProjectionModal from "@/src/components/simulation/SaveProjectionModal";
import LoadProjectionModal from "@/src/components/simulation/LoadProjectionModal";
import AISummaryModal from "@/src/components/simulation/AISummaryModal";
import type { MorphoSimulationConfig } from "@/src/lib/simulation/morpho-types";
import type { AISummaryData, AISummaryRequest, AIModel } from "@/src/lib/ai/types";
import { getPlanFeatures } from "@/src/lib/plan";

function formatUSD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
};

const DURATION_PRESETS = [7, 30, 90, 180, 365];

// ── Vault search result (from /api/morpho/vaults) ──

interface VaultSearchResult {
  vaultName: string;
  vaultAddress: string;
  chainId: number;
  chainName: string;
  assetSymbol: string;
  netApy: number;
  tvlUsd: number;
}

interface MorphoDashboardProps {
  position: MorphoPositionData;
  ensName?: string;
  projectionId?: string;
  sessionId?: string;
  isSandbox?: boolean;
  onChangeWallet?: (address: string, ens?: string) => void;
  onClear?: () => void;
  onPositionChange?: (position: MorphoPositionData) => void;
}

export default function MorphoDashboard({
  position,
  ensName,
  projectionId,
  sessionId,
  isSandbox = false,
  onChangeWallet,
  onClear,
  onPositionChange,
}: MorphoDashboardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sim = useMorphoSimulation(position);
  const {
    projections, isLoading: projectionsLoading,
    list: listProjections, save: saveProjection,
    load: loadProjection, update: updateProjection,
    duplicate: duplicateProjection, remove: removeProjection,
  } = useProjections();

  // Open-source & free: every user has full access.
  const features = getPlanFeatures("pro");

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentProjectionId, setCurrentProjectionId] = useState<string | null>(projectionId ?? null);
  const [currentProjectionName, setCurrentProjectionName] = useState<string | null>(null);
  const [currentProjectionDetails, setCurrentProjectionDetails] = useState<string | null>(null);

  // Share state
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Auto-save state
  const [autoSave, setAutoSave] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(0);
  const lastSavedConfigRef = useRef<string>("");

  // Price/Rates modal state
  const [priceRatesModalOpen, setPriceRatesModalOpen] = useState(false);

  // AI Summary state
  const [aiSummaryModalOpen, setAiSummaryModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummaryData | null>(null);

  // Action scheduler expanded state
  const [actionsExpanded, setActionsExpanded] = useState(false);

  // Vault search state
  const [vaultSearchOpen, setVaultSearchOpen] = useState(false);
  const [vaultSearchQuery, setVaultSearchQuery] = useState("");
  const [vaultSearchResults, setVaultSearchResults] = useState<VaultSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Editing amounts inline
  const [editingVault, setEditingVault] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  // Custom amount when adding a vault
  const [addVaultAmount, setAddVaultAmount] = useState("1000");

  // ── Config fingerprint for change tracking ──
  const configFingerprint = useMemo(
    () => JSON.stringify({
      d: sim.config.durationDays,
      p: sim.config.priceScenarios,
      r: sim.config.rateScenarios,
      a: sim.config.scheduledActions,
      ss: sim.config.scenarioSets,
    }),
    [sim.config]
  );

  // Track unsaved changes
  useEffect(() => {
    if (!lastSavedConfigRef.current) {
      lastSavedConfigRef.current = configFingerprint;
      return;
    }
    if (configFingerprint !== lastSavedConfigRef.current) {
      setUnsavedChanges((c) => c + 1);
    }
  }, [configFingerprint]);

  // ── Cloud auto-save (PRO, debounced 2s) ──
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!autoSave || !currentProjectionId || !session?.user || unsavedChanges === 0) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateProjection(currentProjectionId, { config: sim.config as any });
        lastSavedConfigRef.current = configFingerprint;
        setUnsavedChanges(0);
      } catch { /* silent */ }
    }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, currentProjectionId, configFingerprint, session?.user]);

  // ── Local autosave (PRO, localStorage) ──
  const [activeSid, setActiveSid] = useState<string | null>(sessionId ?? null);
  const hasRestoredAutosave = useRef(false);

  const getAutosaveKey = (sid: string) => `morpho-autosave-${sid}`;

  const generateSid = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  };

  const pushSidToUrl = useCallback((sid: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sid", sid);
    router.replace(`/morpho?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const buildAutosavePayload = useCallback(() => {
    return JSON.stringify({
      v: 1,
      ts: Date.now(),
      wallet: position.address,
      config: sim.config,
    });
  }, [sim.config, position.address]);

  // Restore autosave on mount
  useEffect(() => {
    if (hasRestoredAutosave.current) return;
    if (projectionId) return;
    if (!features.canAutoSave) return;
    if (!activeSid) return;
    hasRestoredAutosave.current = true;

    try {
      const raw = localStorage.getItem(getAutosaveKey(activeSid));
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data?.config) return;
      if (data.ts && Date.now() - data.ts > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(getAutosaveKey(activeSid));
        return;
      }
      sim.loadConfigAndRun(data.config);
    } catch { /* corrupted data, ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSid, projectionId, features.canAutoSave]);

  // Debounce-save to localStorage on changes
  const autosaveLocalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEverChanged = sim.config.priceScenarios.length > 0 ||
    sim.config.rateScenarios.length > 0 ||
    sim.config.scheduledActions.length > 0;

  useEffect(() => {
    if (!features.canAutoSave) return;
    if (!hasEverChanged) return;

    let sid = activeSid;
    if (!sid) {
      sid = generateSid();
      setActiveSid(sid);
      pushSidToUrl(sid);
    }

    if (autosaveLocalTimerRef.current) clearTimeout(autosaveLocalTimerRef.current);
    const currentSid = sid;
    autosaveLocalTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(getAutosaveKey(currentSid), buildAutosavePayload());
      } catch { /* quota exceeded, ignore */ }
    }, 1500);

    return () => { if (autosaveLocalTimerRef.current) clearTimeout(autosaveLocalTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configFingerprint, features.canAutoSave, hasEverChanged]);

  // Save on page unload
  useEffect(() => {
    if (!features.canAutoSave || !activeSid) return;
    const sid = activeSid;
    const handleUnload = () => {
      try {
        localStorage.setItem(getAutosaveKey(sid), buildAutosavePayload());
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [features.canAutoSave, activeSid, buildAutosavePayload]);

  // Load saved projection on mount
  const [hasLoadedProjection, setHasLoadedProjection] = useState(false);
  if (projectionId && !hasLoadedProjection) {
    setHasLoadedProjection(true);
    loadProjection(projectionId).then((full) => {
      if (full.config) {
        setCurrentProjectionId(full.id);
        setCurrentProjectionName(full.name);
        setCurrentProjectionDetails(full.details);
        sim.loadConfigAndRun(full.config as unknown as MorphoSimulationConfig);
        lastSavedConfigRef.current = configFingerprint;
      }
    }).catch((err) => { console.error("[MorphoVaults] Failed to load projection:", err.message); });
  }

  // List projections on mount
  useEffect(() => {
    if (session?.user) listProjections("morpho");
  }, [session?.user, listProjections]);

  // Chain badges from positions
  const chains = useMemo(() => {
    const set = new Set(position.positions.map((p) => p.chainId));
    return Array.from(set);
  }, [position]);

  // Summary stats
  const avgApy = useMemo(() => {
    const totalBal = position.positions.reduce((s, p) => s + p.depositedUsd, 0);
    if (totalBal === 0) return 0;
    return position.positions.reduce((s, p) => s + p.netApy * p.depositedUsd, 0) / totalBal;
  }, [position]);

  // Selected day snapshot
  const selectedSnapshot = useMemo(() => {
    if (sim.selectedDay === null || !sim.result) return null;
    return sim.result.timeline[sim.selectedDay] ?? null;
  }, [sim.selectedDay, sim.result]);

  // ── Vault search ──

  useEffect(() => {
    if (!vaultSearchOpen) return;
    searchInputRef.current?.focus();
  }, [vaultSearchOpen]);

  const handleVaultSearch = useCallback((query: string) => {
    setVaultSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (query.length < 1) {
      // Show top vaults when empty
      setIsSearching(true);
      fetch("/api/morpho/vaults")
        .then((r) => r.ok ? r.json() : [])
        .then(setVaultSearchResults)
        .finally(() => setIsSearching(false));
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/morpho/vaults?q=${encodeURIComponent(query)}`);
        if (res.ok) setVaultSearchResults(await res.json());
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Load top vaults on search open
  useEffect(() => {
    if (vaultSearchOpen && vaultSearchResults.length === 0) {
      handleVaultSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultSearchOpen]);

  const handleAddVault = useCallback((vault: VaultSearchResult, amountUsd: number = 1000) => {
    if (!onPositionChange) return;
    // Generate a unique address-like key for sandbox vaults
    const vaultKey = vault.vaultAddress || `sandbox_${vault.vaultName}_${vault.chainId}`;
    const exists = position.positions.some(
      (p) => (p.vaultAddress === vaultKey) || (p.vaultName === vault.vaultName && p.chainId === vault.chainId)
    );
    if (exists) return;

    const newPosition: MorphoVaultPosition = {
      vaultName: vault.vaultName,
      vaultAddress: vaultKey,
      chainId: vault.chainId,
      assetSymbol: vault.assetSymbol,
      assetDecimals: 18,
      netApy: vault.netApy,
      depositedUsd: amountUsd,
      pnlUsd: 0,
      vaultVersion: "v2",
    };

    const newPositions = [...position.positions, newPosition];
    onPositionChange({
      ...position,
      positions: newPositions,
      totalDepositedUsd: newPositions.reduce((s, p) => s + p.depositedUsd, 0),
      totalPnlUsd: newPositions.reduce((s, p) => s + p.pnlUsd, 0),
    });
    setVaultSearchOpen(false);
    setVaultSearchQuery("");
  }, [position, onPositionChange]);

  const handleRemoveVault = useCallback((vaultAddress: string) => {
    if (!onPositionChange) return;
    const newPositions = position.positions.filter((p) => p.vaultAddress !== vaultAddress);
    onPositionChange({
      ...position,
      positions: newPositions,
      totalDepositedUsd: newPositions.reduce((s, p) => s + p.depositedUsd, 0),
      totalPnlUsd: newPositions.reduce((s, p) => s + p.pnlUsd, 0),
    });
  }, [position, onPositionChange]);

  const handleUpdateAmount = useCallback((vaultAddress: string, newAmount: number) => {
    if (!onPositionChange) return;
    const newPositions = position.positions.map((p) =>
      p.vaultAddress === vaultAddress ? { ...p, depositedUsd: newAmount } : p
    );
    onPositionChange({
      ...position,
      positions: newPositions,
      totalDepositedUsd: newPositions.reduce((s, p) => s + p.depositedUsd, 0),
    });
    setEditingVault(null);
  }, [position, onPositionChange]);

  // ── Generate default name ──
  const generateDefaultName = useCallback(() => {
    const walletLabel = ensName || (position.address ? `${position.address.slice(0, 6)}...${position.address.slice(-4)}` : "Sandbox");
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${walletLabel} — Morpho · ${date} · ${sim.config.durationDays}d`;
  }, [position.address, ensName, sim.config.durationDays]);

  // ── Save handler ──
  const handleSave = useCallback(async (name: string, details: string) => {
    setIsSaving(true);
    try {
      if (currentProjectionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateProjection(currentProjectionId, { name, details, config: sim.config as any });
        setCurrentProjectionName(name);
        setCurrentProjectionDetails(details);
      } else {
        const created = await saveProjection(name, sim.config, {
          address: position.address || undefined,
          type: "morpho",
          details,
        });
        setCurrentProjectionId(created.id);
        setCurrentProjectionName(name);
        setCurrentProjectionDetails(details);
        const params = new URLSearchParams(window.location.search);
        params.set("projection", created.id);
        router.replace(`/morpho?${params.toString()}`);
      }
      lastSavedConfigRef.current = configFingerprint;
      setUnsavedChanges(0);
      setSaveModalOpen(false);
    } catch {
      // silent
    } finally {
      setIsSaving(false);
    }
  }, [currentProjectionId, sim.config, position.address, saveProjection, updateProjection, router, configFingerprint]);

  // ── Share handler ──
  const handleShare = useCallback(async () => {
    if (!session?.user) return;
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: position.address || undefined,
          name: currentProjectionName || generateDefaultName(),
          details: currentProjectionDetails || undefined,
          config: sim.config,
          type: "morpho",
        }),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();
      await navigator.clipboard.writeText(data.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch { /* silent */ }
    finally { setShareLoading(false); }
  }, [session?.user, position.address, currentProjectionName, currentProjectionDetails, sim.config, generateDefaultName]);

  // ── AI Summary ──
  const buildSummaryRequest = useCallback((language: string, model?: AIModel): AISummaryRequest => {
    const r = sim.result;
    const day0 = r?.timeline[0];
    const dayN = r?.timeline[r.timeline.length - 1];

    return {
      type: "morpho",
      language,
      model,
      address: position.address || undefined,
      ensName: ensName || undefined,
      durationDays: sim.config.durationDays,
      morphoSummary: r?.summary ? {
        startNetWorth: r.summary.startNetWorth,
        endNetWorth: r.summary.endNetWorth,
        totalInterestEarned: r.summary.totalInterestEarned,
        avgApy: r.summary.avgApy,
      } : undefined,
      morphoVaults: (day0 ?? dayN)?.vaults.map((v) => ({
        vaultName: v.vaultName,
        assetSymbol: v.assetSymbol,
        balanceUsd: v.balanceUsd,
        netApy: v.netApy,
      })),
      morphoActions: sim.config.scheduledActions.map((a) => {
        const vault = position.positions.find((p) => p.vaultAddress === a.vaultAddress);
        return { day: a.day, type: a.type, vaultName: vault?.vaultName ?? a.vaultAddress.slice(0, 10), amount: a.amount };
      }),
      priceChanges: sim.config.priceScenarios.map((p) => ({
        symbol: p.symbol, mode: p.mode, startPrice: p.startPrice, endPrice: p.endPrice,
      })),
    };
  }, [sim.result, sim.config, position, ensName]);

  const handleSaveAISummary = useCallback(async (summary: AISummaryData) => {
    setAiSummary(summary);
    if (currentProjectionId) {
      try {
        await updateProjection(currentProjectionId, { aiSummary: summary });
      } catch { /* silent */ }
    }
  }, [currentProjectionId, updateProjection]);

  // ── Load handler ──
  const handleLoadProjection = useCallback(async (p: { id: string }) => {
    try {
      const full = await loadProjection(p.id);
      if (full.config) {
        setCurrentProjectionId(full.id);
        setCurrentProjectionName(full.name);
        setCurrentProjectionDetails(full.details);
        setAiSummary(full.aiSummary ?? null);
        sim.loadConfigAndRun(full.config as unknown as MorphoSimulationConfig);
        lastSavedConfigRef.current = JSON.stringify({
          d: (full.config as unknown as MorphoSimulationConfig).durationDays,
          p: (full.config as unknown as MorphoSimulationConfig).priceScenarios,
          r: (full.config as unknown as MorphoSimulationConfig).rateScenarios,
          a: (full.config as unknown as MorphoSimulationConfig).scheduledActions,
          ss: (full.config as unknown as MorphoSimulationConfig).scenarioSets,
        });
        setUnsavedChanges(0);
        const params = new URLSearchParams(window.location.search);
        params.set("projection", full.id);
        router.replace(`/morpho?${params.toString()}`, { scroll: false });
      }
      setLoadModalOpen(false);
    } catch { /* silent */ }
  }, [loadProjection, sim, router]);

  const shortAddr = position.address
    ? `${position.address.slice(0, 6)}...${position.address.slice(-4)}`
    : null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pb-[60px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#303549] hover:border-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#303549]">
                {isSandbox ? "Morpho Sandbox" : "Morpho Vaults"}
              </h1>
              {isSandbox && (
                <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-[#4F7FFA]/10 text-[#4F7FFA]">
                  SANDBOX
                </span>
              )}
              {chains.map((c) => (
                <span
                  key={c}
                  className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-[#1E2B3A]/10 text-[#1E2B3A]"
                >
                  {CHAIN_NAMES[c] || `Chain ${c}`}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {ensName && (
                <span className="text-xs font-medium text-[#303549]">{ensName}</span>
              )}
              {shortAddr && (
                <span className="text-xs text-gray-400 font-mono">{shortAddr}</span>
              )}
              {isSandbox && !shortAddr && (
                <span className="text-xs text-gray-400">Custom portfolio</span>
              )}
              {currentProjectionName && (
                <span className="text-[10px] text-[#4F7FFA] font-medium">
                  — {currentProjectionName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onChangeWallet && !isSandbox && (
            <button
              onClick={() => onChangeWallet(position.address, ensName)}
              className="text-xs text-gray-400 hover:text-[#303549] transition-colors"
            >
              Switch wallet
            </button>
          )}

          {/* Auto-save toggle (PRO only, when tracking a projection) */}
          {features.canAutoSave && currentProjectionId && session?.user && (
            <label className="flex items-center gap-1 cursor-pointer" title="Auto-save changes">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#4F7FFA]"
              />
              <span className="text-[10px] text-gray-400">Auto</span>
            </label>
          )}

          {/* Save button */}
          {session?.user && (
            <button
              onClick={() => setSaveModalOpen(true)}
              className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#303549] text-white hover:bg-[#1e2333] transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "..." : currentProjectionId ? "Save" : "Save as"}
              {unsavedChanges > 0 && !autoSave && currentProjectionId && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#4F7FFA] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unsavedChanges > 9 ? "9+" : unsavedChanges}
                </span>
              )}
            </button>
          )}

          {/* Share button */}
          {sim.result && session?.user && (
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-gray-200 text-[#303549] hover:bg-gray-50 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              {shareLoading ? "..." : shareCopied ? "Copied!" : "Share"}
            </button>
          )}

          {/* Load button */}
          {session?.user && (
            <button
              onClick={() => setLoadModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border border-gray-200 text-[#303549] hover:bg-gray-50 transition-colors"
              title="Load projection"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total Deposited</p>
          <p className="text-lg font-bold text-[#303549] mt-0.5">${formatUSD(position.totalDepositedUsd)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total PnL</p>
          <p className={`text-lg font-bold mt-0.5 ${position.totalPnlUsd >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {position.totalPnlUsd >= 0 ? "+" : ""}${formatUSD(position.totalPnlUsd)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Vaults</p>
          <p className="text-lg font-bold text-[#303549] mt-0.5">{position.positions.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Avg APY</p>
          <p className="text-lg font-bold text-[#303549] mt-0.5">{(avgApy * 100).toFixed(2)}%</p>
        </div>
      </div>

      {/* Vaults table */}
      <div className="bg-white rounded-xl border border-gray-200 mb-5 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#303549]">
            {isSandbox ? "Vaults" : "Your Vaults"}
          </h2>
          {isSandbox && onPositionChange && (
            <button
              onClick={() => setVaultSearchOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-[#4F7FFA] hover:text-[#3a6ae8] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Vault
            </button>
          )}
        </div>

        {position.positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <svg width={36} height={36} viewBox="0 0 20 20" fill="none" className="opacity-30">
              <circle cx="10" cy="10" r="10" fill="#1E2B3A" />
              <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">M</text>
            </svg>
            <p className="text-sm text-gray-400">No vaults yet</p>
            {isSandbox && onPositionChange && (
              <button
                onClick={() => setVaultSearchOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#1E2B3A] text-white hover:bg-[#2a3f5a] transition-colors"
              >
                <Search className="w-3 h-3" />
                Search Morpho vaults
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-semibold">Vault</th>
                  <th className="text-left px-4 py-2 font-semibold">Asset</th>
                  <th className="text-left px-4 py-2 font-semibold">Chain</th>
                  <th className="text-right px-4 py-2 font-semibold">Deposited</th>
                  <th className="text-right px-4 py-2 font-semibold">Net APY</th>
                  {!isSandbox && <th className="text-right px-4 py-2 font-semibold">PnL</th>}
                  {isSandbox && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {position.positions.map((p) => (
                  <tr
                    key={`${p.vaultAddress}-${p.chainId}`}
                    className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-[#303549] text-xs">{p.vaultName}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-600">{p.assetSymbol}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] text-gray-400">{CHAIN_NAMES[p.chainId] || p.chainId}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editingVault === p.vaultAddress ? (
                        <form
                          className="flex items-center gap-1 justify-end"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = parseFloat(editAmount);
                            if (!isNaN(val) && val >= 0) handleUpdateAmount(p.vaultAddress, val);
                          }}
                        >
                          <span className="text-xs text-gray-400">$</span>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-24 h-6 text-xs text-right border border-gray-300 rounded px-1.5 focus:outline-none focus:border-[#4F7FFA]"
                            autoFocus
                            onBlur={() => {
                              const val = parseFloat(editAmount);
                              if (!isNaN(val) && val >= 0) handleUpdateAmount(p.vaultAddress, val);
                              else setEditingVault(null);
                            }}
                            onKeyDown={(e) => { if (e.key === "Escape") setEditingVault(null); }}
                          />
                        </form>
                      ) : (
                        <span
                          className={`text-xs font-medium text-[#303549] inline-flex items-center gap-1 ${isSandbox ? "cursor-pointer hover:text-[#4F7FFA] group" : ""}`}
                          onClick={() => {
                            if (isSandbox && onPositionChange) {
                              setEditingVault(p.vaultAddress);
                              setEditAmount(p.depositedUsd.toString());
                            }
                          }}
                        >
                          ${formatUSD(p.depositedUsd)}
                          {isSandbox && onPositionChange && (
                            <Pencil className="w-3 h-3 text-gray-300 group-hover:text-[#4F7FFA] transition-colors" />
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-medium text-emerald-600">{(p.netApy * 100).toFixed(2)}%</span>
                    </td>
                    {!isSandbox && (
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-medium ${p.pnlUsd >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {p.pnlUsd >= 0 ? "+" : ""}${formatUSD(p.pnlUsd)}
                        </span>
                      </td>
                    )}
                    {isSandbox && onPositionChange && (
                      <td className="px-1 py-2.5">
                        <button
                          onClick={() => handleRemoveVault(p.vaultAddress)}
                          className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fixed bottom Projection Timeline */}
      {position.positions.length > 0 && (
        <ProjectionTimelineWrapper
          isRunning={sim.isRunning}
          hasResult={!!sim.result}
          selectedDay={sim.selectedDay}
          onSave={() => setSaveModalOpen(true)}
          isSaving={isSaving}
          saveLabel={currentProjectionId ? "Save" : "Save as"}
          unsavedChanges={unsavedChanges}
          onLoad={session?.user ? () => setLoadModalOpen(true) : undefined}
          onAISummary={() => setAiSummaryModalOpen(true)}
          hasAISummary={!!aiSummary}
          emptyMessage="No simulation data"
          extraToolbarButtons={
            <>
              <button onClick={() => setActionsExpanded((v) => !v)} className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${actionsExpanded ? "bg-[#4F7FFA] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                <CalendarPlus className="w-3.5 h-3.5" />Actions
                {sim.config.scheduledActions.length > 0 && <span className={`text-[9px] rounded-full px-1 ${actionsExpanded ? "bg-white/20" : "bg-[#4F7FFA] text-white"}`}>{sim.config.scheduledActions.length}</span>}
              </button>
              <button onClick={() => setPriceRatesModalOpen(true)} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <SlidersHorizontal className="w-3.5 h-3.5" />Scenarios
                {(sim.config.priceScenarios.length + sim.config.rateScenarios.length) > 0 && <span className="text-[9px] bg-[#4F7FFA] text-white rounded-full px-1">{sim.config.priceScenarios.length + sim.config.rateScenarios.length}</span>}
              </button>
            </>
          }
        >
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mr-2">Duration</span>
              {DURATION_PRESETS.map((d) => (
                <button key={d} onClick={() => sim.updateDuration(d)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${sim.config.durationDays === d ? "bg-[#303549] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{d}d</button>
              ))}
            </div>
            {actionsExpanded && (
              <div className="mb-4 border border-gray-100 rounded-lg p-3">
                <MorphoActionScheduler vaults={position.positions} actions={sim.config.scheduledActions} durationDays={sim.config.durationDays} onAddAction={sim.addScheduledAction} onRemoveAction={sim.removeScheduledAction} />
              </div>
            )}
            {sim.config.rateScenarios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mr-1 self-center">Rates</span>
                {sim.config.rateScenarios.map((rs) => {
                  const vault = position.positions.find((p) => p.vaultAddress === rs.vaultAddress);
                  return (
                    <div key={rs.vaultAddress} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gray-50 border border-gray-200 text-[10px]">
                      <span className="text-gray-500">{vault?.vaultName || rs.vaultAddress.slice(0, 8)}</span>
                      <span className="font-medium text-[#303549]">{rs.mode === "fixed" ? `${(rs.startRate * 100).toFixed(1)}%` : rs.mode}</span>
                      <button onClick={() => sim.removeRateScenario(rs.vaultAddress)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  );
                })}
              </div>
            )}
            {sim.config.priceScenarios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mr-1 self-center">Prices</span>
                {sim.config.priceScenarios.map((ps) => (
                  <div key={ps.symbol} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gray-50 border border-gray-200 text-[10px]">
                    <span className="text-gray-500">{ps.symbol}</span>
                    <span className="font-medium text-[#303549]">{ps.mode}</span>
                    <button onClick={() => sim.removePriceScenario(ps.symbol)} className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <ProjectionChart result={adaptMorphoVaultsResult(sim.result!)} selectedDay={sim.selectedDay} onSelectDay={sim.setSelectedDay} />
          </div>
        </ProjectionTimelineWrapper>
      )}

      {/* Selected day detail */}
      {selectedSnapshot && (
        <div className="bg-white rounded-xl border border-gray-200 mb-5">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#303549]">
              Day {selectedSnapshot.day} Detail
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Net Worth</p>
                <p className="text-sm font-bold text-[#303549]">${formatUSD(selectedSnapshot.netWorthUsd)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Deposited</p>
                <p className="text-sm font-bold text-[#303549]">${formatUSD(selectedSnapshot.totalDepositedUsd)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">Interest Earned</p>
                <p className="text-sm font-bold text-emerald-600">+${formatUSD(selectedSnapshot.totalInterestEarnedUsd)}</p>
              </div>
            </div>
            {selectedSnapshot.vaults.length > 0 && (
              <div className="space-y-1.5">
                {selectedSnapshot.vaults.map((v) => (
                  <div key={v.vaultAddress} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <div>
                      <span className="text-xs font-medium text-[#303549]">{v.vaultName}</span>
                      <span className="text-[10px] text-gray-400 ml-2">{v.assetSymbol}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#303549]">${formatUSD(v.balanceUsd)}</span>
                      <span className="text-[10px] text-emerald-600">{(v.netApy * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedSnapshot.actionsExecuted.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Actions</p>
                {selectedSnapshot.actionsExecuted.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`font-semibold uppercase ${a.type === "deposit" ? "text-emerald-600" : "text-amber-600"}`}>
                      {a.type}
                    </span>
                    <span className="text-gray-500">${formatUSD(a.amount)}</span>
                    <span className={`text-[10px] ${a.status === "success" ? "text-green-500" : "text-red-400"}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {selectedSnapshot.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {selectedSnapshot.warnings.map((w, i) => (
                  <p key={i} className="text-[10px] text-amber-600">{w}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vault search overlay */}
      {vaultSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/20" onClick={() => setVaultSearchOpen(false)} />
          <div className="relative bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={vaultSearchQuery}
                onChange={(e) => handleVaultSearch(e.target.value)}
                placeholder="Search Morpho vaults..."
                className="flex-1 text-sm outline-none"
              />
              <button onClick={() => setVaultSearchOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Starting amount input */}
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Starting amount</span>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-gray-400">$</span>
                <input
                  type="number"
                  value={addVaultAmount}
                  onChange={(e) => setAddVaultAmount(e.target.value)}
                  className="w-24 h-7 text-xs text-right border border-gray-200 rounded-md px-2 focus:outline-none focus:border-[#4F7FFA] bg-white"
                  min="0"
                  step="100"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
                </div>
              ) : vaultSearchResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  No vaults found
                </div>
              ) : (
                vaultSearchResults.map((v, i) => {
                  const exists = position.positions.some(
                    (p) => p.vaultName === v.vaultName && p.chainId === v.chainId
                  );
                  return (
                    <button
                      key={`${v.vaultName}-${v.chainId}-${i}`}
                      onClick={() => {
                        if (exists) return;
                        const amt = parseFloat(addVaultAmount);
                        handleAddVault(v, isNaN(amt) || amt <= 0 ? 1000 : amt);
                      }}
                      disabled={exists}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        exists ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      <svg width={24} height={24} viewBox="0 0 20 20" fill="none" className="shrink-0">
                        <circle cx="10" cy="10" r="10" fill="#1E2B3A" />
                        <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">M</text>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[#303549] truncate">{v.vaultName}</span>
                          <span className="text-[10px] text-gray-400">{v.chainName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">{v.assetSymbol}</span>
                          <span className="text-[10px] text-emerald-600">{(v.netApy * 100).toFixed(2)}% APY</span>
                          <span className="text-[10px] text-gray-400">TVL ${formatUSD(v.tvlUsd)}</span>
                        </div>
                      </div>
                      {exists ? (
                        <span className="text-[10px] text-gray-400">Added</span>
                      ) : (
                        <Plus className="w-4 h-4 text-gray-300 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Price/Rates modal */}
      <MorphoPriceRatesModal
        isOpen={priceRatesModalOpen}
        onClose={() => setPriceRatesModalOpen(false)}
        durationDays={sim.config.durationDays}
        vaults={position.positions}
        priceScenarios={sim.config.priceScenarios}
        rateScenarios={sim.config.rateScenarios}
        onUpdatePriceScenario={sim.addPriceScenario}
        onRemovePriceScenario={sim.removePriceScenario}
        onUpdateRateScenario={sim.addRateScenario}
        onRemoveRateScenario={sim.removeRateScenario}
      />

      {/* AI Summary modal */}
      <AISummaryModal
        isOpen={aiSummaryModalOpen}
        onClose={() => setAiSummaryModalOpen(false)}
        existingSummary={aiSummary}
        onSave={handleSaveAISummary}
        buildRequest={buildSummaryRequest}
      />

      {/* Save modal */}
      <SaveProjectionModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSave}
        defaultName={currentProjectionName || generateDefaultName()}
        defaultDetails={currentProjectionDetails || ""}
        isSaving={isSaving}
      />

      {/* Load modal */}
      <LoadProjectionModal
        isOpen={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        projections={projections}
        isLoading={projectionsLoading}
        currentProjectionId={currentProjectionId}
        onLoad={handleLoadProjection}
        onDuplicate={(id) => duplicateProjection(id).then(() => listProjections("morpho"))}
        onDelete={(id) => removeProjection(id).then(() => listProjections("morpho"))}
      />
    </div>
  );
}
