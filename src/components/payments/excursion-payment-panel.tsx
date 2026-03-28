// Excursion payment panel — fixed 2000 RUB fee before moderation.
// Currently uses a mock "test payment" flow. Replace with real provider later.
"use client";

import {
  ChevronLeft,
  CircleAlert,
  CircleCheckBig,
  CreditCard,
  LoaderCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type ExcursionStatusValue =
  | "DRAFT"
  | "PENDING_MODERATION"
  | "PUBLISHED"
  | "NEEDS_FIX"
  | "REJECTED";

type ExcursionPaymentPanelProps = {
  excursionId: string;
  excursionTitle: string;
  status: ExcursionStatusValue;
  /** Whether all required fields are filled in. */
  isReady: boolean;
  /** Human-readable reasons why the excursion is not ready (if any). */
  readinessReasons: string[];
  /** Submits current form data for moderation and returns whether it succeeded. */
  onSubmitModeration?: () => Promise<boolean>;
  onStatusChange?: (nextStatus: ExcursionStatusValue) => void;
};

const EXCURSION_FEE = 1990;

function toStatusLabel(status: ExcursionStatusValue): string {
  switch (status) {
    case "DRAFT":
      return "Черновик";
    case "PENDING_MODERATION":
      return "На модерации";
    case "PUBLISHED":
      return "Опубликована";
    case "NEEDS_FIX":
      return "Требуются правки";
    case "REJECTED":
      return "Отклонена";
    default:
      return status;
  }
}

function toStatusColor(status: ExcursionStatusValue): string {
  switch (status) {
    case "PUBLISHED":
      return "bg-primary/10 text-primary";
    case "PENDING_MODERATION":
      return "bg-amber-50 text-amber-700";
    case "NEEDS_FIX":
    case "REJECTED":
      return "bg-red-50 text-red-600";
    default:
      return "bg-olive/8 text-olive/70";
  }
}

export function ExcursionPaymentPanel({
  excursionId,
  excursionTitle,
  status: initialStatus,
  isReady,
  readinessReasons,
  onSubmitModeration,
  onStatusChange,
}: ExcursionPaymentPanelProps) {
  const [status, setStatus] = useState<ExcursionStatusValue>(initialStatus);
  const [isPaying, setIsPaying] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canPay =
    isReady &&
    !isPaid &&
    (status === "DRAFT" || status === "NEEDS_FIX" || status === "REJECTED");

  const canSubmitModeration =
    isReady &&
    isPaid &&
    (status === "DRAFT" || status === "NEEDS_FIX" || status === "REJECTED");

  async function sendToModeration(): Promise<boolean> {
    if (onSubmitModeration) {
      const ok = await onSubmitModeration();
      if (!ok) {
        setError("Не удалось отправить на модерацию. Проверьте обязательные поля и сохранение.");
      }
      return ok;
    }

    const response = await fetch(`/api/excursions/${excursionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PENDING_MODERATION" }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Не удалось отправить на модерацию");
      return false;
    }

    return true;
  }

  async function submitModeration(options?: { force?: boolean }): Promise<boolean> {
    if (!options?.force && !canSubmitModeration) {
      return false;
    }

    setError("");
    if (!options?.force) {
      setMessage("");
    }

    try {
      const sent = await sendToModeration();
      if (!sent) {
        return false;
      }

      setStatus("PENDING_MODERATION");
      onStatusChange?.("PENDING_MODERATION");
      setMessage("Экскурсия отправлена на модерацию.");
      return true;
    } catch {
      setError("Ошибка при отправке. Попробуйте еще раз.");
      return false;
    }
  }

  async function mockPayAndSubmit() {
    if (!canPay) return;

    setIsPaying(true);
    setError("");
    setMessage("");

    try {
      // Simulate payment delay
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setIsPaid(true);
      setMessage("Тестовая оплата прошла успешно. Отправляем на модерацию...");

      const sent = await submitModeration({ force: true });
      if (!sent) {
        setMessage(
          "Оплата прошла, но отправка не завершена. Нажмите «Отправить на модерацию».",
        );
      }
    } catch {
      setError("Ошибка при обработке оплаты. Попробуйте еще раз.");
    } finally {
      setIsPaying(false);
    }
  }

  const alreadyOnModeration = status === "PENDING_MODERATION" || status === "PUBLISHED";
  const visibleError = error;

  return (
    <div className="wizard-section-enter space-y-3">
      <section className="rounded-2xl border border-olive/8 bg-white p-4 shadow-sm md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-olive md:text-xl">Оплата публикации</h2>
            <p className="mt-0.5 truncate text-sm text-olive/60">{excursionTitle || "Без названия"}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
              toStatusColor(status),
            )}
          >
            {toStatusLabel(status)}
          </span>
        </div>

        {/* Price card */}
        <div className="mt-4 flex items-center gap-4 rounded-xl bg-cream p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <AppIcon icon={CreditCard} className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-olive">
              {new Intl.NumberFormat("ru-RU").format(EXCURSION_FEE)} <span className="text-base font-semibold text-olive/60">₽</span>
            </p>
            <p className="text-xs text-olive/55">Единоразовая оплата за публикацию экскурсии</p>
          </div>
        </div>

        {/* Info block */}
        <div className="mt-3 space-y-1.5 rounded-xl bg-olive/4 px-3 py-2.5 text-xs text-olive/65">
          <p>После оплаты экскурсия отправляется на модерацию.</p>
          <p>Если модератор вернет на доработку, повторная оплата не требуется.</p>
        </div>

        {/* Readiness */}
        {!isReady && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Заполните обязательные поля:</p>
            {readinessReasons.map((reason) => (
              <p key={reason} className="mt-0.5">- {reason}</p>
            ))}
          </div>
        )}

        {/* Already on moderation */}
        {alreadyOnModeration && (
          <div className="mt-3 rounded-xl bg-primary/8 p-3 text-sm text-primary">
            <p className="font-medium">
              {status === "PUBLISHED"
                ? "Экскурсия опубликована."
                : "Экскурсия находится на модерации."}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!alreadyOnModeration && !isPaid && (
            <Button
              onClick={() => void mockPayAndSubmit()}
              disabled={!canPay || isPaying}
              className="gap-2"
            >
              {isPaying ? (
                <>
                  <AppIcon icon={LoaderCircle} className="h-4 w-4 animate-spin" />
                  Обработка...
                </>
              ) : (
                <>
                  <AppIcon icon={CreditCard} className="h-4 w-4" />
                  Оплатить и отправить (тест)
                </>
              )}
            </Button>
          )}
          {!alreadyOnModeration && isPaid && (
            <Button
              onClick={() => void submitModeration()}
              disabled={!canSubmitModeration || isPaying}
              className="gap-2"
            >
              Отправить на модерацию
            </Button>
          )}

          <Link
            href={`/dashboard/excursions/${excursionId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-olive/15 px-3.5 py-2 text-sm font-medium text-olive/70 transition hover:bg-cream hover:text-olive"
          >
            <AppIcon icon={ChevronLeft} className="h-4 w-4" />
            К экскурсии
          </Link>
        </div>
      </section>

      {/* Status messages */}
      {visibleError && (
        <div className="wizard-label-enter flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4 shrink-0" />
          {visibleError}
        </div>
      )}
      {message && (
        <div className="wizard-label-enter flex items-start gap-2 rounded-xl bg-primary/8 p-3 text-sm text-primary">
          <AppIcon icon={CircleCheckBig} className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </div>
      )}
    </div>
  );
}
