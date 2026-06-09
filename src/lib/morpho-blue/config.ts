export const MORPHO_API_URL = "https://api.morpho.org/graphql";

export interface MorphoBlueChain {
  chainId: number;
  name: string;
  networkId: string;
  logo: string;
  color: string;
}

export const MORPHO_BLUE_CHAINS: MorphoBlueChain[] = [
  {
    chainId: 1,
    name: "Ethereum",
    networkId: "ETHEREUM_V3",
    logo: "/icons/networks/ethereum.svg",
    color: "#627EEA",
  },
  {
    chainId: 8453,
    name: "Base",
    networkId: "BASE_V3",
    logo: "/icons/networks/base.svg",
    color: "#0052FF",
  },
];
