"use client";

import "../../src/app/globals.css";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Activity, ChevronDown, Coins, Home, LogOut, Menu, Play, Radar, TrendingUp, User, Wallet } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/src/components/ui/sheet";
import Image from "next/image";
import Link from "next/link";
import { PiArrowBendUpRight } from "react-icons/pi";
import { HiOutlinePresentationChartLine } from "react-icons/hi2";
import ProtocolModal, { type ProtocolConfig } from "@/src/components/ProtocolModal";

import AaveIcon from "@/src/components/icons/AaveIcon";

// ── Protocol definitions ──

interface Protocol {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  color: string;
  active: boolean;
}

const startEntry: Protocol = {
  id: "start",
  label: "Simulate",
  href: "/",
  icon: <Play className="w-[18px] h-[18px] text-[#5382E3]" />,
  color: "#5382E3",
  active: true,
};

const protocols: Protocol[] = [
  { id: "sandbox", label: "Portfolio Sandbox", href: "/tokens", icon: <Coins className="w-[18px] h-[18px] text-[#4F7FFA]" />, color: "#4F7FFA", active: true },
  { id: "aave", label: "Aave V3", href: "/", icon: <AaveIcon size={18} />, color: "#B6509E", active: true },
  { id: "morpho", label: "Morpho Vaults", icon: <ProtocolDot color="#1E2B3A" letter="M" />, color: "#1E2B3A", active: true },
  { id: "morpho-blue", label: "Morpho Blue", href: "/morpho-blue", icon: <ProtocolDot color="#4F46E5" letter="B" />, color: "#4F46E5", active: false },
  { id: "compound", label: "Compound V3", href: "/compound", icon: <ProtocolDot color="#00D395" letter="C" />, color: "#00D395", active: false },
  { id: "spark", label: "Spark", href: "/?network=SPARK_V3", icon: <ProtocolDot color="#F58220" letter="S" />, color: "#F58220", active: false },
  { id: "uniswap", label: "Uniswap V3", href: "/uniswap", icon: <ProtocolDot color="#FF007A" letter="U" />, color: "#FF007A", active: false },
  { id: "fluid", label: "Fluid", icon: <ProtocolDot color="#5B5FEF" letter="F" />, color: "#5B5FEF", active: false },
  { id: "venus", label: "Venus", icon: <ProtocolDot color="#F2C94C" letter="V" />, color: "#F2C94C", active: false },
  { id: "fx", label: "f(x) Protocol", icon: <ProtocolDot color="#E14B4B" letter="f" />, color: "#E14B4B", active: false },
];

function ProtocolDot({ color, letter }: { color: string; letter: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill={color} />
      <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">{letter}</text>
    </svg>
  );
}

function useActiveProtocol(): Protocol {
  const pathname = usePathname();
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    setHasWallet(typeof window !== "undefined" && new URLSearchParams(window.location.search).has("wallet"));
  }, [pathname]);

  if (pathname.startsWith("/tokens")) return protocols[0]; // Portfolio Sandbox
  if (pathname.startsWith("/morpho-blue")) return protocols[3]; // Morpho Blue
  if (pathname.startsWith("/morpho")) return protocols[2]; // Morpho Vaults
  if (pathname.startsWith("/compound")) return protocols[4]; // Compound V3
  if (pathname.startsWith("/uniswap")) return protocols[6]; // Uniswap V3
  // On home with a wallet loaded → Aave V3 (or Spark if network=SPARK_V3)
  if (pathname === "/" && hasWallet) return protocols[1]; // Aave V3
  // On home without wallet → neutral "Simulate" entry
  return startEntry;
}

// ── Protocol modal configs (polymorphic — add new protocols here) ──

const protocolModalConfigs: Record<string, ProtocolConfig> = {
  aave: {
    id: "aave",
    name: "Aave V3",
    description: "Simulate your Aave V3 position on any supported network",
    icon: <AaveIcon size={22} />,
    gradient: "from-[#B6509E] to-[#2EBAC6]",
    accentColor: "#B6509E",
    placeholder: "0x... or vitalik.eth",
    supportsNetwork: true,
    sandboxUrl: "/?sandbox=true",
    sandboxLabel: "Start from scratch",
    navigateTo: (address, ens, network) => {
      const params = new URLSearchParams({ wallet: address });
      if (ens) params.set("ens", ens);
      if (network && network !== "ETHEREUM_V3") params.set("network", network);
      return `/?${params.toString()}`;
    },
  },
  morpho: {
    id: "morpho",
    name: "Morpho",
    description: "Simulate your Morpho vault positions on Ethereum & Base",
    icon: <ProtocolDot color="#1E2B3A" letter="M" />,
    gradient: "from-[#1E2B3A] to-[#3B5998]",
    accentColor: "#1E2B3A",
    placeholder: "0x... or vitalik.eth",
    supportsNetwork: false,
    sandboxUrl: "/morpho?sandbox=true",
    sandboxLabel: "Start from scratch",
    navigateTo: (address, ens) => {
      const params = new URLSearchParams({ wallet: address });
      if (ens) params.set("ens", ens);
      return `/morpho?${params.toString()}`;
    },
  },
  "morpho-blue": {
    id: "morpho-blue",
    name: "Morpho Blue",
    description: "Simulate your Morpho Blue lending positions on Ethereum & Base",
    icon: <ProtocolDot color="#4F46E5" letter="B" />,
    gradient: "from-[#4F46E5] to-[#3730A3]",
    accentColor: "#4F46E5",
    placeholder: "0x... or vitalik.eth",
    supportsNetwork: false,
    sandboxUrl: "/morpho-blue?sandbox=true",
    sandboxLabel: "Start from scratch",
    navigateTo: (address, ens) => {
      const params = new URLSearchParams({ wallet: address });
      if (ens) params.set("ens", ens);
      return `/morpho-blue?${params.toString()}`;
    },
  },
  compound: {
    id: "compound",
    name: "Compound V3",
    description: "Simulate your Compound V3 positions across Ethereum, Base, Arbitrum, Optimism & Polygon",
    icon: <ProtocolDot color="#00D395" letter="C" />,
    gradient: "from-[#00D395] to-[#00A876]",
    accentColor: "#00D395",
    placeholder: "0x... or vitalik.eth",
    supportsNetwork: false,
    sandboxUrl: "/compound?sandbox=true",
    sandboxLabel: "Start from scratch",
    navigateTo: (address, ens) => {
      const params = new URLSearchParams({ wallet: address });
      if (ens) params.set("ens", ens);
      return `/compound?${params.toString()}`;
    },
  },
  spark: {
    id: "spark",
    name: "Spark",
    description: "Simulate your Spark (MakerDAO) lending position on Ethereum",
    icon: <ProtocolDot color="#F58220" letter="S" />,
    gradient: "from-[#F58220] to-[#D46A10]",
    accentColor: "#F58220",
    placeholder: "0x... or vitalik.eth",
    supportsNetwork: false,
    sandboxUrl: "/?sandbox=true&network=SPARK_V3",
    sandboxLabel: "Start from scratch",
    navigateTo: (address, ens) => {
      const params = new URLSearchParams({ wallet: address, network: "SPARK_V3" });
      if (ens) params.set("ens", ens);
      return `/?${params.toString()}`;
    },
  },
};

const Header = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [modalProtocol, setModalProtocol] = useState<ProtocolConfig | null>(null);

  const current = useActiveProtocol();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home", icon: Home, exact: true },
    { href: "/wallets", label: "Wallets", icon: Wallet },
    { href: "/projections", label: "Projections", icon: HiOutlinePresentationChartLine },
    { href: "/monitoring", label: "Monitoring", icon: Activity },
    { href: "/radar", label: "Radar", icon: Radar },
    { href: "/yields", label: "Yields", icon: TrendingUp },
  ];

  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b bg-white">
      {/* Left: logo + nav */}
      <div className="flex items-center gap-3 md:gap-6">
        {/* Mobile hamburger */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger className="md:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5 text-[#303549]" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="pl-5 pr-10 pt-5 pb-3 border-b">
              <SheetTitle className="flex items-center gap-2">
                <Image src="/logo.svg" alt="Projection Finance" width={160} height={40} className="h-8 w-auto max-w-full" />
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col py-2 h-full">
              {/* Nav items */}
              <div className="px-4 py-2">
                {navItems.map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-[#ECECF5] text-[#303549] font-medium"
                          : "text-gray-600 hover:text-[#303549] hover:bg-gray-50"
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              {/* Account section */}
              <div className="mt-auto border-t px-4 py-3">
                {session?.user ? (
                  <>
                    <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
                      {session.user.image ? (
                        <Image src={session.user.image} alt="avatar" width={28} height={28} className="rounded-full" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#5382E3] flex items-center justify-center text-white text-xs font-medium">
                          {(session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-[#303549] truncate">
                          {session.user.name || session.user.email}
                        </span>
                        {session.user.name && session.user.email && (
                          <span className="text-xs text-gray-400 truncate">{session.user.email}</span>
                        )}
                      </div>
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-gray-600 hover:text-[#303549] hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Account
                    </Link>
                    <button
                      onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: "/sign-in" }); }}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/sign-in"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-[#5382E3] hover:bg-blue-50 transition-colors"
                  >
                    <PiArrowBendUpRight className="w-4 h-4" />
                    Sign In / Sign Up
                  </Link>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/" className="shrink-0 flex items-center gap-2">
          {/* Icon only on mobile */}
          <Image
            src="/logo-icon.svg"
            alt="Projection Finance"
            width={36}
            height={36}
            className="h-8 w-8 md:hidden"
          />
          {/* Full logo on desktop */}
          <Image
            src="/logo.svg"
            alt="Projection Finance"
            width={220}
            height={60}
            className="hidden md:block h-10 w-auto object-contain"
          />
          <span className="bg-amber-500 text-white text-[9px] font-bold rounded px-1.5 py-0.5 leading-none hidden md:inline">
            BETA
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {/* Protocol Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-[#ECECF5] text-[#303549] hover:bg-[#E0E0EE] transition-colors outline-none cursor-pointer">
              {current.icon}
              <span>{current.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {/* Home entry */}
              <Link href="/">
                <DropdownMenuItem className={`cursor-pointer gap-2.5 ${current.id === "start" ? "bg-[#ECECF5]" : ""}`}>
                  <span className="shrink-0">{startEntry.icon}</span>
                  <span className="text-sm font-medium text-[#303549]">{startEntry.label}</span>
                  {current.id === "start" && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: startEntry.color }} />
                  )}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                Protocols
              </DropdownMenuLabel>
              {protocols.filter((p) => p.active).map((p) => {
                const isActive = p.id === current.id;
                const modalConfig = protocolModalConfigs[p.id];

                if (modalConfig) {
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      className={`cursor-pointer gap-2.5 ${isActive ? "bg-[#ECECF5]" : ""}`}
                      onClick={() => setModalProtocol(modalConfig)}
                    >
                      <span className="shrink-0">{p.icon}</span>
                      <span className="text-sm font-medium text-[#303549]">{p.label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                      )}
                    </DropdownMenuItem>
                  );
                }

                return (
                  <Link key={p.id} href={p.href!}>
                    <DropdownMenuItem className={`cursor-pointer gap-2.5 ${isActive ? "bg-[#ECECF5]" : ""}`}>
                      <span className="shrink-0">{p.icon}</span>
                      <span className="text-sm font-medium text-[#303549]">{p.label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                      )}
                    </DropdownMenuItem>
                  </Link>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                Coming Soon
              </DropdownMenuLabel>
              {protocols.filter((p) => !p.active).map((p) => (
                <DropdownMenuItem key={p.id} disabled className="gap-2.5 opacity-50">
                  <span className="shrink-0">{p.icon}</span>
                  <span className="text-sm text-gray-400">{p.label}</span>
                  <span className="ml-auto text-[9px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-semibold leading-none">
                    SOON
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Remaining nav items */}
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-[#ECECF5] text-[#303549] font-medium"
                    : "text-gray-500 hover:text-[#303549] hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: user */}
      <div className="flex items-center gap-2">
        {session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 outline-none cursor-pointer">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt="avatar"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#5382E3] flex items-center justify-center text-white text-sm font-medium">
                  {(session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium max-w-[150px] truncate hidden md:inline">
                {session.user.name || session.user.email}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  {session.user.name && (
                    <p className="text-sm font-medium">{session.user.name}</p>
                  )}
                  {session.user.email && (
                    <p className="text-xs text-gray-500">{session.user.email}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/account">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Account
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:text-red-600"
                onClick={() => signOut({ callbackUrl: "/sign-in" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/sign-in" className="flex items-center gap-1.5 md:gap-2 text-sm font-medium hover:text-[#5382E3]">
            <PiArrowBendUpRight />
            <span className="hidden md:inline">Sign In / Sign Up</span>
            <span className="md:hidden">Sign In</span>
          </Link>
        )}
      </div>
      {/* Protocol address modal */}
      {modalProtocol && (
        <ProtocolModal
          protocol={modalProtocol}
          open={!!modalProtocol}
          onOpenChange={(open) => { if (!open) setModalProtocol(null); }}
        />
      )}
    </div>
  );
};

export default Header;
