"use client";

import { useState, useCallback } from "react";
import type { MorphoPositionData } from "@/src/lib/morpho/types";

export function useMorphoPosition() {
  const [position, setPosition] = useState<MorphoPositionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchPosition = useCallback(async (address: string) => {
    setIsLoading(true);
    setError("");
    setPosition(null);

    try {
      const params = new URLSearchParams({ address });
      const response = await fetch(`/api/morpho/position?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data: MorphoPositionData = await response.json();
      setPosition(data);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch position";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPosition = useCallback(() => {
    setPosition(null);
    setError("");
  }, []);

  return {
    position,
    isLoading,
    error,
    fetchPosition,
    clearPosition,
  };
}
