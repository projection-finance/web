import { NextRequest, NextResponse } from "next/server";
import { runCompoundSimulation } from "@/src/lib/simulation/compound-engine";
import type {
  CompoundSimulationConfig,
  CompoundEngineState,
  CompoundSimulationResult,
} from "@/src/lib/simulation/compound-types";

interface CompoundSimulateRequestBody {
  config: CompoundSimulationConfig;
  initialState: CompoundEngineState;
  scenarioConfigs?: Array<{
    id: string;
    priceScenarios: CompoundSimulationConfig["priceScenarios"];
    rateScenarios: CompoundSimulationConfig["rateScenarios"];
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: CompoundSimulateRequestBody = await req.json();
    const { config, initialState, scenarioConfigs } = body;

    if (!config || !initialState) {
      return NextResponse.json(
        { error: "Missing config or initialState" },
        { status: 400 },
      );
    }
    if (config.durationDays > 365) {
      return NextResponse.json(
        { error: "durationDays must be <= 365" },
        { status: 400 },
      );
    }
    if (scenarioConfigs && scenarioConfigs.length > 10) {
      return NextResponse.json(
        { error: "scenarioConfigs must have <= 10 entries" },
        { status: 400 },
      );
    }

    // Run main simulation
    const result = runCompoundSimulation(
      config,
      JSON.parse(JSON.stringify(initialState)),
    );

    // Run per-scenario simulations
    let scenarioResults:
      | Array<[string, CompoundSimulationResult]>
      | undefined;

    if (scenarioConfigs && scenarioConfigs.length > 0) {
      scenarioResults = [];
      for (const sc of scenarioConfigs) {
        const scenarioConfig: CompoundSimulationConfig = {
          ...config,
          priceScenarios: sc.priceScenarios,
          rateScenarios: sc.rateScenarios,
        };
        const stateCopy: CompoundEngineState = JSON.parse(
          JSON.stringify(initialState),
        );
        const simResult = runCompoundSimulation(scenarioConfig, stateCopy);
        scenarioResults.push([sc.id, simResult]);
      }
    }

    return NextResponse.json({ result, scenarioResults });
  } catch (err) {
    console.error("[/api/simulate/compound] error:", err);
    return NextResponse.json(
      { error: "Simulation failed" },
      { status: 500 },
    );
  }
}
