import { ScenarioSet, PriceScenario, TemporalSimulationConfig } from "./types";

/** Palette of distinguishable colors for scenario chart lines */
export const SCENARIO_COLORS = [
  "#4F7FFA", // blue (default/first)
  "#EF4444", // red
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

let nextIdCounter = 0;

function generateId(): string {
  nextIdCounter++;
  return `s${Date.now().toString(36)}${nextIdCounter}`;
}

/**
 * Ensures a config has scenarioSets populated.
 * If scenarioSets is empty/undefined, creates one from existing flat priceScenarios/rateScenarios.
 */
export function ensureScenarioSets(config: TemporalSimulationConfig): TemporalSimulationConfig {
  if (config.scenarioSets && config.scenarioSets.length > 0) {
    return config;
  }

  const defaultSet: ScenarioSet = {
    id: generateId(),
    name: "Scenario 1",
    color: SCENARIO_COLORS[0],
    priceScenarios: [...config.priceScenarios],
    rateScenarios: [...config.rateScenarios],
  };

  return {
    ...config,
    scenarioSets: [defaultSet],
    activeScenarioSetId: defaultSet.id,
  };
}

/**
 * Creates an inverse scenario from a source set.
 * For each price scenario, mirrors the delta relative to the start price.
 * If ETH goes from $3000 to $4200 (+40%), inverse goes from $3000 to $1800 (-40%).
 * Rate scenarios are copied as-is.
 */
export function generateInverseScenario(
  source: ScenarioSet,
  colorIndex: number
): ScenarioSet {
  const inversePrices: PriceScenario[] = source.priceScenarios.map((ps) => {
    const base = { ...ps };

    switch (ps.mode) {
      case "fixed":
        // Fixed stays the same (no delta to invert)
        break;

      case "linear": {
        if (ps.endPrice !== undefined) {
          const delta = ps.endPrice - ps.startPrice;
          base.endPrice = ps.startPrice - delta;
        }
        break;
      }

      case "sinusoidal": {
        // Swap min/max around the midpoint
        if (ps.minPrice !== undefined && ps.maxPrice !== undefined) {
          const mid = (ps.minPrice + ps.maxPrice) / 2;
          base.minPrice = mid - (ps.maxPrice - mid);
          base.maxPrice = mid + (mid - ps.minPrice);
        }
        break;
      }

      case "gbm": {
        // Invert drift
        if (ps.mu !== undefined) {
          base.mu = -ps.mu;
        }
        break;
      }

      case "manual": {
        if (ps.manualPrices && ps.manualPrices.length > 0) {
          const start = ps.manualPrices[0];
          base.manualPrices = ps.manualPrices.map((p) => {
            const delta = p - start;
            return Math.max(0, start - delta);
          });
        }
        break;
      }
    }

    return base;
  });

  return {
    id: generateId(),
    name: `Inverse of ${source.name}`,
    color: SCENARIO_COLORS[colorIndex % SCENARIO_COLORS.length],
    priceScenarios: inversePrices,
    rateScenarios: [...source.rateScenarios],
  };
}

/**
 * Generates Monte Carlo scenario sets using GBM.
 * For each price scenario in the base set, generates `count` GBM variants.
 */
export function generateMonteCarloScenarios(
  baseScenario: ScenarioSet,
  count: number,
  volatility: number,
  startColorIndex: number
): ScenarioSet[] {
  const results: ScenarioSet[] = [];

  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 100000000) + 1;

    const mcPrices: PriceScenario[] = baseScenario.priceScenarios.map((ps) => ({
      ...ps,
      mode: "gbm" as const,
      mu: ps.mu ?? 0,
      sigma: volatility,
      seed: seed + i,
      // Preserve fromDay and originalPrice
    }));

    results.push({
      id: generateId(),
      name: `MC #${i + 1}`,
      color: SCENARIO_COLORS[(startColorIndex + i) % SCENARIO_COLORS.length],
      priceScenarios: mcPrices,
      rateScenarios: [...baseScenario.rateScenarios],
    });
  }

  return results;
}

/**
 * Creates a new empty scenario set with the next available color.
 */
export function createEmptyScenarioSet(existingCount: number): ScenarioSet {
  return {
    id: generateId(),
    name: `Scenario ${existingCount + 1}`,
    color: SCENARIO_COLORS[existingCount % SCENARIO_COLORS.length],
    priceScenarios: [],
    rateScenarios: [],
  };
}

/**
 * Duplicates a scenario set with a new id and name.
 */
export function duplicateScenarioSet(
  source: ScenarioSet,
  colorIndex: number
): ScenarioSet {
  return {
    id: generateId(),
    name: `${source.name} (copy)`,
    color: SCENARIO_COLORS[colorIndex % SCENARIO_COLORS.length],
    priceScenarios: JSON.parse(JSON.stringify(source.priceScenarios)),
    rateScenarios: JSON.parse(JSON.stringify(source.rateScenarios)),
  };
}
