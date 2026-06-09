import { ChainId } from "@aave/contract-helpers";
import * as pools from "@bgd-labs/aave-address-book";
import { AaveMarketConfig } from "./types";
import { NetworkId, NETWORKS } from "./networks";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

function alchemyRpc(slug: string): string {
  return `https://${slug}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
}

/** Use Alchemy RPC, or fall back to a public RPC if the chain isn't available on Alchemy */
function rpcFor(networkId: NetworkId): string {
  const net = NETWORKS[networkId];
  return net.publicRpc || alchemyRpc(net.alchemySlug);
}

export const ETHEREUM_V3_MARKET: AaveMarketConfig = {
  id: "ETHEREUM_V3",
  title: "Ethereum v3",
  chainId: ChainId.mainnet,
  rpcUrl: alchemyRpc(NETWORKS.ETHEREUM_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Ethereum.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Ethereum.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const ARBITRUM_V3_MARKET: AaveMarketConfig = {
  id: "ARBITRUM_V3",
  title: "Arbitrum v3",
  chainId: ChainId.arbitrum_one,
  rpcUrl: alchemyRpc(NETWORKS.ARBITRUM_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Arbitrum.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Arbitrum.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Arbitrum.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const BASE_V3_MARKET: AaveMarketConfig = {
  id: "BASE_V3",
  title: "Base v3",
  chainId: ChainId.base,
  rpcUrl: alchemyRpc(NETWORKS.BASE_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Base.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Base.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Base.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const OPTIMISM_V3_MARKET: AaveMarketConfig = {
  id: "OPTIMISM_V3",
  title: "Optimism v3",
  chainId: ChainId.optimism,
  rpcUrl: alchemyRpc(NETWORKS.OPTIMISM_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Optimism.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Optimism.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Optimism.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const POLYGON_V3_MARKET: AaveMarketConfig = {
  id: "POLYGON_V3",
  title: "Polygon v3",
  chainId: ChainId.polygon,
  rpcUrl: alchemyRpc(NETWORKS.POLYGON_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Polygon.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Polygon.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Polygon.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const AVALANCHE_V3_MARKET: AaveMarketConfig = {
  id: "AVALANCHE_V3",
  title: "Avalanche v3",
  chainId: ChainId.avalanche,
  rpcUrl: alchemyRpc(NETWORKS.AVALANCHE_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Avalanche.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Avalanche.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Avalanche.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const BNB_V3_MARKET: AaveMarketConfig = {
  id: "BNB_V3",
  title: "BNB Chain v3",
  chainId: ChainId.bnb,
  rpcUrl: alchemyRpc(NETWORKS.BNB_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3BNB.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3BNB.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3BNB.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const SCROLL_V3_MARKET: AaveMarketConfig = {
  id: "SCROLL_V3",
  title: "Scroll v3",
  chainId: ChainId.scroll,
  rpcUrl: alchemyRpc(NETWORKS.SCROLL_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Scroll.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Scroll.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Scroll.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const ZKSYNC_V3_MARKET: AaveMarketConfig = {
  id: "ZKSYNC_V3",
  title: "ZKsync v3",
  chainId: ChainId.zksync,
  rpcUrl: alchemyRpc(NETWORKS.ZKSYNC_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3ZkSync.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3ZkSync.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3ZkSync.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const LINEA_V3_MARKET: AaveMarketConfig = {
  id: "LINEA_V3",
  title: "Linea v3",
  chainId: ChainId.linea,
  rpcUrl: alchemyRpc(NETWORKS.LINEA_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Linea.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Linea.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Linea.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const GNOSIS_V3_MARKET: AaveMarketConfig = {
  id: "GNOSIS_V3",
  title: "Gnosis v3",
  chainId: ChainId.xdai,
  rpcUrl: alchemyRpc(NETWORKS.GNOSIS_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Gnosis.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Gnosis.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Gnosis.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const METIS_V3_MARKET: AaveMarketConfig = {
  id: "METIS_V3",
  title: "Metis v3",
  chainId: ChainId.metis_andromeda,
  rpcUrl: alchemyRpc(NETWORKS.METIS_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Metis.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Metis.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Metis.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const SONIC_V3_MARKET: AaveMarketConfig = {
  id: "SONIC_V3",
  title: "Sonic v3",
  chainId: ChainId.sonic,
  rpcUrl: alchemyRpc(NETWORKS.SONIC_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Sonic.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Sonic.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Sonic.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const CELO_V3_MARKET: AaveMarketConfig = {
  id: "CELO_V3",
  title: "Celo v3",
  chainId: ChainId.celo,
  rpcUrl: alchemyRpc(NETWORKS.CELO_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Celo.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Celo.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Celo.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const MANTLE_V3_MARKET: AaveMarketConfig = {
  id: "MANTLE_V3",
  title: "Mantle v3",
  chainId: ChainId.mantle,
  rpcUrl: rpcFor("MANTLE_V3"),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Mantle.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Mantle.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Mantle.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const SONEIUM_V3_MARKET: AaveMarketConfig = {
  id: "SONEIUM_V3",
  title: "Soneium v3",
  chainId: ChainId.soneium,
  rpcUrl: alchemyRpc(NETWORKS.SONEIUM_V3.alchemySlug),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3Soneium.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3Soneium.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3Soneium.UI_INCENTIVE_DATA_PROVIDER,
  },
};

export const INK_V3_MARKET: AaveMarketConfig = {
  id: "INK_V3",
  title: "Ink v3",
  chainId: ChainId.ink,
  rpcUrl: rpcFor("INK_V3"),
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: pools.AaveV3InkWhitelabel.POOL_ADDRESSES_PROVIDER,
    UI_POOL_DATA_PROVIDER: pools.AaveV3InkWhitelabel.UI_POOL_DATA_PROVIDER,
    UI_INCENTIVE_DATA_PROVIDER: pools.AaveV3InkWhitelabel.UI_INCENTIVE_DATA_PROVIDER,
  },
};

// ── Spark Protocol (Aave V3 fork) ──

export const SPARK_V3_MARKET: AaveMarketConfig = {
  id: "SPARK_V3",
  title: "Spark v3",
  chainId: ChainId.mainnet,
  rpcUrl: alchemyRpc(NETWORKS.SPARK_V3.alchemySlug),
  protocol: "spark",
  disabled: true, // Spark contracts are timing out — disabled until contract addresses are verified/updated
  addresses: {
    LENDING_POOL_ADDRESS_PROVIDER: "0x02C3eA4e34C0cBd694D2adFa2c690EECbC1793eE",
    UI_POOL_DATA_PROVIDER: "0xF028c2F4b19898718fD0F77b9b881CbfdAa5e8Bb",
    UI_INCENTIVE_DATA_PROVIDER: "0xA7F8A757C4f7696c015B595F51B2901AC0121B18",
  },
};

export const markets: AaveMarketConfig[] = [
  ETHEREUM_V3_MARKET,
  ARBITRUM_V3_MARKET,
  BASE_V3_MARKET,
  OPTIMISM_V3_MARKET,
  POLYGON_V3_MARKET,
  AVALANCHE_V3_MARKET,
  BNB_V3_MARKET,
  SCROLL_V3_MARKET,
  ZKSYNC_V3_MARKET,
  LINEA_V3_MARKET,
  GNOSIS_V3_MARKET,
  METIS_V3_MARKET,
  SONIC_V3_MARKET,
  CELO_V3_MARKET,
  MANTLE_V3_MARKET,
  SONEIUM_V3_MARKET,
  INK_V3_MARKET,
  SPARK_V3_MARKET,
];

export function getMarketById(marketId: string): AaveMarketConfig | undefined {
  return markets.find((m) => m.id === marketId);
}

export function getMarketByNetworkId(networkId: NetworkId): AaveMarketConfig | undefined {
  return markets.find((m) => m.id === networkId);
}
