"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import TokenIcon from "@/src/components/ui/TokenIcon";
import { Skeleton } from "@/src/components/ui/skeleton";
import { formatAPY, formatUSD } from "@/src/lib/format";
import type { YieldRow, YieldsResponse, YieldProgressEvent } from "@/src/app/api/yields/route";

type SortKey = "totalSupplyAPY" | "supplyAPY" | "variableBorrowAPY" | "availableLiquidityUSD" | "avgApy7d" | "avgApy30d" | "avgApy90d";
type SortDir = "asc" | "desc";
type Category = "all" | "stablecoins" | "non-stablecoins";
type ProtocolFilter = "all" | "aave" | "morpho";

const YIELD_PROTOCOLS: { id: ProtocolFilter | string; label: string; color: string; active: boolean }[] = [
  { id: "all", label: "All", color: "#5382E3", active: true },
  { id: "aave", label: "Aave V3", color: "#B6509E", active: true },
  { id: "morpho", label: "Morpho Vaults", color: "#1E2B3A", active: true },
];

const YIELD_NETWORKS: { id: string; name: string; logo: string }[] = [
  { id: "ETHEREUM_V3", name: "Ethereum", logo: "/icons/networks/ethereum.svg" },
  { id: "ARBITRUM_V3", name: "Arbitrum", logo: "/icons/networks/arbitrum.svg" },
  { id: "BASE_V3", name: "Base", logo: "/icons/networks/base.svg" },
  { id: "OPTIMISM_V3", name: "Optimism", logo: "/icons/networks/optimism.svg" },
  { id: "POLYGON_V3", name: "Polygon", logo: "/icons/networks/polygon.svg" },
  { id: "AVALANCHE_V3", name: "Avalanche", logo: "/icons/networks/avalanche.svg" },
  { id: "BNB_V3", name: "BNB Chain", logo: "/icons/networks/bnb.svg" },
  { id: "SCROLL_V3", name: "Scroll", logo: "/icons/networks/scroll.svg" },
  { id: "ZKSYNC_V3", name: "ZKsync", logo: "/icons/networks/zksync.svg" },
  { id: "LINEA_V3", name: "Linea", logo: "/icons/networks/linea.svg" },
  { id: "GNOSIS_V3", name: "Gnosis", logo: "/icons/networks/gnosis.svg" },
  { id: "METIS_V3", name: "Metis", logo: "/icons/networks/metis.svg" },
  { id: "SONIC_V3", name: "Sonic", logo: "/icons/networks/sonic.svg" },
  { id: "CELO_V3", name: "Celo", logo: "/icons/networks/celo.svg" },
  { id: "MANTLE_V3", name: "Mantle", logo: "/icons/networks/mantle.svg" },
  { id: "SONEIUM_V3", name: "Soneium", logo: "/icons/networks/soneium.svg" },
  { id: "INK_V3", name: "Ink", logo: "/icons/networks/ink.svg" },
];

const DEFAULT_YIELD_NETWORK_IDS = ["ETHEREUM_V3", "BASE_V3", "ARBITRUM_V3"];

const SKELETON_ROWS = 12;

function SkeletonTable() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="text-left font-medium text-gray-500 px-4 py-3">Token</th>
            <th className="text-left font-medium text-gray-500 px-4 py-3">Network</th>
            <th className="text-right font-medium text-gray-500 px-4 py-3">Base APY</th>
            <th className="text-right font-medium text-gray-500 px-4 py-3">Incentives</th>
            <th className="text-right font-medium text-gray-500 px-4 py-3">Total APY</th>
            <th className="text-right font-medium text-gray-500 px-4 py-3">Avg 7D</th>
            <th className="text-right font-medium text-gray-500 px-4 py-3">Avg 30D</th>
            <th className="text-right font-medium text-gray-500 px-4 py-3">Avg 90D</th>
            <th className="text-right font-medium text-gray-500 px-4 py-3">Borrow APY</th>
            <th className="text-right font-medium text-gray-500 px-4 py-3">Liquidity</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-7 h-7 rounded-full" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-5 h-5 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
              <td className="px-4 py-3"><Skeleton className="h-4 w-24 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PROTOCOL_COLORS: Record<string, string> = {
  aave: "#B6509E",
  morpho: "#1E2B3A",
};

const PROTOCOL_LABELS: Record<string, string> = {
  aave: "Aave",
  morpho: "Morpho",
};

function ProgressBar({ loaded, total, lastNetwork, protocols }: { loaded: number; total: number; lastNetwork: string; protocols?: Record<string, number> }) {
  const pct = total > 0 ? (loaded / total) * 100 : 0;
  const activeProtocols = protocols ? Object.entries(protocols).filter(([, v]) => v > 0) : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-xs h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#5382E3] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
          <span className="font-medium text-[#303549]">{loaded}</span>
          <span className="text-gray-400"> / {total}</span>
        </span>
        {lastNetwork && (
          <span className="text-xs text-gray-400 hidden sm:inline truncate max-w-40">
            {lastNetwork}
          </span>
        )}
      </div>
      {activeProtocols.length > 0 && (
        <div className="flex items-center gap-3">
          {activeProtocols.map(([proto, count]) => (
            <div key={proto} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROTOCOL_COLORS[proto] || "#999" }} />
              <span className="text-[10px] text-gray-500">
                {PROTOCOL_LABELS[proto] || proto} <span className="text-gray-400">{count}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function YieldsPage() {
  const [data, setData] = useState<YieldRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string>("");

  // Progress tracking
  const [progress, setProgress] = useState({ loaded: 0, total: 0, lastNetwork: "", protocols: {} as Record<string, number> });

  // Chain selector
  const [selectedChains, setSelectedChains] = useState<Set<string>>(
    () => new Set(DEFAULT_YIELD_NETWORK_IDS)
  );

  // Filters
  const [protocol, setProtocol] = useState<ProtocolFilter>("all");
  const [category, setCategory] = useState<Category>("stablecoins");
  const [activeTokens, setActiveTokens] = useState<Set<string>>(new Set());
  const [selectedNetwork, setSelectedNetwork] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("totalSupplyAPY");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showErrors, setShowErrors] = useState(false);

  const fetchYields = useCallback(async (force = false, networkIds?: string[]) => {
    setLoading(true);
    setShowErrors(false);
    setErrors([]);
    setProgress({ loaded: 0, total: 0, lastNetwork: "", protocols: {} });

    const params = new URLSearchParams();
    if (force) params.set("force", "true");
    if (networkIds?.length) params.set("networks", networkIds.join(","));
    const url = `/api/yields${params.toString() ? `?${params}` : ""}`;

    try {
      // Try SSE stream first for progress updates
      const res = await fetch(url, {
        headers: { Accept: "text/event-stream" },
      });

      // If JSON response (cache hit), parse directly
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json: YieldsResponse = await res.json();
        // Merge with existing rows (incremental fetch) or replace (full fetch)
        setData((prev) => {
          if (!networkIds || force) return json.rows;
          // Remove old rows for these networks, add new ones
          const netSet = new Set(networkIds);
          const kept = prev.filter((r) => !netSet.has(r.networkId));
          const merged = [...kept, ...json.rows];
          merged.sort((a, b) => b.totalSupplyAPY - a.totalSupplyAPY);
          return merged;
        });
        setErrors((prev) => force ? json.errors : [...prev, ...json.errors]);
        setFetchedAt(json.fetchedAt);
        if (networkIds) setFetchedNetworks((prev) => { const n = new Set(prev); networkIds.forEach((id) => n.add(id)); return n; });
        setProgress((p) => ({ ...p, loaded: p.total, lastNetwork: "" }));
        setLoading(false);
        return;
      }

      // SSE stream — read progress events
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // keep incomplete last chunk

        for (const block of lines) {
          const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          const event: YieldProgressEvent = JSON.parse(dataLine.slice(6));

          if (event.type === "progress") {
            // Stream rows as they arrive — don't wait for done
            if (event.rows?.length) {
              setData((prev) => {
                const merged = [...prev, ...event.rows!];
                merged.sort((a, b) => b.totalSupplyAPY - a.totalSupplyAPY);
                return merged;
              });
            }
            setProgress((prev) => {
              const protocols = { ...prev.protocols };
              const proto = event.protocol || "other";
              protocols[proto] = (protocols[proto] || 0) + 1;
              return { loaded: event.loaded, total: event.total, lastNetwork: event.network, protocols };
            });
          } else if (event.type === "done") {
            const doneRows = event.data.rows ?? [];
            setData((prev) => {
              if (!networkIds || force) {
                return doneRows.length >= prev.length ? doneRows : prev;
              }
              // Incremental: replace only rows from the fetched networks
              const doneNetIds = new Set(doneRows.map((r: YieldRow) => r.networkId));
              const kept = prev.filter((r) => !doneNetIds.has(r.networkId));
              const merged = [...kept, ...doneRows];
              merged.sort((a, b) => b.totalSupplyAPY - a.totalSupplyAPY);
              return merged;
            });
            setErrors((prev) => force ? event.data.errors : [...prev, ...event.data.errors]);
            setFetchedAt(event.data.fetchedAt);
            if (networkIds) setFetchedNetworks((prev) => { const n = new Set(prev); networkIds.forEach((id) => n.add(id)); return n; });
          }
        }
      }
    } catch {
      setErrors(["Failed to fetch yields data"]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setFetchedNetworks(new Set(DEFAULT_YIELD_NETWORK_IDS));
    fetchYields(false, DEFAULT_YIELD_NETWORK_IDS);
  }, [fetchYields]);

  // Track which networks have been fetched already
  const [fetchedNetworks, setFetchedNetworks] = useState<Set<string>>(new Set());

  function toggleChain(id: string) {
    setSelectedChains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // If this network hasn't been fetched yet, fetch just this one incrementally
        if (!fetchedNetworks.has(id)) {
          fetchYields(false, [id]);
        }
      }
      return next;
    });
  }

  // Reset token/network selection when category or protocol changes
  useEffect(() => {
    setActiveTokens(new Set());
  }, [category, protocol]);

  useEffect(() => {
    setSelectedNetwork("all");
  }, [protocol]);

  // Data filtered by protocol then category
  const protocolData = useMemo(() => {
    if (protocol === "all") return data;
    return data.filter((r) => r.protocol === protocol);
  }, [data, protocol]);

  const categoryData = useMemo(() => {
    if (category === "stablecoins") return protocolData.filter((r) => r.isStablecoin);
    if (category === "non-stablecoins") return protocolData.filter((r) => !r.isStablecoin);
    return protocolData;
  }, [protocolData, category]);

  // Unique tokens & networks
  const tokens = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of categoryData) counts.set(r.symbol, (counts.get(r.symbol) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [categoryData]);

  const networks = useMemo(() => {
    const map = new Map<string, { name: string; logo: string; color: string }>();
    for (const r of protocolData) {
      if (!map.has(r.networkName)) {
        map.set(r.networkName, { name: r.networkName, logo: r.networkLogo, color: r.networkColor });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [protocolData]);

  const loadedNetworkCount = networks.length;
  const failedNetworkCount = errors.length;
  const stablecoinCount = useMemo(() => protocolData.filter((r) => r.isStablecoin).length, [protocolData]);
  const otherCount = useMemo(() => protocolData.filter((r) => !r.isStablecoin).length, [protocolData]);

  function toggleToken(symbol: string) {
    setActiveTokens((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }

  const rows = useMemo(() => {
    let filtered = categoryData;
    if (activeTokens.size > 0) filtered = filtered.filter((r) => activeTokens.has(r.symbol));
    if (selectedNetwork !== "all") filtered = filtered.filter((r) => r.networkName === selectedNetwork);
    return [...filtered].sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      const aVal = (a[sortKey] as number | null | undefined) ?? -Infinity;
      const bVal = (b[sortKey] as number | null | undefined) ?? -Infinity;
      return mul * (aVal - bVal);
    });
  }, [categoryData, activeTokens, selectedNetwork, sortKey, sortDir]);

  const bestAPYPerToken = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of categoryData) {
      const current = map.get(r.symbol) ?? 0;
      if (r.totalSupplyAPY > current) map.set(r.symbol, r.totalSupplyAPY);
    }
    return map;
  }, [categoryData]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <span className="text-gray-300 ml-1">&#8693;</span>;
    return <span className="text-[#5382E3] ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>;
  }

  // How long ago was the data fetched
  const timeAgo = useMemo(() => {
    if (!fetchedAt) return "";
    const diff = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }, [fetchedAt]);

  return (
    <div className="flex-1 w-full space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#303549]">Yield Explorer</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Compare supply APY across DeFi protocols
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-xs text-gray-400 flex items-center gap-1.5">
              {loading ? (
                <span className="w-3 h-3 border border-[#5382E3] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
              {loading && data.length > 0 ? "Refreshing..." : timeAgo}
              {" \u00b7 "}
              {loadedNetworkCount} network{loadedNetworkCount !== 1 ? "s" : ""}
              {failedNetworkCount > 0 && (
                <button
                  onClick={() => setShowErrors((v) => !v)}
                  className="text-amber-500 hover:text-amber-600 underline cursor-pointer"
                >
                  ({failedNetworkCount} unavailable)
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Chain selector */}
      <div className="flex flex-wrap items-center gap-2">
        {YIELD_NETWORKS.map((net) => {
          const isSelected = selectedChains.has(net.id);
          return (
            <button
              key={net.id}
              onClick={() => toggleChain(net.id)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#303549] text-white border-[#303549]"
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
              }`}
            >
              <Image src={net.logo} alt={net.name} width={14} height={14} className="rounded-full" />
              {net.name}
            </button>
          );
        })}
        <button
          onClick={() => fetchYields(true, Array.from(selectedChains))}
          disabled={loading || selectedChains.size === 0}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full bg-[#5382E3] text-white hover:bg-[#4372D3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer ml-1"
        >
          {loading ? "Scanning..." : `Scan${selectedChains.size > 0 ? ` (${selectedChains.size})` : ""}`}
        </button>
      </div>

      {/* Error detail */}
      {showErrors && errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">Unavailable networks:</span>
            <button
              onClick={() => fetchYields(true)}
              className="text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-md px-2.5 py-1 transition-colors cursor-pointer"
            >
              Retry all
            </button>
          </div>
          {errors.map((e, i) => (
            <div key={i} className="truncate">
              <span className="font-medium">{e.split(":")[0]}</span>
              <span className="text-amber-500 ml-1">— chain not enabled on RPC provider</span>
            </div>
          ))}
        </div>
      )}

      {/* Protocol tabs (underline style) */}
      <div className="flex items-center gap-0 border-b border-gray-200 overflow-x-auto scrollbar-none">
        {YIELD_PROTOCOLS.map((p) => {
          const isSelected = p.id === protocol;
          const isSoon = !p.active;

          return (
            <button
              key={p.id}
              disabled={isSoon}
              onClick={() => !isSoon && setProtocol(p.id as ProtocolFilter)}
              className={`relative px-4 py-2.5 text-sm transition-colors ${
                isSoon
                  ? "text-gray-300 cursor-default"
                  : isSelected
                    ? "text-[#303549] font-medium cursor-pointer"
                    : "text-gray-400 hover:text-gray-600 cursor-pointer"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {p.label}
                {isSoon && (
                  <span className="text-[9px] bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 font-semibold leading-none">
                    SOON
                  </span>
                )}
              </span>
              {isSelected && !isSoon && (
                <span
                  className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Category tabs (pill group) */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: "all" as Category, label: "All tokens", count: protocolData.length },
          { key: "stablecoins" as Category, label: "Stablecoins", count: stablecoinCount },
          { key: "non-stablecoins" as Category, label: "Other", count: otherCount },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setCategory(tab.key)}
            className={`text-sm px-4 py-1.5 rounded-md transition-colors cursor-pointer ${
              category === tab.key
                ? "bg-white text-[#303549] font-medium shadow-sm"
                : "text-gray-500 hover:text-[#303549]"
            }`}
          >
            {tab.label}
            {!loading && (
              <span className={`ml-1.5 text-xs ${category === tab.key ? "text-[#5382E3]" : "text-gray-400"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Token chips + network filter */}
      {!loading && tokens.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTokens(new Set())}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                activeTokens.size === 0
                  ? "bg-[#5382E3] text-white border-[#5382E3]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              All
            </button>
            {tokens.map((symbol) => (
              <button
                key={symbol}
                onClick={() => toggleToken(symbol)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                  activeTokens.has(symbol)
                    ? "bg-[#5382E3] text-white border-[#5382E3]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                <TokenIcon symbol={symbol} size={16} />
                {symbol}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 sm:ml-auto w-full sm:w-auto">
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-[#303549] outline-none focus:border-[#5382E3] cursor-pointer flex-1 sm:flex-none"
            >
              <option value="all">All networks</option>
              {networks.map((n) => (
                <option key={n.name} value={n.name}>{n.name}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {rows.length} result{rows.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* Loading: progress bar (+ skeleton if no rows yet) */}
      {loading && (
        <div className="space-y-4">
          <ProgressBar
            loaded={progress.loaded}
            total={progress.total}
            lastNetwork={progress.lastNetwork}
            protocols={progress.protocols}
          />
          {rows.length === 0 && <SkeletonTable />}
        </div>
      )}

      {/* Data table — desktop (show during loading too if rows are streaming in) */}
      {rows.length > 0 && (
        <>
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left font-medium text-gray-500 px-4 py-3">Token</th>
                    <th className="text-left font-medium text-gray-500 px-4 py-3">Network</th>
                    <th className="text-right font-medium text-gray-500 px-4 py-3 cursor-pointer select-none hover:text-[#303549]" onClick={() => handleSort("supplyAPY")}>
                      Base APY <SortIcon column="supplyAPY" />
                    </th>
                    <th className="text-right font-medium text-gray-500 px-4 py-3">Incentives</th>
                    <th className="text-right font-medium text-gray-500 px-4 py-3 cursor-pointer select-none hover:text-[#303549]" onClick={() => handleSort("totalSupplyAPY")}>
                      Total APY <SortIcon column="totalSupplyAPY" />
                    </th>
                    <th className="text-right font-medium text-gray-500 px-4 py-3 cursor-pointer select-none hover:text-[#303549]" onClick={() => handleSort("avgApy7d")}>
                      Avg 7D <SortIcon column="avgApy7d" />
                    </th>
                    <th className="text-right font-medium text-gray-500 px-4 py-3 cursor-pointer select-none hover:text-[#303549]" onClick={() => handleSort("avgApy30d")}>
                      Avg 30D <SortIcon column="avgApy30d" />
                    </th>
                    <th className="text-right font-medium text-gray-500 px-4 py-3 cursor-pointer select-none hover:text-[#303549]" onClick={() => handleSort("avgApy90d")}>
                      Avg 90D <SortIcon column="avgApy90d" />
                    </th>
                    <th className="text-right font-medium text-gray-500 px-4 py-3 cursor-pointer select-none hover:text-[#303549]" onClick={() => handleSort("variableBorrowAPY")}>
                      Borrow APY <SortIcon column="variableBorrowAPY" />
                    </th>
                    <th className="text-right font-medium text-gray-500 px-4 py-3 cursor-pointer select-none hover:text-[#303549]" onClick={() => handleSort("availableLiquidityUSD")}>
                      Liquidity <SortIcon column="availableLiquidityUSD" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isBest = row.totalSupplyAPY === bestAPYPerToken.get(row.symbol) && row.totalSupplyAPY > 0;
                    return (
                      <tr
                        key={`${row.symbol}-${row.networkId}-${i}`}
                        className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={row.protocolUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 group"
                          >
                            <TokenIcon symbol={row.symbol} size={28} />
                            <div className="flex flex-col">
                              <span className="font-medium text-[#303549] group-hover:text-[#5382E3] transition-colors">{row.symbol}</span>
                              {row.protocolLabel && (
                                <span className="text-[10px] text-gray-400 leading-tight truncate max-w-[140px]">{row.protocolLabel}</span>
                              )}
                            </div>
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Image src={row.networkLogo} alt={row.networkName} width={20} height={20} className="rounded-full" />
                            <span className="text-gray-600">{row.networkName}</span>
                            <span className={`text-[9px] rounded px-1.5 py-0.5 font-semibold leading-none ${
                              row.protocol === "morpho"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-pink-50 text-pink-500"
                            }`}>
                              {row.protocol === "morpho" ? "Morpho" : "Aave"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[#303549] tabular-nums">{formatAPY(row.supplyAPY)}</td>
                        <td className="px-4 py-3 text-right">
                          {row.merklSupplyAPR > 0 ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-green-600 tabular-nums">+{formatAPY(row.merklSupplyAPR)}</span>
                              {row.merklRewardTokens.length > 0 && (
                                <span className="text-[10px] bg-green-50 text-green-600 rounded px-1.5 py-0.5 font-medium">
                                  {row.merklRewardTokens.join(", ")}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold tabular-nums ${isBest ? "text-[#5382E3]" : "text-[#303549]"}`}>
                            {formatAPY(row.totalSupplyAPY)}
                          </span>
                          {isBest && (
                            <span className="ml-1.5 text-[9px] bg-blue-50 text-[#5382E3] rounded px-1.5 py-0.5 font-bold">BEST</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                          {row.avgApy7d != null ? formatAPY(row.avgApy7d) : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                          {row.avgApy30d != null ? formatAPY(row.avgApy30d) : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                          {row.avgApy90d != null ? formatAPY(row.avgApy90d) : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{formatAPY(row.variableBorrowAPY)}</td>
                        <td className="px-4 py-3 text-right text-gray-500 tabular-nums">${formatUSD(row.availableLiquidityUSD)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data cards — mobile */}
          <div className="sm:hidden space-y-2">
            {/* Mobile sort controls */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Sort by</span>
              {([
                { key: "totalSupplyAPY" as SortKey, label: "Total APY" },
                { key: "avgApy7d" as SortKey, label: "Avg 7D" },
                { key: "avgApy30d" as SortKey, label: "Avg 30D" },
                { key: "avgApy90d" as SortKey, label: "Avg 90D" },
                { key: "supplyAPY" as SortKey, label: "Base" },
                { key: "variableBorrowAPY" as SortKey, label: "Borrow" },
                { key: "availableLiquidityUSD" as SortKey, label: "Liquidity" },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleSort(s.key)}
                  className={`px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                    sortKey === s.key
                      ? "bg-[#5382E3] text-white border-[#5382E3]"
                      : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  {s.label}
                  {sortKey === s.key && (
                    <span className="ml-0.5">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </button>
              ))}
            </div>

            {rows.map((row, i) => {
              const isBest = row.totalSupplyAPY === bestAPYPerToken.get(row.symbol) && row.totalSupplyAPY > 0;
              return (
                <div
                  key={`m-${row.symbol}-${row.networkId}-${i}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                >
                  {/* Row 1: Token + Network */}
                  <div className="flex items-center justify-between">
                    <a
                      href={row.protocolUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 group"
                    >
                      <TokenIcon symbol={row.symbol} size={28} />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[#303549] group-hover:text-[#5382E3] transition-colors">{row.symbol}</span>
                          {isBest && (
                            <span className="text-[9px] bg-blue-50 text-[#5382E3] rounded px-1.5 py-0.5 font-bold">BEST</span>
                          )}
                        </div>
                        {row.protocolLabel && (
                          <span className="text-[10px] text-gray-400 leading-tight truncate max-w-[160px]">{row.protocolLabel}</span>
                        )}
                      </div>
                    </a>
                    <div className="flex items-center gap-1.5">
                      <Image src={row.networkLogo} alt={row.networkName} width={18} height={18} className="rounded-full" />
                      <span className="text-xs text-gray-500">{row.networkName}</span>
                      <span className={`text-[9px] rounded px-1.5 py-0.5 font-semibold leading-none ${
                        row.protocol === "morpho"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-pink-50 text-pink-500"
                      }`}>
                        {row.protocol === "morpho" ? "Morpho" : "Aave"}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: APY grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Base APY</p>
                      <p className="text-sm font-medium text-[#303549] tabular-nums">{formatAPY(row.supplyAPY)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total APY</p>
                      <p className={`text-sm font-semibold tabular-nums ${isBest ? "text-[#5382E3]" : "text-[#303549]"}`}>
                        {formatAPY(row.totalSupplyAPY)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Borrow</p>
                      <p className="text-sm text-gray-500 tabular-nums">{formatAPY(row.variableBorrowAPY)}</p>
                    </div>
                  </div>

                  {/* Row 3: Avg APY */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg 7D</p>
                      <p className="text-sm text-gray-500 tabular-nums">
                        {row.avgApy7d != null ? formatAPY(row.avgApy7d) : <span className="text-gray-300">–</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg 30D</p>
                      <p className="text-sm text-gray-500 tabular-nums">
                        {row.avgApy30d != null ? formatAPY(row.avgApy30d) : <span className="text-gray-300">–</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg 90D</p>
                      <p className="text-sm text-gray-500 tabular-nums">
                        {row.avgApy90d != null ? formatAPY(row.avgApy90d) : <span className="text-gray-300">–</span>}
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Incentives + Liquidity */}
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      {row.merklSupplyAPR > 0 ? (
                        <span className="flex items-center gap-1">
                          <span className="text-green-600 tabular-nums">+{formatAPY(row.merklSupplyAPR)}</span>
                          {row.merklRewardTokens.length > 0 && (
                            <span className="bg-green-50 text-green-600 rounded px-1.5 py-0.5 font-medium">
                              {row.merklRewardTokens.join(", ")}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">No incentives</span>
                      )}
                    </div>
                    <span className="text-gray-400 tabular-nums">${formatUSD(row.availableLiquidityUSD)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && rows.length === 0 && errors.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#303549]">Yield data temporarily unavailable</p>
            <p className="text-xs text-gray-400 mt-1">
              {errors.length} network{errors.length !== 1 ? "s" : ""} failed to respond — this is usually a temporary RPC issue.
            </p>
          </div>
          <button
            onClick={() => fetchYields(true, Array.from(selectedChains))}
            className="text-xs font-medium px-4 py-2 rounded-lg bg-[#5382E3] text-white hover:bg-[#4372D3] transition-colors cursor-pointer"
          >
            Retry now
          </button>
        </div>
      )}

      {!loading && rows.length === 0 && errors.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          No yields found for the selected filters.
        </div>
      )}
    </div>
  );
}
