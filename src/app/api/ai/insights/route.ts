import { NextRequest } from "next/server";
import { getOpenRouterClient } from "@/src/lib/ai/client";
import { AIInsightsResponseSchema } from "@/src/lib/ai/schemas";
import { AIError, AIStreamEvent, AIInsightsRequest } from "@/src/lib/ai/types";
import {
  buildAIInsightsSystemPrompt,
  buildAIInsightsUserPrompt,
} from "@/src/lib/ai/prompts/ai-insights";
import { generateHistoricalEventScenarios } from "@/src/lib/coingecko/historical";

export async function POST(req: NextRequest) {
  try {
    const body: AIInsightsRequest = await req.json();

    if (!body.prompt) {
      return new Response(
        JSON.stringify({ error: "Missing prompt" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pre-fetch historical data if requested
    let historicalPriceData: string | undefined;
    if (body.historicalContext) {
      try {
        const scenarios = await generateHistoricalEventScenarios(
          body.historicalContext.symbols,
          body.historicalContext.startDate,
          body.historicalContext.endDate,
          body.historicalContext.currentPrices
        );
        if (scenarios.length > 0) {
          historicalPriceData = JSON.stringify(
            scenarios.map((s) => ({
              symbol: s.symbol,
              durationDays: s.manualPrices?.length ?? 0,
              startPrice: s.startPrice,
              endPrice: s.manualPrices?.[s.manualPrices.length - 1] ?? s.startPrice,
              priceChange: s.manualPrices
                ? `${(((s.manualPrices[s.manualPrices.length - 1] - s.startPrice) / s.startPrice) * 100).toFixed(1)}%`
                : "0%",
            }))
          );
        }
      } catch {
        // Continue without historical data if fetch fails
        console.warn("[/api/ai/insights] Failed to fetch historical data");
      }
    }

    const client = getOpenRouterClient();
    const systemPrompt = buildAIInsightsSystemPrompt();
    const userPrompt = buildAIInsightsUserPrompt(
      body.prompt,
      body.positionContext,
      historicalPriceData
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: AIStreamEvent) => {
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
            model: body.model,
            schema: AIInsightsResponseSchema,
            maxTokens: 8000,
            temperature: 0.4,
          })) {
            sendEvent(event);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          sendEvent({ type: "error", message, code: "UNKNOWN" });
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
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: error.statusCode, headers: { "Content-Type": "application/json" } }
      );
    }

    console.error("[/api/ai/insights] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
