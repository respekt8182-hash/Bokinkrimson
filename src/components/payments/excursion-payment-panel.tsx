// Excursion payment panel — 1990 RUB fee before moderation.
// Supports YooKassa and Manager payment flows.
"use client";

import {
  ChevronLeft,
  CircleAlert,
  CircleCheckBig,
  CreditCard,
  LoaderCircle,
  Phone,
  ShieldCheck,
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
  adminMode?: boolean;
  moderationHref?: string | null;
  listHref?: string;
  listLabel?: string;
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
  adminMode = false,
  moderationHref = null,
  listHref,
  listLabel,
}: ExcursionPaymentPanelProps) {
  const [status, setStatus] = useState<ExcursionStatusValue>(initialStatus);
  const [isPaying, setIsPaying] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"YOOKASSA" | "MANAGER">("YOOKASSA");
  const [managerRequested, setManagerRequested] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const resolvedListHref =
    listHref ?? (adminMode ? "/admin/excursions" : `/dashboard/excursions/${excursionId}`);
  const resolvedListLabel = listLabel ?? (adminMode ? "К списку экскурсий" : "К экскурсии");

  const canPay =
    !adminMode &&
    isReady &&
    !isPaid &&
    !managerRequested &&
    (status === "DRAFT" || status === "NEEDS_FIX" || status === "REJECTED");

  const canSubmitModeration =
    isReady &&
    (adminMode || isPaid) &&
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

  async function payAndSubmit() {
    if (!canPay) return;

    setIsPaying(true);
    setError("");
    setMessage("");
    setManagerRequested(false);

    try {
      const response = await fetch(`/api/excursions/${excursionId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: paymentMethod }),
      });

      const body = (await response.json()) as {
        error?: string;
        item?: { id: string; status: string; provider: string };
        redirectUrl?: string;
        managerRequested?: boolean;
        mockSucceeded?: boolean;
      };

      if (!response.ok) {
        setError(body.error ?? "Не удалось создать платёж");
        return;
      }

      // Manager flow
      if (body.managerRequested) {
        setManagerRequested(true);
        return;
      }

      // YooKassa redirect
      if (body.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }

      // Mock auto-succeed
      if (body.mockSucceeded || body.item?.status === "SUCCEEDED") {
        setIsPaid(true);
        setMessage("Оплата прошла успешно. Отправляем на модерацию...");
        const sent = await submitModeration({ force: true });
        if (!sent) {
          setMessage("Оплата прошла, но отправка не завершена. Нажмите «Отправить на модерацию».");
        }
        return;
      }

      setMessage("Платёж создан. Ожидайте подтверждения.");
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
            <h2 className="text-lg font-semibold text-olive md:text-xl">
              {adminMode ? "Проверка и публикация" : "Оплата публикации"}
            </h2>
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
            <AppIcon icon={adminMode ? ShieldCheck : CreditCard} className="h-6 w-6 text-primary" />
          </div>
          <div>
            {adminMode ? (
              <>
                <p className="text-lg font-bold text-olive">Админский сценарий публикации</p>
                <p className="text-xs text-olive/55">
                  Без оплаты: карточка отправляется на модерацию и публикуется из админки.
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums text-olive">
                  {new Intl.NumberFormat("ru-RU").format(EXCURSION_FEE)} <span className="text-base font-semibold text-olive/60">₽</span>
                </p>
                <p className="text-xs text-olive/55">Единоразовая оплата за публикацию экскурсии</p>
              </>
            )}
          </div>
        </div>

        {/* Info block */}
        <div className="mt-3 space-y-1.5 rounded-xl bg-olive/4 px-3 py-2.5 text-xs text-olive/65">
          {adminMode ? (
            <>
              <p>Админ редактирует карточку за пользователя и сам отправляет ее на модерацию.</p>
              <p>После проверки карточку можно опубликовать прямо из раздела модерации.</p>
            </>
          ) : (
            <>
              <p>После оплаты экскурсия отправляется на модерацию.</p>
              <p>Если модератор вернет на доработку, повторная оплата не требуется.</p>
            </>
          )}
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

        {/* Manager requested banner */}
        {managerRequested && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <AppIcon icon={CircleCheckBig} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-olive">Заявка на оплату отправлена</p>
                <p className="mt-1 text-sm text-olive/70">
                  Ваши контактные данные переданы менеджеру. Менеджер свяжется с вами в ближайшее
                  время для подтверждения оплаты.
                </p>
                <p className="mt-1 text-sm text-olive/55">
                  После подтверждения оплаты экскурсия будет автоматически отправлена на модерацию.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment method selector */}
        {canPay && !adminMode && !alreadyOnModeration && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-olive">Выберите способ оплаты</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("YOOKASSA")}
                className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                  paymentMethod === "YOOKASSA"
                    ? "border-primary bg-primary/5"
                    : "border-olive/15 bg-white hover:border-olive/30"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  paymentMethod === "YOOKASSA" ? "bg-primary/15" : "bg-olive/8"
                }`}>
                  <AppIcon icon={CreditCard} className={`h-5 w-5 ${
                    paymentMethod === "YOOKASSA" ? "text-primary" : "text-olive/50"
                  }`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    paymentMethod === "YOOKASSA" ? "text-primary" : "text-olive"
                  }`}>Онлайн-оплата</p>
                  <p className="text-xs text-olive/55">Банковская карта через ЮKassa</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("MANAGER")}
                className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                  paymentMethod === "MANAGER"
                    ? "border-primary bg-primary/5"
                    : "border-olive/15 bg-white hover:border-olive/30"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  paymentMethod === "MANAGER" ? "bg-primary/15" : "bg-olive/8"
                }`}>
                  <AppIcon icon={Phone} className={`h-5 w-5 ${
                    paymentMethod === "MANAGER" ? "text-primary" : "text-olive/50"
                  }`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    paymentMethod === "MANAGER" ? "text-primary" : "text-olive"
                  }`}>Через менеджера</p>
                  <p className="text-xs text-olive/55">Перевод на карту / по реквизитам</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!alreadyOnModeration && !adminMode && !isPaid && !managerRequested && (
            <Button
              onClick={() => void payAndSubmit()}
              disabled={!canPay || isPaying}
              className="gap-2"
            >
              {isPaying ? (
                <>
                  <AppIcon icon={LoaderCircle} className="h-4 w-4 animate-spin" />
                  Обработка...
                </>
              ) : paymentMethod === "MANAGER" ? (
                "Отправить заявку менеджеру"
              ) : (
                <>
                  <AppIcon icon={CreditCard} className="h-4 w-4" />
                  Оплатить и отправить
                </>
              )}
            </Button>
          )}
          {!alreadyOnModeration && (adminMode || isPaid) && (
            <Button
              onClick={() => void submitModeration()}
              disabled={!canSubmitModeration || isPaying}
              className="gap-2"
            >
              Отправить на модерацию
            </Button>
          )}

          {moderationHref ? (
            <Link
              href={moderationHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-olive/15 px-3.5 py-2 text-sm font-medium text-olive/70 transition hover:bg-cream hover:text-olive"
            >
              <AppIcon icon={ShieldCheck} className="h-4 w-4" />
              К модерации
            </Link>
          ) : null}

          <Link
            href={resolvedListHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-olive/15 px-3.5 py-2 text-sm font-medium text-olive/70 transition hover:bg-cream hover:text-olive"
          >
            <AppIcon icon={ChevronLeft} className="h-4 w-4" />
            {resolvedListLabel}
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
