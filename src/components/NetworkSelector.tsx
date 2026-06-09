"use client";

import { useState, useRef, useEffect } from "react";
import { NetworkId, NETWORK_LIST, getNetworkById, type NetworkMeta } from "@/src/lib/aave/networks";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

interface NetworkSelectorProps {
  selected: NetworkId;
  onChange: (networkId: NetworkId) => void;
}

export default function NetworkSelector({ selected, onChange }: NetworkSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getNetworkById(selected);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#303549] hover:border-gray-300 transition-colors cursor-pointer"
      >
        {current && (
          <Image
            src={current.logo}
            alt={current.name}
            width={18}
            height={18}
            className="shrink-0"
          />
        )}
        <span>{current?.name ?? "Select network"}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-56 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {NETWORK_LIST.map((net: NetworkMeta) => {
            const isSelected = net.id === selected;
            return (
              <button
                key={net.id}
                type="button"
                onClick={() => { onChange(net.id); setOpen(false); }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-gray-50 font-semibold text-[#303549]"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Image
                  src={net.logo}
                  alt={net.name}
                  width={18}
                  height={18}
                  className="shrink-0"
                />
                <span>{net.name}</span>
                {isSelected && (
                  <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: net.color }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
