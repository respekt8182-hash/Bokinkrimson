"use client";

import { BarChart3, ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";

type DailyView = { date: string; count: number };

type StatsData = {
  totalViews: number;
  dailyViews: DailyView[];
  weeklyTotal: number;
  monthlyTotal: number;
};

type RefreshRecord = { date: string; count: number };

const MAX_DAILY_REFRESHES = 2;
const LS_PREFIX = "transfer_stats_refresh_";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function getRefreshRecord(id: string): RefreshRecord {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (!raw) return { date: todayStr(), count: 0 };
    const rec = JSON.parse(raw) as RefreshRecord;
    return rec.date === todayStr() ? rec : { date: todayStr(), count: 0 };
  } catch {
    return { date: todayStr(), count: 0 };
  }
}

function bumpRefreshRecord(id: string): RefreshRecord {
  const rec = getRefreshRecord(id);
  const next: RefreshRecord = { date: todayStr(), count: rec.count + 1 };
  try {
    localStorage.setItem(LS_PREFIX + id, JSON.stringify(next));
  } catch {
    // noop
  }
  return next;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

const VB_W = 580;
const VB_H = 190;
const PAD_L = 36;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 28;
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;
const PAGE_SIZE = 8;

function BarChart({ data }: { data: DailyView[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const today = todayStr();
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const canGoOlder = safePage < totalPages - 1;
  const canGoNewer = safePage > 0;
  const end = data.length - safePage * PAGE_SIZE;
  const start = Math.max(0, end - PAGE_SIZE);
  const pageData = data.slice(start, end);
  const maxCount = Math.max(...pageData.map((d) => d.count), 1);

  const slotW = PLOT_W / Math.max(pageData.length, 1);
  const barW = Math.max(Math.min(slotW - 10, 16), 5);
  const yTicks = [0, 0.5, 1];
  const rangeLabel =
    pageData.length > 0
      ? `${fmtDate(pageData[0].date)} - ${fmtDate(pageData[pageData.length - 1].date)}`
      : "";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-2">
        <button
          type="button"
          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
          disabled={!canGoOlder}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-olive/15 text-olive/70 transition hover:bg-olive/5 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Предыдущие даты"
        >
          <AppIcon icon={ChevronLeft} className="h-4 w-4" />
        </button>
        <p className="text-[9px] font-medium text-olive/55">{rangeLabel}</p>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
          disabled={!canGoNewer}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-olive/15 text-olive/70 transition hover:bg-olive/5 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Следующие даты"
        >
          <AppIcon icon={ChevronRight} className="h-4 w-4" />
        </button>
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        style={{ height: "auto", display: "block" }}
        role="img"
        aria-label="График просмотров по дням"
      >
        {yTicks.map((t) => {
          const y = PAD_T + PLOT_H - t * PLOT_H;
          const val = Math.round(t * maxCount);
          return (
            <g key={t}>
              <line
                x1={PAD_L}
                y1={y}
                x2={VB_W - PAD_R}
                y2={y}
                stroke={t === 0 ? "#c9bfb5" : "#e8e0d6"}
                strokeWidth={t === 0 ? 0.8 : 0.5}
                strokeDasharray={t === 0 ? "none" : "3 4"}
              />
              <text
                x={PAD_L - 4}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={7.5}
                fill="#9e8e82"
              >
                {val}
              </text>
            </g>
          );
        })}

        {pageData.map((d, i) => {
          const globalIndex = start + i;
          const barH = d.count > 0 ? Math.max((d.count / maxCount) * PLOT_H, 3) : 0;
          const x = PAD_L + i * slotW + (slotW - barW) / 2;
          const y = PAD_T + PLOT_H - barH;
          const isToday = d.date === today;
          const isActive = hovered === globalIndex || selected === globalIndex;

          return (
            <g key={d.date}>
              <rect
                x={PAD_L + i * slotW}
                y={PAD_T}
                width={slotW}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHovered(globalIndex)}
                onMouseLeave={() => setHovered(null)}
                onPointerDown={() => {
                  setSelected((prev) => (prev === globalIndex ? null : globalIndex));
                }}
                style={{ cursor: "pointer" }}
              />
              {d.count === 0 && (
                <line
                  x1={x}
                  y1={PAD_T + PLOT_H}
                  x2={x + barW}
                  y2={PAD_T + PLOT_H}
                  stroke="#e0d6cc"
                  strokeWidth={1}
                />
              )}
              {d.count > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={2.5}
                  fill={isToday ? "#a76549" : isActive ? "#0d6b62" : "#0f766e"}
                  fillOpacity={isActive ? 1 : 0.82}
                />
              )}
              {isActive && (
                <g>
                  <rect
                    x={Math.min(Math.max(x + barW / 2 - 46, PAD_L), VB_W - PAD_R - 92)}
                    y={Math.max(y - 28, PAD_T)}
                    width={92}
                    height={20}
                    rx={5}
                    fill="#2b1f19"
                    opacity={0.93}
                  />
                  <text
                    x={Math.min(Math.max(x + barW / 2, PAD_L + 46), VB_W - PAD_R - 46)}
                    y={Math.max(y - 28, PAD_T) + 13}
                    textAnchor="middle"
                    fontSize={8}
                    fill="white"
                  >
                    {fmtDate(d.date)}: {d.count}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {pageData.map((d, i) => {
          const showLabel = i === 0 || i === pageData.length - 1 || i % 2 === 0;
          if (!showLabel) return null;
          const x = PAD_L + i * slotW + slotW / 2;
          return (
            <text key={d.date} x={x} y={VB_H - 6} textAnchor="middle" fontSize={7} fill="#9e8e82">
              {fmtDate(d.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function TransferStatsModal({
  transferId,
  transferTitle,
  onClose,
}: {
  transferId: string;
  transferTitle: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshRec, setRefreshRec] = useState<RefreshRecord>({ date: todayStr(), count: 0 });
  const midnightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transfers/${transferId}/stats`);
      if (!res.ok) throw new Error("Ошибка сервера");
      setData((await res.json()) as StatsData);
      setLastUpdated(
        new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      );
    } catch {
      setError("Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  useEffect(() => {
    setRefreshRec(getRefreshRecord(transferId));
    fetchData();
  }, [transferId, fetchData]);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const ms = midnight.getTime() - now.getTime();
    midnightTimerRef.current = setTimeout(() => {
      setRefreshRec({ date: todayStr(), count: 0 });
      fetchData();
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

  function handleRefresh() {
    if (!canRefresh || loading) return;
    const next = bumpRefreshRecord(transferId);
    setRefreshRec(next);
    fetchData();
  }

  const today = todayStr();
  const todayViews = data?.dailyViews.find((d) => d.date === today)?.count ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-midnight/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-olive/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AppIcon icon={BarChart3} className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="truncate text-base font-semibold text-olive">Статистика просмотров</h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-olive/60">{transferTitle}</p>
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

        <div className="px-5 py-4">
          {error ? (
            <p className="rounded-xl bg-terra/10 px-4 py-3 text-sm text-terra">{error}</p>
          ) : loading && !data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-cream" />
                ))}
              </div>
              <div className="h-40 animate-pulse rounded-xl bg-cream" />
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Сегодня", value: todayViews, color: "text-terra" },
                  { label: "За 7 дней", value: data.weeklyTotal, color: "text-primary" },
                  { label: "За 30 дней", value: data.monthlyTotal, color: "text-olive" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-cream px-3 py-2.5 text-center">
                    <p className="text-[10px] text-olive/55">{label}</p>
                    <p className={`mt-0.5 text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <BarChart data={data.dailyViews} />

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

export function TransferStatsButton({
  transferId,
  transferTitle,
}: {
  transferId: string;
  transferTitle: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/35 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5"
      >
        <AppIcon icon={BarChart3} className="h-4 w-4" />
        Статистика
      </button>

      {open ? (
        <TransferStatsModal
          transferId={transferId}
          transferTitle={transferTitle}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
