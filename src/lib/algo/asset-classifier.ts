import { EmodeCategory } from "@/src/lib/aave/emode";
import { isStablecoin } from "@/src/lib/aave/emode";

export type AssetClass =
  | "stablecoin"
  | "eth-correlated"
  | "btc-correlated"
  | "other";

/**
 * Classify an asset into a class using E-Mode category labels as heuristics.
 *
 * - stablecoin     → E-Mode label contains "stable"
 * - eth-correlated → E-Mode label contains "eth"
 * - btc-correlated → E-Mode label contains "btc"
 * - other          → everything else
 */
export function classifyAsset(
  symbol: string,
  categories: EmodeCategory[]
): AssetClass {
  if (isStablecoin(symbol, categories)) return "stablecoin";

  for (const cat of categories) {
    if (cat.id === 0) continue;
    const hasAsset = cat.assets.some((a) => a.symbol === symbol);
    if (!hasAsset) continue;

    const label = cat.label.toLowerCase();
    if (label.includes("eth")) return "eth-correlated";
    if (label.includes("btc")) return "btc-correlated";
  }

  return "other";
}

/**
 * Check if two assets belong to the same class.
 * Assets classified as "other" are never considered same-class
 * (each is its own class → no swap suggested).
 */
export function isSameClass(
  symbolA: string,
  symbolB: string,
  categories: EmodeCategory[]
): boolean {
  const classA = classifyAsset(symbolA, categories);
  const classB = classifyAsset(symbolB, categories);
  if (classA === "other" || classB === "other") return false;
  return classA === classB;
}
