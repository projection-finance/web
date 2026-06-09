"use client";

import { useState, useCallback, useRef } from "react";
import { AavePositionData } from "@/src/lib/aave/types";
import { buildPositionContext } from "@/src/lib/ai/context-builder";
import {
  AIModel,
  AIStreamEvent,
  StrategyAdvisorResponse,
} from "@/src/lib/ai/types";
import BigNumber from "bignumber.js";

interface UseStrategyAdvisorResult {
  result: StrategyAdvisorResponse | null;
  isLoading: boolean;
  error: string | null;
  streamingContent: string;
  statusMessage: string;
  advise: (
    scenario: string,
    profiles?: ("conservative" | "balanced" | "aggressive")[],
    durationDays?: number,
    model?: AIModel
  ) => void;
  cancel: () => void;
}

export function useStrategyAdvisor(
  position: AavePositionData
): UseStrategyAdvisorResult {
  const [result, setResult] = useState<StrategyAdvisorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }, []);

  const advise = useCallback(
    (
      scenario: string,
      profiles?: ("conservative" | "balanced" | "aggressive")[],
      durationDays?: number,
      model?: AIModel
    ) => {
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);
      setResult(null);
      setStreamingContent("");
      setStatusMessage("Preparing...");

      const marketRefPriceUSD = new BigNumber(
        position.baseCurrencyData.marketReferenceCurrencyPriceInUsd
      )
        .shiftedBy(-8)
        .toNumber();

      const positionContext = buildPositionContext(
        position.workingData,
        position.formattedPoolReserves,
        marketRefPriceUSD,
        position.merklIncentives
      );

      (async () => {
        try {
          const response = await fetch("/api/ai/strategy-advisor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              positionContext,
              scenario,
              profiles,
              durationDays,
              model,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Request failed: ${response.status}`);
          }

          if (!response.body) {
            throw new Error("No response body");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const event: AIStreamEvent = JSON.parse(data);

                switch (event.type) {
                  case "status":
                    setStatusMessage(event.message);
                    break;
                  case "chunk":
                    setStreamingContent((prev) => prev + event.content);
                    break;
                  case "result":
                    setResult(event.data as StrategyAdvisorResponse);
                    setStatusMessage("");
                    break;
                  case "error":
                    setError(event.message);
                    setStatusMessage("");
                    break;
                }
              } catch {
                // Skip malformed events
              }
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
          if (abortControllerRef.current === controller) {
            setIsLoading(false);
          }
        }
      })();
    },
    [position]
  );

  return {
    result,
    isLoading,
    error,
    streamingContent,
    statusMessage,
    advise,
    cancel,
  };
}
