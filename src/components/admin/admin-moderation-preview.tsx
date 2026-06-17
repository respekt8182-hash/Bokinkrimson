import {
  BadgeCheck,
  BedDouble,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Car,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  WalletCards,
} from "lucide-react";
import type React from "react";
import { AdminMediaPreview } from "@/components/admin/admin-media-preview";
import type { SerializedRoom } from "@/lib/rooms";
import {
  deriveTransferSummaryFromFleet,
  getTransferFleetItemPhotoUrls,
  normalizeTransferServiceTags,
  type TransferFleetItem,
} from "@/lib/transfers";

type NumericLike = number | string | { toString(): string } | null | undefined;

type PreviewMedia = {
  id?: string;
  type?: string;
  url: string;
};

type PreviewOwner = {
  firstName: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
};

type PreviewAmenity = {
  amenityId?: string;
  amenity?: { id?: string; name: string };
  id?: string;
  name?: string;
};

type PreviewProperty = {
  id: string;
  publicId?: number | null;
  name: string | null;
  type?: string | null;
  locationName: string | null;
  address: string | null;
  seaDistance?: string | null;
  description: string | null;
  starRating?: number | null;
  registryNumber?: string | null;
  registryNumberPending?: string | null;
  phone?: string | null;
  phoneName?: string | null;
  phone2?: string | null;
  phone2Name?: string | null;
  phone3?: string | null;
  phone3Name?: string | null;
  contactEmail?: string | null;
  websiteUrl?: string | null;
  contactPersonName?: string | null;
  contactPersonRole?: string | null;
  listingChannels?: string | null;
  avgRating: NumericLike;
  reviewsCount: number;
  updatedAt: Date | string;
  owner: PreviewOwner;
  media: PreviewMedia[];
  amenities: PreviewAmenity[];
  customAmenities: Array<{ id: string; name: string }>;
};

type PreviewExcursion = {
  id: string;
  publicId?: number | null;
  offerType?: "EXCURSION" | "TOUR" | string;
  subtypeLabel?: string | null;
  title: string | null;
  locationName: string | null;
  district?: { name: string | null } | null;
  category?: { name: string | null } | null;
  address: string | null;
  startPoint: string | null;
  meetingPointText?: string | null;
  finishPoint?: string | null;
  description: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  routeDescription: string | null;
  scheduleText: string | null;
  availabilityNote?: string | null;
  durationMinutes: number | null;
  durationDays?: number | null;
  durationNights?: number | null;
  groupSizeMin?: number | null;
  groupSizeMax?: number | null;
  ageLimit?: number | null;
  languageCodes?: string[];
  priceFrom: NumericLike;
  priceTo?: NumericLike;
  currency: string;
  priceUnitLabel?: string | null;
  includedText?: string | null;
  notIncludedText?: string | null;
  includedItems?: string[];
  excludedItems?: string[];
  transferDetails?: string | null;
  pickupAvailable?: boolean | null;
  hasGuideLicense?: boolean | null;
  tourKind?: string | null;
  transportModes?: string[];
  departureMode?: string | null;
  arrivalInfo?: string | null;
  departureInfo?: string | null;
  accommodationProvided?: boolean | null;
  accommodationType?: string | null;
  accommodationNights?: number | null;
  accommodationComment?: string | null;
  mealPlan?: string | null;
  mealDetails?: string | null;
  safetyInfo?: string | null;
  photoUrls: string[];
  videoUrls: string[];
  highlights?: unknown;
  timeline?: unknown;
  itineraryDays?: unknown;
  pricingTiers?: unknown;
  extraOptions?: unknown;
  faqItems?: unknown;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactPhone?: string | null;
  contactPhoneName?: string | null;
  contactPhone2?: string | null;
  contactPhone2Name?: string | null;
  contactEmail?: string | null;
  websiteUrl?: string | null;
  avgRating: NumericLike;
  reviewsCount: number;
  updatedAt: Date | string;
  owner: PreviewOwner;
};

type PreviewTransfer = {
  id: string;
  publicId?: number | null;
  title: string | null;
  transferType: string | null;
  vehicleClass: string | null;
  vehicleModel: string | null;
  seats: number | null;
  luggage: number | null;
  locationName: string | null;
  district?: { name: string | null } | null;
  serviceArea: string | null;
  routeExamples: string | null;
  priceFrom: NumericLike;
  priceUnitLabel: string | null;
  currency: string;
  description: string | null;
  shortDescription: string | null;
  photoUrls: string[];
  serviceTags: string[];
  fleet: unknown;
  contactName: string | null;
  phone: string | null;
  phoneName: string | null;
  phone2: string | null;
  phone2Name: string | null;
  phone3: string | null;
  phone3Name: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  avgRating: NumericLike;
  reviewsCount: number;
  updatedAt: Date | string;
  owner: PreviewOwner;
};

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: NumericLike): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: NumericLike, currency = "RUB"): string {
  const amount = toNumber(value);
  if (amount === null) {
    return "По запросу";
  }

  const formatted = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
  return currency === "RUB" ? `${formatted} ₽` : `${formatted} ${currency}`;
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Не указано" : date.toLocaleDateString("ru-RU");
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function formatRating(value: NumericLike, count: number): string {
  const rating = toNumber(value);
  return rating && count > 0 ? `${rating.toFixed(1)} · ${count} отзывов` : "Пока без отзывов";
}

function formatDuration(input: {
  durationMinutes?: number | null;
  durationDays?: number | null;
  durationNights?: number | null;
}): string {
  if (input.durationDays && input.durationDays > 0) {
    return input.durationNights && input.durationNights > 0
      ? `${input.durationDays} дн. / ${input.durationNights} ноч.`
      : `${input.durationDays} дн.`;
  }

  if (!input.durationMinutes || input.durationMinutes <= 0) {
    return "Не указана";
  }

  const hours = Math.floor(input.durationMinutes / 60);
  const minutes = input.durationMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} ч ${minutes} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${minutes} мин`;
}

function getOwnerName(owner: PreviewOwner): string {
  return [owner.firstName, owner.lastName].map(optionalText).filter(Boolean).join(" ") || "Владелец";
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function asRecordList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function getRecordText(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = optionalText(value);
    if (!trimmed || seen.has(trimmed.toLowerCase())) {
      continue;
    }

    seen.add(trimmed.toLowerCase());
    result.push(trimmed);
  }

  return result;
}

function getRoomPriceSuffix(priceType: string | null | undefined): string {
  if (priceType === "PER_PERSON") return "/ чел.";
  if (priceType === "PER_BED") return "/ место";
  return "/ ночь";
}

function PreviewShell({
  eyebrow,
  title,
  description,
  media,
  badges,
  facts,
  side,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string | null;
  media: PreviewMedia[];
  badges: string[];
  facts: Array<{ icon: React.ElementType; label: string; value: string | null }>;
  side: React.ReactNode;
  children: React.ReactNode;
}) {
  const cover = media.find((item) => item.type !== "VIDEO") ?? media[0] ?? null;
  const gallery = media.slice(0, 5);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[var(--admin-border)] bg-white shadow-[var(--admin-shadow-sm)]">
      <div className="grid min-h-[360px] lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
        <div className="relative min-h-[360px] bg-olive/8">
          {cover ? (
            cover.type === "VIDEO" ? (
              <video src={cover.url} controls className="h-full min-h-[360px] w-full object-cover" />
            ) : (
              <AdminMediaPreview
                src={cover.url}
                alt={title}
                className="h-full min-h-[360px] w-full object-cover"
                fallbackLabel="Медиа недоступно"
              />
            )
          ) : (
            <div className="flex h-full min-h-[360px] items-center justify-center bg-cream text-sm font-semibold text-olive/45">
              Фото пока не загружены
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-midnight/82 via-midnight/42 to-transparent p-6 pt-28">
            <div className="flex flex-wrap gap-2">
              {badges.slice(0, 5).map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/20 bg-white/14 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
                >
                  {badge}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              {eyebrow}
            </p>
            <h2 className="mt-2 max-w-4xl text-[34px] font-semibold leading-tight tracking-normal text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/78">{description}</p>
            ) : null}
          </div>
        </div>

        <aside className="flex flex-col gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-muted-surface)] p-5 lg:border-l lg:border-t-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {facts.map((fact) => {
              const Icon = fact.icon;
              return (
                <div
                  key={fact.label}
                  className="flex min-h-[74px] items-center gap-3 rounded-2xl border border-[var(--admin-border)] bg-white px-4 py-3 shadow-[var(--admin-shadow-xs)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-olive/42">
                      {fact.label}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-olive">
                      {fact.value ?? "Не указано"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {gallery.length > 1 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-olive/44">
                Галерея
              </p>
              <div className="grid grid-cols-5 gap-2">
                {gallery.map((item, index) => (
                  <div
                    key={`${item.url}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-xl bg-cream ring-1 ring-olive/10"
                  >
                    {item.type === "VIDEO" ? (
                      <video src={item.url} className="h-full w-full object-cover" />
                    ) : (
                      <AdminMediaPreview
                        src={item.url}
                        alt={`${title}: фото ${index + 1}`}
                        className="h-full w-full object-cover"
                        fallbackLabel=""
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {side}
        </aside>
      </div>

      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  );
}

function SectionBlock({
  id,
  icon: Icon,
  title,
  children,
}: {
  id?: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-[22px] border border-olive/10 bg-cream/35 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary ring-1 ring-olive/10">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <h3 className="text-lg font-semibold text-olive">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ContactPanel({ rows }: { rows: Array<{ label: string; value: string | null }> }) {
  const visibleRows = rows.filter((row) => row.value);

  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-white p-4 shadow-[var(--admin-shadow-xs)]">
      <p className="text-sm font-semibold text-olive">Контакты в карточке</p>
      {visibleRows.length > 0 ? (
        <dl className="mt-3 space-y-2 text-sm">
          {visibleRows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <dt className="text-olive/48">{row.label}</dt>
              <dd className="min-w-0 text-right font-medium text-olive">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-olive/58">Контакты пока не заполнены.</p>
      )}
    </div>
  );
}

function ChipList({ items, limit = 16 }: { items: string[]; limit?: number }) {
  if (items.length === 0) {
    return <p className="text-sm text-olive/58">Нет заполненных пунктов.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, limit).map((item) => (
        <span
          key={item}
          className="rounded-full border border-primary/14 bg-white px-3 py-1.5 text-xs font-semibold text-olive"
        >
          {item}
        </span>
      ))}
      {items.length > limit ? (
        <span className="rounded-full bg-olive/8 px-3 py-1.5 text-xs font-semibold text-olive/60">
          +{items.length - limit}
        </span>
      ) : null}
    </div>
  );
}

function MiniPriceBoard({ rooms }: { rooms: SerializedRoom[] }) {
  const visibleRooms = rooms.slice(0, 5);

  if (rooms.length === 0) {
    return <p className="text-sm text-olive/58">Активных номеров нет.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-5">
        {visibleRooms.map((room) => {
          const prices = room.prices.slice(0, 4);

          return (
            <article
              key={room.id}
              className="min-w-0 rounded-2xl border border-olive/10 bg-white p-3 shadow-[0_10px_24px_rgba(58,43,35,0.04)]"
            >
              <div className="min-h-[74px]">
                <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-olive">
                  {room.title}
                </h4>
                <p className="mt-1 text-xs text-olive/56">
                  {room.beds + room.extraBeds} мест · {room.roomsCount} категории
                </p>
              </div>

              {prices.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {prices.map((price) => (
                    <div
                      key={price.id}
                      className="min-h-[58px] rounded-xl border border-primary/10 bg-primary/[0.045] px-2 py-1.5"
                    >
                      <p className="text-[11px] font-semibold text-primary">
                        {formatShortDate(price.dateFrom)}-{formatShortDate(price.dateTo)}
                      </p>
                      <p className="mt-1 text-[12px] font-bold text-olive">
                        {formatMoney(price.price, price.currency)}
                      </p>
                      <p className="text-[10px] text-olive/45">
                        {getRoomPriceSuffix(price.priceType)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex min-h-[122px] items-center justify-center rounded-xl border border-dashed border-olive/14 bg-cream/60 px-3 text-center text-xs font-medium text-olive/50">
                  Цены не заданы
                </div>
              )}
            </article>
          );
        })}
      </div>

      {rooms.length > visibleRooms.length ? (
        <p className="text-sm text-olive/58">
          Показаны первые 5 категорий из {rooms.length}. Полная шахматка доступна в редакторе.
        </p>
      ) : null}
    </div>
  );
}

export function AdminPropertyModerationPreview({
  property,
  rooms,
}: {
  property: PreviewProperty;
  rooms: SerializedRoom[];
}) {
  const title = property.name ?? "Объект без названия";
  const media = property.media.map((item) => ({
    id: item.id,
    type: item.type,
    url: item.url,
  }));
  const amenities = [
    ...property.amenities.map((item) => item.amenity?.name ?? item.name).filter(Boolean),
    ...property.customAmenities.map((item) => item.name),
  ] as string[];
  const phones = [
    { label: property.phoneName ?? "Телефон", value: optionalText(property.phone) },
    { label: property.phone2Name ?? "Телефон 2", value: optionalText(property.phone2) },
    { label: property.phone3Name ?? "Телефон 3", value: optionalText(property.phone3) },
  ];
  const minPrice = rooms
    .flatMap((room) => room.prices)
    .map((price) => ({ value: price.price, currency: price.currency }))
    .sort((left, right) => left.value - right.value)[0];

  return (
    <PreviewShell
      eyebrow="Предпросмотр объекта"
      title={title}
      description={property.description}
      media={media}
      badges={uniqueStrings([
        property.type,
        property.locationName,
        property.seaDistance,
        property.registryNumber ? "КСР указан" : null,
      ])}
      facts={[
        { icon: MapPin, label: "Локация", value: property.locationName ?? property.address },
        {
          icon: BedDouble,
          label: "Номерной фонд",
          value: `${rooms.length} категорий · ${rooms.reduce((sum, room) => sum + room.roomsCount, 0)} номеров`,
        },
        {
          icon: WalletCards,
          label: "Цена",
          value: minPrice ? `от ${formatMoney(minPrice.value, minPrice.currency)}` : "Не задана",
        },
        { icon: Star, label: "Рейтинг", value: formatRating(property.avgRating, property.reviewsCount) },
        { icon: ShieldCheck, label: "КСР", value: property.registryNumber ?? "Не указан" },
        { icon: CalendarDays, label: "Обновлено", value: formatDate(property.updatedAt) },
      ]}
      side={
        <ContactPanel
          rows={[
            { label: "Владелец", value: getOwnerName(property.owner) },
            { label: "Email владельца", value: optionalText(property.owner.email) },
            { label: "Контактное лицо", value: optionalText(property.contactPersonName) },
            { label: "Роль", value: optionalText(property.contactPersonRole) },
            ...phones,
            { label: "Email", value: optionalText(property.contactEmail) },
            { label: "Сайт", value: optionalText(property.websiteUrl) },
          ]}
        />
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <SectionBlock icon={FileText} title="Описание и удобства">
          <p className="whitespace-pre-line text-sm leading-7 text-olive/76">
            {property.description || "Описание пока не добавлено."}
          </p>
          <div className="mt-4">
            <ChipList items={amenities} />
          </div>
        </SectionBlock>

        <SectionBlock icon={BadgeCheck} title="Данные для проверки">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-olive/48">Адрес</dt>
              <dd className="font-semibold text-olive">{property.address ?? "Не указан"}</dd>
            </div>
            <div>
              <dt className="text-olive/48">Где еще размещается</dt>
              <dd className="font-semibold text-olive">
                {property.listingChannels ?? "Не указано"}
              </dd>
            </div>
            <div>
              <dt className="text-olive/48">Номер КСР на проверке</dt>
              <dd className="font-semibold text-olive">
                {property.registryNumberPending ?? "Нет нового номера"}
              </dd>
            </div>
          </dl>
        </SectionBlock>
      </div>

      <SectionBlock icon={CreditCard} title="Мини-шахматка цен">
        <MiniPriceBoard rooms={rooms} />
      </SectionBlock>
    </PreviewShell>
  );
}

export function AdminExcursionModerationPreview({
  excursion,
}: {
  excursion: PreviewExcursion;
}) {
  const isTour = excursion.offerType === "TOUR";
  const title = excursion.title ?? (isTour ? "Тур без названия" : "Экскурсия без названия");
  const organizerName = uniqueStrings([
    excursion.contactFirstName,
    excursion.contactLastName,
  ]).join(" ");
  const highlights = asStringList(excursion.highlights);
  const timeline = asRecordList(isTour ? excursion.itineraryDays : excursion.timeline);
  const pricingTiers = asRecordList(excursion.pricingTiers);
  const extraOptions = asRecordList(excursion.extraOptions);
  const included = uniqueStrings([
    excursion.includedText,
    ...(excursion.includedItems ?? []),
  ]);
  const excluded = uniqueStrings([
    excursion.notIncludedText,
    ...(excursion.excludedItems ?? []),
  ]);
  const media = [
    ...excursion.photoUrls.map((url) => ({ type: "IMAGE", url })),
    ...excursion.videoUrls.map((url) => ({ type: "VIDEO", url })),
  ];
  const description =
    optionalText(excursion.shortDescription) ??
    optionalText(excursion.description) ??
    optionalText(excursion.routeDescription);

  return (
    <PreviewShell
      eyebrow={isTour ? "Предпросмотр тура" : "Предпросмотр экскурсии"}
      title={title}
      description={description}
      media={media}
      badges={uniqueStrings([
        isTour ? "Тур" : "Экскурсия",
        excursion.subtypeLabel,
        excursion.category?.name,
        excursion.locationName,
        excursion.pickupAvailable ? "Есть трансфер" : null,
        excursion.hasGuideLicense ? "Лицензированный гид" : null,
      ])}
      facts={[
        { icon: MapPin, label: "Локация", value: excursion.locationName ?? excursion.address },
        { icon: Clock3, label: "Длительность", value: formatDuration(excursion) },
        {
          icon: Users,
          label: "Группа",
          value:
            excursion.groupSizeMin || excursion.groupSizeMax
              ? `${excursion.groupSizeMin ?? 1}-${excursion.groupSizeMax ?? "∞"} человек`
              : "Не указана",
        },
        {
          icon: WalletCards,
          label: "Стоимость",
          value:
            toNumber(excursion.priceTo) && toNumber(excursion.priceFrom)
              ? `${formatMoney(excursion.priceFrom, excursion.currency)}-${formatMoney(
                  excursion.priceTo,
                  excursion.currency,
                )}`
              : formatMoney(excursion.priceFrom, excursion.currency),
        },
        { icon: Star, label: "Рейтинг", value: formatRating(excursion.avgRating, excursion.reviewsCount) },
        { icon: CalendarDays, label: "Обновлено", value: formatDate(excursion.updatedAt) },
      ]}
      side={
        <ContactPanel
          rows={[
            { label: "Организатор", value: organizerName || getOwnerName(excursion.owner) },
            { label: "Email владельца", value: optionalText(excursion.owner.email) },
            { label: "Телефон", value: optionalText(excursion.contactPhone) },
            { label: "Телефон 2", value: optionalText(excursion.contactPhone2) },
            { label: "Email", value: optionalText(excursion.contactEmail) },
            { label: "Сайт", value: optionalText(excursion.websiteUrl) },
          ]}
        />
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <SectionBlock icon={FileText} title={isTour ? "О туре" : "Об экскурсии"}>
          <p className="whitespace-pre-line text-sm leading-7 text-olive/76">
            {excursion.fullDescription || excursion.description || "Описание пока не добавлено."}
          </p>
          {excursion.routeDescription ? (
            <p className="mt-4 rounded-2xl border border-terra/12 bg-white px-4 py-3 text-sm font-medium leading-6 text-olive">
              Маршрут: {excursion.routeDescription}
            </p>
          ) : null}
          {highlights.length > 0 ? (
            <div className="mt-4">
              <ChipList items={highlights} />
            </div>
          ) : null}
        </SectionBlock>

        <SectionBlock icon={Sparkles} title={isTour ? "Логистика тура" : "Условия"}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-olive/48">Старт</dt>
              <dd className="font-semibold text-olive">
                {excursion.startPoint ?? excursion.meetingPointText ?? "Не указан"}
              </dd>
            </div>
            <div>
              <dt className="text-olive/48">Финиш</dt>
              <dd className="font-semibold text-olive">{excursion.finishPoint ?? "Не указан"}</dd>
            </div>
            <div>
              <dt className="text-olive/48">Расписание</dt>
              <dd className="font-semibold text-olive">
                {excursion.scheduleText ?? excursion.availabilityNote ?? "Не указано"}
              </dd>
            </div>
            {isTour ? (
              <>
                <div>
                  <dt className="text-olive/48">Транспорт</dt>
                  <dd className="font-semibold text-olive">
                    {(excursion.transportModes ?? []).join(", ") || excursion.transferDetails || "Не указан"}
                  </dd>
                </div>
                <div>
                  <dt className="text-olive/48">Проживание</dt>
                  <dd className="font-semibold text-olive">
                    {excursion.accommodationProvided
                      ? uniqueStrings([
                          excursion.accommodationType,
                          excursion.accommodationNights
                            ? `${excursion.accommodationNights} ночей`
                            : null,
                          excursion.accommodationComment,
                        ]).join(" · ")
                      : "Не включено или не указано"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </SectionBlock>
      </div>

      <SectionBlock icon={CalendarDays} title={isTour ? "Программа тура" : "Таймлайн маршрута"}>
        {timeline.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {timeline.slice(0, 6).map((item, index) => (
              <article key={index} className="rounded-2xl border border-olive/10 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/65">
                  {isTour ? `День ${getRecordText(item, ["day", "number"]) ?? index + 1}` : `Шаг ${index + 1}`}
                </p>
                <h4 className="mt-2 text-sm font-semibold text-olive">
                  {getRecordText(item, ["title", "name"]) ?? "Без названия"}
                </h4>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-olive/66">
                  {getRecordText(item, ["description", "text", "details"]) ?? "Описание не заполнено"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-olive/58">Программа пока не заполнена.</p>
        )}
      </SectionBlock>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionBlock icon={WalletCards} title="Цены и доп. опции">
          <div className="space-y-2">
            {pricingTiers.slice(0, 5).map((tier, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-2xl border border-olive/10 bg-white px-4 py-3 text-sm"
              >
                <span className="font-semibold text-olive">
                  {getRecordText(tier, ["title", "label", "name"]) ?? `Тариф ${index + 1}`}
                </span>
                <span className="font-bold text-primary">
                  {formatMoney(getRecordText(tier, ["price", "priceFrom"]), excursion.currency)}
                </span>
              </div>
            ))}
            {pricingTiers.length === 0 ? (
              <p className="text-sm font-semibold text-olive">
                Основная цена: {formatMoney(excursion.priceFrom, excursion.currency)}
                {excursion.priceUnitLabel ? ` ${excursion.priceUnitLabel}` : ""}
              </p>
            ) : null}
            {extraOptions.length > 0 ? (
              <div className="pt-2">
                <ChipList
                  items={extraOptions.map(
                    (item, index) => getRecordText(item, ["title", "name"]) ?? `Опция ${index + 1}`,
                  )}
                />
              </div>
            ) : null}
          </div>
        </SectionBlock>

        <SectionBlock icon={BadgeCheck} title="Что включено">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-olive">Включено</p>
              <ChipList items={included} limit={8} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-olive">Не включено</p>
              <ChipList items={excluded} limit={8} />
            </div>
          </div>
        </SectionBlock>
      </div>
    </PreviewShell>
  );
}

function TransferFleetGrid({ fleet }: { fleet: TransferFleetItem[] }) {
  if (fleet.length === 0) {
    return <p className="text-sm text-olive/58">Автопарк пока не заполнен.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {fleet.slice(0, 6).map((item) => {
        const photos = getTransferFleetItemPhotoUrls(item);
        const photo = photos[0] ?? null;
        const title =
          item.title ||
          [item.transportKind, item.vehicleClass, item.vehicleModel].filter(Boolean).join(" ") ||
          "Транспорт";

        return (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-olive/10 bg-white">
            <div className="aspect-[16/9] bg-cream">
              {photo ? (
                <AdminMediaPreview
                  src={photo}
                  alt={title}
                  className="h-full w-full object-cover"
                  fallbackLabel="Фото транспорта недоступно"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-semibold text-olive/42">
                  Фото не добавлено
                </div>
              )}
            </div>
            <div className="p-4">
              <h4 className="text-sm font-semibold text-olive">{title}</h4>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <span className="rounded-xl bg-cream px-2 py-2 font-semibold text-olive">
                  {item.seats ?? "?"} мест
                </span>
                <span className="rounded-xl bg-cream px-2 py-2 font-semibold text-olive">
                  {item.luggage ?? "?"} багаж
                </span>
                <span className="rounded-xl bg-primary/7 px-2 py-2 font-semibold text-primary">
                  {formatMoney(item.priceFrom, "RUB")}
                </span>
              </div>
              {item.description ? (
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-olive/66">
                  {item.description}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function AdminTransferModerationPreview({
  transfer,
}: {
  transfer: PreviewTransfer;
}) {
  const title = transfer.title ?? "Трансфер без названия";
  const summary = deriveTransferSummaryFromFleet(transfer);
  const fleet = summary.fleet;
  const photoUrls = summary.photoUrls.length > 0 ? summary.photoUrls : transfer.photoUrls;
  const serviceTags = normalizeTransferServiceTags(transfer.serviceTags);
  const vehicleLabel = uniqueStrings([
    summary.primaryVehicle?.transportKind,
    summary.vehicleClass ?? transfer.vehicleClass,
    summary.vehicleModel ?? transfer.vehicleModel,
  ]).join(" · ");

  return (
    <PreviewShell
      eyebrow="Предпросмотр трансфера"
      title={title}
      description={transfer.shortDescription ?? transfer.description}
      media={photoUrls.map((url) => ({ type: "IMAGE", url }))}
      badges={uniqueStrings([
        transfer.transferType,
        transfer.locationName,
        vehicleLabel,
        serviceTags[0],
      ])}
      facts={[
        { icon: MapPin, label: "Локация", value: transfer.locationName ?? transfer.serviceArea },
        { icon: Car, label: "Автопарк", value: fleet.length ? `${fleet.length} вариантов` : vehicleLabel },
        {
          icon: Users,
          label: "Пассажиры",
          value: summary.seats ? `до ${summary.seats} пассажиров` : "Не указано",
        },
        {
          icon: BriefcaseBusiness,
          label: "Багаж",
          value: summary.luggage ? `до ${summary.luggage} мест` : "Не указано",
        },
        {
          icon: WalletCards,
          label: "Цена",
          value: `${formatMoney(summary.priceFrom ?? transfer.priceFrom, transfer.currency)}${
            summary.priceUnitLabel ?? transfer.priceUnitLabel ?? ""
          }`,
        },
        { icon: Star, label: "Рейтинг", value: formatRating(transfer.avgRating, transfer.reviewsCount) },
      ]}
      side={
        <ContactPanel
          rows={[
            { label: "Водитель", value: optionalText(transfer.contactName) ?? getOwnerName(transfer.owner) },
            { label: "Телефон", value: optionalText(transfer.phone) },
            { label: "Телефон 2", value: optionalText(transfer.phone2) },
            { label: "Телефон 3", value: optionalText(transfer.phone3) },
            { label: "Email", value: optionalText(transfer.contactEmail) },
            { label: "Сайт", value: optionalText(transfer.websiteUrl) },
          ]}
        />
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <SectionBlock icon={FileText} title="О трансфере">
          <p className="whitespace-pre-line text-sm leading-7 text-olive/76">
            {transfer.description || "Описание пока не добавлено."}
          </p>
          {serviceTags.length > 0 ? (
            <div className="mt-4">
              <ChipList items={serviceTags} />
            </div>
          ) : null}
        </SectionBlock>

        <SectionBlock icon={MapPin} title="Маршруты и зона работы">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-olive/48">Зона работы</dt>
              <dd className="font-semibold text-olive">
                {transfer.serviceArea ?? transfer.locationName ?? "Не указана"}
              </dd>
            </div>
            <div>
              <dt className="text-olive/48">Примеры маршрутов</dt>
              <dd className="font-semibold text-olive">{transfer.routeExamples ?? "Не указаны"}</dd>
            </div>
            <div>
              <dt className="text-olive/48">Обновлено</dt>
              <dd className="font-semibold text-olive">{formatDate(transfer.updatedAt)}</dd>
            </div>
          </dl>
        </SectionBlock>
      </div>

      <SectionBlock icon={Camera} title="Автопарк и цены">
        <TransferFleetGrid fleet={fleet} />
      </SectionBlock>
    </PreviewShell>
  );
}
