"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Copy, FolderOpen, Trash2 } from "lucide-react";
import { TokenProjectionSave } from "@/src/hooks/useTokenProjectionSaves";
import { formatUSD } from "@/src/lib/format";

interface TokenLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  saves: TokenProjectionSave[];
  onLoad: (save: TokenProjectionSave) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  currentId: string | null;
}

export default function TokenLoadModal({
  isOpen, onClose, saves, onLoad, onDuplicate, onDelete, currentId,
}: TokenLoadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#4F7FFA]/10 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-[#4F7FFA]" />
            </div>
            <DialogTitle className="text-base">Load Token Projection</DialogTitle>
            <span className="text-xs text-gray-400 ml-auto">{saves.length} saved</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 mt-2">
          {saves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FolderOpen className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-400">No saved token projections yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {saves.map((s) => {
                const totalValue = s.holdings.reduce((sum, h) => sum + h.quantity * h.currentPriceUSD, 0);
                return (
                  <div
                    key={s.id}
                    className={`group rounded-lg border p-3 cursor-pointer transition-all hover:border-[#4F7FFA]/30 ${
                      currentId === s.id ? "border-[#4F7FFA]/50 bg-[#4F7FFA]/5" : "border-gray-100"
                    }`}
                    onClick={() => { onLoad(s); onClose(); }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#303549] truncate">{s.name}</p>
                          {currentId === s.id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4F7FFA]/10 text-[#4F7FFA] shrink-0">
                              current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-gray-400">
                            {s.holdings.length} token{s.holdings.length !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[11px] text-gray-300">·</span>
                          <span className="text-[11px] text-gray-400">
                            ${formatUSD(totalValue)}
                          </span>
                          <span className="text-[11px] text-gray-300">·</span>
                          <span className="text-[11px] text-gray-400">
                            {s.actions.length} action{s.actions.length !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[11px] text-gray-300">·</span>
                          <span className="text-[11px] text-gray-300">
                            {new Date(s.updatedAt).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {s.details && (
                          <p className="text-[10px] text-gray-400 mt-1 truncate">{s.details}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Duplicate"
                          onClick={(e) => { e.stopPropagation(); onDuplicate(s.id); }}>
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Delete"
                          onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}>
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
