"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/src/components/ui/button";
import { Check, Shield } from "lucide-react";
import Link from "next/link";

const FEATURES = [
  "Unlimited instant actions",
  "365-day projections",
  "Unlimited price & rate scenarios",
  "Scheduled actions",
  "Cloud save & auto-save",
  "Favorite wallets",
  "AI insights",
  "Custom tokens",
];

export default function AccountPage() {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Sign in to view your account.</p>
          <Link href="/sign-in">
            <Button className="bg-[#5382E3]">Sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-sm text-[#5382E3] hover:underline mb-6 inline-block">
          &larr; Back to app
        </Link>

        <h1 className="text-2xl font-bold text-[#303549] mb-8">Account</h1>

        {/* Profile */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <p className="font-semibold text-[#303549]">
                {session.user.name || "User"}
              </p>
              <p className="text-sm text-gray-400">{session.user.email}</p>
            </div>
          </div>
        </div>

        {/* What's included */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#303549] mb-2">
            Everything is free
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Projection Finance is fully open-source. Every feature is unlocked for
            every user, with no limits.
          </p>
          <div className="space-y-3">
            {FEATURES.map((label) => (
              <div key={label} className="flex items-center gap-2.5 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data policy */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[#5382E3]" />
            <h2 className="text-lg font-semibold text-[#303549]">
              Your data is safe
            </h2>
          </div>
          <div className="space-y-3 text-sm text-gray-500">
            <p>
              Your saved projections are{" "}
              <span className="font-medium text-[#303549]">never deleted</span>.
              You can view, load and edit them at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
