import { ethers } from "ethers";
import { NetworkId, getNetworkById } from "@/src/lib/aave/networks";
import { createMonitoredProvider } from "@/src/lib/rpc-monitor";
import { TokenHolding } from "./types";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";

const BASE_URL = "https://api.coingecko.com/api/v3";
const PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3";

function cgHeaders(): Record<string, string> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const h: Record<string, string> = { Accept: "application/json" };
  if (apiKey) h["x-cg-pro-api-key"] = apiKey;
  return h;
}

function cgBase(): string {
  return process.env.COINGECKO_API_KEY ? PRO_BASE_URL : BASE_URL;
}

/** CoinGecko platform IDs per network */
const COINGECKO_PLATFORM: Partial<Record<NetworkId, string>> = {
  ETHEREUM_V3: "ethereum",
  ARBITRUM_V3: "arbitrum-one",
  BASE_V3: "base",
  OPTIMISM_V3: "optimistic-ethereum",
  POLYGON_V3: "polygon-pos",
  AVALANCHE_V3: "avalanche",
  BNB_V3: "binance-smart-chain",
  SCROLL_V3: "scroll",
  ZKSYNC_V3: "zksync",
  LINEA_V3: "linea",
  GNOSIS_V3: "xdai",
  METIS_V3: "metis-andromeda",
  SONIC_V3: "sonic",
  CELO_V3: "celo",
  MANTLE_V3: "mantle",
  SPARK_V3: "ethereum",
};

/** CoinGecko native coin IDs per network */
const NATIVE_COIN_ID: Partial<Record<NetworkId, string>> = {
  ETHEREUM_V3: "ethereum",
  ARBITRUM_V3: "ethereum",
  BASE_V3: "ethereum",
  OPTIMISM_V3: "ethereum",
  POLYGON_V3: "matic-network",
  AVALANCHE_V3: "avalanche-2",
  BNB_V3: "binancecoin",
  SCROLL_V3: "ethereum",
  ZKSYNC_V3: "ethereum",
  LINEA_V3: "ethereum",
  GNOSIS_V3: "xdai",
  SONIC_V3: "sonic-3",
  MANTLE_V3: "mantle",
  SONEIUM_V3: "ethereum",
  INK_V3: "ethereum",
  SPARK_V3: "ethereum",
};

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

interface AlchemyTokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
}

export interface WalletScanResult {
  holdings: TokenHolding[];
  address: string;
  network: NetworkId;
  totalValueUSD: number;
}

/**
 * Scan a wallet's ERC-20 + native token holdings on a given network.
 * Returns up to 20 tokens worth >= $1 each, sorted by value descending.
 */
export async function scanWalletTokens(
  address: string,
  networkId: NetworkId
): Promise<WalletScanResult> {
  const network = getNetworkById(networkId);
  if (!network) throw new Error(`Unknown network: ${networkId}`);

  const rpcUrl = `https://${network.alchemySlug}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = createMonitoredProvider(rpcUrl, networkId);

  // 1. Fetch all token balances via Alchemy
  const [nativeBalance, tokenBalancesResult] = await Promise.all([
    network.nativeSymbol ? provider.getBalance(address) : Promise.resolve(null),
    provider.send("alchemy_getTokenBalances", [address, "erc20"]),
  ]);

  // 2. Filter non-zero balances
  const nonZeroBalances: AlchemyTokenBalance[] = (
    tokenBalancesResult.tokenBalances || []
  ).filter(
    (tb: AlchemyTokenBalance) =>
      tb.tokenBalance && tb.tokenBalance !== "0x" && tb.tokenBalance !== "0x0"
  );

  // 3. Fetch metadata for non-zero tokens (batch)
  const metadataPromises = nonZeroBalances.map((tb) =>
    provider
      .send("alchemy_getTokenMetadata", [tb.contractAddress])
      .catch(() => null)
  );
  const metadataResults: (AlchemyTokenMeta | null)[] =
    await Promise.all(metadataPromises);

  // 4. Build raw token list with human-readable balances
  interface RawToken {
    contractAddress: string;
    symbol: string;
    name: string;
    decimals: number;
    logo: string | null;
    quantity: number;
  }

  const rawTokens: RawToken[] = [];

  for (let i = 0; i < nonZeroBalances.length; i++) {
    const meta = metadataResults[i];
    if (!meta || !meta.symbol || meta.decimals === undefined) continue;

    const rawBalance = ethers.BigNumber.from(nonZeroBalances[i].tokenBalance);
    const quantity = Number(ethers.utils.formatUnits(rawBalance, meta.decimals));
    if (quantity <= 0) continue;

    rawTokens.push({
      contractAddress: nonZeroBalances[i].contractAddress.toLowerCase(),
      symbol: meta.symbol.toUpperCase(),
      name: meta.name || meta.symbol,
      decimals: meta.decimals,
      logo: meta.logo,
      quantity,
    });
  }

  // 5. Add native token
  if (nativeBalance && network.nativeSymbol) {
    const nativeQty = Number(ethers.utils.formatEther(nativeBalance));
    if (nativeQty > 0) {
      rawTokens.push({
        contractAddress: "native",
        symbol: network.nativeSymbol,
        name: network.nativeSymbol,
        decimals: 18,
        logo: null,
        quantity: nativeQty,
      });
    }
  }

  if (rawTokens.length === 0) {
    return { holdings: [], address, network: networkId, totalValueUSD: 0 };
  }

  // 6. Get prices via CoinGecko contract lookup
  const platform = COINGECKO_PLATFORM[networkId];
  const nativeCoinId = NATIVE_COIN_ID[networkId];

  // Split into contract tokens and native
  const contractTokens = rawTokens.filter((t) => t.contractAddress !== "native");
  const nativeToken = rawTokens.find((t) => t.contractAddress === "native");

  // Fetch contract-based prices
  const priceMap = new Map<string, { usd: number; coingeckoId: string; image: string }>();

  if (platform && contractTokens.length > 0) {
    // CoinGecko allows up to 100 contract addresses per request
    const batchSize = 100;
    for (let i = 0; i < contractTokens.length; i += batchSize) {
      const batch = contractTokens.slice(i, i + batchSize);
      const addresses = batch.map((t) => t.contractAddress).join(",");

      try {
        const res = await fetch(
          `${cgBase()}/simple/token_price/${platform}?contract_addresses=${encodeURIComponent(addresses)}&vs_currencies=usd&include_24hr_change=false`,
          { headers: cgHeaders() }
        );
        if (res.ok) {
          const data: Record<string, { usd?: number }> = await res.json();
          for (const [addr, info] of Object.entries(data)) {
            if (info.usd && info.usd > 0) {
              priceMap.set(addr.toLowerCase(), {
                usd: info.usd,
                coingeckoId: "", // Will resolve below
                image: "",
              });
            }
          }
        }
      } catch {
        // continue without prices for this batch
      }
    }

    // Resolve coingecko IDs + images for tokens that have prices
    // Use coins/contract endpoint for each token with a price
    const pricedAddresses = [...priceMap.keys()];
    const idPromises = pricedAddresses.map(async (addr) => {
      try {
        const res = await fetch(
          `${cgBase()}/coins/${platform}/contract/${addr}`,
          { headers: cgHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          priceMap.set(addr, {
            ...priceMap.get(addr)!,
            coingeckoId: data.id || "",
            image: data.image?.small || data.image?.thumb || "",
          });
        }
      } catch {
        // skip
      }
    });
    await Promise.all(idPromises);
  }

  // Fetch native token price + info
  if (nativeToken && nativeCoinId) {
    try {
      const res = await fetch(
        `${cgBase()}/coins/${nativeCoinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
        { headers: cgHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        priceMap.set("native", {
          usd: data.market_data?.current_price?.usd ?? 0,
          coingeckoId: data.id || nativeCoinId,
          image: data.image?.small || data.image?.thumb || "",
        });
      }
    } catch {
      // skip
    }
  }

  // 7. Build holdings with value filter
  const holdings: (TokenHolding & { valueUSD: number })[] = [];

  for (const token of rawTokens) {
    const priceInfo = priceMap.get(token.contractAddress);
    if (!priceInfo || !priceInfo.usd || !priceInfo.coingeckoId) continue;

    const valueUSD = token.quantity * priceInfo.usd;
    if (valueUSD < 1) continue;

    holdings.push({
      coingeckoId: priceInfo.coingeckoId,
      symbol: token.symbol,
      name: token.name,
      image: priceInfo.image || undefined,
      quantity: token.quantity,
      currentPriceUSD: priceInfo.usd,
      valueUSD,
    });
  }

  // 8. Sort by value descending, limit to 20
  holdings.sort((a, b) => b.valueUSD - a.valueUSD);
  const top20 = holdings.slice(0, 20);

  const totalValueUSD = top20.reduce((sum, h) => sum + h.valueUSD, 0);

  // Strip the temporary valueUSD field
  const finalHoldings: TokenHolding[] = top20.map(
    ({ coingeckoId, symbol, name, image, quantity, currentPriceUSD }) => ({
      coingeckoId,
      symbol,
      name,
      image,
      quantity,
      currentPriceUSD,
    })
  );

  return { holdings: finalHoldings, address, network: networkId, totalValueUSD };
}
