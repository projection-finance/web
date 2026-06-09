"use client";

import { useState, useCallback } from "react";
import { AavePositionData } from "@/src/lib/aave/types";
import { NetworkId, DEFAULT_NETWORK } from "@/src/lib/aave/networks";

export function useAavePosition() {
  const [position, setPosition] = useState<AavePositionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [currentNetwork, setCurrentNetwork] = useState<NetworkId>(DEFAULT_NETWORK);

  const fetchPosition = useCallback(async (address: string, network: NetworkId = DEFAULT_NETWORK) => {
    setIsLoading(true);
    setError("");
    setPosition(null);
    setCurrentNetwork(network);

    try {
      const params = new URLSearchParams({ address });
      if (network !== DEFAULT_NETWORK) {
        params.set("network", network);
      }
      const response = await fetch(`/api/aave/position?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data: AavePositionData = await response.json();
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

  const fetchEmptyPosition = useCallback(async (network: NetworkId = DEFAULT_NETWORK) => {
    setIsLoading(true);
    setError("");
    setPosition(null);
    setCurrentNetwork(network);

    try {
      const params = new URLSearchParams();
      if (network !== DEFAULT_NETWORK) {
        params.set("network", network);
      }
      const url = params.toString()
        ? `/api/aave/empty-position?${params.toString()}`
        : "/api/aave/empty-position";
      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data: AavePositionData = await response.json();
      setPosition(data);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch market data";
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
    currentNetwork,
    fetchPosition,
    fetchEmptyPosition,
    clearPosition,
  };
}
