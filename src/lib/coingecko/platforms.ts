/** CoinGecko platform IDs indexed by our internal networkId */
export const NETWORK_TO_CG_PLATFORM: Record<string, string> = {
  // Aave networks
  ETHEREUM_V3: "ethereum",
  ARBITRUM_V3: "arbitrum-one",
  BASE_V3: "base",
  OPTIMISM_V3: "optimistic-ethereum",
  POLYGON_V3: "polygon-pos",
  AVALANCHE_V3: "avalanche",
  BNB_V3: "binance-smart-chain",
  SCROLL_V3: "scroll",
  ZKSYNC_V3: "zksync",
  LINEA_V3: "linea",
  GNOSIS_V3: "xdai",
  METIS_V3: "metis-andromeda",
  SONIC_V3: "sonic",
  CELO_V3: "celo",
  MANTLE_V3: "mantle",
  // Spark (Ethereum)
  SPARK_V3: "ethereum",
  // Morpho networks
  MORPHO_ETH: "ethereum",
  MORPHO_BASE: "base",
};
