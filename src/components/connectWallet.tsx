const ConnectWallet = ({
  handleShowAddWallet,
}: {
  handleShowAddWallet: () => void;
}) => {
  return (
    <div>
      <p className="text-xl font-bold">Please, connect your wallet</p>
      <p className="text-sm font-light mt-2">
        Please connect your wallet to see your supplies, borrowings, and open
        positions
      </p>
      <button
        className="bg-bluePrimary cursor-pointer px-9 py-3 rounded-xl text-white mt-10"
        onClick={handleShowAddWallet}
      >
        Connect Wallet
      </button>
    </div>
  );
};

export default ConnectWallet;
