"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Copy, ExternalLink, FolderOpen, Trash2 } from "lucide-react";
import { ProjectionSummary } from "@/src/hooks/useProjections";

interface LoadProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projections: ProjectionSummary[];
  onLoad: (p: ProjectionSummary) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
  currentProjectionId: string | null;
}

export default function LoadProjectionModal({
  isOpen,
  onClose,
  projections,
  onLoad,
  onDuplicate,
  onDelete,
  isLoading,
  currentProjectionId,
}: LoadProjectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#5382E3]/10 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-[#5382E3]" />
            </div>
            <DialogTitle className="text-base">Load Projection</DialogTitle>
            <span className="text-xs text-gray-400 ml-auto">
              {projections.length} saved
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 mt-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-lg border p-3">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-50 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : projections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FolderOpen className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-400">No saved projections yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {projections.map((p) => (
                <div
                  key={p.id}
                  className={`group rounded-lg border p-3 cursor-pointer transition-all hover:border-[#5382E3]/30 ${
                    currentProjectionId === p.id
                      ? "border-[#5382E3]/50 bg-[#5382E3]/5"
                      : "border-gray-100"
                  }`}
                  onClick={() => {
                    onLoad(p);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#303549] truncate">
                          {p.name}
                        </p>
                        {currentProjectionId === p.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5382E3]/10 text-[#5382E3] shrink-0">
                            current
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-gray-400 font-mono truncate max-w-[180px]">
                          {p.address ? `${p.address.slice(0, 6)}...${p.address.slice(-4)}` : "—"}
                        </span>
                        <span className="text-[11px] text-gray-300">
                          {new Date(p.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Open"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoad(p);
                          onClose();
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Duplicate"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(p.id);
                        }}
                      >
                        <Copy className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(p.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
