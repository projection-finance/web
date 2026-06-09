const STABLECOIN_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "PYUSD", "FRAX", "GHO", "sDAI", "USDS",
  "crvUSD", "LUSD", "TUSD", "GUSD", "BUSD", "USDbC", "USDe", "sUSDe",
  "USD0", "USD0++", "DOLA", "eUSD", "mkUSD", "USDP",
]);

export function isMorphoStablecoin(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol);
}
