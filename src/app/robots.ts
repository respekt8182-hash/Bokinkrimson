import type { MetadataRoute } from "next";
import { resolveBaseUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveBaseUrl();
  const host = new URL(baseUrl).host;

  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/api"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host,
  };
}
