"use client";

import { useState } from "react";
import { BarChart3, Eye, Plus, ShieldCheck, X } from "lucide-react";
import {
  AdminNotice,
  AdminPanel,
  AdminStatCard,
  adminInputClass,
} from "@/components/admin/admin-ui";
import {
  LISTING_ACTION_BOOST_OPTIONS,
  LISTING_ACTION_LABELS,
  type ListingActionType,
} from "@/lib/listing-analytics";
import type { AdminStatisticsSummary } from "@/lib/admin-statistics";
import { cn } from "@/lib/cn";

type AdminStatisticsBoostPanelProps = {
  initialSummary: AdminStatisticsSummary;
};

type BoostMetricType = "views" | "actions";

type BoostResponse = {
  metricType?: BoostMetricType;
  actionType?: ListingActionType;
  addedPerCard?: number;
  updatedCards?: number;
  summary?: AdminStatisticsSummary;
  error?: string;
};

const VIEW_QUICK_AMOUNTS = [5, 10, 15, 30] as const;
const ACTION_QUICK_AMOUNTS = [1, 5, 10, 20] as const;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function AdminStatisticsBoostPanel({ initialSummary }: AdminStatisticsBoostPanelProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [viewAmount, setViewAmount] = useState(
    Math.min(5, Math.max(1, initialSummary.remainingToday)),
  );
  const [actionAmount, setActionAmount] = useState(
    Math.min(1, Math.max(1, initialSummary.actionRemainingToday)),
  );
  const [actionType, setActionType] = useState<ListingActionType>("phone_primary");
  const [pendingMetric, setPendingMetric] = useState<BoostMetricType | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const viewRemaining = summary.remainingToday;
  const actionRemaining = summary.actionRemainingToday;
  const safeViewAmount =
    viewRemaining <= 0 ? 0 : Math.min(Math.max(1, viewAmount), viewRemaining);
  const safeActionAmount =
    actionRemaining <= 0 ? 0 : Math.min(Math.max(1, actionAmount), actionRemaining);
  const isViewLimitReached = viewRemaining <= 0;
  const isActionLimitReached = actionRemaining <= 0;
  const totalBoostedViews = safeViewAmount * summary.totals.totalCards;
  const totalBoostedActions = safeActionAmount * summary.totals.totalCards;

  function chooseViewAmount(nextAmount: number) {
    setViewAmount(Math.min(nextAmount, Math.max(1, viewRemaining)));
    setMessage(null);
    setError(null);
  }

  function chooseActionAmount(nextAmount: number) {
    setActionAmount(Math.min(nextAmount, Math.max(1, actionRemaining)));
    setMessage(null);
    setError(null);
  }

  function openConfirmation(metricType: BoostMetricType) {
    setMessage(null);
    setError(null);

    if (summary.totals.totalCards <= 0) {
      setError("Нет опубликованных карточек, которым можно начислить метрику.");
      return;
    }

    if (metricType === "views" && isViewLimitReached) {
      setError(
        `Лимит на сегодня уже исчерпан. Завтра снова будет доступно ${summary.dailyLimit} просмотров.`,
      );
      return;
    }

    if (metricType === "actions" && isActionLimitReached) {
      setError(
        `Лимит на сегодня уже исчерпан. Завтра снова будет доступно ${summary.actionDailyLimit} целевых действий.`,
      );
      return;
    }

    setPassword("");
    setPendingMetric(metricType);
  }

  async function submitBoost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingMetric) {
      return;
    }

    const amount = pendingMetric === "actions" ? safeActionAmount : safeViewAmount;
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/statistics/view-boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricType: pendingMetric,
          amount,
          actionType: pendingMetric === "actions" ? actionType : undefined,
          password,
        }),
      });
      const payload = (await response.json()) as BoostResponse;

      if (!response.ok) {
        if (payload.summary) {
          setSummary(payload.summary);
        }

        throw new Error(payload.error ?? "Не удалось начислить метрику.");
      }

      if (payload.summary) {
        setSummary(payload.summary);
        setViewAmount(Math.min(5, Math.max(1, payload.summary.remainingToday)));
        setActionAmount(Math.min(1, Math.max(1, payload.summary.actionRemainingToday)));
      }

      setPendingMetric(null);
      setPassword("");
      setMessage(
        pendingMetric === "actions"
          ? `Начислено +${amount} ${LISTING_ACTION_LABELS[actionType].toLocaleLowerCase(
              "ru-RU",
            )} на ${formatNumber(payload.updatedCards ?? summary.totals.totalCards)} карточек.`
          : `Начислено +${amount} просмотров на ${formatNumber(
              payload.updatedCards ?? summary.totals.totalCards,
            )} карточек.`,
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось начислить метрику.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Карточек"
          value={formatNumber(summary.totals.totalCards)}
          description="Жильё, экскурсии, туры и трансферы"
          icon={BarChart3}
        />
        <AdminStatCard
          label="Просмотров всего"
          value={formatNumber(summary.totals.totalViews)}
          description="Сумма текущих счётчиков"
          icon={Eye}
          tone="info"
        />
        <AdminStatCard
          label="Целевых действий"
          value={formatNumber(summary.totals.totalActions)}
          description="Клики по телефонам, сайту и мессенджерам"
          icon={BarChart3}
          tone="success"
        />
        <AdminStatCard
          label="Лимиты сегодня"
          value={`${summary.usedToday}/${summary.dailyLimit} · ${summary.actionUsedToday}/${summary.actionDailyLimit}`}
          description={`Просмотры и действия за ${summary.todayLabel}`}
          icon={ShieldCheck}
          tone={isViewLimitReached && isActionLimitReached ? "warning" : "default"}
        />
      </section>

      <AdminPanel
        title="Разово добавить метрики всем карточкам"
        description="Начисление попадёт в профильные счётчики, дневные графики и журнал текущего полугодия. Просмотры ограничены 30 в сутки, целевые действия - 20 в сутки."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[26px] border border-olive/10 bg-cream/55 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-olive">Просмотры</p>
                <p className="mt-1 text-xs text-olive/52">
                  Осталось {viewRemaining}/{summary.dailyLimit}
                </p>
              </div>
              <Eye className="h-5 w-5 text-primary/70" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {VIEW_QUICK_AMOUNTS.map((quickAmount) => {
                const disabled = isViewLimitReached || quickAmount > viewRemaining;
                const active = safeViewAmount === quickAmount && !disabled;

                return (
                  <button
                    key={quickAmount}
                    type="button"
                    disabled={disabled}
                    onClick={() => chooseViewAmount(quickAmount)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                      active
                        ? "border-primary bg-primary text-white shadow-[0_12px_28px_rgba(15,118,110,0.18)]"
                        : "border-white/70 bg-white text-olive hover:border-primary/20 hover:text-primary",
                      disabled
                        ? "cursor-not-allowed opacity-45 hover:border-white/70 hover:text-olive"
                        : "",
                    )}
                  >
                    +{quickAmount}
                  </button>
                );
              })}
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-olive/45">
                Своя сумма
              </span>
              <input
                type="number"
                min={1}
                max={Math.max(1, viewRemaining)}
                value={safeViewAmount}
                disabled={isViewLimitReached}
                onChange={(event) =>
                  chooseViewAmount(Number.parseInt(event.target.value, 10) || 1)
                }
                className={cn(adminInputClass, "mt-2 max-w-[180px]")}
              />
            </label>

            <div className="mt-5 rounded-2xl bg-white/78 p-4 text-sm leading-6 text-olive/68">
              Общая прибавка составит{" "}
              <span className="font-semibold text-olive">{formatNumber(totalBoostedViews)}</span>{" "}
              просмотров.
            </div>

            <button
              type="button"
              disabled={isViewLimitReached || summary.totals.totalCards <= 0}
              onClick={() => openConfirmation("views")}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Plus className="h-4 w-4" />
              Начислить просмотры
            </button>
          </div>

          <div className="rounded-[26px] border border-olive/10 bg-white/82 p-4 shadow-[0_14px_40px_rgba(58,43,35,0.06)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-olive">Целевые действия</p>
                <p className="mt-1 text-xs text-olive/52">
                  Осталось {actionRemaining}/{summary.actionDailyLimit}
                </p>
              </div>
              <BarChart3 className="h-5 w-5 text-primary/70" />
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-olive/45">
                Показатель
              </span>
              <select
                value={actionType}
                onChange={(event) => setActionType(event.target.value as ListingActionType)}
                className={cn(adminInputClass, "mt-2")}
              >
                {LISTING_ACTION_BOOST_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {LISTING_ACTION_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              {ACTION_QUICK_AMOUNTS.map((quickAmount) => {
                const disabled = isActionLimitReached || quickAmount > actionRemaining;
                const active = safeActionAmount === quickAmount && !disabled;

                return (
                  <button
                    key={quickAmount}
                    type="button"
                    disabled={disabled}
                    onClick={() => chooseActionAmount(quickAmount)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                      active
                        ? "border-primary bg-primary text-white shadow-[0_12px_28px_rgba(15,118,110,0.18)]"
                        : "border-olive/10 bg-cream/70 text-olive hover:border-primary/20 hover:text-primary",
                      disabled
                        ? "cursor-not-allowed opacity-45 hover:border-olive/10 hover:text-olive"
                        : "",
                    )}
                  >
                    +{quickAmount}
                  </button>
                );
              })}
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-olive/45">
                Своя сумма
              </span>
              <input
                type="number"
                min={1}
                max={Math.max(1, actionRemaining)}
                value={safeActionAmount}
                disabled={isActionLimitReached}
                onChange={(event) =>
                  chooseActionAmount(Number.parseInt(event.target.value, 10) || 1)
                }
                className={cn(adminInputClass, "mt-2 max-w-[180px]")}
              />
            </label>

            <div className="mt-5 rounded-2xl bg-cream/78 p-4 text-sm leading-6 text-olive/68">
              Общая прибавка составит{" "}
              <span className="font-semibold text-olive">
                {formatNumber(totalBoostedActions)}
              </span>{" "}
              целевых действий.
            </div>

            <button
              type="button"
              disabled={isActionLimitReached || summary.totals.totalCards <= 0}
              onClick={() => openConfirmation("actions")}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Plus className="h-4 w-4" />
              Начислить действия
            </button>
          </div>
        </div>

        {message ? (
          <AdminNotice tone="info" className="mt-4">
            {message}
          </AdminNotice>
        ) : null}

        {error ? <AdminNotice className="mt-4">{error}</AdminNotice> : null}
      </AdminPanel>

      {pendingMetric ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Закрыть подтверждение"
            className="absolute inset-0 bg-midnight/45 backdrop-blur-sm"
            onClick={() => setPendingMetric(null)}
          />
          <form
            onSubmit={submitBoost}
            className="relative w-full max-w-md rounded-[30px] border border-white/70 bg-white p-5 shadow-[0_28px_90px_rgba(43,31,25,0.26)]"
          >
            <button
              type="button"
              onClick={() => setPendingMetric(null)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-cream text-olive"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-10">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
                Подтверждение
              </p>
              <h2 className="mt-3 text-xl font-semibold text-olive">
                Введите пароль администратора
              </h2>
              <p className="mt-2 text-sm leading-6 text-olive/62">
                {pendingMetric === "actions"
                  ? `Каждая опубликованная карточка получит +${safeActionAmount} к показателю "${LISTING_ACTION_LABELS[actionType]}".`
                  : `Каждая опубликованная карточка получит +${safeViewAmount} просмотров.`}
              </p>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-olive">Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={cn(adminInputClass, "mt-2")}
                autoFocus
                required
              />
            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingMetric(null)}
                className="rounded-2xl border border-olive/10 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/20 hover:text-primary"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isSubmitting ? "Начисляю..." : "Подтвердить"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
