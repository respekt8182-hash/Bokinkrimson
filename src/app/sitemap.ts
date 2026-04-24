import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { crimeaLocationById } from "@/lib/constants";
import { db } from "@/lib/db";
import { buildPublicExcursionPath, getExcursionSeoDirectoryData } from "@/lib/public-excursions";
import { buildPublicPropertyPath } from "@/lib/public-properties";
import {
  buildPublishedExcursionVisibilityWhere,
  buildPublishedPropertyVisibilityWhere,
} from "@/lib/public-visibility";
import {
  buildHousingLocationPath,
  excursionsHubPath,
  housingHubPath,
  toursHubPath,
} from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";

type SitemapEntry = MetadataRoute.Sitemap[number];
type RouteFileEntry = {
  path: string;
  file: string;
  changeFrequency: NonNullable<SitemapEntry["changeFrequency"]>;
  priority: number;
};

const propertyWhere = buildPublishedPropertyVisibilityWhere();
const excursionWhere = buildPublishedExcursionVisibilityWhere();

const staticRouteFiles: RouteFileEntry[] = [
  {
    path: "/",
    file: "src/app/page.tsx",
    changeFrequency: "daily",
    priority: 1,
  },
  {
    path: housingHubPath,
    file: "src/app/rent/page.tsx",
    changeFrequency: "daily",
    priority: 0.92,
  },
  {
    path: excursionsHubPath,
    file: "src/app/excursions/page.tsx",
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    path: toursHubPath,
    file: "src/app/tours/page.tsx",
    changeFrequency: "weekly",
    priority: 0.84,
  },
  {
    path: "/about",
    file: "src/app/about/page.tsx",
    changeFrequency: "monthly",
    priority: 0.65,
  },
  {
    path: "/cooperation",
    file: "src/app/cooperation/page.tsx",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/uslugi-i-tarify",
    file: "src/app/uslugi-i-tarify/page.tsx",
    changeFrequency: "monthly",
    priority: 0.66,
  },
  {
    path: "/consent",
    file: "src/app/consent/page.tsx",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/oferta",
    file: "src/app/oferta/page.tsx",
    changeFrequency: "yearly",
    priority: 0.32,
  },
  {
    path: "/legal/privacy",
    file: "src/app/legal/privacy/page.tsx",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/legal/terms",
    file: "src/app/legal/terms/page.tsx",
    changeFrequency: "yearly",
    priority: 0.3,
  },
];

async function getFileLastModified(relativeFilePath: string): Promise<Date | undefined> {
  try {
    const stats = await stat(join(process.cwd(), relativeFilePath));
    return stats.mtime;
  } catch {
    return undefined;
  }
}

async function buildStaticEntries(): Promise<MetadataRoute.Sitemap> {
  const entries = await Promise.all(
    staticRouteFiles.map(async (routeFile) => ({
      url: absoluteUrl(routeFile.path),
      lastModified: await getFileLastModified(routeFile.file),
      changeFrequency: routeFile.changeFrequency,
      priority: routeFile.priority,
    })),
  );

  return entries;
}

async function buildHousingSeoEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const locationRows = await db.property.findMany({
      where: {
        ...propertyWhere,
        locationId: { not: null },
      },
      select: {
        locationId: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const latestByLocation = new Map<string, Date>();

    for (const row of locationRows) {
      const locationId = row.locationId ?? "";
      if (!crimeaLocationById[locationId] || latestByLocation.has(locationId)) {
        continue;
      }

      latestByLocation.set(locationId, row.updatedAt);
    }

    return [...latestByLocation.entries()].map(([locationId, updatedAt]) => ({
      url: absoluteUrl(buildHousingLocationPath(locationId)),
      lastModified: updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.78,
    }));
  } catch {
    return [];
  }
}

async function buildExcursionSeoEntries(): Promise<MetadataRoute.Sitemap> {
  const [directory, locationPageModified, categoryPageModified, districtPageModified] =
    await Promise.all([
      getExcursionSeoDirectoryData(),
      getFileLastModified("src/app/excursions/[location]/page.tsx"),
      getFileLastModified("src/app/excursions/category/[category]/page.tsx"),
      getFileLastModified("src/app/excursions/district/[district]/page.tsx"),
    ]);

  return [
    ...directory.cities.map((item) => ({
      url: absoluteUrl(`/excursions/${item.slug}`),
      lastModified: locationPageModified,
      changeFrequency: "daily" as const,
      priority: 0.76,
    })),
    ...directory.categories.map((item) => ({
      url: absoluteUrl(`/excursions/category/${item.slug}`),
      lastModified: categoryPageModified,
      changeFrequency: "weekly" as const,
      priority: 0.72,
    })),
    ...directory.districts.map((item) => ({
      url: absoluteUrl(`/excursions/district/${item.slug}`),
      lastModified: districtPageModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}

async function buildPropertyEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const properties = await db.property.findMany({
      where: propertyWhere,
      select: {
        id: true,
        name: true,
        locationId: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return properties.map((item) => ({
      url: absoluteUrl(buildPublicPropertyPath(item)),
      lastModified: item.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.82,
    }));
  } catch {
    return [];
  }
}

async function buildExcursionEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const excursions = await db.excursion.findMany({
      where: excursionWhere,
      select: {
        id: true,
        title: true,
        locationId: true,
        anchorLocation: {
          select: {
            slug: true,
          },
        },
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return excursions.map((item) => ({
      url: absoluteUrl(buildPublicExcursionPath(item)),
      lastModified: item.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [staticEntries, housingSeoEntries, excursionSeoEntries, propertyEntries, excursionEntries] =
    await Promise.all([
      buildStaticEntries(),
      buildHousingSeoEntries(),
      buildExcursionSeoEntries(),
      buildPropertyEntries(),
      buildExcursionEntries(),
    ]);

  return [
    ...staticEntries,
    ...housingSeoEntries,
    ...excursionSeoEntries,
    ...propertyEntries,
    ...excursionEntries,
  ];
}
