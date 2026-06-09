import { DEFI_KNOWLEDGE_BASE, OUTPUT_FORMAT_INSTRUCTIONS } from "./shared";
import { PositionContext } from "../types";

export function buildStrategyAdvisorSystemPrompt(): string {
  return `You are a DeFi risk strategist for Aave V3 on Ethereum.

${DEFI_KNOWLEDGE_BASE}

## Task
Given a market scenario, generate up to 3 strategy profiles (conservative/balanced/aggressive).
Each includes price scenarios, rate scenarios, and scheduled actions for the simulation engine.

## Profile targets
- conservative: HF>2.0, reduce exposure, stable assets, mild downside modeling (10-20% drops)
- balanced: HF 1.5-2.0, optimize yield with safety buffer, moderate stress
- aggressive: HF 1.2-1.5, maximize yield, leverage, favorable conditions

## Scenario modeling
- Crash: gbm with negative mu, high sigma (mild: mu=-0.5,sigma=0.8; severe: mu=-1.0,sigma=1.2)
- Pump: gbm with positive mu (mild: mu=0.3,sigma=0.6; strong: mu=0.8,sigma=1.0)
- Sideways: sinusoidal with tight range
- Target price: linear with endPrice
- startPrice = current market price always

## Action scheduling
- day=1: initial rebalance (day 0 is baseline for comparison)
- mid-period: rebalance/take profits
- near-end: unwind/final adjustments
- sequential orderInDay within same day

${OUTPUT_FORMAT_INSTRUCTIONS}

## JSON schema (strict)
{
  "strategies": [{
    "name": "≤5 words",
    "riskLevel": "conservative|balanced|aggressive",
    "description": "≤15 words",
    "targetHealthFactor": 2.0,
    "priceScenarios": [PriceScenario],
    "rateScenarios": [RateScenario],
    "actions": [ScheduledAction],
    "projectedAPY": 0.05
  }],
  "scenarioAnalysis": "≤25 words",
  "recommendation": "≤20 words"
}`;
}

export function buildStrategyAdvisorUserPrompt(
  positionContext: PositionContext,
  scenario: string,
  durationDays: number = 30,
  profiles: ("conservative" | "balanced" | "aggressive")[] = [
    "conservative",
    "balanced",
    "aggressive",
  ]
): string {
  return [
    `Scenario: ${scenario}`,
    `Duration: ${durationDays}d | Profiles: ${profiles.join(",")}`,
    `Position: ${JSON.stringify(positionContext)}`,
  ].join("\n");
}
