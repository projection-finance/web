"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import {
  Search,
  AlertTriangle,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  YieldOptimizerResponse,
} from "@/src/lib/ai/types";
import {
  ScheduledAction,
} from "@/src/lib/simulation/types";
import { ScanConfig } from "@/src/lib/algo/yield-scanner";

// ── Symbol validation ──

interface SymbolWarnings {
  unknownSymbols: string[];
  validActions: ScheduledAction[];
  invalidActionCount: number;
}

function validateActionSymbols(
  available: string[],
  actions: ScheduledAction[]
): SymbolWarnings {
  const set = new Set(available.map((s) => s.toUpperCase()));
  const unknown = new Set<string>();
  const validActions: ScheduledAction[] = [];
  let invalidActionCount = 0;

  for (const a of actions) {
    if (!a.symbol || set.has(a.symbol.toUpperCase())) {
      validActions.push(a);
    } else {
      unknown.add(a.symbol);
      invalidActionCount++;
    }
  }

  return { unknownSymbols: [...unknown], validActions, invalidActionCount };
}

// ── Shared UI ──

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-md px-3 py-2">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  );
}

function SymbolWarningBanner({ warnings }: { warnings: SymbolWarnings }) {
  if (warnings.unknownSymbols.length === 0) return null;
  return (
    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs rounded-md px-3 py-2">
      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <div>
        <span className="font-medium">{warnings.unknownSymbols.join(", ")}</span>{" "}
        {warnings.unknownSymbols.length === 1 ? "is" : "are"} not in your Aave
        pool — {warnings.invalidActionCount} action{warnings.invalidActionCount !== 1 ? "s" : ""} filtered out.
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "bg-green-500/10 text-green-600 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    high: "bg-red-500/10 text-red-500 border-red-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[level] ?? "bg-gray-500/10 text-gray-500 border-gray-500/20"}`}
    >
      {level}
    </span>
  );
}

// ── Props ──

interface ScanPanelProps {
  isOpen: boolean;
  onClose: () => void;
  availableSymbols: string[];
  scanResult: YieldOptimizerResponse | null;
  scanLoading: boolean;
  scanError: string | null;
  onScan: (config?: Partial<ScanConfig>) => void;
  onResetScan: () => void;
}

// ── Main component ──

export default function AIPanel({
  isOpen,
  onClose,
  availableSymbols,
  scanResult,
  scanLoading,
  scanError,
  onScan,
  onResetScan,
}: ScanPanelProps) {
  const [riskTolerance, setRiskTolerance] = useState<
    "conservative" | "balanced" | "aggressive"
  >("balanced");

  const warnings = useMemo(() => {
    if (!scanResult) return null;
    const allActions = scanResult.opportunities.flatMap((o) => o.actions);
    const w = validateActionSymbols(availableSymbols, allActions);
    return w.unknownSymbols.length > 0 ? w : null;
  }, [scanResult, availableSymbols]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#5382E3]/10 flex items-center justify-center">
              <Search className="w-4 h-4 text-[#5382E3]" />
            </div>
            <DialogTitle className="text-base">AI Advisor</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              💡 <strong>Advisory mode:</strong> This AI analyzes your position and suggests optimizations.
              You&apos;ll need to manually execute the recommended actions.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Instant algorithmic scan — finds rate improvements,
            collateral optimizations, and incentive opportunities.
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
              {(["conservative", "balanced", "aggressive"] as const).map((r) => (
                <button
                  key={r}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${
                    riskTolerance === r
                      ? "bg-[#303549] text-white"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setRiskTolerance(r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="text-xs h-7 gap-1 bg-[#5382E3]"
              onClick={() => onScan({ riskTolerance })}
              disabled={scanLoading}
            >
              <Search className="w-3 h-3" />
              Scan
            </Button>
            {scanResult && (
              <button
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={onResetScan}
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>

          <ErrorBanner error={scanError} />
          {warnings && <SymbolWarningBanner warnings={warnings} />}

          {scanResult && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500">{scanResult.analysis}</div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">
                  Current APY:{" "}
                  <span className="text-gray-700">
                    {(scanResult.currentNetAPY * 100).toFixed(2)}%
                  </span>
                </span>
                <span className="text-gray-500">
                  Projected:{" "}
                  <span className="text-green-600 font-medium">
                    {(scanResult.projectedNetAPY * 100).toFixed(2)}%
                  </span>
                </span>
              </div>

              <div className="space-y-2">
                {scanResult.opportunities.map((opp, i) => (
                  <div
                    key={i}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {opp.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {opp.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RiskBadge level={opp.riskLevel} />
                        {opp.estimatedAPYImprovement > 0 && (
                          <span className="text-xs text-green-600 font-medium">
                            +{(opp.estimatedAPYImprovement * 100).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {opp.actions.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-gray-500 uppercase">
                          Recommended Actions
                        </div>
                        {opp.actions.map((a, j) => (
                          <div
                            key={j}
                            className="text-xs text-gray-700 bg-slate-100 rounded px-2 py-1"
                          >
                            Day {a.day}: {a.type}
                            {a.type === "set_emode"
                              ? ` (category ${a.emodeCategoryId})`
                              : ` ${a.amount.toFixed(4)} ${a.symbol}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
