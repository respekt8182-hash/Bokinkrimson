import { companyConfig } from "@/config/company";
import { getOfferTypeLabel } from "@/lib/excursion-offers";
import type { PublicExcursionCard } from "@/lib/public-excursions";
import type { PublicTransferCatalogItem } from "@/lib/public-marketplace";
import type { PublicPropertyCard } from "@/lib/public-properties";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { normalizePropertyTypeId } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo/site";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { normalizeWebsiteUrl } from "@/lib/website-favicon";

type JsonLdNode = Record<string, unknown>;

const singleUnitPropertyTypeSet = new Set(["apartment", "house", "private_sector"]);

function compactNode<T extends JsonLdNode>(node: T): T {
  return Object.fromEntries(
    Object.entries(node).filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return true;
    }),
  ) as T;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function toAbsoluteMediaUrl(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return absoluteUrl(normalized);
}

function buildPostalAddress(input: {
  locality?: string | null;
  addressLine?: string | null;
}): JsonLdNode | undefined {
  const address = compactNode({
    "@type": "PostalAddress",
    streetAddress: input.addressLine?.trim() || undefined,
    addressLocality: input.locality?.trim() || undefined,
    addressRegion: companyConfig.region,
    addressCountry: companyConfig.countryCode,
    postalCode: companyConfig.postalCode ?? undefined,
  });

  return Object.keys(address).length > 1 ? address : undefined;
}

function buildGeo(latitude: number | null, longitude: number | null): JsonLdNode | undefined {
  if (latitude === null || longitude === null) {
    return undefined;
  }

  return {
    "@type": "GeoCoordinates",
    latitude,
    longitude,
  };
}

function buildAggregateRating(avgRating: number, reviewsCount: number): JsonLdNode | undefined {
  if (!(reviewsCount > 0) || !(avgRating > 0)) {
    return undefined;
  }

  return {
    "@type": "AggregateRating",
    ratingValue: Number(avgRating.toFixed(1)),
    reviewCount: reviewsCount,
    bestRating: 5,
    worstRating: 1,
  };
}

function formatSchemaMoney(value: number, currency: string | null | undefined): string {
  return `${value} ${currency ?? ""}`.trim();
}

function buildTransferDescription(item: PublicTransferCatalogItem): string {
  const title = item.title || item.transferType || "Трансфер по Крыму";
  const preparedDescription =
    item.shortDescription?.trim() || item.description?.trim() || "";

  if (preparedDescription.length >= 70) {
    return preparedDescription;
  }

  return uniqueStrings([
    item.transferType ?? "Трансфер",
    item.locationName ? `в ${item.locationName}` : "по Крыму",
    item.serviceArea ? `зона работы: ${item.serviceArea}` : null,
    item.routeExamples ? `маршруты: ${item.routeExamples}` : null,
    item.priceFrom !== null ? `стоимость от ${formatSchemaMoney(item.priceFrom, item.currency)}` : null,
    title,
  ]).join(". ");
}

function buildAmenityFeatures(values: string[]): JsonLdNode[] | undefined {
  const items = uniqueStrings(values)
    .slice(0, 12)
    .map((name) =>
      compactNode({
        "@type": "LocationFeatureSpecification",
        name,
        value: true,
      }),
    );

  return items.length > 0 ? items : undefined;
}

function buildOfferNode(input: {
  id: string;
  url: string;
  price: number | null;
  currency: string | null;
  description?: string | null;
}): JsonLdNode | undefined {
  if (input.price === null || !input.currency) {
    return undefined;
  }

  return compactNode({
    "@type": "Offer",
    "@id": input.id,
    url: input.url,
    price: input.price,
    priceCurrency: input.currency,
    description: input.description?.trim() || undefined,
  });
}

export function buildOrganizationStructuredData(): JsonLdNode {
  const address = buildPostalAddress({
    locality: companyConfig.locality,
    addressLine: companyConfig.addressLine,
  });

  return compactNode({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: companyConfig.brandName,
    legalName: companyConfig.legalName ?? undefined,
    url: absoluteUrl("/"),
    logo: absoluteUrl(companyConfig.logoPath),
    description: companyConfig.shortDescription,
    email: companyConfig.supportEmail ?? undefined,
    telephone: companyConfig.phone ?? undefined,
    address,
    areaServed: {
      "@type": "Place",
      name: "Крым",
    },
    sameAs: companyConfig.socialLinks.length > 0 ? companyConfig.socialLinks : undefined,
  });
}

export function buildWebsiteStructuredData(): JsonLdNode {
  return compactNode({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    url: absoluteUrl("/"),
    name: companyConfig.brandName,
    description: companyConfig.shortDescription,
    inLanguage: "ru-RU",
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
    potentialAction: {
      "@type": "SearchAction",
      target: absoluteUrl("/search?q={search_term_string}"),
      "query-input": "required name=search_term_string",
    },
  });
}

export function buildBreadcrumbListStructuredData(
  items: Array<{ name: string; path: string }>,
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildFaqStructuredData(
  items: Array<{ q?: string | null; a?: string | null }>,
): JsonLdNode | null {
  const entities = items
    .map((item) => ({
      question: item.q?.trim() ?? "",
      answer: item.a?.trim() ?? "",
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0)
    .map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    }));

  if (entities.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entities,
  };
}

export function buildCollectionPageStructuredData(input: {
  path: string;
  name: string;
  description?: string | null;
  items?: Array<{ name: string; path: string; image?: string | null }>;
}): JsonLdNode {
  const pageUrl = absoluteUrl(input.path);
  const items = (input.items ?? [])
    .map((item, index) =>
      compactNode({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
        image: toAbsoluteMediaUrl(item.image),
      }),
    )
    .filter((item) => item.name && item.url);
  const graph: JsonLdNode[] = [
    compactNode({
      "@type": "CollectionPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: input.name,
      description: input.description?.trim() || undefined,
      inLanguage: "ru-RU",
      isPartOf: {
        "@id": absoluteUrl("/#website"),
      },
      mainEntity: items.length > 0 ? { "@id": `${pageUrl}#itemlist` } : undefined,
    }),
  ];

  if (items.length > 0) {
    graph.push({
      "@type": "ItemList",
      "@id": `${pageUrl}#itemlist`,
      name: input.name,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: items.length,
      itemListElement: items,
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function buildPropertyStructuredData(item: PublicPropertyCard): JsonLdNode {
  const url = absoluteUrl(item.path);
  const description =
    item.description?.trim() ||
    [item.typeLabel ?? "Жильё", item.locationName ? `в ${item.locationName}` : "в Крыму"]
      .filter(Boolean)
      .join(" ");
  const images = item.media
    .filter((media) => media.type === "IMAGE")
    .map((media) => absoluteUrl(media.url))
    .slice(0, 12);
  const entityType = singleUnitPropertyTypeSet.has(normalizePropertyTypeId(item.type) ?? "")
    ? "VacationRental"
    : "LodgingBusiness";
  const address = buildPostalAddress({
    locality: item.locationName,
    addressLine: item.address,
  });
  const offer = buildOfferNode({
    id: `${url}#offer`,
    url,
    price: item.minNightPrice,
    currency: item.currency,
    description: item.minNightPrice
      ? `Стоимость размещения от ${item.minNightPrice} ${item.currency ?? ""} за ночь`
      : null,
  });
  const contactLinks = uniqueStrings([
    item.contacts.websiteUrl,
    normalizeWhatsappUrl(item.contacts.whatsappUrl),
    normalizeTelegramProfileUrl(item.contacts.telegramUrl),
    normalizeVkProfileUrl(item.contacts.vkUrl),
    normalizeMaxProfileUrl(item.contacts.maxUrl),
    normalizeOkProfileUrl(item.contacts.okUrl),
  ]);

  return compactNode({
    "@context": "https://schema.org",
    "@type": entityType,
    "@id": `${url}#entity`,
    name: item.name ?? "Объект размещения",
    description,
    url,
    image: images.length > 0 ? images : undefined,
    address,
    geo: buildGeo(item.latitude, item.longitude),
    telephone: item.contacts.phone?.trim() || item.contacts.phone2?.trim() || undefined,
    email: item.contacts.email?.trim() || undefined,
    sameAs: contactLinks.length > 0 ? contactLinks : undefined,
    checkinTime: item.rules.checkInFrom ?? undefined,
    checkoutTime: item.rules.checkOutUntil ?? undefined,
    numberOfRooms: item.activeRoomsCount > 0 ? item.activeRoomsCount : undefined,
    aggregateRating: buildAggregateRating(item.avgRating, item.reviewsCount),
    amenityFeature: buildAmenityFeatures([
      ...item.amenityHighlights,
      ...item.amenityGroups.property,
      ...item.amenityGroups.rooms,
    ]),
    offers: offer ?? undefined,
    petsAllowed:
      item.rules.petsPolicy === "ALLOWED"
        ? true
        : item.rules.petsPolicy === "FORBIDDEN"
          ? false
          : undefined,
  });
}

export function buildExcursionStructuredData(item: PublicExcursionCard): JsonLdNode {
  const url = absoluteUrl(item.path);
  const title = item.title ?? getOfferTypeLabel(item.offerType);
  const description =
    item.shortDescription?.trim() ||
    item.description?.trim() ||
    item.fullDescription?.trim() ||
    item.routeDescription?.trim() ||
    title;
  const images = item.photoUrls.map((photoUrl) => absoluteUrl(photoUrl)).slice(0, 12);
  const offerId = `${url}#offer`;
  const offer = buildOfferNode({
    id: offerId,
    url,
    price: item.priceFrom,
    currency: item.currency,
    description:
      item.priceFrom !== null
        ? `Стоимость от ${item.priceFrom} ${item.currency}${item.priceUnitLabel ? ` за ${item.priceUnitLabel}` : ""}`
        : null,
  });

  const productNode = compactNode({
    "@type": "Product",
    "@id": `${url}#product`,
    name: title,
    description,
    url,
    image: images.length > 0 ? images : undefined,
    category: item.categoryName ?? getOfferTypeLabel(item.offerType),
    aggregateRating: buildAggregateRating(item.avgRating, item.reviewsCount),
    offers: offer ? { "@id": offerId } : undefined,
  });

  const touristTripNode = compactNode({
    "@type": "TouristTrip",
    "@id": `${url}#trip`,
    name: title,
    description,
    url,
    image: images.length > 0 ? images : undefined,
    provider: { "@id": absoluteUrl("/#organization") },
  });

  const graph: JsonLdNode[] = [productNode, touristTripNode];
  if (offer) {
    graph.push(
      compactNode({
        ...offer,
        offeredBy: { "@id": absoluteUrl("/#organization") },
      }),
    );
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function buildTransferStructuredData(item: PublicTransferCatalogItem): JsonLdNode {
  const url = absoluteUrl(item.path);
  const title = item.title || item.transferType || "Трансфер по Крыму";
  const description = buildTransferDescription(item);
  const images = uniqueStrings([item.coverImageUrl, ...item.photoUrls])
    .map((photoUrl) => absoluteUrl(photoUrl))
    .slice(0, 12);
  const providerName =
    item.contacts.contactName?.trim() ||
    [item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ").trim() ||
    title;
  const address = buildPostalAddress({
    locality: item.locationName,
    addressLine: item.serviceArea,
  });
  const contactLinks = uniqueStrings([
    item.contacts.websiteUrl ? normalizeWebsiteUrl(item.contacts.websiteUrl) : null,
    normalizeWhatsappUrl(item.contacts.whatsappUrl),
    normalizeTelegramProfileUrl(item.contacts.telegramUrl),
    normalizeVkProfileUrl(item.contacts.vkUrl),
    normalizeMaxProfileUrl(item.contacts.maxUrl),
    normalizeOkProfileUrl(item.contacts.okUrl),
  ]);
  const serviceArea = uniqueStrings([item.serviceArea, item.locationName, "Крым"]).map((name) => ({
    "@type": "Place",
    name,
  }));
  const offerId = `${url}#offer`;
  const serviceId = `${url}#service`;
  const providerId = `${url}#provider`;
  const offerNode = compactNode({
    "@type": "Offer",
    "@id": offerId,
    url,
    price: item.priceFrom ?? undefined,
    priceCurrency: item.priceFrom !== null ? item.currency : undefined,
    description:
      item.priceFrom !== null
        ? `Стоимость трансфера от ${formatSchemaMoney(item.priceFrom, item.currency)}${item.priceUnitLabel ? ` ${item.priceUnitLabel}` : ""}`
        : "Стоимость трансфера уточняется при обращении.",
    availability: "https://schema.org/InStock",
  });
  const providerNode = compactNode({
    "@type": "LocalBusiness",
    "@id": providerId,
    name: providerName,
    url,
    image: images.length > 0 ? images[0] : undefined,
    telephone: item.contacts.phone?.trim() || undefined,
    email: item.contacts.email?.trim() || undefined,
    address,
    geo: buildGeo(item.latitude, item.longitude),
    areaServed: serviceArea,
    sameAs: contactLinks.length > 0 ? contactLinks : undefined,
    aggregateRating: buildAggregateRating(item.avgRating, item.reviewsCount),
  });
  const serviceNode = compactNode({
    "@type": "Service",
    "@id": serviceId,
    name: title,
    description,
    url,
    image: images.length > 0 ? images : undefined,
    serviceType: item.transferType ?? "Трансфер",
    areaServed: serviceArea,
    provider: { "@id": providerId },
    offers: { "@id": offerId },
    aggregateRating: buildAggregateRating(item.avgRating, item.reviewsCount),
  });

  return {
    "@context": "https://schema.org",
    "@graph": [serviceNode, offerNode, providerNode],
  };
}
