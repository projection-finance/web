"use client";

import { useState, useCallback, useMemo } from "react";
import { AavePositionData } from "@/src/lib/aave/types";
import { buildPositionContext } from "@/src/lib/ai/context-builder";
import { YieldOptimizerResponse } from "@/src/lib/ai/types";
import { ScanConfig, scanYieldOpportunities } from "@/src/lib/algo/yield-scanner";
import { formatEmodeCategories } from "@/src/lib/aave/emode";
import BigNumber from "bignumber.js";

export interface UseAlgoScannerResult {
  result: YieldOptimizerResponse | null;
  isLoading: boolean;
  error: string | null;
  scan: (config?: Partial<ScanConfig>) => void;
  reset: () => void;
}

export function useAlgoScanner(
  position: AavePositionData
): UseAlgoScannerResult {
  const [result, setResult] = useState<YieldOptimizerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emodeCategories = useMemo(
    () => formatEmodeCategories(position.formattedPoolReserves),
    [position.formattedPoolReserves]
  );

  const scan = useCallback(
    (config?: Partial<ScanConfig>) => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const marketRefPriceUSD = new BigNumber(
          position.baseCurrencyData.marketReferenceCurrencyPriceInUsd
        )
          .shiftedBy(-8)
          .toNumber();

        const ctx = buildPositionContext(
          position.workingData,
          position.formattedPoolReserves,
          marketRefPriceUSD,
          position.merklIncentives
        );

        const response = scanYieldOpportunities(ctx, emodeCategories, config);
        setResult(response);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Scan failed"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [position, emodeCategories]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isLoading, error, scan, reset };
}
