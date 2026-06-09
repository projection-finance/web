"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PortfolioDashboard from "@/src/components/portofolio";
import TrackWallet from "@/src/components/trackWallet";
import { useAavePosition } from "@/src/hooks/useAavePosition";
import { useRecentWallets } from "@/src/hooks/useRecentWallets";
import Link from "next/link";
import { ChevronDown, Coins } from "lucide-react";
import { FaGithub } from "react-icons/fa6";

// ── Inline SVG icons for feature cards ──

const IconDashboard = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="4" rx="1" />
    <rect x="14" y="11" width="7" height="10" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconProjection = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconActions = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

const IconScenario = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20h20" />
    <path d="M5 20V9l4 4 3-7 4 6 4-8v16" />
  </svg>
);

const IconSave = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const IconTokens = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="7" />
    <circle cx="15" cy="15" r="7" />
  </svg>
);

// ── Fake dashboard preview ──

const FakeDashboardPreview = () => (
  <div className="mt-4 space-y-2">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-gray-400">Portfolio Value</span>
      <span className="font-semibold text-[#303549]">$124,850.32</span>
    </div>
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-gray-400">Supplied</span>
      <span className="font-semibold text-[#5382E3]">$189,200</span>
    </div>
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-gray-400">Borrowed</span>
      <span className="font-semibold text-[#303549]">$64,349</span>
    </div>
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-gray-400">Net APY</span>
      <span className="font-semibold text-green-600">+4.82%</span>
    </div>
    <div className="h-px bg-gray-200 my-1" />
    <div className="flex gap-2">
      {["WETH", "USDC", "WBTC"].map((t) => (
        <div key={t} className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5">
          <div className="w-3 h-3 rounded-full bg-[#5382E3]/20" />
          <span className="text-[10px] text-gray-500">{t}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Fake chart preview ──

const FakeChartPreview = () => (
  <div className="mt-4">
    <svg viewBox="0 0 200 60" className="w-full h-auto" fill="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5382E3" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#5382E3" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 45 Q20 40 40 35 T80 28 T120 22 T160 18 T200 12" stroke="#5382E3" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M0 45 Q20 40 40 35 T80 28 T120 22 T160 18 T200 12 V60 H0 Z" fill="url(#chartGrad)" />
      <path d="M0 50 Q30 48 60 46 T120 44 T180 42 T200 41" stroke="#A0AEC0" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
    </svg>
    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
      <span>Day 0</span>
      <span>Day 90</span>
      <span>Day 180</span>
      <span>Day 365</span>
    </div>
  </div>
);

// ── Fake actions preview ──

const FakeActionsPreview = () => (
  <div className="mt-4 space-y-1.5">
    {[
      { action: "Supply", token: "WETH", amount: "10.5", color: "text-[#5382E3]" },
      { action: "Borrow", token: "USDC", amount: "25,000", color: "text-orange-600" },
      { action: "Swap", token: "ETH → USDC", amount: "5.0", color: "text-sky-600" },
    ].map((a, i) => (
      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-md px-2.5 py-1.5">
        <div className={`text-[10px] font-semibold uppercase ${a.color} w-10`}>{a.action}</div>
        <div className="w-3 h-3 rounded-full bg-[#5382E3]/20 shrink-0" />
        <span className="text-[11px] text-gray-500">{a.amount} {a.token}</span>
        <span className="text-[10px] text-gray-400 ml-auto">Day {i * 30}</span>
      </div>
    ))}
  </div>
);

// ── Fake scenarios preview ──

const FakeScenariosPreview = () => (
  <div className="mt-4 space-y-2">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-red-100 border border-red-300" />
      <span className="text-[11px] text-gray-500">ETH price</span>
      <span className="text-[11px] font-medium text-red-500 ml-auto">$3,200 → $2,400</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300" />
      <span className="text-[11px] text-gray-500">Supply APY</span>
      <span className="text-[11px] font-medium text-green-600 ml-auto">3.2% → 5.8%</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-blue-100 border border-blue-300" />
      <span className="text-[11px] text-gray-500">BTC price</span>
      <span className="text-[11px] font-medium text-[#5382E3] ml-auto">Sinusoidal</span>
    </div>
    <div className="text-[10px] text-gray-400 mt-1 text-center">Prices & rates — fixed, linear, sinusoidal modes</div>
  </div>
);

// ── Fake save preview ──

const FakeSavePreview = () => (
  <div className="mt-4 space-y-1.5">
    {["Bull scenario — 365d", "Stress test — ETH crash", "Conservative — 90d"].map((name, i) => (
      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-md px-2.5 py-1.5">
        <div className="w-2 h-2 rounded-full bg-[#5382E3]" />
        <span className="text-[11px] text-[#303549] font-medium">{name}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{["2h ago", "Yesterday", "3d ago"][i]}</span>
      </div>
    ))}
    <div className="text-[10px] text-gray-400 mt-1 text-center">Auto-save & cloud sync</div>
  </div>
);

// ── Fake custom tokens preview ──

const FakeCustomTokensPreview = () => (
  <div className="mt-4 space-y-1.5">
    {[
      { symbol: "USDC", price: "Aave · Ethereum", apy: "5.2%" },
      { symbol: "WETH", price: "Morpho · Base", apy: "3.8%" },
    ].map((t, i) => (
      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-md px-2.5 py-1.5">
        <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-[8px] font-bold text-white">{t.symbol.slice(0, 2)}</span>
        </div>
        <span className="text-[11px] font-medium text-[#303549]">{t.symbol}</span>
        <span className="text-[10px] text-gray-400">{t.price}</span>
        <span className="text-[10px] text-green-600 ml-auto">{t.apy}</span>
      </div>
    ))}
    <div className="text-[10px] text-gray-400 mt-1 text-center">Browse yields across protocols & networks</div>
  </div>
);

// ── Coming soon icons ──

const IconTrend = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const IconSearch = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const IconFeed = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11a9 9 0 019 9" />
    <path d="M4 4a16 16 0 0116 16" />
    <circle cx="5" cy="19" r="1" />
  </svg>
);

// ── Coming soon fake previews ──

const FakeTrendPreview = () => (
  <div className="mt-4 space-y-1.5">
    {[
      { token: "ETH", change: "+4.2%", vol: "$18.3B", direction: "text-green-600" },
      { token: "WBTC", change: "-1.8%", vol: "$2.1B", direction: "text-red-500" },
      { token: "AAVE", change: "+12.6%", vol: "$890M", direction: "text-green-600" },
    ].map((t, i) => (
      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-md px-2.5 py-1.5">
        <div className="w-3 h-3 rounded-full bg-[#5382E3]/20 shrink-0" />
        <span className="text-[11px] font-medium text-[#303549]">{t.token}</span>
        <span className={`text-[10px] font-semibold ${t.direction}`}>{t.change}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{t.vol}</span>
      </div>
    ))}
    <div className="text-[10px] text-gray-400 mt-1 text-center">Real-time market trends & momentum</div>
  </div>
);

const FakeSearchPreview = () => (
  <div className="mt-4 space-y-1.5">
    <div className="flex items-center gap-2 bg-gray-50 rounded-md px-2.5 py-1.5 border border-gray-200">
      <span className="text-[11px] text-gray-400">Search protocols, tokens, markets...</span>
    </div>
    {[
      { label: "Aave V3 — Ethereum", type: "Lending", color: "bg-blue-100 text-blue-600" },
      { label: "Morpho — Base", type: "Vault", color: "bg-gray-200 text-gray-600" },
    ].map((r, i) => (
      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-md px-2.5 py-1.5">
        <span className={`text-[8px] font-bold rounded px-1.5 py-0.5 ${r.color}`}>{r.type}</span>
        <span className="text-[11px] font-medium text-[#303549]">{r.label}</span>
      </div>
    ))}
    <div className="text-[10px] text-gray-400 mt-1 text-center">Explore DeFi protocols & compare rates</div>
  </div>
);

const FakeFeedPreview = () => (
  <div className="mt-4 space-y-1.5">
    <div className="bg-gray-50 rounded-md px-2.5 py-2 border border-gray-100">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span className="text-[10px] font-medium text-[#303549]">Governance proposal #142</span>
        <span className="text-[9px] text-gray-400 ml-auto">2h ago</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded bg-[#5382E3]/15 flex items-center justify-center">
          <span className="text-[7px] font-bold text-[#5382E3]">AI</span>
        </div>
        <span className="text-[9px] text-gray-500 italic">LTV change for ETH — may affect your position</span>
      </div>
    </div>
    <div className="bg-gray-50 rounded-md px-2.5 py-2 border border-gray-100">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-[10px] font-medium text-[#303549]">USDC borrow rate updated</span>
        <span className="text-[9px] text-gray-400 ml-auto">5h ago</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded bg-[#5382E3]/15 flex items-center justify-center">
          <span className="text-[7px] font-bold text-[#5382E3]">AI</span>
        </div>
        <span className="text-[9px] text-gray-500 italic">Borrow cost -0.8% — consider switching protocol</span>
      </div>
    </div>
    <div className="text-[10px] text-gray-400 mt-1 text-center">Personalized feed with AI analysis</div>
  </div>
);

// ── Feature cards data ──

const features = [
  {
    icon: <IconDashboard />,
    title: "DeFi Position Dashboard",
    description: "Track portfolio value, supplies, borrows and yields across Aave, Spark, Compound, Morpho and the token sandbox.",
    preview: <FakeDashboardPreview />,
    free: true,
  },
  {
    icon: <IconProjection />,
    title: "Projection Timeline",
    description: "Visualize your position up to 365 days with compound interest accrual across protocols.",
    preview: <FakeChartPreview />,
    free: false,
  },
  {
    icon: <IconActions />,
    title: "Simulate Actions",
    description: "Supply, borrow, repay, swap — schedule any action on Day 0 or any future day of the timeline.",
    preview: <FakeActionsPreview />,
    free: true,
  },
  {
    icon: <IconScenario />,
    title: "Price & Rate Scenarios",
    description: "Override token prices and APY/APR rates to stress-test your position under any market conditions.",
    preview: <FakeScenariosPreview />,
    free: false,
  },
  {
    icon: <IconSave />,
    title: "Cloud Save & Load",
    description: "Save your full simulation setup and come back to it from any device. Auto-save included.",
    preview: <FakeSavePreview />,
    free: false,
  },
  {
    icon: <IconTokens />,
    title: "Yield Browser",
    description: "Browse Aave & Morpho yield opportunities and add them to your sandbox with one click.",
    preview: <FakeCustomTokensPreview />,
    free: false,
  },
];

const comingSoonFeatures = [
  {
    icon: <IconTrend />,
    title: "Market Trends",
    description: "Real-time price momentum, volume shifts and rate changes across DeFi markets — spot opportunities before they move.",
    preview: <FakeTrendPreview />,
  },
  {
    icon: <IconSearch />,
    title: "Search & Compare",
    description: "Search any protocol, token or market. Compare supply and borrow rates across chains to find the best yields.",
    preview: <FakeSearchPreview />,
  },
  {
    icon: <IconFeed />,
    title: "Feed + AI Analysis",
    description: "Personalized feed of governance proposals, rate changes and market events — each with AI analysis of how it impacts your position.",
    preview: <FakeFeedPreview />,
  },
];

// ── Protocol cards ──

const AaveCardIcon = () => (
  <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="aave-card-grad" x1="0" y1="0" x2="32" y2="32">
        <stop offset="0%" stopColor="#B6509E" />
        <stop offset="100%" stopColor="#2EBAC6" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="16" fill="url(#aave-card-grad)" />
    <text x="16" y="22" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="system-ui">A</text>
  </svg>
);

function ProtocolCardDot({ color, letter }: { color: string; letter: string }) {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill={color} />
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="system-ui">{letter}</text>
    </svg>
  );
}

interface ProtocolCard {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  borderColor: string;
  active: boolean;
}

const protocolCards: ProtocolCard[] = [
  { id: "aave", label: "Aave V3", href: "/", icon: <AaveCardIcon />, borderColor: "#B6509E", active: true },
  { id: "sandbox", label: "Portfolio Sandbox", href: "/tokens", icon: <Coins className="w-8 h-8 text-[#4F7FFA]" />, borderColor: "#4F7FFA", active: true },
  { id: "morpho", label: "Morpho Vaults", href: "/morpho", icon: <ProtocolCardDot color="#1E2B3A" letter="M" />, borderColor: "#1E2B3A", active: true },
  { id: "morpho-blue", label: "Morpho Blue", href: "/morpho-blue", icon: <ProtocolCardDot color="#4F46E5" letter="B" />, borderColor: "#4F46E5", active: true },
  { id: "compound", label: "Compound V3", href: "/compound", icon: <ProtocolCardDot color="#00D395" letter="C" />, borderColor: "#00D395", active: true },
  { id: "spark", label: "Spark", href: "/?network=SPARK_V3", icon: <ProtocolCardDot color="#F58220" letter="S" />, borderColor: "#F58220", active: true },
  { id: "uniswap", label: "Uniswap V3", href: "/uniswap", icon: <ProtocolCardDot color="#FF007A" letter="U" />, borderColor: "#FF007A", active: true },
  { id: "fluid", label: "Fluid", icon: <ProtocolCardDot color="#5B5FEF" letter="F" />, borderColor: "#5B5FEF", active: false },
  { id: "venus", label: "Venus", icon: <ProtocolCardDot color="#F2C94C" letter="V" />, borderColor: "#F2C94C", active: false },
  { id: "fx", label: "f(x) Protocol", icon: <ProtocolCardDot color="#E14B4B" letter="f" />, borderColor: "#E14B4B", active: false },
];

// ── Unified projection card ──

type ProjectionMode = "sandbox" | "aave" | "morpho" | "morpho-blue" | "compound" | "spark" | "uniswap";

const PROJECTION_MODES: { id: ProjectionMode; label: string; icon: React.ReactNode; description: string; color: string; disabled?: boolean }[] = [
  {
    id: "sandbox",
    label: "Portfolio Sandbox",
    icon: <Coins className="w-4 h-4 text-[#4F7FFA]" />,
    description: "Build any token portfolio with CoinGecko tokens, price scenarios and yield positions.",
    color: "#4F7FFA",
  },
  {
    id: "aave",
    label: "Aave V3",
    icon: <AaveCardIcon />,
    description: "Simulate your Aave supplies, borrows, health factor and liquidation risk.",
    color: "#B6509E",
  },
  {
    id: "morpho",
    label: "Morpho",
    icon: <ProtocolCardDot color="#1E2B3A" letter="M" />,
    description: "Simulate your Morpho vault positions and yield projections.",
    color: "#1E2B3A",
  },
  {
    id: "morpho-blue",
    label: "Morpho Blue",
    icon: <ProtocolCardDot color="#4F46E5" letter="B" />,
    description: "Simulate your Morpho Blue lending positions with isolated markets.",
    color: "#4F46E5",
  },
  {
    id: "compound",
    label: "Compound V3",
    icon: <ProtocolCardDot color="#00D395" letter="C" />,
    description: "Simulate your Compound V3 supply, borrow and collateral positions.",
    color: "#00D395",
  },
  {
    id: "spark",
    label: "Spark",
    icon: <ProtocolCardDot color="#F58220" letter="S" />,
    description: "Temporarily unavailable — on-chain data providers are not responding.",
    color: "#F58220",
    disabled: true,
  },
  {
    id: "uniswap",
    label: "Uniswap V3",
    icon: <ProtocolCardDot color="#FF007A" letter="U" />,
    description: "Simulate concentrated liquidity positions — fees, IL, and net PnL.",
    color: "#FF007A",
  },
];

const SCRATCH_HREFS: Record<ProjectionMode, string> = {
  sandbox: "/tokens",
  aave: "/?sandbox=true",
  morpho: "/morpho?sandbox=true",
  "morpho-blue": "/morpho-blue?sandbox=true",
  compound: "/compound?sandbox=true",
  spark: "/?sandbox=true&network=SPARK_V3",
  uniswap: "/uniswap",
};

const WALLET_HREFS: Record<ProjectionMode, string | null> = {
  sandbox: "/tokens",
  aave: null,
  morpho: "/morpho",
  "morpho-blue": "/morpho-blue",
  compound: "/compound",
  spark: null, // Spark uses the Aave dashboard with network=SPARK_V3
  uniswap: null, // Uniswap is simulator-only, no wallet scan
};

function UnifiedProjectionCard({
  isLoading,
  error,
  onFetch,
}: {
  isLoading: boolean;
  error: string;
  onFetch: (address: string, ensName?: string, network?: import("@/src/lib/aave/networks").NetworkId) => void;
}) {
  const [mode, setMode] = useState<ProjectionMode>("sandbox");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showWalletInput, setShowWalletInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeMode = PROJECTION_MODES.find((m) => m.id === mode)!;

  // Reset wallet input when mode changes
  useEffect(() => {
    setShowWalletInput(false);
  }, [mode]);

  // Close dropdown on click outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="max-w-lg mx-auto mb-6">
      <div className="bg-white rounded-2xl border-2 p-5 transition-colors" style={{ borderColor: `${activeMode.color}30` }}>
        {/* Mode selector */}
        <div className="mb-4" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-[#F5F5FA] hover:bg-[#EDEDF3] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${activeMode.color}10` }}>
                  {mode === "sandbox" ? <Coins className="w-5 h-5" style={{ color: activeMode.color }} /> : activeMode.icon}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#303549]">{activeMode.label}</p>
                  <p className="text-[11px] text-gray-500 leading-snug">{activeMode.description}</p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {PROJECTION_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { if (!m.disabled) { setMode(m.id); setDropdownOpen(false); } }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      m.disabled ? "opacity-50 cursor-not-allowed" : m.id === mode ? "bg-[#F5F5FA]" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${m.color}10` }}>
                      {m.id === "sandbox" ? <Coins className="w-4 h-4" style={{ color: m.color }} /> : m.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#303549]">{m.label}{m.disabled && <span className="ml-1.5 text-[9px] font-medium text-orange-500 bg-orange-50 rounded px-1 py-0.5">Unavailable</span>}</p>
                      <p className="text-[10px] text-gray-400 leading-snug">{m.description}</p>
                    </div>
                    {m.id === mode && !m.disabled && (
                      <div className="ml-auto w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    )}
                  </button>
                ))}

                {/* Coming soon */}
                <div className="border-t border-gray-100 px-3 py-2 flex flex-wrap gap-1.5">
                  {[
                    { label: "Fluid", color: "#5B5FEF" },
                  ].map((p) => (
                    <div key={p.label} className="flex items-center gap-1 bg-gray-50 rounded-full px-2 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[10px] text-gray-400">{p.label}</span>
                      <span className="text-[7px] bg-amber-100 text-amber-700 rounded px-0.5 font-bold">SOON</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Two equal paths: Scan wallet / Start from scratch */}
        {!showWalletInput ? (
          <div className="grid grid-cols-2 gap-3">
            {/* Scan wallet */}
            {WALLET_HREFS[mode] ? (
              <Link href={WALLET_HREFS[mode]!}>
                <button className="w-full h-11 rounded-lg border-2 border-gray-200 hover:border-gray-300 text-[#303549] text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4h-4z" /></svg>
                  Scan wallet
                </button>
              </Link>
            ) : (
              <button
                onClick={() => setShowWalletInput(true)}
                className="w-full h-11 rounded-lg border-2 border-gray-200 hover:border-gray-300 text-[#303549] text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4h-4z" /></svg>
                Scan wallet
              </button>
            )}

            {/* Start from scratch */}
            <Link href={SCRATCH_HREFS[mode]}>
              <button
                className="w-full h-11 rounded-lg text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: activeMode.color }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Start from scratch
              </button>
            </Link>
          </div>
        ) : (
          /* Inline wallet input (Aave) */
          <div className="space-y-3">
            <TrackWallet
              isLoading={isLoading}
              error={error}
              onFetch={onFetch}
            />
            <button
              onClick={() => setShowWalletInput(false)}
              className="w-full text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rotating hero subjects ──

const heroSubjects = [
  { text: "token portfolio", color: "text-[#4F7FFA]" },
  { text: "Aave V3 position", color: "text-[#B6509E]" },
  { text: "DeFi strategy", color: "text-[#5382E3]" },
  { text: "yield scenario", color: "text-emerald-600" },
  { text: "price simulation", color: "text-[#303549]" },
];

function useRotatingSubject() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase("out");
      setTimeout(() => {
        setIndex((i) => (i + 1) % heroSubjects.length);
        setPhase("in");
      }, 300);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return { subject: heroSubjects[index], phase };
}

// ── Rotating hero scenarios ──

const heroScenarios = [
  { text: "ETH doubles in 90 days", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
  { text: "WBTC pumps to $200k", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
  { text: "USDC supply APY hits 12%", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
  { text: "AAVE rallies 3x this quarter", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
  { text: "you supply 10 more WBTC", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
  { text: "ETH dips 15% this week", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  { text: "WBTC corrects 10% overnight", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  { text: "you borrow USDC at 3% APY", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
  { text: "your net APY goes above 8%", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
];

function useRotatingScenario() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase("out");
      setTimeout(() => {
        setIndex((i) => (i + 1) % heroScenarios.length);
        setPhase("in");
      }, 350);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return { scenario: heroScenarios[index], phase };
}

// ── Main page ──

const HomeContent = () => {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { position, isLoading, error, currentNetwork, fetchPosition, fetchEmptyPosition, clearPosition } = useAavePosition();
  const { addRecentWallet } = useRecentWallets();
  const hasFetchedRef = useRef(false);

  const walletParam = searchParams.get("wallet");
  const ensParam = searchParams.get("ens");
  const networkParam = searchParams.get("network");
  const projectionParam = searchParams.get("projection");
  const sidParam = searchParams.get("sid");
  const sandboxParam = searchParams.get("sandbox");

  // Auto-enter sandbox mode via URL param
  useEffect(() => {
    if (sandboxParam === "true" && !walletParam && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      const network = (networkParam as import("@/src/lib/aave/networks").NetworkId) || "ETHEREUM_V3";
      fetchEmptyPosition(network);
    }
  }, [sandboxParam, walletParam, networkParam, fetchEmptyPosition]);

  useEffect(() => {
    if (walletParam && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      const network = (networkParam as import("@/src/lib/aave/networks").NetworkId) || "ETHEREUM_V3";
      fetchPosition(walletParam, network);
      addRecentWallet(walletParam, ensParam ?? undefined);
    }
  }, [walletParam, ensParam, networkParam, fetchPosition, addRecentWallet]);

  const handleFetch = useCallback(
    (address: string, ens?: string, network?: import("@/src/lib/aave/networks").NetworkId) => {
      const net = network || currentNetwork || "ETHEREUM_V3";
      const params = new URLSearchParams({ wallet: address });
      if (ens) params.set("ens", ens);
      if (net !== "ETHEREUM_V3") params.set("network", net);
      router.push(`/?${params.toString()}`);
      fetchPosition(address, net);
      addRecentWallet(address, ens);
    },
    [router, fetchPosition, currentNetwork, addRecentWallet]
  );

  const handleClear = useCallback(() => {
    clearPosition();
    hasFetchedRef.current = false;
    router.push("/");
  }, [clearPosition, router]);

  const { scenario, phase } = useRotatingScenario();
  const { subject: heroSubject, phase: heroSubjectPhase } = useRotatingSubject();

  if ((walletParam || sandboxParam === "true") && !position && (isLoading || !error)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <img
          src="/favicon.svg"
          alt="logo"
          width={40}
          height={40}
          className="animate-pulse"
        />
        <p className="text-sm text-gray-400">
          {sandboxParam === "true" ? "Loading market data..." : "Loading your position..."}
        </p>
      </div>
    );
  }

  if (position) {
    return (
      <div className="flex-1 w-full">
        <PortfolioDashboard
          position={position}
          isLoading={isLoading}
          projectionId={projectionParam ?? undefined}
          sessionId={sidParam ?? undefined}
          ensName={ensParam ?? undefined}
          networkId={currentNetwork}
          onChangeWallet={handleFetch}
          onClear={handleClear}
        />
      </div>
    );
  }

  // ── Logged-in: intermediate hero + two-panel choice ──
  if (session?.user) {
    return (
      <div className="max-w-3xl mx-auto pt-6">
        {/* Intermediate hero */}
        <div className="text-center mb-8">
          <h1 className="text-lg sm:text-xl font-bold text-[#303549] tracking-tight">
            Simulate your{" "}
            <span
              className={`
                ${heroSubject.color}
                inline-block transition-all duration-300 ease-out
                ${heroSubjectPhase === "in"
                  ? "opacity-100 translate-y-0 blur-0"
                  : "opacity-0 translate-y-1 blur-[2px]"
                }
              `}
            >
              {heroSubject.text}
            </span>{" "}
            before you act
          </h1>
          <p className="text-sm text-[#303549]/60 mt-1.5 leading-relaxed">
            What happens if{" "}
            <span
              className={`
                ${scenario.color} ${scenario.bg} ${scenario.border}
                inline-block border rounded-md px-1.5 py-0.5 font-bold text-sm
                transition-all duration-300 ease-out
                ${phase === "in"
                  ? "opacity-100 translate-y-0 blur-0 scale-100"
                  : "opacity-0 translate-y-1.5 blur-[2px] scale-[0.97]"
                }
              `}
            >
              {scenario.text}
            </span>
            <span className="text-[#303549]/60">&#8202;?</span>
          </p>
        </div>

        {/* Unified projection card */}
        <UnifiedProjectionCard
          isLoading={isLoading}
          error={error}
          onFetch={handleFetch}
        />

      </div>
    );
  }

  // ── Landing page (not logged in) ──
  return (
    <div className="max-w-5xl mx-auto">
      {/* Desktop recommendation on mobile */}
      <div className="md:hidden flex items-center gap-2 bg-[#303549] text-white rounded-lg px-3 py-2 mb-4 text-xs">
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
        <span>For the best experience, use Projection Finance on a desktop computer. Projections and simulations are optimized for larger screens.</span>
      </div>

      {/* Hero */}
      <div className="text-center pt-3 pb-3 sm:pt-4 sm:pb-4 md:pt-5 md:pb-5">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#303549] tracking-tight">
          Simulate your{" "}
          <span
            className={`
              ${heroSubject.color}
              inline-block transition-all duration-300 ease-out
              ${heroSubjectPhase === "in"
                ? "opacity-100 translate-y-0 blur-0"
                : "opacity-0 translate-y-1 blur-[2px]"
              }
            `}
          >
            {heroSubject.text}
          </span>{" "}
          before you act
        </h1>
        <h2 className="text-sm sm:text-base md:text-lg font-medium text-[#303549]/60 mt-1.5 sm:mt-2 leading-relaxed">
          What happens if{" "}
          <span
            className={`
              ${scenario.color} ${scenario.bg} ${scenario.border}
              inline-block border rounded-md px-2 py-0.5 font-bold text-sm sm:text-base md:text-lg
              transition-all duration-300 ease-out
              ${phase === "in"
                ? "opacity-100 translate-y-0 blur-0 scale-100"
                : "opacity-0 translate-y-1.5 blur-[2px] scale-[0.97]"
              }
            `}
          >
            {scenario.text}
          </span>
          <span className="text-[#303549]/60">&#8202;?</span>
        </h2>
      </div>

      {/* Open source */}
      <div className="mx-auto mb-3 sm:mb-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 sm:px-5 py-2.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <span className="text-[11px] sm:text-[12px] text-gray-600"><span className="text-[#303549] font-semibold">100% free &amp; open-source</span> — every feature, unlimited, for everyone. No subscriptions, no paywalls.</span>
            <a href="https://github.com/projection-finance/web" target="_blank" rel="noopener noreferrer" className="sm:ml-auto inline-flex items-center gap-1.5 bg-[#303549] hover:bg-[#1e2333] text-white font-semibold text-xs rounded-lg px-3 py-1.5 transition-colors shrink-0">
              <FaGithub className="w-3.5 h-3.5" /> View on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Credibility + Markets */}
      <div className="max-w-2xl mx-auto mb-3 sm:mb-4">
        {/* Backed by */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <span className="text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Backed by</span>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 sm:px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-[#B6509E]" />
            <span className="text-[11px] sm:text-[12px] font-medium text-[#303549]">Aave Grants</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 sm:px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-[#4285F4]" />
            <span className="text-[11px] sm:text-[12px] font-medium text-[#303549]">Google for Startups</span>
          </div>
        </div>

        {/* Markets — compact single line */}
        <div className="flex items-center justify-center gap-1 flex-wrap px-2">
          <div className="flex items-center gap-1.5 bg-[#303549] text-white rounded-full px-2.5 py-1 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-semibold">Aave V3</span>
            <span className="text-[9px] text-gray-300">17 networks</span>
          </div>
          {["Ethereum", "Arbitrum", "Base", "Optimism", "Polygon", "Avalanche", "BNB Chain", "Scroll", "ZKsync", "Linea", "Gnosis", "Metis", "Sonic", "Celo", "Mantle", "Soneium", "Ink"].map((chain) => (
            <span key={chain} className="text-[9px] text-gray-400 font-medium">{chain}</span>
          )).reduce<React.ReactNode[]>((acc, el, i) => [...acc, ...(i > 0 ? [<span key={`sep-${i}`} className="text-[8px] text-gray-300">·</span>] : []), el], [])}
        </div>
      </div>

      {/* Supported Protocols */}
      <div className="max-w-2xl mx-auto mb-3 sm:mb-4">
        <div className="text-center mb-2">
          <span className="text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Supported Protocols</span>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {protocolCards.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 border ${
                p.active
                  ? "bg-white border-gray-200"
                  : "bg-white border-gray-100 opacity-50"
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <svg width={16} height={16} viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill={p.borderColor} />
                </svg>
              </div>
              <span className={`text-[11px] font-medium ${p.active ? "text-[#303549]" : "text-gray-400"}`}>
                {p.label}
              </span>
              {!p.active && (
                <span className="text-[8px] bg-amber-100 text-amber-700 rounded px-1 py-0.5 font-bold leading-none">SOON</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Unified projection card */}
      <div className="mb-5 sm:mb-6">
        {/* Mobile: show message */}
        <div className="md:hidden max-w-xl mx-auto bg-white rounded-2xl border border-gray-200 px-4 py-4">
          <div className="text-center py-4">
            <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            <p className="text-sm font-medium text-[#303549] mb-1">Desktop required</p>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              Projections, simulations and portfolio management need a larger screen. Open Projection Finance on your computer to get started.
            </p>
          </div>
        </div>
        {/* Desktop: unified card */}
        <div className="hidden md:block">
          <UnifiedProjectionCard
            isLoading={isLoading}
            error={error}
            onFetch={handleFetch}
          />
        </div>
      </div>

      {/* Features grid */}
      <div className="mb-6">
        <div className="text-center mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-[#303549]">Everything you need to plan ahead</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1.5">
            Free and open-source. Every feature unlocked, no limits.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {features.map((feat, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-[#5382E3]/10 flex items-center justify-center text-[#5382E3] shrink-0">
                  {feat.icon}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-semibold text-[#303549] truncate">{feat.title}</h3>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{feat.description}</p>
              <div className="hidden sm:block">{feat.preview}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Coming Soon */}
      <div className="mb-6 mt-6 sm:mt-10">
        <div className="text-center mb-5 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-bold text-[#303549]">Coming soon</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1.5">
            Features we are actively building. Stay tuned.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {comingSoonFeatures.map((feat, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-dashed border-gray-300 p-4 sm:p-5 flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-3 right-3">
                <span className="bg-amber-100 text-amber-700 text-[8px] font-bold rounded px-1.5 py-0.5 leading-none">
                  SOON
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                  {feat.icon}
                </div>
                <h3 className="text-sm font-semibold text-[#303549] truncate">{feat.title}</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{feat.description}</p>
              <div className="hidden sm:block">{feat.preview}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Changelog */}
      <div className="mt-6 sm:mt-10 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
          <h3 className="text-sm font-bold text-[#303549] mb-3 sm:mb-4">Recent updates</h3>
          <div className="space-y-2.5 sm:space-y-3">
            {[
              { date: "Mar 11, 2026", title: "Monitoring: per-network selection", desc: "Add wallets directly from the monitoring page, pick specific networks to track per wallet" },
              { date: "Mar 10, 2026", title: "Portfolio Sandbox", desc: "Build a portfolio from scratch or import real holdings from any wallet — simulate its evolution over time" },
              { date: "Mar 9, 2026", title: "17 Aave V3 networks", desc: "Full coverage across Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche, BNB, Scroll, ZKsync, Linea, Gnosis, Metis, Sonic, Celo, Mantle, Soneium & Ink" },
              { date: "Mar 8, 2026", title: "Error reporting & reliability", desc: "Automatic error detection with instant notifications — faster fixes, smoother experience" },
              { date: "Feb 20, 2026", title: "Cloud save & load", desc: "Save your full simulation setup and reload it from any device" },
            ].map((entry, i) => (
              <div key={i} className="flex gap-2 sm:gap-3 items-start">
                <span className="text-[10px] sm:text-[11px] text-gray-500 font-mono w-20 sm:w-24 shrink-0 pt-0.5">{entry.date}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-[#5382E3] shrink-0 mt-1.5" />
                <div className="min-w-0">
                  <p className="text-[12px] sm:text-[13px] font-medium text-[#303549] leading-tight">{entry.title}</p>
                  <p className="text-[10px] sm:text-[11px] text-gray-500 leading-snug mt-0.5">{entry.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-5 sm:py-8">
        <p className="text-[11px] sm:text-xs text-gray-500">
          Read-only simulation. We never ask for private keys or wallet signatures.
        </p>
      </div>
    </div>
  );
};

const Home = () => {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
};

export default Home;
