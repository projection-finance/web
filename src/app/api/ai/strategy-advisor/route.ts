import { NextRequest } from "next/server";
import { getOpenRouterClient } from "@/src/lib/ai/client";
import { StrategyAdvisorResponseSchema } from "@/src/lib/ai/schemas";
import { AIError, AIStreamEvent, StrategyAdvisorRequest } from "@/src/lib/ai/types";
import {
  buildStrategyAdvisorSystemPrompt,
  buildStrategyAdvisorUserPrompt,
} from "@/src/lib/ai/prompts/strategy-advisor";

export async function POST(req: NextRequest) {
  try {
    const body: StrategyAdvisorRequest = await req.json();

    if (!body.positionContext || !body.scenario) {
      return new Response(
        JSON.stringify({ error: "Missing positionContext or scenario" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = getOpenRouterClient();
    const systemPrompt = buildStrategyAdvisorSystemPrompt();
    const userPrompt = buildStrategyAdvisorUserPrompt(
      body.positionContext,
      body.scenario,
      body.durationDays ?? 30,
      body.profiles ?? ["conservative", "balanced", "aggressive"]
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
            schema: StrategyAdvisorResponseSchema,
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

    console.error("[/api/ai/strategy-advisor] error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
