import Link from "next/link";
import { ArrowUpRight, Clock3, Mail, Phone, RefreshCw, Search } from "lucide-react";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminPillLink,
  AdminStatCard,
  adminInputClass,
} from "@/components/admin/admin-ui";
import {
  DEFAULT_PLACEMENT_RENEWAL_LOOKAHEAD_DAYS,
  PLACEMENT_RENEWAL_LOOKAHEAD_OPTIONS,
  getAdminPlacementRenewals,
  parsePlacementRenewalLookaheadDays,
  type AdminPlacementRenewalItem,
  type PlacementRenewalEntityType,
} from "@/lib/admin-placement-renewals";
import { loadDataWithDatabaseFallback } from "@/lib/database-fallback";
import { rankByTrigram } from "@/lib/fuzzy";
import { getProviderLabel } from "@/lib/payments";
import {
  PLACEMENT_PROMO_DEMO_LABEL,
  PLACEMENT_PROMO_DEMO_RENEWAL_LOOKAHEAD_DAYS,
} from "@/lib/placement-promo";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    type?: string;
    days?: string;
    q?: string;
  }>;
};

const TYPE_LABELS: Record<PlacementRenewalEntityType | "all", string> = {
  all: "Все",
  property: "Жильё",
  excursion: "Экскурсии",
  tour: "Туры",
  transfer: "Трансферы",
};

const TYPE_PILL_CLASS: Record<PlacementRenewalEntityType, string> = {
  property: "bg-emerald-100 text-emerald-800",
  excursion: "bg-sky-100 text-sky-800",
  tour: "bg-indigo-100 text-indigo-800",
  transfer: "bg-cyan-100 text-cyan-800",
};

function normalizeTypeFilter(value: string | undefined): PlacementRenewalEntityType | "all" {
  if (value === "property" || value === "excursion" || value === "tour" || value === "transfer") {
    return value;
  }

  return "all";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function pluralizeDays(value: number): string {
  const abs = Math.abs(value) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) return "дней";
  if (mod > 1 && mod < 5) return "дня";
  if (mod === 1) return "день";
  return "дней";
}

function formatDaysLeft(daysLeft: number): string {
  if (daysLeft <= 0) return "сегодня";
  return `${daysLeft} ${pluralizeDays(daysLeft)}`;
}

function normalizePhoneHref(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? `tel:+${digits}` : null;
}

function normalizeEmailHref(email: string | null | undefined): string | null {
  const value = email?.trim() ?? "";
  return value ? `mailto:${value}` : null;
}

function searchFields(item: AdminPlacementRenewalItem): Array<string | null | undefined> {
  return [
    item.title,
    item.subtitle,
    item.entityLabel,
    item.locationName,
    item.owner.name,
    item.owner.phone,
    item.owner.email,
    item.contactName,
    item.contactEmail,
    item.websiteUrl,
    ...item.contactPhones.flatMap((phone) => [phone.label, phone.phone]),
  ];
}

function ContactLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return <span className="font-medium text-olive">{children}</span>;
  }

  return (
    <a href={href} className="font-medium text-primary transition hover:text-primary-hover">
      {children}
    </a>
  );
}

function buildFilterLink(input: {
  type: PlacementRenewalEntityType | "all";
  days: number;
  q: string;
  overrides?: { type?: PlacementRenewalEntityType | "all"; days?: number; q?: string };
}): string {
  const params = new URLSearchParams();
  const type = input.overrides?.type ?? input.type;
  const days = input.overrides?.days ?? input.days;
  const query = input.overrides?.q ?? input.q;

  if (type !== "all") params.set("type", type);
  if (days !== DEFAULT_PLACEMENT_RENEWAL_LOOKAHEAD_DAYS) params.set("days", String(days));
  if (query) params.set("q", query);

  const search = params.toString();
  return search ? `/admin/renewals?${search}` : "/admin/renewals";
}

export default async function AdminRenewalsPage({ searchParams }: Props) {
  const filters = await searchParams;
  const selectedType = normalizeTypeFilter(filters.type);
  const lookaheadDays = parsePlacementRenewalLookaheadDays(filters.days);
  const query = filters.q?.trim() ?? "";
  const now = new Date();

  const { items: allItems, isDatabaseFallback } = await loadDataWithDatabaseFallback(
    {
      contextId: "admin-placement-renewals",
      unavailableMessage:
        "Admin placement renewals: database is unavailable. Rendering empty renewal list.",
      fallbackEligibleMessage:
        "Admin placement renewals: database is unavailable or credentials are invalid. Rendering empty renewal list.",
    },
    async () => ({
      items: await getAdminPlacementRenewals({ now, lookaheadDays }),
      isDatabaseFallback: false,
    }),
    { items: [], isDatabaseFallback: true },
  );

  const typeFiltered =
    selectedType === "all" ? allItems : allItems.filter((item) => item.entityType === selectedType);
  const items =
    query.length >= 2
      ? rankByTrigram(query, typeFiltered, searchFields, {
          limit: typeFiltered.length,
          minScore: 0.08,
        })
      : typeFiltered;

  const typeCounts = allItems.reduce(
    (acc, item) => {
      acc[item.entityType] = (acc[item.entityType] ?? 0) + 1;
      return acc;
    },
    {} as Record<PlacementRenewalEntityType, number>,
  );
  const nextSevenDaysCount = allItems.filter((item) => item.daysLeft <= 7).length;
  const demoCount = allItems.filter((item) => item.payment.isDemo).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Продление"
        title="Заканчивается размещение"
        description={`Опубликованные объявления, у которых срок размещения закончится в ближайшие ${lookaheadDays} ${pluralizeDays(lookaheadDays)}. Демо-размещения показываются за ${PLACEMENT_PROMO_DEMO_RENEWAL_LOOKAHEAD_DAYS} ${pluralizeDays(PLACEMENT_PROMO_DEMO_RENEWAL_LOOKAHEAD_DAYS)} до окончания.`}
      />

      {isDatabaseFallback ? (
        <AdminNotice>
          Список временно недоступен. Данные появятся после восстановления подключения к базе.
        </AdminNotice>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard
          label="К продлению"
          value={allItems.length}
          description={`Период: ${lookaheadDays} ${pluralizeDays(lookaheadDays)}`}
          icon={RefreshCw}
          tone={allItems.length > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="До 7 дней"
          value={nextSevenDaysCount}
          description="Самые срочные контакты"
          icon={Clock3}
          tone={nextSevenDaysCount > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Демо-режим"
          value={demoCount}
          description="Бесплатные размещения"
          icon={Clock3}
          tone={demoCount > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label="Жильё"
          value={typeCounts.property ?? 0}
          description="Отели, апартаменты, дома"
        />
        <AdminStatCard
          label="Экскурсии и туры"
          value={(typeCounts.excursion ?? 0) + (typeCounts.tour ?? 0)}
          description="Программы каталога"
        />
        <AdminStatCard
          label="Трансферы"
          value={typeCounts.transfer ?? 0}
          description="Карточки водителей"
        />
      </section>

      <AdminPanel title="Фильтры">
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_1.6fr_auto]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Тип</span>
            <select name="type" defaultValue={selectedType} className={adminInputClass}>
              <option value="all">Все типы</option>
              <option value="property">Жильё</option>
              <option value="excursion">Экскурсии</option>
              <option value="tour">Туры</option>
              <option value="transfer">Трансферы</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Период</span>
            <select name="days" defaultValue={lookaheadDays} className={adminInputClass}>
              {PLACEMENT_RENEWAL_LOOKAHEAD_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  До {days} {pluralizeDays(days)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-olive">Поиск</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Название, владелец, телефон"
              className={adminInputClass}
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover lg:w-auto"
            >
              <Search className="h-4 w-4" />
              Найти
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <AdminPillLink
            href={buildFilterLink({
              type: selectedType,
              days: lookaheadDays,
              q: query,
              overrides: { type: "all" },
            })}
            active={selectedType === "all"}
          >
            Все ({allItems.length})
          </AdminPillLink>
          {(["property", "excursion", "tour", "transfer"] as const).map((type) => (
            <AdminPillLink
              key={type}
              href={buildFilterLink({
                type: selectedType,
                days: lookaheadDays,
                q: query,
                overrides: { type },
              })}
              active={selectedType === type}
            >
              {TYPE_LABELS[type]} ({typeCounts[type] ?? 0})
            </AdminPillLink>
          ))}
        </div>
      </AdminPanel>

      {items.length === 0 ? (
        <AdminEmptyState
          title="Нет объявлений к продлению"
          description={
            isDatabaseFallback
              ? "Попробуйте открыть раздел позже."
              : "В выбранном периоде нет опубликованных объявлений с окончанием платного или демо-срока."
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const ownerPhoneHref = normalizePhoneHref(item.owner.phone);
            const ownerEmailHref = normalizeEmailHref(item.owner.email);

            return (
              <article
                key={`${item.entityType}:${item.id}`}
                className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_45px_rgba(58,43,35,0.07)]"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_PILL_CLASS[item.entityType]}`}
                      >
                        {item.entityLabel}
                      </span>
                      {item.payment.isDemo ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          {PLACEMENT_PROMO_DEMO_LABEL}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Осталось {formatDaysLeft(item.daysLeft)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-xl font-semibold leading-tight text-olive">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm text-olive/58">
                      {[item.subtitle, item.locationName].filter(Boolean).join(" • ") ||
                        "Локация не указана"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={item.adminHref}
                      className="rounded-2xl border border-olive/12 bg-white px-4 py-2.5 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
                    >
                      Открыть в админке
                    </Link>
                    <Link
                      href={item.publicHref}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary/8 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/12"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      На сайте
                    </Link>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">
                      {item.payment.isDemo ? "Демо до" : "Оплачено до"}
                    </dt>
                    <dd className="font-semibold text-olive">{formatDate(item.validUntil)}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">
                      {item.payment.isDemo ? "Тип размещения" : "Последняя оплата"}
                    </dt>
                    <dd className="font-semibold text-olive">
                      {item.payment.isDemo
                        ? "Бесплатное размещение"
                        : formatMoney(item.payment.amount)}
                    </dd>
                    <dd className="mt-1 text-xs text-olive/52">
                      {item.payment.isDemo ? "0 ₽, демо-режим" : getProviderLabel(item.payment.provider)}
                      {item.payment.paidAt && !item.payment.isDemo
                        ? ` • ${formatDateTime(item.payment.paidAt)}`
                        : ""}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Владелец</dt>
                    <dd className="font-semibold text-olive">{item.owner.name}</dd>
                    <dd className="mt-1 text-xs text-olive/52">ID: {item.owner.id}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream/80 px-3 py-3">
                    <dt className="text-olive/50">Обновлено</dt>
                    <dd className="font-semibold text-olive">{formatDateTime(item.updatedAt)}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1.2fr]">
                  <div className="rounded-2xl border border-olive/10 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/42">
                      Профиль владельца
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-olive/72">
                      <p className="flex flex-wrap items-center gap-2">
                        <Phone className="h-4 w-4 text-olive/40" />
                        <ContactLink href={ownerPhoneHref}>{item.owner.phone}</ContactLink>
                      </p>
                      {item.owner.email ? (
                        <p className="flex flex-wrap items-center gap-2">
                          <Mail className="h-4 w-4 text-olive/40" />
                          <ContactLink href={ownerEmailHref}>{item.owner.email}</ContactLink>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-olive/10 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-olive/42">
                      Контакты объявления
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-olive/72">
                      {item.contactName ? (
                        <p>
                          Контактное лицо:{" "}
                          <span className="font-medium text-olive">{item.contactName}</span>
                        </p>
                      ) : null}
                      {item.contactPhones.length > 0 ? (
                        item.contactPhones.map((contact) => (
                          <p
                            key={`${contact.label}:${contact.phone}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <Phone className="h-4 w-4 text-olive/40" />
                            <span className="text-olive/52">{contact.label}:</span>
                            <ContactLink href={normalizePhoneHref(contact.phone)}>
                              {contact.phone}
                            </ContactLink>
                          </p>
                        ))
                      ) : (
                        <p>Отдельный телефон в объявлении не указан.</p>
                      )}
                      {item.contactEmail ? (
                        <p className="flex flex-wrap items-center gap-2">
                          <Mail className="h-4 w-4 text-olive/40" />
                          <ContactLink href={normalizeEmailHref(item.contactEmail)}>
                            {item.contactEmail}
                          </ContactLink>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
