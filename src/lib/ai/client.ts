import { z } from "zod";
import { AIError, AIModel, AIStreamEvent, DEFAULT_AI_MODEL } from "./types";

/**
 * Robust JSON extraction from LLM output.
 * Handles: raw JSON, markdown fences (```json ... ```), extra text around JSON.
 */
function extractJSON(raw: string): unknown | undefined {
  const trimmed = raw.trim();

  // 1. Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 3. Find first { ... last } (outermost JSON object)
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      // continue
    }
  }

  // 4. Find first [ ... last ] (outermost JSON array)
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
    } catch {
      // continue
    }
  }

  return undefined;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StreamCompletionOptions {
  messages: ChatMessage[];
  model?: AIModel;
  schema: z.ZodSchema;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

class OpenRouterClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async *streamCompletion(
    options: StreamCompletionOptions
  ): AsyncGenerator<AIStreamEvent> {
    const {
      messages,
      model = DEFAULT_AI_MODEL,
      schema,
      maxTokens = 4000,
      temperature = 0.7,
      timeoutMs = 60000,
    } = options;

    yield { type: "status", message: "Connecting to AI model..." };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://projection.finance",
              "X-Title": "Projection Finance",
            },
            body: JSON.stringify({
              model,
              messages,
              stream: true,
              max_tokens: maxTokens,
              temperature,
              response_format: { type: "json_object" },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (response.status === 429) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          yield {
            type: "status",
            message: `Rate limited, retrying in ${delay / 1000}s...`,
          };
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new AIError(
            `OpenRouter API error (${response.status}): ${errorText}`,
            "MODEL_ERROR",
            response.status
          );
        }

        if (!response.body) {
          throw new AIError("No response body", "MODEL_ERROR");
        }

        yield { type: "status", message: "Generating response..." };

        let accumulated = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                accumulated += delta;
                yield { type: "chunk", content: delta };
              }
            } catch {
              // Skip malformed SSE chunks
            }
          }
        }

        // Parse and validate accumulated JSON
        yield { type: "status", message: "Validating response..." };

        const jsonResult = extractJSON(accumulated);
        if (jsonResult === undefined) {
          throw new AIError(
            "Failed to parse AI response as JSON",
            "VALIDATION_ERROR"
          );
        }

        const validation = schema.safeParse(jsonResult);
        if (!validation.success) {
          const issues = validation.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
          throw new AIError(
            `Response validation failed: ${issues}`,
            "VALIDATION_ERROR"
          );
        }

        yield { type: "result", data: validation.data };
        return;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error as Error;

        if (error instanceof AIError && error.code !== "RATE_LIMITED") {
          yield {
            type: "error",
            message: error.message,
            code: error.code,
          };
          return;
        }

        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          yield {
            type: "error",
            message: "Request timed out",
            code: "TIMEOUT",
          };
          return;
        }

        // Unknown error on last attempt
        if (attempt === MAX_RETRIES - 1) {
          yield {
            type: "error",
            message: lastError?.message || "Unknown error",
            code: "UNKNOWN",
          };
          return;
        }

        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        yield {
          type: "status",
          message: `Error, retrying in ${delay / 1000}s...`,
        };
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
}

let clientInstance: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
  if (clientInstance) return clientInstance;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIError(
      "OPENROUTER_API_KEY environment variable is not set",
      "API_KEY_MISSING",
      500
    );
  }

  clientInstance = new OpenRouterClient(apiKey);
  return clientInstance;
}
