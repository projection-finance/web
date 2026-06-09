"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const STORAGE_KEY = "recentWallets";

export interface RecentWallet {
  address: string;
  ensName?: string;
  lastUsed: number;
}

/**
 * Hybrid recent wallets hook:
 * - Not logged in → localStorage only
 * - Logged in → server DB + auto-migrate localStorage on first visit
 */
export function useRecentWallets() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  const [wallets, setWallets] = useState<RecentWallet[]>([]);
  const migratedRef = useRef(false);
  const fetchedRef = useRef(false);

  // --- localStorage helpers ---

  const readLocal = useCallback((): RecentWallet[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const writeLocal = useCallback((list: RecentWallet[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
  }, []);

  // --- Fetch from server ---

  const fetchServer = useCallback(async () => {
    try {
      const res = await fetch("/api/recent-wallets");
      if (res.ok) {
        const data: RecentWallet[] = await res.json();
        setWallets(data);
      }
    } catch {
      // fallback to local
      setWallets(readLocal());
    }
  }, [readLocal]);

  // --- Init: load from localStorage (always) then from server (if logged in) ---

  useEffect(() => {
    if (fetchedRef.current) return;

    // Always start with localStorage (instant, no network)
    const local = readLocal();
    setWallets(local);

    if (isLoggedIn) {
      fetchedRef.current = true;
      fetchServer();
    }
  }, [isLoggedIn, readLocal, fetchServer]);

  // --- Migration: localStorage → server on first login ---

  useEffect(() => {
    if (!isLoggedIn || migratedRef.current) return;
    migratedRef.current = true;

    const local = readLocal();
    if (local.length === 0) return;

    // Push all local entries to server in parallel
    Promise.all(
      local.map((w) =>
        fetch("/api/recent-wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: w.address,
            ensName: w.ensName,
          }),
        }).catch(() => null)
      )
    ).then(() => {
      // Clear localStorage after successful migration
      localStorage.removeItem(STORAGE_KEY);
      // Refresh from server to get merged + pruned list
      fetchServer();
    });
  }, [isLoggedIn, readLocal, fetchServer]);

  // --- Add a recent wallet ---

  const addRecentWallet = useCallback(
    async (address: string, ensName?: string) => {
      const normalized = address.toLowerCase();

      if (isLoggedIn) {
        // Optimistic update
        setWallets((prev) => {
          const filtered = prev.filter(
            (w) => w.address.toLowerCase() !== normalized
          );
          return [
            { address: normalized, ensName, lastUsed: Date.now() },
            ...filtered,
          ].slice(0, 10);
        });

        // Persist to server
        try {
          await fetch("/api/recent-wallets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: normalized, ensName }),
          });
        } catch {
          // silent — optimistic update is enough
        }
      } else {
        // localStorage only
        const prev = readLocal().filter(
          (w) => w.address.toLowerCase() !== normalized
        );
        const next = [
          { address: normalized, ensName, lastUsed: Date.now() },
          ...prev,
        ].slice(0, 10);
        writeLocal(next);
        setWallets(next);
      }
    },
    [isLoggedIn, readLocal, writeLocal]
  );

  // --- Remove a recent wallet ---

  const removeRecentWallet = useCallback(
    async (address: string) => {
      const normalized = address.toLowerCase();

      setWallets((prev) =>
        prev.filter((w) => w.address.toLowerCase() !== normalized)
      );

      if (isLoggedIn) {
        try {
          await fetch(
            `/api/recent-wallets?address=${encodeURIComponent(normalized)}`,
            { method: "DELETE" }
          );
        } catch {
          // silent
        }
      } else {
        const next = readLocal().filter(
          (w) => w.address.toLowerCase() !== normalized
        );
        writeLocal(next);
      }
    },
    [isLoggedIn, readLocal, writeLocal]
  );

  // --- Clear all ---

  const clearAll = useCallback(async () => {
    setWallets([]);

    if (isLoggedIn) {
      try {
        await fetch("/api/recent-wallets", { method: "DELETE" });
      } catch {
        // silent
      }
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isLoggedIn]);

  return {
    wallets,
    addRecentWallet,
    removeRecentWallet,
    clearAll,
  };
}
