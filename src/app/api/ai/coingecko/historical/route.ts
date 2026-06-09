import { NextRequest, NextResponse } from "next/server";
import { generateHistoricalEventScenarios } from "@/src/lib/coingecko/historical";

interface HistoricalRequestBody {
  symbols: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  currentPrices: Record<string, number>;
}

export async function POST(req: NextRequest) {
  try {
    const body: HistoricalRequestBody = await req.json();

    if (
      !body.symbols?.length ||
      !body.startDate ||
      !body.endDate ||
      !body.currentPrices
    ) {
      return NextResponse.json(
        { error: "Missing required fields: symbols, startDate, endDate, currentPrices" },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.startDate) || !dateRegex.test(body.endDate)) {
      return NextResponse.json(
        { error: "Dates must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    // Limit to 5 symbols max
    if (body.symbols.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 symbols allowed" },
        { status: 400 }
      );
    }

    const scenarios = await generateHistoricalEventScenarios(
      body.symbols,
      body.startDate,
      body.endDate,
      body.currentPrices
    );

    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error("[/api/ai/coingecko/historical] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch historical data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
