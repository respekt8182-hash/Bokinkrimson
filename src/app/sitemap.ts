import { ExcursionStatus, PropertyStatus } from "@prisma/client";
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { buildPublicExcursionPath, getExcursionSeoDirectoryData } from "@/lib/public-excursions";
import { buildPublicPropertyPath } from "@/lib/public-properties";

function resolveBaseUrl(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
      .toString()
      .replace(/\/$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

function absolute(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolveBaseUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absolute(baseUrl, "/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: absolute(baseUrl, "/search?direction=housing"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: absolute(baseUrl, "/rent"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    {
      url: absolute(baseUrl, "/search?direction=excursions"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: absolute(baseUrl, "/excursions"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absolute(baseUrl, "/legal/privacy"), lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: absolute(baseUrl, "/legal/terms"), lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const [properties, excursions, excursionSeoDirectory] = await Promise.all([
      db.property.findMany({
        where: { status: PropertyStatus.PUBLISHED, ownerDeletedAt: null },
        select: { id: true, name: true, locationId: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 50_000,
      }),
      db.excursion.findMany({
        where: { status: ExcursionStatus.PUBLISHED },
        select: { id: true, title: true, locationId: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 50_000,
      }),
      getExcursionSeoDirectoryData(),
    ]);

    const propertyRoutes: MetadataRoute.Sitemap = properties.map((item) => ({
      url: absolute(baseUrl, buildPublicPropertyPath(item)),
      lastModified: item.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const excursionRoutes: MetadataRoute.Sitemap = excursions.map((item) => ({
      url: absolute(baseUrl, buildPublicExcursionPath(item)),
      lastModified: item.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const excursionSeoRoutes: MetadataRoute.Sitemap = [
      ...excursionSeoDirectory.cities.map((item) => ({
        url: absolute(baseUrl, `/excursions/${item.slug}`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.75,
      })),
      ...excursionSeoDirectory.districts.map((item) => ({
        url: absolute(baseUrl, `/excursions/district/${item.slug}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.72,
      })),
      ...excursionSeoDirectory.categories.map((item) => ({
        url: absolute(baseUrl, `/excursions/category/${item.slug}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.72,
      })),
    ];

    return [...staticRoutes, ...propertyRoutes, ...excursionRoutes, ...excursionSeoRoutes];
  } catch {
    // Keep sitemap endpoint available even if DB is temporarily unavailable.
    return staticRoutes;
  }
}
