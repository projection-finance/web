import type { Metadata } from "next";
import RadarClient from "./RadarClient";

export const metadata: Metadata = {
  title: "Liquidation Radar — Aave V3 | Projection Finance",
  description:
    "Track the largest Aave V3 whale positions at risk of liquidation on Ethereum. Real-time health factors, liquidation prices, and recent liquidation events.",
  openGraph: {
    title: "Liquidation Radar — Aave V3",
    description:
      "Monitor whale positions at risk of liquidation on Aave V3 Ethereum. Updated every 5 minutes.",
  },
};

export default function RadarPage() {
  return <RadarClient defaultNetwork="ETHEREUM_V3" />;
}
