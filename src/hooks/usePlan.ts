"use client";

import { PLAN_LIMITS, type PlanType, type PlanFeatures } from "@/src/lib/plan";

// Projection Finance is fully open-source and free — every user has full access.
export function usePlan() {
  const plan: PlanType = "pro";
  const features: PlanFeatures = PLAN_LIMITS.pro;

  return { plan, isPro: true, isFree: false, features };
}
