"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-14 left-4 md:left-6 md:max-w-sm z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-600 mb-3">
          We use essential cookies for authentication and session management. Our analytics are cookie-free.
          See our{" "}
          <Link href="/privacy" className="text-[#5382E3] hover:underline">
            Privacy Policy
          </Link>.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={accept}
            className="flex-1 h-8 bg-[#5382E3] hover:bg-[#4270D0] text-xs"
          >
            Accept
          </Button>
          <Button
            onClick={decline}
            variant="outline"
            className="flex-1 h-8 text-xs"
          >
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
