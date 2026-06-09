"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { MorphoPositionData } from "@/src/lib/morpho/types";
import type {
  MorphoSimulationConfig,
  MorphoSimulationResult,
  MorphoEngineState,
  MorphoRateScenario,
  MorphoScheduledAction,
} from "@/src/lib/simulation/morpho-types";
import type { PriceScenario } from "@/src/lib/simulation/types";

export function useMorphoSimulation(
  position: MorphoPositionData,
  defaultDuration: number = 30
) {
  const [config, setConfig] = useState<MorphoSimulationConfig>({
    durationDays: defaultDuration,
    priceScenarios: [],
    rateScenarios: [],
    scheduledActions: [],
  });

  const [result, setResult] = useState<MorphoSimulationResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Map<string, MorphoSimulationResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const requestIdRef = useRef(0);

  // Build initial engine state from position
  const buildInitialState = useCallback((): MorphoEngineState => {
    return {
      vaults: position.positions.map((p) => ({
        vaultAddress: p.vaultAddress,
        vaultName: p.vaultName,
        assetSymbol: p.assetSymbol,
        balanceUsd: p.depositedUsd,
        priceUsd: 1, // USD-denominated, price=1 unless overridden
        netApy: p.netApy,
        cumulativeInterestUsd: 0,
      })),
    };
  }, [position]);

  // Async simulation runner
  const runSimulationAsync = useCallback(async (cfg: MorphoSimulationConfig, initialState: MorphoEngineState) => {
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

      const res = await fetch("/api/simulate/morpho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg, initialState, scenarioConfigs }),
      });

      if (currentRequestId !== requestIdRef.current) return;
      if (!res.ok) return;

      const data = await res.json();
      if (currentRequestId !== requestIdRef.current) return;

      setResult(data.result);

      if (data.scenarioResults) {
        const map = new Map<string, MorphoSimulationResult>();
        for (const [id, sr] of data.scenarioResults) {
          map.set(id, sr);
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
  }, []);

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

  const setRateScenarios = useCallback((scenarios: MorphoRateScenario[]) => {
    setConfig((prev) => ({ ...prev, rateScenarios: scenarios }));
  }, []);

  const addRateScenario = useCallback((scenario: MorphoRateScenario) => {
    setConfig((prev) => ({
      ...prev,
      rateScenarios: [
        ...prev.rateScenarios.filter((s) => s.vaultAddress !== scenario.vaultAddress),
        scenario,
      ],
    }));
  }, []);

  const removeRateScenario = useCallback((vaultAddress: string) => {
    setConfig((prev) => ({
      ...prev,
      rateScenarios: prev.rateScenarios.filter((s) => s.vaultAddress !== vaultAddress),
    }));
  }, []);

  // --- Scheduled action methods ---

  const setScheduledActions = useCallback((actions: MorphoScheduledAction[]) => {
    setConfig((prev) => ({ ...prev, scheduledActions: actions }));
  }, []);

  const addScheduledAction = useCallback((action: MorphoScheduledAction) => {
    setConfig((prev) => ({
      ...prev,
      scheduledActions: [...prev.scheduledActions, action],
    }));
  }, []);

  const removeScheduledAction = useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      scheduledActions: prev.scheduledActions.filter((_, i) => i !== index),
    }));
  }, []);

  // Load a full config at once
  const loadConfig = useCallback((newConfig: MorphoSimulationConfig) => {
    setConfig(newConfig);
  }, []);

  const loadConfigAndRun = useCallback((newConfig: MorphoSimulationConfig) => {
    setConfig(newConfig);
    prevConfigRef.current = newConfig;
    const initialState = buildInitialState();
    runSimulationAsync(newConfig, initialState);
  }, [buildInitialState, runSimulationAsync]);

  // --- Run simulation ---

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

  // Auto-run simulation on position load
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current) return;
    if (!position.positions?.length) return;

    hasAutoRun.current = true;
    const initialState = buildInitialState();
    const defaultConfig: MorphoSimulationConfig = {
      durationDays: defaultDuration,
      priceScenarios: [],
      rateScenarios: [],
      scheduledActions: [],
    };
    runSimulationAsync(defaultConfig, initialState);
  }, [position, buildInitialState, defaultDuration, runSimulationAsync]);

  // Re-run when position changes (sandbox: vaults added/removed/edited)
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

  // Re-run on config changes (debounced 300ms)
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
