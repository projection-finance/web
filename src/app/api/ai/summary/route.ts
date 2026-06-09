import { NextRequest } from "next/server";
import { z } from "zod";
import { getOpenRouterClient } from "@/src/lib/ai/client";
import { AIError, AISummaryRequest, AIStreamEvent } from "@/src/lib/ai/types";
import { buildSummarySystemPrompt } from "@/src/lib/ai/prompts/summary";
import { sendAISummaryErrorEmail } from "@/src/lib/email";

const summarySchema = z.object({
  summary: z.string().min(50),
});

function buildUserPrompt(req: AISummaryRequest): string {
  const parts: string[] = [];

  if (req.type === "aave") {
    parts.push(`## Projection Type: Aave V3`);
    if (req.network) parts.push(`**Network:** ${req.network}`);
    if (req.address) parts.push(`**Wallet:** ${req.ensName || req.address}`);
    parts.push(`**Duration:** ${req.durationDays} days`);

    if (req.startState) {
      const s = req.startState;
      parts.push(`\n## Starting State (Day 0)`);
      parts.push(`- Health Factor: ${s.healthFactor > 1e10 ? "∞ (no debt)" : s.healthFactor.toFixed(2)}`);
      parts.push(`- Total Collateral: $${s.totalCollateralUSD.toFixed(2)}`);
      parts.push(`- Total Borrows: $${s.totalBorrowsUSD.toFixed(2)}`);
      parts.push(`- Net Worth: $${s.netWorthUSD.toFixed(2)}`);
      if (s.supplies.length) {
        parts.push(`- Supplies: ${s.supplies.map((x) => `${x.symbol} ($${x.balanceUSD.toFixed(2)}, APY ${(x.supplyAPY * 100).toFixed(2)}%)`).join(", ")}`);
      }
      if (s.borrows.length) {
        parts.push(`- Borrows: ${s.borrows.map((x) => `${x.symbol} ($${x.debtUSD.toFixed(2)}, APY ${(x.borrowAPY * 100).toFixed(2)}%)`).join(", ")}`);
      }
    }

    if (req.endState) {
      const e = req.endState;
      parts.push(`\n## Ending State (Day ${req.durationDays})`);
      parts.push(`- Health Factor: ${e.healthFactor > 1e10 ? "∞ (no debt)" : e.healthFactor.toFixed(2)}`);
      parts.push(`- Total Collateral: $${e.totalCollateralUSD.toFixed(2)}`);
      parts.push(`- Total Borrows: $${e.totalBorrowsUSD.toFixed(2)}`);
      parts.push(`- Net Worth: $${e.netWorthUSD.toFixed(2)}`);
      if (e.supplies.length) {
        parts.push(`- Supplies: ${e.supplies.map((x) => `${x.symbol} ($${x.balanceUSD.toFixed(2)}, APY ${(x.supplyAPY * 100).toFixed(2)}%)`).join(", ")}`);
      }
      if (e.borrows.length) {
        parts.push(`- Borrows: ${e.borrows.map((x) => `${x.symbol} ($${x.debtUSD.toFixed(2)}, APY ${(x.borrowAPY * 100).toFixed(2)}%)`).join(", ")}`);
      }
    }

    if (req.simulationSummary) {
      const sm = req.simulationSummary;
      parts.push(`\n## Simulation Summary`);
      parts.push(`- Start Net Worth: $${sm.startNetWorth.toFixed(2)}`);
      parts.push(`- End Net Worth: $${sm.endNetWorth.toFixed(2)}`);
      parts.push(`- Net Worth Change: $${(sm.endNetWorth - sm.startNetWorth).toFixed(2)} (${(((sm.endNetWorth - sm.startNetWorth) / Math.max(sm.startNetWorth, 0.01)) * 100).toFixed(2)}%)`);
      parts.push(`- Total Interest Earned: $${sm.totalInterestEarned.toFixed(2)}`);
      parts.push(`- Total Interest Paid: $${sm.totalInterestPaid.toFixed(2)}`);
      parts.push(`- Total Incentives Earned: $${sm.totalIncentivesEarnedUSD.toFixed(2)}`);
      parts.push(`- Lowest Health Factor: ${sm.lowestHealthFactor > 1e10 ? "∞" : sm.lowestHealthFactor.toFixed(2)} (day ${sm.lowestHealthFactorDay})`);
      parts.push(`- Liquidation Occurred: ${sm.liquidationOccurred ? `YES (day ${sm.liquidationDay})` : "No"}`);
    }

    if (req.priceChanges?.length) {
      parts.push(`\n## Price Scenarios`);
      for (const p of req.priceChanges) {
        parts.push(`- ${p.symbol}: mode=${p.mode}, start=$${p.startPrice.toFixed(2)}${p.endPrice != null ? `, end=$${p.endPrice.toFixed(2)}` : ""}`);
      }
    }

    if (req.rateChanges?.length) {
      parts.push(`\n## Rate Scenarios`);
      for (const r of req.rateChanges) {
        parts.push(`- ${r.symbol} ${r.rateType}: mode=${r.mode}, start=${(r.startRate * 100).toFixed(2)}%${r.endRate != null ? `, end=${(r.endRate * 100).toFixed(2)}%` : ""}`);
      }
    }

    if (req.actions?.length) {
      parts.push(`\n## Scheduled Actions (${req.actions.length} total)`);
      for (const a of req.actions.slice(0, 30)) {
        parts.push(`- Day ${a.day}: ${a.type} ${a.amount} ${a.symbol}`);
      }
      if (req.actions.length > 30) {
        parts.push(`- ... and ${req.actions.length - 30} more actions`);
      }
    }
  } else {
    // Sandbox
    parts.push(`## Projection Type: Portfolio Sandbox`);
    parts.push(`**Duration:** ${req.durationDays} days`);
    if (req.address) parts.push(`**Imported from:** ${req.ensName || req.address}${req.network ? ` (${req.network})` : ""}`);

    if (req.sandboxSummary) {
      const sm = req.sandboxSummary;
      parts.push(`\n## Simulation Summary`);
      parts.push(`- Start Value: $${sm.startValueUSD.toFixed(2)}`);
      parts.push(`- End Value: $${sm.endValueUSD.toFixed(2)}`);
      parts.push(`- Change: $${sm.changeUSD.toFixed(2)} (${(sm.changePercent * 100).toFixed(2)}%)`);
      parts.push(`- Highest Value: $${sm.highestValueUSD.toFixed(2)} (day ${sm.highestValueDay})`);
      parts.push(`- Lowest Value: $${sm.lowestValueUSD.toFixed(2)} (day ${sm.lowestValueDay})`);
      parts.push(`- Total Interest Earned: $${sm.totalInterestEarned.toFixed(2)}`);
      parts.push(`- Total Rewards Earned: $${sm.totalRewardsEarned.toFixed(2)}`);
    }

    if (req.sandboxStartHoldings?.length) {
      parts.push(`\n## Starting Holdings`);
      for (const h of req.sandboxStartHoldings) {
        parts.push(`- ${h.symbol}: ${h.quantity} ($${h.valueUSD.toFixed(2)})`);
      }
    }

    if (req.sandboxEndHoldings?.length) {
      parts.push(`\n## Ending Holdings`);
      for (const h of req.sandboxEndHoldings) {
        parts.push(`- ${h.symbol}: ${h.quantity} ($${h.valueUSD.toFixed(2)})`);
      }
    }

    if (req.priceChanges?.length) {
      parts.push(`\n## Price Scenarios`);
      for (const p of req.priceChanges) {
        parts.push(`- ${p.symbol}: mode=${p.mode}, start=$${p.startPrice.toFixed(2)}${p.endPrice != null ? `, end=$${p.endPrice.toFixed(2)}` : ""}`);
      }
    }

    if (req.sandboxActions?.length) {
      parts.push(`\n## Scheduled Actions (${req.sandboxActions.length} total)`);
      for (const a of req.sandboxActions.slice(0, 30)) {
        parts.push(`- Day ${a.day}: ${a.type} ${a.amount} ${a.symbol}${a.toSymbol ? ` → ${a.toSymbol}` : ""}`);
      }
      if (req.sandboxActions.length > 30) {
        parts.push(`- ... and ${req.sandboxActions.length - 30} more actions`);
      }
    }
  }

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body: AISummaryRequest = await req.json();

    const language = body.language || "en";
    const model = body.model;

    const client = getOpenRouterClient();
    const systemPrompt = buildSummarySystemPrompt(language);
    const userPrompt = buildUserPrompt(body);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (event: AIStreamEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        };

        try {
          for await (const event of client.streamCompletion({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            model,
            schema: summarySchema,
            maxTokens: 2000,
            temperature: 0.6,
            timeoutMs: 45000,
          })) {
            if (event.type === "error") {
              const isApiError =
                event.code === "API_KEY_MISSING" ||
                event.code === "RATE_LIMITED" ||
                event.code === "MODEL_ERROR";
              if (isApiError) {
                sendAISummaryErrorEmail(event.message, event.code).catch((e) => console.warn("[AI] Alert email failed:", e.message));
              }
            }
            send(event);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          const code = error instanceof AIError ? error.code : "UNKNOWN";
          const isApiError =
            error instanceof AIError &&
            (error.code === "API_KEY_MISSING" ||
              error.code === "RATE_LIMITED" ||
              error.code === "MODEL_ERROR");
          if (isApiError) {
            sendAISummaryErrorEmail(message, code).catch((e) => console.warn("[AI] Alert email failed:", e.message));
          }
          send({ type: "error", message, code });
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof AIError) {
      const isApiError =
        error.code === "API_KEY_MISSING" ||
        error.code === "RATE_LIMITED" ||
        error.code === "MODEL_ERROR";
      if (isApiError) {
        sendAISummaryErrorEmail(error.message, error.code).catch((e) => console.warn("[AI] Alert email failed:", e.message));
      }
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: error.statusCode, headers: { "Content-Type": "application/json" } }
      );
    }

    console.error("[/api/ai/summary] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
