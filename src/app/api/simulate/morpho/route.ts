import { NextRequest, NextResponse } from "next/server";
import { runMorphoSimulation } from "@/src/lib/simulation/morpho-engine";
import type {
  MorphoSimulationConfig,
  MorphoEngineState,
  MorphoSimulationResult,
} from "@/src/lib/simulation/morpho-types";

interface MorphoSimulateRequestBody {
  config: MorphoSimulationConfig;
  initialState: MorphoEngineState;
  scenarioConfigs?: Array<{
    id: string;
    priceScenarios: MorphoSimulationConfig["priceScenarios"];
    rateScenarios: MorphoSimulationConfig["rateScenarios"];
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: MorphoSimulateRequestBody = await req.json();
    const { config, initialState, scenarioConfigs } = body;

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
    const result = runMorphoSimulation(
      config,
      JSON.parse(JSON.stringify(initialState))
    );

    // Run per-scenario simulations
    let scenarioResults: Array<[string, MorphoSimulationResult]> | undefined;

    if (scenarioConfigs && scenarioConfigs.length > 0) {
      scenarioResults = [];
      for (const sc of scenarioConfigs) {
        const scenarioConfig: MorphoSimulationConfig = {
          ...config,
          priceScenarios: sc.priceScenarios,
          rateScenarios: sc.rateScenarios,
        };
        const stateCopy: MorphoEngineState = JSON.parse(
          JSON.stringify(initialState)
        );
        const simResult = runMorphoSimulation(scenarioConfig, stateCopy);
        scenarioResults.push([sc.id, simResult]);
      }
    }

    return NextResponse.json({ result, scenarioResults });
  } catch (err) {
    console.error("[/api/simulate/morpho] error:", err);
    return NextResponse.json(
      { error: "Simulation failed" },
      { status: 500 }
    );
  }
}
