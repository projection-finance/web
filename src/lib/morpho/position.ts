import { MORPHO_API_URL } from "./config";
import type { MorphoPositionData, MorphoVaultPosition } from "./types";

const TIMEOUT_MS = 20_000;

const USER_QUERY = `
query UserByAddress($address: String!, $chainId: Int!) {
  userByAddress(address: $address, chainId: $chainId) {
    address
    vaultPositions {
      vault {
        name
        address
        state { netApy }
        asset { symbol decimals }
      }
      state {
        assetsUsd
        pnlUsd
      }
    }
    vaultV2Positions {
      vault {
        name
        address
        avgNetApy
        asset { symbol decimals }
      }
      assetsUsd
      pnlUsd
    }
  }
}`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(MORPHO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Morpho API ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Raw API response types ──

interface V1VaultPosition {
  vault: {
    name: string;
    address: string;
    state: { netApy: number };
    asset: { symbol: string; decimals: number };
  };
  state: {
    assetsUsd: number;
    pnlUsd: number;
  };
}

interface V2VaultPosition {
  vault: {
    name: string;
    address: string;
    avgNetApy: number;
    asset: { symbol: string; decimals: number };
  };
  assetsUsd: number;
  pnlUsd: number;
}

interface UserResponse {
  userByAddress: {
    address: string;
    vaultPositions: V1VaultPosition[];
    vaultV2Positions: V2VaultPosition[];
  } | null;
}

/**
 * Fetch all Morpho vault positions for a wallet on a given chain.
 */
export async function fetchMorphoPositions(
  address: string,
  chainId: number
): Promise<MorphoPositionData> {
  let data: UserResponse;
  try {
    data = await gql<UserResponse>(USER_QUERY, {
      address: address.toLowerCase(),
      chainId,
    });
  } catch (err) {
    // "NOT_FOUND" / "No results" is expected when user has no positions on a chain
    if (err instanceof Error && (err.message.includes("cannot find user") || err.message.includes("No results"))) {
      return { address, positions: [], totalDepositedUsd: 0, totalPnlUsd: 0 };
    }
    throw err;
  }

  const user = data.userByAddress;
  if (!user) {
    return { address, positions: [], totalDepositedUsd: 0, totalPnlUsd: 0 };
  }

  const positions: MorphoVaultPosition[] = [];

  // V2 addresses for dedup (V2 takes precedence)
  const v2Addresses = new Set(
    (user.vaultV2Positions ?? []).map((p) => p.vault.address.toLowerCase())
  );

  // V1 positions
  for (const p of user.vaultPositions ?? []) {
    if (v2Addresses.has(p.vault.address.toLowerCase())) continue;
    if (!p.state || p.state.assetsUsd <= 0) continue;

    positions.push({
      vaultName: p.vault.name,
      vaultAddress: p.vault.address,
      chainId,
      assetSymbol: p.vault.asset.symbol,
      assetDecimals: p.vault.asset.decimals,
      netApy: p.vault.state.netApy,
      depositedUsd: p.state.assetsUsd,
      pnlUsd: p.state.pnlUsd ?? 0,
      vaultVersion: "v1",
    });
  }

  // V2 positions
  for (const p of user.vaultV2Positions ?? []) {
    if (p.assetsUsd <= 0) continue;

    positions.push({
      vaultName: p.vault.name,
      vaultAddress: p.vault.address,
      chainId,
      assetSymbol: p.vault.asset.symbol,
      assetDecimals: p.vault.asset.decimals,
      netApy: p.vault.avgNetApy,
      depositedUsd: p.assetsUsd,
      pnlUsd: p.pnlUsd ?? 0,
      vaultVersion: "v2",
    });
  }

  const totalDepositedUsd = positions.reduce((sum, p) => sum + p.depositedUsd, 0);
  const totalPnlUsd = positions.reduce((sum, p) => sum + p.pnlUsd, 0);

  return { address, positions, totalDepositedUsd, totalPnlUsd };
}

/**
 * Fetch positions across all supported Morpho chains and merge.
 */
export async function fetchMorphoPositionsAllChains(
  address: string
): Promise<MorphoPositionData> {
  const chainIds = [1, 8453]; // Ethereum + Base

  const results = await Promise.all(
    chainIds.map((chainId) => fetchMorphoPositions(address, chainId))
  );

  const positions = results.flatMap((r) => r.positions);
  const totalDepositedUsd = positions.reduce((sum, p) => sum + p.depositedUsd, 0);
  const totalPnlUsd = positions.reduce((sum, p) => sum + p.pnlUsd, 0);

  return { address, positions, totalDepositedUsd, totalPnlUsd };
}
