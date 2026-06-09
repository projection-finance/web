import { FormattedReserve } from "./types";

export type EmodeCategoryAsset = {
  underlyingAsset: string;
  symbol: string;
  collateral: boolean;
  borrowable: boolean;
};

export type EmodeCategory = {
  id: number;
  label: string;
  ltv: string;
  liquidationThreshold: string;
  liquidationBonus: string;
  assets: EmodeCategoryAsset[];
};

/**
 * Build EmodeCategory[] from enriched formattedPoolReserves.
 *
 * After passing `eModes` to `formatReservesAndIncentives()`, each reserve has
 * an `eModes` array of `{ id, eMode: { label, ltv, ... }, collateralEnabled, borrowingEnabled }`.
 *
 * If reserves lack the `eModes` array (pre-V3.1 or missing fetch), falls back to
 * the legacy `eModeCategoryId` field per reserve.
 *
 * Always includes category 0 (disabled / no E-Mode).
 */
export function formatEmodeCategories(
  formattedPoolReserves: FormattedReserve[]
): EmodeCategory[] {
  const categoryMap = new Map<number, EmodeCategory>();

  // Category 0 = disabled
  categoryMap.set(0, {
    id: 0,
    label: "None",
    ltv: "0",
    liquidationThreshold: "0",
    liquidationBonus: "0",
    assets: [],
  });

  for (const reserve of formattedPoolReserves) {
    const symbol = reserve.symbol as string;
    const underlyingAsset = reserve.underlyingAsset as string;
    if (!underlyingAsset) continue;

    // Try the new eModes array first (from formatReservesAndIncentives with eModes param)
    const reserveEModes = reserve.eModes as
      | Array<{
          id: number;
          eMode: {
            label: string;
            ltv: string;
            liquidationThreshold: string;
            liquidationBonus: string;
          };
          collateralEnabled: boolean;
          borrowingEnabled: boolean;
        }>
      | undefined;

    if (reserveEModes && reserveEModes.length > 0) {
      for (const em of reserveEModes) {
        if (em.id === 0) continue;

        if (!categoryMap.has(em.id)) {
          categoryMap.set(em.id, {
            id: em.id,
            label: em.eMode.label || `E-Mode ${em.id}`,
            ltv: em.eMode.ltv,
            liquidationThreshold: em.eMode.liquidationThreshold,
            liquidationBonus: em.eMode.liquidationBonus,
            assets: [],
          });
        }

        const cat = categoryMap.get(em.id)!;
        // Avoid duplicates
        if (!cat.assets.some((a) => a.underlyingAsset === underlyingAsset)) {
          cat.assets.push({
            underlyingAsset,
            symbol,
            collateral: em.collateralEnabled,
            borrowable: em.borrowingEnabled,
          });
        }
      }
    } else {
      // Legacy fallback: use eModeCategoryId per reserve
      const catId = Number(reserve.eModeCategoryId || 0);
      if (catId === 0) continue;

      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          label: (reserve.eModeLabel as string) || `E-Mode ${catId}`,
          ltv: String(reserve.eModeLtv || "0"),
          liquidationThreshold: String(
            reserve.eModeLiquidationThreshold || "0"
          ),
          liquidationBonus: String(reserve.eModeLiquidationBonus || "0"),
          assets: [],
        });
      }

      const cat = categoryMap.get(catId)!;
      if (!cat.assets.some((a) => a.underlyingAsset === underlyingAsset)) {
        cat.assets.push({
          underlyingAsset,
          symbol,
          collateral: true,
          borrowable: true,
        });
      }
    }
  }

  return Array.from(categoryMap.values()).sort((a, b) => a.id - b.id);
}

/**
 * Check if switching to a target E-Mode category is allowed given the user's
 * current borrows. All current borrows must be borrowable in the target category.
 *
 * Switching to category 0 (disable E-Mode) is always allowed.
 */
export function isEModeAvailable(
  targetCategoryId: number,
  categories: EmodeCategory[],
  userBorrows: Array<{ underlyingAsset: string; symbol?: string }>
): { available: boolean; reason?: string } {
  if (targetCategoryId === 0) return { available: true };

  const category = categories.find((c) => c.id === targetCategoryId);
  if (!category) return { available: false, reason: "Category not found" };

  if (userBorrows.length === 0) return { available: true };

  const borrowableAssets = new Set(
    category.assets
      .filter((a) => a.borrowable)
      .map((a) => a.underlyingAsset)
  );

  for (const borrow of userBorrows) {
    if (!borrowableAssets.has(borrow.underlyingAsset)) {
      // Prefer the symbol from the borrow itself, then look in category assets
      const symbol =
        borrow.symbol ??
        category.assets.find(
          (a) => a.underlyingAsset === borrow.underlyingAsset
        )?.symbol ??
        borrow.underlyingAsset;
      return {
        available: false,
        reason: `${symbol} is not borrowable in this E-Mode category`,
      };
    }
  }

  return { available: true };
}

/**
 * Return the list of underlyingAsset addresses that are borrowable in a given
 * E-Mode category. Returns empty array for category 0 (no restriction).
 */
export function getBorrowableAssetsInEMode(
  categoryId: number,
  categories: EmodeCategory[]
): string[] {
  if (categoryId === 0) return [];

  const category = categories.find((c) => c.id === categoryId);
  if (!category) return [];

  return category.assets
    .filter((a) => a.borrowable)
    .map((a) => a.underlyingAsset);
}

/**
 * Heuristic: an asset is a "stablecoin" if it belongs to any E-Mode category
 * whose label contains "stable" (case-insensitive).
 */
export function isStablecoin(
  symbol: string,
  categories: EmodeCategory[]
): boolean {
  return categories.some(
    (cat) =>
      /stable/i.test(cat.label) &&
      cat.assets.some((a) => a.symbol === symbol)
  );
}
