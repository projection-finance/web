export interface RecentWallet {
  address: string;
  ensName?: string;
  lastUsed: number;
}

export function getRecentWallets(): RecentWallet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("recentWallets");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentWallet(address: string, ensName?: string) {
  if (typeof window === "undefined") return;
  const recents = getRecentWallets().filter(
    (w) => w.address.toLowerCase() !== address.toLowerCase()
  );
  recents.unshift({ address: address.toLowerCase(), ensName, lastUsed: Date.now() });
  localStorage.setItem("recentWallets", JSON.stringify(recents.slice(0, 10)));
}
