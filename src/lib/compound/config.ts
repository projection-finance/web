/**
 * Compound V3 (Comet) market configuration.
 *
 * Each "market" is a standalone Comet proxy contract for one borrowable
 * base asset (e.g., USDC, WETH) with multiple collateral assets.
 *
 * Addresses sourced from:
 * https://github.com/compound-finance/comet/tree/main/deployments
 */

export interface CompoundMarket {
  /** Unique ID for our system (e.g., "COMPOUND_ETH_USDC") */
  id: string;
  /** Human-readable label */
  label: string;
  /** Chain ID */
  chainId: number;
  /** Our internal network ID (for RPC routing) */
  networkId: string;
  /** Comet proxy contract address */
  cometProxy: string;
  /** CometRewards contract address */
  rewardsContract: string;
  /** Base asset symbol (the borrowable/lendable asset) */
  baseSymbol: string;
  /** Base asset decimals */
  baseDecimals: number;
}

export interface CompoundChain {
  chainId: number;
  name: string;
  networkId: string;
  logo: string;
  color: string;
  alchemySlug: string;
  markets: CompoundMarket[];
}

// ── Ethereum Mainnet ──

const ETH_REWARDS = "0x1B0e765F6224C21223AeA2af16c1C46E38885a40";

const ETHEREUM_MARKETS: CompoundMarket[] = [
  {
    id: "COMPOUND_ETH_USDC",
    label: "Compound USDC",
    chainId: 1,
    networkId: "ETHEREUM_V3",
    cometProxy: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
    rewardsContract: ETH_REWARDS,
    baseSymbol: "USDC",
    baseDecimals: 6,
  },
  {
    id: "COMPOUND_ETH_USDT",
    label: "Compound USDT",
    chainId: 1,
    networkId: "ETHEREUM_V3",
    cometProxy: "0x3Afdc9BCA9213A35503b077a6072F3D0d5AB0840",
    rewardsContract: ETH_REWARDS,
    baseSymbol: "USDT",
    baseDecimals: 6,
  },
  {
    id: "COMPOUND_ETH_WETH",
    label: "Compound WETH",
    chainId: 1,
    networkId: "ETHEREUM_V3",
    cometProxy: "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
    rewardsContract: ETH_REWARDS,
    baseSymbol: "WETH",
    baseDecimals: 18,
  },
  {
    id: "COMPOUND_ETH_WBTC",
    label: "Compound WBTC",
    chainId: 1,
    networkId: "ETHEREUM_V3",
    cometProxy: "0xe85Dc543813B8c2CFEaAc371517b925a166a9293",
    rewardsContract: ETH_REWARDS,
    baseSymbol: "WBTC",
    baseDecimals: 8,
  },
  {
    id: "COMPOUND_ETH_wstETH",
    label: "Compound wstETH",
    chainId: 1,
    networkId: "ETHEREUM_V3",
    cometProxy: "0x3D0bb1ccaB520A66e607822fC55BC921738fAFE3",
    rewardsContract: ETH_REWARDS,
    baseSymbol: "wstETH",
    baseDecimals: 18,
  },
];

// ── Base ──

const BASE_REWARDS = "0x123964802e6ABabBE1Bc9547D72Ef1B69B00A6b1";

const BASE_MARKETS: CompoundMarket[] = [
  {
    id: "COMPOUND_BASE_USDC",
    label: "Compound USDC",
    chainId: 8453,
    networkId: "BASE_V3",
    cometProxy: "0xb125E6687d4313864e53df431d5425969c15Eb2F",
    rewardsContract: BASE_REWARDS,
    baseSymbol: "USDC",
    baseDecimals: 6,
  },
  {
    id: "COMPOUND_BASE_WETH",
    label: "Compound WETH",
    chainId: 8453,
    networkId: "BASE_V3",
    cometProxy: "0x46e6b214b524310239732D51387075E0e70970bf",
    rewardsContract: BASE_REWARDS,
    baseSymbol: "WETH",
    baseDecimals: 18,
  },
  {
    id: "COMPOUND_BASE_AERO",
    label: "Compound AERO",
    chainId: 8453,
    networkId: "BASE_V3",
    cometProxy: "0x784efeB622244d2348d4F2522f8860B96fbEcE89",
    rewardsContract: BASE_REWARDS,
    baseSymbol: "AERO",
    baseDecimals: 18,
  },
];

// ── Arbitrum ──

const ARB_REWARDS = "0x88730d254A2f7e6AC8388c3198aFd694bA9f7fae";

const ARBITRUM_MARKETS: CompoundMarket[] = [
  {
    id: "COMPOUND_ARB_USDC",
    label: "Compound USDC",
    chainId: 42161,
    networkId: "ARBITRUM_V3",
    cometProxy: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
    rewardsContract: ARB_REWARDS,
    baseSymbol: "USDC",
    baseDecimals: 6,
  },
  {
    id: "COMPOUND_ARB_USDT",
    label: "Compound USDT",
    chainId: 42161,
    networkId: "ARBITRUM_V3",
    cometProxy: "0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07",
    rewardsContract: ARB_REWARDS,
    baseSymbol: "USDT",
    baseDecimals: 6,
  },
  {
    id: "COMPOUND_ARB_WETH",
    label: "Compound WETH",
    chainId: 42161,
    networkId: "ARBITRUM_V3",
    cometProxy: "0x6f7D514bbD4aFf3BcD1140B7344b32f063dEe486",
    rewardsContract: ARB_REWARDS,
    baseSymbol: "WETH",
    baseDecimals: 18,
  },
];

// ── Optimism ──

const OP_REWARDS = "0x443EA0340cb75a160F31A440722dec7b5bc3C2E9";

const OPTIMISM_MARKETS: CompoundMarket[] = [
  {
    id: "COMPOUND_OP_USDC",
    label: "Compound USDC",
    chainId: 10,
    networkId: "OPTIMISM_V3",
    cometProxy: "0x2e44e174f7D53F0212823acC11C01A11d58c5bCB",
    rewardsContract: OP_REWARDS,
    baseSymbol: "USDC",
    baseDecimals: 6,
  },
  {
    id: "COMPOUND_OP_USDT",
    label: "Compound USDT",
    chainId: 10,
    networkId: "OPTIMISM_V3",
    cometProxy: "0x995E394b8B2437aC8Ce61Ee0bC610D617962B214",
    rewardsContract: OP_REWARDS,
    baseSymbol: "USDT",
    baseDecimals: 6,
  },
  {
    id: "COMPOUND_OP_WETH",
    label: "Compound WETH",
    chainId: 10,
    networkId: "OPTIMISM_V3",
    cometProxy: "0xE36A30D249f7761327fd973001A32010b521b6Fd",
    rewardsContract: OP_REWARDS,
    baseSymbol: "WETH",
    baseDecimals: 18,
  },
];

// ── Polygon ──

const POLY_REWARDS = "0x45939657d1CA34A8FA39A924B71D28Fe8431e581";

const POLYGON_MARKETS: CompoundMarket[] = [
  {
    id: "COMPOUND_POLY_USDC",
    label: "Compound USDC",
    chainId: 137,
    networkId: "POLYGON_V3",
    cometProxy: "0xF25212E676D1F7F89Cd72fFEe66158f541246445",
    rewardsContract: POLY_REWARDS,
    baseSymbol: "USDC",
    baseDecimals: 6,
  },
  {
    id: "COMPOUND_POLY_USDT",
    label: "Compound USDT",
    chainId: 137,
    networkId: "POLYGON_V3",
    cometProxy: "0xaeB318360f27748Acb200CE616E389A6C9409a07",
    rewardsContract: POLY_REWARDS,
    baseSymbol: "USDT",
    baseDecimals: 6,
  },
];

// ── All chains ──

export const COMPOUND_CHAINS: CompoundChain[] = [
  {
    chainId: 1,
    name: "Ethereum",
    networkId: "ETHEREUM_V3",
    logo: "/icons/networks/ethereum.svg",
    color: "#627EEA",
    alchemySlug: "eth-mainnet",
    markets: ETHEREUM_MARKETS,
  },
  {
    chainId: 8453,
    name: "Base",
    networkId: "BASE_V3",
    logo: "/icons/networks/base.svg",
    color: "#0052FF",
    alchemySlug: "base-mainnet",
    markets: BASE_MARKETS,
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    networkId: "ARBITRUM_V3",
    logo: "/icons/networks/arbitrum.svg",
    color: "#28A0F0",
    alchemySlug: "arb-mainnet",
    markets: ARBITRUM_MARKETS,
  },
  {
    chainId: 10,
    name: "Optimism",
    networkId: "OPTIMISM_V3",
    logo: "/icons/networks/optimism.svg",
    color: "#FF0420",
    alchemySlug: "opt-mainnet",
    markets: OPTIMISM_MARKETS,
  },
  {
    chainId: 137,
    name: "Polygon",
    networkId: "POLYGON_V3",
    logo: "/icons/networks/polygon.svg",
    color: "#8247E5",
    alchemySlug: "polygon-mainnet",
    markets: POLYGON_MARKETS,
  },
];

/** All Compound markets flattened */
export const ALL_COMPOUND_MARKETS: CompoundMarket[] =
  COMPOUND_CHAINS.flatMap((c) => c.markets);
