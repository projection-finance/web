"use client";

import React, { useState } from "react";
import { Bug, X, Send, Check } from "lucide-react";

const BugReportWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          page: window.location.pathname + window.location.search,
          userAgent: navigator.userAgent,
        }),
      });

      if (res.ok) {
        setStatus("sent");
        setMessage("");
        setTimeout(() => {
          setStatus("idle");
          setIsOpen(false);
        }, 2000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={`fixed bottom-14 right-5 z-50 w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 ${
          isOpen
            ? "bg-gray-400 hover:bg-gray-500"
            : "bg-[#303549] hover:bg-[#252839]"
        }`}
        title="Report a bug"
      >
        {isOpen ? (
          <X className="w-4.5 h-4.5 text-white" />
        ) : (
          <Bug className="w-4.5 h-4.5 text-white" />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-[108px] right-5 z-50 w-80 bg-white rounded-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-[#303549]" />
              <span className="text-sm font-semibold text-[#303549]">Report a bug</span>
              <span className="text-[9px] font-bold text-white bg-amber-500 rounded px-1.5 py-0.5 ml-auto leading-none">
                BETA
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Help us improve by reporting issues you encounter.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue you encountered..."
              className="w-full h-24 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#5382E3] focus:border-[#5382E3]"
              maxLength={2000}
              disabled={status === "sending" || status === "sent"}
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-gray-300">
                {message.length}/2000
              </span>

              <button
                type="submit"
                disabled={!message.trim() || status === "sending" || status === "sent"}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  status === "sent"
                    ? "bg-green-500 text-white"
                    : status === "error"
                    ? "bg-red-500 text-white"
                    : message.trim()
                    ? "bg-[#303549] text-white hover:bg-[#252839]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {status === "sending" ? (
                  "Sending..."
                ) : status === "sent" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Sent
                  </>
                ) : status === "error" ? (
                  "Failed, retry"
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Send
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default BugReportWidget;
