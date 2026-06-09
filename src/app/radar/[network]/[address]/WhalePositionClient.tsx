"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Shield,
  AlertTriangle,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/src/components/ui/card";
import TokenIcon from "@/src/components/ui/TokenIcon";

interface PositionData {
  walletAddress: string;
  network: string;
  healthFactor: number;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  mainCollateralSymbol: string;
  mainCollateralAmount: number;
  mainCollateralPriceUSD: number;
  liquidationPriceUSD: number | null;
  liquidationThreshold: number;
  positionJson: {
    collaterals: { symbol: string; amountUSD: number; amount: number; liqThreshold: number }[];
    debts: { symbol: string; amountUSD: number; amount: number }[];
  } | null;
  status: string;
  updatedAt: string;
}

interface LiquidationData {
  id: string;
  txHash: string;
  collateralAssetSymbol: string;
  collateralSeizedAmount: number;
  collateralSeizedUSD: number;
  debtAssetSymbol: string;
  debtRepaidAmount: number;
  debtRepaidUSD: number;
  timestamp: string;
}

interface Props {
  position: PositionData;
  liquidations: LiquidationData[];
  networkSlug: string;
  networkName: string;
  explorerUrl: string;
}

function formatUSD(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatUSDFull(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function getHfColor(hf: number): string {
  if (hf >= 2.0) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (hf >= 1.5) return "bg-emerald-50 text-emerald-600 border-emerald-200";
  if (hf >= 1.3) return "bg-amber-50 text-amber-700 border-amber-200";
  if (hf >= 1.1) return "bg-orange-50 text-orange-700 border-orange-200";
  if (hf >= 1.0) return "bg-red-50 text-red-700 border-red-200";
  return "bg-red-100 text-red-800 border-red-300";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function WhalePositionClient({
  position,
  liquidations,
  networkSlug,
  networkName,
  explorerUrl,
}: Props) {
  const [copied, setCopied] = useState(false);
  const pos = position;
  const hf = pos.healthFactor;
  const hfDisplay = hf < 100 ? hf.toFixed(2) : "∞";
  const shortAddr = `${pos.walletAddress.slice(0, 6)}...${pos.walletAddress.slice(-4)}`;
  const isAtRisk = hf < 1.1;

  const handleCopy = () => {
    navigator.clipboard.writeText(pos.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
        <Link href="/radar" className="hover:text-[#5382E3] transition-colors">
          Radar
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/radar/${networkSlug}`} className="hover:text-[#5382E3] transition-colors">
          {networkName}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[#303549] font-medium font-mono">{shortAddr}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#303549] font-mono">{shortAddr}</h1>
            <span className={`text-sm font-bold rounded-md px-2 py-0.5 border ${getHfColor(hf)}`}>
              HF {hfDisplay}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Aave V3 {networkName} — Updated {timeAgo(pos.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-xs font-mono text-[#303549]"
          >
            {pos.walletAddress.slice(0, 10)}...{pos.walletAddress.slice(-6)}
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
          </button>
          <a
            href={`${explorerUrl}/address/${pos.walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-xs text-[#5382E3]"
          >
            <ExternalLink className="w-3 h-3" />
            Explorer
          </a>
        </div>
      </div>

      {/* Overview metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Health Factor</span>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${hf < 0.95 ? "text-red-600" : hf < 1 ? "text-red-500" : hf < 1.1 ? "text-orange-500" : "text-emerald-600"}`}>
              {hfDisplay}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-4">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Collateral</span>
            <p className="text-xl sm:text-2xl font-bold text-[#303549] mt-1">{formatUSD(pos.totalCollateralUSD)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-4">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Debt</span>
            <p className="text-xl sm:text-2xl font-bold text-[#303549] mt-1">{formatUSD(pos.totalDebtUSD)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-3 sm:p-4">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Liq. Price</span>
            <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">
              {pos.liquidationPriceUSD ? formatUSDFull(pos.liquidationPriceUSD) : "—"}
            </p>
            {pos.liquidationPriceUSD && pos.mainCollateralPriceUSD > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {pos.mainCollateralSymbol} @ {formatUSDFull(pos.mainCollateralPriceUSD)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk alert */}
      {isAtRisk && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-700">
            {hf < 0.95
              ? "This position is in the full liquidation zone (100% close factor)."
              : hf < 1
              ? "This position is liquidatable (50% close factor)."
              : "This position is at risk of liquidation."}
          </p>
        </div>
      )}

      {/* Collateral table */}
      {pos.positionJson?.collaterals && pos.positionJson.collaterals.length > 0 && (
        <div className="bg-[#F5F5FA] rounded-xl border border-slate-100 mb-4">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#303549]">Collateral</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#5382E31F] text-[#5382E3] text-[11px] font-medium">
              {formatUSDFull(pos.totalCollateralUSD)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-slate-100">
                  <th className="text-left px-4 py-1.5 text-[#62677B] font-medium">Asset</th>
                  <th className="text-right px-4 py-1.5 text-[#62677B] font-medium">Amount</th>
                  <th className="text-right px-4 py-1.5 text-[#62677B] font-medium">Value</th>
                  <th className="text-right px-4 py-1.5 text-[#62677B] font-medium">Liq. Threshold</th>
                </tr>
              </thead>
              <tbody>
                {pos.positionJson.collaterals.map((c) => (
                  <tr key={c.symbol} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={c.symbol} size={20} />
                        <span className="font-medium text-[#303549]">{c.symbol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-[#303549]">{formatAmount(c.amount)}</td>
                    <td className="px-4 py-2 text-right text-[#303549] font-medium">{formatUSDFull(c.amountUSD)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{(c.liqThreshold * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Debt table */}
      {pos.positionJson?.debts && pos.positionJson.debts.length > 0 && (
        <div className="bg-[#F5F5FA] rounded-xl border border-slate-100 mb-6">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#303549]">Debt</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[11px] font-medium">
              {formatUSDFull(pos.totalDebtUSD)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-slate-100">
                  <th className="text-left px-4 py-1.5 text-[#62677B] font-medium">Asset</th>
                  <th className="text-right px-4 py-1.5 text-[#62677B] font-medium">Amount</th>
                  <th className="text-right px-4 py-1.5 text-[#62677B] font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {pos.positionJson.debts.map((d) => (
                  <tr key={d.symbol} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={d.symbol} size={20} />
                        <span className="font-medium text-[#303549]">{d.symbol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-[#303549]">{formatAmount(d.amount)}</td>
                    <td className="px-4 py-2 text-right text-[#303549] font-medium">{formatUSDFull(d.amountUSD)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent liquidations */}
      {liquidations.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-[#303549]">Recent Liquidations</h3>
          </div>
          <div className="space-y-1.5">
            {liquidations.map((liq) => (
              <Card key={liq.id} className="bg-white">
                <CardContent className="p-0">
                  <div className="px-3 sm:px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-0">
                      <span className="text-[10px] sm:text-xs text-gray-400">{timeAgo(liq.timestamp)}</span>
                      <a
                        href={`${explorerUrl}/tx/${liq.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] sm:text-[11px] text-[#5382E3] hover:text-[#4270D0] transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Tx
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-red-600">{formatUSD(liq.collateralSeizedUSD)} seized</p>
                        <p className="text-[10px] text-gray-400">{liq.collateralAssetSymbol}</p>
                      </div>
                      <div className="text-right sm:text-left">
                        <p className="font-semibold text-[#303549]">{formatUSD(liq.debtRepaidUSD)} repaid</p>
                        <p className="text-[10px] text-gray-400">{liq.debtAssetSymbol}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-3 py-6 border-t border-slate-100">
        <Link
          href={`/?wallet=${pos.walletAddress}&network=${pos.network}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5382E3] text-white rounded-lg hover:bg-[#4371D0] transition-colors text-sm font-medium"
        >
          Simulate this Position
          <ExternalLink className="w-4 h-4" />
        </Link>
        <Link
          href={`/radar/${networkSlug}`}
          className="text-sm text-gray-400 hover:text-[#5382E3] transition-colors"
        >
          Back to {networkName} Radar
        </Link>
      </div>
    </div>
  );
}
