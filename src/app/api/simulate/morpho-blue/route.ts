import { NextRequest, NextResponse } from "next/server";
import { runMorphoBlueSimulation } from "@/src/lib/simulation/morpho-blue-engine";
import type {
  MorphoBlueSimulationConfig,
  MorphoBlueEngineState,
  MorphoBlueSimulationResult,
} from "@/src/lib/simulation/morpho-blue-types";

interface RequestBody {
  config: MorphoBlueSimulationConfig;
  initialState: MorphoBlueEngineState;
  scenarioConfigs?: Array<{
    id: string;
    priceScenarios: MorphoBlueSimulationConfig["priceScenarios"];
    rateScenarios: MorphoBlueSimulationConfig["rateScenarios"];
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { config, initialState, scenarioConfigs } = body;

    if (!config || !initialState) {
      return NextResponse.json({ error: "Missing config or initialState" }, { status: 400 });
    }
    if (config.durationDays > 365) {
      return NextResponse.json({ error: "durationDays must be <= 365" }, { status: 400 });
    }

    const result = runMorphoBlueSimulation(config, JSON.parse(JSON.stringify(initialState)));

    let scenarioResults: Array<[string, MorphoBlueSimulationResult]> | undefined;
    if (scenarioConfigs?.length) {
      scenarioResults = [];
      for (const sc of scenarioConfigs) {
        const scConfig: MorphoBlueSimulationConfig = { ...config, priceScenarios: sc.priceScenarios, rateScenarios: sc.rateScenarios };
        const simResult = runMorphoBlueSimulation(scConfig, JSON.parse(JSON.stringify(initialState)));
        scenarioResults.push([sc.id, simResult]);
      }
    }

    return NextResponse.json({ result, scenarioResults });
  } catch (err) {
    console.error("[/api/simulate/morpho-blue] error:", err);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
