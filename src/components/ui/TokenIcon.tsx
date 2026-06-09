"use client";

import React, { useState } from "react";

interface TokenIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

const AAVE_ICONS_CDN =
  "https://app.aave.com/icons/tokens";

/**
 * Some Aave tokens have different icon names than their symbols.
 */
const SYMBOL_OVERRIDES: Record<string, string> = {
  WETH: "weth",
  WBTC: "wbtc",
  WMATIC: "wmatic",
  WAVAX: "wavax",
  WSTETH: "wsteth",
  CBETH: "cbeth",
  RETH: "reth",
  SDAI: "sdai",
  WEETH: "weeth",
  OSETH: "oseth",
  EZETH: "ezeth",
  RSETH: "rseth",
};

function getIconUrl(symbol: string): string {
  const key = symbol.toUpperCase();
  const name = SYMBOL_OVERRIDES[key] ?? symbol.toLowerCase();
  return `${AAVE_ICONS_CDN}/${name}.svg`;
}

const TokenIcon: React.FC<TokenIconProps> = ({
  symbol,
  size = 32,
  className = "",
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={getIconUrl(symbol)}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
      onError={() => setHasError(true)}
    />
  );
};

export default TokenIcon;
