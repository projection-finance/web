"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Switch } from "@/src/components/ui/switch";
import { Badge } from "@/src/components/ui/badge";
import { Separator } from "./ui/separator";
import { MdKeyboardDoubleArrowLeft } from "react-icons/md";
import { CgClose } from "react-icons/cg";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Check, ChevronDown, ChevronUp, Copy, DollarSign, FolderOpen, InfoIcon, Pencil, Save, Settings2, Share2, Sparkles } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import TokenIcon from "./ui/TokenIcon";
import {
  AavePositionData,
  ReserveAssetDataItem,
  BorrowedAssetDataItem,
  AssetDetails,
  SimAction,
  SimActionType,
  FormattedReserve,
} from "@/src/lib/aave/types";
import { useSimulation } from "@/src/hooks/useSimulation";
import { useTemporalSimulation } from "@/src/hooks/useTemporalSimulation";
import { formatQty, formatUSD, formatAPY, formatPercent } from "@/src/lib/format";
import ActionModal from "./simulation/ActionModal";
import ActionScheduler from "./simulation/ActionScheduler";
import ProjectionChart, { TimelineAction, MarketAssetInfo } from "./simulation/ProjectionChart";
import PriceRatesModal from "./simulation/PriceRatesModal";
import CollateralToggleModal from "./simulation/CollateralToggleModal";
import EmodeModal from "./simulation/EmodeModal";
import WalletSwitchModal from "./simulation/WalletSwitchModal";
import { getBorrowableAssetsInEMode } from "@/src/lib/aave/emode";
import { useProjections, ProjectionSummary } from "@/src/hooks/useProjections";
import { useSession, signIn } from "next-auth/react";
import { Input } from "@/src/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/dialog";
import SaveProjectionModal from "./simulation/SaveProjectionModal";
import LoadProjectionModal from "./simulation/LoadProjectionModal";
import CustomTokenModal, { CustomToken } from "./simulation/CustomTokenModal";
import { useUserSettings } from "@/src/hooks/useUserSettings";
import { usePlan } from "@/src/hooks/usePlan";
import { Zap, Coins, Search, X } from "lucide-react";
import AIPanel from "./simulation/AIPanel";
import AISummaryModal from "./simulation/AISummaryModal";
import ShareSummaryPrompt from "./simulation/ShareSummaryPrompt";
import { AISummaryData, AISummaryRequest, AIModel } from "@/src/lib/ai/types";
import { useAlgoScanner } from "@/src/hooks/useAlgoScanner";
import QuantityEditModal from "./simulation/QuantityEditModal";
import SwapModal from "./simulation/SwapModal";
import StressMobileViewer from "./simulation/StressMobileViewer";
import { useIsMobile } from "@/src/hooks/useIsMobile";
import NetworkBadge from "./NetworkBadge";
import { getNetworkById } from "@/src/lib/aave/networks";

interface DashboardProps {
  position: AavePositionData;
  isLoading: boolean;
  projectionId?: string;
  sessionId?: string;
  ensName?: string;
  networkId?: import("@/src/lib/aave/networks").NetworkId;
  onChangeWallet?: (address: string) => void;
  onClear?: () => void;
}


const PortfolioDashboard = ({ position, isLoading, projectionId, sessionId, ensName, networkId = "ETHEREUM_V3", onChangeWallet, onClear }: DashboardProps) => {
  const { data: session } = useSession();
  const { isFree, features } = usePlan();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Custom tokens (fetched early so enrichedPosition is ready for hooks) ──
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [customTokenModalOpen, setCustomTokenModalOpen] = useState(false);

  const fetchCustomTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/custom-tokens");
      if (res.ok) setCustomTokens(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (session?.user) fetchCustomTokens();
  }, [session?.user, fetchCustomTokens]);

  const handleAddCustomToken = async (token: Omit<CustomToken, "id">) => {
    const res = await fetch("/api/custom-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create");
    }
    await fetchCustomTokens();
  };

  const handleUpdateCustomToken = async (id: string, token: Partial<CustomToken>) => {
    const res = await fetch(`/api/custom-tokens/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update");
    }
    await fetchCustomTokens();
  };

  const handleDeleteCustomToken = async (id: string) => {
    await fetch(`/api/custom-tokens/${id}`, { method: "DELETE" });
    await fetchCustomTokens();
  };

  // ── Enriched position: inject custom tokens into availableAssets & formattedPoolReserves ──
  const RAY = "1000000000000000000000000000";

  const enrichedPosition = useMemo(() => {
    if (customTokens.length === 0) return position;

    const customAssets: AssetDetails[] = customTokens.map((ct) => ({
      symbol: ct.symbol,
      name: ct.name,
      priceInUSD: ct.priceInUSD,
      priceInMarketReferenceCurrency: ct.priceInUSD / position.marketReferenceCurrencyPriceInUSD,
      initialPriceInUSD: ct.priceInUSD,
      baseLTVasCollateral: ct.baseLTVasCollateral,
      reserveLiquidationThreshold: ct.reserveLiquidationThreshold,
      reserveFactor: ct.reserveFactor,
      usageAsCollateralEnabled: ct.usageAsCollateralEnabled,
      borrowingEnabled: ct.borrowingEnabled,
      isActive: true,
      isFrozen: false,
      isPaused: false,
      isNewlyAddedBySimUser: true,
      underlyingAsset: `custom-${ct.id}`,
      decimals: 18,
      walletBalance: 0,
      availableLiquidity: ct.availableLiquidity,
      supplyAPY: ct.supplyAPY,
      variableBorrowAPY: ct.variableBorrowAPY,
      liquidityIndex: 1e27,
      variableBorrowIndex: 1e27,
      liquidityRate: ct.supplyAPY * 1e27,
      variableBorrowRate: ct.variableBorrowAPY * 1e27,
    }));

    const customReserves: FormattedReserve[] = customTokens.map((ct) => ({
      symbol: ct.symbol,
      name: ct.name,
      underlyingAsset: `custom-${ct.id}`,
      decimals: 18,
      priceInUSD: ct.priceInUSD,
      priceInMarketReferenceCurrency: String(ct.priceInUSD / position.marketReferenceCurrencyPriceInUSD),
      baseLTVasCollateral: String(ct.baseLTVasCollateral),
      reserveLiquidationThreshold: String(ct.reserveLiquidationThreshold),
      reserveFactor: String(ct.reserveFactor),
      usageAsCollateralEnabled: ct.usageAsCollateralEnabled,
      borrowingEnabled: ct.borrowingEnabled,
      isActive: true,
      isFrozen: false,
      isPaused: false,
      liquidityIndex: RAY,
      variableBorrowIndex: RAY,
      liquidityRate: String(Math.round(ct.supplyAPY * 1e27)),
      variableBorrowRate: String(Math.round(ct.variableBorrowAPY * 1e27)),
      supplyAPY: String(ct.supplyAPY),
      variableBorrowAPY: String(ct.variableBorrowAPY),
      availableLiquidity: String(ct.availableLiquidity),
      totalDebt: "0",
      totalVariableDebt: "0",
      totalLiquidity: String(ct.availableLiquidity),
      lastUpdateTimestamp: Math.floor(Date.now() / 1000),
    }));

    return {
      ...position,
      availableAssets: [...position.availableAssets, ...customAssets],
      formattedPoolReserves: [...position.formattedPoolReserves, ...customReserves],
    };
  }, [position, customTokens]);

  const sim = useSimulation(enrichedPosition);
  const temporal = useTemporalSimulation(enrichedPosition, sim.currentSnapshot, Math.min(30, features.maxProjectionDays));
  const data = sim.currentSnapshot.healthFactorData;
  const { marketReferenceCurrencyPriceInUSD } = sim.currentSnapshot;

  // Side panel
  const toggleAnalysisModal = () => {
    const modal = document.getElementById("sideModal");
    if (modal) modal.classList.toggle("hidden");
  };

  // Open-source & free: no gating. Kept as a no-op so existing call sites stay inert.
  const openUpgrade = (feature: string) => { void feature; };

  // Count ALL actions (instant Day-0 + scheduled) against the shared free budget
  const instantActionsCount = sim.snapshots.length - 1;
  const totalActionsCount = instantActionsCount + temporal.config.scheduledActions.length;
  const actionsRemaining = Math.max(0, features.maxInstantActions - totalActionsCount);

  // Legacy projection: free user viewing a saved projection that exceeds their duration limit
  const isLegacyProjection = isFree && temporal.config.durationDays > features.maxProjectionDays;

  // User settings
  const { settings, update: updateSetting } = useUserSettings();

  // Scan Panel
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
  const algoScanner = useAlgoScanner(enrichedPosition);

  // Wallet switch modal
  const [walletSwitchModalOpen, setWalletSwitchModalOpen] = useState(false);

  // Confirmation modal for wallet switch when actions exist
  const [confirmSwitchModal, setConfirmSwitchModal] = useState<{
    isOpen: boolean;
    action: "switch" | "clear";
    address?: string;
    network?: import("@/src/lib/aave/networks").NetworkId;
  }>({ isOpen: false, action: "switch" });

  const hasAnyActions = sim.snapshots.length > 1 || temporal.config.scheduledActions.length > 0 || temporal.config.priceScenarios.length > 0 || temporal.config.rateScenarios.length > 0;

  const handleWalletSwitch = useCallback((addr: string, network: import("@/src/lib/aave/networks").NetworkId) => {
    if (hasAnyActions) {
      setConfirmSwitchModal({ isOpen: true, action: "switch", address: addr, network });
    } else {
      const params = new URLSearchParams({ wallet: addr });
      if (network && network !== "ETHEREUM_V3") params.set("network", network);
      router.push(`/?${params.toString()}`);
      if (onChangeWallet) onChangeWallet(addr);
    }
  }, [hasAnyActions, router, onChangeWallet]);

  const handleWalletClear = useCallback(() => {
    if (hasAnyActions) {
      setConfirmSwitchModal({ isOpen: true, action: "clear" });
    } else {
      if (onClear) onClear();
    }
  }, [hasAnyActions, onClear]);

  const confirmWalletAction = useCallback(() => {
    const { action, address, network } = confirmSwitchModal;
    setConfirmSwitchModal({ isOpen: false, action: "switch" });
    if (action === "switch" && address) {
      const params = new URLSearchParams({ wallet: address });
      if (network && network !== "ETHEREUM_V3") params.set("network", network);
      router.push(`/?${params.toString()}`);
      if (onChangeWallet) onChangeWallet(address);
    } else if (action === "clear") {
      if (onClear) onClear();
    }
  }, [confirmSwitchModal, router, onChangeWallet, onClear]);

  // Fetch favorite wallets to display label next to address
  const [favoriteWallets, setFavoriteWallets] = useState<Array<{ id: string; address: string; label: string }>>([]);
  useEffect(() => {
    if (!session?.user || !features.canSaveFavoriteWallets) return;
    fetch("/api/favorite-wallets")
      .then((r) => r.ok ? r.json() : [])
      .then(setFavoriteWallets)
      .catch((err) => { console.warn("[Portfolio] Favorite wallets fetch failed:", err.message); });
  }, [session?.user, features.canSaveFavoriteWallets]);

  const currentFavoriteLabel = useMemo(() => {
    return favoriteWallets.find(
      (w) => w.address.toLowerCase() === position.address.toLowerCase()
    )?.label ?? null;
  }, [favoriteWallets, position.address]);

  // Address copy state
  const [addressCopied, setAddressCopied] = useState(false);
  const handleCopyAddress = useCallback(() => {
    navigator.clipboard.writeText(position.address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  }, [position.address]);

  // Hide zero balance tokens toggle
  const [hideZeroBalance, setHideZeroBalance] = useState(true);

  // Projection timeline collapsed state
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);

  // Action modal state
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: SimActionType;
    asset: AssetDetails | null;
  }>({ isOpen: false, type: "supply", asset: null });

  // Collateral toggle modal state
  const [collateralModal, setCollateralModal] = useState<{
    isOpen: boolean;
    reserve: ReserveAssetDataItem | null;
  }>({ isOpen: false, reserve: null });

  // Swap modal state
  const [swapModal, setSwapModal] = useState<{
    isOpen: boolean;
    asset: AssetDetails | null;
    supplyBalance: number;
  }>({ isOpen: false, asset: null, supplyBalance: 0 });

  // E-Mode modal state
  const [emodeModalOpen, setEmodeModalOpen] = useState(false);

  // Price & Rates modal state
  const [priceRatesModalOpen, setPriceRatesModalOpen] = useState(false);

  const openPriceRatesModal = () => {
    setPriceRatesModalOpen(true);
  };

  // Quantity edit modal state
  const [quantityEditModal, setQuantityEditModal] = useState<{
    isOpen: boolean;
    symbol: string;
    currentBalance: number;
    currentBalanceUSD: number;
    priceUSD: number;
  } | null>(null);

  // ── Projections save/load/autosave ──
  const {
    projections, isLoading: projectionsLoading,
    list: listProjections, save: saveProjection,
    load: loadProjection, update: updateProjection,
    duplicate: duplicateProjection, remove: removeProjection,
  } = useProjections();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareSummaryPromptOpen, setShareSummaryPromptOpen] = useState(false);
  const [aiSummaryModalOpen, setAiSummaryModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummaryData | null>(null);

  // Current projection tracking
  const [currentProjectionId, setCurrentProjectionId] = useState<string | null>(null);
  const [currentProjectionName, setCurrentProjectionName] = useState<string | null>(null);
  const [currentProjectionDetails, setCurrentProjectionDetails] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(0);
  const lastSavedConfigRef = useRef<string>("");

  // Track config changes for unsaved changes counter
  const configFingerprint = useMemo(
    () => JSON.stringify({
      d: temporal.config.durationDays,
      p: temporal.config.priceScenarios,
      r: temporal.config.rateScenarios,
      a: temporal.config.scheduledActions,
      s: sim.snapshots.length,
      ss: temporal.config.scenarioSets,
      as: temporal.config.activeScenarioSetId,
    }),
    [temporal.config, sim.snapshots.length]
  );

  useEffect(() => {
    if (!lastSavedConfigRef.current) {
      lastSavedConfigRef.current = configFingerprint;
      return;
    }
    if (configFingerprint !== lastSavedConfigRef.current) {
      setUnsavedChanges((c) => c + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configFingerprint]);

  // Auto-save debounce
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!autoSave || !currentProjectionId || !session?.user || unsavedChanges === 0) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await updateProjection(currentProjectionId, {
          config: temporal.config,
          snapshots: sim.snapshots.length > 1 ? sim.snapshots : undefined,
        });
        lastSavedConfigRef.current = configFingerprint;
        setUnsavedChanges(0);
      } catch { /* silent */ }
    }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, currentProjectionId, configFingerprint, session?.user]);

  // Generate default projection name
  const generateDefaultName = useCallback(() => {
    const walletLabel = ensName || (position.address.slice(0, 6) + "..." + position.address.slice(-4));
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const networkLabel = getNetworkById(networkId)?.name ?? "Ethereum";
    return `${walletLabel} - Aave V3 (${networkLabel}) · ${date} · ${temporal.config.durationDays}d`;
  }, [position.address, ensName, networkId, temporal.config.durationDays]);

  // Build AI Summary request from current simulation state
  const buildSummaryRequest = useCallback((language: string, model?: AIModel): AISummaryRequest => {
    const r = temporal.result;
    const config = temporal.config;
    const day0 = r?.timeline[0];
    const dayN = r?.timeline[r.timeline.length - 1];

    return {
      type: "aave",
      language,
      model,
      network: networkId,
      address: position.address,
      ensName: ensName || undefined,
      durationDays: config.durationDays,
      simulationSummary: r?.summary,
      startState: day0 ? {
        healthFactor: day0.healthFactor,
        totalCollateralUSD: day0.totalCollateralUSD,
        totalBorrowsUSD: day0.totalBorrowsUSD,
        netWorthUSD: day0.netWorthUSD,
        supplies: day0.supplies.filter((s) => s.balance > 0).map((s) => ({
          symbol: s.symbol, balanceUSD: s.balanceUSD, supplyAPY: s.supplyAPY,
        })),
        borrows: day0.borrows.filter((b) => b.debt > 0).map((b) => ({
          symbol: b.symbol, debtUSD: b.debtUSD, borrowAPY: b.borrowAPY,
        })),
      } : undefined,
      endState: dayN ? {
        healthFactor: dayN.healthFactor,
        totalCollateralUSD: dayN.totalCollateralUSD,
        totalBorrowsUSD: dayN.totalBorrowsUSD,
        netWorthUSD: dayN.netWorthUSD,
        supplies: dayN.supplies.filter((s) => s.balance > 0).map((s) => ({
          symbol: s.symbol, balanceUSD: s.balanceUSD, supplyAPY: s.supplyAPY,
        })),
        borrows: dayN.borrows.filter((b) => b.debt > 0).map((b) => ({
          symbol: b.symbol, debtUSD: b.debtUSD, borrowAPY: b.borrowAPY,
        })),
      } : undefined,
      actions: config.scheduledActions.map((a) => ({
        day: a.day, type: a.type, symbol: a.symbol, amount: a.amount,
      })),
      priceChanges: config.priceScenarios.map((p) => ({
        symbol: p.symbol, mode: p.mode, startPrice: p.startPrice, endPrice: p.endPrice,
      })),
      rateChanges: config.rateScenarios.map((r) => ({
        symbol: r.symbol, rateType: r.rateType, mode: r.mode, startRate: r.startRate, endRate: r.endRate,
      })),
    };
  }, [temporal.result, temporal.config, networkId, position.address, ensName]);

  // Handle share with optional AI summary
  const handleShareWithSummary = useCallback(async (summaryToInclude: AISummaryData | null) => {
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: position.address,
          network: networkId,
          name: currentProjectionName || generateDefaultName(),
          details: currentProjectionDetails || undefined,
          config: temporal.config,
          aiSummary: summaryToInclude,
        }),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();
      await navigator.clipboard.writeText(data.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch { /* silent */ }
    finally { setShareLoading(false); }
  }, [position.address, networkId, currentProjectionName, currentProjectionDetails, temporal.config, generateDefaultName]);

  // Save AI summary to current projection
  const handleSaveAISummary = useCallback(async (summary: AISummaryData) => {
    setAiSummary(summary);
    if (currentProjectionId) {
      try {
        await updateProjection(currentProjectionId, { aiSummary: summary });
      } catch { /* silent */ }
    }
  }, [currentProjectionId, updateProjection]);

  useEffect(() => {
    if (session?.user) listProjections("aave");
  }, [session?.user, listProjections]);

  // Restore pending save after sign-in redirect
  useEffect(() => {
    if (!session?.user) return;
    const pending = localStorage.getItem("pendingProjection");
    if (!pending) return;
    localStorage.removeItem("pendingProjection");
    try {
      const { name, address, config, snapshots } = JSON.parse(pending);
      if (config) {
        temporal.loadConfig(config);
      }
      saveProjection(name, config, { address, type: "aave", snapshots }).then((created) => {
        setCurrentProjectionId(created.id);
        setCurrentProjectionName(created.name);
        setCurrentProjectionDetails(created.details ?? null);
        lastSavedConfigRef.current = configFingerprint;
        setUnsavedChanges(0);
      });
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  // Auto-load from URL param
  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (!projectionId || hasAutoLoaded.current || !session?.user) return;
    hasAutoLoaded.current = true;
    loadProjection(projectionId).then((full) => {
      setCurrentProjectionId(full.id);
      setCurrentProjectionName(full.name);
      setCurrentProjectionDetails(full.details ?? null);
      if (full.config) {
        temporal.loadConfig(full.config);
        temporal.run();
      }
      lastSavedConfigRef.current = JSON.stringify({
        d: full.config.durationDays,
        p: full.config.priceScenarios,
        r: full.config.rateScenarios,
        a: full.config.scheduledActions,
        s: sim.snapshots.length,
        ss: full.config.scenarioSets,
        as: full.config.activeScenarioSetId,
      });
      setUnsavedChanges(0);
    }).catch((err) => { console.error("[Portfolio] Failed to load projection:", err.message); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectionId, session?.user]);

  // ── Local autosave (pro only, localStorage) ──
  // Persists simulation state so it survives page refresh / tab close.
  // Uses a session ID (sid) in the URL so the state can be restored on return.
  const [activeSid, setActiveSid] = useState<string | null>(sessionId ?? null);
  const hasRestoredAutosave = useRef(false);

  const getAutosaveKey = (sid: string) => `pf-autosave-${sid}`;

  // Generate a short session ID
  const generateSid = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  };

  // Push sid to URL without full navigation
  const pushSidToUrl = useCallback((sid: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sid", sid);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Build the autosave payload
  const buildAutosavePayload = useCallback(() => {
    return JSON.stringify({
      v: 1,
      ts: Date.now(),
      wallet: position.address,
      config: temporal.config,
      snapshots: sim.snapshots.length > 1 ? sim.snapshots : null,
    });
  }, [temporal.config, sim.snapshots, position.address]);

  // Restore autosave on mount (only if pro, sid exists, no projectionId, no stress param)
  useEffect(() => {
    if (hasRestoredAutosave.current) return;
    if (projectionId) return; // explicit projection takes priority
    if (searchParams.get("stress")) return; // stress test takes priority
    if (!features.canAutoSave) return;
    if (!activeSid) return;
    hasRestoredAutosave.current = true;

    try {
      const raw = localStorage.getItem(getAutosaveKey(activeSid));
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data?.config) return;

      // Only restore if less than 7 days old
      if (data.ts && Date.now() - data.ts > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(getAutosaveKey(activeSid));
        return;
      }

      temporal.loadConfig(data.config);
    } catch { /* corrupted data, ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSid, projectionId, features.canAutoSave]);

  // Debounce-save to localStorage on changes (pro only)
  // Also creates a sid and pushes to URL on first change
  const autosaveLocalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEverChanged = sim.snapshots.length > 1 ||
    temporal.config.priceScenarios.length > 0 ||
    temporal.config.rateScenarios.length > 0 ||
    temporal.config.scheduledActions.length > 0 ||
    (temporal.config.scenarioSets?.length ?? 0) > 1;

  useEffect(() => {
    if (!features.canAutoSave) return;
    if (!hasEverChanged) return;

    // Generate sid on first meaningful change
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

  // Save on page unload (pro only)
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

  // ── Pre-load price scenarios from ?stress= URL param (from Radar stress test) ──
  // Prices evolve linearly: D0 = current price → D7 = stressed price
  const hasAppliedStress = useRef(false);
  useEffect(() => {
    if (hasAppliedStress.current) return;
    const stressParam = searchParams.get("stress");
    if (!stressParam) return;
    if (!enrichedPosition.availableAssets.length) return;
    hasAppliedStress.current = true;

    const rampDays = 7;   // linear descent
    const holdDays = 3;   // hold at stressed price (see aftermath)
    const totalDays = rampDays + holdDays;
    const pairs = stressParam.split(",").map((p) => p.trim()).filter(Boolean);
    const scenarios: import("@/src/lib/simulation/types").PriceScenario[] = [];
    for (const pair of pairs) {
      const [symbol, pctStr] = pair.split(":");
      if (!symbol || !pctStr) continue;
      const pct = Number(pctStr);
      if (isNaN(pct)) continue;
      const asset = enrichedPosition.availableAssets.find((a: { symbol: string }) => a.symbol === symbol);
      if (!asset) continue;
      const currentPrice = asset.priceInUSD;
      const stressedPrice = currentPrice * (1 + pct / 100);
      // D0→D7: linear descent, D8→D10: hold at stressed price
      const manualPrices: number[] = [];
      for (let d = 0; d <= totalDays; d++) {
        if (d <= rampDays) {
          manualPrices.push(currentPrice + (stressedPrice - currentPrice) * (d / rampDays));
        } else {
          manualPrices.push(stressedPrice);
        }
      }
      scenarios.push({
        symbol,
        mode: "manual",
        startPrice: currentPrice,
        endPrice: stressedPrice,
        manualPrices,
        originalPrice: currentPrice,
      });
    }
    if (scenarios.length > 0) {
      temporal.loadConfigAndRun({
        ...temporal.config,
        durationDays: totalDays,
        priceScenarios: scenarios,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, enrichedPosition.availableAssets]);

  const handleSaveClick = () => {
    if (!features.canSaveProjections) {
      openUpgrade("cloud saves");
      return;
    }
    if (!session?.user) {
      setSignInPromptOpen(true);
      return;
    }
    setSaveModalOpen(true);
  };

  const handleSignInForSave = (provider: string) => {
    const pendingData = {
      name: generateDefaultName(),
      address: position.address,
      network: networkId,
      config: temporal.config,
      snapshots: sim.snapshots.length > 1 ? sim.snapshots : null,
    };
    localStorage.setItem("pendingProjection", JSON.stringify(pendingData));
    signIn(provider, { callbackUrl: `/?wallet=${encodeURIComponent(position.address)}` });
  };

  const handleSaveFromModal = async (name: string, details: string) => {
    setIsSaving(true);
    try {
      if (currentProjectionId) {
        await updateProjection(currentProjectionId, {
          name,
          details: details || null,
          config: temporal.config,
          snapshots: sim.snapshots.length > 1 ? sim.snapshots : undefined,
        });
        setCurrentProjectionName(name);
        setCurrentProjectionDetails(details || null);
      } else {
        const created = await saveProjection(
          name,
          temporal.config,
          {
            address: position.address,
            network: networkId,
            type: "aave",
            snapshots: sim.snapshots.length > 1 ? sim.snapshots : undefined,
            details: details || undefined,
          }
        );
        setCurrentProjectionId(created.id);
        setCurrentProjectionName(created.name);
        setCurrentProjectionDetails(details || null);
      }
      lastSavedConfigRef.current = configFingerprint;
      setUnsavedChanges(0);
      setSaveModalOpen(false);
    } catch { /* silent */ }
    finally { setIsSaving(false); }
  };

  const handleLoadProjection = async (p: ProjectionSummary) => {
    try {
      const full = await loadProjection(p.id);
      setCurrentProjectionId(full.id);
      setCurrentProjectionName(full.name);
      setCurrentProjectionDetails(full.details ?? null);
      setAiSummary(full.aiSummary ?? null);
      if (full.config) {
        temporal.loadConfig(full.config);
        temporal.run();
      }
      lastSavedConfigRef.current = JSON.stringify({
        d: full.config.durationDays,
        p: full.config.priceScenarios,
        r: full.config.rateScenarios,
        a: full.config.scheduledActions,
        s: sim.snapshots.length,
        ss: full.config.scenarioSets,
        as: full.config.activeScenarioSetId,
      });
      setUnsavedChanges(0);
    } catch { /* silent */ }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const created = await duplicateProjection(id);
      setCurrentProjectionId(created.id);
      setCurrentProjectionName(created.name);
      setCurrentProjectionDetails(created.details ?? null);
      lastSavedConfigRef.current = configFingerprint;
      setUnsavedChanges(0);
    } catch { /* silent */ }
  };

  const openActionModal = (type: SimActionType, asset: AssetDetails) => {
    // Gate: liquidation state — block all new actions except price_change and set_wallet_balance (to fix the situation)
    if (isLiquidatedRef.current && type !== "price_change" && type !== "set_wallet_balance") {
      return; // silently block — the liquidation banner explains why
    }
    // Gate: legacy projection from a past Pro subscription — read-only
    if (isLegacyProjection) {
      openUpgrade("editing this projection (duration exceeds free limit)");
      return;
    }
    // Gate: if free user has no actions remaining, show upgrade directly
    if (isFree && totalActionsCount >= features.maxInstantActions) {
      openUpgrade("unlimited actions");
      return;
    }
    setActionModal({ isOpen: true, type, asset });
  };

  // Derived values
  const totalCollateralUSD = useMemo(
    () =>
      data.totalCollateralMarketReferenceCurrency *
      marketReferenceCurrencyPriceInUSD,
    [data.totalCollateralMarketReferenceCurrency, marketReferenceCurrencyPriceInUSD]
  );

  const netWorth = useMemo(
    () => totalCollateralUSD - data.totalBorrowsUSD,
    [totalCollateralUSD, data.totalBorrowsUSD]
  );


  const netAPY = useMemo(() => {
    if (netWorth <= 0) return 0;
    const supplyIncome = data.userReservesData.reduce(
      (sum: number, r: ReserveAssetDataItem) =>
        sum + r.underlyingBalanceUSD * (r.asset.supplyAPY || 0),
      0
    );
    const borrowCost = data.userBorrowsData.reduce(
      (sum: number, b: BorrowedAssetDataItem) =>
        sum + b.totalBorrowsUSD * (b.asset.variableBorrowAPY || 0),
      0
    );
    return (supplyIncome - borrowCost) / netWorth;
  }, [data.userReservesData, data.userBorrowsData, netWorth]);

  // Simulated wallet balances from the current snapshot
  const walletBalances = sim.currentSnapshot.walletBalances;

  const currentEmodeCategoryId = sim.currentSnapshot.userEmodeCategoryId;

  const assetsToBorrow = useMemo(() => {
    const allBorrowable = enrichedPosition.availableAssets.filter(
      (a: AssetDetails) =>
        a.isActive && !a.isFrozen && !a.isPaused && a.borrowingEnabled
    );

    // When E-Mode is active, restrict to borrowable assets in that category
    if (currentEmodeCategoryId !== 0 && enrichedPosition.emodeCategories.length > 0) {
      const emodeBorrowable = getBorrowableAssetsInEMode(
        currentEmodeCategoryId,
        enrichedPosition.emodeCategories
      );
      if (emodeBorrowable.length > 0) {
        return allBorrowable.filter((a) =>
          emodeBorrowable.includes(a.underlyingAsset ?? "")
        );
      }
    }

    return allBorrowable;
  }, [enrichedPosition.availableAssets, enrichedPosition.emodeCategories, currentEmodeCategoryId]);

  // Simulation state for ActionModal HF projection
  const simulationStateForPreview = useMemo(() => ({
    rawUserReserves: sim.currentSnapshot.rawUserReserves,
    formattedPoolReserves: sim.currentSnapshot.formattedPoolReserves,
    baseCurrencyData: enrichedPosition.baseCurrencyData,
    userEmodeCategoryId: sim.currentSnapshot.userEmodeCategoryId,
    marketReferenceCurrencyPriceInUSD: sim.currentSnapshot.marketReferenceCurrencyPriceInUSD,
  }), [sim.currentSnapshot, enrichedPosition.baseCurrencyData]);

  // All actions are now scheduled (minimum Day 1)
  // Day 0 is reserved as the baseline for comparison
  // Gating is handled upstream in openActionModal — by the time we reach here,
  // the user is within their budget.
  const handleExecuteAction = useCallback(
    (action: SimAction) => {
      // Default to Day 1 if no day selected, minimum Day 1
      const day = Math.max(1, temporal.selectedDay ?? 1);

      // Keep the timeline cursor on (or after) the action we're adding so the
      // chronological-ordering gate (canAddAction) stays satisfied. Otherwise the
      // cursor stays at day 0 while the first action lands on day 1, which would
      // immediately disable all action buttons (e.g. Supply right after setting a
      // wallet balance in an empty sandbox).
      if ((temporal.selectedDay ?? 0) < day) {
        temporal.setSelectedDay(day);
      }

      if (action.type === "set_emode") {
        temporal.addScheduledAction({
          day,
          orderInDay: temporal.config.scheduledActions.filter((a) => a.day === day).length,
          type: "set_emode",
          symbol: action.symbol,
          amount: 0,
          emodeCategoryId: action.newEmodeCategoryId,
        });
      } else if (action.type === "set_wallet_balance") {
        temporal.addScheduledAction({
          day,
          orderInDay: temporal.config.scheduledActions.filter((a) => a.day === day).length,
          type: "set_wallet_balance",
          symbol: action.symbol,
          amount: action.amount ?? 0,
        });
      } else {
        const actionType = action.type as "supply" | "borrow" | "repay" | "withdraw";
        if (["supply", "borrow", "repay", "withdraw"].includes(actionType)) {
          temporal.addScheduledAction({
            day,
            orderInDay: temporal.config.scheduledActions.filter((a) => a.day === day).length,
            type: actionType,
            symbol: action.symbol,
            amount: action.amount ?? 0,
            useAsCollateral: action.useAsCollateral,
            repayFromCollateral: action.repayFromCollateral,
          });
        }
      }
    },
    [temporal.selectedDay, temporal.setSelectedDay, temporal.addScheduledAction, temporal.config.scheduledActions]
  );

  // Build timeline actions: scheduled (Day 1+) + price/rate scenarios
  const timelineActions = useMemo((): TimelineAction[] => {
    const scheduled: TimelineAction[] = temporal.config.scheduledActions.map((a) => ({
      day: a.day,
      label: a.type === "set_emode"
        ? (a.emodeCategoryId === 0 ? "Disable E-Mode" : `E-Mode ${a.symbol}`)
        : a.type === "set_wallet_balance"
        ? `Set ${a.symbol} wallet to ${a.amount}`
        : `${a.type.charAt(0).toUpperCase() + a.type.slice(1)} ${a.amount} ${a.symbol}`,
      type: a.type,
    }));
    const priceActions: TimelineAction[] = temporal.config.priceScenarios.map((s) => {
      const targetPrice = s.endPrice ?? s.startPrice;
      // For progressive scenarios (linear/manual), show at the day the target is reached
      // For manual mode with stress test: ramp ends when price first hits endPrice
      const manualTargetDay = s.manualPrices?.findIndex((p) => Math.abs(p - (s.endPrice ?? s.startPrice)) < 0.01);
      const displayDay = s.mode === "manual" && manualTargetDay && manualTargetDay > 0
        ? manualTargetDay
        : s.mode === "linear"
        ? temporal.config.durationDays
        : (s.fromDay ?? 0);
      return {
        day: displayDay,
        label: `${s.symbol} \u2192 $${formatUSD(targetPrice)}`,
        type: "price_change",
      };
    });
    const rateActions: TimelineAction[] = temporal.config.rateScenarios.map((s) => ({
      day: s.fromDay ?? 0,
      label: `${s.symbol} ${s.rateType} APY \u2192 ${(s.startRate * 100).toFixed(1)}%`,
      type: "rate_change",
    }));
    return [...scheduled, ...priceActions, ...rateActions];
  }, [temporal.config.scheduledActions, temporal.config.priceScenarios, temporal.config.rateScenarios]);

  // Enforce chronological ordering: new actions only allowed after the last action day
  const lastActionDay = useMemo(() => {
    const scheduledDays = temporal.config.scheduledActions.map((a) => a.day);
    const hasInstant = sim.snapshots.length > 1;
    if (scheduledDays.length > 0) return Math.max(...scheduledDays);
    if (hasInstant) return 0;
    return -1; // no actions yet
  }, [temporal.config.scheduledActions, sim.snapshots.length]);

  const canAddAction =
    lastActionDay < 0 // no actions yet → always allowed
    || (temporal.selectedDay ?? 0) >= lastActionDay;

  // ─── Unified display state ───
  // Single source of truth for ALL display values.
  // Derives everything from either the projected DaySnapshot (when a day is selected)
  // or the current sim snapshot (baseline). Adding a new action type or display field
  // only requires changes HERE — no scattered variables.

  // Use the active scenario set's result if available, otherwise fall back to the default result
  const activeScenarioResult = useMemo(() => {
    const activeId = temporal.config.activeScenarioSetId ?? temporal.config.scenarioSets?.[0]?.id;
    if (activeId && temporal.scenarioResults.size > 0) {
      return temporal.scenarioResults.get(activeId) ?? temporal.result;
    }
    return temporal.result;
  }, [temporal.scenarioResults, temporal.config.activeScenarioSetId, temporal.config.scenarioSets, temporal.result]);

  const projectedSnap =
    temporal.selectedDay !== null && activeScenarioResult
      ? activeScenarioResult.timeline[temporal.selectedDay] ?? null
      : null;

  interface SupplyRow {
    symbol: string;
    balance: number;
    balanceUSD: number;
    priceInUSD: number;
    supplyAPY: number;
    collateralEnabled: boolean;
    asset: AssetDetails | null;
    originalReserve: ReserveAssetDataItem | null;
  }

  interface BorrowRow {
    symbol: string;
    debt: number;
    debtUSD: number;
    priceInUSD: number;
    borrowAPY: number;
    asset: AssetDetails | null;
  }

  interface DisplayState {
    healthFactor: number;
    netWorth: number;
    totalCollateral: number;
    totalBorrows: number;
    availableBorrows: number;
    ltv: number;
    netAPY: number;
    supplies: SupplyRow[];
    borrows: BorrowRow[];
    supplyBalanceUSD: number;
    collateralUSD: number;
    borrowPowerUsed: number;
    walletBalances: Record<string, number>;
    effectivePrices: Record<string, number>;
    effectiveRates: Record<string, { supplyAPY: number; variableBorrowAPY: number }>;
  }

  const display = useMemo((): DisplayState => {
    // ── Wallet balances: start from base, apply all action effects ──
    const wb: Record<string, number> = { ...walletBalances };
    // Instant actions (day 0) — already reflected in sim.currentSnapshot position data
    // but NOT in chain wallet balances, so apply them too
    for (const snap of sim.snapshots.slice(1)) {
      if (!snap.action) continue;
      const { type, symbol, amount } = snap.action;
      const cur = wb[symbol] ?? 0;
      if (type === "supply") wb[symbol] = Math.max(0, cur - (amount ?? 0));
      else if (type === "borrow") wb[symbol] = cur + (amount ?? 0);
      else if (type === "repay" && !snap.action.repayFromCollateral)
        wb[symbol] = Math.max(0, cur - (amount ?? 0));
      else if (type === "withdraw") wb[symbol] = cur + (amount ?? 0);
    }
    // Scheduled actions up to selected day
    if (temporal.selectedDay !== null) {
      for (const action of temporal.config.scheduledActions) {
        if (action.day > temporal.selectedDay) continue;
        const cur = wb[action.symbol] ?? 0;
        if (action.type === "supply") wb[action.symbol] = Math.max(0, cur - action.amount);
        else if (action.type === "borrow") wb[action.symbol] = cur + action.amount;
        else if (action.type === "repay" && !action.repayFromCollateral)
          wb[action.symbol] = Math.max(0, cur - action.amount);
        else if (action.type === "withdraw") wb[action.symbol] = cur + action.amount;
        else if (action.type === "set_wallet_balance") wb[action.symbol] = action.amount;
      }
    }

    // ── If we have a projected day snapshot, derive everything from it ──
    if (projectedSnap) {
      const supplies: SupplyRow[] = projectedSnap.supplies
        .filter((s) => s.balance > 0)
        .map((s) => {
          const asset = enrichedPosition.availableAssets.find((a: AssetDetails) => a.symbol === s.symbol);
          const reserve = data.userReservesData.find((r: ReserveAssetDataItem) => r.asset.symbol === s.symbol);
          return {
            symbol: s.symbol,
            balance: s.balance,
            balanceUSD: s.balanceUSD,
            priceInUSD: s.balance > 0 ? s.balanceUSD / s.balance : (asset?.priceInUSD ?? 0),
            supplyAPY: s.supplyAPY,
            collateralEnabled: reserve?.usageAsCollateralEnabledOnUser ?? true,
            asset: asset ?? null,
            originalReserve: reserve ?? null,
          };
        });

      const borrows: BorrowRow[] = projectedSnap.borrows
        .filter((b) => b.debt > 0)
        .map((b) => {
          const asset = enrichedPosition.availableAssets.find((a: AssetDetails) => a.symbol === b.symbol);
          return {
            symbol: b.symbol,
            debt: b.debt,
            debtUSD: b.debtUSD,
            priceInUSD: b.debt > 0 ? b.debtUSD / b.debt : (asset?.priceInUSD ?? 0),
            borrowAPY: b.borrowAPY,
            asset: asset ?? null,
          };
        });

      const supplyBalanceUSD = supplies.reduce((sum, s) => sum + s.balanceUSD, 0);
      const collateralUSD = supplies.filter((s) => s.collateralEnabled).reduce((sum, s) => sum + s.balanceUSD, 0);
      const maxBorrow = projectedSnap.totalBorrowsUSD + projectedSnap.availableBorrowsUSD;
      const borrowPowerUsed = maxBorrow > 0 ? projectedSnap.totalBorrowsUSD / maxBorrow : 0;
      const nw = projectedSnap.netWorthUSD;
      const supplyIncome = projectedSnap.supplies.reduce((sum, s) => sum + s.balanceUSD * ((s.supplyAPY || 0) + (s.incentiveAPR || 0)), 0);
      const borrowCost = projectedSnap.borrows.reduce((sum, b) => sum + b.debtUSD * ((b.borrowAPY || 0) - (b.incentiveAPR || 0)), 0);

      // Build effective prices from the projected snapshot
      const ep: Record<string, number> = {};
      for (const p of projectedSnap.prices) {
        ep[p.symbol] = p.priceUSD;
      }

      // Build effective rates from the projected snapshot
      const er: Record<string, { supplyAPY: number; variableBorrowAPY: number }> = {};
      for (const r of projectedSnap.rates) {
        er[r.symbol] = { supplyAPY: r.supplyAPY, variableBorrowAPY: r.variableBorrowAPY };
      }

      return {
        healthFactor: projectedSnap.healthFactor,
        netWorth: nw,
        totalCollateral: projectedSnap.totalCollateralUSD,
        totalBorrows: projectedSnap.totalBorrowsUSD,
        availableBorrows: projectedSnap.availableBorrowsUSD,
        ltv: projectedSnap.currentLTV,
        netAPY: nw > 0 ? (supplyIncome - borrowCost) / nw : 0,
        supplies,
        borrows,
        supplyBalanceUSD,
        collateralUSD,
        borrowPowerUsed,
        walletBalances: wb,
        effectivePrices: ep,
        effectiveRates: er,
      };
    }

    // ── Baseline: derive from current sim snapshot ──
    const supplies: SupplyRow[] = data.userReservesData.map((r: ReserveAssetDataItem) => ({
      symbol: r.asset.symbol,
      balance: r.underlyingBalance,
      balanceUSD: r.underlyingBalanceUSD,
      priceInUSD: r.asset.priceInUSD,
      supplyAPY: r.asset.supplyAPY ?? 0,
      collateralEnabled: r.usageAsCollateralEnabledOnUser,
      asset: r.asset as AssetDetails | null,
      originalReserve: r as ReserveAssetDataItem | null,
    }));

    const borrows: BorrowRow[] = data.userBorrowsData.map((b: BorrowedAssetDataItem) => ({
      symbol: b.asset.symbol,
      debt: b.totalBorrows,
      debtUSD: b.totalBorrowsUSD,
      priceInUSD: b.asset.priceInUSD,
      borrowAPY: b.asset.variableBorrowAPY ?? 0,
      asset: b.asset as AssetDetails | null,
    }));

    const supplyBalanceUSD = supplies.reduce((sum, s) => sum + s.balanceUSD, 0);
    const collateralUSD = supplies.filter((s) => s.collateralEnabled).reduce((sum, s) => sum + s.balanceUSD, 0);
    const maxBorrow = data.totalBorrowsUSD + data.availableBorrowsUSD;
    const borrowPowerUsed = maxBorrow > 0 ? data.totalBorrowsUSD / maxBorrow : 0;

    // Build effective prices: start from sim snapshot (reflects instant price_change actions),
    // then override with price scenarios at day 0
    const ep: Record<string, number> = {};
    for (const r of sim.currentSnapshot.formattedPoolReserves) {
      if (r.symbol && r.priceInUSD != null) {
        ep[r.symbol] = Number(r.priceInUSD);
      }
    }
    for (const ps of temporal.config.priceScenarios) {
      if ((ps.fromDay ?? 0) === 0) {
        ep[ps.symbol] = ps.startPrice;
      }
    }

    // Build effective rates: start from sim snapshot, then override with rate scenarios at day 0
    const er: Record<string, { supplyAPY: number; variableBorrowAPY: number }> = {};
    for (const r of sim.currentSnapshot.formattedPoolReserves) {
      if (r.symbol) {
        er[r.symbol] = {
          supplyAPY: Number(r.supplyAPY ?? 0),
          variableBorrowAPY: Number(r.variableBorrowAPY ?? 0),
        };
      }
    }
    for (const rs of temporal.config.rateScenarios) {
      if ((rs.fromDay ?? 0) === 0) {
        if (!er[rs.symbol]) er[rs.symbol] = { supplyAPY: 0, variableBorrowAPY: 0 };
        if (rs.rateType === "supply") er[rs.symbol].supplyAPY = rs.startRate;
        else er[rs.symbol].variableBorrowAPY = rs.startRate;
      }
    }

    return {
      healthFactor: data.healthFactor,
      netWorth: netWorth,
      totalCollateral: totalCollateralUSD,
      totalBorrows: data.totalBorrowsUSD,
      availableBorrows: data.availableBorrowsUSD,
      ltv: data.currentLoanToValue,
      netAPY: netAPY,
      supplies,
      borrows,
      supplyBalanceUSD,
      collateralUSD,
      borrowPowerUsed,
      walletBalances: wb,
      effectivePrices: ep,
      effectiveRates: er,
    };
  }, [
    projectedSnap, data, enrichedPosition.availableAssets, walletBalances,
    sim.snapshots, temporal.selectedDay, temporal.config.scheduledActions,
    temporal.config.priceScenarios, temporal.config.rateScenarios,
    sim.currentSnapshot.formattedPoolReserves,
    netWorth, totalCollateralUSD, netAPY,
  ]);

  // Compute incentive APRs for the PriceRatesModal
  const incentiveAPRs = useMemo((): Record<string, { supply: number; borrow: number }> => {
    const result: Record<string, { supply: number; borrow: number }> = {};
    // From projected snapshot if available
    if (projectedSnap) {
      for (const s of projectedSnap.supplies) {
        if (!result[s.symbol]) result[s.symbol] = { supply: 0, borrow: 0 };
        result[s.symbol].supply = s.incentiveAPR || 0;
      }
      for (const b of projectedSnap.borrows) {
        if (!result[b.symbol]) result[b.symbol] = { supply: 0, borrow: 0 };
        result[b.symbol].borrow = b.incentiveAPR || 0;
      }
    } else if (temporal.result?.timeline?.[0]) {
      // Use day 0 from simulation
      const day0 = temporal.result.timeline[0];
      for (const s of day0.supplies) {
        if (!result[s.symbol]) result[s.symbol] = { supply: 0, borrow: 0 };
        result[s.symbol].supply = s.incentiveAPR || 0;
      }
      for (const b of day0.borrows) {
        if (!result[b.symbol]) result[b.symbol] = { supply: 0, borrow: 0 };
        result[b.symbol].borrow = b.incentiveAPR || 0;
      }
    }
    return result;
  }, [projectedSnap, temporal.result]);

  // All market assets for the token search in ProjectionChart
  const allMarketAssets = useMemo((): MarketAssetInfo[] => {
    return enrichedPosition.availableAssets
      .filter((a: AssetDetails) => a.isActive)
      .map((a: AssetDetails) => ({
        symbol: a.symbol,
        priceInUSD: display.effectivePrices[a.symbol] ?? a.priceInUSD,
        supplyAPY: display.effectiveRates[a.symbol]?.supplyAPY ?? a.supplyAPY ?? 0,
        variableBorrowAPY: display.effectiveRates[a.symbol]?.variableBorrowAPY ?? a.variableBorrowAPY ?? 0,
      }));
  }, [enrichedPosition.availableAssets, display.effectivePrices, display.effectiveRates]);


  // Assets to supply with balance info for quantity editing
  const assetsToSupplyWithBalance = useMemo(() => {
    return enrichedPosition.availableAssets
      .filter((a: AssetDetails) => {
        const simBal = display.walletBalances[a.symbol] ?? a.walletBalance ?? 0;

        return (
          a.isActive &&
          !a.isFrozen &&
          !a.isPaused &&
          a.usageAsCollateralEnabled &&
          (!hideZeroBalance || simBal > 0 || a.isNewlyAddedBySimUser)
        );
      })
      .map((a: AssetDetails) => {
        return {
          asset: a,
          walletBalance: display.walletBalances[a.symbol] ?? a.walletBalance ?? 0,
          priceInUSD: display.effectivePrices[a.symbol] ?? a.priceInUSD,
        };
      });
  }, [enrichedPosition.availableAssets, display.walletBalances, display.effectivePrices, hideZeroBalance]);

  // Quantity edit modal for supplies (already supplied tokens)
  const [supplyQtyEditModal, setSupplyQtyEditModal] = useState<{
    isOpen: boolean;
    symbol: string;
    currentBalance: number;
    currentBalanceUSD: number;
    priceUSD: number;
  } | null>(null);

  const openSupplyQtyEditModal = useCallback((symbol: string, currentBalance: number, currentBalanceUSD: number, priceUSD: number) => {
    setSupplyQtyEditModal({
      isOpen: true,
      symbol,
      currentBalance,
      currentBalanceUSD,
      priceUSD,
    });
  }, []);

  const handleSupplyQtyEditConfirm = useCallback((newBalance: number) => {
    if (!supplyQtyEditModal) return;
    const { symbol, currentBalance } = supplyQtyEditModal;
    const diff = newBalance - currentBalance;
    if (Math.abs(diff) < 0.000001) return;

    const asset = enrichedPosition.availableAssets.find((a: AssetDetails) => a.symbol === symbol);
    if (!asset) return;

    if (diff > 0) {
      // Increase supply → supply action
      const action: SimAction = {
        id: Math.random().toString(36).substring(7),
        type: "supply",
        symbol,
        amount: diff,
        useAsCollateral: true,
        timestamp: Date.now(),
      };
      handleExecuteAction(action);
    } else {
      // Decrease supply → withdraw action
      const action: SimAction = {
        id: Math.random().toString(36).substring(7),
        type: "withdraw",
        symbol,
        amount: Math.abs(diff),
        timestamp: Date.now(),
      };
      handleExecuteAction(action);
    }
  }, [supplyQtyEditModal, enrichedPosition.availableAssets, handleExecuteAction]);

  // Open quantity edit modal
  const openQuantityEditModal = useCallback((symbol: string, currentBalance: number, currentBalanceUSD: number, priceUSD: number) => {
    setQuantityEditModal({
      isOpen: true,
      symbol,
      currentBalance,
      currentBalanceUSD,
      priceUSD,
    });
  }, []);

  // Handle quantity edit confirmation
  const handleQuantityEditConfirm = useCallback((newBalance: number) => {
    if (!quantityEditModal) return;

    const { symbol, currentBalance } = quantityEditModal;

    if (Math.abs(newBalance - currentBalance) < 0.000001) {
      // No significant change
      return;
    }

    const asset = enrichedPosition.availableAssets.find((a: AssetDetails) => a.symbol === symbol);
    if (!asset) return;

    const action: SimAction = {
      id: Math.random().toString(36).substring(7),
      type: "set_wallet_balance",
      symbol,
      amount: newBalance,
      timestamp: Date.now(),
    };

    handleExecuteAction(action);
  }, [quantityEditModal, enrichedPosition.availableAssets, handleExecuteAction]);

  // User's max borrowable per asset
  const getUserMaxBorrow = (asset: AssetDetails): number => {
    const price = display.effectivePrices[asset.symbol] ?? asset.priceInUSD;
    if (!price || price <= 0) return 0;
    const userCapacity = display.availableBorrows / price;
    const poolAvailable = asset.availableLiquidity ?? Infinity;
    return Math.max(0, Math.min(userCapacity, poolAvailable));
  };

  // Compute max amount and formatted reserve for ActionModal
  const actionModalExtras = useMemo(() => {
    if (!actionModal.asset) return { maxAmount: undefined, maxAmountCollateral: undefined, formattedReserve: undefined };

    const asset = actionModal.asset;
    const reserve = sim.currentSnapshot.formattedPoolReserves.find(
      (r: FormattedReserve) => r.symbol === asset.symbol
    );

    let maxAmount: number | undefined;
    let maxAmountCollateral: number | undefined;
    const price = display.effectivePrices[asset.symbol] ?? asset.priceInUSD;

    switch (actionModal.type) {
      case "supply": {
        maxAmount = display.walletBalances[asset.symbol] ?? asset.walletBalance ?? 0;
        break;
      }
      case "borrow": {
        const userCapacity = price > 0 ? display.availableBorrows / price : 0;
        const poolAvailable = asset.availableLiquidity ?? Infinity;
        maxAmount = Math.max(0, Math.min(userCapacity, poolAvailable));
        break;
      }
      case "repay": {
        const borrowRow = display.borrows.find((b) => b.symbol === asset.symbol);
        const totalDebt = borrowRow ? borrowRow.debt : 0;
        const simWalletBal = display.walletBalances[asset.symbol] ?? asset.walletBalance ?? 0;
        maxAmount = Math.min(simWalletBal, totalDebt);
        const supplyRow = display.supplies.find((s) => s.symbol === asset.symbol);
        const supplyBalance = supplyRow ? supplyRow.balance : 0;
        maxAmountCollateral = supplyBalance > 0 ? Math.min(supplyBalance, totalDebt) : 0;
        break;
      }
      case "withdraw": {
        const supplyRow = display.supplies.find((s) => s.symbol === asset.symbol);
        maxAmount = supplyRow ? supplyRow.balance : 0;
        break;
      }
    }

    return { maxAmount, maxAmountCollateral, formattedReserve: reserve };
  }, [actionModal.asset, actionModal.type, display, sim.currentSnapshot.formattedPoolReserves]);

  // Has simulation changes?
  const hasChanges = sim.snapshots.length > 1;

  // Liquidation state: HF < 1 means liquidatable on Aave V3
  // HF < 0.95 means 100% close factor (full liquidation possible)
  // 0.95 <= HF < 1 means 50% close factor (partial liquidation)
  const isLiquidated = isFinite(display.healthFactor) && display.healthFactor < 1;
  const isFullLiquidation = isFinite(display.healthFactor) && display.healthFactor < 0.95;
  const isNegativeWorth = display.netWorth < 0;

  // Keep a ref so openActionModal (defined before display) can access latest value
  const isLiquidatedRef = useRef(false);
  isLiquidatedRef.current = isLiquidated;

  const isMobile = useIsMobile();
  const isStressMode = !!searchParams.get("stress");

  // Mobile stress viewer: simplified read-only view
  if (isMobile && isStressMode) {
    return (
      <StressMobileViewer
        address={position.address}
        networkId={networkId}
        networkName={getNetworkById(networkId)?.name ?? "Ethereum"}
        ensName={ensName}
        currentHF={display.healthFactor}
        result={temporal.result}
        priceScenarios={temporal.config.priceScenarios}
        onBack={() => router.push("/radar")}
      />
    );
  }

  return (
    <div className={`flex-1 ${timelineCollapsed ? "pb-[60px]" : "pb-[360px]"}`}>
      {/* Better on desktop banner — mobile only */}
      <div className="md:hidden mb-3 px-3 py-2 bg-[#303549] text-white rounded-lg flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
        <p className="text-[10px] leading-tight">Better on desktop — interactive timeline and day-by-day slider work best on a larger screen.</p>
      </div>

      {/* Wallet bar + Summary — compact */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-y-1">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 min-w-0 flex-wrap">
          <NetworkBadge networkId={networkId} size="sm" />
          <span className="font-medium text-[#303549]">Aave V3</span>
          <span className="text-gray-300">·</span>
          <button
            className="flex items-center gap-1 font-mono text-gray-400 hover:text-[#5382E3] transition-colors cursor-pointer"
            title={position.address}
            onClick={() => onChangeWallet && setWalletSwitchModalOpen(true)}
          >
            {ensName ? (
              <>
                <span className="font-sans font-medium text-[#303549] not-italic">{ensName}</span>
                <span className="text-gray-300">·</span>
              </>
            ) : currentFavoriteLabel ? (
              <span className="font-sans font-medium text-[#303549] not-italic">
                {currentFavoriteLabel}
              </span>
            ) : null}
            <span>{position.address.slice(0, 6)}...{position.address.slice(-4)}</span>
            {onChangeWallet && <Pencil className="w-2.5 h-2.5" />}
          </button>
          <button
            className="text-gray-400 hover:text-[#5382E3] transition-colors"
            title={addressCopied ? "Copied!" : "Copy address"}
            onClick={handleCopyAddress}
          >
            {addressCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </button>
          <span className="text-gray-300">·</span>
          {projectedSnap && temporal.selectedDay !== null && temporal.selectedDay > 0 ? (
            <span className="text-blue-700 font-medium">
              D+{temporal.selectedDay} ({new Date(Date.now() + temporal.selectedDay * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })})
            </span>
          ) : hasChanges ? (
            <span className="text-blue-600 font-medium">
              {sim.snapshots.length - 1} action{sim.snapshots.length > 2 ? "s" : ""}
            </span>
          ) : (
            <span className="text-gray-400">Live snapshot</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onClear && (
            <button
              onClick={handleWalletClear}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-gray-500 bg-slate-50 hover:bg-slate-100 hover:text-[#303549] transition-colors"
            >
              <X className="w-3 h-3" />
              Back
            </button>
          )}
          {onChangeWallet && (
            <button
              onClick={() => setWalletSwitchModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-gray-500 bg-slate-50 hover:bg-slate-100 hover:text-[#303549] transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Switch
            </button>
          )}
          <div
            onClick={toggleAnalysisModal}
            className="hidden sm:block bg-slate-50 p-1 rounded-lg hover:cursor-pointer hover:scale-105"
          >
            <MdKeyboardDoubleArrowLeft className="size-5" />
          </div>
        </div>
      </div>

      {/* Summary metrics — desktop: single row, mobile: 2x2 grid with key metrics */}
      {(() => {
        const allMetrics = [
          { label: "Net worth", value: `${isNegativeWorth ? "-" : ""}$${formatUSD(Math.abs(display.netWorth))}`, danger: isNegativeWorth, mobile: true },
          { label: "Net APY", value: formatAPY(display.netAPY), danger: false, mobile: false },
          { label: "Collateral", value: `$${formatUSD(display.totalCollateral)}`, danger: false, mobile: true },
          { label: "Borrow", value: `$${formatUSD(display.totalBorrows)}`, danger: false, mobile: true },
          { label: "Available", value: `$${formatUSD(display.availableBorrows)}`, danger: false, mobile: false },
          {
            label: "HF",
            value: display.healthFactor === Infinity || display.healthFactor > 1e10
              ? "\u221E"
              : display.healthFactor.toFixed(2),
            danger: isFinite(display.healthFactor) && display.healthFactor < 1.1,
            mobile: true,
          },
          { label: "LTV", value: formatPercent(display.ltv), danger: false, mobile: false },
        ];
        const bg = isLiquidated ? "bg-red-50 border border-red-200" : "bg-[#F5F5FA]";
        return (
          <>
            {/* Desktop */}
            <div className={`hidden md:flex items-center gap-0 mb-5 rounded-lg px-4 py-2.5 ${bg}`}>
              {allMetrics.map((item, index, array) => (
                <React.Fragment key={index}>
                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className={`text-sm font-semibold leading-tight ${item.danger ? "text-red-500" : "text-[#303549]"}`}>
                      {item.value}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{item.label}</span>
                  </div>
                  {index < array.length - 1 && (
                    <Separator orientation="vertical" className="h-6 mx-2" />
                  )}
                </React.Fragment>
              ))}
            </div>
            {/* Mobile */}
            <div className={`md:hidden grid grid-cols-2 gap-2 mb-4 rounded-lg px-3 py-2.5 ${bg}`}>
              {allMetrics.filter((m) => m.mobile).map((item, index) => (
                <div key={index} className="flex flex-col">
                  <span className={`text-sm font-semibold ${item.danger ? "text-red-500" : "text-[#303549]"}`}>
                    {item.value}
                  </span>
                  <span className="text-[10px] text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Liquidation warning banner */}
      {isLiquidated && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <span className="text-red-600 text-sm font-bold">!</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700">
              Liquidation zone {isFullLiquidation ? "— 100% close factor" : "— 50% close factor"} {isNegativeWorth && "— Negative net worth"}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Health factor is {display.healthFactor.toFixed(4)}.
              {isFullLiquidation
                ? " HF < 0.95 — liquidators can repay 100% of debt in a single call."
                : " HF < 1 — liquidators can repay up to 50% of debt."
              }
              {" "}Actions are blocked — adjust prices or balances to restore HF above 1.
            </p>
          </div>
        </div>
      )}

      {/* Stress test mode indicator + PNL summary */}
      {searchParams.get("stress") && (
        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-blue-700">Stress Test</span>
              <span className="text-blue-500">
                {temporal.config.priceScenarios.length} tokens — {temporal.config.durationDays} days
              </span>
            </div>
            <button
              onClick={() => router.push("/radar")}
              className="text-[11px] text-blue-500 hover:text-blue-700 font-medium cursor-pointer"
            >
              Back to Radar
            </button>
          </div>
          {temporal.result && (() => {
            const s = temporal.result.summary;
            const loss = s.startNetWorth - s.endNetWorth;
            const lossPct = s.startNetWorth > 0 ? (loss / s.startNetWorth) * 100 : 0;
            const endSnap = temporal.result.timeline[temporal.result.timeline.length - 1];
            const startSnap = temporal.result.timeline[0];
            const collateralLoss = startSnap.totalCollateralUSD - endSnap.totalCollateralUSD;
            return (
              <div className="px-3 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <p className="text-gray-400">Start NW</p>
                  <p className="font-semibold text-[#303549]">${formatUSD(s.startNetWorth)}</p>
                </div>
                <div>
                  <p className="text-gray-400">End NW</p>
                  <p className={`font-semibold ${s.endNetWorth < s.startNetWorth ? "text-red-600" : "text-green-600"}`}>
                    ${formatUSD(s.endNetWorth)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">PNL</p>
                  <p className={`font-semibold ${loss > 0 ? "text-red-600" : "text-green-600"}`}>
                    {loss > 0 ? "-" : "+"}${formatUSD(Math.abs(loss))} ({lossPct.toFixed(1)}%)
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">{s.liquidationOccurred ? "Liquidation" : "Lowest HF"}</p>
                  {s.liquidationOccurred ? (
                    <p className="font-semibold text-red-600">
                      Day {s.liquidationDay} — ${formatUSD(collateralLoss)} collateral lost
                    </p>
                  ) : (
                    <p className={`font-semibold ${s.lowestHealthFactor < 1.1 ? "text-amber-600" : "text-[#303549]"}`}>
                      {s.lowestHealthFactor.toFixed(2)} (D{s.lowestHealthFactorDay})
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Free tier usage indicator */}
      {isFree && (
        <div className={`mb-2 px-3 py-2 rounded-lg border flex items-center justify-between ${
          isLegacyProjection ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-100"
        }`}>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            {isLegacyProjection ? (
              <span className="text-amber-600 font-semibold">
                Read-only — projection exceeds {features.maxProjectionDays}d free limit
              </span>
            ) : (
              <>
                <span className={actionsRemaining === 0 ? "text-red-500 font-semibold" : ""}>
                  {actionsRemaining} action{actionsRemaining !== 1 ? "s" : ""} remaining
                </span>
                <span className="text-gray-300">|</span>
                <span>Projection: <span className="font-semibold text-[#303549]">{features.maxProjectionDays}d max</span></span>
              </>
            )}
          </div>
          <button
            onClick={() => openUpgrade("all PRO features")}
            className="flex items-center gap-1 text-xs font-medium text-[#5382E3] hover:text-[#303549] transition-colors"
          >
            <Zap className="w-3 h-3" />
            Upgrade
          </button>
        </div>
      )}

      {/* Hint: actions blocked at this day */}
      {!canAddAction && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
          Actions can only be added on or after the last action ({new Date(Date.now() + lastActionDay * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, D{lastActionDay}). Move the cursor forward or delete later actions first.
        </div>
      )}

      {/* Supplies and Borrows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Your Supplies */}
        <Card className="bg-[#F5F5FA]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold mb-5">
              {isLoading ? <Skeleton /> : <p>Your supplies</p>}
              {isLiquidated && (
                <Badge className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 font-semibold">
                  Liquidation
                </Badge>
              )}
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge className="bg-[#5382E31F] text-[#5382E3] text-[12px] pt-[2px] pr-[6px] pl-[6px] pb-[2px] cursor-default hover:bg-muted">
                Balance ${formatUSD(display.supplyBalanceUSD)}
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-600 text-[12px] pt-[2px] pr-[6px] pl-[6px] pb-[2px] cursor-default hover:bg-emerald-100">
                Collateral ${formatUSD(display.collateralUSD)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            ) : display.supplies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-[#62677B]">
                      Assets
                    </TableHead>
                    <TableHead className="text-xs font-medium text-[#62677B]">
                      Balance
                    </TableHead>
                    <TableHead className="text-xs font-medium text-[#62677B]">
                      Price
                    </TableHead>
                    <TableHead className="text-center text-xs font-medium text-[#62677B]">
                      APY
                    </TableHead>
                    <TableHead className="text-xs font-medium text-[#62677B]">
                      Collateral
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {display.supplies.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={row.symbol} size={32} />
                          <span className="font-medium">{row.symbol}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1">
                          <div>
                            <p>{formatQty(row.balance)}</p>
                            <p className="text-gray-500">
                              ${formatUSD(row.balanceUSD)}
                            </p>
                          </div>
                          <Pencil
                            className="w-3 h-3 text-gray-400 hover:text-blue-500 cursor-pointer"
                            onClick={() => openSupplyQtyEditModal(
                              row.symbol,
                              row.balance,
                              row.balanceUSD,
                              row.priceInUSD
                            )}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">
                            ${formatUSD(row.priceInUSD)}
                          </span>
                          {row.asset && (
                            <Pencil
                              className="w-3 h-3 text-gray-400 hover:text-blue-500 cursor-pointer"
                              onClick={() => openPriceRatesModal()}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {formatAPY(row.supplyAPY)}
                      </TableCell>
                      <TableCell>
                        {row.originalReserve ? (
                          <Switch
                            checked={row.collateralEnabled}
                            className="bg-[#4F7FFA]"
                            onCheckedChange={() =>
                              setCollateralModal({
                                isOpen: true,
                                reserve: row.originalReserve!,
                              })
                            }
                          />
                        ) : (
                          <Switch
                            checked={row.collateralEnabled}
                            className="bg-[#4F7FFA]"
                            disabled
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.asset && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="bg-[#5382E3] text-xs px-2 h-7"
                              disabled={!canAddAction || isLiquidated}
                              onClick={() =>
                                setSwapModal({ isOpen: true, asset: row.asset!, supplyBalance: row.balance })
                              }
                            >
                              Swap
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs px-2 h-7"
                              disabled={!canAddAction || isLiquidated}
                              onClick={() =>
                                openActionModal("withdraw", row.asset!)
                              }
                            >
                              Withdraw
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-left text-[#62677B] pl-7 pb-4">
                No supplies yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Your Borrows */}
        <Card className="bg-[#F5F5FA]">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-semibold mb-5">
              Your borrows
              <Badge
                className="bg-[#5382E31F] text-[#5382E3] text-[10px] cursor-pointer hover:bg-[#5382E33D] transition-colors flex items-center gap-1"
                onClick={() => setEmodeModalOpen(true)}
              >
                {currentEmodeCategoryId > 0
                  ? `E-Mode ${enrichedPosition.emodeCategories.find((c) => c.id === currentEmodeCategoryId)?.label ?? currentEmodeCategoryId}`
                  : "E-Mode Off"}
                <Pencil className="w-2.5 h-2.5" />
              </Badge>
              {isLiquidated && (
                <Badge className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 font-semibold">
                  Liquidation
                </Badge>
              )}
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge className="bg-[#5382E31F] text-[#5382E3] text-[12px] pt-[2px] pr-[6px] pl-[6px] pb-[2px] cursor-default hover:bg-muted">
                Balance ${formatUSD(display.totalBorrows)}
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-600 text-[12px] pt-[2px] pr-[6px] pl-[6px] pb-[2px] cursor-default hover:bg-emerald-100">
                Borrow power used {(display.borrowPowerUsed * 100).toFixed(2)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {display.borrows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium text-[#62677B]">
                      Assets
                    </TableHead>
                    <TableHead className="text-xs font-medium text-[#62677B]">
                      Debt
                    </TableHead>
                    <TableHead className="text-xs font-medium text-[#62677B]">
                      Price
                    </TableHead>
                    <TableHead className="text-xs font-medium text-[#62677B]">
                      APY
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {display.borrows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={row.symbol} size={32} />
                          <span className="font-medium">{row.symbol}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <p>{formatQty(row.debt)}</p>
                        <p className="text-gray-500">
                          ${formatUSD(row.debtUSD)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">
                            ${formatUSD(row.priceInUSD)}
                          </span>
                          {row.asset && (
                            <Pencil
                              className="w-3 h-3 text-gray-400 hover:text-blue-500 cursor-pointer"
                              onClick={() => openPriceRatesModal()}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatAPY(row.borrowAPY)}
                      </TableCell>
                      <TableCell>
                        {row.asset && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="bg-[#5382E3] text-xs px-2 h-7"
                              disabled={!canAddAction || isLiquidated}
                              onClick={() =>
                                openActionModal("borrow", row.asset!)
                              }
                            >
                              Borrow
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs px-2 h-7"
                              disabled={!canAddAction || isLiquidated}
                              onClick={() =>
                                openActionModal("repay", row.asset!)
                              }
                            >
                              Repay
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-left text-[#62677B] pl-7 mb-9">
                No borrows yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assets to Supply and Borrow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card className="bg-[#F5F5FA]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">
                Assets to supply
              </CardTitle>
              <label className="flex items-center gap-2 text-xs text-[#62677B] cursor-pointer">
                <Switch
                  checked={hideZeroBalance}
                  onCheckedChange={setHideZeroBalance}
                  className="scale-75"
                />
                Hide 0 balance
              </label>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-[#62677B]">
                    Asset
                  </TableHead>
                  <TableHead className="text-xs font-medium text-[#62677B]">
                    Wallet balance
                  </TableHead>
                  <TableHead className="text-center text-xs font-medium text-[#62677B]">
                    APY
                  </TableHead>
                  <TableHead className="text-center text-xs font-medium text-[#62677B]">
                    Collateral
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetsToSupplyWithBalance
                  .slice(0, 10)
                  .map((item, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={item.asset.symbol} size={32} />
                          <span className="font-medium">{item.asset.symbol}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1">
                          <div>
                            <p>{formatQty(item.walletBalance)}</p>
                            <p className="text-gray-500">
                              ${formatUSD(item.walletBalance * item.priceInUSD)}
                            </p>
                          </div>
                          <Pencil
                            className="w-3 h-3 text-gray-400 hover:text-blue-500 cursor-pointer"
                            onClick={() => openQuantityEditModal(
                              item.asset.symbol,
                              item.walletBalance,
                              item.walletBalance * item.priceInUSD,
                              item.priceInUSD
                            )}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {formatAPY(display.effectiveRates[item.asset.symbol]?.supplyAPY ?? item.asset.supplyAPY ?? 0)}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {item.asset.usageAsCollateralEnabled ? (
                          <Check color="green" className="mx-auto" size={16} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          size="sm"
                          className="bg-[#5382E3] px-3 text-xs h-7"
                          disabled={!canAddAction || isLiquidated}
                          onClick={() => openActionModal("supply", item.asset)}
                        >
                          Supply
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F5FA]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold mb-5">
              Assets to borrow
              {currentEmodeCategoryId !== 0 && (
                <Badge className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0 font-normal">
                  E-Mode restricted
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-medium text-[#62677B]">
                    Asset
                  </TableHead>
                  <TableHead className="text-xs font-medium text-[#62677B]">
                    Available
                    <InfoIcon
                      color="#A5A8B6"
                      className="inline w-3 h-3 cursor-pointer ml-1"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium text-[#62677B]">
                    APY, variable
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetsToBorrow
                  .slice(0, 10)
                  .map((asset: AssetDetails, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={asset.symbol} size={32} />
                          <span className="font-medium">{asset.symbol}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {(() => {
                          const maxBorrow = getUserMaxBorrow(asset);
                          const price = display.effectivePrices[asset.symbol] ?? asset.priceInUSD;
                          return (
                            <>
                              <p>{formatQty(maxBorrow)}</p>
                              <p className="text-gray-500">
                                ${formatUSD(maxBorrow * price)}
                              </p>
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatAPY(display.effectiveRates[asset.symbol]?.variableBorrowAPY ?? asset.variableBorrowAPY ?? 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="bg-[#5382E3] text-xs px-3 h-7"
                          disabled={!canAddAction || isLiquidated}
                          onClick={() => openActionModal("borrow", asset)}
                        >
                          Borrow
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom Projection Timeline */}
      <div className={`fixed bottom-0 left-0 right-0 z-30 border-t border-slate-300 ${settings.timelineOpacity ? "bg-[#F5F5FA]/85 backdrop-blur-sm" : "bg-[#F5F5FA]"}`}>
        <div className="px-6 py-2">
          {/* Header — always visible, acts as toggle */}
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setTimelineCollapsed((c) => !c)}
          >
            <div className="flex items-center gap-2">
              {timelineCollapsed ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
              <p className="text-sm font-semibold text-[#303549]">
                Projection Timeline
              </p>
              {timelineCollapsed && temporal.selectedDay !== null && (
                <span className="text-xs text-slate-400 ml-1">
                  {new Date(Date.now() + (temporal.selectedDay) * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })} (D{temporal.selectedDay})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {/* Current projection name — desktop only */}
              {currentProjectionName && (
                <span className="hidden md:inline text-xs text-gray-400 truncate max-w-[160px]" title={currentProjectionName}>
                  {currentProjectionName}
                </span>
              )}

              {/* Auto-save toggle (only when tracking a projection, PRO only) */}
              {features.canAutoSave && currentProjectionId && session?.user && (
                <label className="flex items-center gap-1 cursor-pointer" title="Auto-save changes">
                  <Switch
                    checked={autoSave}
                    onCheckedChange={setAutoSave}
                    className="scale-[0.6]"
                  />
                  <span className="text-[10px] text-gray-400">Auto</span>
                </label>
              )}

              {/* Save button */}
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6 gap-1 relative"
                onClick={handleSaveClick}
                disabled={isSaving}
              >
                <Save className="w-3 h-3" />
                {isSaving ? "..." : currentProjectionId ? "Save" : "Save as"}
                {unsavedChanges > 0 && !autoSave && currentProjectionId && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#5382E3] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                    {unsavedChanges > 9 ? "9+" : unsavedChanges}
                  </span>
                )}
              </Button>

              {/* AI Summary button — visible when simulation has results */}
              {temporal.result && (
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

              {/* Share button — visible when simulation has results */}
              {temporal.result && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1"
                  disabled={shareLoading}
                  onClick={() => {
                    if (!session?.user) {
                      setSignInPromptOpen(true);
                      return;
                    }
                    setShareSummaryPromptOpen(true);
                  }}
                >
                  <Share2 className="w-3 h-3" />
                  {shareLoading ? "..." : shareCopied ? "Copied!" : "Share"}
                </Button>
              )}

              {/* Load button (read-only for free, full access for PRO) */}
              {session?.user && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1"
                  onClick={() => setLoadModalOpen(true)}
                >
                  <FolderOpen className="w-3 h-3" />
                  Load
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6 gap-1"
                onClick={() => openPriceRatesModal()}
              >
                <DollarSign className="w-3 h-3" />
                Prices & Rates
              </Button>
              {/* Scenario selector pill */}
              {temporal.config.scenarioSets && temporal.config.scenarioSets.length > 1 && (
                <div className="flex items-center gap-0.5">
                  {temporal.config.scenarioSets.map((set) => {
                    const isActive = set.id === (temporal.config.activeScenarioSetId ?? temporal.config.scenarioSets?.[0]?.id);
                    return (
                      <button
                        key={set.id}
                        className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-md transition-colors ${
                          isActive
                            ? "bg-slate-200 text-[#303549] font-medium"
                            : "text-gray-400 hover:bg-slate-100 hover:text-gray-600"
                        }`}
                        onClick={() => temporal.setActiveScenarioSetId(set.id)}
                        title={set.name}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: set.color }}
                        />
                        {set.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Desktop-only toolbar buttons */}
              <div className="hidden md:contents">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1"
                  onClick={() => setScanPanelOpen(true)}
                >
                  <Search className="w-3 h-3" />
                  Scan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1"
                  onClick={() => setCustomTokenModalOpen(true)}
                >
                  <Coins className="w-3 h-3" />
                  Custom Tokens
                  {customTokens.length > 0 && (
                    <span className="bg-[#5382E3] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center ml-0.5">
                      {customTokens.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 gap-1"
                  onClick={toggleAnalysisModal}
                >
                  <Settings2 className="w-3 h-3" />
                  Configure
                </Button>
                <label className="flex items-center gap-1 cursor-pointer" title="Transparent timeline">
                  <Switch
                    checked={settings.timelineOpacity}
                    onCheckedChange={(v) => updateSetting("timelineOpacity", v)}
                    className="scale-[0.6]"
                  />
                  <span className="text-[10px] text-gray-400">Opacity</span>
                </label>
              </div>
              {temporal.result && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6"
                  onClick={temporal.clear}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Content — collapsible */}
          {!timelineCollapsed && (
            <div className="mt-1">
              {temporal.result ? (
                <ProjectionChart
                  result={activeScenarioResult ?? temporal.result!}
                  selectedDay={temporal.selectedDay}
                  onSelectDay={temporal.setSelectedDay}
                  timelineActions={timelineActions}
                  priceScenarios={temporal.config.priceScenarios}
                  rateScenarios={temporal.config.rateScenarios}
                  onRemovePriceScenario={temporal.removePriceScenario}
                  onRemoveRateScenario={temporal.removeRateScenario}
                  onUndoLastAction={() => {
                    const actions = temporal.config.scheduledActions;
                    if (actions.length > 0) temporal.removeScheduledAction(actions.length - 1);
                  }}
                  onClearAllActions={() => temporal.setScheduledActions([])}
                  onResetAllScenarios={() => {
                    temporal.setPriceScenarios([]);
                    temporal.setRateScenarios([]);
                  }}
                  scheduledActionsCount={temporal.config.scheduledActions.length}
                  allMarketAssets={allMarketAssets}
                  scenarioResults={temporal.scenarioResults}
                  scenarioSets={temporal.config.scenarioSets}
                  activeScenarioSetId={temporal.config.activeScenarioSetId}
                  onSetActiveScenario={temporal.setActiveScenarioSetId}
                />
              ) : (
                <div
                  className="flex items-center justify-center text-gray-400"
                  style={{ height: 80 }}
                >
                  <p className="text-sm">Loading projection...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {actionModal.asset && (
        <ActionModal
          isOpen={actionModal.isOpen}
          onClose={() =>
            setActionModal({ isOpen: false, type: "supply", asset: null })
          }
          onExecute={handleExecuteAction}
          actionType={actionModal.type}
          asset={actionModal.asset}
          currentHF={display.healthFactor}
          maxAmount={actionModalExtras.maxAmount}
          maxAmountCollateral={actionModalExtras.maxAmountCollateral}
          formattedReserve={actionModalExtras.formattedReserve}
          simulationState={simulationStateForPreview}
          durationDays={temporal.config.durationDays}
          effectivePrice={actionModal.asset ? display.effectivePrices[actionModal.asset.symbol] : undefined}
        />
      )}

      {/* Collateral Toggle Modal */}
      {collateralModal.reserve && (
        <CollateralToggleModal
          isOpen={collateralModal.isOpen}
          onClose={() => setCollateralModal({ isOpen: false, reserve: null })}
          onExecute={sim.executeAction}
          symbol={collateralModal.reserve.asset.symbol}
          underlyingAsset={collateralModal.reserve.asset.underlyingAsset ?? ""}
          currentlyEnabled={collateralModal.reserve.usageAsCollateralEnabledOnUser}
          supplyBalance={collateralModal.reserve.underlyingBalance}
          supplyBalanceUSD={collateralModal.reserve.underlyingBalanceUSD}
          currentHF={display.healthFactor}
          rawUserReserves={sim.currentSnapshot.rawUserReserves}
          formattedPoolReserves={sim.currentSnapshot.formattedPoolReserves}
          baseCurrencyData={enrichedPosition.baseCurrencyData}
          userEmodeCategoryId={currentEmodeCategoryId}
        />
      )}

      {/* Wallet Switch Modal */}
      {onChangeWallet && onClear && (
        <WalletSwitchModal
          isOpen={walletSwitchModalOpen}
          onClose={() => setWalletSwitchModalOpen(false)}
          onSwitch={handleWalletSwitch}
          onClear={handleWalletClear}
          currentAddress={position.address}
          currentEns={ensName}
          currentNetwork={networkId}
        />
      )}

      {/* Confirm wallet switch/clear when actions exist */}
      <Dialog open={confirmSwitchModal.isOpen} onOpenChange={() => setConfirmSwitchModal({ isOpen: false, action: "switch" })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-[#303549] font-semibold text-center">
              {confirmSwitchModal.action === "clear" ? "Exit projection?" : "Switch wallet?"}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 text-center mt-1">
              You have {sim.snapshots.length - 1} instant action{sim.snapshots.length - 1 !== 1 ? "s" : ""} and {temporal.config.scheduledActions.length} scheduled action{temporal.config.scheduledActions.length !== 1 ? "s" : ""}. All actions, price scenarios, and rate scenarios will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button
              onClick={confirmWalletAction}
              className="flex-1 bg-red-500 hover:bg-red-600 text-sm font-medium"
            >
              {confirmSwitchModal.action === "clear" ? "Exit & Reset" : "Switch & Reset"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-sm font-medium"
              onClick={() => setConfirmSwitchModal({ isOpen: false, action: "switch" })}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* E-Mode Modal */}
      <EmodeModal
        isOpen={emodeModalOpen}
        onClose={() => setEmodeModalOpen(false)}
        onExecute={handleExecuteAction}
        currentEmodeCategoryId={currentEmodeCategoryId}
        emodeCategories={enrichedPosition.emodeCategories}
        userBorrows={data.userBorrowsData}
        currentHF={display.healthFactor}
        rawUserReserves={sim.currentSnapshot.rawUserReserves}
        formattedPoolReserves={sim.currentSnapshot.formattedPoolReserves}
        baseCurrencyData={enrichedPosition.baseCurrencyData}
      />

      {/* Price & Rates Modal */}
      <PriceRatesModal
        isOpen={priceRatesModalOpen}
        onClose={() => setPriceRatesModalOpen(false)}
        selectedDay={temporal.selectedDay}
        durationDays={temporal.config.durationDays}
        availableAssets={enrichedPosition.availableAssets}
        userSupplies={display.supplies}
        userBorrows={display.borrows}
        walletBalances={display.walletBalances}
        priceScenarios={temporal.config.priceScenarios}
        rateScenarios={temporal.config.rateScenarios}
        onUpdatePriceScenario={temporal.addPriceScenario}
        onRemovePriceScenario={temporal.removePriceScenario}
        onUpdateRateScenario={temporal.addRateScenario}
        onRemoveRateScenario={temporal.removeRateScenario}
        emodeCategories={enrichedPosition.emodeCategories}
        incentiveAPRs={incentiveAPRs}
        scenarioSets={temporal.config.scenarioSets}
        activeScenarioSetId={temporal.config.activeScenarioSetId}
        onSetActiveScenario={temporal.setActiveScenarioSetId}
        onAddScenarioSet={temporal.addScenarioSet}
        onRemoveScenarioSet={temporal.removeScenarioSet}
        onRenameScenarioSet={(id, name) => temporal.updateScenarioSet(id, { name })}
        onDuplicateScenarioSet={temporal.duplicateScenarioSet}
        onGenerateInverse={temporal.addInverseScenario}
        onInitScenarioSets={temporal.initScenarioSets}
      />

      {/* Quantity Edit Modal */}
      {quantityEditModal && (
        <QuantityEditModal
          isOpen={quantityEditModal.isOpen}
          onClose={() => setQuantityEditModal(null)}
          symbol={quantityEditModal.symbol}
          currentBalance={quantityEditModal.currentBalance}
          currentBalanceUSD={quantityEditModal.currentBalanceUSD}
          priceUSD={quantityEditModal.priceUSD}
          onConfirm={handleQuantityEditConfirm}
        />
      )}

      {/* Supply Quantity Edit Modal */}
      {supplyQtyEditModal && (
        <QuantityEditModal
          isOpen={supplyQtyEditModal.isOpen}
          onClose={() => setSupplyQtyEditModal(null)}
          symbol={supplyQtyEditModal.symbol}
          currentBalance={supplyQtyEditModal.currentBalance}
          currentBalanceUSD={supplyQtyEditModal.currentBalanceUSD}
          priceUSD={supplyQtyEditModal.priceUSD}
          onConfirm={handleSupplyQtyEditConfirm}
          mode="supply"
        />
      )}

      {/* Swap Modal */}
      {swapModal.asset && (
        <SwapModal
          isOpen={swapModal.isOpen}
          onClose={() => setSwapModal({ isOpen: false, asset: null, supplyBalance: 0 })}
          onExecute={handleExecuteAction}
          sourceAsset={swapModal.asset}
          sourceBalance={swapModal.supplyBalance}
          availableTargets={enrichedPosition.availableAssets.filter(
            (a: AssetDetails) =>
              a.isActive && !a.isFrozen && !a.isPaused && a.usageAsCollateralEnabled && a.symbol !== swapModal.asset!.symbol
          )}
          currentHF={display.healthFactor}
          simulationState={simulationStateForPreview}
          durationDays={temporal.config.durationDays}
          effectivePrices={display.effectivePrices}
          currentEmodeCategoryId={currentEmodeCategoryId}
          emodeCategories={enrichedPosition.emodeCategories}
        />
      )}

      {/* Sign-in / Sign-up prompt for saving */}
      <Dialog open={signInPromptOpen} onOpenChange={setSignInPromptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#5382E3]/10 flex items-center justify-center mb-2">
              <Save className="w-6 h-6 text-[#5382E3]" />
            </div>
            <DialogTitle className="text-lg">Save your projection</DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Sign in or create an account — your data won&apos;t be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-10"
              onClick={() => handleSignInForSave("google")}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-10"
              onClick={() => handleSignInForSave("github")}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Continue with GitHub
            </Button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get("email") as string;
                if (!email) return;
                const pendingData = {
                  name: generateDefaultName(),
                  address: position.address,
                  config: temporal.config,
                  snapshots: sim.snapshots.length > 1 ? sim.snapshots : null,
                };
                localStorage.setItem("pendingProjection", JSON.stringify(pendingData));
                signIn("resend", { email, callbackUrl: `/?wallet=${encodeURIComponent(position.address)}` });
              }}
              className="flex gap-2"
            >
              <Input
                name="email"
                type="email"
                placeholder="you@example.com"
                className="h-10 text-sm"
                required
              />
              <Button type="submit" className="bg-[#5382E3] h-10 px-4 shrink-0">
                Send link
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Summary Modal */}
      <AISummaryModal
        isOpen={aiSummaryModalOpen}
        onClose={() => setAiSummaryModalOpen(false)}
        existingSummary={aiSummary}
        onSave={handleSaveAISummary}
        buildRequest={buildSummaryRequest}
      />

      {/* Share Summary Prompt */}
      <ShareSummaryPrompt
        isOpen={shareSummaryPromptOpen}
        onClose={() => setShareSummaryPromptOpen(false)}
        existingSummary={aiSummary}
        onShareWithSummary={handleShareWithSummary}
        onOpenSummaryModal={() => setAiSummaryModalOpen(true)}
        isSharing={shareLoading}
      />

      {/* Save Projection Modal */}
      <SaveProjectionModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveFromModal}
        defaultName={currentProjectionName || generateDefaultName()}
        defaultDetails={currentProjectionDetails || ""}
        isSaving={isSaving}
      />

      {/* Load Projection Modal */}
      <LoadProjectionModal
        isOpen={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        projections={projections}
        onLoad={handleLoadProjection}
        onDuplicate={handleDuplicate}
        onDelete={removeProjection}
        isLoading={projectionsLoading}
        currentProjectionId={currentProjectionId}
      />

      {/* Side Modal — Projection Configuration */}
      <div
        id="sideModal"
        className="w-screen hidden absolute h-dvh z-50 top-0 left-0 bg-gray-200/50"
      >
        <div className="w-1/3 h-dvh bg-[#F5F5FA] px-5 pt-5 pb-16 absolute right-0 overflow-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center">
            <p className="font-bold">Projection Configuration</p>
            <div
              onClick={toggleAnalysisModal}
              className="bg-slate-50 rounded-full p-2 hover:cursor-pointer group"
            >
              <CgClose className="group-hover:text-red-600" />
            </div>
          </div>

          {/* Duration */}
          <div className="border border-slate-50 p-4 rounded-lg">
            <label className="text-xs font-medium text-gray-600">
              Projection duration
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={temporal.config.durationDays}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  if (val > features.maxProjectionDays) {
                    openUpgrade("365-day projections");
                    temporal.updateDuration(features.maxProjectionDays);
                    return;
                  }
                  temporal.updateDuration(Math.min(365, val));
                }}
                className="w-20 h-8 text-xs border border-gray-300 rounded px-2"
                min="1"
                max={features.maxProjectionDays}
                step="1"
              />
              <span className="text-xs text-gray-400">days</span>
            </div>
          </div>

          {/* Scheduled actions */}
          <div className="border border-slate-50 p-4 rounded-lg">
            <ActionScheduler
              availableAssets={enrichedPosition.availableAssets}
              actions={temporal.config.scheduledActions}
              durationDays={temporal.config.durationDays}
              onAddAction={temporal.addScheduledAction}
              onRemoveAction={temporal.removeScheduledAction}
              emodeCategories={enrichedPosition.emodeCategories}
            />
          </div>

        </div>
      </div>

      {/* Custom Token Modal */}
      <CustomTokenModal
        isOpen={customTokenModalOpen}
        onClose={() => setCustomTokenModalOpen(false)}
        tokens={customTokens}
        onAdd={handleAddCustomToken}
        onUpdate={handleUpdateCustomToken}
        onDelete={handleDeleteCustomToken}
      />

      {/* Scan Panel */}
      <AIPanel
        isOpen={scanPanelOpen}
        onClose={() => setScanPanelOpen(false)}
        availableSymbols={enrichedPosition.availableAssets.filter((a: AssetDetails) => a.isActive).map((a: AssetDetails) => a.symbol)}
        scanResult={algoScanner.result}
        scanLoading={algoScanner.isLoading}
        scanError={algoScanner.error}
        onScan={algoScanner.scan}
        onResetScan={algoScanner.reset}
      />

    </div>
  );
};

export default PortfolioDashboard;
