"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  TokenHolding,
  TokenSimulationConfig,
  TokenSimulationResult,
  TokenAction,
  CoinGeckoSearchResult,
  ImportSource,
  YieldSource,
} from "@/src/lib/tokens/types";
import { PriceScenario, RateScenario } from "@/src/lib/simulation/types";

export function useTokenProjection(defaultDuration: number = 30) {
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [actions, setActions] = useState<TokenAction[]>([]);
  const [rateScenarios, setRateScenarios] = useState<RateScenario[]>([]);
  const [config, setConfig] = useState<TokenSimulationConfig>({
    durationDays: defaultDuration,
    holdings: [],
    priceScenarios: [],
    rateScenarios: [],
    actions: [],
  });
  const [result, setResult] = useState<TokenSimulationResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Map<string, TokenSimulationResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<CoinGeckoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const requestIdRef = useRef(0);

  // --- Search tokens ---

  const searchTokens = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  }, []);

  // --- Add token ---

  const addToken = useCallback(async (token: CoinGeckoSearchResult, quantity: number = 1, priceUSD?: number) => {
    // Use provided price or fetch it
    let price = priceUSD ?? 0;
    if (!price) {
      try {
        const res = await fetch(`/api/tokens/price?ids=${encodeURIComponent(token.id)}`);
        if (res.ok) {
          const data = await res.json();
          price = data[token.id]?.usd ?? 0;
        }
      } catch {
        // silent
      }
    }

    const holding: TokenHolding = {
      coingeckoId: token.id,
      symbol: token.symbol,
      name: token.name,
      image: token.large || token.thumb,
      quantity,
      currentPriceUSD: price,
    };

    setHoldings((prev) => {
      const existing = prev.findIndex((h) => h.coingeckoId === token.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + quantity };
        return next;
      }
      return [...prev, holding];
    });
  }, []);

  // --- Remove token ---

  const removeToken = useCallback((coingeckoId: string) => {
    setHoldings((prev) => prev.filter((h) => h.coingeckoId !== coingeckoId));
    // Also remove associated price scenarios
    setConfig((prev) => ({
      ...prev,
      priceScenarios: prev.priceScenarios.filter((s) => {
        const h = holdings.find((h) => h.symbol === s.symbol);
        return !h || h.coingeckoId !== coingeckoId;
      }),
    }));
  }, [holdings]);

  // --- Update quantity ---

  const updateQuantity = useCallback((coingeckoId: string, quantity: number) => {
    setHoldings((prev) =>
      prev.map((h) =>
        h.coingeckoId === coingeckoId ? { ...h, quantity } : h
      )
    );
  }, []);

  // --- Update price (manual override) ---

  const updatePrice = useCallback((coingeckoId: string, price: number) => {
    setHoldings((prev) =>
      prev.map((h) =>
        h.coingeckoId === coingeckoId ? { ...h, currentPriceUSD: price } : h
      )
    );
  }, []);

  // --- Duration ---

  const updateDuration = useCallback((days: number) => {
    setConfig((prev) => {
      // Cannot reduce below last action day + 1
      const lastDay = actions.length > 0 ? Math.max(...actions.map((a) => a.day)) : 0;
      const minDuration = lastDay > 0 ? lastDay + 1 : 1;
      return { ...prev, durationDays: Math.max(days, minDuration) };
    });
  }, [actions]);

  // --- Price scenarios ---

  const setPriceScenarios = useCallback((scenarios: PriceScenario[]) => {
    setConfig((prev) => {
      const next = { ...prev, priceScenarios: scenarios };
      if (next.scenarioSets?.length) {
        const activeId = next.activeScenarioSetId ?? next.scenarioSets[0]?.id;
        next.scenarioSets = next.scenarioSets.map((s) =>
          s.id === activeId ? { ...s, priceScenarios: scenarios } : s
        );
      }
      return next;
    });
  }, []);

  const addPriceScenario = useCallback((scenario: PriceScenario) => {
    setConfig((prev) => {
      const newScenarios = [
        ...prev.priceScenarios.filter((s) => s.symbol !== scenario.symbol),
        scenario,
      ];
      const next = { ...prev, priceScenarios: newScenarios };
      if (next.scenarioSets?.length) {
        const activeId = next.activeScenarioSetId ?? next.scenarioSets[0]?.id;
        next.scenarioSets = next.scenarioSets.map((s) =>
          s.id === activeId ? { ...s, priceScenarios: newScenarios } : s
        );
      }
      return next;
    });
  }, []);

  const removePriceScenario = useCallback((symbol: string) => {
    setConfig((prev) => {
      const newScenarios = prev.priceScenarios.filter((s) => s.symbol !== symbol);
      const next = { ...prev, priceScenarios: newScenarios };
      if (next.scenarioSets?.length) {
        const activeId = next.activeScenarioSetId ?? next.scenarioSets[0]?.id;
        next.scenarioSets = next.scenarioSets.map((s) =>
          s.id === activeId ? { ...s, priceScenarios: newScenarios } : s
        );
      }
      return next;
    });
  }, []);

  // --- Rate scenarios ---

  const addRateScenario = useCallback((scenario: RateScenario) => {
    setRateScenarios((prev) => {
      // Upsert by symbol + rateType
      const filtered = prev.filter(
        (s) => !(s.symbol === scenario.symbol && s.rateType === scenario.rateType)
      );
      return [...filtered, scenario];
    });
  }, []);

  const removeRateScenario = useCallback((symbol: string, rateType: RateScenario["rateType"]) => {
    setRateScenarios((prev) =>
      prev.filter((s) => !(s.symbol === symbol && s.rateType === rateType))
    );
  }, []);

  const setAllRateScenarios = useCallback((scenarios: RateScenario[]) => {
    setRateScenarios(scenarios);
  }, []);

  // Sync rateScenarios into config
  useEffect(() => {
    setConfig((prev) => ({ ...prev, rateScenarios }));
  }, [rateScenarios]);

  // --- Actions ---

  const addAction = useCallback((action: Omit<TokenAction, "id" | "orderInDay">) => {
    setActions((prev) => {
      // Validate: day must be >= last existing action day
      const lastDay = prev.length > 0 ? Math.max(...prev.map((a) => a.day)) : 0;
      if (action.day < lastDay) return prev;

      const orderInDay = prev.filter((a) => a.day === action.day).length;
      const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return [...prev, { ...action, id, orderInDay }];
    });
  }, []);

  const removeAction = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Sync actions into config
  useEffect(() => {
    setConfig((prev) => ({ ...prev, actions }));
  }, [actions]);

  // --- Add yield token ---

  const addYieldToken = useCallback(async (
    yieldRow: {
      symbol: string;
      networkId: string;
      networkName: string;
      protocol: "aave" | "morpho" | "spark" | "compound" | "morpho-blue";
      protocolLabel?: string;
      protocolUrl?: string;
      supplyAPY: number;
      variableBorrowAPY: number;
      merklSupplyAPR: number;
      merklBorrowAPR: number;
      merklRewardTokens: string[];
      totalSupplyAPY: number;
      coingeckoId?: string;
    },
    positionType: "supply" | "borrow",
    amount: number,
  ) => {
    const yieldKey = `${yieldRow.protocol}:${yieldRow.networkId}:${yieldRow.symbol}`;

    // Try to find the token on CoinGecko for price
    let price = 0;
    let coingeckoId = yieldRow.coingeckoId ?? yieldRow.symbol.toLowerCase();
    let tokenName = yieldRow.symbol;
    let tokenImage: string | undefined;

    try {
      if (yieldRow.coingeckoId) {
        // Pre-resolved coingeckoId — just fetch price + metadata
        const priceRes = await fetch(`/api/tokens/price?ids=${encodeURIComponent(yieldRow.coingeckoId)}`);
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          price = priceData[yieldRow.coingeckoId]?.usd ?? 0;
        }
        // Try to get name + image from search
        const searchRes = await fetch(`/api/tokens/search?q=${encodeURIComponent(yieldRow.symbol)}`);
        if (searchRes.ok) {
          const results: CoinGeckoSearchResult[] = await searchRes.json();
          const match = results.find((r) => r.id === yieldRow.coingeckoId);
          if (match) {
            tokenName = match.name;
            tokenImage = match.large || match.thumb;
          }
        }
      } else {
        // Fallback: symbol-based search for orphan tokens
        const searchRes = await fetch(`/api/tokens/search?q=${encodeURIComponent(yieldRow.symbol)}`);
        if (searchRes.ok) {
          const results: CoinGeckoSearchResult[] = await searchRes.json();
          const match = results.find(
            (r) => r.symbol.toLowerCase() === yieldRow.symbol.toLowerCase()
          ) || results[0];
          if (match) {
            coingeckoId = match.id;
            tokenName = match.name;
            tokenImage = match.large || match.thumb;
            const priceRes = await fetch(`/api/tokens/price?ids=${encodeURIComponent(match.id)}`);
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              price = priceData[match.id]?.usd ?? 0;
            }
          }
        }
      }
    } catch {
      // silent — proceed with 0 price
    }

    const yieldSource: YieldSource = {
      yieldKey,
      protocol: yieldRow.protocol,
      networkId: yieldRow.networkId,
      networkName: yieldRow.networkName,
      protocolLabel: yieldRow.protocolLabel,
      protocolUrl: yieldRow.protocolUrl,
      supplyAPY: yieldRow.supplyAPY,
      variableBorrowAPY: yieldRow.variableBorrowAPY,
      merklSupplyAPR: yieldRow.merklSupplyAPR,
      merklBorrowAPR: yieldRow.merklBorrowAPR,
      merklRewardTokens: yieldRow.merklRewardTokens,
      totalSupplyAPY: yieldRow.totalSupplyAPY,
    };

    // Create holding with yield source
    const holding: TokenHolding = {
      coingeckoId,
      symbol: yieldRow.symbol,
      name: tokenName,
      image: tokenImage,
      quantity: positionType === "supply" ? amount : 0,
      currentPriceUSD: price,
      yieldSource,
    };

    // Add holding (or update if exists with same yieldKey)
    setHoldings((prev) => {
      const existingIdx = prev.findIndex(
        (h) => h.yieldSource?.yieldKey === yieldKey
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + (positionType === "supply" ? amount : 0),
          yieldSource,
        };
        return next;
      }
      return [...prev, holding];
    });

    // Resolve Merkl reward tokens to coingecko ids + USD prices (best effort).
    // The engine needs a reward price to convert incentive APRs (USD-yield
    // rates) into reward-token quantities.
    const resolveRewardTokens = async (symbols: string[], aprEach: number) =>
      Promise.all(
        symbols.map(async (token) => {
          let cgId = token.toLowerCase();
          let priceUSD: number | undefined;
          try {
            const sRes = await fetch(`/api/tokens/search?q=${encodeURIComponent(token)}`);
            if (sRes.ok) {
              const results: CoinGeckoSearchResult[] = await sRes.json();
              const match = results.find(
                (r) => r.symbol.toLowerCase() === token.toLowerCase()
              ) || results[0];
              if (match) cgId = match.id;
            }
            const pRes = await fetch(`/api/tokens/price?ids=${encodeURIComponent(cgId)}`);
            if (pRes.ok) {
              const priceData = await pRes.json();
              priceUSD = priceData[cgId]?.usd;
            }
          } catch {
            // silent — engine falls back to scenario/holding prices
          }
          return { symbol: token, coingeckoId: cgId, apr: aprEach, priceUSD };
        })
      );

    // Auto-create action at day 0
    const actionId = `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (positionType === "supply") {
      const bonusRewards = yieldRow.merklSupplyAPR > 0 && yieldRow.merklRewardTokens.length > 0
        ? await resolveRewardTokens(
            yieldRow.merklRewardTokens,
            yieldRow.merklSupplyAPR / yieldRow.merklRewardTokens.length,
          )
        : undefined;

      setActions((prev) => [
        ...prev,
        {
          id: actionId,
          day: 0,
          orderInDay: prev.filter((a) => a.day === 0).length,
          type: "supply" as const,
          symbol: yieldRow.symbol,
          amount,
          supplyConfig: {
            apy: yieldRow.supplyAPY,
            locked: false,
            claimFrequency: "continuous" as const,
            bonusRewards,
            protocol: yieldRow.protocol,
            networkId: yieldRow.networkId,
            yieldKey,
          },
        },
      ]);

      // Auto-create rate scenarios (fixed mode)
      const newRateScenarios: RateScenario[] = [];
      newRateScenarios.push({
        symbol: yieldKey,
        rateType: "supply",
        mode: "fixed",
        startRate: yieldRow.supplyAPY,
        originalRate: yieldRow.supplyAPY,
      });
      if (yieldRow.variableBorrowAPY > 0) {
        newRateScenarios.push({
          symbol: yieldKey,
          rateType: "borrow",
          mode: "fixed",
          startRate: yieldRow.variableBorrowAPY,
          originalRate: yieldRow.variableBorrowAPY,
        });
      }
      if (yieldRow.merklSupplyAPR > 0) {
        newRateScenarios.push({
          symbol: yieldKey,
          rateType: "supplyIncentive",
          mode: "fixed",
          startRate: yieldRow.merklSupplyAPR,
          originalRate: yieldRow.merklSupplyAPR,
        });
      }
      if (yieldRow.merklBorrowAPR > 0) {
        newRateScenarios.push({
          symbol: yieldKey,
          rateType: "borrowIncentive",
          mode: "fixed",
          startRate: yieldRow.merklBorrowAPR,
          originalRate: yieldRow.merklBorrowAPR,
        });
      }

      setRateScenarios((prev) => {
        // Remove existing for this yieldKey, then add new
        const filtered = prev.filter((s) => s.symbol !== yieldKey);
        return [...filtered, ...newRateScenarios];
      });
    } else {
      // Borrow
      const borrowIncentives = yieldRow.merklBorrowAPR > 0 && yieldRow.merklRewardTokens.length > 0
        ? await resolveRewardTokens(
            yieldRow.merklRewardTokens,
            yieldRow.merklBorrowAPR / yieldRow.merklRewardTokens.length,
          )
        : undefined;

      setActions((prev) => [
        ...prev,
        {
          id: actionId,
          day: 0,
          orderInDay: prev.filter((a) => a.day === 0).length,
          type: "borrow" as const,
          symbol: yieldRow.symbol,
          amount,
          borrowConfig: {
            borrowAPY: yieldRow.variableBorrowAPY,
            protocol: yieldRow.protocol,
            networkId: yieldRow.networkId,
            yieldKey,
            borrowIncentives,
          },
        },
      ]);

      // Auto-create rate scenarios
      const newRateScenarios: RateScenario[] = [];
      newRateScenarios.push({
        symbol: yieldKey,
        rateType: "borrow",
        mode: "fixed",
        startRate: yieldRow.variableBorrowAPY,
        originalRate: yieldRow.variableBorrowAPY,
      });
      if (yieldRow.merklBorrowAPR > 0) {
        newRateScenarios.push({
          symbol: yieldKey,
          rateType: "borrowIncentive",
          mode: "fixed",
          startRate: yieldRow.merklBorrowAPR,
          originalRate: yieldRow.merklBorrowAPR,
        });
      }

      setRateScenarios((prev) => {
        const filtered = prev.filter((s) => s.symbol !== yieldKey);
        return [...filtered, ...newRateScenarios];
      });
    }
  }, []);

  // --- Run simulation ---

  const run = useCallback(async () => {
    if (holdings.length === 0) return;

    const currentRequestId = ++requestIdRef.current;
    setIsRunning(true);

    const simConfig: TokenSimulationConfig = {
      ...config,
      holdings,
      actions,
      rateScenarios,
    };

    try {
      const res = await fetch("/api/tokens/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: simConfig }),
      });

      if (currentRequestId !== requestIdRef.current) return;
      if (!res.ok) return;

      const data = await res.json();
      if (currentRequestId !== requestIdRef.current) return;

      setResult(data.result);

      if (data.scenarioResults) {
        const map = new Map<string, TokenSimulationResult>();
        for (const [id, sr] of data.scenarioResults) {
          map.set(id, sr as TokenSimulationResult);
        }
        setScenarioResults(map);
      } else {
        setScenarioResults(new Map());
      }
    } catch {
      // silent
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsRunning(false);
      }
    }
  }, [config, holdings, actions, rateScenarios]);

  // Auto-run when holdings or config change (debounced)
  const prevHoldingsRef = useRef(holdings);
  const prevConfigRef = useRef(config);

  useEffect(() => {
    if (holdings.length === 0) return;

    const holdingsChanged = holdings !== prevHoldingsRef.current;
    const configChanged = config !== prevConfigRef.current;

    if (!holdingsChanged && !configChanged) return;

    prevHoldingsRef.current = holdings;
    prevConfigRef.current = config;

    const timer = setTimeout(() => {
      run();
    }, 400);

    return () => clearTimeout(timer);
  }, [holdings, config, run]);

  // --- Import from wallet scan ---

  const [importSource, setImportSource] = useState<ImportSource | undefined>(undefined);

  const importFromWallet = useCallback((walletHoldings: TokenHolding[], source: ImportSource) => {
    setHoldings(walletHoldings);
    setActions([]);
    setRateScenarios([]);
    setImportSource(source);
    setConfig({
      durationDays: defaultDuration,
      holdings: walletHoldings,
      priceScenarios: [],
      rateScenarios: [],
      actions: [],
      importSource: source,
    });
    setResult(null);
    setSelectedDay(null);
  }, [defaultDuration]);

  const clearImportSource = useCallback(() => {
    setImportSource(undefined);
    setConfig((prev) => ({
      ...prev,
      importSource: undefined,
    }));
  }, []);

  // --- Load projection (restore all state) ---

  const loadProjection = useCallback((data: {
    holdings: TokenHolding[];
    actions: TokenAction[];
    priceScenarios: PriceScenario[];
    rateScenarios?: RateScenario[];
    durationDays: number;
    importSource?: ImportSource;
  }) => {
    setHoldings(data.holdings);
    setActions(data.actions);
    setRateScenarios(data.rateScenarios ?? []);
    setImportSource(data.importSource);
    setConfig({
      durationDays: data.durationDays,
      holdings: data.holdings,
      priceScenarios: data.priceScenarios,
      rateScenarios: data.rateScenarios ?? [],
      actions: data.actions,
      importSource: data.importSource,
    });
    setResult(null);
    setSelectedDay(null);
  }, []);

  return {
    holdings,
    config,
    result,
    scenarioResults,
    isRunning,
    selectedDay,
    setSelectedDay,
    searchResults,
    isSearching,
    searchTokens,
    addToken,
    removeToken,
    updateQuantity,
    updatePrice,
    updateDuration,
    setPriceScenarios,
    addPriceScenario,
    removePriceScenario,
    rateScenarios,
    addRateScenario,
    removeRateScenario,
    setAllRateScenarios,
    actions,
    addAction,
    removeAction,
    loadProjection,
    importFromWallet,
    importSource,
    clearImportSource,
    addYieldToken,
    run,
  };
}
