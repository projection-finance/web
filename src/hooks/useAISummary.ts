"use client";

import { useState, useCallback, useRef } from "react";
import {
  AISummaryData,
  AISummaryRequest,
  AISummaryResponse,
  AIStreamEvent,
  DEFAULT_AI_MODEL,
} from "@/src/lib/ai/types";

const MAX_RELOADS = 10;

export function useAISummary() {
  const [summary, setSummary] = useState<AISummaryData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reloadCountRef = useRef(0);

  const generate = useCallback(
    async (request: AISummaryRequest, existingSummary?: AISummaryData | null) => {
      const currentReloads = existingSummary?.reloadCount ?? reloadCountRef.current;
      if (currentReloads >= MAX_RELOADS) {
        setError("Maximum regeneration limit reached (10). The last summary has been saved.");
        return null;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setStreamingContent("");
      setStatusMessage("");
      setError(null);

      try {
        const res = await fetch("/api/ai/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let finalData: AISummaryResponse | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event: AIStreamEvent = JSON.parse(data);
              switch (event.type) {
                case "status":
                  setStatusMessage(event.message);
                  break;
                case "chunk":
                  accumulated += event.content;
                  setStreamingContent(accumulated);
                  break;
                case "result":
                  finalData = event.data as AISummaryResponse;
                  break;
                case "error":
                  throw new Error(event.message);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== data) throw e;
            }
          }
        }

        if (finalData) {
          const newCount = existingSummary ? existingSummary.reloadCount + 1 : 0;
          reloadCountRef.current = newCount;
          const summaryData: AISummaryData = {
            content: finalData.summary,
            language: request.language || "en",
            generatedAt: new Date().toISOString(),
            reloadCount: newCount,
            model: request.model || DEFAULT_AI_MODEL,
          };
          setSummary(summaryData);
          setIsGenerating(false);
          return summaryData;
        }

        throw new Error("No result received from AI");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // cancelled
        } else {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        setIsGenerating(false);
        return null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const loadExisting = useCallback((data: AISummaryData | null) => {
    setSummary(data);
    if (data) {
      reloadCountRef.current = data.reloadCount;
    }
  }, []);

  const isLocked = (summary?.reloadCount ?? reloadCountRef.current) >= MAX_RELOADS;

  return {
    summary,
    isGenerating,
    streamingContent,
    statusMessage,
    error,
    isLocked,
    maxReloads: MAX_RELOADS,
    generate,
    cancel,
    loadExisting,
  };
}
