import { ChainId } from "@aave/contract-helpers";

export type NetworkId =
  | "ETHEREUM_V3"
  | "ARBITRUM_V3"
  | "BASE_V3"
  | "OPTIMISM_V3"
  | "POLYGON_V3"
  | "AVALANCHE_V3"
  | "BNB_V3"
  | "SCROLL_V3"
  | "ZKSYNC_V3"
  | "LINEA_V3"
  | "GNOSIS_V3"
  | "METIS_V3"
  | "SONIC_V3"
  | "CELO_V3"
  | "MANTLE_V3"
  | "SONEIUM_V3"
  | "INK_V3"
  | "SPARK_V3";

export type NetworkMeta = {
  id: NetworkId;
  name: string;
  shortName: string;
  chainId: ChainId;
  nativeSymbol: string;
  wrappedNativeAddress: string; // empty if no native base asset (e.g. Metis, Celo)
  explorerUrl: string;
  color: string;
  logo: string;
  alchemySlug: string;
  publicRpc?: string; // fallback when Alchemy doesn't support the chain
  supportsENS: boolean;
};

export const NETWORKS: Record<NetworkId, NetworkMeta> = {
  ETHEREUM_V3: {
    id: "ETHEREUM_V3",
    name: "Ethereum",
    shortName: "ETH",
    chainId: ChainId.mainnet,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    explorerUrl: "https://etherscan.io",
    color: "#627EEA",
    logo: "/icons/networks/ethereum.svg",
    alchemySlug: "eth-mainnet",
    supportsENS: true,
  },
  ARBITRUM_V3: {
    id: "ARBITRUM_V3",
    name: "Arbitrum",
    shortName: "ARB",
    chainId: ChainId.arbitrum_one,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    explorerUrl: "https://arbiscan.io",
    color: "#28A0F0",
    logo: "/icons/networks/arbitrum.svg",
    alchemySlug: "arb-mainnet",
    supportsENS: false,
  },
  BASE_V3: {
    id: "BASE_V3",
    name: "Base",
    shortName: "BASE",
    chainId: ChainId.base,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    explorerUrl: "https://basescan.org",
    color: "#0052FF",
    logo: "/icons/networks/base.svg",
    alchemySlug: "base-mainnet",
    supportsENS: false,
  },
  OPTIMISM_V3: {
    id: "OPTIMISM_V3",
    name: "Optimism",
    shortName: "OP",
    chainId: ChainId.optimism,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    explorerUrl: "https://optimistic.etherscan.io",
    color: "#FF0420",
    logo: "/icons/networks/optimism.svg",
    alchemySlug: "opt-mainnet",
    supportsENS: false,
  },
  POLYGON_V3: {
    id: "POLYGON_V3",
    name: "Polygon",
    shortName: "POL",
    chainId: ChainId.polygon,
    nativeSymbol: "POL",
    wrappedNativeAddress: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    explorerUrl: "https://polygonscan.com",
    color: "#8247E5",
    logo: "/icons/networks/polygon.svg",
    alchemySlug: "polygon-mainnet",
    supportsENS: false,
  },
  AVALANCHE_V3: {
    id: "AVALANCHE_V3",
    name: "Avalanche",
    shortName: "AVAX",
    chainId: ChainId.avalanche,
    nativeSymbol: "AVAX",
    wrappedNativeAddress: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
    explorerUrl: "https://snowscan.xyz",
    color: "#E84142",
    logo: "/icons/networks/avalanche.svg",
    alchemySlug: "avax-mainnet",
    supportsENS: false,
  },
  BNB_V3: {
    id: "BNB_V3",
    name: "BNB Chain",
    shortName: "BNB",
    chainId: ChainId.bnb,
    nativeSymbol: "BNB",
    wrappedNativeAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    explorerUrl: "https://bscscan.com",
    color: "#F0B90B",
    logo: "/icons/networks/bnb.svg",
    alchemySlug: "bnb-mainnet",
    supportsENS: false,
  },
  SCROLL_V3: {
    id: "SCROLL_V3",
    name: "Scroll",
    shortName: "SCROLL",
    chainId: ChainId.scroll,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0x5300000000000000000000000000000000000004",
    explorerUrl: "https://scrollscan.com",
    color: "#FFEEDA",
    logo: "/icons/networks/scroll.svg",
    alchemySlug: "scroll-mainnet",
    supportsENS: false,
  },
  ZKSYNC_V3: {
    id: "ZKSYNC_V3",
    name: "ZKsync",
    shortName: "ZK",
    chainId: ChainId.zksync,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0x5aea5775959fbc2557cc8789bc1bf90a239d9a91",
    explorerUrl: "https://explorer.zksync.io",
    color: "#8C8DFC",
    logo: "/icons/networks/zksync.svg",
    alchemySlug: "zksync-mainnet",
    supportsENS: false,
  },
  LINEA_V3: {
    id: "LINEA_V3",
    name: "Linea",
    shortName: "LINEA",
    chainId: ChainId.linea,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
    explorerUrl: "https://lineascan.build",
    color: "#61DFFF",
    logo: "/icons/networks/linea.svg",
    alchemySlug: "linea-mainnet",
    supportsENS: false,
  },
  GNOSIS_V3: {
    id: "GNOSIS_V3",
    name: "Gnosis",
    shortName: "GNO",
    chainId: ChainId.xdai,
    nativeSymbol: "xDAI",
    wrappedNativeAddress: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d",
    explorerUrl: "https://gnosisscan.io",
    color: "#04795B",
    logo: "/icons/networks/gnosis.svg",
    alchemySlug: "gnosis-mainnet",
    supportsENS: false,
  },
  METIS_V3: {
    id: "METIS_V3",
    name: "Metis",
    shortName: "METIS",
    chainId: ChainId.metis_andromeda,
    nativeSymbol: "",
    wrappedNativeAddress: "",
    explorerUrl: "https://explorer.metis.io",
    color: "#00DACC",
    logo: "/icons/networks/metis.svg",
    alchemySlug: "metis-mainnet",
    supportsENS: false,
  },
  SONIC_V3: {
    id: "SONIC_V3",
    name: "Sonic",
    shortName: "S",
    chainId: ChainId.sonic,
    nativeSymbol: "S",
    wrappedNativeAddress: "0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38",
    explorerUrl: "https://sonicscan.org",
    color: "#141414",
    logo: "/icons/networks/sonic.svg",
    alchemySlug: "sonic-mainnet",
    supportsENS: false,
  },
  CELO_V3: {
    id: "CELO_V3",
    name: "Celo",
    shortName: "CELO",
    chainId: ChainId.celo,
    nativeSymbol: "",
    wrappedNativeAddress: "",
    explorerUrl: "https://celoscan.io",
    color: "#FCFF52",
    logo: "/icons/networks/celo.svg",
    alchemySlug: "celo-mainnet",
    supportsENS: false,
  },
  MANTLE_V3: {
    id: "MANTLE_V3",
    name: "Mantle",
    shortName: "MNT",
    chainId: ChainId.mantle,
    nativeSymbol: "MNT",
    wrappedNativeAddress: "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8",
    explorerUrl: "https://mantlescan.xyz",
    color: "#000000",
    logo: "/icons/networks/mantle.svg",
    alchemySlug: "mantle-mainnet",
    publicRpc: "https://rpc.mantle.xyz",
    supportsENS: false,
  },
  SONEIUM_V3: {
    id: "SONEIUM_V3",
    name: "Soneium",
    shortName: "SON",
    chainId: ChainId.soneium,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    explorerUrl: "https://soneium.blockscout.com",
    color: "#0A0A0A",
    logo: "/icons/networks/soneium.svg",
    alchemySlug: "soneium-mainnet",
    supportsENS: false,
  },
  INK_V3: {
    id: "INK_V3",
    name: "Ink",
    shortName: "INK",
    chainId: ChainId.ink,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    explorerUrl: "https://explorer.inkonchain.com",
    color: "#7C5CFF",
    logo: "/icons/networks/ink.svg",
    alchemySlug: "ink-mainnet",
    publicRpc: "https://rpc-gel.inkonchain.com",
    supportsENS: false,
  },
  SPARK_V3: {
    id: "SPARK_V3",
    name: "Spark",
    shortName: "SPARK",
    chainId: ChainId.mainnet,
    nativeSymbol: "ETH",
    wrappedNativeAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    explorerUrl: "https://etherscan.io",
    color: "#F58220",
    logo: "/icons/networks/spark.svg",
    alchemySlug: "eth-mainnet",
    supportsENS: true,
  },
};

export const NETWORK_LIST: NetworkMeta[] = Object.values(NETWORKS);

export const DEFAULT_NETWORK: NetworkId = "ETHEREUM_V3";

export function getNetworkById(id: string): NetworkMeta | undefined {
  return NETWORKS[id as NetworkId];
}

export function getNetworkByChainId(chainId: number): NetworkMeta | undefined {
  return NETWORK_LIST.find((n) => n.chainId === chainId);
}

/** Convert a URL slug like "ethereum" to a NetworkId like "ETHEREUM_V3" */
export function networkSlugToId(slug: string): NetworkId | undefined {
  const normalized = slug.toLowerCase().replace(/-/g, " ");
  const entry = NETWORK_LIST.find(
    (n) => n.name.toLowerCase() === normalized || n.shortName.toLowerCase() === normalized
  );
  return entry?.id;
}

/** Convert a NetworkId like "ETHEREUM_V3" to a URL slug like "ethereum" */
export function networkIdToSlug(id: NetworkId): string {
  const net = NETWORKS[id];
  return net.name.toLowerCase().replace(/\s+/g, "-");
}
