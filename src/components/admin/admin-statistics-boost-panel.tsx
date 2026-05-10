"use client";

import { useState } from "react";
import { BarChart3, Eye, Plus, ShieldCheck } from "lucide-react";
import {
  AdminNotice,
  AdminPanel,
  AdminStatCard,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { HIDDEN_STATS_PIN } from "@/lib/admin-hidden-statistics";
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
  const [selectedMetricPeriodKey, setSelectedMetricPeriodKey] = useState(
    initialSummary.metricPeriods.defaultKey,
  );
  const [viewAmount, setViewAmount] = useState(
    Math.min(5, Math.max(1, initialSummary.remainingToday)),
  );
  const [actionAmount, setActionAmount] = useState(
    Math.min(1, Math.max(1, initialSummary.actionRemainingToday)),
  );
  const [actionType, setActionType] = useState<ListingActionType>("phone_primary");
  const [submittingMetric, setSubmittingMetric] = useState<BoostMetricType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publishedCardsCount = summary.totals.totalCards;
  const viewRemaining = summary.remainingToday;
  const actionRemaining = summary.actionRemainingToday;
  const safeViewAmount = viewRemaining <= 0 ? 0 : Math.min(Math.max(1, viewAmount), viewRemaining);
  const safeActionAmount =
    actionRemaining <= 0 ? 0 : Math.min(Math.max(1, actionAmount), actionRemaining);
  const isViewLimitReached = viewRemaining <= 0;
  const isActionLimitReached = actionRemaining <= 0;
  const hasPublishedCards = publishedCardsCount > 0;
  const totalBoostedViews = safeViewAmount * publishedCardsCount;
  const totalBoostedActions = safeActionAmount * publishedCardsCount;
  const isSubmittingViews = submittingMetric === "views";
  const isSubmittingActions = submittingMetric === "actions";
  const metricPeriodOptions = [
    summary.metricPeriods.last6Months,
    ...summary.metricPeriods.months,
  ];
  const selectedMetricPeriod =
    metricPeriodOptions.find((period) => period.key === selectedMetricPeriodKey) ??
    summary.metricPeriods.months.at(-1) ??
    summary.metricPeriods.last6Months;

  function chooseViewAmount(nextAmount: number) {
    setViewAmount(Math.min(Math.max(1, nextAmount), Math.max(1, viewRemaining)));
    setMessage(null);
    setError(null);
  }

  function chooseActionAmount(nextAmount: number) {
    setActionAmount(Math.min(Math.max(1, nextAmount), Math.max(1, actionRemaining)));
    setMessage(null);
    setError(null);
  }

  async function submitBoost(metricType: BoostMetricType) {
    setMessage(null);
    setError(null);

    if (!hasPublishedCards) {
      setError("Нет опубликованных карточек для начисления статистики");
      return;
    }

    if (metricType === "views" && isViewLimitReached) {
      setError("Лимит просмотров на сегодня исчерпан");
      return;
    }

    if (metricType === "actions" && isActionLimitReached) {
      setError("Лимит целевых действий на сегодня исчерпан");
      return;
    }

    const amount = metricType === "actions" ? safeActionAmount : safeViewAmount;
    setSubmittingMetric(metricType);

    try {
      const response = await fetch("/api/admin/statistics/view-boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricType,
          amount,
          actionType: metricType === "actions" ? actionType : undefined,
          pin: HIDDEN_STATS_PIN,
        }),
      });
      const payload = (await response.json()) as BoostResponse;

      if (!response.ok) {
        if (payload.summary) {
          setSummary(payload.summary);
        }

        throw new Error(payload.error ?? "Не удалось сохранить изменения. Попробуйте ещё раз.");
      }

      if (payload.summary) {
        setSummary(payload.summary);
        setViewAmount(Math.min(5, Math.max(1, payload.summary.remainingToday)));
        setActionAmount(Math.min(1, Math.max(1, payload.summary.actionRemainingToday)));
      }

      setMessage(
        metricType === "actions"
          ? "Целевые действия успешно начислены"
          : "Просмотры успешно начислены",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить изменения. Попробуйте ещё раз.",
      );
    } finally {
      setSubmittingMetric(null);
    }
  }

  return (
    <>
      <AdminPanel
        title="Период статистики"
        description="Выберите конкретный месяц или общую динамику за последние 6 месяцев."
        contentClassName="mt-3"
      >
        <div className="flex flex-wrap gap-2">
          {metricPeriodOptions.map((period) => {
            const active = selectedMetricPeriod.key === period.key;

            return (
              <button
                key={period.key}
                type="button"
                onClick={() => setSelectedMetricPeriodKey(period.key)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                  active
                    ? "border-primary bg-primary text-white shadow-[0_12px_28px_rgba(15,118,110,0.16)]"
                    : "border-olive/10 bg-white text-olive hover:border-primary/22 hover:text-primary",
                )}
              >
                <span className="block">{period.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    active ? "text-white/72" : "text-olive/48",
                  )}
                >
                  {formatNumber(period.views)} просмотров · {formatNumber(period.actions)} действий
                </span>
              </button>
            );
          })}
        </div>
      </AdminPanel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Карточек"
          value={formatNumber(publishedCardsCount)}
          description="Жильё, экскурсии, туры, трансферы и места"
          icon={BarChart3}
        />
        <AdminStatCard
          label="Просмотров всего"
          value={formatNumber(selectedMetricPeriod.views)}
          description={`Период: ${selectedMetricPeriod.label}`}
          icon={Eye}
          tone="info"
        />
        <AdminStatCard
          label="Целевых действий всего"
          value={formatNumber(selectedMetricPeriod.actions)}
          description={`Период: ${selectedMetricPeriod.label}`}
          icon={BarChart3}
          tone="success"
        />
        <AdminStatCard
          label="Лимиты сегодня"
          value={`${summary.usedToday}/${summary.dailyLimit} просмотров · ${summary.actionUsedToday}/${summary.actionDailyLimit} действий`}
          description={`Осталось ${viewRemaining} просмотров · ${actionRemaining} действий`}
          icon={ShieldCheck}
          tone={isViewLimitReached && isActionLimitReached ? "warning" : "default"}
        />
      </section>

      <AdminPanel
        title="Начисление метрик всем опубликованным карточкам"
        description="Лимит считается по выбранному количеству на одну карточку: просмотры - 30 в сутки, целевые действия - 20 в сутки."
      >
        {!hasPublishedCards ? (
          <AdminNotice className="mb-4">
            Нет опубликованных карточек для начисления статистики
          </AdminNotice>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[26px] border border-olive/10 bg-cream/55 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-olive">Просмотры</p>
                <p className="mt-1 text-xs text-olive/52">
                  Просмотры: осталось {viewRemaining}/{summary.dailyLimit}
                </p>
              </div>
              <Eye className="h-5 w-5 text-primary/70" />
            </div>

            {isViewLimitReached ? (
              <AdminNotice className="mt-4">Лимит просмотров на сегодня исчерпан</AdminNotice>
            ) : null}

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
                onChange={(event) => chooseViewAmount(Number.parseInt(event.target.value, 10) || 1)}
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
              disabled={
                isSubmittingViews ||
                submittingMetric !== null ||
                isViewLimitReached ||
                !hasPublishedCards
              }
              onClick={() => submitBoost("views")}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Plus className="h-4 w-4" />
              {isSubmittingViews ? "Начисляю..." : "Начислить просмотры"}
            </button>
          </div>

          <div className="rounded-[26px] border border-olive/10 bg-white/82 p-4 shadow-[0_14px_40px_rgba(58,43,35,0.06)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-olive">Целевые действия</p>
                <p className="mt-1 text-xs text-olive/52">
                  Целевые действия: осталось {actionRemaining}/{summary.actionDailyLimit}
                </p>
              </div>
              <BarChart3 className="h-5 w-5 text-primary/70" />
            </div>

            {isActionLimitReached ? (
              <AdminNotice className="mt-4">Лимит целевых действий на сегодня исчерпан</AdminNotice>
            ) : null}

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
              <span className="font-semibold text-olive">{formatNumber(totalBoostedActions)}</span>{" "}
              целевых действий.
            </div>

            <button
              type="button"
              disabled={
                isSubmittingActions ||
                submittingMetric !== null ||
                isActionLimitReached ||
                !hasPublishedCards
              }
              onClick={() => submitBoost("actions")}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Plus className="h-4 w-4" />
              {isSubmittingActions ? "Начисляю..." : "Начислить действия"}
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

    </>
  );
}
