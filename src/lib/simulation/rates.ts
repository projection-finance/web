import { RateScenario } from "./types";

/**
 * Generate a rate series for a given scenario.
 * Returns array of APY values (as decimals) of length durationDays + 1.
 */
export function generateRateSeries(
  scenario: RateScenario,
  durationDays: number
): number[] {
  const fromDay = scenario.fromDay ?? 0;
  const original = scenario.originalRate ?? scenario.startRate;

  let scenarioRates: number[];

  switch (scenario.mode) {
    case "fixed":
      scenarioRates = Array(durationDays + 1).fill(scenario.startRate);
      break;

    case "linear": {
      const endRate = scenario.endRate ?? scenario.startRate;
      scenarioRates = [];
      for (let i = 0; i <= durationDays; i++) {
        const t = durationDays > 0 ? i / durationDays : 0;
        scenarioRates.push(scenario.startRate + (endRate - scenario.startRate) * t);
      }
      break;
    }

    case "sinusoidal": {
      const min = scenario.minRate ?? scenario.startRate;
      const max = scenario.maxRate ?? scenario.startRate;
      const cycle = scenario.cycleDays ?? durationDays;
      const mid = (min + max) / 2;
      const amplitude = (max - min) / 2;
      scenarioRates = [];
      for (let i = 0; i <= durationDays; i++) {
        scenarioRates.push(mid + amplitude * Math.sin((2 * Math.PI * i) / cycle));
      }
      break;
    }

    case "manual": {
      const manual = scenario.manualRates ?? [];
      scenarioRates = [];
      for (let i = 0; i <= durationDays; i++) {
        scenarioRates.push(
          manual[i] ?? manual[manual.length - 1] ?? scenario.startRate
        );
      }
      break;
    }

    default:
      scenarioRates = Array(durationDays + 1).fill(scenario.startRate);
  }

  // Apply fromDay: use original rate for days before fromDay
  if (fromDay > 0) {
    for (let i = 0; i < Math.min(fromDay, scenarioRates.length); i++) {
      scenarioRates[i] = original;
    }
  }

  return scenarioRates;
}

/**
 * Generate all rate series.
 * Returns: symbol → { supply?: number[], borrow?: number[] }
 */
export function generateAllRateSeries(
  scenarios: RateScenario[],
  durationDays: number
): Record<string, { supply?: number[]; borrow?: number[]; supplyIncentive?: number[]; borrowIncentive?: number[] }> {
  const result: Record<string, { supply?: number[]; borrow?: number[]; supplyIncentive?: number[]; borrowIncentive?: number[] }> = {};
  for (const scenario of scenarios) {
    if (!result[scenario.symbol]) result[scenario.symbol] = {};
    const series = generateRateSeries(scenario, durationDays);
    if (scenario.rateType === "supply") {
      result[scenario.symbol].supply = series;
    } else if (scenario.rateType === "borrow") {
      result[scenario.symbol].borrow = series;
    } else if (scenario.rateType === "supplyIncentive") {
      result[scenario.symbol].supplyIncentive = series;
    } else if (scenario.rateType === "borrowIncentive") {
      result[scenario.symbol].borrowIncentive = series;
    }
  }
  return result;
}
