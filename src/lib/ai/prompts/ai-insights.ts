import { DEFI_KNOWLEDGE_BASE, OUTPUT_FORMAT_INSTRUCTIONS } from "./shared";
import { PositionContext } from "../types";

export function buildAIInsightsSystemPrompt(): string {
  return `You are a DeFi scenario generator for Aave V3 on Ethereum.

${DEFI_KNOWLEDGE_BASE}

## Task
Generate price and rate scenarios from natural language descriptions.
Focus on PriceScenarios and RateScenarios. Do NOT generate actions (use strategy advisor for that).

## Capabilities
- Historical events → model with gbm (crash: negative mu+high sigma) or linear
- Hypothetical scenarios → appropriate mode (fixed/linear/gbm/sinusoidal)
- Always use current market prices as startPrice
- Include rate scenarios if the event would affect interest rates

## Historical event guidelines
- COVID crash (Mar 2020): gbm mu=-2.0 sigma=1.5 for ~14 days
- Black Thursday: gbm mu=-3.0 sigma=2.0 for ~7 days
- Bull run: gbm mu=1.0 sigma=0.8 for ~90 days
- Gradual decline: linear from current to target over N days
- Flash crash + recovery: manual prices array

${OUTPUT_FORMAT_INSTRUCTIONS}

## JSON schema (strict)
{
  "answer": "≤30 words explaining the scenario",
  "priceScenarios": [PriceScenario],
  "rateScenarios": [RateScenario],
  "reasoning": "≤20 words (optional)"
}

Do NOT include "actions" in the response. Only price and rate scenarios.`;
}

export function buildAIInsightsUserPrompt(
  prompt: string,
  positionContext?: PositionContext,
  historicalPriceData?: string
): string {
  const parts = [prompt];

  if (positionContext) {
    parts.push(`Position: ${JSON.stringify(positionContext)}`);
  }

  if (historicalPriceData) {
    parts.push(`Historical data: ${historicalPriceData}`);
  }

  return parts.join("\n");
}
