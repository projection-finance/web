export type PlanType = "free" | "pro";

// Projection Finance is fully open-source and free.
// Every capability is unlimited for every user — there is no paid tier.
const UNLIMITED = {
  maxInstantActions: Infinity,
  maxProjectionDays: 365,
  maxPriceTokens: Infinity,
  maxCustomTokens: Infinity,
  maxSandboxTokens: Infinity,
  canUseRateScenarios: true,
  canScheduleActions: true,
  canSaveProjections: true,
  canSaveSandboxProjections: true,
  canAutoSave: true,
  canSaveFavoriteWallets: true,
  canUseAI: true,
} as const;

export const PLAN_LIMITS = {
  free: UNLIMITED,
  pro: UNLIMITED,
} as const;

export type PlanFeatures = typeof UNLIMITED;

export function getPlanFeatures(plan?: PlanType): PlanFeatures {
  void plan;
  return UNLIMITED;
}

export async function getUserPlan(): Promise<{
  plan: PlanType;
  features: PlanFeatures;
}> {
  return { plan: "pro", features: UNLIMITED };
}
