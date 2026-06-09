"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AiOutlineLoading } from "react-icons/ai";
import { usePlan } from "@/src/hooks/usePlan";
import NetworkSelector from "./NetworkSelector";
import { NetworkId, DEFAULT_NETWORK, getNetworkById } from "@/src/lib/aave/networks";

// Real Aave CDP addresses for random selection
const AAVE_ADDRESSES = [
  "0x50fc9731dace42caa45d166bff404bbb7464bf21",
  "0x7cd0b7ed790f626ef1bd42db63b5ebeb5970c912",
  "0xfa5484533acf47bc9f5d9dc931fcdbbdcefb4011",
  "0x5be9a4959308a0d0c7bc0870e319314d8d957dbb",
  "0xabbd5b2b0b034781e58434736728b9d0673de7f1",
  "0xe40d278afd00e6187db21ff8c96d572359ef03bf",
  "0x0591926d5d3b9cc48ae6efb8db68025ddc3adfa5",
  "0xefad748654ec2c072b8735c010ae2fdea04aaf7d",
  "0xb3abe0777aa9685941e54744e704378b4b33eeaa",
  "0x7c697d6cff279f3f9c2401d0ea2ac7e7ede0e2c3",
  "0x99926ab8e1b589500ae87977632f13cf7f70f242",
  "0x64471d103a7f77262529383d53bdd28b260b1ae8",
  "0x989b96317735d70a7762bf96c034b203713aae18",
  "0xce344e5ad5bab578601cbf8ad103506588d38455",
  "0x96f49d0e9724dfd8780fa667ac37a993f005cb94",
  "0xc9db4e8d3d940c16b800d433d168d2f651025642",
  "0xe84a061897afc2e7ff5fb7e3686717c528617487",
  "0xfe99cc4664a939f826dbeb545c1aad4c89ee737a",
  "0x517ce9b6d1fcffd29805c3e19b295247fcd94aef",
  "0x6313f5be9371d39069a6070e74632c3d9782a0d7",
  "0x3b3f03015b479b734f41b77dd72851e676d0f406",
  "0x011b09fa6a0a508e0f11e4a97c50eed4d2c1a85c",
  "0x77a56647fba0eb60abb7395574cded565f6f94f6",
  "0x5130985ce6a0e54f369712cd6f2fdec084026e54",
  "0xa9f86d9eaf339305cd36e76bc0de7ac5b024f075",
  "0x37829fe9b8e67b8267c2058b9459f524b9e3ca5d",
  "0x9e30a1cb1bad5f4a4915390fee7b77213e36625b",
  "0x372cae7fa19b81a9786a9081704ea1e2dad576b7",
  "0x28a55c4b4f9615fde3cdaddf6cc01fcf2e38a6b0",
  "0xae9746a85f7e08cbfd08db00edf9b6c21f592fec",
  "0x8aecc5526f92a46718f8e68516d22038d8670e0d",
  "0x51b772d972424bfc358dd24a1662770bf0631059",
  "0xb7387e11060d14fe5db69880f24ce66d1f8cfe1a",
  "0x3ee301d27fd556eca7aaa8c50cdbd461577c42a6",
  "0x9fb1750da6266a05601855bb62767ebc742707b1",
  "0xab5a28b6ca2d1e12fe5acc7341352d5032b74438",
  "0x94e96e1b9b8c7ecf8ddb37a379e6bbeffa057c93",
  "0xd262b944e2effca0855c43023d3f1843b0ee6fb1",
  "0x8d09e2036595d150eb004cdbbb27a8cddcbe2e0d",
  "0xa3bcf996fd1cdd1f357b5a1eed0a39ceaaebd422",
  "0x59a661f1c909ca13ba3e9114bfdd81e5a420705d",
  "0x2574d2367c58a037604d79a5a6ddd5e13603cf12",
  "0xc26b5977c42c4fa2dd41750f8658f6bd2b67869c",
  "0x65c4c0517025ec0843c9146af266a2c5a2d148a2",
  "0x4d43aadee75419a4535400dee43690b5fe8c64e9",
  "0xff43c5727fbfc31cb96e605dfd7546eb8862064c",
  "0x33c0b106c459d86841e96d58db211ae8554132d2",
  "0x481c318efd1f3d8b29f688c2a5e40ef4a5db8b66",
  "0xc79b6416bd17446f930d32a7b78cf60d35a12be7",
  "0x8607a7d180de23645db594d90621d837749408d5",
  "0xee7ca610d896c53ffe716b801c05748efd902954",
  "0x236f968b3e9cc45d6d86bc95386a27c8051ab1ce",
  "0x2446beb3905cffbd2c5eb18f1f9c2996b05257c4",
  "0x834bd54eae7edd442637375b9be9ba2a9ad28389",
  "0xb20fb60e27a1be799b5e04159ec2024cc3734ed7",
  "0x487828727cc97172205faeb8d15b3ee5d9924599",
  "0xbb1aca5df175b5f0268fdd53e53c1bef3ced02c7",
  "0xd65fdb5eb1efd6a8859e619793d25c9357948568",
  "0xaf297dec752c909092a117a932a8ca4aaaff9795",
  "0x4debdd6cee25b2f931d2fe265d70e1a533b02453",
  "0x4f0eeb8d7797bd005fdf88fcc85b47aacc59cf36",
  "0x3e3868f5e6fd1b2c2b91b234436b46c0a5b1140c",
  "0xc3da51cc1063b3ceb44b041fd336ef6c74291fb0",
  "0x04c58ee5e5fc5f56a824184c5d88e94b7ca4aa76",
  "0xbbd01f9b63ae317c55b9a6837c51bb2b6394b5d5",
  "0x91cfbce901ebec39e5fcd4416893a5632b6da004",
  "0xb7fb2b774eb5e2dad9c060fb367acbdc7fa7099b",
];

function getRandomAddress(): string {
  return AAVE_ADDRESSES[Math.floor(Math.random() * AAVE_ADDRESSES.length)];
}

interface TrackWalletProps {
  isLoading: boolean;
  error: string;
  onFetch: (address: string, ensName?: string, network?: NetworkId) => void;
}

interface FavoriteWallet {
  id: string;
  address: string;
  label: string;
}

const TrackWallet = ({
  isLoading,
  error,
  onFetch,
}: TrackWalletProps) => {
  const { data: session } = useSession();
  const { features } = usePlan();
  const [ethAddress, setEthAddress] = useState<string>("");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>(DEFAULT_NETWORK);
  const [favorites, setFavorites] = useState<FavoriteWallet[]>([]);
  const [showAddFav, setShowAddFav] = useState(false);
  const [favLabel, setFavLabel] = useState("");
  const [favSaving, setFavSaving] = useState(false);

  const networkMeta = getNetworkById(selectedNetwork);
  const ensSupported = networkMeta?.supportsENS ?? false;

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorite-wallets");
      if (res.ok) setFavorites(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (session?.user && features.canSaveFavoriteWallets) fetchFavorites();
  }, [session?.user, features.canSaveFavoriteWallets, fetchFavorites]);

  const handleAddFavorite = async () => {
    if (!ethAddress.trim() || !favLabel.trim()) return;
    setFavSaving(true);
    try {
      const res = await fetch("/api/favorite-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: ethAddress.trim(), label: favLabel.trim() }),
      });
      if (res.ok) {
        await fetchFavorites();
        setShowAddFav(false);
        setFavLabel("");
      }
    } catch { /* silent */ }
    finally { setFavSaving(false); }
  };

  const handleRemoveFavorite = async (id: string) => {
    await fetch(`/api/favorite-wallets/${id}`, { method: "DELETE" });
    await fetchFavorites();
  };

  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const isENS = (input: string) => /^[a-zA-Z0-9-]+\.[a-z]{2,}$/.test(input.trim());

  const handleTrackWallet = async () => {
    if (!ethAddress) return;
    const trimmed = ethAddress.trim();

    if (isENS(trimmed)) {
      if (!ensSupported) {
        setResolveError("ENS names are only supported on Ethereum. Please enter a 0x address.");
        return;
      }
      setResolving(true);
      setResolveError("");
      try {
        const res = await fetch(`/api/resolve-ens?name=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          setResolveError("Could not resolve ENS name");
          return;
        }
        const data = await res.json();
        onFetch(data.address, trimmed, selectedNetwork);
      } catch {
        setResolveError("Failed to resolve ENS name");
      } finally {
        setResolving(false);
      }
      return;
    }

    onFetch(trimmed, undefined, selectedNetwork);
  };

  const handleRandomAddress = () => {
    const randomAddr = getRandomAddress();
    setEthAddress(randomAddr);
    onFetch(randomAddr, undefined, selectedNetwork);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && ethAddress) {
      handleTrackWallet();
    }
  };

  return (
    <div suppressHydrationWarning>
      {/* Network selector */}
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Network
      </label>
      <div className="mt-1.5 mb-4">
        <NetworkSelector selected={selectedNetwork} onChange={setSelectedNetwork} />
      </div>

      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {ensSupported ? "Wallet address or ENS name" : "Wallet address"}
      </label>
      <input
        type="text"
        className="w-full h-11 rounded-lg text-sm px-4 mt-1.5 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5382E3]/40 focus:border-[#5382E3] transition-colors"
        placeholder={ensSupported ? "0x... or vitalik.eth" : "0x..."}
        value={ethAddress}
        onChange={(e) => setEthAddress(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {(error || resolveError) && (
        <p className="text-xs text-red-500 mt-2">{error || resolveError}</p>
      )}

      <div className="flex gap-3 mt-5">
        <button
          onClick={handleTrackWallet}
          className={`flex-1 h-11 rounded-xl text-sm font-medium transition-colors ${
            ethAddress && !isLoading && !resolving
              ? "bg-[#5382E3] hover:bg-[#4270D0] text-white cursor-pointer"
              : "bg-blue-200 text-white cursor-not-allowed"
          }`}
          disabled={!ethAddress || isLoading || resolving}
        >
          {isLoading || resolving ? (
            <AiOutlineLoading className="animate-spin duration-400 mx-auto" />
          ) : (
            "View Position"
          )}
        </button>

        <button
          onClick={handleRandomAddress}
          className={`h-11 px-6 rounded-xl text-sm font-medium border transition-colors ${
            isLoading
              ? "border-gray-200 text-gray-300 cursor-not-allowed"
              : "border-[#5382E3] text-[#5382E3] cursor-pointer hover:bg-[#5382E3]/10"
          }`}
          disabled={isLoading}
        >
          Try a random wallet
        </button>
      </div>

      {/* Favorite wallets */}
      {session?.user && features.canSaveFavoriteWallets && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Favorites</span>
            {ethAddress.trim() && !showAddFav && (
              <button
                onClick={() => setShowAddFav(true)}
                className="text-[11px] text-[#5382E3] hover:underline"
              >
                + Save current
              </button>
            )}
          </div>

          {showAddFav && (
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={favLabel}
                onChange={(e) => setFavLabel(e.target.value)}
                placeholder="Label (e.g. My main wallet)"
                className="flex-1 h-8 text-xs border border-gray-200 rounded-lg px-2.5 focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
                onKeyDown={(e) => e.key === "Enter" && handleAddFavorite()}
              />
              <button
                onClick={handleAddFavorite}
                disabled={favSaving || !favLabel.trim()}
                className="h-8 px-3 text-xs font-medium rounded-lg bg-[#5382E3] text-white hover:bg-[#4270D0] disabled:opacity-50"
              >
                {favSaving ? "..." : "Save"}
              </button>
              <button
                onClick={() => { setShowAddFav(false); setFavLabel(""); }}
                className="h-8 px-2 text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          )}

          {favorites.length > 0 ? (
            <div className="space-y-1">
              {favorites.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 group cursor-pointer"
                  onClick={() => {
                    setEthAddress(w.address);
                    onFetch(w.address, undefined, selectedNetwork);
                  }}
                >
                  <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" viewBox="0 0 24 24">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="text-xs font-medium text-[#303549]">{w.label}</span>
                  <span className="text-[10px] text-gray-400 font-mono ml-auto">
                    {w.address.slice(0, 6)}...{w.address.slice(-4)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveFavorite(w.id); }}
                    className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-300 text-center py-1">
              No favorites yet — enter an address above and save it.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TrackWallet;
