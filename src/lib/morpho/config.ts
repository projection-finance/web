export const MORPHO_API_URL = "https://api.morpho.org/graphql";

export type MorphoChain = {
  chainId: number;
  networkId: string;
  name: string;
  logo: string;
  color: string;
};

export const MORPHO_CHAINS: MorphoChain[] = [
  {
    chainId: 1,
    networkId: "MORPHO_ETH",
    name: "Ethereum",
    logo: "/icons/networks/ethereum.svg",
    color: "#627EEA",
  },
  {
    chainId: 8453,
    networkId: "MORPHO_BASE",
    name: "Base",
    logo: "/icons/networks/base.svg",
    color: "#0052FF",
  },
];
