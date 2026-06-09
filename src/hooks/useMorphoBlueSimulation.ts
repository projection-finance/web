"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { MorphoBluePositionData } from "@/src/lib/morpho-blue/types";
import type {
  MorphoBlueSimulationConfig,
  MorphoBlueSimulationResult,
  MorphoBlueEngineState,
  MorphoBlueRateScenario,
  MorphoBlueScheduledAction,
} from "@/src/lib/simulation/morpho-blue-types";
import type { PriceScenario } from "@/src/lib/simulation/types";

export function useMorphoBlueSimulation(
  position: MorphoBluePositionData,
  defaultDuration: number = 30,
) {
  const [config, setConfig] = useState<MorphoBlueSimulationConfig>({
    durationDays: defaultDuration,
    priceScenarios: [],
    rateScenarios: [],
    scheduledActions: [],
  });

  const [result, setResult] = useState<MorphoBlueSimulationResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Map<string, MorphoBlueSimulationResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const buildInitialState = useCallback((): MorphoBlueEngineState => ({
    markets: position.markets.map((m) => ({
      uniqueKey: m.uniqueKey,
      loanSymbol: m.loanSymbol,
      collateralSymbol: m.collateralSymbol,
      lltv: m.lltv,
      loanPriceUSD: m.supplyBalanceUSD > 0 && m.supplyBalance > 0 ? m.supplyBalanceUSD / m.supplyBalance : 1,
      collateralPriceUSD: m.collateralBalanceUSD > 0 && m.collateralBalance > 0 ? m.collateralBalanceUSD / m.collateralBalance : 1,
      supplyBalance: m.supplyBalance,
      borrowBalance: m.borrowBalance,
      collateralBalance: m.collateralBalance,
      supplyAPY: m.supplyAPY,
      borrowAPY: m.borrowAPY,
      cumulativeInterestEarned: 0,
      cumulativeInterestPaid: 0,
    })),
  }), [position]);

  const runSimulationAsync = useCallback(async (cfg: MorphoBlueSimulationConfig, initialState: MorphoBlueEngineState) => {
    const currentId = ++requestIdRef.current;
    setIsRunning(true);
    try {
      const scenarioConfigs = cfg.scenarioSets?.length
        ? cfg.scenarioSets.map((s) => ({ id: s.id, priceScenarios: s.priceScenarios, rateScenarios: s.rateScenarios }))
        : undefined;
      const res = await fetch("/api/simulate/morpho-blue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg, initialState, scenarioConfigs }),
      });
      if (currentId !== requestIdRef.current) return;
      if (!res.ok) return;
      const data = await res.json();
      if (currentId !== requestIdRef.current) return;
      setResult(data.result);
      if (data.scenarioResults) {
        const map = new Map<string, MorphoBlueSimulationResult>();
        for (const [id, sr] of data.scenarioResults) map.set(id, sr as MorphoBlueSimulationResult);
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
  const setRateScenarios = useCallback((s: MorphoBlueRateScenario[]) => setConfig((p) => ({ ...p, rateScenarios: s })), []);
  const addRateScenario = useCallback((s: MorphoBlueRateScenario) => setConfig((p) => ({ ...p, rateScenarios: [...p.rateScenarios.filter((x) => !(x.uniqueKey === s.uniqueKey && x.rateType === s.rateType)), s] })), []);
  const removeRateScenario = useCallback((key: string, rt: "supply" | "borrow") => setConfig((p) => ({ ...p, rateScenarios: p.rateScenarios.filter((x) => !(x.uniqueKey === key && x.rateType === rt)) })), []);
  const setScheduledActions = useCallback((a: MorphoBlueScheduledAction[]) => setConfig((p) => ({ ...p, scheduledActions: a })), []);
  const addScheduledAction = useCallback((a: MorphoBlueScheduledAction) => setConfig((p) => ({ ...p, scheduledActions: [...p.scheduledActions, a] })), []);
  const removeScheduledAction = useCallback((i: number) => setConfig((p) => ({ ...p, scheduledActions: p.scheduledActions.filter((_, idx) => idx !== i) })), []);
  const loadConfig = useCallback((c: MorphoBlueSimulationConfig) => setConfig(c), []);
  const loadConfigAndRun = useCallback((c: MorphoBlueSimulationConfig) => {
    setConfig(c);
    prevConfigRef.current = c;
    runSimulationAsync(c, buildInitialState());
  }, [buildInitialState, runSimulationAsync]);
  const run = useCallback(() => { setSelectedDay(null); runSimulationAsync(config, buildInitialState()); }, [config, buildInitialState, runSimulationAsync]);
  const clear = useCallback(() => { setResult(null); setScenarioResults(new Map()); setSelectedDay(null); }, []);

  // Auto-run on mount
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current || !position.markets?.length) return;
    hasAutoRun.current = true;
    runSimulationAsync({ durationDays: defaultDuration, priceScenarios: [], rateScenarios: [], scheduledActions: [] }, buildInitialState());
  }, [position, buildInitialState, defaultDuration, runSimulationAsync]);

  // Re-run on position change
  const prevPositionRef = useRef(position);
  useEffect(() => {
    if (!hasAutoRun.current || position === prevPositionRef.current) return;
    prevPositionRef.current = position;
    const t = setTimeout(() => runSimulationAsync(config, buildInitialState()), 300);
    return () => clearTimeout(t);
  }, [position, config, buildInitialState, runSimulationAsync]);

  // Re-run on config change
  const prevConfigRef = useRef(config);
  useEffect(() => {
    if (!hasAutoRun.current || config === prevConfigRef.current) return;
    prevConfigRef.current = config;
    const t = setTimeout(() => runSimulationAsync(config, buildInitialState()), 300);
    return () => clearTimeout(t);
  }, [config, buildInitialState, runSimulationAsync]);

  return {
    config, result, scenarioResults, isRunning, selectedDay, setSelectedDay,
    updateDuration, setPriceScenarios, addPriceScenario, removePriceScenario,
    setRateScenarios, addRateScenario, removeRateScenario,
    setScheduledActions, addScheduledAction, removeScheduledAction,
    run, clear, loadConfig, loadConfigAndRun,
  };
}
