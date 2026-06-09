"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TokenPortfolio from "@/src/components/tokens/TokenPortfolio";

const TokensContent = () => {
  const searchParams = useSearchParams();
  const projectionParam = searchParams.get("projection");

  return (
    <div className="flex-1 w-full">
      <TokenPortfolio projectionId={projectionParam ?? undefined} />
    </div>
  );
};

const TokensPage = () => {
  return (
    <Suspense>
      <TokensContent />
    </Suspense>
  );
};

export default TokensPage;
