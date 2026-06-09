import { NextRequest, NextResponse } from "next/server";
import { runTokenSimulation } from "@/src/lib/tokens/engine";
import { TokenSimulationConfig, TokenSimulationResult } from "@/src/lib/tokens/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: TokenSimulationConfig = body.config;

    // Ensure defaults
    if (!config.actions) config.actions = [];
    if (!config.rateScenarios) config.rateScenarios = [];

    if (!config?.holdings?.length) {
      return NextResponse.json(
        { error: "No holdings provided" },
        { status: 400 }
      );
    }

    if (config.durationDays < 1 || config.durationDays > 365) {
      return NextResponse.json(
        { error: "Duration must be between 1 and 365 days" },
        { status: 400 }
      );
    }

    // Run main simulation
    const result = runTokenSimulation(config);

    // Run scenario set simulations if present
    let scenarioResults: [string, TokenSimulationResult][] | undefined;

    if (config.scenarioSets?.length) {
      scenarioResults = [];
      for (const set of config.scenarioSets) {
        const scenarioConfig: TokenSimulationConfig = {
          ...config,
          priceScenarios: set.priceScenarios,
          rateScenarios: set.rateScenarios ?? config.rateScenarios,
        };
        const sr = runTokenSimulation(scenarioConfig);
        scenarioResults.push([set.id, sr]);
      }
    }

    return NextResponse.json({ result, scenarioResults });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
