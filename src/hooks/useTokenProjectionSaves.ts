"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { TokenHolding, TokenAction, ImportSource } from "@/src/lib/tokens/types";
import { PriceScenario, RateScenario } from "@/src/lib/simulation/types";

const STORAGE_KEY = "token_projection_saves";

export interface TokenProjectionSave {
  id: string;
  name: string;
  details: string;
  holdings: TokenHolding[];
  actions: TokenAction[];
  priceScenarios: PriceScenario[];
  rateScenarios: RateScenario[];
  durationDays: number;
  importSource?: ImportSource;
  createdAt: string;
  updatedAt: string;
}

interface ServerProjection {
  id: string;
  type: string;
  name: string;
  details: string | null;
  address: string | null;
  config: {
    holdings: TokenHolding[];
    actions: TokenAction[];
    priceScenarios: PriceScenario[];
    rateScenarios?: RateScenario[];
    durationDays: number;
    importSource?: ImportSource;
  };
  createdAt: string;
  updatedAt: string;
}

function fromServer(raw: ServerProjection): TokenProjectionSave | null {
  const cfg = raw.config;
  if (!cfg || typeof cfg !== "object") return null;
  return {
    id: raw.id,
    name: raw.name,
    details: raw.details ?? "",
    holdings: cfg.holdings ?? [],
    actions: cfg.actions ?? [],
    priceScenarios: cfg.priceScenarios ?? [],
    rateScenarios: cfg.rateScenarios ?? [],
    durationDays: cfg.durationDays ?? 30,
    importSource: cfg.importSource,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function useTokenProjectionSaves() {
  const { data: session } = useSession();
  const [saves, setSaves] = useState<TokenProjectionSave[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const migratedRef = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/projections?type=sandbox");
      if (res.ok) {
        const data: ServerProjection[] = await res.json();
        setSaves(data.map(fromServer).filter((s): s is TokenProjectionSave => s !== null));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Migrate localStorage saves to server on first visit
  useEffect(() => {
    if (!session?.user || migratedRef.current) return;
    migratedRef.current = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const localSaves: TokenProjectionSave[] = JSON.parse(raw);
      if (!Array.isArray(localSaves) || localSaves.length === 0) return;

      Promise.all(
        localSaves.map((s) =>
          fetch("/api/projections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: s.name,
              type: "sandbox",
              details: s.details || undefined,
              config: {
                holdings: s.holdings,
                actions: s.actions,
                priceScenarios: s.priceScenarios,
                rateScenarios: s.rateScenarios ?? [],
                durationDays: s.durationDays,
              },
            }),
          }).catch(() => null)
        )
      ).then(() => {
        localStorage.removeItem(STORAGE_KEY);
        refresh();
      });
    } catch {
      // ignore migration errors
    }
  }, [session?.user, refresh]);

  // Load saves from server on mount
  useEffect(() => {
    if (session?.user) refresh();
  }, [session?.user, refresh]);

  const save = useCallback(
    async (data: {
      name: string;
      details?: string;
      holdings: TokenHolding[];
      actions: TokenAction[];
      priceScenarios: PriceScenario[];
      rateScenarios?: RateScenario[];
      durationDays: number;
      importSource?: ImportSource;
    }) => {
      const res = await fetch("/api/projections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: "sandbox",
          details: data.details || undefined,
          config: {
            holdings: data.holdings,
            actions: data.actions,
            priceScenarios: data.priceScenarios,
            rateScenarios: data.rateScenarios ?? [],
            durationDays: data.durationDays,
            importSource: data.importSource,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save sandbox projection");
      const created: ServerProjection = await res.json();
      const mapped = fromServer(created);
      if (!mapped) throw new Error("Invalid projection data");
      setSaves((prev) => [mapped, ...prev]);
      return mapped;
    },
    []
  );

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/projections/${id}`);
    if (!res.ok) throw new Error("Failed to load projection");
    const raw: ServerProjection = await res.json();
    const mapped = fromServer(raw);
    if (!mapped) throw new Error("Invalid projection data");
    return mapped;
  }, []);

  const update = useCallback(
    async (id: string, data: Partial<Omit<TokenProjectionSave, "id" | "createdAt">>) => {
      const body: Record<string, unknown> = {};
      if (data.name !== undefined) body.name = data.name;
      if (data.details !== undefined) body.details = data.details;
      if (data.holdings || data.actions || data.priceScenarios || data.rateScenarios || data.durationDays) {
        // Need to fetch existing config first to merge
        const existing = saves.find((s) => s.id === id);
        body.config = {
          holdings: data.holdings ?? existing?.holdings ?? [],
          actions: data.actions ?? existing?.actions ?? [],
          priceScenarios: data.priceScenarios ?? existing?.priceScenarios ?? [],
          rateScenarios: data.rateScenarios ?? existing?.rateScenarios ?? [],
          durationDays: data.durationDays ?? existing?.durationDays ?? 30,
        };
      }
      const res = await fetch(`/api/projections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update projection");
      const updated: ServerProjection = await res.json();
      const mapped = fromServer(updated);
      if (!mapped) throw new Error("Invalid projection data");
      setSaves((prev) => prev.map((s) => (s.id === id ? mapped : s)));
    },
    [saves]
  );

  const duplicate = useCallback(
    async (id: string) => {
      const full = await load(id);
      const saved = await save({
        name: `${full.name} (copy)`,
        details: full.details,
        holdings: full.holdings,
        actions: full.actions,
        priceScenarios: full.priceScenarios,
        rateScenarios: full.rateScenarios,
        durationDays: full.durationDays,
      });
      return saved;
    },
    [load, save]
  );

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/projections/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete projection");
    setSaves((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { saves, isLoading, refresh, save, load, update, duplicate, remove };
}
