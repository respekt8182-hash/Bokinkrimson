"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Clock3,
  CircleAlert,
  Eye,
  Globe2,
  Info,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Phone,
  RefreshCw,
  X,
} from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

type PeriodKey = "today" | "last7Days" | "last30Days" | "last6Months" | `month:${string}`;

type PeriodSummary = {
  views: number;
  actions: number;
  conversion: number | null;
};

type ChartPoint = {
  date: string;
  views: number;
  actions: number;
};

type Breakdown = {
  phones: number;
  messengers: number;
  leads: number;
  website: number;
  booking: number;
  other: number;
};

type BreakdownItem = {
  actionType: string;
  label: string;
  count: number;
};

type ListingAnalyticsRawEvent = {
  id: string;
  entityType: "property" | "excursion" | "transfer";
  entityId: string;
  entityPublicId: number | null;
  eventType: string;
  occurredAt: string;
  actorRole: "guest" | "owner" | "admin";
  userId: string | null;
  isUnique: boolean;
  channel: string | null;
  leadNumber: string | null;
  source: string | null;
};

type AnalyticsMonth = PeriodSummary & {
  month: string;
  label: string;
  activityLevel: "none" | "low" | "medium" | "high";
  breakdown: Breakdown;
  breakdownItems: BreakdownItem[];
};

type StatsData = {
  entityType: "property" | "excursion" | "transfer";
  entityId: string;
  entityPublicId: number | null;
  entityName: string;
  lastUpdatedAt: string | null;
  nextAutoUpdateAt: string | null;
  updateStatus: "idle" | "updating" | "success" | "error";
  isStale: boolean;
  staleReason: string | null;
  manualRefresh: {
    limitPerDay: number;
    usedToday: number;
    remainingToday: number;
    canRefresh: boolean;
    isUpdating: boolean;
  };
  summary: {
    today: PeriodSummary;
    last7Days: PeriodSummary;
    last30Days: PeriodSummary;
    last6Months: PeriodSummary;
  };
  selectedPeriod: PeriodSummary & {
    key: PeriodKey;
    label: string;
    breakdown: Breakdown;
    breakdownItems: BreakdownItem[];
    chart: ChartPoint[];
  };
  dailyActivity: ChartPoint[];
  months: AnalyticsMonth[];
  meta: {
    autoUpdateHour: number;
    timeZone: string;
    source: "aggregated" | "legacy";
    lastEventAt: string | null;
    lastError: string | null;
  };
  adminRawEvents?: ListingAnalyticsRawEvent[];
};

type ListingStatsButtonProps = {
  endpoint: string;
  entityName: string;
  storageKey: string;
  buttonLabel?: string;
  className?: string;
};

const PERIOD_OPTIONS: Array<{
  key: Exclude<PeriodKey, `month:${string}`>;
  label: string;
  description: string;
  summaryKey: keyof StatsData["summary"];
}> = [
  { key: "today", label: "Сегодня", description: "Текущий день", summaryKey: "today" },
  { key: "last7Days", label: "7 дней", description: "Последняя неделя", summaryKey: "last7Days" },
  { key: "last30Days", label: "30 дней", description: "Основной период", summaryKey: "last30Days" },
  {
    key: "last6Months",
    label: "6 месяцев",
    description: "Длинная динамика",
    summaryKey: "last6Months",
  },
];

const BREAKDOWN_CARDS: Array<{
  key: keyof Breakdown;
  label: string;
  hint: string;
  icon: typeof Phone;
}> = [
  { key: "phones", label: "Телефоны", hint: "Основной и дополнительные номера", icon: Phone },
  { key: "messengers", label: "Мессенджеры", hint: "WhatsApp, Telegram, VK, Max, OK", icon: MessageCircle },
  { key: "leads", label: "Лиды", hint: "Лид-фраза и форма сообщения", icon: MessageSquareText },
  { key: "website", label: "Сайт", hint: "Переходы на внешний сайт", icon: Globe2 },
  { key: "booking", label: "Бронирование", hint: "Клики по кнопке брони", icon: CalendarDays },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "ещё не обновлялась";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatChartDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function buildEndpoint(endpoint: string, period: PeriodKey): string {
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}${new URLSearchParams({ period }).toString()}`;
}

function hasAnyData(data: StatsData): boolean {
  return (
    data.summary.last6Months.views > 0 ||
    data.summary.last6Months.actions > 0 ||
    data.months.some((month) => month.views > 0 || month.actions > 0)
  );
}

function ActivityChart({ points }: { points: ChartPoint[] }) {
  const chartPoints = points.length > 0 ? points : [];
  const maxValue = Math.max(
    1,
    ...chartPoints.flatMap((point) => [point.views, point.actions]),
  );
  const width = 680;
  const height = 260;
  const padLeft = 42;
  const padRight = 20;
  const padTop = 22;
  const padBottom = 42;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const hasData = chartPoints.some((point) => point.views > 0 || point.actions > 0);

  const getX = (index: number) =>
    padLeft + (chartPoints.length <= 1 ? plotWidth / 2 : (index / (chartPoints.length - 1)) * plotWidth);
  const getY = (value: number) => padTop + plotHeight - (value / maxValue) * plotHeight;
  const buildPath = (field: "views" | "actions") =>
    chartPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${getX(index).toFixed(1)} ${getY(point[field]).toFixed(1)}`)
      .join(" ");

  return (
    <section className="rounded-xl border border-olive/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-olive">Динамика</h3>
          <p className="mt-0.5 text-xs text-olive/55">
            Просмотры и целевые действия в выбранном периоде
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-olive/60">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Просмотры
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-terra" />
            Действия
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="mt-4 flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-olive/14 bg-cream/45 px-4 text-center text-sm text-olive/58">
          Данных для графика пока мало. После первых просмотров и действий здесь появится динамика.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-4 w-full"
          role="img"
          aria-label="График просмотров и целевых действий"
        >
          {[0, 0.5, 1].map((tick) => {
            const y = padTop + plotHeight - tick * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={tick === 0 ? "#d5cabf" : "#eadfd4"}
                  strokeDasharray={tick === 0 ? undefined : "4 5"}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#8e7c70"
                >
                  {Math.round(maxValue * tick)}
                </text>
              </g>
            );
          })}

          <path d={buildPath("views")} fill="none" stroke="#0f766e" strokeWidth={3} />
          <path d={buildPath("actions")} fill="none" stroke="#a76549" strokeWidth={3} />

          {chartPoints.map((point, index) => (
            <g key={point.date}>
              <circle cx={getX(index)} cy={getY(point.views)} r={3.5} fill="#0f766e" />
              <circle cx={getX(index)} cy={getY(point.actions)} r={3.5} fill="#a76549" />
              {(index === 0 || index === chartPoints.length - 1 || index % 5 === 0) && (
                <text
                  x={getX(index)}
                  y={height - 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#8e7c70"
                >
                  {formatChartDate(point.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
    </section>
  );
}

function BreakdownPanel({ data }: { data: StatsData }) {
  const selected = data.selectedPeriod;
  const maxValue = Math.max(1, ...selected.breakdownItems.map((item) => item.count));

  return (
    <section className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {BREAKDOWN_CARDS.map((card) => (
          <div key={card.key} className="rounded-xl border border-olive/10 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-olive/55">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-olive">
                  {formatNumber(selected.breakdown[card.key])}
                </p>
              </div>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <AppIcon icon={card.icon} className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 min-h-8 text-[11px] leading-4 text-olive/48">{card.hint}</p>
          </div>
        ))}
      </div>

      {selected.breakdownItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-olive/14 bg-cream/45 px-4 py-4 text-sm text-olive/58">
          За выбранный период целевых действий пока нет.
        </div>
      ) : (
        <div className="rounded-xl border border-olive/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-olive">Из чего состоят действия</h3>
          <div className="mt-3 space-y-2">
            {selected.breakdownItems.map((item) => (
              <div key={item.actionType}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-olive">{item.label}</span>
                  <span className="text-olive/58">{formatNumber(item.count)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream">
                  <div
                    className="h-full rounded-full bg-terra"
                    style={{ width: `${Math.max(5, Math.round((item.count / maxValue) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const ACTOR_ROLE_LABELS: Record<ListingAnalyticsRawEvent["actorRole"], string> = {
  guest: "Гость",
  owner: "Владелец",
  admin: "Админ",
};

function getRawEventLabel(eventType: string): string {
  if (eventType === "view") return "Просмотр";
  if (eventType === "lead_copy") return "Копирование лида";
  if (eventType === "lead_form") return "Формирование лида";
  if (eventType === "lead_phrase") return "Открытие формы";
  if (eventType.startsWith("phone_")) return "Звонок";
  if (eventType === "whatsapp") return "WhatsApp";
  if (eventType === "telegram") return "Telegram";
  if (eventType === "max") return "MAX";
  if (eventType === "website") return "Сайт";
  return eventType;
}

function RawEventsPanel({ events }: { events: ListingAnalyticsRawEvent[] }) {
  const [roleFilter, setRoleFilter] = useState<"all" | ListingAnalyticsRawEvent["actorRole"]>(
    "all",
  );
  const [eventFilter, setEventFilter] = useState("all");
  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((event) => event.eventType))).sort(),
    [events],
  );
  const filteredEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          (roleFilter === "all" || event.actorRole === roleFilter) &&
          (eventFilter === "all" || event.eventType === eventFilter),
      ),
    [eventFilter, events, roleFilter],
  );

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-olive/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-olive">Технические события</h3>
          <p className="mt-0.5 text-xs text-olive/55">
            Видны администратору: сырые клики, роли, повторы, каналы и номера обращений.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value as "all" | ListingAnalyticsRawEvent["actorRole"])
            }
            className="h-9 rounded-lg border border-olive/12 bg-white px-2.5 text-xs text-olive outline-none"
          >
            <option value="all">Все роли</option>
            <option value="guest">Гости</option>
            <option value="owner">Владельцы</option>
            <option value="admin">Админы</option>
          </select>
          <select
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value)}
            className="h-9 rounded-lg border border-olive/12 bg-white px-2.5 text-xs text-olive outline-none"
          >
            <option value="all">Все события</option>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {getRawEventLabel(eventType)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-olive/10">
        <div className="grid grid-cols-[1.15fr_0.75fr_0.7fr_0.65fr_0.75fr_1fr] gap-2 bg-cream/70 px-3 py-2 text-[11px] font-semibold uppercase text-olive/50">
          <span>Событие</span>
          <span>Роль</span>
          <span>Повтор</span>
          <span>Канал</span>
          <span>Обращение</span>
          <span>Источник</span>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-olive/8">
          {filteredEvents.length === 0 ? (
            <p className="px-3 py-4 text-sm text-olive/55">По выбранным фильтрам событий нет.</p>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[1.15fr_0.75fr_0.7fr_0.65fr_0.75fr_1fr] gap-2 px-3 py-2 text-xs text-olive/68"
              >
                <span>
                  <b className="block text-olive">{getRawEventLabel(event.eventType)}</b>
                  {formatDateTime(event.occurredAt)}
                </span>
                <span>{ACTOR_ROLE_LABELS[event.actorRole]}</span>
                <span>{event.isUnique ? "Уник." : "Повтор"}</span>
                <span>{event.channel ?? "—"}</span>
                <span>{event.leadNumber ?? "—"}</span>
                <span className="truncate" title={event.source ?? undefined}>
                  {event.source ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function MonthlyJournal({
  months,
  activePeriod,
  onSelect,
}: {
  months: AnalyticsMonth[];
  activePeriod: PeriodKey;
  onSelect: (period: PeriodKey) => void;
}) {
  const maxValue = Math.max(1, ...months.map((month) => month.views + month.actions));

  return (
    <section className="rounded-xl border border-olive/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-olive">Журнал по месяцам</h3>
          <p className="mt-0.5 text-xs text-olive/55">Нажмите на месяц, чтобы открыть детализацию</p>
        </div>
        <AppIcon icon={CalendarDays} className="h-5 w-5 text-primary/70" />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((month) => {
          const period: PeriodKey = `month:${month.month}`;
          const total = month.views + month.actions;
          const isActive = activePeriod === period;
          const width = `${Math.max(total > 0 ? 8 : 0, Math.round((total / maxValue) * 100))}%`;

          return (
            <button
              key={month.month}
              type="button"
              onClick={() => onSelect(period)}
              className={cn(
                "rounded-xl border p-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.03]",
                isActive ? "border-primary/45 bg-primary/[0.04]" : "border-olive/10 bg-white",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-olive">{month.label}</p>
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    month.activityLevel === "high"
                      ? "bg-primary"
                      : month.activityLevel === "medium"
                        ? "bg-terra"
                        : month.activityLevel === "low"
                          ? "bg-sage"
                          : "bg-olive/18",
                  )}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-olive/55">
                <span>
                  <b className="block text-base text-olive">{formatNumber(month.views)}</b>
                  просмотры
                </span>
                <span>
                  <b className="block text-base text-olive">{formatNumber(month.actions)}</b>
                  действия
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream">
                <div className="h-full rounded-full bg-primary/75" style={{ width }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StatsModal({
  endpoint,
  entityName,
  onClose,
}: {
  endpoint: string;
  entityName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StatsData | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("last30Days");
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (period: PeriodKey, soft = false) => {
      if (soft) {
        setPeriodLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(buildEndpoint(endpoint, period), { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as StatsData | { error?: string } | null;

        if (!response.ok) {
          throw new Error(payload && "error" in payload ? payload.error : "Не удалось загрузить статистику");
        }

        setData(payload as StatsData);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Не удалось загрузить статистику",
        );
      } finally {
        setLoading(false);
        setPeriodLoading(false);
      }
    },
    [endpoint],
  );

  useEffect(() => {
    void fetchData(activePeriod);
  }, [activePeriod, fetchData]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const periodCards = useMemo(() => {
    if (!data) {
      return [];
    }

    return PERIOD_OPTIONS.map((option) => ({
      ...option,
      summary: data.summary[option.summaryKey],
    }));
  }, [data]);

  async function handleRefresh() {
    if (!data?.manualRefresh.canRefresh || refreshing) {
      return;
    }

    setRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Не удалось обновить статистику");
      }

      await fetchData(activePeriod, true);
    } catch (requestError) {
      setRefreshError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось обновить статистику",
      );
    } finally {
      setRefreshing(false);
    }
  }

  const selected = data?.selectedPeriod;
  const empty = data ? !hasAnyData(data) : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="absolute inset-0 bg-midnight/58 backdrop-blur-sm" />

      <div className="relative z-10 flex max-h-[94dvh] w-full max-w-5xl flex-col rounded-t-2xl bg-cream shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-olive/10 bg-white px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <AppIcon icon={BarChart3} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-olive sm:text-lg">
                  Статистика карточки
                </h2>
                <p className="truncate text-xs text-olive/58">
                  {data?.entityName ?? entityName}
                  {data?.entityPublicId ? ` · ID ${data.entityPublicId}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {data ? (
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs sm:inline-flex",
                  data.isStale
                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                    : "bg-primary/8 text-primary ring-1 ring-primary/12",
                )}
              >
                <AppIcon icon={Clock3} className="h-3.5 w-3.5" />
                {data.lastUpdatedAt ? `Обновлено ${formatDateTime(data.lastUpdatedAt)}` : "Ожидает пересчёта"}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-olive/10 bg-white text-olive/60 transition hover:bg-cream hover:text-olive"
              aria-label="Закрыть"
            >
              <AppIcon icon={X} className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && !data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-xl bg-white" />
                ))}
              </div>
              <div className="h-52 animate-pulse rounded-xl bg-white" />
              <div className="h-36 animate-pulse rounded-xl bg-white" />
            </div>
          ) : error && !data ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          ) : data && selected ? (
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {periodCards.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setActivePeriod(option.key)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        activePeriod === option.key
                          ? "border-primary/45 bg-primary text-white shadow-[0_14px_30px_rgba(15,118,110,0.18)]"
                          : "border-olive/10 bg-white text-olive hover:border-primary/24",
                      )}
                    >
                      <p
                        className={cn(
                          "text-xs font-semibold",
                          activePeriod === option.key ? "text-white" : "text-olive",
                        )}
                      >
                        {option.label}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-[11px]",
                          activePeriod === option.key ? "text-white/70" : "text-olive/45",
                        )}
                      >
                        {option.description}
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <p className="text-xl font-bold">{formatCompactNumber(option.summary.views)}</p>
                        <p
                          className={cn(
                            "text-right text-[11px] leading-4",
                            activePeriod === option.key ? "text-white/70" : "text-olive/50",
                          )}
                        >
                          {formatCompactNumber(option.summary.actions)}
                          <br />
                          действий
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-olive/10 bg-white p-3 lg:min-w-[260px]">
                  <div className="flex items-start gap-2 text-xs text-olive/58">
                    <AppIcon icon={Clock3} className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p>
                        Обновлено: <span className="font-medium text-olive">{formatDateTime(data.lastUpdatedAt)}</span>
                      </p>
                      <p className="mt-1">
                        Следующее автообновление:{" "}
                        <span className="font-medium text-olive">{formatDateTime(data.nextAutoUpdateAt)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={!data.manualRefresh.canRefresh || refreshing}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white px-3 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <AppIcon
                      icon={refreshing ? Loader2 : RefreshCw}
                      className={cn("h-4 w-4", refreshing && "animate-spin")}
                    />
                    {data.manualRefresh.remainingToday > 0
                      ? `Обновить · осталось ${data.manualRefresh.remainingToday} из ${data.manualRefresh.limitPerDay}`
                      : "Лимит обновлений исчерпан"}
                  </button>
                </div>
              </div>

              {refreshError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {refreshError}
                </div>
              ) : null}

              {data.isStale ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="flex items-start gap-2">
                    <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4" />
                    <span>
                      Данные могут быть устаревшими. {data.staleReason ?? "Они обновятся по расписанию или вручную."}
                    </span>
                  </div>
                </div>
              ) : null}

              {periodLoading ? (
                <div className="rounded-xl border border-primary/12 bg-white px-4 py-3 text-sm text-primary">
                  <span className="inline-flex items-center gap-2">
                    <AppIcon icon={Loader2} className="h-4 w-4 animate-spin" />
                    Обновляем выбранный период...
                  </span>
                </div>
              ) : null}

              <section className="grid gap-3">
                <div className="rounded-xl border border-olive/10 bg-white p-4">
                  <p className="text-sm font-semibold text-olive">{selected.label}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-cream/70 p-3">
                      <p className="text-xs text-olive/55">Просмотры</p>
                      <p className="mt-1 text-3xl font-bold text-olive">{formatNumber(selected.views)}</p>
                    </div>
                    <div className="rounded-lg bg-cream/70 p-3">
                      <p className="text-xs text-olive/55">Целевые действия</p>
                      <p className="mt-1 text-3xl font-bold text-olive">{formatNumber(selected.actions)}</p>
                    </div>
                  </div>
                </div>
              </section>

              {empty ? (
                <div className="rounded-xl border border-dashed border-olive/16 bg-white px-4 py-6 text-center">
                  <AppIcon icon={Eye} className="mx-auto h-8 w-8 text-olive/32" />
                  <h3 className="mt-3 text-sm font-semibold text-olive">Данных пока нет</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-olive/58">
                    После публикации и первых действий гостей здесь появятся просмотры, обращения и динамика.
                  </p>
                </div>
              ) : null}

              <BreakdownPanel data={data} />
              <ActivityChart points={selected.chart} />

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.55fr)]">
                <MonthlyJournal
                  months={data.months}
                  activePeriod={activePeriod}
                  onSelect={(period) => setActivePeriod(period)}
                />

                <section className="rounded-xl border border-olive/10 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <AppIcon icon={Info} className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-olive">
                      Что считается целевым действием
                    </h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-olive/65">
                    <p>Просмотр — открытие публичной страницы карточки.</p>
                    <p>
                      Целевое действие — клик по телефону, мессенджеру, сайту, кнопке брони,
                      лид-фразе или форме сообщения.
                    </p>
                    <p>
                      Владелец видит очищенную гостевую статистику: свои действия владельца,
                      действия администратора и короткие повторы не увеличивают целевые показатели.
                    </p>
                  </div>
                </section>
              </div>

              {data.adminRawEvents ? <RawEventsPanel events={data.adminRawEvents} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ListingStatsButton({
  endpoint,
  entityName,
  storageKey,
  buttonLabel = "Статистика",
  className,
}: ListingStatsButtonProps) {
  const [open, setOpen] = useState(false);
  void storageKey;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border border-primary/35 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5",
          className,
        )}
      >
        <AppIcon icon={BarChart3} className="h-4 w-4" />
        {buttonLabel}
      </button>

      {open ? (
        <StatsModal endpoint={endpoint} entityName={entityName} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
