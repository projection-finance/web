import { NextRequest, NextResponse } from "next/server";
import { runUniswapSimulation } from "@/src/lib/simulation/uniswap-engine";
import type {
  UniswapSimulationConfig,
  UniswapEngineState,
  UniswapSimulationResult,
} from "@/src/lib/simulation/uniswap-types";

interface RequestBody {
  config: UniswapSimulationConfig;
  initialState: UniswapEngineState;
  scenarioConfigs?: Array<{
    id: string;
    priceScenarios: UniswapSimulationConfig["priceScenarios"];
    volumeScenarios: UniswapSimulationConfig["volumeScenarios"];
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

    const result = runUniswapSimulation(config, JSON.parse(JSON.stringify(initialState)));

    let scenarioResults: Array<[string, UniswapSimulationResult]> | undefined;
    if (scenarioConfigs?.length) {
      scenarioResults = [];
      for (const sc of scenarioConfigs) {
        const scConfig: UniswapSimulationConfig = { ...config, priceScenarios: sc.priceScenarios, volumeScenarios: sc.volumeScenarios };
        scenarioResults.push([sc.id, runUniswapSimulation(scConfig, JSON.parse(JSON.stringify(initialState)))]);
      }
    }

    return NextResponse.json({ result, scenarioResults });
  } catch (err) {
    console.error("[/api/simulate/uniswap] error:", err);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
