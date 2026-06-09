"use client";

import { NetworkId, getNetworkById } from "@/src/lib/aave/networks";
import Image from "next/image";

interface NetworkBadgeProps {
  networkId: NetworkId;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export default function NetworkBadge({ networkId, size = "sm", showLabel = true }: NetworkBadgeProps) {
  const network = getNetworkById(networkId);
  if (!network) return null;

  const iconSize = size === "sm" ? 14 : 18;
  const textClass = size === "sm" ? "text-[10px]" : "text-xs";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${padding} font-medium shrink-0`}
      style={{
        backgroundColor: `${network.color}12`,
        color: network.color,
      }}
    >
      <Image
        src={network.logo}
        alt={network.name}
        width={iconSize}
        height={iconSize}
        className="shrink-0"
      />
      {showLabel && (
        <span className={textClass}>{network.name}</span>
      )}
    </span>
  );
}
