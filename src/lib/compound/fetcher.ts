/**
 * Compound V3 (Comet) data fetcher.
 *
 * Reads supply APY, borrow APY, TVL, and base token address
 * directly from Comet proxy contracts via RPC.
 */

import { ethers } from "ethers";
import type { YieldRow } from "@/src/app/api/yields/route";
import type { CompoundChain, CompoundMarket } from "./config";
import { isStablecoin } from "@/src/lib/aave/emode";
import { createMonitoredProvider } from "@/src/lib/rpc-monitor";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const SECONDS_PER_YEAR = 31_536_000;
const TIMEOUT_MS = 15_000;

// Minimal Comet ABI — only the view functions we need for yields
const COMET_ABI = [
  "function baseToken() view returns (address)",
  "function baseTokenPriceFeed() view returns (address)",
  "function getPrice(address priceFeed) view returns (uint256)",
  "function getUtilization() view returns (uint256)",
  "function getSupplyRate(uint256 utilization) view returns (uint64)",
  "function getBorrowRate(uint256 utilization) view returns (uint64)",
  "function totalSupply() view returns (uint256)",
  "function totalBorrow() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

function compoundMarketUrl(chainId: number, cometProxy: string): string {
  const slugs: Record<number, string> = {
    1: "ethereum",
    8453: "base-mainnet",
    42161: "arbitrum",
    10: "optimism",
    137: "polygon",
  };
  const chain = slugs[chainId] ?? "ethereum";
  return `https://app.compound.finance/markets/${cometProxy}?network=${chain}`;
}

interface CometYieldData {
  baseTokenAddress: string;
  supplyAPY: number;
  borrowAPY: number;
  totalSupplyUSD: number;
}

async function fetchCometYield(
  provider: ethers.providers.StaticJsonRpcProvider,
  market: CompoundMarket,
): Promise<CometYieldData | null> {
  try {
    const comet = new ethers.Contract(market.cometProxy, COMET_ABI, provider);

    // Batch all calls
    const [baseToken, priceFeed, utilization, totalSupplyRaw] =
      await Promise.all([
        comet.baseToken(),
        comet.baseTokenPriceFeed(),
        comet.getUtilization(),
        comet.totalSupply(),
      ]);

    const [supplyRatePerSec, borrowRatePerSec, priceRaw] = await Promise.all([
      comet.getSupplyRate(utilization),
      comet.getBorrowRate(utilization),
      comet.getPrice(priceFeed),
    ]);

    // Convert per-second rates to APY
    // rate is 1e18 scaled
    const supplyRateNum = Number(supplyRatePerSec) / 1e18;
    const borrowRateNum = Number(borrowRatePerSec) / 1e18;

    const supplyAPY = Math.pow(1 + supplyRateNum, SECONDS_PER_YEAR) - 1;
    const borrowAPY = Math.pow(1 + borrowRateNum, SECONDS_PER_YEAR) - 1;

    // Price is 8-decimal Chainlink format
    const priceUSD = Number(priceRaw) / 1e8;

    // Total supply in base token units
    const totalSupplyHuman = Number(
      ethers.utils.formatUnits(totalSupplyRaw, market.baseDecimals),
    );
    const totalSupplyUSD = totalSupplyHuman * priceUSD;

    return {
      baseTokenAddress: (baseToken as string).toLowerCase(),
      supplyAPY,
      borrowAPY,
      totalSupplyUSD,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch yield data for all Compound V3 markets on a given chain.
 */
export async function fetchCompoundYields(
  chain: CompoundChain,
): Promise<YieldRow[]> {
  const rpcUrl = `https://${chain.alchemySlug}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = createMonitoredProvider(rpcUrl, `COMPOUND_${chain.name}`);

  // Set a timeout for the entire chain fetch
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const results = await Promise.allSettled(
      chain.markets.map((market) => fetchCometYield(provider, market)),
    );

    const rows: YieldRow[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status !== "fulfilled" || !result.value) continue;

      const market = chain.markets[i];
      const data = result.value;

      rows.push({
        symbol: market.baseSymbol,
        networkId: chain.networkId,
        networkName: chain.name,
        networkLogo: chain.logo,
        networkColor: chain.color,
        supplyAPY: data.supplyAPY,
        variableBorrowAPY: data.borrowAPY,
        merklSupplyAPR: 0,
        merklBorrowAPR: 0,
        merklRewardTokens: [],
        totalSupplyAPY: data.supplyAPY,
        availableLiquidityUSD: data.totalSupplyUSD,
        isStablecoin: isStablecoin(market.baseSymbol, []),
        protocol: "compound",
        protocolLabel: market.label,
        protocolUrl: compoundMarketUrl(chain.chainId, market.cometProxy),
        underlyingAsset: data.baseTokenAddress,
      });
    }

    return rows;
  } finally {
    clearTimeout(timer);
  }
}
