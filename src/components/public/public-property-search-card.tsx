"use client";

import Link from "next/link";
import {
  AirVent,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleParking,
  Coffee,
  CookingPot,
  MapPin,
  Mountain,
  PanelsTopLeft,
  PawPrint,
  Star,
  Users,
  Van,
  WashingMachine,
  Waves,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { cn } from "@/lib/cn";
import type { PublicCatalogItem } from "@/lib/public-properties";

const SWIPE_THRESHOLD = 50;

type PublicPropertySearchCardProps = {
  item: PublicCatalogItem;
  initialIsFavorite: boolean;
  view?: "list" | "grid";
  searchGuests?: number | null;
  isHighlighted?: boolean;
  isNew?: boolean;
  onWishlistToggle?: (isFavorite: boolean) => void;
};

function formatMoney(value: number, currency: string): string {
  const amount = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
  if (currency === "RUB") {
    return `${amount} ₽`;
  }
  return `${amount} ${currency}`;
}

function formatNightsLabel(nights: number): string {
  const abs = Math.abs(nights) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${nights} ночей`;
  if (last === 1) return `${nights} ночь`;
  if (last >= 2 && last <= 4) return `${nights} ночи`;
  return `${nights} ночей`;
}

function formatReviewsLabel(value: number): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${value} отзывов`;
  if (last === 1) return `${value} отзыв`;
  if (last >= 2 && last <= 4) return `${value} отзыва`;
  return `${value} отзывов`;
}

function formatSeaDistance(label: string): string {
  const trimmed = label.trim();
  // If already descriptive (contains letters), return as-is
  if (/\p{L}/u.test(trimmed)) return trimmed;
  // Pure number вЂ” treat as meters
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
  /** Primary (large) price line */
  primary: string;
  /** Secondary (small) price line */
  secondary: string | null;
  roomLabel: string | null;
};

function buildPriceSummary(item: PublicCatalogItem): PriceSummary {
  const nights = Math.max(1, item.stayContext.nights);
  const hasDates = item.stayContext.mode === "selected";

  if (item.stayPrice) {
    if (hasDates && item.stayPrice.nights > 1) {
      // Dates selected, multi-night: total on top, per-night below
      return {
        primary: `${formatMoney(item.stayPrice.total, item.stayPrice.currency)} за ${formatNightsLabel(item.stayPrice.nights)}`,
        secondary: `${formatMoney(item.stayPrice.nightly, item.stayPrice.currency)} за ночь`,
        roomLabel: item.stayPrice.roomTitle ? `Номер: ${item.stayPrice.roomTitle}` : null,
      };
    }
    // No dates or 1 night: per-night price
    return {
      primary: `${formatMoney(item.stayPrice.nightly, item.stayPrice.currency)} / ночь`,
      secondary: null,
      roomLabel: item.stayPrice.roomTitle ? `Номер: ${item.stayPrice.roomTitle}` : null,
    };
  }

  if (item.minNightPrice !== null && item.currency) {
    if (hasDates && nights > 1) {
      const estimatedTotal = item.minNightPrice * nights;
      return {
        primary: `от ${formatMoney(estimatedTotal, item.currency)} за ${formatNightsLabel(nights)}`,
        secondary: `от ${formatMoney(item.minNightPrice, item.currency)} за ночь`,
        roomLabel: item.roomSnapshot?.title ? `Номер: ${item.roomSnapshot.title}` : null,
      };
    }
    return {
      primary: `от ${formatMoney(item.minNightPrice, item.currency)} / ночь`,
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

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <AppIcon icon={direction === "left" ? ChevronLeft : ChevronRight} className="h-4 w-4" />
  );
}

function ArrowIcon() {
  return <AppIcon icon={ArrowRight} className="h-4 w-4" />;
}

function PinIcon({ className }: { className?: string }) {
  return <AppIcon icon={MapPin} className={className} />;
}

function StarIcon({ className }: { className?: string }) {
  return <AppIcon icon={Star} className={className} filled />;
}

function UsersIcon({ className }: { className?: string }) {
  return <AppIcon icon={Users} className={className} />;
}

function resolveAmenityIcon(name: string): LucideIcon {
  const normalized = name.toLowerCase();

  if (/wi-?fi|интернет/.test(normalized)) {
    return Wifi;
  }

  if (/парков|parking/.test(normalized)) {
    return CircleParking;
  }

  if (/кухн|мини[\s-]?кух|плит|печь|stove/.test(normalized)) {
    return CookingPot;
  }

  if (/басс|pool/.test(normalized)) {
    return Waves;
  }

  if (/кондиц|ac|air/.test(normalized)) {
    return AirVent;
  }

  if (/вид на море|sea view/.test(normalized)) {
    return Waves;
  }

  if (/вид на гор|mountain view/.test(normalized)) {
    return Mountain;
  }

  if (/панорам/.test(normalized)) {
    return PanelsTopLeft;
  }

  if (/балкон|террас|balcony|terrace/.test(normalized)) {
    return PanelsTopLeft;
  }

  if (/живот|pets|pet/.test(normalized)) {
    return PawPrint;
  }

  if (/завтрак|breakfast/.test(normalized)) {
    return Coffee;
  }

  if (/трансфер|shuttle|transfer/.test(normalized)) {
    return Van;
  }

  if (/стирал|washer|laundry/.test(normalized)) {
    return WashingMachine;
  }

  return CircleCheckBig;
}

function AmenityGlyph({ name }: { name: string }) {
  return <AppIcon icon={resolveAmenityIcon(name)} className="h-4 w-4" />;
}

const NEW_BADGE_DAYS = 5;

type StatusBadgeTone = "top" | "new" | "sale";

type StatusBadge = {
  label: string;
  tone: StatusBadgeTone;
};

function resolveStatusBadges(input: PublicCatalogItem): StatusBadge[] {
  const badges: StatusBadge[] = [];
  const createdAtMs = Date.parse(input.createdAt);
  const isPublishedRecently =
    Number.isFinite(createdAtMs) &&
    Date.now() - createdAtMs <= NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;

  if (isPublishedRecently) {
    badges.push({ label: "НОВОЕ", tone: "new" });
  }

  if (
    input.stayPrice &&
    input.minNightPrice !== null &&
    input.minNightPrice > input.stayPrice.nightly &&
    input.currency === input.stayPrice.currency
  ) {
    const discountPercent = Math.round((1 - input.stayPrice.nightly / input.minNightPrice) * 100);
    badges.push({
      label: discountPercent >= 5 ? `−${discountPercent}%` : "СКИДКА",
      tone: "sale",
    });
  }

  if (input.reviewsCount >= 12 && input.avgRating >= 4.8) {
    badges.push({ label: "ТОП", tone: "top" });
  }

  return badges.slice(0, 3);
}

export function PublicPropertySearchCard({
  item,
  initialIsFavorite,
  view = "list",
  searchGuests = null,
  isHighlighted = false,
  isNew = false,
  onWishlistToggle,
}: PublicPropertySearchCardProps) {
  const titleId = `property-card-title-${item.id}`;
  const cardRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeHandledRef = useRef(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
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
  const isImageLoaded = currentImage !== null && loadedImageUrl === currentImage;

  const priceSummary = useMemo(() => buildPriceSummary(item), [item]);
  const badges = useMemo(() => resolveStatusBadges(item), [item]);
  const seaDistanceLabel = item.seaDistanceLabel?.trim() || null;
  const roomCapacity = useMemo(() => {
    const byRoomPreview = item.roomPreviews.reduce((max, room) => Math.max(max, room.maxGuests), 0);
    if (byRoomPreview > 0) return byRoomPreview;
    if (!item.roomSnapshot) return null;
    const snapshotCapacity = item.roomSnapshot.beds + item.roomSnapshot.extraBeds;
    return snapshotCapacity > 0 ? snapshotCapacity : null;
  }, [item.roomPreviews, item.roomSnapshot]);
  const starCount = Math.max(0, Math.min(5, Math.floor(item.starRating)));
  const isGrid = view === "grid";
  const amenityLimit = isGrid ? 4 : 3;
  const amenityHighlights = useMemo(
    () => item.amenityHighlights.slice(0, amenityLimit),
    [amenityLimit, item.amenityHighlights],
  );
  const remainingAmenitiesCount = Math.max(
    0,
    item.amenityHighlights.length - amenityHighlights.length,
  );

  const guestsForLinks = useMemo(() => {
    if (typeof searchGuests === "number" && Number.isFinite(searchGuests) && searchGuests > 0) {
      return Math.floor(searchGuests);
    }
    if (roomCapacity !== null && roomCapacity > 0) return roomCapacity;
    return 2;
  }, [roomCapacity, searchGuests]);

  const detailsHref = useMemo(() => {
    const [rawPath, rawQuery = ""] = item.path.split("?");
    const params = new URLSearchParams(rawQuery);
    const checkInFromPath = params.get("checkIn")?.trim() ?? "";
    const checkOutFromPath = params.get("checkOut")?.trim() ?? "";
    const guestsFromPath = params.get("guests")?.trim() ?? "";
    const adultsFromPath = params.get("guestsAdults")?.trim() ?? "";
    const childrenFromPath = params.get("guestsChildren")?.trim() ?? "";

    params.set("checkIn", checkInFromPath || item.stayContext.checkIn);
    params.set("checkOut", checkOutFromPath || item.stayContext.checkOut);
    params.set("guests", guestsFromPath || String(guestsForLinks));
    params.set("guestsAdults", adultsFromPath || String(guestsForLinks));
    params.set("guestsChildren", childrenFromPath || "0");
    return `${rawPath}?${params.toString()}`;
  }, [guestsForLinks, item.path, item.stayContext.checkIn, item.stayContext.checkOut]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !isNew) return;
    const handler = () => el.classList.remove("is-new");
    el.addEventListener("animationend", handler);
    return () => el.removeEventListener("animationend", handler);
  }, [isNew]);

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

  function handleImageRef(node: HTMLImageElement | null) {
    imageRef.current = node;
    if (!node || !currentImage) return;
    if (node.complete && node.naturalWidth > 0) {
      setLoadedImageUrl((prev) => (prev === currentImage ? prev : currentImage));
    }
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

  const locationLine = useMemo(
    () => buildLocationLine(item.locationName, item.address),
    [item.address, item.locationName],
  );

  return (
    <article
      ref={cardRef}
      className={cn(
        "result-card group relative overflow-hidden rounded-2xl border bg-white",
        isGrid ? "flex h-full min-h-[460px] flex-col p-2 md:p-2.5" : "w-full p-2.5 md:p-2.5",
        isNew ? "is-new" : "",
        isHighlighted
          ? "border-primary/30 shadow-[0_0_0_2px_rgba(15,118,110,0.25),0_20px_48px_rgba(15,118,110,0.18)]"
          : "border-olive/6 shadow-[0_2px_16px_rgba(0,0,0,0.06)] hover:border-primary/15 hover:shadow-[0_20px_40px_-12px_rgba(15,118,110,0.18),0_8px_20px_rgba(0,0,0,0.06)]",
      )}
      aria-label={`Открыть карточку ${item.name}`}
    >
      {/* Full-card link overlay */}
      <Link
        href={detailsHref}
        aria-labelledby={titleId}
        aria-label={`Открыть карточку ${item.name}`}
        onTouchStart={handleOverlayTouchStart}
        onTouchMove={handleOverlayTouchMove}
        onTouchEnd={handleOverlayTouchEnd}
        onClick={handleOverlayClick}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      />

      <div
        className={cn(
          "pointer-events-none relative z-20 min-w-0",
          isGrid ? "flex h-full flex-col gap-3" : "flex flex-col gap-3 md:flex-row md:gap-4",
        )}
      >
        {/* в”Ђв”Ђ IMAGE в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
        <div
          className={cn(
            "card-img-wrap relative shrink-0 overflow-hidden rounded-xl bg-sand",
            isGrid
              ? "aspect-square w-full"
              : "aspect-[4/3] w-full sm:aspect-[16/11] md:aspect-square md:h-auto md:w-[220px] lg:w-[240px]",
          )}
        >
          {currentImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={currentImage}
                ref={handleImageRef}
                src={currentImage}
                alt={item.name}
                loading="lazy"
                decoding="async"
                sizes={
                  isGrid
                    ? "(min-width: 1024px) 40vw, 100vw"
                    : "(min-width: 1280px) 240px, (min-width: 768px) 220px, 100vw"
                }
                onLoad={() => setLoadedImageUrl(currentImage)}
                onError={handleImageError}
                className={cn(
                  "card-img h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03]",
                  isImageLoaded ? "opacity-100" : "opacity-0",
                )}
              />
              {!isImageLoaded && (
                <div className="catalog-skeleton absolute inset-0" aria-hidden="true" />
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-olive/40">
              Без фото
            </div>
          )}

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-midnight/50 to-transparent" />

          {/* Badges вЂ” horizontal row, top-left */}
          {badges.length > 0 && (
            <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5">
              {badges.map((badge) => (
                <span
                  key={`${item.id}-badge-${badge.label}`}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm",
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
          <div className="pointer-events-auto absolute right-2 top-2">
            <FavoriteToggleButton
              propertyId={item.id}
              initialIsFavorite={initialIsFavorite}
              variant="icon"
              className="border-white/70 bg-white/88 text-olive/90 backdrop-blur-md"
              onToggle={onWishlistToggle}
            />
          </div>

          {/* Carousel controls */}
          {images.length > 1 && (
            <>
              {/* Dot indicators */}
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1 md:opacity-0 md:transition md:duration-200 md:group-hover:opacity-100">
                {images.map((_, index) => (
                  <span
                    key={`dot-${item.id}-${index}`}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: safeImageIndex === index ? 16 : 5,
                      height: 5,
                      backgroundColor: safeImageIndex === index ? "white" : "rgba(255,255,255,0.5)",
                      borderRadius: "9999px",
                    }}
                  />
                ))}
              </div>

              {/* Prev / Next buttons вЂ” desktop */}
              <div className="pointer-events-auto absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
                <button
                  type="button"
                  onClick={() => cycleImage(-1)}
                  aria-label="Предыдущее фото"
                  className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full"
                >
                  <ChevronIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={() => cycleImage(1)}
                  aria-label="Следующее фото"
                  className="icon-button-soft inline-flex h-8 w-8 items-center justify-center rounded-full"
                >
                  <ChevronIcon direction="right" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* в”Ђв”Ђ CONTENT + PRICE в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
        <div className="min-w-0 flex flex-1 flex-col">
          {/* в”Ђв”Ђ Info block в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
          <div className={cn("min-w-0 flex-1", isGrid ? "space-y-2" : "space-y-2.5")}>
            {/* Type pill */}
            {item.typeLabel && (
              <span className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {item.typeLabel}
              </span>
            )}

            {/* Title */}
            <h2
              id={titleId}
              title={item.name}
              className={cn(
                "font-bold tracking-tight text-olive",
                isGrid
                  ? "line-clamp-2 text-[15px] leading-snug md:text-[17px]"
                  : "text-[16px] leading-snug [overflow-wrap:anywhere] md:text-[18px]",
              )}
            >
              {item.name}
              {starCount > 0 && (
                <span
                  className="ml-1.5 whitespace-nowrap text-[12px] font-normal text-amber-400"
                  aria-label={`${starCount} звезды`}
                >
                  {"в…".repeat(starCount)}
                </span>
              )}
            </h2>

            {/* Location: city, address */}
            <p className="flex items-start gap-1.5 text-[13px] text-olive/50">
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-terra/50" />
              <span
                className={cn(
                  "min-w-0",
                  isGrid ? "line-clamp-1" : "leading-relaxed [overflow-wrap:anywhere]",
                )}
              >
                {locationLine}
              </span>
            </p>

            {/* Rating + reviews + sea distance */}
            {(item.avgRating > 0 || seaDistanceLabel || roomCapacity) && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {item.avgRating > 0 && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[13px] font-bold text-olive">
                      <StarIcon className="h-4 w-4 text-amber-400" />
                      {item.avgRating.toFixed(1)}
                    </span>
                    {item.reviewsCount > 0 && (
                      <span className="text-[12px] text-olive/45">
                        {formatReviewsLabel(item.reviewsCount)}
                      </span>
                    )}
                  </>
                )}
                {seaDistanceLabel && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-foam px-2 py-0.5 text-[11px] font-semibold text-accent">
                    <AppIcon icon={Waves} className="h-3 w-3 shrink-0" />
                    {formatSeaDistance(seaDistanceLabel)}
                  </span>
                )}
                {roomCapacity ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <UsersIcon className="h-4 w-4" />
                    До {roomCapacity} гостей
                  </span>
                ) : null}
              </div>
            )}

            {/* Amenity chips */}
            {amenityHighlights.length > 0 && (
              <div
                className={cn(
                  "gap-1.5",
                  isGrid ? "grid grid-cols-2 pt-1" : "grid grid-cols-1 pt-1.5 sm:grid-cols-2",
                )}
                role="list"
                aria-label="Ключевые удобства"
              >
                {amenityHighlights.map((amenity) => (
                  <span
                    key={`${item.id}-amenity-${amenity}`}
                    title={amenity}
                    role="listitem"
                    aria-label={`Удобство: ${amenity}`}
                    className="inline-flex min-w-0 items-start gap-1 rounded-md border border-olive/6 bg-sand/40 px-2 py-1 text-[11px] font-medium text-olive/55"
                  >
                    <AmenityGlyph name={amenity} />
                    <span
                      className={cn(
                        "min-w-0",
                        isGrid ? "truncate" : "whitespace-normal break-words leading-snug",
                      )}
                    >
                      {amenity}
                    </span>
                  </span>
                ))}
                {remainingAmenitiesCount > 0 ? (
                  <span className="inline-flex min-w-0 items-center gap-1 rounded-md border border-dashed border-olive/10 bg-white/90 px-2 py-1 text-[11px] font-semibold text-olive/55">
                    +{remainingAmenitiesCount} ещё
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* в”Ђв”Ђ Price block в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
          {isGrid ? (
            /* Grid: price at bottom */
            <div className="mt-auto space-y-2 pt-2">
              <div className="rounded-xl bg-gradient-to-br from-primary/8 via-primary/4 to-transparent px-3 py-2.5">
                <p className="break-words text-[17px] font-extrabold leading-snug tracking-tight text-olive [overflow-wrap:anywhere] sm:text-[18px]">
                  {priceSummary.primary}
                </p>
                {priceSummary.secondary && (
                  <p className="mt-0.5 text-[11px] font-medium text-olive/45">
                    {priceSummary.secondary}
                  </p>
                )}
              </div>
              <Link
                href={detailsHref}
                className="pointer-events-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-teal-600 text-[13px] font-bold text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/25 hover:brightness-110 active:scale-[0.97]"
              >
                Подробнее
                <ArrowIcon />
              </Link>
            </div>
          ) : (
            <div className="relative mt-3 overflow-hidden rounded-[22px] border border-primary/10 bg-gradient-to-r from-primary/[0.09] via-white to-cream/80 p-3 shadow-[0_14px_30px_-26px_rgba(15,118,110,0.34)]">
              <div className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-primary/75 via-primary/35 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-primary/[0.08] to-transparent" />
              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 pl-2 sm:pl-0">
                  <p className="break-words text-[16px] font-extrabold leading-snug tracking-tight text-olive [overflow-wrap:anywhere] sm:text-[17px] lg:text-[18px]">
                    {priceSummary.primary}
                  </p>
                  {priceSummary.secondary && (
                    <p className="mt-0.5 text-[11px] font-medium text-olive/40">
                      {priceSummary.secondary}
                    </p>
                  )}
                  {priceSummary.roomLabel && (
                    <p className="mt-1 text-[11px] font-medium text-olive/45">
                      {priceSummary.roomLabel}
                    </p>
                  )}
                </div>
                <Link
                  href={detailsHref}
                  className="pointer-events-auto inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-teal-600 px-5 text-[13px] font-bold text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/25 hover:brightness-110 active:scale-[0.97] sm:h-10 sm:w-auto sm:min-w-[170px]"
                >
                  Подробнее
                  <ArrowIcon />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
