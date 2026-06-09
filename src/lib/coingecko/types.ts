export interface CoinGeckoMarketChart {
  prices: [number, number][]; // [timestamp_ms, price]
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface CoinGeckoHistoricalPrice {
  timestamp: number;
  price: number;
}

export interface CoinGeckoSimplePrice {
  [coinId: string]: {
    usd: number;
  };
}
