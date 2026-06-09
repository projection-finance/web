import type { MetadataRoute } from "next";
import { NETWORK_LIST, networkIdToSlug } from "@/src/lib/aave/networks";
import { prisma } from "@/src/lib/prisma";

// Force runtime generation — Prisma needs DATABASE_URL which isn't available at build time
export const dynamic = "force-dynamic";

const BASE_URL = "https://projection.finance";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/radar`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/tokens`, changeFrequency: "weekly", priority: 0.6 },
  ];

  // Network radar pages (17 networks)
  const networkPages: MetadataRoute.Sitemap = NETWORK_LIST.map((n) => ({
    url: `${BASE_URL}/radar/${networkIdToSlug(n.id)}`,
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  // Top 500 whale positions across all networks
  const topPositions = await prisma.radarPosition.findMany({
    where: { status: "active" },
    orderBy: { totalDebtUSD: "desc" },
    take: 500,
    select: { walletAddress: true, network: true, updatedAt: true },
  });

  const positionPages: MetadataRoute.Sitemap = topPositions.map((p) => {
    const slug = networkIdToSlug(p.network as Parameters<typeof networkIdToSlug>[0]);
    return {
      url: `${BASE_URL}/radar/${slug}/${p.walletAddress}`,
      lastModified: p.updatedAt,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    };
  });

  // All shared projections
  const sharedProjections = await prisma.sharedProjection.findMany({
    select: { slug: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const sharePages: MetadataRoute.Sitemap = sharedProjections.map((s) => ({
    url: `${BASE_URL}/share/${s.slug}`,
    lastModified: s.createdAt,
    changeFrequency: "monthly" as const,
    priority: 0.4,
  }));

  return [...staticPages, ...networkPages, ...positionPages, ...sharePages];
}
