import { TemporalSimulationConfig } from "@/src/lib/simulation/types";
import {
  YieldOpportunity,
  StrategyProfile,
  AIInsightsResponse,
} from "./types";

/**
 * Convert yield optimizer opportunities into a TemporalSimulationConfig.
 * All opportunity actions are at day=1 (first actionable day after baseline).
 * Day 0 is reserved as the baseline state for comparison.
 */
export function yieldOpportunitiesToConfig(
  opportunities: YieldOpportunity[],
  durationDays: number
): TemporalSimulationConfig {
  const allActions = opportunities.flatMap((opp) => opp.actions);

  return {
    durationDays,
    priceScenarios: [],
    rateScenarios: [],
    scheduledActions: allActions,
  };
}

/**
 * Convert a strategy profile directly into a TemporalSimulationConfig.
 * The AI outputs exact PriceScenario[], RateScenario[], and ScheduledAction[] types.
 */
export function strategyToConfig(
  strategy: StrategyProfile,
  durationDays: number
): TemporalSimulationConfig {
  return {
    durationDays,
    priceScenarios: strategy.priceScenarios,
    rateScenarios: strategy.rateScenarios,
    scheduledActions: strategy.actions,
  };
}

/**
 * Convert AI insights response into a TemporalSimulationConfig.
 * Returns null if no scenarios or actions were generated.
 */
export function insightsToConfig(
  insights: AIInsightsResponse,
  durationDays: number
): TemporalSimulationConfig | null {
  const hasPrices = insights.priceScenarios && insights.priceScenarios.length > 0;
  const hasRates = insights.rateScenarios && insights.rateScenarios.length > 0;
  const hasActions = insights.actions && insights.actions.length > 0;

  if (!hasPrices && !hasRates && !hasActions) return null;

  return {
    durationDays,
    priceScenarios: insights.priceScenarios ?? [],
    rateScenarios: insights.rateScenarios ?? [],
    scheduledActions: insights.actions ?? [],
  };
}

/**
 * Merge multiple configs into one.
 * Actions are concatenated, scenarios are merged (last write wins per symbol).
 */
export function mergeConfigs(
  base: TemporalSimulationConfig,
  ...others: TemporalSimulationConfig[]
): TemporalSimulationConfig {
  const result: TemporalSimulationConfig = {
    durationDays: base.durationDays,
    priceScenarios: [...base.priceScenarios],
    rateScenarios: [...base.rateScenarios],
    scheduledActions: [...base.scheduledActions],
  };

  for (const other of others) {
    // Use the longest duration
    result.durationDays = Math.max(result.durationDays, other.durationDays);

    // Merge price scenarios (last write wins per symbol)
    for (const ps of other.priceScenarios) {
      const existingIdx = result.priceScenarios.findIndex(
        (s) => s.symbol === ps.symbol
      );
      if (existingIdx >= 0) {
        result.priceScenarios[existingIdx] = ps;
      } else {
        result.priceScenarios.push(ps);
      }
    }

    // Merge rate scenarios (last write wins per symbol+rateType)
    for (const rs of other.rateScenarios) {
      const existingIdx = result.rateScenarios.findIndex(
        (s) => s.symbol === rs.symbol && s.rateType === rs.rateType
      );
      if (existingIdx >= 0) {
        result.rateScenarios[existingIdx] = rs;
      } else {
        result.rateScenarios.push(rs);
      }
    }

    // Concatenate actions
    result.scheduledActions.push(...other.scheduledActions);
  }

  // Re-sort actions by day and orderInDay
  result.scheduledActions.sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay
  );

  return result;
}
