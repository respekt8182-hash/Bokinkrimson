"use client";

import { useState } from "react";
import { BarChart3, Eye, LockKeyhole, Plus, ShieldCheck, X } from "lucide-react";
import {
  AdminNotice,
  AdminPanel,
  AdminStatCard,
  adminInputClass,
} from "@/components/admin/admin-ui";
import type { AdminStatisticsSummary } from "@/lib/admin-statistics";
import { cn } from "@/lib/cn";

type AdminStatisticsBoostPanelProps = {
  initialSummary: AdminStatisticsSummary;
};

type BoostResponse = {
  addedPerCard?: number;
  updatedCards?: number;
  summary?: AdminStatisticsSummary;
  error?: string;
};

const QUICK_AMOUNTS = [5, 10, 15, 30] as const;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function AdminStatisticsBoostPanel({ initialSummary }: AdminStatisticsBoostPanelProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [amount, setAmount] = useState(Math.min(5, Math.max(1, initialSummary.remainingToday)));
  const [password, setPassword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = summary.remainingToday;
  const safeAmount = remaining <= 0 ? 0 : Math.min(Math.max(1, amount), remaining);
  const isLimitReached = remaining <= 0;
  const totalBoostedViews = safeAmount * summary.totals.totalCards;

  function chooseAmount(nextAmount: number) {
    setAmount(Math.min(nextAmount, Math.max(1, remaining)));
    setMessage(null);
    setError(null);
  }

  function openConfirmation() {
    setMessage(null);
    setError(null);

    if (isLimitReached) {
      setError("Лимит на сегодня уже исчерпан. Завтра снова будет доступно 30 просмотров.");
      return;
    }

    if (summary.totals.totalCards <= 0) {
      setError("Нет опубликованных карточек, которым можно начислить просмотры.");
      return;
    }

    setPassword("");
    setConfirmOpen(true);
  }

  async function submitBoost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/statistics/view-boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: safeAmount, password }),
      });
      const payload = (await response.json()) as BoostResponse;

      if (!response.ok) {
        if (payload.summary) {
          setSummary(payload.summary);
        }

        throw new Error(payload.error ?? "Не удалось начислить просмотры.");
      }

      if (payload.summary) {
        setSummary(payload.summary);
        setAmount(Math.min(5, Math.max(1, payload.summary.remainingToday)));
      }

      setConfirmOpen(false);
      setPassword("");
      setMessage(
        `Начислено +${safeAmount} просмотров на ${formatNumber(
          payload.updatedCards ?? summary.totals.totalCards,
        )} карточек.`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Не удалось начислить просмотры.",
      );
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
          label="Сегодня добавлено"
          value={`${summary.usedToday}/${summary.dailyLimit}`}
          description={`Лимит за ${summary.todayLabel}`}
          icon={ShieldCheck}
          tone={isLimitReached ? "warning" : "success"}
        />
        <AdminStatCard
          label="Остаток"
          value={remaining}
          description="Доступно до конца суток"
          icon={LockKeyhole}
          tone={isLimitReached ? "warning" : "default"}
        />
      </section>

      <AdminPanel
        title="Разово добавить просмотры всем карточкам"
        description="Начисление попадёт в профильные счётчики и дневные графики владельцев. Для безопасности максимум 30 просмотров в сутки и обязательное повторное подтверждение паролем администратора."
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[26px] border border-olive/10 bg-cream/55 p-4 sm:p-5">
            <p className="text-sm font-semibold text-olive">Сколько добавить каждой карточке</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((quickAmount) => {
                const disabled = isLimitReached || quickAmount > remaining;
                const active = safeAmount === quickAmount && !disabled;

                return (
                  <button
                    key={quickAmount}
                    type="button"
                    disabled={disabled}
                    onClick={() => chooseAmount(quickAmount)}
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
                max={Math.max(1, remaining)}
                value={safeAmount}
                disabled={isLimitReached}
                onChange={(event) => chooseAmount(Number.parseInt(event.target.value, 10) || 1)}
                className={cn(adminInputClass, "mt-2 max-w-[180px]")}
              />
            </label>

            <div className="mt-5 rounded-2xl bg-white/78 p-4 text-sm leading-6 text-olive/68">
              Сейчас будет добавлено <span className="font-semibold text-olive">+{safeAmount}</span>{" "}
              к каждой опубликованной карточке. Общая прибавка составит{" "}
              <span className="font-semibold text-olive">{formatNumber(totalBoostedViews)}</span>{" "}
              просмотров.
            </div>
          </div>

          <div className="rounded-[26px] border border-white/70 bg-white/82 p-4 shadow-[0_14px_40px_rgba(58,43,35,0.06)] sm:p-5">
            <p className="text-sm font-semibold text-olive">Что входит в начисление</p>
            <div className="mt-4 space-y-3 text-sm text-olive/68">
              <div className="flex items-center justify-between gap-4">
                <span>Жильё и размещение</span>
                <span className="font-semibold text-olive">
                  {formatNumber(summary.totals.publishedProperties)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Экскурсии</span>
                <span className="font-semibold text-olive">
                  {formatNumber(summary.totals.publishedExcursions)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Туры</span>
                <span className="font-semibold text-olive">
                  {formatNumber(summary.totals.publishedTours)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Трансферы</span>
                <span className="font-semibold text-olive">
                  {formatNumber(summary.totals.publishedTransfers)}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isLimitReached || summary.totals.totalCards <= 0}
              onClick={openConfirmation}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Plus className="h-4 w-4" />
              Начислить просмотры
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

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Закрыть подтверждение"
            className="absolute inset-0 bg-midnight/45 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />
          <form
            onSubmit={submitBoost}
            className="relative w-full max-w-md rounded-[30px] border border-white/70 bg-white p-5 shadow-[0_28px_90px_rgba(43,31,25,0.26)]"
          >
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
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
                После подтверждения каждая опубликованная карточка получит +{safeAmount} просмотров.
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
                onClick={() => setConfirmOpen(false)}
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
