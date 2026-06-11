import {
  TokenSimulationConfig,
  TokenSimulationResult,
  TokenDaySnapshot,
  TokenDayHolding,
  TokenSimulationSummary,
  TokenAction,
  ActiveSupply,
  ActiveSupplySnapshot,
  ActiveBorrow,
  ActiveBorrowSnapshot,
  TokenDayActionResult,
} from "./types";
import { generateAllPriceSeries } from "@/src/lib/simulation/prices";
import { generateAllRateSeries } from "@/src/lib/simulation/rates";
import { compoundDailyInterest } from "@/src/lib/simulation/math";

interface HoldingMeta {
  coingeckoId: string;
  symbol: string;
  name: string;
  image?: string;
  quantity: number;
  currentPriceUSD: number;
}

/**
 * Lookup a rate value for a given day from pre-generated rate series,
 * falling back to a static APY if no scenario exists.
 */
function getRateForDay(
  symbol: string,
  rateType: "supply" | "borrow" | "supplyIncentive" | "borrowIncentive",
  rateSeries: Record<string, { supply?: number[]; borrow?: number[]; supplyIncentive?: number[]; borrowIncentive?: number[] }>,
  day: number,
  fallback: number,
  yieldKey?: string,
): number {
  // Try yieldKey first (more specific), then symbol
  const keys = yieldKey ? [yieldKey, symbol] : [symbol];
  for (const key of keys) {
    const series = rateSeries[key]?.[rateType];
    if (series && day < series.length) {
      return series[day];
    }
  }
  return fallback;
}

/**
 * Resolve a token's USD price for a given day:
 * price scenario series → holding metadata → optional fallback.
 */
function getPriceForDay(
  symbol: string,
  priceSeries: Record<string, number[]>,
  holdingMeta: Record<string, HoldingMeta>,
  day: number,
  fallback = 0,
): number {
  const series = priceSeries[symbol];
  if (series && day < series.length) return series[day];
  const metaPrice = holdingMeta[symbol]?.currentPriceUSD ?? 0;
  if (metaPrice > 0) return metaPrice;
  return fallback;
}

/** Mutable USD totals accumulated during the simulation. */
interface SimTotals {
  interestEarnedUSD: number;
  rewardsEarnedUSD: number;
  borrowInterestPaidUSD: number;
  borrowIncentivesEarnedUSD: number;
}

/**
 * Run a temporal simulation for a token portfolio.
 *
 * Tracks mutable quantities per token, executes scheduled actions day-by-day,
 * manages supply positions with compound interest accrual and claims,
 * manages borrow positions with compound interest and incentives.
 */
export function runTokenSimulation(config: TokenSimulationConfig): TokenSimulationResult {
  const { durationDays, holdings, priceScenarios, actions = [], rateScenarios = [] } = config;

  // Generate price series for all tokens with scenarios
  const priceSeries = generateAllPriceSeries(priceScenarios, durationDays);

  // Generate rate series for yield positions with rate scenarios
  const rateSeries = generateAllRateSeries(rateScenarios, durationDays);

  // Mutable wallet balances keyed by symbol
  const walletBalances: Record<string, number> = {};
  // Track which symbols have a holding entry (for image/name/coingeckoId lookup)
  const holdingMeta: Record<string, HoldingMeta> = {};

  for (const h of holdings) {
    walletBalances[h.symbol] = h.quantity;
    holdingMeta[h.symbol] = h;
  }

  // Active supply positions
  const activeSupplies: ActiveSupply[] = [];
  // Active borrow positions
  const activeBorrows: ActiveBorrow[] = [];

  // Sort actions by day then orderInDay
  const sortedActions = [...actions].sort(
    (a, b) => a.day - b.day || a.orderInDay - b.orderInDay
  );

  // Track total interest/rewards for summary (in USD, valued at the day's price)
  const totals: SimTotals = {
    interestEarnedUSD: 0,
    rewardsEarnedUSD: 0,
    borrowInterestPaidUSD: 0,
    borrowIncentivesEarnedUSD: 0,
  };

  // Build timeline
  const timeline: TokenDaySnapshot[] = [];

  for (let day = 0; day <= durationDays; day++) {
    const dayActionResults: TokenDayActionResult[] = [];

    // --- 1. Accrue interest on active supplies (compound) ---
    for (const supply of activeSupplies) {
      const effectiveAPY = getRateForDay(supply.symbol, "supply", rateSeries, day, supply.apy, supply.yieldKey);
      const interest = compoundDailyInterest(supply.principalAmount, supply.accruedInterest, effectiveAPY);
      supply.accruedInterest += interest;

      // Accrue bonus rewards (using rate scenario for incentive if available).
      // Incentive APRs are USD-yield rates: convert the daily USD value into
      // a quantity of the reward token using both tokens' prices.
      if (supply.bonusRewards) {
        const supplyPrice = getPriceForDay(supply.symbol, priceSeries, holdingMeta, day);
        for (const bonus of supply.bonusRewards) {
          const effectiveAPR = getRateForDay(supply.symbol, "supplyIncentive", rateSeries, day, bonus.apr, supply.yieldKey);
          const rewardPrice = getPriceForDay(bonus.symbol, priceSeries, holdingMeta, day, bonus.priceUSD ?? 0);
          if (supplyPrice <= 0 || rewardPrice <= 0) continue; // cannot value the reward — skip rather than mint bogus quantities
          const dailyRewardUSD = supply.principalAmount * supplyPrice * (effectiveAPR / 365);
          bonus.accruedAmount += dailyRewardUSD / rewardPrice;
        }
      }
    }

    // --- 2. Accrue interest on active borrows (compound) ---
    for (const borrow of activeBorrows) {
      const effectiveAPY = getRateForDay(borrow.symbol, "borrow", rateSeries, day, borrow.borrowAPY, borrow.yieldKey);
      const interest = compoundDailyInterest(borrow.principalAmount, borrow.accruedInterest, effectiveAPY);
      borrow.accruedInterest += interest;
      totals.borrowInterestPaidUSD += interest * getPriceForDay(borrow.symbol, priceSeries, holdingMeta, day);

      // Accrue borrow incentives (reward tokens earned), converting the daily
      // USD value into reward-token quantity via both tokens' prices.
      if (borrow.borrowIncentives) {
        const borrowPrice = getPriceForDay(borrow.symbol, priceSeries, holdingMeta, day);
        for (const incentive of borrow.borrowIncentives) {
          const effectiveAPR = getRateForDay(borrow.symbol, "borrowIncentive", rateSeries, day, incentive.apr, borrow.yieldKey);
          const rewardPrice = getPriceForDay(incentive.symbol, priceSeries, holdingMeta, day, incentive.priceUSD ?? 0);
          if (borrowPrice <= 0 || rewardPrice <= 0) continue;
          const dailyRewardUSD = borrow.principalAmount * borrowPrice * (effectiveAPR / 365);
          incentive.accruedAmount += dailyRewardUSD / rewardPrice;
        }
      }
    }

    // --- 3. Auto-claim based on claimFrequency ---
    for (const supply of activeSupplies) {
      let shouldClaim = false;

      switch (supply.claimFrequency) {
        case "continuous":
          shouldClaim = true;
          break;
        case "monthly":
          shouldClaim = (day - supply.startDay) > 0 && (day - supply.startDay) % 30 === 0;
          break;
        case "yearly":
          shouldClaim = (day - supply.startDay) > 0 && (day - supply.startDay) % 365 === 0;
          break;
        case "end_of_lock":
          shouldClaim = supply.locked && supply.lockEndDay === day;
          break;
      }

      if (shouldClaim && supply.accruedInterest > 0) {
        const claimed = supply.accruedInterest;
        walletBalances[supply.symbol] = (walletBalances[supply.symbol] || 0) + claimed;
        supply.claimedInterest += claimed;
        totals.interestEarnedUSD += claimed * getPriceForDay(supply.symbol, priceSeries, holdingMeta, day);
        supply.accruedInterest = 0;
      }

      // Auto-claim bonus rewards on same schedule
      if (shouldClaim && supply.bonusRewards) {
        for (const bonus of supply.bonusRewards) {
          if (bonus.accruedAmount > 0) {
            walletBalances[bonus.symbol] = (walletBalances[bonus.symbol] || 0) + bonus.accruedAmount;
            bonus.claimedAmount += bonus.accruedAmount;
            totals.rewardsEarnedUSD += bonus.accruedAmount * getPriceForDay(bonus.symbol, priceSeries, holdingMeta, day, bonus.priceUSD ?? 0);
            bonus.accruedAmount = 0;
            // Ensure the bonus token is tracked
            if (!holdingMeta[bonus.symbol]) {
              holdingMeta[bonus.symbol] = {
                coingeckoId: bonus.coingeckoId,
                symbol: bonus.symbol,
                name: bonus.symbol,
                quantity: 0,
                currentPriceUSD: bonus.priceUSD ?? 0,
              };
            }
          }
        }
      }
    }

    // --- 3b. Auto-claim borrow incentives (continuous) ---
    for (const borrow of activeBorrows) {
      if (borrow.borrowIncentives) {
        for (const incentive of borrow.borrowIncentives) {
          if (incentive.accruedAmount > 0) {
            walletBalances[incentive.symbol] = (walletBalances[incentive.symbol] || 0) + incentive.accruedAmount;
            incentive.claimedAmount += incentive.accruedAmount;
            totals.borrowIncentivesEarnedUSD += incentive.accruedAmount * getPriceForDay(incentive.symbol, priceSeries, holdingMeta, day, incentive.priceUSD ?? 0);
            incentive.accruedAmount = 0;
            if (!holdingMeta[incentive.symbol]) {
              holdingMeta[incentive.symbol] = {
                coingeckoId: incentive.coingeckoId,
                symbol: incentive.symbol,
                name: incentive.symbol,
                quantity: 0,
                currentPriceUSD: incentive.priceUSD ?? 0,
              };
            }
          }
        }
      }
    }

    // --- 4. Unlock expired locks ---
    for (let i = activeSupplies.length - 1; i >= 0; i--) {
      const supply = activeSupplies[i];
      if (supply.locked && supply.lockEndDay === day) {
        // Unlock principal back to wallet
        walletBalances[supply.symbol] = (walletBalances[supply.symbol] || 0) + supply.principalAmount;
        // Claim any remaining accrued interest
        if (supply.accruedInterest > 0) {
          walletBalances[supply.symbol] += supply.accruedInterest;
          supply.claimedInterest += supply.accruedInterest;
          totals.interestEarnedUSD += supply.accruedInterest * getPriceForDay(supply.symbol, priceSeries, holdingMeta, day);
          supply.accruedInterest = 0;
        }
        // Claim any remaining bonus rewards
        if (supply.bonusRewards) {
          for (const bonus of supply.bonusRewards) {
            if (bonus.accruedAmount > 0) {
              walletBalances[bonus.symbol] = (walletBalances[bonus.symbol] || 0) + bonus.accruedAmount;
              bonus.claimedAmount += bonus.accruedAmount;
              totals.rewardsEarnedUSD += bonus.accruedAmount * getPriceForDay(bonus.symbol, priceSeries, holdingMeta, day, bonus.priceUSD ?? 0);
              bonus.accruedAmount = 0;
            }
          }
        }
        activeSupplies.splice(i, 1);
      }
    }

    // --- 5. Execute scheduled actions for this day ---
    const dayActions = sortedActions.filter((a) => a.day === day);
    for (const action of dayActions) {
      const result = executeAction(action, walletBalances, activeSupplies, activeBorrows, holdingMeta, priceSeries, day, totals);
      dayActionResults.push(result);
    }

    // --- 6. Build day snapshot ---
    const allSymbols = new Set<string>();
    for (const sym of Object.keys(walletBalances)) allSymbols.add(sym);
    for (const s of activeSupplies) {
      allSymbols.add(s.symbol);
      if (s.bonusRewards) {
        for (const b of s.bonusRewards) allSymbols.add(b.symbol);
      }
    }
    for (const b of activeBorrows) {
      allSymbols.add(b.symbol);
      if (b.borrowIncentives) {
        for (const inc of b.borrowIncentives) allSymbols.add(inc.symbol);
      }
    }

    const dayHoldings: TokenDayHolding[] = [];

    for (const symbol of allSymbols) {
      const walletQty = walletBalances[symbol] || 0;

      // Calculate total supplied for this symbol
      let supplied = 0;
      let supplyAPY: number | undefined;
      for (const s of activeSupplies) {
        if (s.symbol === symbol) {
          supplied += s.principalAmount + s.accruedInterest;
          supplyAPY = getRateForDay(s.symbol, "supply", rateSeries, day, s.apy, s.yieldKey);
        }
      }

      // Calculate total borrowed for this symbol
      let borrowed = 0;
      let borrowAPY: number | undefined;
      for (const b of activeBorrows) {
        if (b.symbol === symbol) {
          borrowed += b.principalAmount + b.accruedInterest;
          borrowAPY = getRateForDay(b.symbol, "borrow", rateSeries, day, b.borrowAPY, b.yieldKey);
        }
      }

      // Get price
      const meta = holdingMeta[symbol];
      const series = priceSeries[symbol];
      const priceUSD = series ? series[day] : (meta?.currentPriceUSD ?? 0);

      const totalQty = walletQty + supplied;
      if (totalQty <= 0 && supplied <= 0 && borrowed <= 0) continue;

      // Net value: (wallet + supplied) * price - borrowed * price
      const valueUSD = (walletQty + supplied) * priceUSD - borrowed * priceUSD;

      dayHoldings.push({
        symbol,
        coingeckoId: meta?.coingeckoId ?? symbol,
        name: meta?.name ?? symbol,
        image: (meta as { image?: string } | undefined)?.image,
        quantity: walletQty,
        supplied,
        borrowed,
        priceUSD,
        valueUSD,
        supplyAPY,
        borrowAPY,
      });
    }

    const totalValueUSD = dayHoldings.reduce((sum, h) => sum + h.valueUSD, 0);

    const supplySnapshots: ActiveSupplySnapshot[] = activeSupplies.map((s) => ({
      id: s.id,
      symbol: s.symbol,
      principalAmount: s.principalAmount,
      accruedInterest: s.accruedInterest,
      claimedInterest: s.claimedInterest,
      apy: s.apy,
      locked: s.locked,
      lockEndDay: s.lockEndDay,
      claimFrequency: s.claimFrequency,
    }));

    const borrowSnapshots: ActiveBorrowSnapshot[] = activeBorrows.map((b) => ({
      id: b.id,
      symbol: b.symbol,
      principalAmount: b.principalAmount,
      accruedInterest: b.accruedInterest,
      borrowAPY: b.borrowAPY,
    }));

    timeline.push({
      day,
      holdings: dayHoldings,
      totalValueUSD,
      actionsExecuted: dayActionResults,
      activeSupplies: supplySnapshots,
      activeBorrows: borrowSnapshots,
    });
  }

  // Build summary
  const startValue = timeline[0]?.totalValueUSD ?? 0;
  const endValue = timeline[timeline.length - 1]?.totalValueUSD ?? 0;

  let highestValue = -Infinity;
  let highestDay = 0;
  let lowestValue = Infinity;
  let lowestDay = 0;

  for (const snap of timeline) {
    if (snap.totalValueUSD > highestValue) {
      highestValue = snap.totalValueUSD;
      highestDay = snap.day;
    }
    if (snap.totalValueUSD < lowestValue) {
      lowestValue = snap.totalValueUSD;
      lowestDay = snap.day;
    }
  }

  const summary: TokenSimulationSummary = {
    startValueUSD: startValue,
    endValueUSD: endValue,
    changeUSD: endValue - startValue,
    changePercent: startValue > 0 ? (endValue - startValue) / startValue : 0,
    highestValueUSD: highestValue,
    highestValueDay: highestDay,
    lowestValueUSD: lowestValue,
    lowestValueDay: lowestDay,
    totalInterestEarned: totals.interestEarnedUSD,
    totalRewardsEarned: totals.rewardsEarnedUSD,
    totalBorrowInterestPaid: totals.borrowInterestPaidUSD,
    totalBorrowIncentivesEarned: totals.borrowIncentivesEarnedUSD,
  };

  return { timeline, summary };
}

/**
 * Execute a single action, mutating wallet balances, active supplies, and active borrows.
 */
function executeAction(
  action: TokenAction,
  walletBalances: Record<string, number>,
  activeSupplies: ActiveSupply[],
  activeBorrows: ActiveBorrow[],
  holdingMeta: Record<string, HoldingMeta>,
  priceSeries: Record<string, number[]>,
  day: number,
  totals: SimTotals
): TokenDayActionResult {
  switch (action.type) {
    case "receive": {
      walletBalances[action.symbol] = (walletBalances[action.symbol] || 0) + action.amount;
      // Ensure meta exists for new tokens
      if (!holdingMeta[action.symbol]) {
        holdingMeta[action.symbol] = {
          coingeckoId: action.symbol,
          symbol: action.symbol,
          name: action.symbol,
          quantity: 0,
          currentPriceUSD: 0,
        };
      }
      return { type: "receive", symbol: action.symbol, amount: action.amount, status: "success" };
    }

    case "send": {
      const balance = walletBalances[action.symbol] || 0;
      if (balance < action.amount) {
        return {
          type: "send",
          symbol: action.symbol,
          amount: action.amount,
          status: "skipped",
          reason: `Insufficient balance: ${balance.toFixed(4)} < ${action.amount}`,
        };
      }
      walletBalances[action.symbol] = balance - action.amount;
      return { type: "send", symbol: action.symbol, amount: action.amount, status: "success" };
    }

    case "swap": {
      const fromSymbol = action.fromSymbol!;
      const toSymbol = action.toSymbol!;
      const fromAmount = action.fromAmount!;
      const sc = action.swapConfig;

      const fromBalance = walletBalances[fromSymbol] || 0;
      if (fromBalance < fromAmount) {
        return {
          type: "swap",
          symbol: fromSymbol,
          amount: fromAmount,
          status: "skipped",
          reason: `Insufficient ${fromSymbol} balance: ${fromBalance.toFixed(4)} < ${fromAmount}`,
        };
      }

      // Validate gas fee token balance (account for the swapped amount when
      // the fee is paid in the same token being swapped out)
      if (sc?.feeTokenSymbol && sc.feeTokenAmount && sc.feeTokenAmount > 0) {
        const feeBalance = walletBalances[sc.feeTokenSymbol] || 0;
        const required = sc.feeTokenAmount + (sc.feeTokenSymbol === fromSymbol ? fromAmount : 0);
        if (feeBalance < required) {
          return {
            type: "swap",
            symbol: fromSymbol,
            amount: fromAmount,
            status: "skipped",
            reason: `Insufficient ${sc.feeTokenSymbol} for gas fees: ${feeBalance.toFixed(6)} < ${required.toFixed(6)}`,
          };
        }
      }

      // Get prices for the day
      const fromMeta = holdingMeta[fromSymbol];
      const fromSeries = priceSeries[fromSymbol];
      const fromPrice = fromSeries ? fromSeries[day] : (fromMeta?.currentPriceUSD ?? 0);

      // Ensure meta exists for the to-token BEFORE price lookup (using action metadata)
      if (!holdingMeta[toSymbol] && action.toCurrentPriceUSD) {
        holdingMeta[toSymbol] = {
          coingeckoId: action.toCoingeckoId ?? toSymbol,
          symbol: toSymbol,
          name: action.toName ?? toSymbol,
          image: action.toImage,
          quantity: 0,
          currentPriceUSD: action.toCurrentPriceUSD,
        };
      }

      const toMeta = holdingMeta[toSymbol];
      const toSeries = priceSeries[toSymbol];
      const toPrice = toSeries ? toSeries[day] : (toMeta?.currentPriceUSD ?? action.toCurrentPriceUSD ?? 0);

      if (toPrice <= 0) {
        return {
          type: "swap",
          symbol: fromSymbol,
          amount: fromAmount,
          status: "skipped",
          reason: `Cannot determine price for ${toSymbol}`,
        };
      }

      // Compute output with slippage applied
      const feeMultiplier = sc?.feePercent ? 1 - sc.feePercent / 100 : 1;
      const toAmount = (fromAmount * fromPrice / toPrice) * feeMultiplier;

      walletBalances[fromSymbol] = fromBalance - fromAmount;
      walletBalances[toSymbol] = (walletBalances[toSymbol] || 0) + toAmount;

      // Deduct gas fee
      if (sc?.feeTokenSymbol && sc.feeTokenAmount && sc.feeTokenAmount > 0) {
        walletBalances[sc.feeTokenSymbol] -= sc.feeTokenAmount;
      }

      // Ensure meta exists for the received token (fallback if not set above)
      if (!holdingMeta[toSymbol]) {
        holdingMeta[toSymbol] = {
          coingeckoId: action.toCoingeckoId ?? toSymbol,
          symbol: toSymbol,
          name: action.toName ?? toSymbol,
          quantity: 0,
          currentPriceUSD: toPrice,
        };
      }

      return {
        type: "swap",
        symbol: fromSymbol,
        amount: fromAmount,
        status: "success",
        detail: `${fromAmount} ${fromSymbol} → ${toAmount.toFixed(6)} ${toSymbol}${sc?.feePercent ? ` (${sc.feePercent}% slippage)` : ""}`,
      };
    }

    case "supply": {
      const balance = walletBalances[action.symbol] || 0;
      if (balance < action.amount) {
        return {
          type: "supply",
          symbol: action.symbol,
          amount: action.amount,
          status: "skipped",
          reason: `Insufficient balance: ${balance.toFixed(4)} < ${action.amount}`,
        };
      }

      const sc = action.supplyConfig!;
      walletBalances[action.symbol] = balance - action.amount;

      const supply: ActiveSupply = {
        id: action.id,
        symbol: action.symbol,
        principalAmount: action.amount,
        accruedInterest: 0,
        claimedInterest: 0,
        startDay: day,
        locked: sc.locked,
        lockEndDay: sc.locked && sc.lockDays ? day + sc.lockDays : undefined,
        apy: sc.apy,
        yieldKey: sc.yieldKey,
        claimFrequency: sc.claimFrequency ?? "continuous",
        bonusRewards: sc.bonusRewards?.map((b) => ({
          ...b,
          accruedAmount: 0,
          claimedAmount: 0,
        })),
      };

      activeSupplies.push(supply);

      return { type: "supply", symbol: action.symbol, amount: action.amount, status: "success" };
    }

    case "claim": {
      // Force claim accrued interest from supplies matching the symbol
      let totalClaimed = 0;
      for (const supply of activeSupplies) {
        if (supply.symbol === action.symbol && supply.accruedInterest > 0) {
          // Skip locked supplies with end_of_lock frequency
          if (supply.locked && supply.claimFrequency === "end_of_lock" && supply.lockEndDay !== day) {
            continue;
          }
          walletBalances[supply.symbol] = (walletBalances[supply.symbol] || 0) + supply.accruedInterest;
          supply.claimedInterest += supply.accruedInterest;
          totalClaimed += supply.accruedInterest;
          totals.interestEarnedUSD += supply.accruedInterest * getPriceForDay(supply.symbol, priceSeries, holdingMeta, day);
          supply.accruedInterest = 0;
        }
        // Also claim bonus rewards
        if (supply.symbol === action.symbol && supply.bonusRewards) {
          for (const bonus of supply.bonusRewards) {
            if (bonus.accruedAmount > 0) {
              walletBalances[bonus.symbol] = (walletBalances[bonus.symbol] || 0) + bonus.accruedAmount;
              bonus.claimedAmount += bonus.accruedAmount;
              totals.rewardsEarnedUSD += bonus.accruedAmount * getPriceForDay(bonus.symbol, priceSeries, holdingMeta, day, bonus.priceUSD ?? 0);
              bonus.accruedAmount = 0;
            }
          }
        }
      }

      if (totalClaimed === 0) {
        return {
          type: "claim",
          symbol: action.symbol,
          amount: 0,
          status: "skipped",
          reason: "No accrued interest to claim",
        };
      }

      return { type: "claim", symbol: action.symbol, amount: totalClaimed, status: "success" };
    }

    case "borrow": {
      const bc = action.borrowConfig!;
      // Add borrowed tokens to wallet
      walletBalances[action.symbol] = (walletBalances[action.symbol] || 0) + action.amount;

      // Ensure meta exists
      if (!holdingMeta[action.symbol]) {
        holdingMeta[action.symbol] = {
          coingeckoId: action.symbol,
          symbol: action.symbol,
          name: action.symbol,
          quantity: 0,
          currentPriceUSD: 0,
        };
      }

      const borrow: ActiveBorrow = {
        id: action.id,
        symbol: action.symbol,
        principalAmount: action.amount,
        accruedInterest: 0,
        startDay: day,
        borrowAPY: bc.borrowAPY,
        yieldKey: bc.yieldKey,
        borrowIncentives: bc.borrowIncentives?.map((inc) => ({
          ...inc,
          accruedAmount: 0,
          claimedAmount: 0,
        })),
      };

      activeBorrows.push(borrow);

      return { type: "borrow", symbol: action.symbol, amount: action.amount, status: "success" };
    }

    case "repay": {
      const balance = walletBalances[action.symbol] || 0;
      if (balance <= 0) {
        return {
          type: "repay",
          symbol: action.symbol,
          amount: action.amount,
          status: "skipped",
          reason: `No ${action.symbol} balance to repay with`,
        };
      }

      // Find borrows for this symbol (FIFO order)
      const symbolBorrows = activeBorrows.filter((b) => b.symbol === action.symbol);
      if (symbolBorrows.length === 0) {
        return {
          type: "repay",
          symbol: action.symbol,
          amount: action.amount,
          status: "skipped",
          reason: `No active borrows for ${action.symbol}`,
        };
      }

      // Total debt
      const totalDebt = symbolBorrows.reduce((sum, b) => sum + b.principalAmount + b.accruedInterest, 0);
      // Cap repay amount at total debt and available balance
      const repayAmount = Math.min(action.amount, totalDebt, balance);

      let remaining = repayAmount;

      // FIFO: pay interest first, then principal
      for (let i = 0; i < symbolBorrows.length && remaining > 0; i++) {
        const borrow = symbolBorrows[i];

        // Pay accrued interest first
        if (borrow.accruedInterest > 0) {
          const interestPayment = Math.min(remaining, borrow.accruedInterest);
          borrow.accruedInterest -= interestPayment;
          remaining -= interestPayment;
        }

        // Then pay principal
        if (remaining > 0 && borrow.principalAmount > 0) {
          const principalPayment = Math.min(remaining, borrow.principalAmount);
          borrow.principalAmount -= principalPayment;
          remaining -= principalPayment;
        }

        // Remove fully repaid borrows from the live list.
        // Note: we iterate `symbolBorrows` (a filtered copy), so splicing
        // `activeBorrows` must NOT decrement `i` — doing so revisits the same
        // zeroed borrow and loops forever when repaying across multiple borrows.
        if (borrow.principalAmount <= 0 && borrow.accruedInterest <= 0) {
          const idx = activeBorrows.indexOf(borrow);
          if (idx >= 0) activeBorrows.splice(idx, 1);
        }
      }

      walletBalances[action.symbol] = balance - repayAmount;

      return {
        type: "repay",
        symbol: action.symbol,
        amount: repayAmount,
        status: "success",
        detail: `Repaid ${repayAmount.toFixed(6)} ${action.symbol} (debt remaining: ${(totalDebt - repayAmount).toFixed(6)})`,
      };
    }

    default:
      return { type: action.type, symbol: action.symbol, amount: action.amount, status: "skipped", reason: "Unknown action type" };
  }
}
