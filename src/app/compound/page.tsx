"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCompoundPosition } from "@/src/hooks/useCompoundPosition";
import { useRecentWallets } from "@/src/hooks/useRecentWallets";
import CompoundDashboard from "@/src/components/compound/CompoundDashboard";
import ProtocolModal, { type ProtocolConfig } from "@/src/components/ProtocolModal";
import type { CompoundPositionData } from "@/src/lib/compound/types";

const compoundModalConfig: ProtocolConfig = {
  id: "compound",
  name: "Compound V3",
  description: "Simulate your Compound V3 (Comet) positions across Ethereum, Base, Arbitrum, Optimism & Polygon",
  icon: (
    <svg width={22} height={22} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#00D395" />
      <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">C</text>
    </svg>
  ),
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
};

const EMPTY_POSITION: CompoundPositionData = {
  address: "",
  markets: [],
  totalSupplyUSD: 0,
  totalBorrowUSD: 0,
  totalCollateralUSD: 0,
  netWorthUSD: 0,
};

function CompoundContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { position: fetchedPosition, isLoading, error, fetchPosition, clearPosition } = useCompoundPosition();
  const { addRecentWallet } = useRecentWallets();
  const hasFetchedRef = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxPosition, setSandboxPosition] = useState<CompoundPositionData>(EMPTY_POSITION);

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

  const handleChangeWallet = useCallback(
    (address: string, ens?: string) => {
      const params = new URLSearchParams({ wallet: address });
      if (ens) params.set("ens", ens);
      router.push(`/compound?${params.toString()}`);
      hasFetchedRef.current = false;
    },
    [router],
  );

  const handleClear = useCallback(() => {
    clearPosition();
    setSandboxMode(false);
    setSandboxPosition(EMPTY_POSITION);
    hasFetchedRef.current = false;
    router.push("/compound");
  }, [clearPosition, router]);

  const handleStartSandbox = useCallback(() => {
    setSandboxMode(true);
    setSandboxPosition(EMPTY_POSITION);
  }, []);

  const position = sandboxMode ? sandboxPosition : fetchedPosition;

  if (walletParam && !position && (isLoading || !error)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <img src="/favicon.svg" alt="logo" width={40} height={40} className="animate-pulse" />
        <p className="text-sm text-gray-400">Loading Compound positions...</p>
      </div>
    );
  }

  if (!sandboxMode && error && !position) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={handleClear} className="text-sm text-[#00D395] hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (!sandboxMode && fetchedPosition && fetchedPosition.markets.length > 0) {
    return (
      <CompoundDashboard
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
          <circle cx="10" cy="10" r="10" fill="#00D395" />
          <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">C</text>
        </svg>
        <p className="text-sm text-gray-500">No Compound V3 positions found for this wallet.</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowModal(true)} className="text-sm text-[#00D395] hover:underline">
            Try another wallet
          </button>
          <span className="text-gray-300">or</span>
          <button onClick={handleStartSandbox} className="text-sm text-[#303549] font-medium hover:underline">
            Start from scratch
          </button>
        </div>
        <ProtocolModal
          open={showModal}
          onOpenChange={setShowModal}
          protocol={compoundModalConfig}
        />
      </div>
    );
  }

  if (sandboxMode) {
    return (
      <CompoundDashboard
        position={sandboxPosition}
        ensName={undefined}
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
      <ProtocolModal
        open={true}
        onOpenChange={(open) => { if (!open) router.push("/"); }}
        protocol={compoundModalConfig}
      />
    </div>
  );
}

export default function CompoundPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <img src="/favicon.svg" alt="logo" width={40} height={40} className="animate-pulse" />
      </div>
    }>
      <CompoundContent />
    </Suspense>
  );
}
