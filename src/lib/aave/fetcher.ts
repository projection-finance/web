import { ethers } from "ethers";
import {
  UiPoolDataProvider,
  UiIncentiveDataProvider,
} from "@aave/contract-helpers";
import { createMonitoredProvider } from "@/src/lib/rpc-monitor";
import dayjs from "dayjs";
import {
  formatReservesAndIncentives,
  formatUserSummaryAndIncentives,
  ComputedUserReserve,
} from "@aave/math-utils";
import BigNumber from "bignumber.js";
import {
  AaveHealthFactorData,
  AaveMarketConfig,
  AavePositionData,
  AssetDetails,
  BorrowedAssetDataItem,
  FormattedReserve,
  MerklIncentiveData,
  RawUserReserve,
  ReserveAssetDataItem,
} from "./types";
import { formatEmodeCategories } from "./emode";
import { getNetworkById } from "./networks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MerklOpportunity = Record<string, any>;

/**
 * Fetch Merkl incentives for Aave markets on a given chain.
 * Returns matched incentive data or [] on failure.
 */
export async function fetchMerklIncentives(
  chainId: number,
  formattedPoolReserves: FormattedReserve[]
): Promise<MerklIncentiveData[]> {
  try {
    const res = await fetch(
      `https://api.merkl.xyz/v4/opportunities?mainProtocolId=aave&items=100&status=LIVE&chainId=${chainId}`
    );
    if (!res.ok) return [];
    const opportunities: MerklOpportunity[] = await res.json();

    const results: MerklIncentiveData[] = [];

    for (const opp of opportunities) {
      const apr = Number(opp.apr);
      if (!apr || apr <= 0) continue;

      const action: "supply" | "borrow" =
        opp.action === "BORROW" ? "borrow" : "supply";

      // Try to match to an underlying asset via token addresses
      const oppTokenAddresses = (opp.tokens || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => (t.address as string)?.toLowerCase()
      );

      let matchedReserve: FormattedReserve | undefined;

      for (const reserve of formattedPoolReserves) {
        const aToken = (reserve.aTokenAddress as string)?.toLowerCase();
        const vDebtToken = (
          reserve.variableDebtTokenAddress as string
        )?.toLowerCase();
        const underlying = (reserve.underlyingAsset as string)?.toLowerCase();

        if (action === "supply" && aToken && oppTokenAddresses.includes(aToken)) {
          matchedReserve = reserve;
          break;
        }
        if (action === "borrow" && vDebtToken && oppTokenAddresses.includes(vDebtToken)) {
          matchedReserve = reserve;
          break;
        }
        // Fallback: check if identifier starts with the underlying asset address
        const identifier = (opp.identifier as string)?.toLowerCase() ?? "";
        if (underlying && identifier.startsWith(underlying)) {
          matchedReserve = reserve;
          break;
        }
      }

      if (!matchedReserve) continue;

      // Extract reward token info from rewardsRecord.breakdowns
      const breakdowns = opp.rewardsRecord?.breakdowns || [];
      if (breakdowns.length === 0) {
        // Use the opportunity-level data as a single reward entry
        results.push({
          underlyingAsset: matchedReserve.underlyingAsset as string,
          action,
          apr: apr / 100, // Merkl returns APR as percentage, convert to decimal
          rewardTokenSymbol: "MERKL",
          rewardTokenAddress: "",
          rewardTokenPriceUSD: undefined,
        });
      } else {
        // Split the opportunity-level APR equally across reward tokens.
        // (Pushing the full APR per token would multiply the real incentive
        // by the number of reward tokens once entries are summed.)
        const validBreakdowns = breakdowns.filter((bd: { token?: unknown }) => bd.token);
        for (const bd of validBreakdowns) {
          const token = bd.token;
          results.push({
            underlyingAsset: matchedReserve.underlyingAsset as string,
            action,
            apr: apr / 100 / validBreakdowns.length, // convert to decimal + equal split
            rewardTokenSymbol: token.symbol ?? "UNKNOWN",
            rewardTokenAddress: token.address ?? "",
            rewardTokenPriceUSD: token.price != null ? Number(token.price) : undefined,
          });
        }
      }
    }

    return results;
  } catch {
    // Fail-safe: if the API fails, return empty
    return [];
  }
}

/**
 * Lightweight fetch of pool reserves + Merkl incentives for a given market.
 * Does NOT require a user address — only fetches market-level data.
 * Applies a 15s timeout per market to avoid blocking on slow RPCs.
 */
export async function getMarketReserves(market: AaveMarketConfig) {
  const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
      ),
    ]);

  return timeout(
    (async () => {
      const provider = createMonitoredProvider(market.rpcUrl, market.id, market.chainId);

      const poolDataProviderContract = new UiPoolDataProvider({
        uiPoolDataProviderAddress: market.addresses.UI_POOL_DATA_PROVIDER,
        provider,
        chainId: market.chainId,
      });

      const incentiveDataProviderContract = new UiIncentiveDataProvider({
        uiIncentiveDataProviderAddress:
          market.addresses.UI_INCENTIVE_DATA_PROVIDER,
        provider,
        chainId: market.chainId,
      });

      const [reserves, reserveIncentives, eModes] = await Promise.all([
        poolDataProviderContract.getReservesHumanized({
          lendingPoolAddressProvider:
            market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
        }),
        incentiveDataProviderContract.getReservesIncentivesDataHumanized({
          lendingPoolAddressProvider:
            market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
        }),
        poolDataProviderContract
          .getEModesHumanized({
            lendingPoolAddressProvider:
              market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
          })
          .catch(() => [] as never[]),
      ]);

      const { baseCurrencyData } = reserves;
      const currentTimestamp = dayjs().unix();

      const formattedPoolReserves = formatReservesAndIncentives({
        reserves: reserves.reservesData,
        currentTimestamp,
        marketReferenceCurrencyDecimals:
          baseCurrencyData.marketReferenceCurrencyDecimals,
        marketReferencePriceInUsd:
          baseCurrencyData.marketReferenceCurrencyPriceInUsd,
        reserveIncentives,
        eModes: eModes.length > 0 ? eModes : undefined,
      });

      const emodeCategories = formatEmodeCategories(
        formattedPoolReserves as unknown as FormattedReserve[]
      );

      const merklIncentives = await fetchMerklIncentives(
        market.chainId,
        formattedPoolReserves as unknown as FormattedReserve[]
      );

      return { formattedPoolReserves, emodeCategories, merklIncentives };
    })(),
    15_000
  );
}

export async function getAavePosition(
  address: string,
  market: AaveMarketConfig
): Promise<AavePositionData> {
  const provider = createMonitoredProvider(market.rpcUrl, market.id, market.chainId);

  const poolDataProviderContract = new UiPoolDataProvider({
    uiPoolDataProviderAddress: market.addresses.UI_POOL_DATA_PROVIDER,
    provider,
    chainId: market.chainId,
  });

  const incentiveDataProviderContract = new UiIncentiveDataProvider({
    uiIncentiveDataProviderAddress:
      market.addresses.UI_INCENTIVE_DATA_PROVIDER,
    provider,
    chainId: market.chainId,
  });

  const [reserves, userReserves, reserveIncentives, userIncentives, eModes] =
    await Promise.all([
      poolDataProviderContract.getReservesHumanized({
        lendingPoolAddressProvider:
          market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
      }),
      poolDataProviderContract.getUserReservesHumanized({
        lendingPoolAddressProvider:
          market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
        user: address,
      }),
      incentiveDataProviderContract.getReservesIncentivesDataHumanized({
        lendingPoolAddressProvider:
          market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
      }),
      incentiveDataProviderContract.getUserReservesIncentivesDataHumanized({
        lendingPoolAddressProvider:
          market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
        user: address,
      }),
      poolDataProviderContract.getEModesHumanized({
        lendingPoolAddressProvider:
          market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
      }).catch(() => [] as never[]),
    ]);

  const reservesArray = reserves.reservesData;
  const { baseCurrencyData } = reserves;
  const userReservesArray = userReserves.userReserves;
  const currentTimestamp = dayjs().unix();

  const formattedPoolReserves = formatReservesAndIncentives({
    reserves: reservesArray,
    currentTimestamp,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    reserveIncentives,
    eModes: eModes.length > 0 ? eModes : undefined,
  });

  const userSummary = formatUserSummaryAndIncentives({
    currentTimestamp,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    userReserves: userReservesArray,
    formattedReserves: formattedPoolReserves,
    userEmodeCategoryId: userReserves.userEmodeCategoryId,
    reserveIncentives,
    userIncentives,
  });

  const marketReferenceCurrencyPriceInUSD = new BigNumber(
    baseCurrencyData.marketReferenceCurrencyPriceInUsd
  )
    .shiftedBy(-8)
    .toNumber();

  const getAssetDetailsFromReserveItem = (
    reserveItem: ComputedUserReserve
  ): AssetDetails => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reserve = reserveItem.reserve as any;
    // Find the raw reserve to get indices, rates, and token addresses
    const rawReserve = reservesArray.find(
      (r) => r.underlyingAsset === reserve.underlyingAsset
    );

    return {
      symbol: reserve.symbol,
      name: reserve.name,
      decimals: rawReserve?.decimals ?? reserve.decimals,
      priceInUSD: Number(reserve.priceInUSD),
      priceInMarketReferenceCurrency: new BigNumber(
        reserve.priceInMarketReferenceCurrency
      )
        .shiftedBy(baseCurrencyData.marketReferenceCurrencyDecimals * -1)
        .toNumber(),
      baseLTVasCollateral: Number(reserve.baseLTVasCollateral),
      reserveFactor: Number(reserve.reserveFactor),
      usageAsCollateralEnabled: reserve.usageAsCollateralEnabled,
      reserveLiquidationThreshold: Number(
        reserve.reserveLiquidationThreshold
      ),
      initialPriceInUSD: Number(reserve.priceInUSD),
      aTokenAddress: rawReserve?.aTokenAddress,
      variableDebtTokenAddress: rawReserve?.variableDebtTokenAddress,
      underlyingAsset: reserve.underlyingAsset,
      flashLoanEnabled: reserve.flashLoanEnabled ?? rawReserve?.flashLoanEnabled,
      borrowingEnabled: reserve.borrowingEnabled ?? rawReserve?.borrowingEnabled,
      isFrozen: reserve.isFrozen ?? rawReserve?.isFrozen,
      isPaused: reserve.isPaused ?? rawReserve?.isPaused,
      isActive: reserve.isActive ?? rawReserve?.isActive,
      supplyAPY: Number(reserve.supplyAPY),
      variableBorrowAPY: Number(reserve.variableBorrowAPY),
      supplyAPR: Number(reserve.supplyAPR ?? 0),
      variableBorrowAPR: Number(reserve.variableBorrowAPR ?? 0),
      availableLiquidity: Number(reserve.formattedAvailableLiquidity ?? reserve.availableLiquidity),
      borrowCap: Number(reserve.borrowCap),
      supplyCap: Number(reserve.supplyCap),
      eModeLtv: Number(reserve.eModeLtv),
      eModeLiquidationThreshold: Number(reserve.eModeLiquidationThreshold),
      eModeCategoryId: Number(reserve.eModeCategoryId),
      eModeLabel: reserve.eModeLabel,
      borrowableInIsolation: Boolean(reserve.borrowableInIsolation),
      isSiloedBorrowing: Boolean(reserve.isSiloedBorrowing),
      // Indices and rates from raw reserves for temporal simulation
      liquidityIndex: rawReserve
        ? Number(rawReserve.liquidityIndex)
        : undefined,
      variableBorrowIndex: rawReserve
        ? Number(rawReserve.variableBorrowIndex)
        : undefined,
      liquidityRate: rawReserve
        ? Number(rawReserve.liquidityRate)
        : undefined,
      variableBorrowRate: rawReserve
        ? Number(rawReserve.variableBorrowRate)
        : undefined,
    };
  };

  const fetchedData: AaveHealthFactorData = {
    address,
    healthFactor: Number(userSummary.healthFactor),
    totalBorrowsUSD: Number(userSummary.totalBorrowsUSD),
    availableBorrowsUSD: Number(userSummary.availableBorrowsUSD),
    totalCollateralMarketReferenceCurrency: Number(
      userSummary.totalCollateralMarketReferenceCurrency
    ),
    totalBorrowsMarketReferenceCurrency: Number(
      userSummary.totalBorrowsMarketReferenceCurrency
    ),
    currentLiquidationThreshold: Number(
      userSummary.currentLiquidationThreshold
    ),
    currentLoanToValue: Number(userSummary.currentLoanToValue),
    userReservesData: userSummary.userReservesData
      .filter(
        (r: ComputedUserReserve) =>
          r.underlyingBalance && r.underlyingBalance !== "0"
      )
      .map((reserveItem: ComputedUserReserve) => {
        const rawUserReserve = userReservesArray.find(
          (ur) =>
            ur.underlyingAsset === reserveItem.reserve.underlyingAsset
        );
        const item: ReserveAssetDataItem = {
          asset: getAssetDetailsFromReserveItem(reserveItem),
          underlyingBalance: Number(reserveItem.underlyingBalance),
          underlyingBalanceUSD: Number(reserveItem.underlyingBalanceUSD),
          underlyingBalanceMarketReferenceCurrency: Number(
            reserveItem.underlyingBalanceMarketReferenceCurrency
          ),
          usageAsCollateralEnabledOnUser:
            reserveItem.usageAsCollateralEnabledOnUser,
          scaledATokenBalance: rawUserReserve?.scaledATokenBalance,
        };
        return item;
      }),
    userBorrowsData: userSummary.userReservesData
      .filter(
        (r: ComputedUserReserve) =>
          r.totalBorrows && r.totalBorrows !== "0"
      )
      .map((reserveItem: ComputedUserReserve) => {
        const rawUserReserve = userReservesArray.find(
          (ur) =>
            ur.underlyingAsset === reserveItem.reserve.underlyingAsset
        );
        const item: BorrowedAssetDataItem = {
          asset: getAssetDetailsFromReserveItem(reserveItem),
          stableBorrows: 0,
          variableBorrows: Number(reserveItem.variableBorrows),
          totalBorrows: Number(reserveItem.totalBorrows),
          totalBorrowsUSD: Number(reserveItem.totalBorrowsUSD),
          stableBorrowAPY: 0,
          totalBorrowsMarketReferenceCurrency: Number(
            reserveItem.totalBorrowsMarketReferenceCurrency
          ),
          scaledVariableDebt: rawUserReserve?.scaledVariableDebt,
        };
        return item;
      }),
    userEmodeCategoryId: userReserves.userEmodeCategoryId,
    isInIsolationMode: userSummary.isInIsolationMode,
  };

  const availableAssets: AssetDetails[] = userSummary.userReservesData.map(
    (r: ComputedUserReserve) => getAssetDetailsFromReserveItem(r)
  );

  // Fetch wallet balances (native token + ERC20 tokens)
  const networkMeta = getNetworkById(market.id);
  const wrappedNativeAddress = networkMeta?.wrappedNativeAddress?.toLowerCase() ?? "";
  const tokenAddresses = availableAssets
    .map((a) => a.underlyingAsset?.toLowerCase())
    .filter((addr): addr is string => !!addr);

  try {
    const [ethBalance, tokenBalancesResult] = await Promise.all([
      provider.getBalance(address),
      provider.send("alchemy_getTokenBalances", [address, tokenAddresses]),
    ]);

    const ethBalanceNum = Number(ethers.utils.formatEther(ethBalance));
    const balanceMap = new Map<string, number>();

    for (const tb of tokenBalancesResult.tokenBalances || []) {
      const addr = tb.contractAddress.toLowerCase();
      const asset = availableAssets.find(
        (a) => a.underlyingAsset?.toLowerCase() === addr
      );
      if (asset && tb.tokenBalance && tb.tokenBalance !== "0x") {
        const decimals = asset.decimals ?? 18;
        const raw = ethers.BigNumber.from(tb.tokenBalance);
        balanceMap.set(addr, Number(ethers.utils.formatUnits(raw, decimals)));
      }
    }

    for (const asset of availableAssets) {
      const addr = asset.underlyingAsset?.toLowerCase();
      if (!addr) continue;
      let balance = balanceMap.get(addr) ?? 0;
      // For wrapped native token: add native balance
      if (wrappedNativeAddress && addr === wrappedNativeAddress) {
        balance += ethBalanceNum;
      }
      asset.walletBalance = balance;
    }
  } catch {
    // Wallet balance fetch failed — leave walletBalance undefined
  }

  // Store raw user reserves for offline recalculation via formatUserSummary
  const rawUserReserves: RawUserReserve[] = userReservesArray.map((ur) => ({
    underlyingAsset: ur.underlyingAsset,
    scaledATokenBalance: ur.scaledATokenBalance,
    usageAsCollateralEnabledOnUser: ur.usageAsCollateralEnabledOnUser,
    scaledVariableDebt: ur.scaledVariableDebt,
  }));

  const emodeCategories = formatEmodeCategories(
    formattedPoolReserves as unknown as FormattedReserve[]
  );

  // Fetch Merkl incentives (non-blocking, fail-safe)
  const merklIncentives = await fetchMerklIncentives(
    market.chainId,
    formattedPoolReserves as unknown as FormattedReserve[]
  );

  // Extract unique reward tokens from both protocol and Merkl incentives and add as AssetDetails
  const existingSymbols = new Set(availableAssets.map((a) => a.symbol));

  // Protocol incentives: extract from formattedPoolReserves aIncentivesData / vIncentivesData
  for (const reserve of formattedPoolReserves) {
    const allIncentives = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((reserve as any).aIncentivesData || []),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((reserve as any).vIncentivesData || []),
    ];
    for (const inc of allIncentives) {
      const sym = inc.rewardTokenSymbol as string;
      if (!sym || existingSymbols.has(sym)) continue;
      existingSymbols.add(sym);
      const priceFeed = Number(inc.rewardPriceFeed ?? 0);
      const decimals = Number(inc.rewardTokenDecimals ?? 18);
      const priceUSD = priceFeed > 0
        ? priceFeed / Math.pow(10, decimals > 8 ? 8 : decimals)
        : 0;
      availableAssets.push({
        symbol: sym,
        name: sym,
        priceInUSD: priceUSD,
        priceInMarketReferenceCurrency: 0,
        baseLTVasCollateral: 0,
        reserveFactor: 0,
        usageAsCollateralEnabled: false,
        reserveLiquidationThreshold: 0,
        initialPriceInUSD: priceUSD,
        isRewardToken: true,
        underlyingAsset: inc.rewardTokenAddress as string,
      });
    }
  }

  // Merkl incentives: add unique reward tokens
  for (const mi of merklIncentives) {
    if (!mi.rewardTokenSymbol || existingSymbols.has(mi.rewardTokenSymbol)) continue;
    existingSymbols.add(mi.rewardTokenSymbol);
    const priceUSD = mi.rewardTokenPriceUSD ?? 0;
    availableAssets.push({
      symbol: mi.rewardTokenSymbol,
      name: mi.rewardTokenSymbol,
      priceInUSD: priceUSD,
      priceInMarketReferenceCurrency: 0,
      baseLTVasCollateral: 0,
      reserveFactor: 0,
      usageAsCollateralEnabled: false,
      reserveLiquidationThreshold: 0,
      initialPriceInUSD: priceUSD,
      isRewardToken: true,
      underlyingAsset: mi.rewardTokenAddress,
    });
  }

  return {
    address,
    marketReferenceCurrencyPriceInUSD,
    availableAssets,
    fetchedData,
    workingData: JSON.parse(JSON.stringify(fetchedData)),
    rawUserReserves,
    formattedPoolReserves: formattedPoolReserves as unknown as FormattedReserve[],
    baseCurrencyData,
    userEmodeCategoryId: userReserves.userEmodeCategoryId,
    emodeCategories,
    merklIncentives,
  };
}

/**
 * Get an empty Aave position with all available market assets.
 * Used for "start from scratch" sandbox mode.
 */
export async function getEmptyAavePosition(
  market: AaveMarketConfig
): Promise<AavePositionData> {
  const { formattedPoolReserves, emodeCategories, merklIncentives } =
    await getMarketReserves(market);

  // Build available assets from formatted pool reserves
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const availableAssets: AssetDetails[] = (formattedPoolReserves as any[])
    .filter((r) => r.isActive && !r.isFrozen && !r.isPaused)
    .map((r) => ({
      symbol: r.symbol,
      name: r.name,
      decimals: Number(r.decimals),
      priceInUSD: Number(r.priceInUSD),
      priceInMarketReferenceCurrency: Number(r.priceInMarketReferenceCurrency ?? 0) /
        Math.pow(10, 8),
      baseLTVasCollateral: Number(r.baseLTVasCollateral),
      reserveFactor: Number(r.reserveFactor),
      usageAsCollateralEnabled: Boolean(r.usageAsCollateralEnabled),
      reserveLiquidationThreshold: Number(r.reserveLiquidationThreshold),
      initialPriceInUSD: Number(r.priceInUSD),
      aTokenAddress: r.aTokenAddress,
      variableDebtTokenAddress: r.variableDebtTokenAddress,
      underlyingAsset: r.underlyingAsset,
      borrowingEnabled: Boolean(r.borrowingEnabled),
      isFrozen: false,
      isPaused: false,
      isActive: true,
      supplyAPY: Number(r.supplyAPY ?? 0),
      variableBorrowAPY: Number(r.variableBorrowAPY ?? 0),
      supplyAPR: Number(r.supplyAPR ?? 0),
      variableBorrowAPR: Number(r.variableBorrowAPR ?? 0),
      availableLiquidity: Number(r.formattedAvailableLiquidity ?? r.availableLiquidity ?? 0),
      borrowCap: Number(r.borrowCap ?? 0),
      supplyCap: Number(r.supplyCap ?? 0),
      eModeLtv: Number(r.eModeLtv ?? 0),
      eModeLiquidationThreshold: Number(r.eModeLiquidationThreshold ?? 0),
      eModeCategoryId: Number(r.eModeCategoryId ?? 0),
      eModeLabel: r.eModeLabel ?? "",
      borrowableInIsolation: Boolean(r.borrowableInIsolation),
      isSiloedBorrowing: Boolean(r.isSiloedBorrowing),
      liquidityIndex: Number(r.liquidityIndex ?? 0),
      variableBorrowIndex: Number(r.variableBorrowIndex ?? 0),
      liquidityRate: Number(r.liquidityRate ?? 0),
      variableBorrowRate: Number(r.variableBorrowRate ?? 0),
      walletBalance: 0,
    }));

  const emptyHFData: AaveHealthFactorData = {
    address: "",
    healthFactor: 0,
    totalBorrowsUSD: 0,
    availableBorrowsUSD: 0,
    totalCollateralMarketReferenceCurrency: 0,
    totalBorrowsMarketReferenceCurrency: 0,
    currentLiquidationThreshold: 0,
    currentLoanToValue: 0,
    userReservesData: [],
    userBorrowsData: [],
    userEmodeCategoryId: 0,
    isInIsolationMode: false,
  };

  // Get proper baseCurrencyData from the market
  const provider = createMonitoredProvider(market.rpcUrl, market.id, market.chainId);
  const poolDataProviderContract = new UiPoolDataProvider({
    uiPoolDataProviderAddress: market.addresses.UI_POOL_DATA_PROVIDER,
    provider,
    chainId: market.chainId,
  });
  const reserves = await poolDataProviderContract.getReservesHumanized({
    lendingPoolAddressProvider: market.addresses.LENDING_POOL_ADDRESS_PROVIDER,
  });

  const marketReferenceCurrencyPriceInUSD = new BigNumber(
    reserves.baseCurrencyData.marketReferenceCurrencyPriceInUsd
  )
    .shiftedBy(-8)
    .toNumber();

  return {
    address: "",
    marketReferenceCurrencyPriceInUSD,
    availableAssets,
    fetchedData: emptyHFData,
    workingData: JSON.parse(JSON.stringify(emptyHFData)),
    rawUserReserves: [],
    formattedPoolReserves: formattedPoolReserves as unknown as FormattedReserve[],
    baseCurrencyData: reserves.baseCurrencyData,
    userEmodeCategoryId: 0,
    emodeCategories,
    merklIncentives,
  };
}
