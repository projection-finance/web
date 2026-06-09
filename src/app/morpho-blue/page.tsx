"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMorphoBluePosition } from "@/src/hooks/useMorphoBluePosition";
import { useRecentWallets } from "@/src/hooks/useRecentWallets";
import MorphoBlueDashboard from "@/src/components/morpho-blue/MorphoBlueDashboard";
import ProtocolModal, { type ProtocolConfig } from "@/src/components/ProtocolModal";
import type { MorphoBluePositionData } from "@/src/lib/morpho-blue/types";

const blueModalConfig: ProtocolConfig = {
  id: "morpho-blue",
  name: "Morpho Blue",
  description: "Simulate your Morpho Blue lending positions on Ethereum & Base",
  icon: (
    <svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#4F46E5" />
      <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">B</text>
    </svg>
  ),
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
};

const EMPTY_POSITION: MorphoBluePositionData = {
  address: "",
  markets: [],
  totalSupplyUSD: 0,
  totalBorrowUSD: 0,
  totalCollateralUSD: 0,
  netWorthUSD: 0,
};

function MorphoBlueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { position: fetchedPosition, isLoading, error, fetchPosition, clearPosition } = useMorphoBluePosition();
  const { addRecentWallet } = useRecentWallets();
  const hasFetchedRef = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxPosition, setSandboxPosition] = useState<MorphoBluePositionData>(EMPTY_POSITION);

  const walletParam = searchParams.get("wallet");
  const ensParam = searchParams.get("ens");
  const projectionParam = searchParams.get("projection");
  const sandboxParam = searchParams.get("sandbox");
  const sidParam = searchParams.get("sid");

  useEffect(() => {
    if (sandboxParam === "true" && !walletParam && !sandboxMode) {
      setSandboxMode(true);
      setSandboxPosition(EMPTY_POSITION);
    }
  }, [sandboxParam, walletParam, sandboxMode]);

  useEffect(() => {
    if (walletParam && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPosition(walletParam);
      addRecentWallet(walletParam, ensParam ?? undefined);
    }
  }, [walletParam, ensParam, fetchPosition, addRecentWallet]);

  const handleChangeWallet = useCallback((address: string, ens?: string) => {
    const params = new URLSearchParams({ wallet: address });
    if (ens) params.set("ens", ens);
    router.push(`/morpho-blue?${params.toString()}`);
    hasFetchedRef.current = false;
  }, [router]);

  const handleClear = useCallback(() => {
    clearPosition();
    setSandboxMode(false);
    setSandboxPosition(EMPTY_POSITION);
    hasFetchedRef.current = false;
    router.push("/morpho-blue");
  }, [clearPosition, router]);

  const position = sandboxMode ? sandboxPosition : fetchedPosition;

  if (walletParam && !position && (isLoading || !error)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <img src="/favicon.svg" alt="logo" width={40} height={40} className="animate-pulse" />
        <p className="text-sm text-gray-400">Loading Morpho Blue positions...</p>
      </div>
    );
  }

  if (!sandboxMode && error && !position) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={handleClear} className="text-sm text-[#4F46E5] hover:underline">Try again</button>
      </div>
    );
  }

  if (!sandboxMode && fetchedPosition && fetchedPosition.markets.length > 0) {
    return (
      <MorphoBlueDashboard
        position={fetchedPosition}
        ensName={ensParam ?? undefined}
        projectionId={projectionParam ?? undefined}
        sessionId={sidParam ?? undefined}
        onChangeWallet={handleChangeWallet}
        onClear={handleClear}
      />
    );
  }

  if (!sandboxMode && fetchedPosition && fetchedPosition.markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <svg width={48} height={48} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="#4F46E5" />
          <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">B</text>
        </svg>
        <p className="text-sm text-gray-500">No Morpho Blue positions found for this wallet.</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowModal(true)} className="text-sm text-[#4F46E5] hover:underline">Try another wallet</button>
          <span className="text-gray-300">or</span>
          <button onClick={() => { setSandboxMode(true); setSandboxPosition(EMPTY_POSITION); }} className="text-sm text-[#303549] font-medium hover:underline">Start from scratch</button>
        </div>
        <ProtocolModal open={showModal} onOpenChange={setShowModal} protocol={blueModalConfig} />
      </div>
    );
  }

  if (sandboxMode) {
    return (
      <MorphoBlueDashboard
        position={sandboxPosition}
        projectionId={projectionParam ?? undefined}
        sessionId={sidParam ?? undefined}
        isSandbox
        onClear={handleClear}
        onPositionChange={setSandboxPosition}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <ProtocolModal open={true} onOpenChange={(open) => { if (!open) router.push("/"); }} protocol={blueModalConfig} />
    </div>
  );
}

export default function MorphoBluePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><img src="/favicon.svg" alt="logo" width={40} height={40} className="animate-pulse" /></div>}>
      <MorphoBlueContent />
    </Suspense>
  );
}
