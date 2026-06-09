import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  networkSlugToId,
  getNetworkById,
} from "@/src/lib/aave/networks";
import { prisma } from "@/src/lib/prisma";
import WhalePositionClient from "./WhalePositionClient";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ network: string; address: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network: slug, address } = await params;
  const networkId = networkSlugToId(slug);
  if (!networkId) return {};

  const meta = getNetworkById(networkId)!;
  const position = await prisma.radarPosition.findUnique({
    where: { walletAddress_network: { walletAddress: address, network: networkId } },
  });

  if (!position) return {};

  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const hfDisplay = position.healthFactor < 100 ? position.healthFactor.toFixed(2) : "Safe";
  const collateral = formatCompact(position.totalCollateralUSD);
  const debt = formatCompact(position.totalDebtUSD);

  const title = `Whale ${shortAddr} on ${meta.name} — HF ${hfDisplay}`;
  const description = `Aave V3 ${meta.name} position: $${collateral} collateral, $${debt} debt, health factor ${hfDisplay}. Main collateral: ${position.mainCollateralSymbol}.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export default async function WhalePositionPage({ params }: PageProps) {
  const { network: slug, address } = await params;
  const networkId = networkSlugToId(slug);
  if (!networkId) notFound();

  const meta = getNetworkById(networkId)!;

  const [position, liquidations] = await Promise.all([
    prisma.radarPosition.findUnique({
      where: { walletAddress_network: { walletAddress: address, network: networkId } },
    }),
    prisma.radarLiquidation.findMany({
      where: { walletAddress: address, network: networkId },
      orderBy: { timestamp: "desc" },
      take: 10,
    }),
  ]);

  if (!position) notFound();

  // JSON-LD BreadcrumbList
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Radar", item: "https://projection.finance/radar" },
      { "@type": "ListItem", position: 2, name: meta.name, item: `https://projection.finance/radar/${slug}` },
      { "@type": "ListItem", position: 3, name: `${address.slice(0, 6)}...${address.slice(-4)}` },
    ],
  };

  // Serialize position + liquidations for client
  const positionData = {
    walletAddress: position.walletAddress,
    network: position.network,
    healthFactor: position.healthFactor,
    totalCollateralUSD: position.totalCollateralUSD,
    totalDebtUSD: position.totalDebtUSD,
    mainCollateralSymbol: position.mainCollateralSymbol,
    mainCollateralAmount: position.mainCollateralAmount,
    mainCollateralPriceUSD: position.mainCollateralPriceUSD,
    liquidationPriceUSD: position.liquidationPriceUSD,
    liquidationThreshold: position.liquidationThreshold,
    positionJson: position.positionJson as {
      collaterals: { symbol: string; amountUSD: number; amount: number; liqThreshold: number }[];
      debts: { symbol: string; amountUSD: number; amount: number }[];
    } | null,
    status: position.status,
    updatedAt: position.updatedAt.toISOString(),
  };

  const liquidationData = liquidations.map((l) => ({
    id: l.id,
    txHash: l.txHash,
    collateralAssetSymbol: l.collateralAssetSymbol,
    collateralSeizedAmount: l.collateralSeizedAmount,
    collateralSeizedUSD: l.collateralSeizedUSD,
    debtAssetSymbol: l.debtAssetSymbol,
    debtRepaidAmount: l.debtRepaidAmount,
    debtRepaidUSD: l.debtRepaidUSD,
    timestamp: l.timestamp.toISOString(),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WhalePositionClient
        position={positionData}
        liquidations={liquidationData}
        networkSlug={slug}
        networkName={meta.name}
        explorerUrl={meta.explorerUrl}
      />
    </>
  );
}
