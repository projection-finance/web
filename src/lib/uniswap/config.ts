export const UNISWAP_CHAINS = [
  { chainId: 1, name: "Ethereum", networkId: "ETHEREUM_V3", logo: "/icons/networks/ethereum.svg", color: "#627EEA" },
  { chainId: 8453, name: "Base", networkId: "BASE_V3", logo: "/icons/networks/base.svg", color: "#0052FF" },
  { chainId: 42161, name: "Arbitrum", networkId: "ARBITRUM_V3", logo: "/icons/networks/arbitrum.svg", color: "#28A0F0" },
  { chainId: 10, name: "Optimism", networkId: "OPTIMISM_V3", logo: "/icons/networks/optimism.svg", color: "#FF0420" },
  { chainId: 137, name: "Polygon", networkId: "POLYGON_V3", logo: "/icons/networks/polygon.svg", color: "#8247E5" },
];

export const POPULAR_POOLS = [
  { label: "ETH/USDC 0.05%", token0: "WETH", token1: "USDC", feeTier: 500, chainId: 1, defaultPrice: 2500, dailyVolume: 200_000_000 },
  { label: "ETH/USDC 0.3%", token0: "WETH", token1: "USDC", feeTier: 3000, chainId: 1, defaultPrice: 2500, dailyVolume: 50_000_000 },
  { label: "ETH/USDT 0.05%", token0: "WETH", token1: "USDT", feeTier: 500, chainId: 1, defaultPrice: 2500, dailyVolume: 100_000_000 },
  { label: "WBTC/ETH 0.3%", token0: "WBTC", token1: "WETH", feeTier: 3000, chainId: 1, defaultPrice: 25, dailyVolume: 30_000_000 },
  { label: "WBTC/USDC 0.3%", token0: "WBTC", token1: "USDC", feeTier: 3000, chainId: 1, defaultPrice: 65000, dailyVolume: 20_000_000 },
  { label: "USDC/USDT 0.01%", token0: "USDC", token1: "USDT", feeTier: 100, chainId: 1, defaultPrice: 1, dailyVolume: 300_000_000 },
  { label: "ETH/USDC 0.05% (Base)", token0: "WETH", token1: "USDC", feeTier: 500, chainId: 8453, defaultPrice: 2500, dailyVolume: 80_000_000 },
  { label: "ETH/USDC 0.05% (Arb)", token0: "WETH", token1: "USDC", feeTier: 500, chainId: 42161, defaultPrice: 2500, dailyVolume: 60_000_000 },
];

export const FEE_TIER_LABELS: Record<number, string> = {
  100: "0.01%",
  500: "0.05%",
  3000: "0.3%",
  10000: "1%",
};

/** Minimum TVL (USD) to include a pool in search results */
export const MIN_POOL_TVL_USD = 10_000;
