"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import {
  Sparkles,
  RefreshCw,
  Save,
  Lock,
  Globe,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { AISummaryData, AISummaryRequest, AI_MODELS, AIModel } from "@/src/lib/ai/types";
import { useAISummary } from "@/src/hooks/useAISummary";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Francais" },
  { code: "es", label: "Espanol" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Portugues" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "tr", label: "Turkish" },
];

interface AISummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSummary: AISummaryData | null;
  onSave: (summary: AISummaryData) => void;
  buildRequest: (language: string, model?: AIModel) => AISummaryRequest;
  readOnly?: boolean;
}

export default function AISummaryModal({
  isOpen,
  onClose,
  existingSummary,
  onSave,
  buildRequest,
  readOnly = false,
}: AISummaryModalProps) {
  const [language, setLanguage] = useState(existingSummary?.language || "en");
  const [model, setModel] = useState<AIModel>(
    existingSummary?.model || AI_MODELS[0].id
  );
  const [copied, setCopied] = useState(false);

  const {
    summary,
    isGenerating,
    statusMessage,
    error,
    isLocked,
    maxReloads,
    generate,
    cancel,
    loadExisting,
  } = useAISummary();

  useEffect(() => {
    if (isOpen) {
      loadExisting(existingSummary);
      if (existingSummary?.language) setLanguage(existingSummary.language);
      if (existingSummary?.model) setModel(existingSummary.model);
    }
  }, [isOpen, existingSummary, loadExisting]);

  const handleGenerate = async () => {
    const request = buildRequest(language, model);
    const result = await generate(request, summary || existingSummary);
    if (result) onSave(result);
  };

  const handleCopy = () => {
    const content = summary?.content || existingSummary?.content;
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayContent = summary?.content || existingSummary?.content;
  const reloadCount = summary?.reloadCount ?? existingSummary?.reloadCount ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#5382E3]/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#5382E3]" />
            </div>
            <DialogTitle className="text-base">AI Summary</DialogTitle>
            {displayContent && !isGenerating && (
              <button
                onClick={handleCopy}
                className="ml-auto mr-2 p-1 rounded hover:bg-gray-100 transition-colors"
                title="Copy summary"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Controls */}
        {!readOnly && (
          <div className="flex items-end gap-3 mt-2">
            <div className="space-y-1 flex-1">
              <Label className="text-[10px] text-gray-400 uppercase tracking-wider">
                <Globe className="w-3 h-3 inline mr-1" />
                Language
              </Label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isGenerating}
                className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white text-[#303549] focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 flex-1">
              <Label className="text-[10px] text-gray-400 uppercase tracking-wider">
                Model
              </Label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isGenerating}
                className="w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white text-[#303549] focus:outline-none focus:ring-1 focus:ring-[#5382E3]"
              >
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-[#5382E3] hover:bg-[#4371D0] shrink-0"
              onClick={handleGenerate}
              disabled={isGenerating || isLocked}
            >
              {isGenerating ? (
                <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
              ) : isLocked ? (
                <><Lock className="w-3 h-3" />Locked</>
              ) : displayContent ? (
                <><RefreshCw className="w-3 h-3" />Regenerate</>
              ) : (
                <><Sparkles className="w-3 h-3" />Generate</>
              )}
            </Button>
          </div>
        )}

        {/* Reload counter */}
        {!readOnly && (displayContent || isGenerating) && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400">
              {reloadCount}/{maxReloads} regenerations used
            </span>
            {isLocked && (
              <span className="text-[10px] text-amber-500 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Max regenerations reached
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-md mt-2">
            <AlertCircle className="w-3 h-3 text-red-500" />
            <span className="text-xs text-red-600">{error}</span>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto mt-3 min-h-0">
          {isGenerating ? (
            /* Loading state — no raw JSON shown */
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-full border-2 border-[#5382E3]/20 border-t-[#5382E3] animate-spin" />
                <Sparkles className="w-4 h-4 text-[#5382E3] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-[#303549]">
                  {statusMessage || "Generating summary..."}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">This takes a few seconds</p>
              </div>
            </div>
          ) : displayContent ? (
            <div
              className="prose prose-sm max-w-none text-xs text-[#303549] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(displayContent) }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="w-8 h-8 text-[#5382E3]/30 mb-3" />
              <p className="text-sm text-gray-500 font-medium">No summary yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Generate an AI-powered analysis of your projection including risk
                assessment, key metrics, and action overview.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              if (isGenerating) cancel();
              onClose();
            }}
          >
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && displayContent && !isGenerating && (
            <Button
              size="sm"
              className="text-xs gap-1.5 bg-[#5382E3] hover:bg-[#4371D0]"
              onClick={() => {
                if (summary) onSave(summary);
                onClose();
              }}
            >
              <Save className="w-3 h-3" />
              Save Summary
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold mt-4 mb-1.5">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-base font-bold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br class="my-1.5" />')
    .replace(/\n/g, "<br />");
}
