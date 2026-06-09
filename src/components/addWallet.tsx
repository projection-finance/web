"use client";

import { useState } from "react";
import ConnectWallet from "./connectWallet";
import { AiOutlineLoading } from "react-icons/ai";
import { Wallet } from "../utils/types/wallets";

const AddWallet = ({ wallets }: { wallets: Wallet[] }) => {
  const [isAddWalletVisible, setIsAddWalletVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [addressInput, setAddressInput] = useState<string>("");

  const handleShowAddWallet = () => {
    setIsAddWalletVisible(true);
  };

  const handleSubmitWallet = async () => {
    setIsLoading(true);

    const newWallet = {
      address: addressInput,
      name: `New Wallet ${wallets.length + 1}`,
      snapshotPosition: {
        netWorth: 0.0,
        netAPY: 0.0,
        totalCollateral: 0.0,
        totalBorrow: 0.0,
        availableForBorrow: 0.0,
        healthFactor: 0.0,
        lv: 0.0,
      },
      supplies: [],
      borrows: [],
      assetsToSupply: [],
      assetsToBorrow: [],
      projectionTimeline: [],
    };

    try {
      const response = await fetch("http://localhost:8000/users/1");
      const user = await response.json();

      if (!response.ok || !user) {
        throw new Error("User not found or is empty");
      }

      const updateResponse = await fetch("http://localhost:8000/users/1", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...user,
          wallets: [...user.wallets, newWallet],
        }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update user wallets");
      }

      setAddressInput("");
      setIsAddWalletVisible(false);
      window.location.reload();
    } catch (error) {
      console.error("Error adding wallet:", error);
      alert("There was an error adding the wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return wallets.length === 0 && !isAddWalletVisible ? (
    <ConnectWallet handleShowAddWallet={handleShowAddWallet} />
  ) : (
    <div className="w-1/2">
      <p className="text-xl font-bold">Add your wallet</p>
      <p className="mb-8">Fill in form to connect to your wallet below</p>

      <p className="my-3">Wallet address</p>
      <div>
        <input
          type="text"
          className="w-full h-10 rounded-lg text-sm p-3 border border-gray-300  focus:outline-sky-400"
          placeholder="0x... Or ENS"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
        />

        <button
          onClick={handleSubmitWallet}
          className={`${
            addressInput
              ? "bg-[#5382E3] cursor-pointer"
              : "bg-blue-200 cursor-not-allowed"
          } px-9 py-3 rounded-xl text-white mt-10`}
          disabled={!addressInput}
        >
          {isLoading ? (
            <AiOutlineLoading className="animate-spin duration-400" />
          ) : (
            "Submit"
          )}
        </button>
      </div>
    </div>
  );
};

export default AddWallet;
