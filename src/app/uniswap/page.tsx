"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import UniswapDashboard from "@/src/components/uniswap/UniswapDashboard";

function UniswapContent() {
  const router = useRouter();
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
        <svg width={56} height={56} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="#FF007A" />
          <text x="10" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">U</text>
        </svg>
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#303549]">Uniswap V3 Position Simulator</h1>
          <p className="text-sm text-gray-400 mt-1">
            Simulate concentrated liquidity positions — project fees, impermanent loss, and net PnL over time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStarted(true)}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium bg-[#FF007A] text-white hover:bg-[#E0006B] transition-colors"
          >
            Create a simulation
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Back to home
          </button>
        </div>
        <p className="text-[11px] text-gray-400 max-w-md text-center">
          Pick a pool, set your price range and deposit amount, then see how your position performs under different price and volume scenarios.
        </p>
      </div>
    );
  }

  return <UniswapDashboard onClear={() => setStarted(false)} />;
}

export default function UniswapPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><img src="/favicon.svg" alt="logo" width={40} height={40} className="animate-pulse" /></div>}>
      <UniswapContent />
    </Suspense>
  );
}
