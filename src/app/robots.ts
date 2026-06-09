import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/radar", "/share"],
        disallow: ["/api/", "/account/", "/projections/", "/monitoring/", "/wallets/"],
      },
    ],
    sitemap: "https://projection.finance/sitemap.xml",
  };
}
