"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Mail, Send } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    const subject = encodeURIComponent(`Contact from ${form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
    );
    window.location.href = `mailto:support@projectionfinance.com?subject=${subject}&body=${body}`;

    setTimeout(() => {
      setStatus("sent");
      setForm({ name: "", email: "", message: "" });
      setTimeout(() => setStatus("idle"), 3000);
    }, 500);
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-[#303549] mb-1">Contact Us</h1>
        <p className="text-sm text-gray-400 mb-8">
          Have a question, feedback, or need help? Reach out to us.
        </p>

        {/* Direct links */}
        <div className="flex flex-col gap-3 mb-8">
          <a
            href="mailto:support@projectionfinance.com"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-[#5382E3] hover:bg-blue-50/30 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-[#ECECF5] flex items-center justify-center group-hover:bg-[#5382E3]/10">
              <Mail className="w-4 h-4 text-[#5382E3]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#303549]">Email</p>
              <p className="text-xs text-gray-400">support@projectionfinance.com</p>
            </div>
          </a>

          <a
            href="https://x.com/projection_fi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-[#303549] hover:bg-gray-50 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-[#ECECF5] flex items-center justify-center group-hover:bg-gray-200">
              <FaXTwitter className="w-4 h-4 text-[#303549]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#303549]">X (Twitter)</p>
              <p className="text-xs text-gray-400">@projection_defi</p>
            </div>
          </a>
        </div>

        {/* Separator */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or send us a message</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Contact form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-gray-500">
                Name
              </Label>
              <Input
                id="name"
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-gray-500">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-xs text-gray-500">
              Message
            </Label>
            <Textarea
              id="message"
              placeholder="How can we help?"
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full h-10 bg-[#5382E3] hover:bg-[#4270D0] text-sm font-medium gap-2"
            disabled={status === "sending"}
          >
            {status === "sending" ? (
              "Opening mail client..."
            ) : status === "sent" ? (
              "Done!"
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Send Message
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
