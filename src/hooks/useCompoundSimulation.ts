"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { CompoundPositionData } from "@/src/lib/compound/types";
import type {
  CompoundSimulationConfig,
  CompoundSimulationResult,
  CompoundEngineState,
  CompoundRateScenario,
  CompoundScheduledAction,
} from "@/src/lib/simulation/compound-types";
import type { PriceScenario } from "@/src/lib/simulation/types";

export function useCompoundSimulation(
  position: CompoundPositionData,
  defaultDuration: number = 30,
) {
  const [config, setConfig] = useState<CompoundSimulationConfig>({
    durationDays: defaultDuration,
    priceScenarios: [],
    rateScenarios: [],
    scheduledActions: [],
  });

  const [result, setResult] = useState<CompoundSimulationResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<
    Map<string, CompoundSimulationResult>
  >(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const requestIdRef = useRef(0);

  // Build initial engine state from position
  const buildInitialState = useCallback((): CompoundEngineState => {
    return {
      markets: position.markets.map((m) => ({
        marketId: m.marketId,
        baseSymbol: m.baseSymbol,
        baseDecimals: m.baseDecimals,
        basePriceUSD: m.basePriceUSD,
        baseSupplyBalance: m.baseSupplyBalance,
        baseBorrowBalance: m.baseBorrowBalance,
        supplyAPY: m.supplyAPY,
        borrowAPY: m.borrowAPY,
        collaterals: m.collaterals.map((c) => ({
          symbol: c.symbol,
          address: c.address,
          balance: c.balance,
          priceUSD: c.priceUSD,
          borrowCollateralFactor: c.borrowCollateralFactor,
          liquidateCollateralFactor: c.liquidateCollateralFactor,
        })),
        cumulativeInterestEarned: 0,
        cumulativeInterestPaid: 0,
      })),
    };
  }, [position]);

  // Async simulation runner
  const runSimulationAsync = useCallback(
    async (
      cfg: CompoundSimulationConfig,
      initialState: CompoundEngineState,
    ) => {
      const currentRequestId = ++requestIdRef.current;
      setIsRunning(true);

      try {
        const scenarioConfigs = cfg.scenarioSets?.length
          ? cfg.scenarioSets.map((s) => ({
              id: s.id,
              priceScenarios: s.priceScenarios,
              rateScenarios: s.rateScenarios,
            }))
          : undefined;

        const res = await fetch("/api/simulate/compound", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: cfg,
            initialState,
            scenarioConfigs,
          }),
        });

        if (currentRequestId !== requestIdRef.current) return;
        if (!res.ok) return;

        const data = await res.json();
        if (currentRequestId !== requestIdRef.current) return;

        setResult(data.result);

        if (data.scenarioResults) {
          const map = new Map<string, CompoundSimulationResult>();
          for (const [id, sr] of data.scenarioResults) {
            map.set(id, sr as CompoundSimulationResult);
          }
          setScenarioResults(map);
        } else {
          setScenarioResults(new Map());
        }
      } catch {
        // Silently ignore
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsRunning(false);
        }
      }
    },
    [],
  );

  const updateDuration = useCallback((days: number) => {
    setConfig((prev) => ({ ...prev, durationDays: days }));
  }, []);

  // --- Price scenario methods ---
  const setPriceScenarios = useCallback((scenarios: PriceScenario[]) => {
    setConfig((prev) => ({ ...prev, priceScenarios: scenarios }));
  }, []);

  const addPriceScenario = useCallback((scenario: PriceScenario) => {
    setConfig((prev) => ({
      ...prev,
      priceScenarios: [
        ...prev.priceScenarios.filter((s) => s.symbol !== scenario.symbol),
        scenario,
      ],
    }));
  }, []);

  const removePriceScenario = useCallback((symbol: string) => {
    setConfig((prev) => ({
      ...prev,
      priceScenarios: prev.priceScenarios.filter((s) => s.symbol !== symbol),
    }));
  }, []);

  // --- Rate scenario methods ---
  const setRateScenarios = useCallback(
    (scenarios: CompoundRateScenario[]) => {
      setConfig((prev) => ({ ...prev, rateScenarios: scenarios }));
    },
    [],
  );

  const addRateScenario = useCallback((scenario: CompoundRateScenario) => {
    setConfig((prev) => ({
      ...prev,
      rateScenarios: [
        ...prev.rateScenarios.filter(
          (s) =>
            !(
              s.marketId === scenario.marketId &&
              s.rateType === scenario.rateType
            ),
        ),
        scenario,
      ],
    }));
  }, []);

  const removeRateScenario = useCallback(
    (marketId: string, rateType: "supply" | "borrow") => {
      setConfig((prev) => ({
        ...prev,
        rateScenarios: prev.rateScenarios.filter(
          (s) => !(s.marketId === marketId && s.rateType === rateType),
        ),
      }));
    },
    [],
  );

  // --- Scheduled action methods ---
  const setScheduledActions = useCallback(
    (actions: CompoundScheduledAction[]) => {
      setConfig((prev) => ({ ...prev, scheduledActions: actions }));
    },
    [],
  );

  const addScheduledAction = useCallback(
    (action: CompoundScheduledAction) => {
      setConfig((prev) => ({
        ...prev,
        scheduledActions: [...prev.scheduledActions, action],
      }));
    },
    [],
  );

  const removeScheduledAction = useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      scheduledActions: prev.scheduledActions.filter((_, i) => i !== index),
    }));
  }, []);

  // Load a full config
  const loadConfig = useCallback((newConfig: CompoundSimulationConfig) => {
    setConfig(newConfig);
  }, []);

  const loadConfigAndRun = useCallback(
    (newConfig: CompoundSimulationConfig) => {
      setConfig(newConfig);
      prevConfigRef.current = newConfig;
      const initialState = buildInitialState();
      runSimulationAsync(newConfig, initialState);
    },
    [buildInitialState, runSimulationAsync],
  );

  const run = useCallback(() => {
    setSelectedDay(null);
    const initialState = buildInitialState();
    runSimulationAsync(config, initialState);
  }, [config, buildInitialState, runSimulationAsync]);

  const clear = useCallback(() => {
    setResult(null);
    setScenarioResults(new Map());
    setSelectedDay(null);
  }, []);

  // Auto-run on position load
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current) return;
    if (!position.markets?.length) return;
    hasAutoRun.current = true;
    const initialState = buildInitialState();
    runSimulationAsync(
      {
        durationDays: defaultDuration,
        priceScenarios: [],
        rateScenarios: [],
        scheduledActions: [],
      },
      initialState,
    );
  }, [position, buildInitialState, defaultDuration, runSimulationAsync]);

  // Re-run on position change (sandbox)
  const prevPositionRef = useRef(position);
  useEffect(() => {
    if (!hasAutoRun.current) return;
    if (position === prevPositionRef.current) return;
    prevPositionRef.current = position;
    const timer = setTimeout(() => {
      const initialState = buildInitialState();
      runSimulationAsync(config, initialState);
    }, 300);
    return () => clearTimeout(timer);
  }, [position, config, buildInitialState, runSimulationAsync]);

  // Re-run on config change (debounced)
  const prevConfigRef = useRef(config);
  useEffect(() => {
    if (!hasAutoRun.current) return;
    if (config === prevConfigRef.current) return;
    prevConfigRef.current = config;
    const timer = setTimeout(() => {
      const initialState = buildInitialState();
      runSimulationAsync(config, initialState);
    }, 300);
    return () => clearTimeout(timer);
  }, [config, buildInitialState, runSimulationAsync]);

  return {
    config,
    result,
    scenarioResults,
    isRunning,
    selectedDay,
    setSelectedDay,
    updateDuration,
    setPriceScenarios,
    addPriceScenario,
    removePriceScenario,
    setRateScenarios,
    addRateScenario,
    removeRateScenario,
    setScheduledActions,
    addScheduledAction,
    removeScheduledAction,
    run,
    clear,
    loadConfig,
    loadConfigAndRun,
  };
}
