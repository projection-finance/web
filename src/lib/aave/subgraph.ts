/**
 * Aave V3 on-chain data fetcher for the Liquidation Radar feature.
 * Uses Alchemy Transfers API to discover borrowers, then
 * @aave/contract-helpers + @aave/math-utils for position calculation
 * (same approach as the existing fetcher.ts).
 */

import { ethers } from "ethers";
import { UiPoolDataProvider } from "@aave/contract-helpers";
import {
  formatReservesAndIncentives,
  formatUserSummaryAndIncentives,
} from "@aave/math-utils";
import dayjs from "dayjs";
import { ETHEREUM_V3_MARKET } from "./config";
import * as pools from "@bgd-labs/aave-address-book";

// ── Constants ──

const POOL_ADDRESS = pools.AaveV3Ethereum.POOL;

const POOL_ABI = [
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
];

// ── Types ──

export interface ProcessedPosition {
  walletAddress: string;
  healthFactor: number;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  mainCollateralSymbol: string;
  mainCollateralAmount: number;
  mainCollateralPriceUSD: number;
  liquidationPriceUSD: number | null;
  liquidationThreshold: number;
  positionJson: {
    collaterals: { symbol: string; amountUSD: number; amount: number; liqThreshold: number }[];
    debts: { symbol: string; amountUSD: number; amount: number }[];
  };
}

export interface ProcessedLiquidation {
  txHash: string;
  logIndex: number;
  walletAddress: string;
  liquidatorAddress: string;
  collateralAssetSymbol: string;
  collateralSeizedAmount: number;
  collateralSeizedUSD: number;
  debtAssetSymbol: string;
  debtRepaidAmount: number;
  debtRepaidUSD: number;
  timestamp: Date;
}

// ── Provider ──

function getProvider(): ethers.providers.StaticJsonRpcProvider {
  return new ethers.providers.StaticJsonRpcProvider(ETHEREUM_V3_MARKET.rpcUrl);
}

// ── Formatted reserves cache (shared across position calculations) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let formattedReservesCache: { reserves: any[]; baseCurrencyData: any; timestamp: number } | null = null;
const RESERVES_CACHE_TTL = 5 * 60 * 1000;

async function getFormattedReserves() {
  if (formattedReservesCache && Date.now() - formattedReservesCache.timestamp < RESERVES_CACHE_TTL) {
    return formattedReservesCache;
  }

  const provider = getProvider();
  const uiPoolDataProvider = new UiPoolDataProvider({
    uiPoolDataProviderAddress: ETHEREUM_V3_MARKET.addresses.UI_POOL_DATA_PROVIDER,
    provider,
    chainId: ETHEREUM_V3_MARKET.chainId,
  });

  const reserves = await uiPoolDataProvider.getReservesHumanized({
    lendingPoolAddressProvider: ETHEREUM_V3_MARKET.addresses.LENDING_POOL_ADDRESS_PROVIDER,
  });

  const currentTimestamp = dayjs().unix();
  const formattedReserves = formatReservesAndIncentives({
    reserves: reserves.reservesData,
    currentTimestamp,
    marketReferenceCurrencyDecimals: reserves.baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd: reserves.baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    reserveIncentives: [],
  });

  formattedReservesCache = {
    reserves: formattedReserves,
    baseCurrencyData: reserves.baseCurrencyData,
    timestamp: Date.now(),
  };

  return formattedReservesCache;
}

// ── Step 1: Discover top borrowers via Chaos Labs ──

async function discoverBorrowers(limit = 300): Promise<string[]> {
  console.log(`[radar] Discovering top ${limit} borrowers via Chaos Labs`);

  const res = await fetch(CHAOS_LABS_ENDPOINT, {
    method: "POST",
    headers: CHAOS_LABS_HEADERS,
    body: JSON.stringify({
      query: `{ topWallets(input: { limit: ${limit}, sort: BORROW, chain: Ethereum }) { address } }`,
    }),
  });

  const json = await res.json();
  const wallets = json?.data?.topWallets;
  if (!wallets || !Array.isArray(wallets)) {
    console.error("[radar] Chaos Labs topWallets failed:", json?.errors);
    return [];
  }

  const addresses = wallets
    .map((w: { address: string }) => w.address.toLowerCase())
    .filter((a: string) => a !== "0x0000000000000000000000000000000000000000" && a !== "0x000000000000000000000000000000000000dead");

  console.log(`[radar] Chaos Labs returned ${addresses.length} top borrowers`);
  return addresses;
}

// ── Step 2: Batch screen borrowers by debt size ──

interface AccountSummary {
  address: string;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  healthFactor: number;
  liquidationThreshold: number;
}

async function screenBorrowers(addresses: string[]): Promise<AccountSummary[]> {
  // Use raw JSON-RPC batch calls for speed
  const alchemyUrl = ETHEREUM_V3_MARKET.rpcUrl;
  const pool = new ethers.utils.Interface(POOL_ABI);
  const results: AccountSummary[] = [];
  const batchSize = 100;

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);

    // Build batch JSON-RPC request
    const rpcBatch = batch.map((addr, idx) => ({
      jsonrpc: "2.0",
      id: i + idx,
      method: "eth_call",
      params: [
        {
          to: POOL_ADDRESS,
          data: pool.encodeFunctionData("getUserAccountData", [addr]),
        },
        "latest",
      ],
    }));

    try {
      const res = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcBatch),
      });

      const responses = await res.json();
      if (!Array.isArray(responses)) continue;

      // Map responses by ID for correct address matching
      const respMap = new Map<number, { result?: string; error?: unknown }>();
      for (const r of responses) respMap.set(r.id, r);

      for (let j = 0; j < batch.length; j++) {
        const resp = respMap.get(i + j);
        if (!resp || resp.error || !resp.result || resp.result === "0x") continue;

        try {
          const decoded = pool.decodeFunctionResult("getUserAccountData", resp.result);
          const totalDebtUSD = Number(decoded.totalDebtBase) / 1e8;
          if (totalDebtUSD > 0) {
            const hf = Number(decoded.healthFactor) / 1e18;
            results.push({
              address: batch[j],
              totalCollateralUSD: Number(decoded.totalCollateralBase) / 1e8,
              totalDebtUSD,
              healthFactor: isFinite(hf) && hf < 1e10 ? hf : 999,
              liquidationThreshold: Number(decoded.currentLiquidationThreshold) / 10000,
            });
          }
        } catch {
          // skip decode errors
        }
      }
    } catch (err) {
      console.error(`[radar] Batch screen failed at offset ${i}:`, err);
    }
  }

  return results;
}

// ── Step 3: Detailed position using @aave/math-utils ──

async function getDetailedPosition(
  address: string,
  summary: AccountSummary
): Promise<ProcessedPosition | null> {
  const provider = getProvider();
  const uiPoolDataProvider = new UiPoolDataProvider({
    uiPoolDataProviderAddress: ETHEREUM_V3_MARKET.addresses.UI_POOL_DATA_PROVIDER,
    provider,
    chainId: ETHEREUM_V3_MARKET.chainId,
  });

  const { reserves, baseCurrencyData } = await getFormattedReserves();

  const userReserves = await uiPoolDataProvider.getUserReservesHumanized({
    lendingPoolAddressProvider: ETHEREUM_V3_MARKET.addresses.LENDING_POOL_ADDRESS_PROVIDER,
    user: address,
  });

  const currentTimestamp = dayjs().unix();
  const userSummary = formatUserSummaryAndIncentives({
    currentTimestamp,
    marketReferenceCurrencyDecimals: baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    userReserves: userReserves.userReserves,
    formattedReserves: reserves,
    userEmodeCategoryId: userReserves.userEmodeCategoryId,
    reserveIncentives: [],
    userIncentives: [],
  });

  const collaterals: ProcessedPosition["positionJson"]["collaterals"] = [];
  const debts: ProcessedPosition["positionJson"]["debts"] = [];

  for (const ur of userSummary.userReservesData) {
    const supplyBalance = Number(ur.underlyingBalance);
    const supplyBalanceUSD = Number(ur.underlyingBalanceUSD);
    const borrowBalance = Number(ur.variableBorrows);
    const borrowBalanceUSD = Number(ur.variableBorrowsUSD);
    const liqThreshold = Number(ur.reserve.reserveLiquidationThreshold);

    if (supplyBalanceUSD > 0.01 && ur.usageAsCollateralEnabledOnUser) {
      collaterals.push({
        symbol: ur.reserve.symbol,
        amountUSD: supplyBalanceUSD,
        amount: supplyBalance,
        liqThreshold,
      });
    }

    if (borrowBalanceUSD > 0.01) {
      debts.push({
        symbol: ur.reserve.symbol,
        amountUSD: borrowBalanceUSD,
        amount: borrowBalance,
      });
    }
  }

  if (collaterals.length === 0 || debts.length === 0) return null;

  collaterals.sort((a, b) => b.amountUSD - a.amountUSD);
  debts.sort((a, b) => b.amountUSD - a.amountUSD);

  const mainCollateral = collaterals[0];
  const otherCollateralWeighted = collaterals.slice(1).reduce((s, c) => s + c.amountUSD * c.liqThreshold, 0);
  const totalDebt = debts.reduce((s, d) => s + d.amountUSD, 0);

  let liquidationPriceUSD: number | null = null;
  if (mainCollateral.amount > 0 && mainCollateral.liqThreshold > 0) {
    liquidationPriceUSD = (totalDebt - otherCollateralWeighted) / (mainCollateral.amount * mainCollateral.liqThreshold);
    if (liquidationPriceUSD <= 0) liquidationPriceUSD = null;
  }

  // Use on-chain HF from getUserAccountData (accounts for e-mode correctly)
  // instead of the math-utils computed HF which may lack e-mode category data
  return {
    walletAddress: address,
    healthFactor: summary.healthFactor,
    totalCollateralUSD: summary.totalCollateralUSD,
    totalDebtUSD: summary.totalDebtUSD,
    mainCollateralSymbol: mainCollateral.symbol,
    mainCollateralAmount: mainCollateral.amount,
    mainCollateralPriceUSD: mainCollateral.amountUSD / mainCollateral.amount,
    liquidationPriceUSD,
    liquidationThreshold: summary.liquidationThreshold,
    positionJson: { collaterals, debts },
  };
}

// ── Public: Fetch top borrowers ──

export async function fetchTopBorrowers(limit = 100): Promise<ProcessedPosition[]> {
  // 1. Discover top borrowers via Chaos Labs (already sorted by debt)
  const borrowerList = await discoverBorrowers(limit * 2);

  // 2. Screen on-chain for accurate HF and debt
  const summaries = await screenBorrowers(borrowerList);
  console.log(`[radar] ${summaries.length} active borrowers with debt`);

  // 3. Top N by debt (re-sort with on-chain data)
  summaries.sort((a, b) => b.totalDebtUSD - a.totalDebtUSD);
  const topBorrowers = summaries.slice(0, limit);

  // 4. Pre-warm reserve cache
  await getFormattedReserves();

  // 5. Detailed positions (batched to avoid RPC rate limits)
  const positions: ProcessedPosition[] = [];
  const batchSize = 5;

  for (let i = 0; i < topBorrowers.length; i += batchSize) {
    const batch = topBorrowers.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((s) => getDetailedPosition(s.address, s))
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        positions.push(r.value);
      }
    }
  }

  return positions;
}

// ── Public: Re-screen existing positions by address ──

export async function refreshPositionsByAddress(addresses: string[]): Promise<ProcessedPosition[]> {
  if (addresses.length === 0) return [];

  // 1. Screen on-chain for current HF and debt
  const summaries = await screenBorrowers(addresses);
  if (summaries.length === 0) return [];

  // 2. Pre-warm reserve cache
  await getFormattedReserves();

  // 3. Get detailed positions
  const positions: ProcessedPosition[] = [];
  const batchSize = 5;
  for (let i = 0; i < summaries.length; i += batchSize) {
    const batch = summaries.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((s) => getDetailedPosition(s.address, s))
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        positions.push(r.value);
      }
    }
  }

  return positions;
}

// ── Chaos Labs GraphQL API ──

const CHAOS_LABS_ENDPOINT = "https://cloud.chaoslabs.co/query/ccar-lending";
const CHAOS_LABS_HEADERS = {
  "apollographql-client-name": "aave",
  "protocol": "aave",
  "content-type": "application/json",
  "origin": "https://community.chaoslabs.xyz",
  "referer": "https://community.chaoslabs.xyz/",
};

// ── Public: Fetch recent liquidations via Chaos Labs ──

export async function fetchRecentLiquidations(limit = 500): Promise<ProcessedLiquidation[]> {
  console.log(`[radar] Fetching liquidations from Chaos Labs (60 days, Ethereum)`);

  const res = await fetch(CHAOS_LABS_ENDPOINT, {
    method: "POST",
    headers: CHAOS_LABS_HEADERS,
    body: JSON.stringify({
      query: `{
        liquidationsEvents(daysAgo: 60, chains: [Ethereum]) {
          trxId
          debtTokenSymbol
          debtRepaidAmountInUsd
          debtUserId
          colleteralTokenSymbol
          colleteralSeizedAmountInUsd
          liquidatorAccount
          timestamp
        }
      }`,
    }),
  });

  const json = await res.json();
  const events = json?.data?.liquidationsEvents;
  if (!events || !Array.isArray(events)) {
    console.error("[radar] Chaos Labs returned no liquidation events:", json?.errors);
    return [];
  }

  console.log(`[radar] Chaos Labs returned ${events.length} liquidation events`);

  // Events are already sorted most recent first, take top N
  const liquidations: ProcessedLiquidation[] = [];

  // Track logIndex per txHash since multiple events can share the same tx
  const txIndexMap = new Map<string, number>();

  for (const e of events.slice(0, limit)) {
    const txHash = e.trxId as string;
    const logIndex = txIndexMap.get(txHash) ?? 0;
    txIndexMap.set(txHash, logIndex + 1);

    liquidations.push({
      txHash,
      logIndex,
      walletAddress: (e.debtUserId as string).toLowerCase(),
      liquidatorAddress: (e.liquidatorAccount as string).toLowerCase(),
      collateralAssetSymbol: e.colleteralTokenSymbol,
      collateralSeizedAmount: 0, // Chaos Labs only provides USD values
      collateralSeizedUSD: e.colleteralSeizedAmountInUsd,
      debtAssetSymbol: e.debtTokenSymbol,
      debtRepaidAmount: 0,
      debtRepaidUSD: e.debtRepaidAmountInUsd,
      timestamp: new Date(e.timestamp),
    });
  }

  console.log(`[radar] Processed ${liquidations.length} liquidations`);
  return liquidations;
}
