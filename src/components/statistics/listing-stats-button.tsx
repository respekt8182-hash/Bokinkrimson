"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Eye, RefreshCw, X } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

type DailyActivity = {
  date: string;
  views: number;
  actions: number;
};

type MonthlyActivity = {
  month: string;
  label: string;
  views: number;
  actions: number;
  phoneActions: number;
  messengerActions: number;
  leadActions: number;
  websiteActions: number;
  breakdown: ActionBreakdownItem[];
};

type ActionBreakdownItem = {
  actionType: string;
  label: string;
  count: number;
};

type ActionSummary = {
  total: number;
  phoneActions: number;
  messengerActions: number;
  leadActions: number;
  websiteActions: number;
  breakdown: ActionBreakdownItem[];
};

type StatsData = {
  totalViews: number;
  totalActions: number;
  periodViews: number;
  periodActions: number;
  periodLabel: string;
  dailyActivity: DailyActivity[];
  weeklyTotal: number;
  monthlyTotal: number;
  weeklyActions: number;
  monthlyActions: number;
  monthlyHistory: MonthlyActivity[];
  actionBreakdown: ActionBreakdownItem[];
  actionSummary?: {
    today: ActionSummary;
    week: ActionSummary;
    month30: ActionSummary;
    period: ActionSummary;
  };
  messengerActions: number;
  phoneActions: number;
  leadActions?: number;
  websiteActions?: number;
};

type RefreshRecord = { date: string; count: number };

type StatsRange = "today" | "week" | "month30" | "period" | "month";

type ListingStatsButtonProps = {
  endpoint: string;
  entityName: string;
  storageKey: string;
  buttonLabel?: string;
  className?: string;
};

const MAX_DAILY_REFRESHES = 2;
const LS_PREFIX = "listing_stats_refresh_";
const CHART_W = 720;
const CHART_H = 260;
const PAD_L = 42;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 36;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function getRefreshRecord(key: string): RefreshRecord {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return { date: todayStr(), count: 0 };
    const record = JSON.parse(raw) as RefreshRecord;
    return record.date === todayStr() ? record : { date: todayStr(), count: 0 };
  } catch {
    return { date: todayStr(), count: 0 };
  }
}

function bumpRefreshRecord(key: string): RefreshRecord {
  const record = getRefreshRecord(key);
  const next: RefreshRecord = { date: todayStr(), count: record.count + 1 };
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(next));
  } catch {
    // noop
  }
  return next;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function fmtDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getFallbackSummary(
  data: StatsData,
  range: "today" | "week" | "month30" | "period",
): ActionSummary {
  const total =
    range === "today"
      ? (data.dailyActivity.find((item) => item.date === todayStr())?.actions ?? 0)
      : range === "week"
        ? data.weeklyActions
        : range === "month30"
          ? data.monthlyActions
          : data.periodActions;

  return {
    total,
    phoneActions: range === "period" ? data.phoneActions : 0,
    messengerActions: range === "period" ? data.messengerActions : 0,
    leadActions: range === "period" ? (data.leadActions ?? 0) : 0,
    websiteActions: range === "period" ? (data.websiteActions ?? 0) : 0,
    breakdown: range === "period" ? data.actionBreakdown : [],
  };
}

function getActionSummary(
  data: StatsData,
  range: "today" | "week" | "month30" | "period",
): ActionSummary {
  return data.actionSummary?.[range] ?? getFallbackSummary(data, range);
}

function getMonthlySummary(item: MonthlyActivity | null): ActionSummary {
  return {
    total: item?.actions ?? 0,
    phoneActions: item?.phoneActions ?? 0,
    messengerActions: item?.messengerActions ?? 0,
    leadActions: item?.leadActions ?? 0,
    websiteActions: item?.websiteActions ?? 0,
    breakdown: item?.breakdown ?? [],
  };
}

function ActivityChart({ data }: { data: DailyActivity[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartData = data.slice(-30);
  const maxValue = Math.max(...chartData.map((item) => item.views + item.actions), 1);
  const slotW = PLOT_W / Math.max(chartData.length, 1);
  const barW = Math.max(Math.min(slotW - 6, 14), 4);
  const today = todayStr();

  return (
    <div className="rounded-2xl border border-olive/10 bg-white px-3 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-sm font-semibold text-olive">Динамика за 30 дней</p>
        <div className="flex items-center gap-3 text-[11px] text-olive/55">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            Просмотры
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-terra" />
            Действия
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        style={{ height: "auto", display: "block" }}
        role="img"
        aria-label="График просмотров и целевых действий по дням"
      >
        {[0, 0.5, 1].map((tick) => {
          const y = PAD_T + PLOT_H - tick * PLOT_H;
          return (
            <g key={tick}>
              <line
                x1={PAD_L}
                y1={y}
                x2={CHART_W - PAD_R}
                y2={y}
                stroke={tick === 0 ? "#c9bfb5" : "#e8e0d6"}
                strokeWidth={tick === 0 ? 0.8 : 0.5}
                strokeDasharray={tick === 0 ? "none" : "3 4"}
              />
              <text
                x={PAD_L - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                fill="#9e8e82"
              >
                {Math.round(tick * maxValue)}
              </text>
            </g>
          );
        })}

        {chartData.map((item, index) => {
          const total = item.views + item.actions;
          const totalHeight = total > 0 ? Math.max((total / maxValue) * PLOT_H, 3) : 0;
          const actionHeight =
            total > 0 && item.actions > 0 ? Math.max((item.actions / maxValue) * PLOT_H, 3) : 0;
          const x = PAD_L + index * slotW + (slotW - barW) / 2;
          const y = PAD_T + PLOT_H - totalHeight;
          const actionY = PAD_T + PLOT_H - actionHeight;
          const isActive = activeIndex === index;
          const isToday = item.date === today;

          return (
            <g key={item.date}>
              <rect
                x={PAD_L + index * slotW}
                y={PAD_T}
                width={slotW}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onPointerDown={() =>
                  setActiveIndex((current) => (current === index ? null : index))
                }
                style={{ cursor: "pointer" }}
              />
              {total === 0 ? (
                <line
                  x1={x}
                  y1={PAD_T + PLOT_H}
                  x2={x + barW}
                  y2={PAD_T + PLOT_H}
                  stroke="#e0d6cc"
                  strokeWidth={1}
                  pointerEvents="none"
                />
              ) : (
                <>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={totalHeight}
                    rx={3}
                    fill={isToday ? "#0d6b62" : "#0f766e"}
                    fillOpacity={isActive ? 0.96 : 0.78}
                    pointerEvents="none"
                  />
                  {item.actions > 0 ? (
                    <rect
                      x={x}
                      y={actionY}
                      width={barW}
                      height={actionHeight}
                      rx={3}
                      fill="#a76549"
                      fillOpacity={isActive ? 1 : 0.86}
                      pointerEvents="none"
                    />
                  ) : null}
                </>
              )}
              {isActive ? (
                <g pointerEvents="none">
                  <rect
                    x={Math.min(Math.max(x + barW / 2 - 64, PAD_L), CHART_W - PAD_R - 128)}
                    y={Math.max(y - 44, PAD_T)}
                    width={128}
                    height={34}
                    rx={7}
                    fill="#2b1f19"
                    opacity={0.94}
                  />
                  <text
                    x={Math.min(Math.max(x + barW / 2, PAD_L + 64), CHART_W - PAD_R - 64)}
                    y={Math.max(y - 44, PAD_T) + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill="white"
                  >
                    {fmtDate(item.date)}
                  </text>
                  <text
                    x={Math.min(Math.max(x + barW / 2, PAD_L + 64), CHART_W - PAD_R - 64)}
                    y={Math.max(y - 44, PAD_T) + 27}
                    textAnchor="middle"
                    fontSize={9}
                    fill="white"
                  >
                    {item.views} просмотров · {item.actions} действий
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {chartData.map((item, index) => {
          const showLabel = index === 0 || index === chartData.length - 1 || index % 5 === 0;
          if (!showLabel) return null;
          const x = PAD_L + index * slotW + slotW / 2;
          return (
            <text
              key={`${item.date}-label`}
              x={x}
              y={CHART_H - 10}
              textAnchor="middle"
              fontSize={9}
              fill="#9e8e82"
            >
              {fmtDate(item.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function MonthlyJournal({
  items,
  selectedMonth,
  onSelect,
}: {
  items: MonthlyActivity[];
  selectedMonth: string;
  onSelect: (month: string) => void;
}) {
  const maxValue = Math.max(...items.map((item) => item.views + item.actions), 1);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-olive">Журнал по месяцам</h3>
        <p className="text-xs text-olive/50">Последние 6 месяцев</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const total = item.views + item.actions;
          const width = `${Math.max(5, Math.round((total / maxValue) * 100))}%`;
          const actionShare = total > 0 ? `${Math.round((item.actions / total) * 100)}%` : "0%";
          const isSelected = item.month === selectedMonth;

          return (
            <button
              key={item.month}
              type="button"
              onClick={() => onSelect(item.month)}
              className={cn(
                "rounded-2xl border bg-white p-3 text-left transition hover:border-primary/25 hover:shadow-[0_10px_24px_rgba(15,118,110,0.08)]",
                isSelected ? "border-primary/45 ring-2 ring-primary/10" : "border-olive/10",
              )}
            >
              <p className="truncate text-xs font-semibold uppercase text-olive/45">{item.label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-xl font-bold text-olive">{formatNumber(item.actions)}</p>
                <p className="text-right text-[11px] leading-4 text-olive/55">
                  {formatNumber(item.views)} просмотров
                  <br />
                  {formatNumber(item.actions)} действий
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream">
                <div className="flex h-full rounded-full bg-primary/75" style={{ width }}>
                  <span className="block h-full bg-terra" style={{ width: actionShare }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ActionBreakdown({ items }: { items: ActionBreakdownItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-olive/16 bg-cream/45 px-4 py-5 text-sm text-olive/60">
        Целевых действий пока нет.
      </div>
    );
  }

  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-olive">По действиям</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.actionType}
            className="rounded-2xl border border-olive/10 bg-white px-3 py-3"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-olive">{item.label}</span>
              <span className="text-olive/60">{formatNumber(item.count)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream">
              <div
                className="h-full rounded-full bg-terra"
                style={{ width: `${Math.max(5, Math.round((item.count / maxCount) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionSummaryCards({
  summary,
  title,
  caption,
}: {
  summary: ActionSummary;
  title: string;
  caption: string;
}) {
  const cards = [
    {
      label: "Телефоны",
      value: summary.phoneActions,
      description: "Основной и доп. номера",
    },
    {
      label: "Мессенджеры",
      value: summary.messengerActions,
      description: "WhatsApp, Telegram, VK, Max, OK",
    },
    {
      label: "Лиды",
      value: summary.leadActions,
      description: "Кнопки брони и лид-фраза",
    },
    {
      label: "Сайт",
      value: summary.websiteActions,
      description: "Переходы на внешний сайт",
    },
  ];

  return (
    <section className="rounded-2xl border border-olive/10 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-olive">{title}</h3>
          <p className="mt-0.5 text-xs text-olive/50">{caption}</p>
        </div>
        <div className="rounded-2xl bg-primary/8 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/60">
            Всего
          </p>
          <p className="text-xl font-bold text-primary">{formatNumber(summary.total)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-cream/70 p-3">
            <p className="text-[11px] text-olive/50">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-olive">{formatNumber(card.value)}</p>
            <p className="mt-1 text-[10px] leading-4 text-olive/45">{card.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsModal({
  endpoint,
  entityName,
  storageKey,
  onClose,
}: {
  endpoint: string;
  entityName: string;
  storageKey: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshRec, setRefreshRec] = useState<RefreshRecord>({ date: todayStr(), count: 0 });
  const [activeRange, setActiveRange] = useState<StatsRange>("today");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const midnightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Ошибка сервера");
      setData((await response.json()) as StatsData);
      setLastUpdated(
        new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      );
    } catch {
      setError("Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    setRefreshRec(getRefreshRecord(storageKey));
    void fetchData();
  }, [fetchData, storageKey]);

  useEffect(() => {
    if (!data || selectedMonth) {
      return;
    }

    setSelectedMonth(data.monthlyHistory.at(-1)?.month ?? null);
  }, [data, selectedMonth]);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const ms = midnight.getTime() - now.getTime();
    midnightTimerRef.current = setTimeout(() => {
      setRefreshRec({ date: todayStr(), count: 0 });
      void fetchData();
    }, ms);
    return () => {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const canRefresh = refreshRec.count < MAX_DAILY_REFRESHES;
  const remaining = Math.max(0, MAX_DAILY_REFRESHES - refreshRec.count);
  const today = todayStr();
  const todayActivity = data?.dailyActivity.find((item) => item.date === today) ?? null;
  const selectedMonthItem =
    data?.monthlyHistory.find((item) => item.month === selectedMonth) ??
    data?.monthlyHistory.at(-1) ??
    null;
  const selectedSummary =
    data && activeRange !== "month"
      ? getActionSummary(data, activeRange)
      : getMonthlySummary(selectedMonthItem);
  const selectedViews =
    activeRange === "today"
      ? (todayActivity?.views ?? 0)
      : activeRange === "week"
        ? (data?.weeklyTotal ?? 0)
        : activeRange === "month30"
          ? (data?.monthlyTotal ?? 0)
          : activeRange === "period"
            ? (data?.periodViews ?? 0)
            : (selectedMonthItem?.views ?? 0);
  const rangeTitle =
    activeRange === "today"
      ? "Сегодня"
      : activeRange === "week"
        ? "За 7 дней"
        : activeRange === "month30"
          ? "За 30 дней"
          : activeRange === "period"
            ? (data?.periodLabel ?? "Последние 6 месяцев")
            : (selectedMonthItem?.label ?? "Выбранный месяц");
  const rangeCaption = `${formatNumber(selectedViews)} просмотров · ${formatNumber(
    selectedSummary.total,
  )} целевых действий`;

  function handleRefresh() {
    if (!canRefresh || loading) return;
    const next = bumpRefreshRecord(storageKey);
    setRefreshRec(next);
    void fetchData();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-midnight/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-olive/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AppIcon icon={BarChart3} className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="truncate text-base font-semibold text-olive">Статистика карточки</h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-olive/60">{entityName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-olive/50 hover:bg-cream hover:text-olive"
            aria-label="Закрыть"
          >
            <AppIcon icon={X} className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="rounded-xl bg-terra/10 px-4 py-3 text-sm text-terra">{error}</p>
          ) : loading && !data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-xl bg-cream" />
                ))}
              </div>
              <div className="h-56 animate-pulse rounded-xl bg-cream" />
            </div>
          ) : data ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[
                  {
                    range: "today" as const,
                    label: "Сегодня",
                    value: `${formatCompactNumber(todayActivity?.views ?? 0)} / ${formatCompactNumber(
                      todayActivity?.actions ?? 0,
                    )}`,
                    note: "просмотры / действия",
                    icon: BarChart3,
                  },
                  {
                    range: "week" as const,
                    label: "За 7 дней",
                    value: `${formatCompactNumber(data.weeklyTotal)} / ${formatCompactNumber(
                      data.weeklyActions,
                    )}`,
                    note: "просмотры / действия",
                    icon: Eye,
                  },
                  {
                    range: "month30" as const,
                    label: "За 30 дней",
                    value: `${formatCompactNumber(data.monthlyTotal)} / ${formatCompactNumber(
                      data.monthlyActions,
                    )}`,
                    note: "просмотры / действия",
                    icon: BarChart3,
                  },
                  {
                    range: "period" as const,
                    label: data.periodLabel,
                    value: `${formatCompactNumber(data.periodViews)} / ${formatCompactNumber(
                      data.periodActions,
                    )}`,
                    note: "последние 6 месяцев",
                    icon: BarChart3,
                  },
                ].map(({ range, label, value, note, icon }) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setActiveRange(range)}
                    className={cn(
                      "rounded-xl px-3 py-3 text-left transition hover:bg-primary/8",
                      activeRange === range
                        ? "bg-primary text-white shadow-[0_12px_28px_rgba(15,118,110,0.18)]"
                        : "bg-cream text-olive",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-[10px]",
                          activeRange === range ? "text-white/72" : "text-olive/55",
                        )}
                      >
                        {label}
                      </p>
                      <AppIcon
                        icon={icon}
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          activeRange === range ? "text-white/80" : "text-primary/70",
                        )}
                      />
                    </div>
                    <p className="mt-1 text-lg font-bold">{value}</p>
                    <p
                      className={cn(
                        "mt-0.5 text-[10px]",
                        activeRange === range ? "text-white/62" : "text-olive/45",
                      )}
                    >
                      {note}
                    </p>
                  </button>
                ))}
              </div>

              <ActionSummaryCards
                summary={selectedSummary}
                title={rangeTitle}
                caption={rangeCaption}
              />

              <ActivityChart data={data.dailyActivity} />

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.9fr)]">
                <MonthlyJournal
                  items={data.monthlyHistory}
                  selectedMonth={selectedMonthItem?.month ?? ""}
                  onSelect={(month) => {
                    setSelectedMonth(month);
                    setActiveRange("month");
                  }}
                />
                <div className="space-y-4">
                  <div className="rounded-2xl border border-olive/10 bg-cream/60 p-4">
                    <p className="text-sm font-semibold text-olive">
                      Что считается целевым действием
                    </p>
                    <p className="mt-2 text-xs leading-5 text-olive/58">
                      Клики по основному и дополнительным телефонам, мессенджерам, сайту и кнопкам
                      бронирования/лид-фразам. Срез справа меняется вместе с выбранным периодом или
                      месяцем.
                    </p>
                  </div>
                  <ActionBreakdown items={selectedSummary.breakdown} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-olive/50">
                <span>
                  {lastUpdated ? `Обновлено: ${lastUpdated}` : ""}
                  {" · "}
                  <span className="italic">Автообновление: раз в сутки</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className={remaining === 0 ? "text-terra/70" : ""}>
                    Ручных обновлений: {remaining}/{MAX_DAILY_REFRESHES}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={!canRefresh || loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <AppIcon
                      icon={RefreshCw}
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                    Обновить
                  </button>
                </div>
              </div>
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
        <StatsModal
          endpoint={endpoint}
          entityName={entityName}
          storageKey={storageKey}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
