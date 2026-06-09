"use client";

import { useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown, Save, FolderOpen, Share2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";

interface ProjectionTimelineWrapperProps {
  /** The chart + any inline content (duration selector, action scheduler) */
  children: ReactNode;
  /** Whether the simulation is currently running */
  isRunning?: boolean;
  /** Whether the simulation has results */
  hasResult?: boolean;
  /** Selected day index (shown in collapsed header) */
  selectedDay?: number | null;
  /** Empty state message when no results */
  emptyMessage?: string;

  // ── Toolbar actions (optional — buttons only shown if handler provided) ──
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  unsavedChanges?: number;

  onLoad?: () => void;
  onShare?: () => void;
  shareLoading?: boolean;
  shareCopied?: boolean;

  onAISummary?: () => void;
  hasAISummary?: boolean;

  /** Protocol-specific extra toolbar buttons */
  extraToolbarButtons?: ReactNode;

  /** Start collapsed? Default true */
  defaultCollapsed?: boolean;
}

/**
 * Full-width fixed-bottom collapsible "Projection Timeline" section.
 * Used across all protocol dashboards for consistent chart layout.
 */
export default function ProjectionTimelineWrapper({
  children,
  isRunning = false,
  hasResult = false,
  selectedDay = null,
  emptyMessage = "Loading projection...",
  onSave,
  isSaving = false,
  saveLabel,
  unsavedChanges = 0,
  onLoad,
  onShare,
  shareLoading = false,
  shareCopied = false,
  onAISummary,
  hasAISummary = false,
  extraToolbarButtons,
  defaultCollapsed = true,
}: ProjectionTimelineWrapperProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-300 bg-[#F5F5FA]">
      <div className="px-6 py-2">
        {/* Header — always visible, acts as toggle */}
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setCollapsed((c) => !c)}
        >
          <div className="flex items-center gap-2">
            {collapsed ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
            <p className="text-sm font-semibold text-[#303549]">
              Projection Timeline
            </p>
            {isRunning && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
            {collapsed && selectedDay !== null && (
              <span className="text-xs text-slate-400 ml-1">
                {new Date(Date.now() + selectedDay * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })} (D{selectedDay})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {/* Save */}
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6 gap-1 relative"
                onClick={onSave}
                disabled={isSaving}
              >
                <Save className="w-3 h-3" />
                {isSaving ? "..." : saveLabel || "Save as"}
                {unsavedChanges > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#5382E3] text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                    {unsavedChanges > 9 ? "9+" : unsavedChanges}
                  </span>
                )}
              </Button>
            )}

            {/* AI Summary */}
            {onAISummary && hasResult && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6 gap-1"
                onClick={onAISummary}
              >
                <Sparkles className="w-3 h-3 text-[#5382E3]" />
                {hasAISummary ? "Summary" : "AI Summary"}
              </Button>
            )}

            {/* Share */}
            {onShare && hasResult && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6 gap-1"
                disabled={shareLoading}
                onClick={onShare}
              >
                <Share2 className="w-3 h-3" />
                {shareLoading ? "..." : shareCopied ? "Copied!" : "Share"}
              </Button>
            )}

            {/* Load */}
            {onLoad && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6 gap-1"
                onClick={onLoad}
              >
                <FolderOpen className="w-3 h-3" />
                Load
              </Button>
            )}

            {/* Protocol-specific extra buttons */}
            {extraToolbarButtons}
          </div>
        </div>

        {/* Content — collapsible */}
        {!collapsed && (
          <div className="mt-1">
            {hasResult ? (
              children
            ) : (
              <div className="flex items-center justify-center text-gray-400" style={{ height: 80 }}>
                <p className="text-sm">{emptyMessage}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Utility: returns the CSS class for bottom padding on the main content container.
 * Call with the collapsed state to get the right padding.
 */
export function timelinePadding(collapsed: boolean): string {
  return collapsed ? "pb-[60px]" : "pb-[360px]";
}
