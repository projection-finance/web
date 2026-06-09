"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  UniswapSimulationConfig,
  UniswapSimulationResult,
  UniswapEngineState,
  VolumeScenario,
  UniswapScheduledAction,
} from "@/src/lib/simulation/uniswap-types";
import type { PriceScenario } from "@/src/lib/simulation/types";

export function useUniswapSimulation(
  initialState: UniswapEngineState,
  defaultDuration: number = 30,
) {
  const [config, setConfig] = useState<UniswapSimulationConfig>({
    durationDays: defaultDuration,
    priceScenarios: [],
    volumeScenarios: [],
    scheduledActions: [],
  });

  const [result, setResult] = useState<UniswapSimulationResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Map<string, UniswapSimulationResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const runSimulationAsync = useCallback(async (cfg: UniswapSimulationConfig, state: UniswapEngineState) => {
    const currentId = ++requestIdRef.current;
    setIsRunning(true);
    try {
      const scenarioConfigs = cfg.scenarioSets?.length
        ? cfg.scenarioSets.map((s) => ({ id: s.id, priceScenarios: s.priceScenarios, volumeScenarios: s.volumeScenarios }))
        : undefined;
      const res = await fetch("/api/simulate/uniswap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg, initialState: state, scenarioConfigs }),
      });
      if (currentId !== requestIdRef.current || !res.ok) return;
      const data = await res.json();
      if (currentId !== requestIdRef.current) return;
      setResult(data.result);
      if (data.scenarioResults) {
        const map = new Map<string, UniswapSimulationResult>();
        for (const [id, sr] of data.scenarioResults) map.set(id, sr as UniswapSimulationResult);
        setScenarioResults(map);
      } else {
        setScenarioResults(new Map());
      }
    } catch { /* silent */ }
    finally { if (currentId === requestIdRef.current) setIsRunning(false); }
  }, []);

  const updateDuration = useCallback((d: number) => setConfig((p) => ({ ...p, durationDays: d })), []);
  const setPriceScenarios = useCallback((s: PriceScenario[]) => setConfig((p) => ({ ...p, priceScenarios: s })), []);
  const addPriceScenario = useCallback((s: PriceScenario) => setConfig((p) => ({ ...p, priceScenarios: [...p.priceScenarios.filter((x) => x.symbol !== s.symbol), s] })), []);
  const removePriceScenario = useCallback((sym: string) => setConfig((p) => ({ ...p, priceScenarios: p.priceScenarios.filter((x) => x.symbol !== sym) })), []);
  const setVolumeScenarios = useCallback((s: VolumeScenario[]) => setConfig((p) => ({ ...p, volumeScenarios: s })), []);
  const addVolumeScenario = useCallback((s: VolumeScenario) => setConfig((p) => ({ ...p, volumeScenarios: [...p.volumeScenarios.filter((x) => x.poolAddress !== s.poolAddress), s] })), []);
  const removeVolumeScenario = useCallback((addr: string) => setConfig((p) => ({ ...p, volumeScenarios: p.volumeScenarios.filter((x) => x.poolAddress !== addr) })), []);
  const setScheduledActions = useCallback((a: UniswapScheduledAction[]) => setConfig((p) => ({ ...p, scheduledActions: a })), []);
  const addScheduledAction = useCallback((a: UniswapScheduledAction) => setConfig((p) => ({ ...p, scheduledActions: [...p.scheduledActions, a] })), []);
  const removeScheduledAction = useCallback((i: number) => setConfig((p) => ({ ...p, scheduledActions: p.scheduledActions.filter((_, idx) => idx !== i) })), []);
  const loadConfig = useCallback((c: UniswapSimulationConfig) => setConfig(c), []);
  const loadConfigAndRun = useCallback((c: UniswapSimulationConfig) => {
    setConfig(c);
    prevConfigRef.current = c;
    runSimulationAsync(c, initialState);
  }, [initialState, runSimulationAsync]);
  const run = useCallback(() => { setSelectedDay(null); runSimulationAsync(config, initialState); }, [config, initialState, runSimulationAsync]);
  const clear = useCallback(() => { setResult(null); setScenarioResults(new Map()); setSelectedDay(null); }, []);

  // Auto-run on mount
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current || !initialState.positions?.length) return;
    hasAutoRun.current = true;
    runSimulationAsync({ durationDays: defaultDuration, priceScenarios: [], volumeScenarios: [], scheduledActions: [] }, initialState);
  }, [initialState, defaultDuration, runSimulationAsync]);

  // Re-run on config change
  const prevConfigRef = useRef(config);
  useEffect(() => {
    if (!hasAutoRun.current || config === prevConfigRef.current) return;
    prevConfigRef.current = config;
    const t = setTimeout(() => runSimulationAsync(config, initialState), 300);
    return () => clearTimeout(t);
  }, [config, initialState, runSimulationAsync]);

  return {
    config, result, scenarioResults, isRunning, selectedDay, setSelectedDay,
    updateDuration, setPriceScenarios, addPriceScenario, removePriceScenario,
    setVolumeScenarios, addVolumeScenario, removeVolumeScenario,
    setScheduledActions, addScheduledAction, removeScheduledAction,
    run, clear, loadConfig, loadConfigAndRun,
  };
}
