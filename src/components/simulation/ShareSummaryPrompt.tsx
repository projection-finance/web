"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import {
  Share2,
  Sparkles,
  RefreshCw,
  X,
  Loader2,
} from "lucide-react";
import { AISummaryData } from "@/src/lib/ai/types";

interface ShareSummaryPromptProps {
  isOpen: boolean;
  onClose: () => void;
  existingSummary: AISummaryData | null;
  onShareWithSummary: (summary: AISummaryData | null) => Promise<void>;
  onOpenSummaryModal: () => void;
  isSharing: boolean;
}

export default function ShareSummaryPrompt({
  isOpen,
  onClose,
  existingSummary,
  onShareWithSummary,
  onOpenSummaryModal,
  isSharing,
}: ShareSummaryPromptProps) {
  const [includeAI, setIncludeAI] = useState<boolean | null>(null);

  const handleShareWithout = async () => {
    setIncludeAI(false);
    await onShareWithSummary(null);
    onClose();
  };

  const handleShareWith = async () => {
    setIncludeAI(true);
    await onShareWithSummary(existingSummary);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#5382E3]/10 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-[#5382E3]" />
            </div>
            <DialogTitle className="text-base">Share Projection</DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-3 space-y-3">
          {existingSummary ? (
            <>
              <p className="text-xs text-gray-500">
                You have an AI Summary available. Would you like to include it
                in the shared projection?
              </p>

              {/* Preview snippet */}
              <div className="bg-[#5382E3]/5 border border-[#5382E3]/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-[#5382E3]" />
                  <span className="text-[10px] font-medium text-[#5382E3] uppercase tracking-wider">
                    AI Summary Preview
                  </span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-3">
                  {existingSummary.content.slice(0, 200)}...
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  className="w-full text-xs gap-1.5 bg-[#5382E3]"
                  onClick={handleShareWith}
                  disabled={isSharing}
                >
                  {isSharing && includeAI ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Share with AI Summary
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs gap-1.5"
                    onClick={() => {
                      onClose();
                      onOpenSummaryModal();
                    }}
                    disabled={isSharing}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate Summary
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs gap-1.5"
                    onClick={handleShareWithout}
                    disabled={isSharing}
                  >
                    {isSharing && includeAI === false ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    Share without
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Would you like to add an AI-generated summary to your shared
                projection? It helps viewers understand your simulation at a
                glance.
              </p>

              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  className="w-full text-xs gap-1.5 bg-[#5382E3] hover:bg-[#4371D0]"
                  onClick={() => {
                    onClose();
                    onOpenSummaryModal();
                  }}
                  disabled={isSharing}
                >
                  <Sparkles className="w-3 h-3" />
                  Generate AI Summary First
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={handleShareWithout}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Share2 className="w-3 h-3" />
                  )}
                  Share without Summary
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
