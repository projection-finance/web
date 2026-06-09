"use client";

import { useState, useCallback } from "react";
import type { CompoundPositionData } from "@/src/lib/compound/types";

export function useCompoundPosition() {
  const [position, setPosition] = useState<CompoundPositionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosition = useCallback(async (address: string, chainId?: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ address });
      if (chainId) params.set("chainId", String(chainId));

      const res = await fetch(`/api/compound/position?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data: CompoundPositionData = await res.json();
      setPosition(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPosition = useCallback(() => {
    setPosition(null);
    setError(null);
  }, []);

  return { position, isLoading, error, fetchPosition, clearPosition };
}
