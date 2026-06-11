import { NextRequest, NextResponse } from "next/server";
import { runTemporalSimulation } from "@/src/lib/simulation/engine";
import {
  TemporalSimulationConfig,
  EngineState,
  TemporalSimulationResult,
} from "@/src/lib/simulation/types";
import { simulateRequestSchema } from "@/src/lib/simulation/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Input validation (duration bounds, array sizes, finite numbers)
    const parsed = simulateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid request: ${issue.path.join(".")} — ${issue.message}` },
        { status: 400 }
      );
    }

    const config = parsed.data.config as unknown as TemporalSimulationConfig;
    const initialState = parsed.data.initialState as unknown as EngineState;
    const scenarioConfigs = parsed.data.scenarioConfigs as
      | Array<{
          id: string;
          priceScenarios: TemporalSimulationConfig["priceScenarios"];
          rateScenarios: TemporalSimulationConfig["rateScenarios"];
        }>
      | undefined;

    // Run main simulation
    const result = runTemporalSimulation(
      config,
      JSON.parse(JSON.stringify(initialState))
    );

    // Run per-scenario simulations
    let scenarioResults: Array<[string, TemporalSimulationResult]> | undefined;

    if (scenarioConfigs && scenarioConfigs.length > 0) {
      scenarioResults = [];
      for (const sc of scenarioConfigs) {
        const scenarioConfig: TemporalSimulationConfig = {
          ...config,
          priceScenarios: sc.priceScenarios,
          rateScenarios: sc.rateScenarios,
        };
        const stateCopy: EngineState = JSON.parse(
          JSON.stringify(initialState)
        );
        const simResult = runTemporalSimulation(scenarioConfig, stateCopy);
        scenarioResults.push([sc.id, simResult]);
      }
    }

    return NextResponse.json({ result, scenarioResults });
  } catch (err) {
    console.error("[/api/simulate] error:", err);
    return NextResponse.json(
      { error: "Simulation failed" },
      { status: 500 }
    );
  }
}
