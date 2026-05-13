"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RulerDimensionLine,
  Users,
  Waves,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { NameBasedAmenityIcon } from "@/components/ui/amenity-icon";
import { AppIcon } from "@/components/ui/app-icon";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { useCarouselImagePreload } from "@/hooks/use-carousel-image-preload";
import { cn } from "@/lib/cn";
import { getRoomPriceNightlySuffix } from "@/lib/pricing";
import type { PublicCatalogItem } from "@/lib/public-properties";
import { stripSearchParamsFromPath } from "@/lib/seo/url-normalize";

const SWIPE_THRESHOLD = 50;
const ruNumberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function isLocalUploadUrl(value: string | null): boolean {
  return Boolean(value?.startsWith("/uploads/"));
}

type PublicPropertySearchCardProps = {
  item: PublicCatalogItem;
  initialIsFavorite: boolean;
  view?: "list" | "grid";
  prioritizeImage?: boolean;
  searchGuests?: number | null;
  isHighlighted?: boolean;
  isNew?: boolean;
  onWishlistToggle?: (isFavorite: boolean) => void;
};

function formatMoney(value: number, currency: string): string {
  const amount = ruNumberFormat.format(value);
  if (currency === "RUB") {
    return `${amount} ₽`;
  }
  return `${amount} ${currency}`;
}

function formatNightlyPrice(
  value: number,
  currency: string,
  priceType: PublicCatalogItem["minNightPriceType"] | "MIXED",
): string {
  return `${formatMoney(value, currency)} ${getRoomPriceNightlySuffix(priceType)}`;
}

function formatNightsLabel(nights: number): string {
  const abs = Math.abs(nights) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${nights} ночей`;
  if (last === 1) return `${nights} ночь`;
  if (last >= 2 && last <= 4) return `${nights} ночи`;
  return `${nights} ночей`;
}

function formatGuestsLabel(guests: number): string {
  const count = Math.max(1, Math.floor(guests));
  const abs = count % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${count} гостей`;
  if (last === 1) return `${count} гость`;
  if (last >= 2 && last <= 4) return `${count} гостя`;
  return `${count} гостей`;
}

function formatReviewsLabel(value: number): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${value} отзывов`;
  if (last === 1) return `${value} отзыв`;
  if (last >= 2 && last <= 4) return `${value} отзыва`;
  return `${value} отзывов`;
}

function formatRoomArea(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

function formatPlacesLabel(value: number): string {
  const places = Math.max(1, Math.floor(value));
  const abs = places % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${places} мест`;
  if (last === 1) return `${places} место`;
  if (last >= 2 && last <= 4) return `${places} места`;
  return `${places} мест`;
}

function formatRoomCapacityLabel(beds: number, extraBeds: number): string {
  const base = formatPlacesLabel(beds);
  return extraBeds > 0 ? `${base} + ${extraBeds} доп.` : base;
}

function formatRoomLayoutLabel(areaSqm: number | null, roomsCount: number): string | null {
  const parts: string[] = [];
  if (areaSqm !== null) {
    parts.push(`${formatRoomArea(areaSqm)} м²`);
  }
  parts.push(`${Math.max(1, Math.floor(roomsCount))}К`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatSeaDistance(label: string): string {
  const trimmed = label.trim();
  if (/\p{L}/u.test(trimmed)) return trimmed;
  const meters = parseInt(trimmed, 10);
  if (!Number.isFinite(meters)) return trimmed;
  if (meters < 1000) return `${meters} м до моря`;
  const km = (meters / 1000).toFixed(1).replace(/\.0$/, "");
  return `${km} км до моря`;
}

function stripCountryFromAddress(address: string): string {
  return address
    .replace(/,?\s*Россия\s*,?/gi, ", ")
    .replace(/,?\s*Республика\s+Крым\s*,?/gi, ", ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .replace(/,\s*,/g, ",");
}

function normalizeLocationChunk(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/[.,]+/g, ",")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .replace(/^,|,$/g, "")
    .trim();
}

function buildLocationLine(locationName: string | null, address: string | null): string {
  const city = stripCountryFromAddress(locationName ?? "").trim();
  const cleanAddress = stripCountryFromAddress(address ?? "").trim();

  if (!city && !cleanAddress) return "Крым";
  if (!city) return cleanAddress;
  if (!cleanAddress) return city;

  const cityNorm = normalizeLocationChunk(city);
  const addressNorm = normalizeLocationChunk(cleanAddress);
  const addressContainsCity =
    addressNorm === cityNorm ||
    addressNorm.startsWith(`${cityNorm},`) ||
    addressNorm.startsWith(`${cityNorm} `) ||
    addressNorm.includes(`,${cityNorm},`) ||
    addressNorm.endsWith(`,${cityNorm}`);

  return addressContainsCity ? cleanAddress : `${city}, ${cleanAddress}`;
}

type PriceSummary = {
  primary: string;
  secondary: string | null;
  roomLabel: string | null;
};

function buildPriceSummary(item: PublicCatalogItem): PriceSummary {
  const nights = Math.max(1, item.stayContext.nights);
  const hasDates = item.stayContext.mode === "selected";
  const guests = Math.max(1, Math.floor(item.stayContext.guests));

  if (item.stayPrice) {
    if (hasDates && item.stayPrice.nights > 1) {
      const isPerPerson = item.stayPrice.priceType === "PER_PERSON";
      const secondaryParts = [
        `${formatMoney(item.stayPrice.total, item.stayPrice.currency)} за ${formatNightsLabel(item.stayPrice.nights)}`,
        isPerPerson ? formatGuestsLabel(item.stayPrice.guests) : null,
        isPerPerson
          ? `${formatMoney(item.stayPrice.nightly, item.stayPrice.currency)} за человека`
          : null,
      ].filter((part): part is string => Boolean(part));

      return {
        primary: formatNightlyPrice(
          isPerPerson ? item.stayPrice.totalNightly : item.stayPrice.nightly,
          item.stayPrice.currency,
          isPerPerson ? "PER_ROOM" : item.stayPrice.priceType,
        ),
        secondary: secondaryParts.join(" · "),
        roomLabel: item.stayPrice.roomTitle ? `Номер: ${item.stayPrice.roomTitle}` : null,
      };
    }

    if (hasDates && item.stayPrice.priceType === "PER_PERSON") {
      return {
        primary: formatNightlyPrice(
          item.stayPrice.totalNightly,
          item.stayPrice.currency,
          "PER_ROOM",
        ),
        secondary: `${formatGuestsLabel(item.stayPrice.guests)} · ${formatMoney(item.stayPrice.nightly, item.stayPrice.currency)} за человека`,
        roomLabel: item.stayPrice.roomTitle ? `Номер: ${item.stayPrice.roomTitle}` : null,
      };
    }

    return {
      primary: formatNightlyPrice(
        item.stayPrice.nightly,
        item.stayPrice.currency,
        item.stayPrice.priceType,
      ),
      secondary: null,
      roomLabel: item.stayPrice.roomTitle ? `Номер: ${item.stayPrice.roomTitle}` : null,
    };
  }

  if (item.minNightPrice !== null && item.currency) {
    if (hasDates && nights > 1) {
      const isPerPerson = item.minNightPriceType === "PER_PERSON";
      const nightlyEstimate = isPerPerson ? item.minNightPrice * guests : item.minNightPrice;
      const estimatedTotal = nightlyEstimate * nights;
      const secondaryParts = [
        `от ${formatMoney(estimatedTotal, item.currency)} за ${formatNightsLabel(nights)}`,
        isPerPerson ? formatGuestsLabel(guests) : null,
        isPerPerson ? `${formatMoney(item.minNightPrice, item.currency)} за человека` : null,
      ].filter((part): part is string => Boolean(part));

      return {
        primary: `от ${formatNightlyPrice(
          nightlyEstimate,
          item.currency,
          isPerPerson ? "PER_ROOM" : item.minNightPriceType,
        )}`,
        secondary: secondaryParts.join(" · "),
        roomLabel: item.roomSnapshot?.title ? `Номер: ${item.roomSnapshot.title}` : null,
      };
    }
    return {
      primary: `от ${formatNightlyPrice(item.minNightPrice, item.currency, item.minNightPriceType)}`,
      secondary: null,
      roomLabel: item.roomSnapshot?.title ? `Номер: ${item.roomSnapshot.title}` : null,
    };
  }

  return {
    primary: "Цена по запросу",
    secondary: null,
    roomLabel: null,
  };
}

function formatAmenityLabel(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU");
  if (
    /^кухонные принадлежности\s*(?:\/|и)\s*посуда\s*\/\s*(?:приборы|столовые приборы)$/.test(
      normalized,
    )
  ) {
    return "Кухонные принадлежности";
  }

  return name;
}

function getRatingText(rating: number): string {
  if (rating >= 4.8) return "Превосходно";
  if (rating >= 4.5) return "Отлично";
  if (rating >= 4.0) return "Очень хорошо";
  if (rating >= 3.5) return "Хорошо";
  return "Нормально";
}

const NEW_BADGE_DAYS = 5;

type StatusBadgeTone = "top" | "new" | "sale";
type StatusBadge = { label: string; tone: StatusBadgeTone };

function resolveStatusBadges(input: PublicCatalogItem): StatusBadge[] {
  const badges: StatusBadge[] = [];
  const createdAtMs = Date.parse(input.createdAt);
  const isPublishedRecently =
    Number.isFinite(createdAtMs) &&
    Date.now() - createdAtMs <= NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
  if (isPublishedRecently) badges.push({ label: "НОВОЕ", tone: "new" });
  if (
    input.stayPrice &&
    input.minNightPrice !== null &&
    input.minNightPrice > input.stayPrice.nightly &&
    input.currency === input.stayPrice.currency &&
    input.minNightPriceType === input.stayPrice.priceType
  ) {
    const discountPercent = Math.round((1 - input.stayPrice.nightly / input.minNightPrice) * 100);
    badges.push({
      label: discountPercent >= 5 ? `−${discountPercent}%` : "СКИДКА",
      tone: "sale",
    });
  }
  if (input.reviewsCount >= 12 && input.avgRating >= 4.8)
    badges.push({ label: "ТОП", tone: "top" });
  return badges.slice(0, 3);
}

function PublicPropertySearchCardInner({
  item,
  initialIsFavorite,
  view = "list",
  prioritizeImage = false,
  isHighlighted = false,
  isNew = false,
  onWishlistToggle,
}: PublicPropertySearchCardProps) {
  const titleId = `property-card-title-${item.id}`;
  const cardRef = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeHandledRef = useRef(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [referenceOptimizedSrc, setReferenceOptimizedSrc] = useState<string | null>(null);
  const [brokenImageUrls, setBrokenImageUrls] = useState<Set<string>>(() => new Set());

  const imageCandidates = useMemo(() => {
    const source =
      item.imageUrls.length > 0 ? item.imageUrls : item.coverImageUrl ? [item.coverImageUrl] : [];
    return Array.from(new Set(source.map((v) => v.trim()).filter((v) => v.length > 0))).slice(0, 8);
  }, [item.coverImageUrl, item.imageUrls]);

  const images = useMemo(
    () => imageCandidates.filter((v) => !brokenImageUrls.has(v)),
    [brokenImageUrls, imageCandidates],
  );

  const safeImageIndex =
    images.length > 0 ? ((imageIndex % images.length) + images.length) % images.length : 0;
  const currentImage = images.length > 0 ? images[safeImageIndex] : null;
  const readyImages = useCarouselImagePreload(images, safeImageIndex, {
    enabled: images.length > 1,
    preloadCount: 2,
    referenceOptimizedSrc,
  });
  const isImageLoaded =
    currentImage !== null && (loadedImageUrl === currentImage || readyImages.has(currentImage));
  const shouldShowImageSkeleton = !isImageLoaded && loadedImageUrl === null;
  const shouldBypassImageOptimizer = isLocalUploadUrl(currentImage);

  const priceSummary = useMemo(() => buildPriceSummary(item), [item]);
  const badges = useMemo(() => resolveStatusBadges(item), [item]);
  const seaDistanceLabel = item.seaDistanceLabel?.trim() || null;
  const representativeRoom = useMemo(() => {
    if (item.roomSnapshot) {
      return item.roomSnapshot;
    }
    return item.roomPreviews[0] ?? null;
  }, [item.roomPreviews, item.roomSnapshot]);
  const roomCapacityText = representativeRoom
    ? formatRoomCapacityLabel(representativeRoom.beds, representativeRoom.extraBeds)
    : null;
  const roomLayoutText = representativeRoom
    ? formatRoomLayoutLabel(representativeRoom.areaSqm, representativeRoom.roomsCount)
    : null;
  const starCount = Math.max(0, Math.min(5, Math.floor(item.starRating)));
  const isGrid = view === "grid";

  const amenityLimitGrid = 4;
  const amenityLimitList = 6;
  const amenityLimit = isGrid ? amenityLimitGrid : amenityLimitList;
  const amenityHighlights = useMemo(
    () => item.amenityHighlights.slice(0, amenityLimit),
    [amenityLimit, item.amenityHighlights],
  );
  const remainingAmenitiesCount = Math.max(
    0,
    item.amenityHighlights.length - amenityHighlights.length,
  );

  const detailsHref = useMemo(() => stripSearchParamsFromPath(item.path), [item.path]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !isNew) return;
    const handler = () => el.classList.remove("is-new");
    el.addEventListener("animationend", handler);
    return () => el.removeEventListener("animationend", handler);
  }, [isNew]);

  const locationLine = useMemo(
    () => buildLocationLine(item.locationName, item.address),
    [item.address, item.locationName],
  );

  function cycleImage(direction: -1 | 1) {
    if (images.length <= 1) return;
    setImageIndex((prev) =>
      direction === 1 ? (prev + 1) % images.length : (prev - 1 + images.length) % images.length,
    );
  }

  function handleImageError() {
    if (!currentImage) return;
    setLoadedImageUrl(null);
    setBrokenImageUrls((prev) => {
      if (prev.has(currentImage)) return prev;
      const next = new Set(prev);
      next.add(currentImage);
      return next;
    });
  }

  function handleOverlayTouchStart(event: React.TouchEvent<HTMLAnchorElement>) {
    if (images.length <= 1) return;
    swipeHandledRef.current = false;
    touchEndX.current = null;
    touchStartX.current = event.targetTouches[0]?.clientX ?? null;
  }

  function handleOverlayTouchMove(event: React.TouchEvent<HTMLAnchorElement>) {
    if (images.length <= 1) return;
    touchEndX.current = event.targetTouches[0]?.clientX ?? null;
  }

  function handleOverlayTouchEnd() {
    if (images.length <= 1 || touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) >= SWIPE_THRESHOLD) {
      swipeHandledRef.current = true;
      cycleImage(distance > 0 ? 1 : -1);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!swipeHandledRef.current) return;
    event.preventDefault();
    swipeHandledRef.current = false;
  }

  // ── Shared image block ──────────────────────────────────────────────
  const imageBlock = (
    <div
      className={cn(
        "card-img-wrap relative shrink-0 overflow-hidden bg-sand",
        isGrid
          ? "aspect-[4/3] w-full rounded-xl"
          : "aspect-[4/3] w-full rounded-xl sm:aspect-[3/2] md:aspect-[4/3] md:h-auto md:w-[240px] lg:w-[280px] md:rounded-l-xl md:rounded-r-none",
      )}
    >
      {currentImage ? (
        <>
          <Image
            src={currentImage}
            alt={item.name}
            priority={prioritizeImage}
            loading={prioritizeImage ? "eager" : "lazy"}
            fetchPriority={prioritizeImage ? "high" : "low"}
            width={400}
            height={300}
            quality={72}
            unoptimized={shouldBypassImageOptimizer}
            sizes={
              isGrid
                ? "(min-width: 1536px) 18vw, (min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 480px) 50vw, 100vw"
                : "(min-width: 1280px) 280px, (min-width: 768px) 240px, 100vw"
            }
            onLoad={(event) => {
              setLoadedImageUrl(currentImage);
              setReferenceOptimizedSrc(event.currentTarget.currentSrc || event.currentTarget.src);
            }}
            onError={handleImageError}
            className={cn(
              "card-img h-full w-full object-cover transition-all duration-500",
              isImageLoaded ? "opacity-100" : "opacity-0",
            )}
          />
          {shouldShowImageSkeleton && (
            <div className="catalog-skeleton absolute inset-0" aria-hidden="true" />
          )}
        </>
      ) : (
        <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-olive/40">
          Без фото
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5">
          {badges.map((badge) => (
            <span
              key={`${item.id}-badge-${badge.label}`}
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm",
                badge.tone === "top"
                  ? "bg-gradient-to-r from-primary to-emerald-500"
                  : badge.tone === "sale"
                    ? "bg-gradient-to-r from-terra to-rose-500"
                    : "bg-gradient-to-r from-amber-400 to-orange-400",
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {/* Favorite button */}
      <div className="pointer-events-auto absolute right-2 top-2 z-30 p-1 sm:right-2.5 sm:top-2.5">
        <FavoriteToggleButton
          itemId={item.id}
          initialIsFavorite={initialIsFavorite}
          variant="icon"
          onToggle={onWishlistToggle}
        />
      </div>

      {/* Photo count */}
      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <AppIcon icon={Camera} className="h-3 w-3" />
          {images.length}
        </div>
      )}

      {/* Carousel dots + arrows */}
      {images.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1 md:opacity-0 md:transition md:duration-200 md:group-hover:opacity-100">
            {images.map((_, index) => (
              <span
                key={`dot-${item.id}-${index}`}
                className="rounded-full transition-all duration-300"
                style={{
                  width: safeImageIndex === index ? 14 : 5,
                  height: 5,
                  backgroundColor: safeImageIndex === index ? "white" : "rgba(255,255,255,0.5)",
                  borderRadius: "9999px",
                }}
              />
            ))}
          </div>

          <div className="pointer-events-auto absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
            <button
              type="button"
              onClick={() => cycleImage(-1)}
              aria-label="Предыдущее фото"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-olive/80 shadow-sm backdrop-blur-sm transition hover:bg-white"
            >
              <AppIcon icon={ChevronLeft} className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => cycleImage(1)}
              aria-label="Следующее фото"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-olive/80 shadow-sm backdrop-blur-sm transition hover:bg-white"
            >
              <AppIcon icon={ChevronRight} className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ── Rating block ──────────────────────────────────────────────────────
  const ratingBlock =
    item.avgRating > 0 ? (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center rounded-lg bg-primary px-2 py-1 text-[13px] font-bold leading-none text-white">
          {item.avgRating.toFixed(1)}
        </span>
        <div className="min-w-0">
          <span className="text-[12px] font-semibold text-olive">
            {getRatingText(item.avgRating)}
          </span>
          {item.reviewsCount > 0 && (
            <span className="ml-1 text-[12px] text-olive/45">
              · {formatReviewsLabel(item.reviewsCount)}
            </span>
          )}
        </div>
      </div>
    ) : null;

  // ── Sea distance tag ──────────────────────────────────────────────────
  const seaTag = seaDistanceLabel ? (
    <span className="inline-flex items-center gap-1 rounded-lg bg-foam px-2 py-1 text-[11px] font-semibold text-accent">
      <AppIcon icon={Waves} className="h-3 w-3 shrink-0" />
      {formatSeaDistance(seaDistanceLabel)}
    </span>
  ) : null;

  // ── Capacity tag ──────────────────────────────────────────────────────
  const capacityTag = roomCapacityText ? (
    <span className="inline-flex items-center gap-1 rounded-lg bg-primary/8 px-2 py-1 text-[11px] font-semibold text-primary">
      <AppIcon icon={Users} className="h-3 w-3" />
      {roomCapacityText}
    </span>
  ) : null;

  const roomLayoutTag = roomLayoutText ? (
    <span className="inline-flex items-center gap-1 rounded-lg bg-sand/70 px-2 py-1 text-[11px] font-semibold text-olive/70">
      <AppIcon icon={RulerDimensionLine} className="h-3 w-3" />
      {roomLayoutText}
    </span>
  ) : null;

  // ── Amenities ─────────────────────────────────────────────────────────
  const amenitiesBlock =
    amenityHighlights.length > 0 ? (
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Ключевые удобства">
        {amenityHighlights.map((amenity) => {
          const label = formatAmenityLabel(amenity);

          return (
            <span
              key={`${item.id}-amenity-${amenity}`}
              title={label}
              role="listitem"
              className="inline-flex items-center gap-1 rounded-md bg-sand/50 px-2 py-0.5 text-[11px] font-medium text-olive/60"
            >
              <NameBasedAmenityIcon name={amenity} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
          );
        })}
        {remainingAmenitiesCount > 0 && (
          <span className="inline-flex items-center rounded-md border border-dashed border-olive/12 bg-white px-2 py-0.5 text-[11px] font-semibold text-olive/45">
            +{remainingAmenitiesCount}
          </span>
        )}
      </div>
    ) : null;

  // ── GRID VIEW ─────────────────────────────────────────────────────────
  if (isGrid) {
    return (
      <article
        ref={cardRef}
        className={cn(
          "result-card group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300",
          isNew ? "is-new" : "",
          isHighlighted
            ? "border-primary/30 shadow-[0_0_0_2px_rgba(15,118,110,0.2),0_16px_40px_rgba(15,118,110,0.15)]"
            : "border-olive/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] hover:border-primary/15 hover:shadow-[0_8px_30px_-8px_rgba(15,118,110,0.15)]",
        )}
        aria-label={`Открыть карточку ${item.name}`}
      >
        <Link
          href={detailsHref}
          aria-labelledby={titleId}
          aria-label={`Открыть карточку ${item.name}`}
          onTouchStart={handleOverlayTouchStart}
          onTouchMove={handleOverlayTouchMove}
          onTouchEnd={handleOverlayTouchEnd}
          onClick={handleOverlayClick}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        />

        <div className="pointer-events-none relative z-20 flex h-full flex-col">
          {/* Image */}
          {imageBlock}

          {/* Content */}
          <div className="flex flex-1 flex-col gap-2 p-3 pb-0">
            {/* Type + stars */}
            <div className="flex items-center gap-2">
              {item.typeLabel && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                  {item.typeLabel}
                </span>
              )}
              {starCount > 0 && (
                <span className="text-[11px] text-amber-400" aria-label={`${starCount} звезды`}>
                  {"★".repeat(starCount)}
                </span>
              )}
            </div>

            {/* Title */}
            <h2
              id={titleId}
              title={item.name}
              className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-olive"
            >
              {item.name}
            </h2>

            {/* Location */}
            <p className="flex items-start gap-1 text-[12px] leading-snug text-olive/50">
              <AppIcon icon={MapPin} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive/30" />
              <span className="line-clamp-1">{locationLine}</span>
            </p>

            {/* Rating */}
            {ratingBlock}

            {/* Distance tags */}
            {(seaTag || capacityTag || roomLayoutTag) && (
              <div className="flex flex-wrap gap-1.5">
                {seaTag}
                {capacityTag}
                {roomLayoutTag}
              </div>
            )}

            {/* Amenities - compact in grid */}
            {amenitiesBlock}
          </div>

          {/* Price + CTA pinned to bottom */}
          <div className="mt-auto border-t border-olive/[0.06] p-3">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[17px] font-extrabold leading-tight tracking-tight text-olive">
                  {priceSummary.primary}
                </p>
                {priceSummary.secondary && (
                  <p className="mt-0.5 text-[11px] text-olive/40">{priceSummary.secondary}</p>
                )}
              </div>
              <Link
                href={detailsHref}
                className="pointer-events-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-primary px-4 text-[12px] font-bold text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md active:scale-[0.97]"
              >
                Выбрать
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </article>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────
  return (
    <article
      ref={cardRef}
      className={cn(
        "result-card group relative overflow-hidden rounded-2xl border bg-white transition-all duration-300",
        isNew ? "is-new" : "",
        isHighlighted
          ? "border-primary/30 shadow-[0_0_0_2px_rgba(15,118,110,0.2),0_16px_40px_rgba(15,118,110,0.15)]"
          : "border-olive/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] hover:border-primary/15 hover:shadow-[0_8px_30px_-8px_rgba(15,118,110,0.15)]",
      )}
      aria-label={`Открыть карточку ${item.name}`}
    >
      <Link
        href={detailsHref}
        aria-labelledby={titleId}
        aria-label={`Открыть карточку ${item.name}`}
        onTouchStart={handleOverlayTouchStart}
        onTouchMove={handleOverlayTouchMove}
        onTouchEnd={handleOverlayTouchEnd}
        onClick={handleOverlayClick}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
      />

      <div className="pointer-events-none relative z-20 flex flex-col md:flex-row">
        {/* Image */}
        {imageBlock}

        {/* Content: center + right */}
        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4 md:flex-row md:gap-4">
          {/* Center content */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Type + stars row */}
            <div className="flex items-center gap-2">
              {item.typeLabel && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                  {item.typeLabel}
                </span>
              )}
              {starCount > 0 && (
                <span className="text-[11px] text-amber-400" aria-label={`${starCount} звезды`}>
                  {"★".repeat(starCount)}
                </span>
              )}
            </div>

            {/* Title */}
            <h2
              id={titleId}
              title={item.name}
              className="text-[16px] font-bold leading-snug tracking-tight text-olive [overflow-wrap:anywhere] sm:text-[18px]"
            >
              {item.name}
            </h2>

            {/* Location */}
            <p className="flex items-start gap-1.5 text-[13px] leading-snug text-olive/50">
              <AppIcon icon={MapPin} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive/30" />
              <span className="[overflow-wrap:anywhere]">{locationLine}</span>
            </p>

            {/* Distance + capacity tags */}
            {(seaTag || capacityTag || roomLayoutTag) && (
              <div className="flex flex-wrap gap-1.5">
                {seaTag}
                {capacityTag}
                {roomLayoutTag}
              </div>
            )}

            {/* Amenities */}
            {amenitiesBlock}

            {/* Mobile rating + price (visible below md) */}
            <div className="mt-auto flex items-end justify-between gap-3 border-t border-olive/[0.06] pt-3 md:hidden">
              <div className="min-w-0 space-y-1">
                {ratingBlock}
                <p className="text-[17px] font-extrabold leading-tight tracking-tight text-olive">
                  {priceSummary.primary}
                </p>
                {priceSummary.secondary && (
                  <p className="text-[11px] text-olive/40">{priceSummary.secondary}</p>
                )}
              </div>
              <Link
                href={detailsHref}
                className="pointer-events-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 active:scale-[0.97]"
              >
                Подробнее
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Right column: rating + price + CTA (desktop only) */}
          <div className="hidden shrink-0 flex-col items-end justify-between border-l border-olive/[0.06] pl-4 md:flex md:w-[190px] lg:w-[210px]">
            {/* Rating top-right */}
            <div className="text-right">
              {item.avgRating > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[12px] font-semibold text-olive">
                      {getRatingText(item.avgRating)}
                    </span>
                    {item.reviewsCount > 0 && (
                      <p className="text-[11px] text-olive/40">
                        {formatReviewsLabel(item.reviewsCount)}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[14px] font-bold text-white">
                    {item.avgRating.toFixed(1)}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Price + CTA bottom-right */}
            <div className="mt-auto text-right">
              <p className="text-[18px] font-extrabold leading-tight tracking-tight text-olive">
                {priceSummary.primary}
              </p>
              {priceSummary.secondary && (
                <p className="mt-0.5 text-[11px] text-olive/40">{priceSummary.secondary}</p>
              )}
              {priceSummary.roomLabel && (
                <p className="mt-1 text-[11px] text-olive/40">{priceSummary.roomLabel}</p>
              )}
              <Link
                href={detailsHref}
                className="pointer-events-auto mt-2.5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md active:scale-[0.97]"
              >
                Подробнее
                <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function arePublicPropertySearchCardPropsEqual(
  prev: PublicPropertySearchCardProps,
  next: PublicPropertySearchCardProps,
) {
  return (
    prev.item === next.item &&
    prev.initialIsFavorite === next.initialIsFavorite &&
    prev.view === next.view &&
    prev.prioritizeImage === next.prioritizeImage &&
    prev.searchGuests === next.searchGuests &&
    prev.isHighlighted === next.isHighlighted &&
    prev.isNew === next.isNew &&
    prev.onWishlistToggle === next.onWishlistToggle
  );
}

export const PublicPropertySearchCard = memo(
  PublicPropertySearchCardInner,
  arePublicPropertySearchCardPropsEqual,
);

PublicPropertySearchCard.displayName = "PublicPropertySearchCard";
