import type { Metadata } from "next";
import { prisma } from "@/src/lib/prisma";
import { getNetworkById } from "@/src/lib/aave/networks";
import ShareClient from "./ShareClient";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const shared = await prisma.sharedProjection.findUnique({
    where: { slug },
    select: { name: true, type: true, network: true, address: true, aiSummary: true },
  });

  if (!shared) return {};

  const networkName = shared.network
    ? getNetworkById(shared.network)?.name ?? shared.network
    : "Ethereum";

  const typeLabel = shared.type === "sandbox" ? "Portfolio Sandbox" : "Aave V3";

  // Use AI summary content as description if available
  const aiSummary = shared.aiSummary as { content?: string } | null;
  const summaryText = aiSummary?.content
    ? aiSummary.content.replace(/[#*_\-`]/g, "").slice(0, 200).trim()
    : undefined;

  const shortAddr = shared.address
    ? `${shared.address.slice(0, 6)}...${shared.address.slice(-4)}`
    : "";

  const title = `${shared.name} — ${typeLabel} ${networkName}`;
  const description =
    summaryText ??
    `${typeLabel} simulation on ${networkName}${shortAddr ? ` for ${shortAddr}` : ""}. View this shared projection on Projection Finance.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export default async function SharePage({ params }: PageProps) {
  const { slug } = await params;
  return <ShareClient slug={slug} />;
}
