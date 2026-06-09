import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RadarClient from "../RadarClient";
import {
  networkSlugToId,
  getNetworkById,
} from "@/src/lib/aave/networks";
import { prisma } from "@/src/lib/prisma";

export const revalidate = 300;

export function generateStaticParams() {
  // Only Ethereum for now — radar data is only collected for Ethereum
  return [{ network: "ethereum" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ network: string }>;
}): Promise<Metadata> {
  const { network: slug } = await params;
  const networkId = networkSlugToId(slug);
  if (!networkId) return {};

  const meta = getNetworkById(networkId)!;
  const title = `Liquidation Radar — Aave V3 ${meta.name}`;

  // Prisma may not be available at build time (no DATABASE_URL in Docker build)
  let description = `Track whale positions on Aave V3 ${meta.name}. Real-time health factors and liquidation prices.`;
  try {
    const [totalPositions, atRiskCount] = await Promise.all([
      prisma.radarPosition.count({ where: { network: networkId, status: "active" } }),
      prisma.radarPosition.count({ where: { network: networkId, status: "active", healthFactor: { lt: 1.1 } } }),
    ]);
    description = `Track ${totalPositions} whale positions on Aave V3 ${meta.name}. ${atRiskCount} positions at risk of liquidation. Real-time health factors and liquidation prices.`;
  } catch {
    // DB not available at build time — use fallback description
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export default async function NetworkRadarPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network: slug } = await params;
  const networkId = networkSlugToId(slug);
  if (!networkId) notFound();

  return <RadarClient defaultNetwork={networkId} />;
}
