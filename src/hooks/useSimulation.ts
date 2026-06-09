"use client";

import { useState, useCallback } from "react";
import {
  AavePositionData,
  SimAction,
  SimSnapshot,
  RawUserReserve,
  FormattedReserve,
} from "@/src/lib/aave/types";
import {
  recalculatePosition,
  applyPriceChange,
  applySupply,
  applyBorrow,
  applyRepay,
  applyWithdraw,
  applyCollateralToggle,
} from "@/src/lib/aave/calculator";

export function useSimulation(position: AavePositionData) {
  // Build initial wallet balances from available assets
  const initialWalletBalances: Record<string, number> = {};
  for (const asset of position.availableAssets) {
    if (asset.walletBalance !== undefined) {
      initialWalletBalances[asset.symbol] = asset.walletBalance;
    }
  }

  // Snapshot history: index 0 is always the initial position
  const [snapshots, setSnapshots] = useState<SimSnapshot[]>(() => [
    {
      id: "initial",
      label: "Initial Position",
      action: null,
      healthFactorData: position.workingData,
      rawUserReserves: JSON.parse(JSON.stringify(position.rawUserReserves)),
      formattedPoolReserves: JSON.parse(
        JSON.stringify(position.formattedPoolReserves)
      ),
      marketReferenceCurrencyPriceInUSD:
        position.marketReferenceCurrencyPriceInUSD,
      walletBalances: { ...initialWalletBalances },
      userEmodeCategoryId: position.userEmodeCategoryId,
    },
  ]);

  // Current snapshot index the user is viewing
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentSnapshot = snapshots[currentIndex];

  // Execute an action: creates a new snapshot from the CURRENT snapshot (not last)
  const executeAction = useCallback(
    (action: SimAction) => {
      const base = snapshots[currentIndex];
      let newRawUserReserves: RawUserReserve[] = JSON.parse(
        JSON.stringify(base.rawUserReserves)
      );
      let newFormattedPoolReserves: FormattedReserve[] = JSON.parse(
        JSON.stringify(base.formattedPoolReserves)
      );
      const newWalletBalances = { ...base.walletBalances };

      // Find underlyingAsset from symbol
      const findAsset = (symbol: string) =>
        newFormattedPoolReserves.find((r) => r.symbol === symbol)
          ?.underlyingAsset as string | undefined;

      switch (action.type) {
        case "price_change": {
          if (action.newPriceUSD === undefined) break;
          newFormattedPoolReserves = applyPriceChange(
            newFormattedPoolReserves,
            action.symbol,
            action.newPriceUSD,
            base.marketReferenceCurrencyPriceInUSD,
            position.baseCurrencyData.marketReferenceCurrencyDecimals
          );
          break;
        }
        case "supply": {
          const underlyingAsset = findAsset(action.symbol);
          if (!underlyingAsset || !action.amount) break;
          newRawUserReserves = applySupply(
            newRawUserReserves,
            newFormattedPoolReserves,
            underlyingAsset,
            action.amount,
            action.useAsCollateral ?? true
          );
          // Supply comes from wallet
          const currentBal = newWalletBalances[action.symbol] ?? 0;
          newWalletBalances[action.symbol] = Math.max(0, currentBal - action.amount);
          break;
        }
        case "borrow": {
          const underlyingAsset = findAsset(action.symbol);
          if (!underlyingAsset || !action.amount) break;
          newRawUserReserves = applyBorrow(
            newRawUserReserves,
            newFormattedPoolReserves,
            underlyingAsset,
            action.amount
          );
          // Borrowed funds go to wallet
          const currentBal = newWalletBalances[action.symbol] ?? 0;
          newWalletBalances[action.symbol] = currentBal + action.amount;
          break;
        }
        case "repay": {
          const underlyingAsset = findAsset(action.symbol);
          if (!underlyingAsset || !action.amount) break;
          if (action.repayFromCollateral) {
            // Withdraw from supply first, then repay the debt
            // Collateral repay: no wallet change (collateral → debt)
            newRawUserReserves = applyWithdraw(
              newRawUserReserves,
              newFormattedPoolReserves,
              underlyingAsset,
              action.amount
            );
          } else {
            // Repay from wallet: decrease wallet balance
            const currentBal = newWalletBalances[action.symbol] ?? 0;
            newWalletBalances[action.symbol] = Math.max(0, currentBal - action.amount);
          }
          newRawUserReserves = applyRepay(
            newRawUserReserves,
            newFormattedPoolReserves,
            underlyingAsset,
            action.amount
          );
          break;
        }
        case "withdraw": {
          const underlyingAsset = findAsset(action.symbol);
          if (!underlyingAsset || !action.amount) break;
          newRawUserReserves = applyWithdraw(
            newRawUserReserves,
            newFormattedPoolReserves,
            underlyingAsset,
            action.amount
          );
          // Withdrawn funds go to wallet
          const currentBal = newWalletBalances[action.symbol] ?? 0;
          newWalletBalances[action.symbol] = currentBal + action.amount;
          break;
        }
        case "toggle_collateral": {
          const underlyingAsset = findAsset(action.symbol);
          if (!underlyingAsset) break;
          newRawUserReserves = applyCollateralToggle(
            newRawUserReserves,
            underlyingAsset,
            action.useAsCollateral ?? false
          );
          break;
        }
        case "set_emode": {
          // No changes to reserves — only the emode category changes
          break;
        }
        case "set_wallet_balance": {
          // Simply set the wallet balance for this asset to the specified amount
          if (action.amount === undefined) break;
          newWalletBalances[action.symbol] = action.amount;
          break;
        }
      }

      // Use snapshot's emode, or override if this is a set_emode action
      const newEmodeCategoryId =
        action.type === "set_emode" && action.newEmodeCategoryId !== undefined
          ? action.newEmodeCategoryId
          : base.userEmodeCategoryId;

      // Recalculate full position using formatUserSummary
      const newHealthFactorData = recalculatePosition(
        newRawUserReserves,
        newFormattedPoolReserves,
        position.baseCurrencyData,
        newEmodeCategoryId
      );

      const label = buildActionLabel(action);

      const newSnapshot: SimSnapshot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label,
        action,
        healthFactorData: newHealthFactorData,
        rawUserReserves: newRawUserReserves,
        formattedPoolReserves: newFormattedPoolReserves,
        marketReferenceCurrencyPriceInUSD:
          base.marketReferenceCurrencyPriceInUSD,
        walletBalances: newWalletBalances,
        userEmodeCategoryId: newEmodeCategoryId,
      };

      // If we're not at the end, truncate future snapshots (like undo branch)
      const truncated = snapshots.slice(0, currentIndex + 1);
      const newSnapshots = [...truncated, newSnapshot];

      setSnapshots(newSnapshots);
      setCurrentIndex(newSnapshots.length - 1);
    },
    [snapshots, currentIndex, position]
  );

  // Navigate to a specific snapshot
  const goToSnapshot = useCallback(
    (index: number) => {
      if (index >= 0 && index < snapshots.length) {
        setCurrentIndex(index);
      }
    },
    [snapshots.length]
  );

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < snapshots.length - 1)
      setCurrentIndex(currentIndex + 1);
  }, [currentIndex, snapshots.length]);

  // Remove the last snapshot (undo)
  const undoLast = useCallback(() => {
    if (snapshots.length <= 1) return;
    const newSnapshots = snapshots.slice(0, -1);
    setSnapshots(newSnapshots);
    setCurrentIndex(Math.min(currentIndex, newSnapshots.length - 1));
  }, [snapshots, currentIndex]);

  // Reset to initial state
  const reset = useCallback(() => {
    const resetWalletBalances: Record<string, number> = {};
    for (const asset of position.availableAssets) {
      if (asset.walletBalance !== undefined) {
        resetWalletBalances[asset.symbol] = asset.walletBalance;
      }
    }
    setSnapshots([
      {
        id: "initial",
        label: "Initial Position",
        action: null,
        healthFactorData: position.workingData,
        rawUserReserves: JSON.parse(JSON.stringify(position.rawUserReserves)),
        formattedPoolReserves: JSON.parse(
          JSON.stringify(position.formattedPoolReserves)
        ),
        marketReferenceCurrencyPriceInUSD:
          position.marketReferenceCurrencyPriceInUSD,
        walletBalances: resetWalletBalances,
        userEmodeCategoryId: position.userEmodeCategoryId,
      },
    ]);
    setCurrentIndex(0);
  }, [position]);

  return {
    snapshots,
    currentSnapshot,
    currentIndex,
    executeAction,
    goToSnapshot,
    goToPrevious,
    goToNext,
    undoLast,
    reset,
    isAtStart: currentIndex === 0,
    isAtEnd: currentIndex === snapshots.length - 1,
  };
}

function buildActionLabel(action: SimAction): string {
  switch (action.type) {
    case "price_change":
      return `${action.symbol} price → $${action.newPriceUSD?.toLocaleString()}`;
    case "supply":
      return `Supply ${action.amount} ${action.symbol}`;
    case "borrow":
      return `Borrow ${action.amount} ${action.symbol}`;
    case "repay":
      return `Repay ${action.amount} ${action.symbol}${action.repayFromCollateral ? " (from collateral)" : ""}`;
    case "withdraw":
      return `Withdraw ${action.amount} ${action.symbol}`;
    case "set_wallet_balance":
      return `Set ${action.symbol} wallet to ${action.amount}`;
    case "toggle_collateral":
      return `${action.useAsCollateral ? "Enable" : "Disable"} ${action.symbol} as collateral`;
    case "set_emode":
      return action.newEmodeCategoryId === 0
        ? "Disable E-Mode"
        : `Set E-Mode ${action.newEmodeCategoryId}`;
    default:
      return action.type;
  }
}
