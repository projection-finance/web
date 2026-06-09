"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AavePositionData, SimSnapshot } from "@/src/lib/aave/types";
import {
  TemporalSimulationConfig,
  TemporalSimulationResult,
  PriceScenario,
  RateScenario,
  ScheduledAction,
  EngineState,
  ScenarioSet,
} from "@/src/lib/simulation/types";
import {
  ensureScenarioSets,
  duplicateScenarioSet as dupSet,
  generateInverseScenario,
  generateMonteCarloScenarios,
} from "@/src/lib/simulation/scenarios";
import BigNumber from "bignumber.js";

export function useTemporalSimulation(
  position: AavePositionData,
  currentSnapshot?: SimSnapshot,
  defaultDuration: number = 30
) {
  const [config, setConfig] = useState<TemporalSimulationConfig>({
    durationDays: defaultDuration,
    priceScenarios: [],
    rateScenarios: [],
    scheduledActions: [],
  });

  const [result, setResult] = useState<TemporalSimulationResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Map<string, TemporalSimulationResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Race condition handling: incrementing request counter
  const requestIdRef = useRef(0);

  // Sync flat priceScenarios/rateScenarios from the active set
  const syncFlatFromActiveSet = useCallback((cfg: TemporalSimulationConfig): TemporalSimulationConfig => {
    const activeSet = cfg.scenarioSets?.find((s) => s.id === (cfg.activeScenarioSetId ?? cfg.scenarioSets?.[0]?.id));
    if (!activeSet) return cfg;
    return {
      ...cfg,
      priceScenarios: activeSet.priceScenarios,
      rateScenarios: activeSet.rateScenarios,
    };
  }, []);

  // Compute initial engine state from the position (or current snapshot if provided)
  const buildInitialState = useCallback((): EngineState => {
    const marketReferenceCurrencyPriceInUSD = currentSnapshot
      ? currentSnapshot.marketReferenceCurrencyPriceInUSD
      : new BigNumber(
          position.baseCurrencyData.marketReferenceCurrencyPriceInUsd
        )
          .shiftedBy(-8)
          .toNumber();

    return {
      rawUserReserves: JSON.parse(
        JSON.stringify(
          currentSnapshot?.rawUserReserves ?? position.rawUserReserves
        )
      ),
      formattedPoolReserves: JSON.parse(
        JSON.stringify(
          currentSnapshot?.formattedPoolReserves ??
            position.formattedPoolReserves
        )
      ),
      baseCurrencyData: JSON.parse(JSON.stringify(position.baseCurrencyData)),
      userEmodeCategoryId: position.userEmodeCategoryId,
      marketReferenceCurrencyPriceInUSD,
      healthFactorData: currentSnapshot?.healthFactorData ?? position.workingData,
      merklIncentives: position.merklIncentives,
    };
  }, [position, currentSnapshot]);

  // Async simulation runner — calls the server API
  const runSimulationAsync = useCallback(async (cfg: TemporalSimulationConfig, initialState: EngineState) => {
    const currentRequestId = ++requestIdRef.current;
    setIsRunning(true);

    try {
      // Build scenario configs from scenarioSets
      const scenarioConfigs = cfg.scenarioSets?.length
        ? cfg.scenarioSets.map((s) => ({
            id: s.id,
            priceScenarios: s.priceScenarios,
            rateScenarios: s.rateScenarios,
          }))
        : undefined;

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg, initialState, scenarioConfigs }),
      });

      // Stale response — a newer request has been issued
      if (currentRequestId !== requestIdRef.current) return;

      if (!res.ok) return;

      const data = await res.json();

      // Check staleness again after parsing
      if (currentRequestId !== requestIdRef.current) return;

      setResult(data.result);

      if (data.scenarioResults) {
        const map = new Map<string, TemporalSimulationResult>();
        for (const [id, sr] of data.scenarioResults) {
          map.set(id, sr);
        }
        setScenarioResults(map);
      } else {
        setScenarioResults(new Map());
      }
    } catch {
      // Silently ignore errors (network failures, stale responses, etc.)
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsRunning(false);
      }
    }
  }, []);

  const updateDuration = useCallback((days: number) => {
    setConfig((prev) => ({ ...prev, durationDays: days }));
  }, []);

  // --- Flat scenario methods (modify the active set when scenarioSets exist) ---

  const setPriceScenarios = useCallback((scenarios: PriceScenario[]) => {
    setConfig((prev) => {
      const next = { ...prev, priceScenarios: scenarios };
      // Also update the active scenario set if it exists
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
      const newPriceScenarios = [
        ...prev.priceScenarios.filter((s) => s.symbol !== scenario.symbol),
        scenario,
      ];
      const next = { ...prev, priceScenarios: newPriceScenarios };
      if (next.scenarioSets?.length) {
        const activeId = next.activeScenarioSetId ?? next.scenarioSets[0]?.id;
        next.scenarioSets = next.scenarioSets.map((s) =>
          s.id === activeId ? { ...s, priceScenarios: newPriceScenarios } : s
        );
      }
      return next;
    });
  }, []);

  const removePriceScenario = useCallback((symbol: string) => {
    setConfig((prev) => {
      const newPriceScenarios = prev.priceScenarios.filter((s) => s.symbol !== symbol);
      const next = { ...prev, priceScenarios: newPriceScenarios };
      if (next.scenarioSets?.length) {
        const activeId = next.activeScenarioSetId ?? next.scenarioSets[0]?.id;
        next.scenarioSets = next.scenarioSets.map((s) =>
          s.id === activeId ? { ...s, priceScenarios: newPriceScenarios } : s
        );
      }
      return next;
    });
  }, []);

  const setRateScenarios = useCallback((scenarios: RateScenario[]) => {
    setConfig((prev) => {
      const next = { ...prev, rateScenarios: scenarios };
      if (next.scenarioSets?.length) {
        const activeId = next.activeScenarioSetId ?? next.scenarioSets[0]?.id;
        next.scenarioSets = next.scenarioSets.map((s) =>
          s.id === activeId ? { ...s, rateScenarios: scenarios } : s
        );
      }
      return next;
    });
  }, []);

  const addRateScenario = useCallback((scenario: RateScenario) => {
    setConfig((prev) => {
      const newRateScenarios = [
        ...prev.rateScenarios.filter(
          (s) =>
            !(s.symbol === scenario.symbol && s.rateType === scenario.rateType)
        ),
        scenario,
      ];
      const next = { ...prev, rateScenarios: newRateScenarios };
      if (next.scenarioSets?.length) {
        const activeId = next.activeScenarioSetId ?? next.scenarioSets[0]?.id;
        next.scenarioSets = next.scenarioSets.map((s) =>
          s.id === activeId ? { ...s, rateScenarios: newRateScenarios } : s
        );
      }
      return next;
    });
  }, []);

  const removeRateScenario = useCallback(
    (symbol: string, rateType: "supply" | "borrow" | "supplyIncentive" | "borrowIncentive") => {
      setConfig((prev) => {
        const newRateScenarios = prev.rateScenarios.filter(
          (s) => !(s.symbol === symbol && s.rateType === rateType)
        );
        const next = { ...prev, rateScenarios: newRateScenarios };
        if (next.scenarioSets?.length) {
          const activeId = next.activeScenarioSetId ?? next.scenarioSets[0]?.id;
          next.scenarioSets = next.scenarioSets.map((s) =>
            s.id === activeId ? { ...s, rateScenarios: newRateScenarios } : s
          );
        }
        return next;
      });
    },
    []
  );

  // --- Scheduled action methods (shared across all scenarios) ---

  const setScheduledActions = useCallback((actions: ScheduledAction[]) => {
    setConfig((prev) => ({ ...prev, scheduledActions: actions }));
  }, []);

  const addScheduledAction = useCallback((action: ScheduledAction) => {
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

  // Load a full config at once (used when restoring projections)
  const loadConfig = useCallback((newConfig: TemporalSimulationConfig) => {
    setConfig(newConfig);
  }, []);

  // Load config AND immediately run with it (bypasses stale closure in run())
  // Also updates prevConfigRef so the debounced re-run doesn't fire redundantly
  const loadConfigAndRun = useCallback((newConfig: TemporalSimulationConfig) => {
    setConfig(newConfig);
    prevConfigRef.current = newConfig;
    const initialState = buildInitialState();
    runSimulationAsync(newConfig, initialState);
  }, [buildInitialState, runSimulationAsync]);

  // --- Scenario set management ---

  const setActiveScenarioSetId = useCallback((id: string) => {
    setConfig((prev) => {
      const set = prev.scenarioSets?.find((s) => s.id === id);
      if (!set) return prev;
      return {
        ...prev,
        activeScenarioSetId: id,
        priceScenarios: set.priceScenarios,
        rateScenarios: set.rateScenarios,
      };
    });
  }, []);

  const addScenarioSet = useCallback((set: ScenarioSet) => {
    setConfig((prev) => {
      const withSets = ensureScenarioSets(prev);
      return {
        ...withSets,
        scenarioSets: [...(withSets.scenarioSets ?? []), set],
      };
    });
  }, []);

  const updateScenarioSet = useCallback((id: string, partial: Partial<ScenarioSet>) => {
    setConfig((prev) => {
      if (!prev.scenarioSets) return prev;
      const next = {
        ...prev,
        scenarioSets: prev.scenarioSets.map((s) =>
          s.id === id ? { ...s, ...partial } : s
        ),
      };
      // If updating the active set, sync flat scenarios
      const activeId = next.activeScenarioSetId ?? next.scenarioSets?.[0]?.id;
      if (id === activeId) {
        return syncFlatFromActiveSet(next);
      }
      return next;
    });
  }, [syncFlatFromActiveSet]);

  const removeScenarioSet = useCallback((id: string) => {
    setConfig((prev) => {
      if (!prev.scenarioSets) return prev;
      const remaining = prev.scenarioSets.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        // Can't remove last set — reset to empty
        return {
          ...prev,
          scenarioSets: undefined,
          activeScenarioSetId: undefined,
        };
      }
      const wasActive = (prev.activeScenarioSetId ?? prev.scenarioSets[0]?.id) === id;
      const next = {
        ...prev,
        scenarioSets: remaining,
        activeScenarioSetId: wasActive ? remaining[0].id : prev.activeScenarioSetId,
      };
      if (wasActive) {
        return syncFlatFromActiveSet(next);
      }
      return next;
    });
  }, [syncFlatFromActiveSet]);

  const duplicateScenarioSet = useCallback((id: string) => {
    setConfig((prev) => {
      const withSets = ensureScenarioSets(prev);
      const source = withSets.scenarioSets?.find((s) => s.id === id);
      if (!source) return prev;
      const dup = dupSet(source, (withSets.scenarioSets?.length ?? 0));
      return {
        ...withSets,
        scenarioSets: [...(withSets.scenarioSets ?? []), dup],
      };
    });
  }, []);

  const addInverseScenario = useCallback((sourceId: string) => {
    setConfig((prev) => {
      const withSets = ensureScenarioSets(prev);
      const source = withSets.scenarioSets?.find((s) => s.id === sourceId);
      if (!source) return prev;
      const inverse = generateInverseScenario(source, (withSets.scenarioSets?.length ?? 0));
      return {
        ...withSets,
        scenarioSets: [...(withSets.scenarioSets ?? []), inverse],
      };
    });
  }, []);

  const addMonteCarloScenarios = useCallback((sourceId: string, count: number = 3, volatility: number = 0.8) => {
    setConfig((prev) => {
      const withSets = ensureScenarioSets(prev);
      const source = withSets.scenarioSets?.find((s) => s.id === sourceId);
      if (!source) return prev;
      const startIdx = withSets.scenarioSets?.length ?? 0;
      const mcSets = generateMonteCarloScenarios(source, count, volatility, startIdx);
      return {
        ...withSets,
        scenarioSets: [...(withSets.scenarioSets ?? []), ...mcSets],
      };
    });
  }, []);

  const initScenarioSets = useCallback(() => {
    setConfig((prev) => {
      if (prev.scenarioSets?.length) return prev;
      return ensureScenarioSets(prev);
    });
  }, []);

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

  // Auto-run simulation on position load (immediate, no debounce)
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current) return;
    if (!position.formattedPoolReserves?.length) return;

    hasAutoRun.current = true;
    const initialState = buildInitialState();
    const defaultConfig: TemporalSimulationConfig = {
      durationDays: defaultDuration,
      priceScenarios: [],
      rateScenarios: [],
      scheduledActions: [],
    };
    runSimulationAsync(defaultConfig, initialState);
  }, [position, buildInitialState, defaultDuration, runSimulationAsync]);

  // Re-run simulation when snapshot or config changes (debounced 300ms)
  const prevSnapshotIdRef = useRef<string | undefined>(currentSnapshot?.id);
  const prevConfigRef = useRef(config);
  useEffect(() => {
    if (!hasAutoRun.current) return;

    const snapshotChanged =
      currentSnapshot && currentSnapshot.id !== prevSnapshotIdRef.current;
    const configChanged = config !== prevConfigRef.current;

    if (!snapshotChanged && !configChanged) return;

    if (snapshotChanged && currentSnapshot) {
      prevSnapshotIdRef.current = currentSnapshot.id;
    }
    if (configChanged) {
      prevConfigRef.current = config;
    }

    const timer = setTimeout(() => {
      const initialState = buildInitialState();
      runSimulationAsync(config, initialState);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentSnapshot, config, buildInitialState, runSimulationAsync]);

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
    // Multi-scenario methods
    setActiveScenarioSetId,
    addScenarioSet,
    updateScenarioSet,
    removeScenarioSet,
    duplicateScenarioSet,
    addInverseScenario,
    addMonteCarloScenarios,
    initScenarioSets,
  };
}
