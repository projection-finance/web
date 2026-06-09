import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { AssetsToSupply } from "../utils/types/wallets";
import { Button } from "./ui/button";

interface SupplyModalProps {
  isOpen: boolean;
  asset: AssetsToSupply | null;
  onClose: () => void;
}

const SupplyModal: React.FC<SupplyModalProps> = ({
  isOpen,
  asset,
  onClose,
}) => {
  if (!asset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[#303549] font-semibold text-center">
            Supply DAI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Current Date Info */}
          <div className="flex justify-between items-center bg-[#F0F0F0] px-[14px] py-[6px] rounded-md">
            <p className="text-[16px] text-[#303549] font-medium">
              Current date
            </p>
            <p className="text-sm font-normal text-[#939393]">
              23 December 2024, 10:00 AM
            </p>
          </div>

          {/* Asset and Balance Info */}
          <div className="p-4 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg space-y-2">
            <div className="flex justify-between">
              <p className="text-lg text-[#303549] font-medium">535.00</p>
              <p className="text-lg text-[#303549]">$537.25</p>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <p className="text-[16px] text-[#303549] font-normal">
                Balance: 10,539.48
                <span className="text-[#4F7FFA] text-[16px] font-medium mx-2 cursor-pointer">
                  Max
                </span>
              </p>
              <p className="text-[16px] text-[#303549] font-normal">
                $10,539.48
              </p>
            </div>
          </div>

          {/* Additional Details */}
          <div className="space-y-3 p-3 bg-[#FBFBFB] border border-[#E2E2E2] rounded-lg">
            <div className="flex justify-between">
              <p className="text-[16px] text-[#303549] font-medium">
                Collateralization
              </p>
              <p className="text-[16px] font-normal text-[#303549]">Enabled</p>
            </div>
            <div className="flex justify-between">
              <p className="text-[16px] text-[#303549] font-medium">
                Supply APY
              </p>
              <p className="text-[16px] font-normal text-[#303549]">
                0.75% &gt; 0.75%
              </p>
            </div>
            <div className="flex justify-between">
              <p className="text-[16px] text-[#303549] font-medium">
                Rewards APR
              </p>
              <p className="text-[16px] font-normal text-[#303549]">
                5.9% &gt; 6.2%
              </p>
            </div>
            <div className="flex justify-between">
              <p className="text-[16px] text-[#303549] font-medium">
                Health factor
              </p>
              <p className="text-[16px] font-normal text-[#303549]">
                8.72% &gt; 8.73%
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-between gap-4">
            <Button className="bg-[#4F7FFA] text-[16px] font-medium leading-[24px] tracking-[0%] hover:bg-mute w-1/2">
              Supply
            </Button>
            <Button
              variant="outline"
              className="text-[16px] font-medium leading-[24px] tracking-[0%] w-1/2"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupplyModal;
