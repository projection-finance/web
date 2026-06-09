import { DEFI_KNOWLEDGE_BASE, OUTPUT_FORMAT_INSTRUCTIONS } from "./shared";
import { PositionContext } from "../types";

export function buildYieldOptimizerSystemPrompt(): string {
  return `You are a DeFi yield optimizer for Aave V3 on Ethereum.

${DEFI_KNOWLEDGE_BASE}

## Task
Analyze the position. Find 1-5 yield optimizations. Each = concrete actions (day=1).

## Rules
- Never bring HF below user minimum (default 1.5)
- day=1 (day 0 is baseline), sequential orderInDay (0,1,2...)
- Amounts within current balances. Only symbols from availableAssets.
- Withdrawals ≤ supply balance. Repayments ≤ debt balance.

${OUTPUT_FORMAT_INSTRUCTIONS}

## JSON schema (strict)
{
  "opportunities": [{
    "title": "≤8 words",
    "description": "≤15 words",
    "estimatedAPYImprovement": 0.02,
    "riskLevel": "low|medium|high",
    "actions": [ScheduledAction]
  }],
  "currentNetAPY": 0.05,
  "projectedNetAPY": 0.07,
  "analysis": "≤25 words"
}`;
}

export function buildYieldOptimizerUserPrompt(
  positionContext: PositionContext,
  constraints?: {
    minHealthFactor?: number;
    riskTolerance?: "conservative" | "balanced" | "aggressive";
    excludeSymbols?: string[];
  }
): string {
  const parts = [
    "Optimize this position:",
    JSON.stringify(positionContext),
  ];

  if (constraints) {
    const c: string[] = [];
    if (constraints.minHealthFactor) c.push(`minHF:${constraints.minHealthFactor}`);
    if (constraints.riskTolerance) c.push(`risk:${constraints.riskTolerance}`);
    if (constraints.excludeSymbols?.length) c.push(`exclude:${constraints.excludeSymbols.join(",")}`);
    if (c.length) parts.push(`Constraints: ${c.join(", ")}`);
  }

  return parts.join("\n");
}
