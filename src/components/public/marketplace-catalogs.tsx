import {
  ArrowRight,
  ArrowUpRight,
  Car,
  ImageIcon,
  BriefcaseBusiness,
  MapPin,
  Phone,
  Route,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import { buildCanonicalPath } from "@/lib/seo/canonical";
import type {
  PublicAttractionCatalogItem,
  PublicAttractionCatalogResult,
  PublicTransferCatalogItem,
  PublicTransferCatalogResult,
} from "@/lib/public-marketplace";

type CatalogParams = Record<string, string | null | undefined>;

type AttractionCatalogProps = {
  result: PublicAttractionCatalogResult;
  categories: string[];
};

type TransferCatalogProps = {
  result: PublicTransferCatalogResult;
  transferTypes: string[];
};

const rubFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function compactText(value: string | null | undefined, limit = 170): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trim()}…`;
}

function formatDistance(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return `~${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км`;
}

function formatPrice(value: number | null, unit: string | null): string {
  if (value === null) {
    return "Цена по запросу";
  }

  return `от ${rubFormatter.format(Math.round(value))} ₽${unit ? ` ${unit}` : ""}`;
}

function telHref(phone: string | null): string | null {
  const normalized = phone?.replace(/[^\d+]/g, "") ?? "";
  return normalized ? `tel:${normalized}` : null;
}

function buildCatalogPath(basePath: string, params: CatalogParams): string {
  return buildCanonicalPath(
    basePath,
    Object.entries(params)
      .filter(([, value]) => value)
      .map(([key, value]) => [key, String(value)]),
    [
      "q",
      "location",
      "category",
      "transferType",
      "radiusKm",
      "minPrice",
      "maxPrice",
      "sort",
      "page",
    ],
  );
}

function CatalogShell({
  eyebrow,
  title,
  description,
  total,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <section className="mb-5 rounded-[28px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(244,250,248,0.84))] px-4 py-5 shadow-[0_20px_60px_rgba(58,43,35,0.07)] sm:px-5 md:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/55">
          {eyebrow}
        </p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold leading-tight text-olive md:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-olive/62 md:text-[15px]">{description}</p>
          </div>
          <p className="shrink-0 rounded-2xl bg-white/82 px-4 py-2 text-sm font-semibold text-olive ring-1 ring-olive/10">
            Найдено: {total}
          </p>
        </div>
      </section>

      {children}
    </main>
  );
}

function FilterCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-olive/[0.07] bg-white/94 p-3 shadow-[0_12px_30px_rgba(58,43,35,0.05)] md:p-4">
      {children}
    </section>
  );
}

const fieldClass =
  "h-11 w-full rounded-xl border border-olive/12 bg-white px-3 text-sm text-olive outline-none transition placeholder:text-olive/35 focus:border-primary/28 focus:ring-4 focus:ring-primary/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-olive/45">
        {label}
      </span>
      {children}
    </label>
  );
}

function Pagination({
  basePath,
  page,
  totalPages,
  params,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  params: CatalogParams;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previousPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  return (
    <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Пагинация">
      {previousPage ? (
        <Link
          href={buildCatalogPath(basePath, { ...params, page: String(previousPage) })}
          className="rounded-xl border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive transition hover:border-primary/24 hover:text-primary"
        >
          Назад
        </Link>
      ) : null}
      <span className="rounded-xl bg-white/82 px-4 py-2 text-sm font-semibold text-olive/60 ring-1 ring-olive/10">
        {page}/{totalPages}
      </span>
      {nextPage ? (
        <Link
          href={buildCatalogPath(basePath, { ...params, page: String(nextPage) })}
          className="rounded-xl border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive transition hover:border-primary/24 hover:text-primary"
        >
          Далее
        </Link>
      ) : null}
    </nav>
  );
}

function EmptyState({
  title,
  description,
  resetHref,
}: {
  title: string;
  description: string;
  resetHref: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-olive/24 bg-white/92 p-8 text-center">
      <p className="text-base font-semibold text-olive">{title}</p>
      <p className="mt-2 text-sm leading-6 text-olive/58">{description}</p>
      <Link
        href={resetHref}
        className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
      >
        Сбросить фильтры
      </Link>
    </section>
  );
}

function ImageBox({ src, alt, fallback }: { src: string | null; alt: string; fallback: string }) {
  return (
    <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-t-2xl bg-sand md:aspect-[4/3] md:w-[260px] md:rounded-l-2xl md:rounded-tr-none">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full min-h-[170px] flex-col items-center justify-center gap-2 text-sm text-olive/45">
          <AppIcon icon={ImageIcon} className="h-6 w-6" />
          {fallback}
        </div>
      )}
    </div>
  );
}

function AttractionCard({ item }: { item: PublicAttractionCatalogItem }) {
  const description = compactText(item.shortDescription ?? item.description, 180);
  const distance = formatDistance(item.distanceKm);

  return (
    <article className="group overflow-hidden rounded-2xl border border-olive/[0.07] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition hover:border-primary/15 hover:shadow-[0_8px_30px_-8px_rgba(15,118,110,0.15)]">
      <div className="flex flex-col md:flex-row">
        <ImageBox src={item.coverImageUrl} alt={item.title} fallback="Фото места" />

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex flex-wrap gap-1.5">
            {item.category ? (
              <span className="rounded-lg bg-primary/8 px-2 py-1 text-[11px] font-semibold text-primary">
                {item.category}
              </span>
            ) : null}
            {distance ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/62">
                <AppIcon icon={Route} className="h-3 w-3" />
                {distance}
              </span>
            ) : null}
          </div>

          <h2 className="mt-2 text-lg font-bold leading-snug text-olive md:text-xl">
            {item.title}
          </h2>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-olive/55">
            {item.locationName ? (
              <span className="inline-flex items-center gap-1.5">
                <AppIcon icon={MapPin} className="h-3.5 w-3.5 text-olive/32" />
                {item.locationName}
              </span>
            ) : null}
            {item.districtName ? <span>{item.districtName}</span> : null}
            {item.address ? <span>{item.address}</span> : null}
          </div>

          {description ? (
            <p className="mt-3 text-sm leading-6 text-olive/66">{description}</p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-olive/[0.06] pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/36">
              Достопримечательность
            </span>
            <Link
              href={item.path}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-terra px-4 text-sm font-bold text-white transition hover:brightness-95"
            >
              Подробнее
              <AppIcon icon={ArrowRight} className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function TransferCard({ item }: { item: PublicTransferCatalogItem }) {
  const description = compactText(item.shortDescription ?? item.description, 170);
  const distance = formatDistance(item.distanceKm);
  const phoneHref = telHref(item.contacts.phone);
  const ownerInitials = `${item.owner.firstName.slice(0, 1)}${item.owner.lastName.slice(0, 1)}`
    .trim()
    .toUpperCase();

  return (
    <article className="group overflow-hidden rounded-2xl border border-olive/[0.07] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition hover:border-primary/15 hover:shadow-[0_8px_30px_-8px_rgba(15,118,110,0.15)]">
      <div className="flex flex-col md:flex-row">
        <ImageBox src={item.coverImageUrl} alt={item.title} fallback="Фото автомобиля" />

        <div className="flex min-w-0 flex-1 flex-col p-4 md:flex-row md:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {item.transferType ? (
                <span className="rounded-lg bg-primary/8 px-2 py-1 text-[11px] font-semibold text-primary">
                  {item.transferType}
                </span>
              ) : null}
              {item.vehicleClass ? (
                <span className="rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/62">
                  {item.vehicleClass}
                </span>
              ) : null}
              {distance ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/62">
                  <AppIcon icon={Route} className="h-3 w-3" />
                  {distance}
                </span>
              ) : null}
            </div>

            <h2 className="mt-2 text-lg font-bold leading-snug text-olive md:text-xl">
              {item.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl bg-cream/78 py-1 pl-1 pr-2.5 text-xs font-semibold text-olive/70">
                <span className="inline-flex h-7 w-7 overflow-hidden rounded-full bg-white ring-1 ring-olive/10">
                  {item.owner.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.owner.avatarUrl}
                      alt={item.contacts.contactName ?? item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[11px] text-olive/60">
                      {ownerInitials || "?"}
                    </span>
                  )}
                </span>
                {item.contacts.contactName ?? `${item.owner.firstName} ${item.owner.lastName}`}
              </span>
              <span className="rounded-xl border border-dashed border-olive/18 px-2.5 py-1.5 text-xs font-semibold text-olive/42">
                Без рейтинга
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-olive/55">
              {item.locationName ? (
                <span className="inline-flex items-center gap-1.5">
                  <AppIcon icon={MapPin} className="h-3.5 w-3.5 text-olive/32" />
                  {item.locationName}
                </span>
              ) : null}
              {item.vehicleModel ? (
                <span className="inline-flex items-center gap-1.5">
                  <AppIcon icon={Car} className="h-3.5 w-3.5 text-olive/32" />
                  {item.vehicleModel}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.seats ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/62">
                  <AppIcon icon={Users} className="h-3 w-3" />
                  {item.seats} мест
                </span>
              ) : null}
              {item.luggage ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/62">
                  <AppIcon icon={BriefcaseBusiness} className="h-3 w-3" />
                  {item.luggage} багажа
                </span>
              ) : null}
              {item.serviceArea ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-sand/60 px-2 py-1 text-[11px] font-medium text-olive/62">
                  <AppIcon icon={MapPin} className="h-3 w-3" />
                  {compactText(item.serviceArea, 42)}
                </span>
              ) : null}
            </div>

            {description ? (
              <p className="mt-3 text-sm leading-6 text-olive/66">{description}</p>
            ) : null}
          </div>

          <div className="mt-4 flex shrink-0 flex-col justify-between border-t border-olive/[0.06] pt-4 md:mt-0 md:w-[190px] md:border-l md:border-t-0 md:pl-4 md:pt-0">
            <div>
              <p className="text-lg font-extrabold leading-tight text-olive">
                {formatPrice(item.priceFrom, item.priceUnitLabel)}
              </p>
              {item.contacts.contactName ? (
                <p className="mt-1 text-xs text-olive/48">{item.contacts.contactName}</p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 md:flex-col">
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/25 bg-primary/8 px-3 text-sm font-bold text-primary transition hover:bg-primary/12"
                >
                  <AppIcon icon={Phone} className="h-3.5 w-3.5" />
                  Позвонить
                </a>
              ) : null}
              <Link
                href={item.path}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-terra px-3 text-sm font-bold text-white transition hover:brightness-95"
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

export function AttractionCatalog({ result, categories }: AttractionCatalogProps) {
  const params: CatalogParams = {
    q: result.filters.query,
    location: result.filters.locationName,
    category: result.filters.category,
    radiusKm: String(result.filters.radiusKm),
    sort: result.filters.sort === "relevance" ? "" : result.filters.sort,
  };

  return (
    <CatalogShell
      eyebrow="Каталог"
      title="Достопримечательности Крыма"
      description="Ищите места по названию, городу или радиусу рядом с выбранной локацией."
      total={result.total}
    >
      <FilterCard>
        <form
          action="/attractions"
          className="grid gap-3 lg:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto]"
        >
          <Field label="Поиск">
            <div className="relative">
              <AppIcon
                icon={Search}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-olive/35"
              />
              <input
                name="q"
                defaultValue={result.filters.query ?? ""}
                placeholder="Название или описание"
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </Field>

          <Field label="Город или место">
            <input
              name="location"
              defaultValue={result.filters.locationName ?? ""}
              placeholder="Ялта, Судак..."
              className={fieldClass}
            />
          </Field>

          <Field label="Радиус">
            <select
              name="radiusKm"
              defaultValue={String(result.filters.radiusKm)}
              className={fieldClass}
            >
              {[5, 10, 15, 25, 30, 50, 100].map((km) => (
                <option key={km} value={km}>
                  {km} км
                </option>
              ))}
            </select>
          </Field>

          <Field label="Категория">
            <select
              name="category"
              defaultValue={result.filters.category ?? ""}
              className={fieldClass}
            >
              <option value="">Любая</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Сортировка">
            <select name="sort" defaultValue={result.filters.sort} className={fieldClass}>
              <option value="relevance">По релевантности</option>
              <option value="distance_asc">По расстоянию</option>
              <option value="newest">Сначала новые</option>
              <option value="name_asc">По названию</option>
            </select>
          </Field>

          <div className="flex items-end">
            <button
              type="submit"
              className="h-11 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover lg:w-auto"
            >
              Найти
            </button>
          </div>
        </form>
      </FilterCard>

      {result.items.length === 0 ? (
        <EmptyState
          title="Достопримечательности не найдены"
          description="Попробуйте другой город, увеличьте радиус или очистите поиск."
          resetHref="/attractions"
        />
      ) : (
        <div className="space-y-3">
          {result.items.map((item) => (
            <AttractionCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <Pagination
        basePath="/attractions"
        page={result.page}
        totalPages={result.totalPages}
        params={params}
      />
    </CatalogShell>
  );
}

export function TransferCatalog({ result, transferTypes }: TransferCatalogProps) {
  const params: CatalogParams = {
    q: result.filters.query,
    location: result.filters.locationName,
    transferType: result.filters.transferType,
    radiusKm: String(result.filters.radiusKm),
    minPrice: result.filters.minPrice ? String(result.filters.minPrice) : "",
    maxPrice: result.filters.maxPrice ? String(result.filters.maxPrice) : "",
    sort: result.filters.sort === "relevance" ? "" : result.filters.sort,
  };

  return (
    <CatalogShell
      eyebrow="Каталог"
      title="Трансферы по Крыму"
      description="Выбирайте водителя по городу, маршруту, типу трансфера, автомобилю и цене."
      total={result.total}
    >
      <FilterCard>
        <form
          action="/transfers"
          className="grid gap-3 lg:grid-cols-[1.25fr_1fr_0.75fr_0.9fr_0.7fr_0.7fr_0.9fr_auto]"
        >
          <Field label="Поиск">
            <div className="relative">
              <AppIcon
                icon={Search}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-olive/35"
              />
              <input
                name="q"
                defaultValue={result.filters.query ?? ""}
                placeholder="Маршрут, авто, водитель"
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </Field>

          <Field label="Город">
            <input
              name="location"
              defaultValue={result.filters.locationName ?? ""}
              placeholder="Симферополь..."
              className={fieldClass}
            />
          </Field>

          <Field label="Радиус">
            <select
              name="radiusKm"
              defaultValue={String(result.filters.radiusKm)}
              className={fieldClass}
            >
              {[5, 10, 15, 25, 30, 50, 100].map((km) => (
                <option key={km} value={km}>
                  {km} км
                </option>
              ))}
            </select>
          </Field>

          <Field label="Вид">
            <select
              name="transferType"
              defaultValue={result.filters.transferType ?? ""}
              className={fieldClass}
            >
              <option value="">Любой</option>
              {transferTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Цена от">
            <input
              name="minPrice"
              inputMode="numeric"
              defaultValue={result.filters.minPrice ?? ""}
              placeholder="0"
              className={fieldClass}
            />
          </Field>

          <Field label="Цена до">
            <input
              name="maxPrice"
              inputMode="numeric"
              defaultValue={result.filters.maxPrice ?? ""}
              placeholder="10000"
              className={fieldClass}
            />
          </Field>

          <Field label="Сортировка">
            <select name="sort" defaultValue={result.filters.sort} className={fieldClass}>
              <option value="relevance">По релевантности</option>
              <option value="distance_asc">По расстоянию</option>
              <option value="price_asc">Сначала дешевле</option>
              <option value="price_desc">Сначала дороже</option>
              <option value="newest">Сначала новые</option>
            </select>
          </Field>

          <div className="flex items-end">
            <button
              type="submit"
              className="h-11 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover lg:w-auto"
            >
              Найти
            </button>
          </div>
        </form>
      </FilterCard>

      {result.items.length === 0 ? (
        <EmptyState
          title="Трансферы не найдены"
          description="Попробуйте изменить город, цену, радиус или тип трансфера."
          resetHref="/transfers"
        />
      ) : (
        <div className="space-y-3">
          {result.items.map((item) => (
            <TransferCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <Pagination
        basePath="/transfers"
        page={result.page}
        totalPages={result.totalPages}
        params={params}
      />
    </CatalogShell>
  );
}

export function AttractionDetails({ item }: { item: PublicAttractionCatalogItem }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/94 shadow-[0_20px_60px_rgba(58,43,35,0.08)]">
          <div className="relative aspect-[16/9] bg-sand">
            {item.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverImageUrl}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-olive/45">
                Фото места
              </div>
            )}
          </div>
          <div className="p-5 md:p-6">
            <div className="flex flex-wrap gap-2">
              {item.category ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {item.category}
                </span>
              ) : null}
              {item.locationName ? (
                <span className="rounded-full bg-sand/70 px-3 py-1 text-xs font-semibold text-olive/65">
                  {item.locationName}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-olive md:text-4xl">
              {item.title}
            </h1>
            {item.shortDescription ? (
              <p className="mt-3 text-lg leading-7 text-olive/68">{item.shortDescription}</p>
            ) : null}
            {item.description ? (
              <div className="mt-5 whitespace-pre-line text-sm leading-7 text-olive/72 md:text-base">
                {item.description}
              </div>
            ) : null}

            {item.latitude !== null && item.longitude !== null ? (
              <div className="mt-5">
                <StaticMapPreview
                  latitude={item.latitude}
                  longitude={item.longitude}
                  label={item.address ?? item.locationName ?? item.title}
                />
              </div>
            ) : null}
          </div>
        </section>

        <aside className="h-max rounded-[24px] border border-white/70 bg-white/94 p-5 shadow-[0_18px_55px_rgba(58,43,35,0.07)] lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold text-olive">Место</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {item.locationName ? (
              <div>
                <dt className="text-olive/45">Локация</dt>
                <dd className="font-semibold text-olive">{item.locationName}</dd>
              </div>
            ) : null}
            {item.districtName ? (
              <div>
                <dt className="text-olive/45">Район</dt>
                <dd className="font-semibold text-olive">{item.districtName}</dd>
              </div>
            ) : null}
            {item.address ? (
              <div>
                <dt className="text-olive/45">Адрес</dt>
                <dd className="font-semibold text-olive">{item.address}</dd>
              </div>
            ) : null}
          </dl>

          {item.websiteUrl ? (
            <a
              href={item.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/24 bg-primary/8 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/12"
            >
              <AppIcon icon={ArrowUpRight} className="h-4 w-4" />
              Открыть сайт
            </a>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

export function TransferDetails({ item }: { item: PublicTransferCatalogItem }) {
  const phoneHref = telHref(item.contacts.phone);
  const phone2Href = telHref(item.contacts.phone2);
  const ownerInitials = `${item.owner.firstName.slice(0, 1)}${item.owner.lastName.slice(0, 1)}`
    .trim()
    .toUpperCase();
  const contactLinks = [
    ["WhatsApp", item.contacts.whatsappUrl],
    ["Telegram", item.contacts.telegramUrl],
    ["VK", item.contacts.vkUrl],
    ["MAX", item.contacts.maxUrl],
    ["Одноклассники", item.contacts.okUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/94 shadow-[0_20px_60px_rgba(58,43,35,0.08)]">
          <div className="relative aspect-[16/9] bg-sand">
            {item.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverImageUrl}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-olive/45">
                Фото автомобиля
              </div>
            )}
          </div>
          <div className="p-5 md:p-6">
            <div className="flex flex-wrap gap-2">
              {item.transferType ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {item.transferType}
                </span>
              ) : null}
              {item.vehicleClass ? (
                <span className="rounded-full bg-sand/70 px-3 py-1 text-xs font-semibold text-olive/65">
                  {item.vehicleClass}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-olive md:text-4xl">
              {item.title}
            </h1>
            {item.shortDescription ? (
              <p className="mt-3 text-lg leading-7 text-olive/68">{item.shortDescription}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-cream/70 p-3">
              <span className="inline-flex h-12 w-12 overflow-hidden rounded-full bg-white ring-1 ring-olive/10">
                {item.owner.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.owner.avatarUrl}
                    alt={item.contacts.contactName ?? item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-olive/60">
                    {ownerInitials || "?"}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-olive">
                  {item.contacts.contactName ?? `${item.owner.firstName} ${item.owner.lastName}`}
                </p>
                <p className="text-xs text-olive/52">Профиль водителя на Крым Вокруг</p>
              </div>
              <span className="rounded-xl border border-dashed border-olive/18 px-3 py-2 text-xs font-semibold text-olive/42">
                Без рейтинга
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {item.vehicleModel ? (
                <InfoTile icon={Car} label="Автомобиль" value={item.vehicleModel} />
              ) : null}
              {item.seats ? (
                <InfoTile icon={Users} label="Пассажиры" value={`${item.seats} мест`} />
              ) : null}
              {item.luggage ? (
                <InfoTile icon={BriefcaseBusiness} label="Багаж" value={`${item.luggage} мест`} />
              ) : null}
              {item.locationName ? (
                <InfoTile icon={MapPin} label="База" value={item.locationName} />
              ) : null}
            </div>

            {item.serviceArea || item.routeExamples ? (
              <div className="mt-5 rounded-2xl bg-cream/70 p-4 text-sm leading-6 text-olive/70">
                {item.serviceArea ? (
                  <p>
                    <span className="font-semibold text-olive">Зона:</span> {item.serviceArea}
                  </p>
                ) : null}
                {item.routeExamples ? (
                  <p className="mt-1">
                    <span className="font-semibold text-olive">Маршруты:</span> {item.routeExamples}
                  </p>
                ) : null}
              </div>
            ) : null}

            {item.description ? (
              <div className="mt-5 whitespace-pre-line text-sm leading-7 text-olive/72 md:text-base">
                {item.description}
              </div>
            ) : null}

            {item.latitude !== null && item.longitude !== null ? (
              <div className="mt-5">
                <StaticMapPreview
                  latitude={item.latitude}
                  longitude={item.longitude}
                  label={item.serviceArea ?? item.locationName ?? item.title}
                />
              </div>
            ) : null}
          </div>
        </section>

        <aside className="h-max rounded-[24px] border border-white/70 bg-white/94 p-5 shadow-[0_18px_55px_rgba(58,43,35,0.07)] lg:sticky lg:top-24">
          <p className="text-sm text-olive/52">Стоимость</p>
          <p className="mt-1 text-2xl font-extrabold text-olive">
            {formatPrice(item.priceFrom, item.priceUnitLabel)}
          </p>
          {item.contacts.contactName ? (
            <p className="mt-2 text-sm font-semibold text-olive">{item.contacts.contactName}</p>
          ) : null}

          <div className="mt-5 grid gap-2">
            {phoneHref ? (
              <a
                href={phoneHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                <AppIcon icon={Phone} className="h-4 w-4" />
                Позвонить
              </a>
            ) : null}
            {phone2Href ? (
              <a
                href={phone2Href}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-olive/14 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/22 hover:text-primary"
              >
                <AppIcon icon={Phone} className="h-4 w-4" />
                Второй телефон
              </a>
            ) : null}
            {contactLinks.map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-olive/14 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/22 hover:text-primary"
              >
                <AppIcon icon={ArrowUpRight} className="h-4 w-4" />
                {label}
              </a>
            ))}
            {item.contacts.websiteUrl ? (
              <a
                href={item.contacts.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-olive/14 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/22 hover:text-primary"
              >
                <AppIcon icon={ArrowUpRight} className="h-4 w-4" />
                Сайт
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

function InfoTile({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream/70 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-olive/42">
        <AppIcon icon={icon} className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-olive">{value}</p>
    </div>
  );
}

function StaticMapPreview({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  label: string;
}) {
  const mapUrl = `https://yandex.ru/map-widget/v1/?ll=${longitude}%2C${latitude}&pt=${longitude},${latitude},pm2rdm&z=13`;
  const externalUrl = `https://yandex.ru/maps/?ll=${longitude}%2C${latitude}&pt=${longitude},${latitude}&z=13&l=map`;

  return (
    <div className="overflow-hidden rounded-2xl border border-olive/10 bg-cream/70">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-olive">На карте</p>
          <p className="truncate text-xs text-olive/55">{label}</p>
        </div>
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-xl border border-primary/24 bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/8"
        >
          Открыть
        </a>
      </div>
      <iframe
        src={mapUrl}
        title={`Карта: ${label}`}
        className="h-72 w-full border-0"
        loading="lazy"
      />
    </div>
  );
}
