"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMorphoPosition } from "@/src/hooks/useMorphoPosition";
import { useRecentWallets } from "@/src/hooks/useRecentWallets";
import MorphoDashboard from "@/src/components/morpho/MorphoDashboard";
import ProtocolModal, { type ProtocolConfig } from "@/src/components/ProtocolModal";
import type { MorphoPositionData } from "@/src/lib/morpho/types";

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
  sandboxUrl: "/morpho?sandbox=true",
  sandboxLabel: "Start from scratch",
  navigateTo: (address, ens) => {
    const params = new URLSearchParams({ wallet: address });
    if (ens) params.set("ens", ens);
    return `/morpho?${params.toString()}`;
  },
};

const EMPTY_POSITION: MorphoPositionData = {
  address: "",
  positions: [],
  totalDepositedUsd: 0,
  totalPnlUsd: 0,
};

function MorphoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { position: fetchedPosition, isLoading, error, fetchPosition, clearPosition } = useMorphoPosition();
  const { addRecentWallet } = useRecentWallets();
  const hasFetchedRef = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxPosition, setSandboxPosition] = useState<MorphoPositionData>(EMPTY_POSITION);

  const walletParam = searchParams.get("wallet");
  const ensParam = searchParams.get("ens");
  const projectionParam = searchParams.get("projection");
  const sandboxParam = searchParams.get("sandbox");
  const sidParam = searchParams.get("sid");

  // Auto-enter sandbox mode via URL param
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
      router.push(`/morpho?${params.toString()}`);
      hasFetchedRef.current = false;
    },
    [router]
  );

  const handleClear = useCallback(() => {
    clearPosition();
    setSandboxMode(false);
    setSandboxPosition(EMPTY_POSITION);
    hasFetchedRef.current = false;
    router.push("/morpho");
  }, [clearPosition, router]);

  const handleStartSandbox = useCallback(() => {
    setSandboxMode(true);
    setSandboxPosition(EMPTY_POSITION);
  }, []);

  // Determine which position to display
  const position = sandboxMode ? sandboxPosition : fetchedPosition;

  // Loading state (wallet mode only)
  if (walletParam && !position && (isLoading || !error)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <img src="/favicon.svg" alt="logo" width={40} height={40} className="animate-pulse" />
        <p className="text-sm text-gray-400">Loading Morpho positions...</p>
      </div>
    );
  }

  // Error state (wallet mode only)
  if (!sandboxMode && error && !position) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={handleClear}
          className="text-sm text-[#5382E3] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Wallet mode: position loaded with positions
  if (!sandboxMode && fetchedPosition && fetchedPosition.positions.length > 0) {
    return (
      <MorphoDashboard
        position={fetchedPosition}
        ensName={ensParam ?? undefined}
        projectionId={projectionParam ?? undefined}
        sessionId={sidParam ?? undefined}
        onChangeWallet={handleChangeWallet}
        onClear={handleClear}
      />
    );
  }

  // Wallet mode: no positions found
  if (!sandboxMode && fetchedPosition && fetchedPosition.positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <svg width={48} height={48} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="#1E2B3A" />
          <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">M</text>
        </svg>
        <p className="text-sm text-gray-500">No Morpho vault positions found for this wallet.</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="text-sm text-[#5382E3] hover:underline"
          >
            Try another wallet
          </button>
          <span className="text-gray-300">or</span>
          <button
            onClick={handleStartSandbox}
            className="text-sm text-[#1E2B3A] font-medium hover:underline"
          >
            Start from scratch
          </button>
        </div>
        {showModal && (
          <ProtocolModal
            protocol={morphoModalConfig}
            open={showModal}
            onOpenChange={(open) => { if (!open) setShowModal(false); }}
          />
        )}
      </div>
    );
  }

  // Sandbox mode: show dashboard with editable positions
  if (sandboxMode) {
    return (
      <MorphoDashboard
        position={sandboxPosition}
        isSandbox
        projectionId={projectionParam ?? undefined}
        sessionId={sidParam ?? undefined}
        onClear={handleClear}
        onPositionChange={setSandboxPosition}
      />
    );
  }

  // Landing — no wallet param, not sandbox
  return (
    <div className="max-w-md mx-auto pt-16">
      <div className="text-center mb-8">
        <svg width={48} height={48} viewBox="0 0 20 20" fill="none" className="mx-auto mb-4">
          <circle cx="10" cy="10" r="10" fill="#1E2B3A" />
          <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">M</text>
        </svg>
        <h1 className="text-xl font-bold text-[#303549]">Morpho Vault Projections</h1>
        <p className="text-sm text-gray-500 mt-2">
          Load your Morpho vault positions or build a custom portfolio from scratch.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setShowModal(true)}
          className="w-full h-11 rounded-xl text-sm font-medium bg-[#1E2B3A] text-white hover:bg-[#2a3f5a] transition-colors"
        >
          Enter wallet address
        </button>
        <button
          onClick={handleStartSandbox}
          className="w-full h-11 rounded-xl text-sm font-medium bg-white border-2 border-[#1E2B3A]/20 text-[#303549] hover:border-[#1E2B3A]/40 transition-colors"
        >
          Start from scratch
        </button>
      </div>

      <p className="text-[10px] text-gray-400 text-center mt-4">
        Read-only. We never ask for private keys or signatures.
      </p>

      {showModal && (
        <ProtocolModal
          protocol={morphoModalConfig}
          open={showModal}
          onOpenChange={(open) => { if (!open) setShowModal(false); }}
        />
      )}
    </div>
  );
}

export default function MorphoPage() {
  return (
    <Suspense>
      <MorphoContent />
    </Suspense>
  );
}
