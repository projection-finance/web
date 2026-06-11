import { NextRequest, NextResponse } from "next/server";
import { runTokenSimulation } from "@/src/lib/tokens/engine";
import { TokenSimulationConfig, TokenSimulationResult } from "@/src/lib/tokens/types";
import { tokenConfigSchema } from "@/src/lib/simulation/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Input validation (duration bounds, array sizes, finite numbers)
    const parsed = tokenConfigSchema.safeParse(body?.config);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid config: ${issue.path.join(".")} — ${issue.message}` },
        { status: 400 }
      );
    }

    const config = parsed.data as unknown as TokenSimulationConfig;

    // Ensure defaults
    if (!config.actions) config.actions = [];
    if (!config.rateScenarios) config.rateScenarios = [];

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
