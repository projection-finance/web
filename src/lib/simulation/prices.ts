import { PriceScenario } from "./types";

/**
 * Seeded pseudo-random number generator (Park-Miller LCG).
 * Deterministic: same seed → same sequence.
 */
function createPRNG(seed: number) {
  // Park-Miller LCG: m = 2^31 - 1, a = 16807
  const m = 2147483647; // 2^31 - 1
  const a = 16807;
  let state = seed % m;
  if (state <= 0) state += m - 1;

  return function next(): number {
    state = (a * state) % m;
    return state / m;
  };
}

/**
 * Box-Muller transform: generate standard normal N(0,1) from uniform samples.
 */
function boxMuller(prng: () => number): number {
  const u1 = prng();
  const u2 = prng();
  return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Generate a price series using Geometric Brownian Motion.
 *
 * S(t) = S0 * exp((mu - sigma^2/2) * t + sigma * sqrt(t) * Z)
 *
 * Where t is in years (1 day = 1/365).
 * mu and sigma are annualized (e.g. mu=0.05 → 5%/year drift, sigma=0.8 → 80%/year vol).
 *
 * @param startPrice - Starting price (S0)
 * @param mu - Annualized drift
 * @param sigma - Annualized volatility
 * @param days - Number of days to generate
 * @param seed - Deterministic seed (0 = random)
 * @returns Array of prices, length = days + 1 (includes day 0 = startPrice)
 */
function generateGBM(
  startPrice: number,
  mu: number,
  sigma: number,
  days: number,
  seed: number
): number[] {
  const actualSeed =
    seed === 0
      ? Math.floor(Math.random() * 100000000) + 10
      : seed;

  const prng = createPRNG(actualSeed);
  const dt = 1 / 365; // 1 day in years
  const prices: number[] = [startPrice];

  let currentPrice = startPrice;
  for (let i = 1; i <= days; i++) {
    const z = boxMuller(prng);
    // Daily GBM step: S(t+dt) = S(t) * exp((mu - sigma^2/2)*dt + sigma*sqrt(dt)*Z)
    const drift = (mu - (sigma * sigma) / 2) * dt;
    const diffusion = sigma * Math.sqrt(dt) * z;
    currentPrice = currentPrice * Math.exp(drift + diffusion);
    prices.push(Math.max(currentPrice, 0));
  }

  return prices;
}

/**
 * Generate a price series for a given scenario.
 * Returns array of length durationDays + 1 (includes day 0).
 */
export function generatePriceSeries(
  scenario: PriceScenario,
  durationDays: number
): number[] {
  const fromDay = scenario.fromDay ?? 0;
  const original = scenario.originalPrice ?? scenario.startPrice;

  let scenarioPrices: number[];

  switch (scenario.mode) {
    case "fixed":
      scenarioPrices = Array(durationDays + 1).fill(scenario.startPrice);
      break;

    case "linear": {
      const endPrice = scenario.endPrice ?? scenario.startPrice;
      scenarioPrices = [];
      for (let i = 0; i <= durationDays; i++) {
        const t = durationDays > 0 ? i / durationDays : 0;
        scenarioPrices.push(scenario.startPrice + (endPrice - scenario.startPrice) * t);
      }
      break;
    }

    case "sinusoidal": {
      const min = scenario.minPrice ?? scenario.startPrice;
      const max = scenario.maxPrice ?? scenario.startPrice;
      const cycle = scenario.cycleDays ?? durationDays;
      const mid = (min + max) / 2;
      const amplitude = (max - min) / 2;
      scenarioPrices = [];
      for (let i = 0; i <= durationDays; i++) {
        scenarioPrices.push(mid + amplitude * Math.sin((2 * Math.PI * i) / cycle));
      }
      break;
    }

    case "gbm":
      scenarioPrices = generateGBM(
        scenario.startPrice,
        scenario.mu ?? 0,
        scenario.sigma ?? 0.5,
        durationDays,
        scenario.seed ?? 0
      );
      break;

    case "manual": {
      const manual = scenario.manualPrices ?? [];
      scenarioPrices = [];
      for (let i = 0; i <= durationDays; i++) {
        scenarioPrices.push(manual[i] ?? manual[manual.length - 1] ?? scenario.startPrice);
      }
      break;
    }

    default:
      scenarioPrices = Array(durationDays + 1).fill(scenario.startPrice);
  }

  // Apply fromDay: use original price for days before fromDay
  if (fromDay > 0) {
    for (let i = 0; i < Math.min(fromDay, scenarioPrices.length); i++) {
      scenarioPrices[i] = original;
    }
  }

  return scenarioPrices;
}

/**
 * Generate all price series for a set of scenarios.
 * Returns a map: symbol → number[] (price per day).
 */
export function generateAllPriceSeries(
  scenarios: PriceScenario[],
  durationDays: number
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const scenario of scenarios) {
    result[scenario.symbol] = generatePriceSeries(scenario, durationDays);
  }
  return result;
}
