"use client";

import { useState, useCallback } from "react";
import { TemporalSimulationConfig } from "@/src/lib/simulation/types";
import { AISummaryData } from "@/src/lib/ai/types";

export type ProjectionType = "aave" | "sandbox" | "morpho" | "compound" | "morpho-blue";

export interface ProjectionSummary {
  id: string;
  type: ProjectionType;
  name: string;
  details: string | null;
  address: string | null;
  network: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectionFull extends ProjectionSummary {
  config: TemporalSimulationConfig;
  snapshots: unknown[] | null;
  aiSummary: AISummaryData | null;
}

export function useProjections() {
  const [projections, setProjections] = useState<ProjectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const list = useCallback(async (type?: ProjectionType) => {
    setIsLoading(true);
    try {
      const url = type ? `/api/projections?type=${type}` : "/api/projections";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProjections(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const save = useCallback(
    async (
      name: string,
      config: object,
      opts?: {
        address?: string;
        network?: string;
        type?: ProjectionType;
        snapshots?: unknown[];
        details?: string;
        aiSummary?: AISummaryData | null;
      }
    ) => {
      const res = await fetch("/api/projections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: opts?.address,
          network: opts?.network,
          type: opts?.type ?? "aave",
          details: opts?.details,
          config,
          snapshots: opts?.snapshots,
          aiSummary: opts?.aiSummary ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save projection");
      const created = await res.json();
      setProjections((prev) => [created, ...prev]);
      return created as ProjectionFull;
    },
    []
  );

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/projections/${id}`);
    if (!res.ok) throw new Error("Failed to load projection");
    return (await res.json()) as ProjectionFull;
  }, []);

  const update = useCallback(
    async (
      id: string,
      data: {
        name?: string;
        details?: string | null;
        config?: TemporalSimulationConfig;
        snapshots?: unknown[];
        aiSummary?: AISummaryData | null;
      }
    ) => {
      const res = await fetch(`/api/projections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update projection");
      const updated = await res.json();
      setProjections((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, name: updated.name, details: updated.details, updatedAt: updated.updatedAt }
            : p
        )
      );
      return updated as ProjectionFull;
    },
    []
  );

  const duplicate = useCallback(
    async (id: string) => {
      const full = await load(id);
      const newName = `${full.name} (copy)`;
      return save(newName, full.config, {
        address: full.address ?? undefined,
        network: full.network ?? undefined,
        type: full.type,
        snapshots: full.snapshots ?? undefined,
        details: full.details ?? undefined,
      });
    },
    [load, save]
  );

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/projections/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete projection");
    setProjections((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { projections, isLoading, list, save, load, update, duplicate, remove };
}
