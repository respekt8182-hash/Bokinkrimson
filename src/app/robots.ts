// Robots policy generator for search engine crawlers.
import type { MetadataRoute } from "next";

function resolveBaseUrl(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
      .toString()
      .replace(/\/$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/search", "/crimea", "/legal"],
        disallow: ["/dashboard", "/admin", "/api"],
      },
    ],
    sitemap: `${resolveBaseUrl()}/sitemap.xml`,
    host: resolveBaseUrl(),
  };
}
