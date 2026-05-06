import type { Metadata } from "next";
import { propertyTypes } from "@/lib/constants";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { getExcursionSeoDirectoryData } from "@/lib/public-excursions";
import { buildWebPageMetadata, defaultSocialImageUrl } from "@/lib/seo/metadata";
import {
  buildExcursionsHubPath,
  buildHousingHubPath,
  buildHousingLocationPath,
  buildToursHubPath,
  excursionsHubPath,
  housingHubPath,
  toursHubPath,
} from "@/lib/seo/routes";
import { formatLocationInPrepositional } from "@/lib/seo/site";
import {
  hasQueryValue,
  normalizeQueryValue,
  pickFirstParam,
  type SearchParamsInput,
} from "@/lib/seo/url-normalize";

export type SearchDirection = "housing" | "excursions" | "tours";

export type SearchSeoBreadcrumbItem = {
  name: string;
  path: string;
};

export type SearchSeoState = {
  direction: SearchDirection;
  title: string;
  description: string;
  canonicalPath: string;
  index: boolean;
  follow: boolean;
  heading: string;
  breadcrumbItems: SearchSeoBreadcrumbItem[];
};

type SeoDirectoryItem = {
  slug: string;
  name: string;
};

const housingNoiseKeys = new Set([
  "q",
  "query",
  "sort",
  "page",
  "minprice",
  "maxprice",
  "pricefrom",
  "priceto",
  "guests",
  "guestsadults",
  "guestschildren",
  "adults",
  "children",
  "date",
  "dates",
  "checkin",
  "checkout",
  "amenities",
  "rating",
  "minrating",
  "hasphotos",
  "hasreviews",
  "familyfriendly",
  "kidsfriendly",
  "petsallowed",
]);

const excursionNoiseKeys = new Set([
  "q",
  "query",
  "sort",
  "page",
  "minprice",
  "maxprice",
  "pricefrom",
  "priceto",
  "guests",
  "date",
  "dates",
  "checkin",
  "checkout",
  "radiuskm",
  "format",
  "durationbucket",
  "language",
  "difficulty",
  "pickup",
  "kids",
  "offertype",
]);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLocationName(value: string | null | undefined): string {
  return normalizeQueryValue(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function readString(searchParams: SearchParamsInput, ...keys: string[]): string {
  for (const key of keys) {
    const value = normalizeQueryValue(pickFirstParam(searchParams[key]));
    if (value.length > 0) {
      return value;
    }
  }

  return "";
}

function hasMeaningfulNoise(
  searchParams: SearchParamsInput,
  keys: Set<string>,
  defaultValueByKey: Partial<Record<string, string>> = {},
): boolean {
  return Object.entries(searchParams).some(([key, rawValue]) => {
    const normalizedKey = normalizeKey(key);
    if (!keys.has(normalizedKey)) {
      return false;
    }

    const value = normalizeQueryValue(pickFirstParam(rawValue));
    if (!hasQueryValue(value)) {
      return false;
    }

    return value !== (defaultValueByKey[normalizedKey] ?? "");
  });
}

function findSeoDirectoryMatch(value: string, items: SeoDirectoryItem[]): SeoDirectoryItem | null {
  const normalizedValue = normalizeLocationName(value);
  if (!normalizedValue) {
    return null;
  }

  return (
    items.find(
      (item) =>
        normalizeLocationName(item.name) === normalizedValue ||
        normalizeLocationName(item.slug) === normalizedValue,
    ) ?? null
  );
}

function resolveDirection(searchParams: SearchParamsInput): SearchDirection {
  const explicitDirection = normalizeKey(pickFirstParam(searchParams.direction));

  if (explicitDirection === "excursions") {
    return "excursions";
  }

  if (explicitDirection === "tours") {
    return "tours";
  }

  if (explicitDirection === "housing") {
    return "housing";
  }

  const typeValue = normalizeKey(pickFirstParam(searchParams.type));
  return typeValue === "excursions" ? "excursions" : "housing";
}

function buildHousingDescription(location: string | null): string {
  if (location) {
    return `Подборка жилья у моря ${formatLocationInPrepositional(location) ?? `в ${location}`}. До 20 июня 2026 размещение на Крым Вокруг бесплатно, без комиссии с каждого клиента или бронирования.`;
  }

  return "Аренда жилья в Крыму у моря на Крым Вокруг. До 20 июня 2026 размещение бесплатно; сервис не удерживает комиссию с каждого клиента или бронирования.";
}

function buildExcursionDescription(location: string | null): string {
  if (location) {
    return `Экскурсии ${formatLocationInPrepositional(location) ?? `в ${location}`} и по Крыму с прямой связью с организатором. Крым Вокруг работает без комиссии с каждого бронирования.`;
  }

  return "Экскурсии и туры по Крыму с прямой связью с организаторами. До 20 июня 2026 размещение бесплатно; Крым Вокруг не удерживает процент с каждого бронирования.";
}

function buildToursDescription(location: string | null): string {
  if (location) {
    return `Туры ${formatLocationInPrepositional(location) ?? `в ${location}`} и по Крыму с прямой связью с организатором. Крым Вокруг работает без комиссии с каждого бронирования.`;
  }

  return "Туры по Крыму с прямой связью с организаторами. До 20 июня 2026 размещение бесплатно; Крым Вокруг не удерживает процент с каждого бронирования.";
}

function buildHousingBreadcrumbs(input: {
  location: string;
  propertyTypeLabel: string | null;
  locationCanonicalPath: string;
  typedCanonicalPath: string;
}): SearchSeoBreadcrumbItem[] {
  const breadcrumbs: SearchSeoBreadcrumbItem[] = [
    { name: "Главная", path: "/" },
    { name: "Жильё в Крыму", path: housingHubPath },
  ];

  if (input.location) {
    breadcrumbs.push({
      name: input.location,
      path: input.locationCanonicalPath,
    });
  }

  if (input.propertyTypeLabel) {
    breadcrumbs.push({
      name: input.propertyTypeLabel,
      path: input.typedCanonicalPath,
    });
  }

  return breadcrumbs;
}

function buildExcursionBreadcrumbs(input: {
  direction: SearchDirection;
  locationLabel?: string | null;
  locationPath?: string | null;
}): SearchSeoBreadcrumbItem[] {
  const baseLabel = input.direction === "tours" ? "Туры по Крыму" : "Экскурсии по Крыму";
  const basePath = input.direction === "tours" ? toursHubPath : excursionsHubPath;
  const breadcrumbs: SearchSeoBreadcrumbItem[] = [
    { name: "Главная", path: "/" },
    { name: baseLabel, path: basePath },
  ];

  if (input.locationLabel && input.locationPath) {
    breadcrumbs.push({
      name: input.locationLabel,
      path: input.locationPath,
    });
  }

  return breadcrumbs;
}

export async function getSearchSeoState(searchParams: SearchParamsInput): Promise<SearchSeoState> {
  const direction = resolveDirection(searchParams);
  const location = readString(searchParams, "location");
  const propertyType = readString(searchParams, "propertyType");
  const district = readString(searchParams, "district");
  const category = readString(searchParams, "category");
  const locationPhrase = formatLocationInPrepositional(location);

  if (direction === "housing") {
    const locationDirectory = await getLocationDirectoryItems();
    const matchedHousingLocation = location
      ? findSeoDirectoryMatch(
          location,
          locationDirectory.map((item) => ({
            slug: item.id,
            name: item.name,
          })),
        )
      : null;
    const propertyTypeConfig = propertyTypes.find((item) => item.id === propertyType) ?? null;
    const propertyTypeLabel = propertyTypeConfig?.name ?? null;
    const locationLabel = matchedHousingLocation?.name ?? location;
    const locationLabelPhrase = formatLocationInPrepositional(locationLabel);
    const hasNoise = hasMeaningfulNoise(searchParams, housingNoiseKeys, {
      guests: "2",
      page: "1",
    });
    const hasOnlyBase = !location && !propertyType;
    const hasOnlyLocation = Boolean(matchedHousingLocation) && !propertyType;
    const hasStableTypedLocation = Boolean(matchedHousingLocation) && Boolean(propertyTypeConfig);
    const isIndexable = !hasNoise && (hasOnlyBase || hasOnlyLocation || hasStableTypedLocation);
    const canonicalPath = hasStableTypedLocation
      ? buildHousingHubPath({
          location: matchedHousingLocation!.name,
          propertyType,
        })
      : matchedHousingLocation
        ? buildHousingLocationPath(matchedHousingLocation.slug)
        : housingHubPath;
    const locationCanonicalPath = matchedHousingLocation
      ? buildHousingLocationPath(matchedHousingLocation.slug)
      : housingHubPath;
    const title = hasStableTypedLocation
      ? `${propertyTypeLabel} ${locationLabelPhrase ?? `в городе ${locationLabel}`} у моря`
      : locationLabel
        ? `Жильё ${locationLabelPhrase ?? `в городе ${locationLabel}`} у моря`
        : "Аренда жилья в Крыму у моря";
    const heading = hasStableTypedLocation
      ? `${propertyTypeLabel} ${locationLabelPhrase ?? `в городе ${locationLabel}`} у моря`
      : locationLabel
        ? `Жильё ${locationLabelPhrase ?? `в городе ${locationLabel}`} у моря`
        : "Жильё в Крыму у моря";

    return {
      direction,
      title,
      description: buildHousingDescription(locationLabel || null),
      canonicalPath,
      index: isIndexable,
      follow: true,
      heading,
      breadcrumbItems: buildHousingBreadcrumbs({
        location: locationLabel,
        propertyTypeLabel,
        locationCanonicalPath,
        typedCanonicalPath: canonicalPath,
      }),
    };
  }

  if (direction === "tours") {
    const hasNoise = hasMeaningfulNoise(searchParams, excursionNoiseKeys, {
      page: "1",
      radiuskm: "20",
      offertype: "tour",
    });
    const canonicalPath = location ? buildToursHubPath({ location }) : toursHubPath;
    const title = location ? `Туры ${locationPhrase ?? `в городе ${location}`}` : "Туры по Крыму";
    const heading = location ? `Туры ${locationPhrase ?? `в городе ${location}`}` : "Туры по Крыму";

    return {
      direction,
      title,
      description: buildToursDescription(location || null),
      canonicalPath,
      index: !hasNoise,
      follow: true,
      heading,
      breadcrumbItems: buildExcursionBreadcrumbs({
        direction,
        locationLabel: location || null,
        locationPath: location ? canonicalPath : null,
      }),
    };
  }

  const excursionSeoDirectory = await getExcursionSeoDirectoryData();
  const matchedLocation = location
    ? findSeoDirectoryMatch(location, excursionSeoDirectory.cities)
    : null;
  const matchedCategory = category
    ? findSeoDirectoryMatch(category, excursionSeoDirectory.categories)
    : null;
  const matchedDistrict = district
    ? findSeoDirectoryMatch(district, excursionSeoDirectory.districts)
    : null;
  const hasNoise = hasMeaningfulNoise(searchParams, excursionNoiseKeys, {
    page: "1",
    radiuskm: "20",
    offertype: "excursion",
  });
  const stableTaxonomyCount = [location, category, district].filter(Boolean).length;
  const dedicatedSeoCanonicalPath = matchedLocation
    ? `/excursions/${matchedLocation.slug}`
    : matchedCategory
      ? `/excursions/category/${matchedCategory.slug}`
      : matchedDistrict
        ? `/excursions/district/${matchedDistrict.slug}`
        : null;
  const shouldCanonicalizeToSeoPage = Boolean(dedicatedSeoCanonicalPath);
  const canIndexCustomLocation =
    Boolean(location) &&
    !matchedLocation &&
    !category &&
    !district &&
    !hasNoise &&
    stableTaxonomyCount === 1;
  const isIndexable =
    !hasNoise && !shouldCanonicalizeToSeoPage && (!location || canIndexCustomLocation);
  const canonicalPath = shouldCanonicalizeToSeoPage
    ? dedicatedSeoCanonicalPath!
    : canIndexCustomLocation
      ? buildExcursionsHubPath({ location })
      : excursionsHubPath;
  const title = location
    ? `Экскурсии ${locationPhrase ?? `в городе ${location}`}`
    : "Экскурсии по Крыму";
  const heading = location
    ? `Экскурсии ${locationPhrase ?? `в городе ${location}`}`
    : "Экскурсии по Крыму";

  return {
    direction,
    title,
    description: buildExcursionDescription(location || null),
    canonicalPath,
    index: isIndexable,
    follow: true,
    heading,
    breadcrumbItems: buildExcursionBreadcrumbs({
      direction,
      locationLabel: matchedLocation?.name ?? location ?? null,
      locationPath: matchedLocation
        ? `/excursions/${matchedLocation.slug}`
        : location
          ? canonicalPath
          : null,
    }),
  };
}

export async function buildSearchMetadata(searchParams: SearchParamsInput): Promise<Metadata> {
  const seoState = await getSearchSeoState(searchParams);

  return buildWebPageMetadata({
    title: seoState.title,
    description: seoState.description,
    path: seoState.canonicalPath,
    images: [defaultSocialImageUrl],
    robots: {
      index: seoState.index,
      follow: seoState.follow,
    },
  });
}
