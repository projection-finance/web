import { NextRequest, NextResponse } from "next/server";
import { runTemporalSimulation } from "@/src/lib/simulation/engine";
import {
  TemporalSimulationConfig,
  EngineState,
  TemporalSimulationResult,
} from "@/src/lib/simulation/types";

interface SimulateRequestBody {
  config: TemporalSimulationConfig;
  initialState: EngineState;
  scenarioConfigs?: Array<{
    id: string;
    priceScenarios: TemporalSimulationConfig["priceScenarios"];
    rateScenarios: TemporalSimulationConfig["rateScenarios"];
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: SimulateRequestBody = await req.json();
    const { config, initialState, scenarioConfigs } = body;

    // Input validation
    if (!config || !initialState) {
      return NextResponse.json(
        { error: "Missing config or initialState" },
        { status: 400 }
      );
    }
    if (config.durationDays > 365) {
      return NextResponse.json(
        { error: "durationDays must be <= 365" },
        { status: 400 }
      );
    }
    if (scenarioConfigs && scenarioConfigs.length > 10) {
      return NextResponse.json(
        { error: "scenarioConfigs must have <= 10 entries" },
        { status: 400 }
      );
    }

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
