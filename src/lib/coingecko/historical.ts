import { PriceScenario } from "@/src/lib/simulation/types";
import { getCoinGeckoClient } from "./client";
import { CoinGeckoHistoricalPrice } from "./types";

/** Map token symbols to CoinGecko coin IDs */
export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  ETH: "ethereum",
  WETH: "ethereum",
  wstETH: "lido-dao",
  stETH: "staked-ether",
  cbETH: "coinbase-wrapped-staked-eth",
  rETH: "rocket-pool-eth",
  WBTC: "bitcoin",
  BTC: "bitcoin",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  LUSD: "liquity-usd",
  FRAX: "frax",
  GHO: "gho",
  LINK: "chainlink",
  AAVE: "aave",
  UNI: "uniswap",
  MKR: "maker",
  SNX: "havven",
  CRV: "curve-dao-token",
  LDO: "lido-dao",
  RPL: "rocket-pool",
  BAL: "balancer",
  ENS: "ethereum-name-service",
  "1INCH": "1inch",
  SUSHI: "sushi",
  COMP: "compound-governance-token",
  YFI: "yearn-finance",
};

/**
 * Fetch historical price data and convert to a PriceScenario with mode="manual".
 * Normalizes prices relative to currentPrice (preserves % moves, not absolute values).
 */
export async function generateHistoricalPriceScenario(
  symbol: string,
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  currentPrice: number
): Promise<PriceScenario> {
  const coinId = SYMBOL_TO_COINGECKO_ID[symbol];
  if (!coinId) {
    throw new Error(
      `Unknown symbol: ${symbol}. Supported: ${Object.keys(SYMBOL_TO_COINGECKO_ID).join(", ")}`
    );
  }

  const from = Math.floor(new Date(startDate).getTime() / 1000);
  const to = Math.floor(new Date(endDate).getTime() / 1000);

  const client = getCoinGeckoClient();
  const chart = await client.getMarketChartRange(coinId, "usd", from, to);

  if (!chart.prices || chart.prices.length === 0) {
    throw new Error(
      `No historical data found for ${symbol} between ${startDate} and ${endDate}`
    );
  }

  // Convert to daily prices
  const dailyPrices = resampleToDaily(chart.prices);

  // Normalize: preserve percentage moves relative to currentPrice
  const firstHistoricalPrice = dailyPrices[0].price;
  const normalizedPrices = dailyPrices.map(
    (dp) => currentPrice * (dp.price / firstHistoricalPrice)
  );

  return {
    symbol,
    mode: "manual",
    startPrice: normalizedPrices[0],
    manualPrices: normalizedPrices,
  };
}

/**
 * Generate historical price scenarios for multiple symbols.
 */
export async function generateHistoricalEventScenarios(
  symbols: string[],
  startDate: string,
  endDate: string,
  currentPrices: Record<string, number>
): Promise<PriceScenario[]> {
  const scenarios: PriceScenario[] = [];

  for (const symbol of symbols) {
    const price = currentPrices[symbol];
    if (!price) continue;

    try {
      const scenario = await generateHistoricalPriceScenario(
        symbol,
        startDate,
        endDate,
        price
      );
      scenarios.push(scenario);
    } catch {
      // Skip symbols that fail (e.g., no CoinGecko mapping)
      console.warn(`[CoinGecko] Failed to fetch historical data for ${symbol}`);
    }
  }

  return scenarios;
}

// --- Helpers ---

/**
 * Resample timestamped prices to one price per day.
 * Takes the first price point of each calendar day.
 */
function resampleToDaily(
  prices: [number, number][]
): CoinGeckoHistoricalPrice[] {
  const dailyMap = new Map<string, CoinGeckoHistoricalPrice>();

  for (const [timestampMs, price] of prices) {
    const date = new Date(timestampMs).toISOString().split("T")[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { timestamp: timestampMs, price });
    }
  }

  return Array.from(dailyMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );
}
