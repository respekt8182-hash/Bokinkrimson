import type { Metadata } from "next";
import { HousingCatalogClient } from "@/components/public/housing-catalog-client";
import { ExcursionSearchResults } from "@/components/public/excursion-search-results";
import { JsonLd } from "@/components/seo/JsonLd";
import { getLocationDirectoryItems } from "@/lib/location-directory";
import { getExcursionSeoDirectoryData, getPublicExcursionCatalog } from "@/lib/public-excursions";
import { getPublicCatalog } from "@/lib/public-properties";
import {
  getPopularExcursionSuggestions,
  getPopularHousingSuggestions,
} from "@/lib/search-suggestions";
import {
  buildCollectionPageStructuredData,
  buildBreadcrumbListStructuredData,
} from "@/lib/seo/structured-data";
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
    .filter(
      (item): item is (typeof items)[number] & { type: "location" } => item.type === "location",
    )
    .map((item) => ({
      type: "location",
      id: item.id,
      name: item.name,
      subtitle: item.subtitle,
    }));
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
    (normalizedDirection === "tours"
      ? "tour"
      : normalizedDirection === "excursions"
        ? "excursion"
        : "");
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

      <HousingCatalogClient
        initialResponse={{
          items: initialHousingResult.items,
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
        initialLocationLabel={
          initialHousingResult.filters.locationName ?? (location || "весь Крым")
        }
      />
    </>
  );
}
