import type { Metadata } from "next";
import { HousingCatalogClient } from "@/components/public/housing-catalog-client";
import { ExcursionSearchResults } from "@/components/public/excursion-search-results";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoBreadcrumbs } from "@/components/seo/seo-breadcrumbs";
import { SeoHubLinks, type SeoHubLinkGroup } from "@/components/seo/seo-hub-links";
import { propertyTypes } from "@/lib/constants";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { getExcursionSeoDirectoryData, getPublicExcursionCatalog } from "@/lib/public-excursions";
import { getPublicCatalog } from "@/lib/public-properties";
import {
  getPopularExcursionSuggestions,
  getPopularHousingSuggestions,
} from "@/lib/search-suggestions";
import {
  buildHousingHubPath,
  buildHousingLocationPath,
  buildToursHubPath,
} from "@/lib/seo/routes";
import { buildCollectionPageStructuredData, buildBreadcrumbListStructuredData } from "@/lib/seo/structured-data";
import { buildSearchMetadata, getSearchSeoState } from "@/lib/seo/search-metadata";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  return buildSearchMetadata(await searchParams);
}

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function appendStayParamsToPath(
  path: string,
  params: {
    checkIn: string;
    checkOut: string;
    guests: string;
    guestsAdults?: string;
    guestsChildren?: string;
  },
): string {
  const [pathWithoutHash, hash = ""] = path.split("#", 2);
  const [pathname, queryString = ""] = pathWithoutHash.split("?", 2);
  const query = new URLSearchParams(queryString);

  if (params.checkIn) {
    query.set("checkIn", params.checkIn);
  } else {
    query.delete("checkIn");
  }

  if (params.checkOut) {
    query.set("checkOut", params.checkOut);
  } else {
    query.delete("checkOut");
  }

  if (params.guests) {
    query.set("guests", params.guests);
  } else {
    query.delete("guests");
  }

  if (params.guestsAdults) {
    query.set("guestsAdults", params.guestsAdults);
  } else {
    query.delete("guestsAdults");
  }

  if (params.guestsChildren) {
    query.set("guestsChildren", params.guestsChildren);
  } else {
    query.delete("guestsChildren");
  }

  const nextQuery = query.toString();
  const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname;
  return hash ? `${nextPath}#${hash}` : nextPath;
}

function toLocationSuggestions(
  items: Array<{
    type: string;
    id: string;
    name: string;
    subtitle: string;
  }>,
): Array<{
  type: "location";
  id: string;
  name: string;
  subtitle: string;
}> {
  return items
    .filter((item): item is (typeof items)[number] & { type: "location" } => item.type === "location")
    .map((item) => ({
      type: "location",
      id: item.id,
      name: item.name,
      subtitle: item.subtitle,
    }));
}

function buildHousingHubGroups(input: {
  location: string;
  locationId?: string;
  popularLocations: Array<{ id: string; name: string }>;
}): SeoHubLinkGroup[] {
  const groups: SeoHubLinkGroup[] = [];

  if (input.popularLocations.length > 0) {
    groups.push({
      title: "Популярные города",
      links: input.popularLocations.slice(0, 8).map((item) => ({
        label: item.name,
        href: buildHousingLocationPath(item.id),
      })),
    });
  }

  if (input.location) {
    groups.push({
      title: `Типы жилья ${input.location ? "в выбранной локации" : "в Крыму"}`,
      links: propertyTypes.slice(0, 8).map((item) => ({
        label: item.name,
        href: buildHousingHubPath({ location: input.location, propertyType: item.id }),
      })),
    });
  }

  return groups;
}

function buildExcursionHubGroups(input: {
  direction: "excursions" | "tours";
  directory: Awaited<ReturnType<typeof getExcursionSeoDirectoryData>>;
  popularLocations: Array<{ id: string; name: string }>;
}): SeoHubLinkGroup[] {
  if (input.direction === "tours") {
    return [
      {
        title: "Популярные города для туров",
        links: input.popularLocations.slice(0, 8).map((item) => ({
          label: item.name,
          href: buildToursHubPath({ location: item.name }),
        })),
      },
    ];
  }

  return [
    {
      title: "Города",
      links: input.directory.cities.slice(0, 8).map((item) => ({
        label: item.name,
        href: `/excursions/${item.slug}`,
      })),
    },
    {
      title: "Категории",
      links: input.directory.categories.slice(0, 8).map((item) => ({
        label: item.name,
        href: `/excursions/category/${item.slug}`,
      })),
    },
    {
      title: "Районы",
      links: input.directory.districts.slice(0, 8).map((item) => ({
        label: item.name,
        href: `/excursions/district/${item.slug}`,
      })),
    },
  ];
}

function SearchIntro({
  breadcrumbs,
  lead,
}: {
  breadcrumbs: Array<{ name: string; path: string }>;
  lead: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-6 md:pt-8">
      <SeoBreadcrumbs items={breadcrumbs} />
      <section className="mt-4 rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10 md:p-5">
        <p className="text-sm leading-7 text-olive/72">{lead}</p>
      </section>
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const seoState = await getSearchSeoState(params);
  const normalizedDirection = seoState.direction;
  const direction = normalizedDirection === "housing" ? "housing" : "excursions";
  const [
    locationDirectory,
    excursionSeoDirectory,
    popularHousingSuggestions,
    popularExcursionSuggestions,
  ] = await Promise.all([
    getLocationDirectoryItems(),
    getExcursionSeoDirectoryData(),
    direction === "housing" ? getPopularHousingSuggestions() : Promise.resolve([]),
    direction === "excursions" ? getPopularExcursionSuggestions() : Promise.resolve([]),
  ]);
  const popularHousingLocationSuggestions = toLocationSuggestions(popularHousingSuggestions);
  const popularExcursionLocationSuggestions = toLocationSuggestions(popularExcursionSuggestions);

  const textQuery = pick(params.q) || pick(params.query);
  const location = pick(params.location);
  const offerType =
    pick(params.offerType) ||
    (normalizedDirection === "tours" ? "tour" : "");
  const propertyType =
    pick(params.propertyType) ||
    (direction === "housing" && normalizedDirection !== "housing" ? normalizedDirection : "");
  const district = pick(params.district);
  const category = pick(params.category);
  const format = pick(params.format);
  const durationBucket = pick(params.durationBucket);
  const language = pick(params.language);
  const difficulty = pick(params.difficulty);
  const pickup = pick(params.pickup);
  const kids = pick(params.kids);
  const minPrice = pick(params.minPrice);
  const maxPrice = pick(params.maxPrice);
  const sort = pick(params.sort);
  const minRating = pick(params.minRating);
  const hasPhotosRaw = pick(params.hasPhotos);
  const hasReviewsRaw = pick(params.hasReviews);
  const familyFriendlyRaw = pick(params.familyFriendly) || pick(params.kidsFriendly);
  const petsAllowedRaw = pick(params.petsAllowed);
  const radiusKm = pick(params.radiusKm) || "30";
  const checkIn = pick(params.checkIn);
  const checkOut = pick(params.checkOut);
  const guests = pick(params.guests) || "2";
  const guestsAdults = pick(params.guestsAdults) || pick(params.adults);
  const guestsChildren = pick(params.guestsChildren) || pick(params.children);
  const hasPhotos = hasPhotosRaw === "1" || hasPhotosRaw === "true";
  const hasReviews = hasReviewsRaw === "1" || hasReviewsRaw === "true";
  const familyFriendly = familyFriendlyRaw === "1" || familyFriendlyRaw === "true";
  const petsAllowed = petsAllowedRaw === "1" || petsAllowedRaw === "true";
  const pageRaw = Number.parseInt(pick(params.page) || "1", 10);
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const canEmitSearchSchema = seoState.index;

  if (direction === "excursions") {
    const peopleRaw = Number.parseInt(guests, 10);
    const result = await getPublicExcursionCatalog({
      offerType: offerType === "tour" || offerType === "excursion" ? offerType : undefined,
      query: textQuery,
      location,
      district,
      category,
      format,
      durationBucket:
        durationBucket === "up_to_3h" ||
        durationBucket === "between_3h_6h" ||
        durationBucket === "more_6h"
          ? durationBucket
          : undefined,
      language: language || undefined,
      difficulty:
        difficulty === "easy" || difficulty === "medium" || difficulty === "hard"
          ? difficulty
          : undefined,
      pickup: pickup === "1" || pickup === "true",
      kids: kids === "1" || kids === "true",
      minPrice: Number.parseFloat(minPrice) > 0 ? Number.parseFloat(minPrice) : undefined,
      maxPrice: Number.parseFloat(maxPrice) > 0 ? Number.parseFloat(maxPrice) : undefined,
      sort:
        sort === "relevance" ||
        sort === "price_asc" ||
        sort === "price_desc" ||
        sort === "rating_desc" ||
        sort === "popular_desc" ||
        sort === "distance_asc" ||
        sort === "duration_asc"
          ? sort
          : undefined,
      dateFrom: checkIn || undefined,
      dateTo: checkOut || undefined,
      people: Number.isFinite(peopleRaw) ? Math.max(1, peopleRaw) : undefined,
      radiusKm: Number.parseFloat(radiusKm) || 30,
      page,
      pageSize: 30,
    });
    const linkGroups = buildExcursionHubGroups({
      direction: normalizedDirection === "tours" ? "tours" : "excursions",
      directory: excursionSeoDirectory,
      popularLocations: popularExcursionLocationSuggestions,
    });

    return (
      <>
        {canEmitSearchSchema ? (
          <>
            <JsonLd data={buildBreadcrumbListStructuredData(seoState.breadcrumbItems)} />
            <JsonLd
              data={buildCollectionPageStructuredData({
                path: seoState.canonicalPath,
                name: seoState.heading,
                description: seoState.description,
                items: result.items.slice(0, 12).map((item) => ({
                  name: item.title,
                  path: item.path,
                  image: item.coverImageUrl,
                })),
              })}
            />
          </>
        ) : null}

        <SearchIntro breadcrumbs={seoState.breadcrumbItems} lead={seoState.lead} />

        <ExcursionSearchResults
          items={result.items}
          filters={result.filters}
          pagination={{ page: result.page, totalPages: result.totalPages, total: result.total }}
          districts={excursionSeoDirectory.districts}
          categories={excursionSeoDirectory.categories}
          locationNames={excursionSeoDirectory.cities.map((item) => item.name)}
          initialPopularLocationSuggestions={popularExcursionLocationSuggestions}
          catalogDirection={normalizedDirection === "tours" ? "tours" : "excursions"}
        />

        <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 md:px-6">
          <SeoHubLinks groups={linkGroups} />
        </div>
      </>
    );
  }

  const guestsCountRaw = Number.parseInt(guests, 10);
  const minRatingValue = Number.parseFloat(minRating);
  const normalizedMinRating =
    Number.isFinite(minRatingValue) && minRatingValue > 0
      ? Math.min(5, Math.max(1, minRatingValue))
      : undefined;
  const normalizedSort =
    sort === "relevance" ||
    sort === "price_asc" ||
    sort === "price_desc" ||
    sort === "rating_desc" ||
    sort === "popular_desc"
      ? sort
      : "";

  const initialHousingResult = await getPublicCatalog({
    query: textQuery,
    location,
    type: propertyType || undefined,
    checkIn: checkIn || undefined,
    checkOut: checkOut || undefined,
    guests: Number.isFinite(guestsCountRaw) ? Math.max(1, guestsCountRaw) : 1,
    minPrice: Number.parseFloat(minPrice) > 0 ? Number.parseFloat(minPrice) : undefined,
    maxPrice: Number.parseFloat(maxPrice) > 0 ? Number.parseFloat(maxPrice) : undefined,
    minRating: normalizedMinRating,
    hasPhotos,
    hasReviews,
    familyFriendly,
    petsAllowed,
    sort: normalizedSort || undefined,
    page: 1,
    pageSize: 30,
  });

  const initialSortParam =
    initialHousingResult.filters.sort === "relevance" ? "" : initialHousingResult.filters.sort;
  const initialItemsWithStayParams = initialHousingResult.items.map((item) => ({
    ...item,
    path: appendStayParamsToPath(item.path, {
      checkIn,
      checkOut,
      guests,
      guestsAdults,
      guestsChildren,
    }),
  }));
  const housingHubGroups = buildHousingHubGroups({
    location: initialHousingResult.filters.locationName ?? location,
    locationId: initialHousingResult.filters.locationId ?? undefined,
    popularLocations: popularHousingLocationSuggestions,
  });

  return (
    <>
      {canEmitSearchSchema ? (
        <>
          <JsonLd data={buildBreadcrumbListStructuredData(seoState.breadcrumbItems)} />
          <JsonLd
            data={buildCollectionPageStructuredData({
              path: seoState.canonicalPath,
              name: seoState.heading,
              description: seoState.description,
              items: initialHousingResult.items.slice(0, 12).map((item) => ({
                name: item.name,
                path: item.path,
                image: item.coverImageUrl,
              })),
            })}
          />
        </>
      ) : null}

      <SearchIntro breadcrumbs={seoState.breadcrumbItems} lead={seoState.lead} />

      <HousingCatalogClient
        initialResponse={{
          items: initialItemsWithStayParams,
          total: initialHousingResult.total,
          page: 1,
          pageSize: 30,
          totalPages: initialHousingResult.totalPages,
          hasMore: initialHousingResult.totalPages > 1,
        }}
        initialFilters={{
          direction: "housing",
          query: textQuery,
          location,
          locationId: initialHousingResult.filters.locationId ?? "",
          propertyType,
          checkIn,
          checkOut,
          guests,
          guestsAdults,
          guestsChildren,
          minPrice,
          maxPrice,
          sort: initialSortParam,
          minRating,
          hasPhotos,
          hasReviews,
          familyFriendly,
          petsAllowed,
        }}
        locationNames={locationDirectory.map((item) => item.name)}
        initialPopularLocationSuggestions={popularHousingLocationSuggestions}
        initialLocationLabel={initialHousingResult.filters.locationName ?? (location || "весь Крым")}
      />

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 md:px-6">
        <SeoHubLinks groups={housingHubGroups} />
      </div>
    </>
  );
}
