// Excursion/tour payment panel for the owner wizard.
"use client";

import {
  ChevronLeft,
  CircleAlert,
  CircleCheckBig,
  LoaderCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { PlacementPromoNotice, PlacementPromoPrice } from "@/components/pricing/placement-promo";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { SerializedPayment } from "@/lib/payments";
import type { PlacementPriceResult } from "@/lib/placement-pricing";
import { getPlacementPromoPrice } from "@/lib/placement-promo";
import { EXCURSION_PUBLICATION_FEE_RUB, TOUR_PUBLICATION_FEE_RUB } from "@/lib/site-tariffs";

type ExcursionOfferTypeValue = "EXCURSION" | "TOUR";
type ExcursionStatusValue = "DRAFT" | "PENDING_MODERATION" | "PUBLISHED" | "NEEDS_FIX" | "REJECTED";

type ExcursionPaymentPanelProps = {
  excursionId: string;
  offerType: ExcursionOfferTypeValue;
  excursionTitle: string;
  status: ExcursionStatusValue;
  pendingEditStatus?: ExcursionStatusValue | null;
  isReady: boolean;
  readinessReasons: string[];
  onBeforePay?: () => Promise<boolean>;
  onSubmitModeration?: () => Promise<boolean>;
  onStatusChange?: (nextStatus: ExcursionStatusValue) => void;
  adminMode?: boolean;
  moderationHref?: string | null;
  listHref?: string;
  listLabel?: string;
  previewHref?: string | null;
};

type ExcursionPaymentsApiResponse = {
  status: ExcursionStatusValue;
  pendingEditStatus: ExcursionStatusValue | null;
  items: SerializedPayment[];
  hasPaid: boolean;
  hasPendingManagerPayment: boolean;
  quote?: PlacementPriceResult;
  availablePrices?: PlacementPriceResult[];
};

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

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU");
}

function isOpenPayment(payment: SerializedPayment | null): boolean {
  return payment?.status === "CREATED" || payment?.status === "PENDING";
}

function getWorkflowStatus(
  status: ExcursionStatusValue,
  pendingEditStatus: ExcursionStatusValue | null,
): ExcursionStatusValue {
  if (status === "PUBLISHED" && pendingEditStatus) {
    return pendingEditStatus;
  }

  return status;
}

function getOfferCopy(offerType: ExcursionOfferTypeValue) {
  if (offerType === "TOUR") {
    return {
      singular: "тур",
      singularAccusative: "тур",
      genitive: "тура",
      publicationLabel: "публикации тура",
      moderationLabel: "Тур отправлен на модерацию.",
    };
  }

  return {
    singular: "экскурсия",
    singularAccusative: "экскурсию",
    genitive: "экскурсии",
    publicationLabel: "публикации экскурсии",
    moderationLabel: "Экскурсия отправлена на модерацию.",
  };
}

export function ExcursionPaymentPanel({
  excursionId,
  offerType,
  excursionTitle,
  status: initialStatus,
  pendingEditStatus: initialPendingEditStatus = null,
  isReady,
  readinessReasons,
  onBeforePay,
  onSubmitModeration,
  onStatusChange,
  adminMode = false,
  moderationHref = null,
  listHref,
  listLabel,
  previewHref = null,
}: ExcursionPaymentPanelProps) {
  const copy = getOfferCopy(offerType);
  const [status, setStatus] = useState<ExcursionStatusValue>(initialStatus);
  const [pendingEditStatus, setPendingEditStatus] = useState<ExcursionStatusValue | null>(
    initialPendingEditStatus,
  );
  const [payments, setPayments] = useState<SerializedPayment[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<"year" | "season">("year");
  const [availablePrices, setAvailablePrices] = useState<PlacementPriceResult[]>([]);
  const [managerRequested, setManagerRequested] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingModeration, setIsSubmittingModeration] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const resolvedListHref =
    listHref ?? (adminMode ? "/admin/excursions" : `/dashboard/excursions/${excursionId}`);
  const resolvedListLabel = listLabel ?? (adminMode ? "К списку экскурсий" : "К карточке");

  const workflowStatus = useMemo(
    () => getWorkflowStatus(status, pendingEditStatus),
    [pendingEditStatus, status],
  );
  const latestPayment = payments[0] ?? null;
  const hasPaid = payments.some((item) => item.status === "SUCCEEDED");
  const hasOpenPayment = isOpenPayment(latestPayment);
  const fallbackYearPrice =
    offerType === "TOUR" ? TOUR_PUBLICATION_FEE_RUB : EXCURSION_PUBLICATION_FEE_RUB;
  const selectedPlacementPrice =
    availablePrices.find((item) => item.period === selectedPeriod) ??
    availablePrices.find((item) => item.period === "year") ??
    null;
  const publicationBasePrice = selectedPlacementPrice?.totalPrice ?? fallbackYearPrice;
  const publicationPrice = getPlacementPromoPrice(publicationBasePrice);
  const publicationFinalAmount = selectedPlacementPrice?.freePeriodActive
    ? 0
    : publicationPrice.finalAmountRub;
  const isFreePublication = publicationFinalAmount <= 0;
  const canPay =
    !adminMode &&
    isReady &&
    !hasPaid &&
    !managerRequested &&
    !hasOpenPayment &&
    (workflowStatus === "DRAFT" || workflowStatus === "NEEDS_FIX" || workflowStatus === "REJECTED");
  const canSubmitModeration =
    isReady &&
    (adminMode || hasPaid) &&
    (workflowStatus === "DRAFT" || workflowStatus === "NEEDS_FIX" || workflowStatus === "REJECTED");
  const alreadyOnModeration =
    workflowStatus === "PENDING_MODERATION" || workflowStatus === "PUBLISHED";

  function updatePaymentInState(item: SerializedPayment) {
    setPayments((prev) => {
      const next = prev.map((payment) => (payment.id === item.id ? item : payment));
      if (!next.some((payment) => payment.id === item.id)) {
        next.unshift(item);
      }

      return next.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    });
  }

  async function refreshPayments(
    options: { silent?: boolean; keepMessage?: boolean } = {},
  ): Promise<ExcursionPaymentsApiResponse | null> {
    if (adminMode) {
      return null;
    }

    if (!options.silent) {
      setIsRefreshing(true);
    }
    setError("");
    if (!options.keepMessage) {
      setMessage("");
    }

    try {
      const response = await fetch(`/api/excursions/${excursionId}/payments`);
      const body = (await response.json()) as ExcursionPaymentsApiResponse & { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Не удалось обновить платежи");
        return null;
      }

      setPayments(body.items);
      setAvailablePrices(body.availablePrices ?? []);
      setStatus(body.status);
      setPendingEditStatus(body.pendingEditStatus);
      setManagerRequested(body.hasPendingManagerPayment);

      if (getWorkflowStatus(body.status, body.pendingEditStatus) === "PENDING_MODERATION") {
        onStatusChange?.("PENDING_MODERATION");
      }

      return body;
    } finally {
      if (!options.silent) {
        setIsRefreshing(false);
      }
    }
  }

  const refreshPaymentsEvent = useEffectEvent(refreshPayments);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setPendingEditStatus(initialPendingEditStatus);
  }, [initialPendingEditStatus]);

  useEffect(() => {
    if (adminMode) {
      return;
    }

    void refreshPaymentsEvent({ silent: true, keepMessage: true });
  }, [adminMode, excursionId]);

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

  async function submitModeration(options?: { force?: boolean }) {
    if (!options?.force && !canSubmitModeration) {
      return false;
    }

    setIsSubmittingModeration(true);
    setError("");
    if (!options?.force) {
      setMessage("");
    }

    try {
      const sent = await sendToModeration();
      if (!sent) {
        return false;
      }

      if (status === "PUBLISHED") {
        setPendingEditStatus("PENDING_MODERATION");
      } else {
        setStatus("PENDING_MODERATION");
      }
      onStatusChange?.("PENDING_MODERATION");
      setMessage(copy.moderationLabel);
      return true;
    } catch {
      setError("Ошибка при отправке. Попробуйте еще раз.");
      return false;
    } finally {
      setIsSubmittingModeration(false);
    }
  }

  async function payAndContinue() {
    if (!canPay) {
      return;
    }

    if (onBeforePay) {
      const prepared = await onBeforePay();
      if (!prepared) {
        return;
      }
    }

    setIsCreating(true);
    setError("");
    setMessage("");
    setManagerRequested(false);

    try {
      const response = await fetch(`/api/excursions/${excursionId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "MANAGER", period: selectedPeriod }),
      });

      const body = (await response.json()) as {
        error?: string;
        item?: SerializedPayment;
        redirectUrl?: string | null;
        managerRequested?: boolean;
      };

      if (!response.ok) {
        if (body.item) {
          updatePaymentInState(body.item);
        }
        setError(body.error ?? "Не удалось создать платеж");
        return;
      }

      if (body.item) {
        updatePaymentInState(body.item);
      }

      if (body.managerRequested) {
        setManagerRequested(true);
        await refreshPayments({ silent: true, keepMessage: true });
        return;
      }

      if (body.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }

      if (body.item?.status === "SUCCEEDED") {
        const sent = await submitModeration({ force: true });
        if (!sent) {
          setMessage(
            `Оплата прошла, но ${copy.singular} пока не отправлен${offerType === "TOUR" ? "" : "а"} на модерацию.`,
          );
        }
        return;
      }

      setMessage("Платеж создан. Дождитесь подтверждения или вернитесь к оплате по ссылке ниже.");
    } catch {
      setError("Ошибка при обработке оплаты. Попробуйте еще раз.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="wizard-section-enter space-y-3">
      <section className="rounded-2xl border border-olive/8 bg-white p-4 shadow-sm md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-olive md:text-xl">
              {adminMode
                ? "Проверка и публикация"
                : isFreePublication
                  ? `Публикация ${copy.genitive}`
                  : `Оплата ${copy.publicationLabel}`}
            </h2>
            <p className="mt-0.5 truncate text-sm text-olive/60">
              {excursionTitle || "Без названия"}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
              toStatusColor(workflowStatus),
            )}
          >
            {toStatusLabel(workflowStatus)}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-xl bg-cream p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <AppIcon icon={adminMode ? ShieldCheck : Phone} className="h-6 w-6 text-primary" />
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
                <PlacementPromoPrice
                  originalAmountRub={selectedPlacementPrice?.basePrice ?? fallbackYearPrice}
                  finalAmountRub={publicationFinalAmount}
                  finalClassName="text-2xl"
                />
                {selectedPlacementPrice?.discountLabel ? (
                  <p className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    {selectedPlacementPrice.discountLabel}
                  </p>
                ) : null}
                <p className="text-xs text-olive/55">
                  {isFreePublication
                    ? selectedPlacementPrice?.freePeriodUntil
                      ? `Бесплатное размещение ${copy.genitive}: ${selectedPlacementPrice.freePeriodUntil}`
                      : `Бесплатное размещение ${copy.genitive}`
                    : `Единоразовая оплата за публикацию ${copy.genitive}`}
                </p>
              </>
            )}
          </div>
        </div>

        {!adminMode && availablePrices.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {availablePrices.map((price) => {
              const isSelected = selectedPeriod === price.period;
              const promoPrice = getPlacementPromoPrice(price.totalPrice);
              const finalAmountRub =
                price.freePeriodActive || promoPrice.isDiscounted ? 0 : promoPrice.finalAmountRub;
              return (
                <button
                  key={price.period}
                  type="button"
                  onClick={() => setSelectedPeriod(price.period === "season" ? "season" : "year")}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-olive/15 bg-white hover:border-primary/25",
                  )}
                >
                  <p className="text-sm font-semibold text-olive">
                    {price.period === "season" ? "Сезон до 31 октября" : "Годовое размещение"}
                  </p>
                  <PlacementPromoPrice
                    originalAmountRub={price.basePrice}
                    finalAmountRub={finalAmountRub}
                    className="mt-1"
                    finalClassName="text-xl"
                  />
                  {price.discountLabel ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      {price.discountLabel}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs leading-5 text-olive/60">{price.discountText}</p>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-3 space-y-1.5 rounded-xl bg-olive/4 px-3 py-2.5 text-xs text-olive/65">
          {adminMode ? (
            <>
              <p>
                Администратор редактирует карточку за пользователя и сам отправляет ее на модерацию.
              </p>
              <p>После проверки карточку можно опубликовать прямо из раздела модерации.</p>
            </>
          ) : (
            <>
              <p>
                {isFreePublication
                  ? `${copy.singular[0].toUpperCase()}${copy.singular.slice(1)} отправляется на модерацию без оплаты.`
                  : `После оплаты ${copy.singular} отправляется на модерацию автоматически.`}
              </p>
              <p>Если модератор вернет карточку на доработку, повторная оплата не потребуется.</p>
            </>
          )}
        </div>
        {!adminMode ? <PlacementPromoNotice compact className="mt-3" /> : null}

        {!isReady ? (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Перед публикацией заполните обязательные поля:</p>
            {readinessReasons.map((reason) => (
              <p key={reason} className="mt-0.5">
                - {reason}
              </p>
            ))}
          </div>
        ) : null}

        {alreadyOnModeration ? (
          <div className="mt-3 rounded-xl bg-primary/8 p-3 text-sm text-primary">
            <p className="font-medium">
              {workflowStatus === "PUBLISHED"
                ? `${copy.singular[0].toUpperCase()}${copy.singular.slice(1)} уже опубликован${offerType === "TOUR" ? "" : "а"}.`
                : `${copy.singular[0].toUpperCase()}${copy.singular.slice(1)} сейчас на модерации.`}
            </p>
          </div>
        ) : null}

        {managerRequested ? (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <AppIcon icon={CircleCheckBig} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-olive">Заявка на оплату отправлена</p>
                <p className="mt-1 text-sm text-olive/70">
                  Контактные данные переданы менеджеру. После подтверждения оплаты {copy.singular}{" "}
                  будет отправлен
                  {offerType === "TOUR" ? "" : "а"} на модерацию автоматически.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {canPay && !alreadyOnModeration ? (
          <div className="mt-4 space-y-3">
            {isFreePublication ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                <p className="font-semibold">
                  {selectedPlacementPrice?.freePeriodUntil
                    ? `Сейчас размещение бесплатно: ${selectedPlacementPrice.freePeriodUntil}.`
                    : "Сейчас размещение бесплатно."}
                </p>
                <p className="mt-1">
                  После окончания бесплатного периода ваша цена на выбранный тариф:{" "}
                  <strong>
                    {formatMoney(
                      selectedPlacementPrice?.priceAfterFreePeriod ??
                        selectedPlacementPrice?.totalPrice ??
                        fallbackYearPrice,
                    )}
                  </strong>
                  {selectedPlacementPrice?.isDiscountApplied
                    ? ` вместо ${formatMoney(selectedPlacementPrice.basePrice)}.`
                    : "."}
                </p>
                <p className="mt-1">
                  {selectedPlacementPrice?.discountText ??
                    "Скидка 20% применяется только к первому годовому продлению после тестового периода."}
                </p>
              </div>
            ) : null}
            {!isFreePublication ? (
              <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <AppIcon icon={Phone} className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Оплата через менеджера</p>
                  <p className="text-xs text-olive/60">
                    Отправьте заявку, менеджер свяжется с вами и подтвердит оплату вручную.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!adminMode && !alreadyOnModeration && !managerRequested ? (
            <Button
              onClick={() => void (canSubmitModeration ? submitModeration() : payAndContinue())}
              disabled={
                canSubmitModeration ? isSubmittingModeration : isCreating || isRefreshing || !canPay
              }
              className="gap-2"
            >
              {isCreating || isSubmittingModeration ? (
                <>
                  <AppIcon icon={LoaderCircle} className="h-4 w-4 animate-spin" />
                  {canSubmitModeration ? "Отправка..." : "Обработка..."}
                </>
              ) : canSubmitModeration ? (
                "Отправить на модерацию"
              ) : isFreePublication ? (
                "Отправить на модерацию"
              ) : (
                "Отправить заявку менеджеру"
              )}
            </Button>
          ) : null}

          {adminMode && !alreadyOnModeration ? (
            <Button
              onClick={() => void submitModeration()}
              disabled={!canSubmitModeration || isSubmittingModeration}
              className="gap-2"
            >
              {isSubmittingModeration ? "Отправка..." : "Отправить на модерацию"}
            </Button>
          ) : null}

          {!adminMode && !alreadyOnModeration && hasPaid && !canSubmitModeration ? (
            <Button
              onClick={() => void submitModeration({ force: true })}
              disabled={isSubmittingModeration}
              className="gap-2"
            >
              {isSubmittingModeration ? "Отправка..." : "Отправить на модерацию"}
            </Button>
          ) : null}

          {!adminMode && previewHref ? (
            <Link
              href={previewHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 px-3.5 py-2 text-sm font-medium text-primary transition hover:border-primary/40 hover:bg-primary/6"
            >
              Предпросмотр
            </Link>
          ) : null}

          {!adminMode ? (
            <Button variant="ghost" onClick={() => void refreshPayments()} disabled={isRefreshing}>
              {isRefreshing ? "Обновление..." : "Обновить"}
            </Button>
          ) : null}

          {moderationHref ? (
            <Link
              href={moderationHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-olive/15 px-3.5 py-2 text-sm font-medium text-olive/70 transition hover:bg-cream hover:text-olive"
            >
              <AppIcon icon={ShieldCheck} className="h-4 w-4" />К модерации
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

      {!adminMode && latestPayment ? (
        <section className="rounded-2xl border border-olive/10 bg-white p-4">
          <h3 className="text-base font-semibold text-olive">Последний платеж</h3>
          <div className="mt-3 grid gap-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-olive/55">Статус</span>
              <span className="font-semibold text-olive">{latestPayment.statusLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-olive/55">Сумма</span>
              <span className="font-semibold text-olive">{formatMoney(latestPayment.amount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-olive/55">Дата</span>
              <span className="text-olive">{formatDateTime(latestPayment.createdAt)}</span>
            </div>
          </div>

          {isOpenPayment(latestPayment) ? (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">Ожидает подтверждения менеджером</p>
              <p className="mt-0.5 text-xs text-amber-700/70">
                После подтверждения карточка будет отправлена на модерацию автоматически.
              </p>
            </div>
          ) : null}

          {latestPayment.status === "CANCELED" ? (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              Платеж отменен или не прошел. Можно создать новый.
            </p>
          ) : null}
        </section>
      ) : null}

      {!adminMode && payments.length > 0 ? (
        <section className="rounded-2xl border border-olive/10 bg-white p-4">
          <h3 className="text-base font-semibold text-olive">История платежей</h3>
          <div className="mt-3 space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-olive/10 bg-cream/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-olive">
                    {formatMoney(payment.amount)}
                  </span>
                  <span className="rounded-full bg-olive/8 px-2 py-0.5 text-[11px] font-semibold text-olive/70">
                    {payment.statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-olive/55">{payment.tariffCode}</p>
                <p className="text-xs text-olive/45">{formatDateTime(payment.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="wizard-label-enter flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="wizard-label-enter flex items-start gap-2 rounded-xl bg-primary/8 p-3 text-sm text-primary">
          <AppIcon icon={CircleCheckBig} className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </div>
      ) : null}
    </div>
  );
}
