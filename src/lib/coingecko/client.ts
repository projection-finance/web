import { CoinGeckoMarketChart } from "./types";
import { coinGeckoCache } from "./cache";

const BASE_URL = "https://api.coingecko.com/api/v3";
const PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3";

class CoinGeckoClient {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private get baseUrl(): string {
    return this.apiKey ? PRO_BASE_URL : BASE_URL;
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["x-cg-pro-api-key"] = this.apiKey;
    }

    const response = await fetch(url, { headers });

    if (response.status === 429) {
      // Rate limited — wait and retry once
      await new Promise((r) => setTimeout(r, 2000));
      return fetch(url, { headers });
    }

    return response;
  }

  /**
   * Get market chart data for a coin over a specified number of days.
   */
  async getMarketChart(
    coinId: string,
    vsCurrency: string = "usd",
    days: number | string = 30
  ): Promise<CoinGeckoMarketChart> {
    const cacheKey = `chart:${coinId}:${vsCurrency}:${days}`;
    const cached = coinGeckoCache.get<CoinGeckoMarketChart>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
    const response = await this.fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(
        `CoinGecko API error: ${response.status} ${response.statusText}`
      );
    }

    const data: CoinGeckoMarketChart = await response.json();
    coinGeckoCache.set(cacheKey, data);
    return data;
  }

  /**
   * Get market chart data for a specific date range.
   */
  async getMarketChartRange(
    coinId: string,
    vsCurrency: string = "usd",
    fromTimestamp: number,
    toTimestamp: number
  ): Promise<CoinGeckoMarketChart> {
    const cacheKey = `range:${coinId}:${vsCurrency}:${fromTimestamp}:${toTimestamp}`;
    const cached = coinGeckoCache.get<CoinGeckoMarketChart>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/coins/${coinId}/market_chart/range?vs_currency=${vsCurrency}&from=${fromTimestamp}&to=${toTimestamp}`;
    const response = await this.fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(
        `CoinGecko API error: ${response.status} ${response.statusText}`
      );
    }

    const data: CoinGeckoMarketChart = await response.json();
    coinGeckoCache.set(cacheKey, data);
    return data;
  }
}

let clientInstance: CoinGeckoClient | null = null;

export function getCoinGeckoClient(): CoinGeckoClient {
  if (clientInstance) return clientInstance;
  clientInstance = new CoinGeckoClient(process.env.COINGECKO_API_KEY);
  return clientInstance;
}
