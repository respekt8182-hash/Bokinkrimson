// UI component for property payment panel in the payments module.
"use client";

import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import {
  type PlacementCoverageState,
  type TariffQuote,
  type SerializedPayment,
} from "@/lib/payments";

type PaymentStatusValue = "CREATED" | "PENDING" | "SUCCEEDED" | "CANCELED";
type PropertyStatusValue = "DRAFT" | "PENDING_MODERATION" | "PUBLISHED" | "REJECTED";

type PaymentReadinessIssue = {
  id: string;
  reason: string;
  href: string;
};

type PaymentReadiness = {
  ready: boolean;
  reasons: string[];
  issues?: PaymentReadinessIssue[];
  progressStep: number;
  roomCount: number;
  quote: TariffQuote | null;
};

type PropertyPaymentPanelProps = {
  propertyId: string;
  propertyName: string;
  initialPropertyStatus: PropertyStatusValue;
  initialPendingEditStatus: PropertyStatusValue | null;
  initialModerationNotes: string | null;
  initialReadiness: PaymentReadiness;
  initialPlacement: PlacementCoverageState;
  initialPayments: SerializedPayment[];
};

type PaymentsApiResponse = {
  readiness: PaymentReadiness;
  status: PropertyStatusValue;
  pendingEditStatus: PropertyStatusValue | null;
  moderationNotes: string | null;
  placement: PlacementCoverageState;
  items: SerializedPayment[];
};

type PaymentRouteResponse = {
  error?: string;
  item?: SerializedPayment;
  redirectUrl?: string | null;
  paidUntil?: string | null;
};

type PaymentMockResponse = {
  error?: string;
  item?: SerializedPayment;
};

type ModerationSubmitResponse = {
  error?: string;
  requiredPaymentAmount?: number;
  item?: {
    status: PropertyStatusValue;
    pendingEditStatus: PropertyStatusValue | null;
    moderationNotes: string | null;
  };
  paidUntil?: string | null;
};

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value)} ₽`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU");
}

function isOpenPayment(status: PaymentStatusValue): boolean {
  return status === "CREATED" || status === "PENDING";
}

function getWorkflowStatus(
  status: PropertyStatusValue,
  pendingEditStatus: PropertyStatusValue | null,
): PropertyStatusValue {
  if (status === "PUBLISHED" && pendingEditStatus) {
    return pendingEditStatus;
  }

  return status;
}

function getPricingGroupLabel(group: TariffQuote["pricingGroup"]): string {
  if (group === "MULTI_ROOM") {
    return "Гостиничный формат";
  }

  return "Отдельный объект";
}

export function PropertyPaymentPanel({
  propertyId,
  propertyName,
  initialPropertyStatus,
  initialPendingEditStatus,
  initialModerationNotes,
  initialReadiness,
  initialPlacement,
  initialPayments,
}: PropertyPaymentPanelProps) {
  const [propertyStatus, setPropertyStatus] = useState<PropertyStatusValue>(initialPropertyStatus);
  const [pendingEditStatus, setPendingEditStatus] = useState<PropertyStatusValue | null>(
    initialPendingEditStatus,
  );
  const [moderationNotes, setModerationNotes] = useState(initialModerationNotes);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [placement, setPlacement] = useState<PlacementCoverageState>(initialPlacement);
  const [payments, setPayments] = useState(initialPayments);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmittingModeration, setIsSubmittingModeration] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTempPaying, setIsTempPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const latestPayment = payments[0] ?? null;
  const hasOpenPayment = latestPayment ? isOpenPayment(latestPayment.status) : false;
  const latestSucceededPayment = useMemo(
    () => payments.find((item) => item.status === "SUCCEEDED") ?? null,
    [payments],
  );
  const paidUntilIso = placement.paidUntil ?? latestSucceededPayment?.placementValidUntil ?? null;
  const hasActivePlacement = placement.hasActivePlacement;
  const hasOutstandingTopUp =
    readiness.ready &&
    hasActivePlacement &&
    !placement.fullyCovered &&
    placement.requiredPaymentAmount > 0;
  const workflowStatus = useMemo(
    () => getWorkflowStatus(propertyStatus, pendingEditStatus),
    [pendingEditStatus, propertyStatus],
  );
  const canSubmitModerationWithPaidPlacement =
    readiness.ready &&
    hasActivePlacement &&
    placement.fullyCovered &&
    (workflowStatus === "DRAFT" || workflowStatus === "REJECTED");
  const canCreatePayment =
    readiness.ready &&
    !hasOpenPayment &&
    workflowStatus !== "PENDING_MODERATION" &&
    workflowStatus !== "PUBLISHED" &&
    (!hasActivePlacement || !placement.fullyCovered);
  const amountDue = readiness.quote
    ? hasActivePlacement
      ? placement.requiredPaymentAmount
      : readiness.quote.amount
    : 0;

  const readinessHint = useMemo(() => {
    if (readiness.ready) {
      if (hasOutstandingTopUp) {
        return `Размещение уже активно, но для ${readiness.roomCount} номеров нужна доплата ${formatMoney(placement.requiredPaymentAmount)}.`;
      }

      if (hasActivePlacement) {
        return "Оплата уже активна. Карточку можно отправить на модерацию без повторной оплаты.";
      }
      return "Карточка готова к оплате и последующей отправке на модерацию.";
    }

    return "Перед оплатой заполните обязательные разделы.";
  }, [
    hasActivePlacement,
    hasOutstandingTopUp,
    placement.requiredPaymentAmount,
    readiness.ready,
    readiness.roomCount,
  ]);

  function getSuccessfulPaymentMessage(nextState: PaymentsApiResponse | null): string {
    if (!nextState) {
      return "Оплата подтверждена. Обновите статус карточки чуть позже.";
    }

    const nextWorkflowStatus = getWorkflowStatus(nextState.status, nextState.pendingEditStatus);
    if (nextWorkflowStatus === "PENDING_MODERATION") {
      return "Оплата подтверждена. Карточка автоматически отправлена на модерацию.";
    }

    if (nextWorkflowStatus === "PUBLISHED") {
      return "Оплата подтверждена. Размещение активно.";
    }

    return "Оплата подтверждена. Размещение активно. Если карточка ещё не ушла на модерацию, можно отправить её кнопкой ниже.";
  }

  async function refreshPayments(): Promise<PaymentsApiResponse | null> {
    setIsUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/properties/${propertyId}/payments`);

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось обновить платежи");
        return null;
      }

      const body = (await response.json()) as PaymentsApiResponse;
      setReadiness(body.readiness);
      setPlacement(body.placement);
      setPayments(body.items);
      setPropertyStatus(body.status);
      setPendingEditStatus(body.pendingEditStatus);
      setModerationNotes(body.moderationNotes);
      return body;
    } finally {
      setIsUpdating(false);
    }
  }

  async function createPayment() {
    setIsCreating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/properties/${propertyId}/payments`, {
        method: "POST",
      });

      const body = (await response.json()) as PaymentRouteResponse;

      if (!response.ok) {
        if (body.item) {
          const paymentItem = body.item;
          setPayments((prev) => {
            if (prev.some((item) => item.id === paymentItem.id)) {
              return prev;
            }
            return [paymentItem, ...prev];
          });
        }
        setError(body.error ?? "Не удалось создать платеж");
        if (body.paidUntil) {
          setMessage(`Размещение уже оплачено до ${formatDate(body.paidUntil)}.`);
        }
        return;
      }

      if (body.item) {
        const paymentItem = body.item;
        setPayments((prev) => [paymentItem, ...prev.filter((item) => item.id !== paymentItem.id)]);
      }

      if (body.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }

      setMessage("Платеж создан. Для mock-режима подтвердите результат кнопками ниже.");
      await refreshPayments();
    } finally {
      setIsCreating(false);
    }
  }

  async function submitForModeration() {
    setIsSubmittingModeration(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/properties/${propertyId}/moderation-submit`, {
        method: "POST",
      });

      const body = (await response.json()) as ModerationSubmitResponse;
      if (!response.ok || !body.item) {
        if (body.requiredPaymentAmount && body.requiredPaymentAmount > 0) {
          setError(
            `${body.error ?? "Не удалось отправить объект на модерацию"}. К доплате: ${formatMoney(body.requiredPaymentAmount)}.`,
          );
          return;
        }
        setError(
          body.error ?? "Не удалось отправить объект на модерацию",
        );
        return;
      }

      setPropertyStatus(body.item.status);
      setPendingEditStatus(body.item.pendingEditStatus);
      setModerationNotes(body.item.moderationNotes);
      setMessage(
        body.item.status === "PUBLISHED" && body.item.pendingEditStatus
          ? "Изменения отправлены на модерацию."
          : "Объект отправлен на модерацию.",
      );
      await refreshPayments();
    } finally {
      setIsSubmittingModeration(false);
    }
  }

  async function refreshLatestPaymentStatus() {
    if (!latestPayment) {
      return;
    }

    setIsUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/payments/${latestPayment.id}`);

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось обновить статус платежа");
        return;
      }

      const body = (await response.json()) as { item: SerializedPayment };
      setPayments((prev) => {
        const next = prev.map((item) => (item.id === body.item.id ? body.item : item));
        if (!next.some((item) => item.id === body.item.id)) {
          return [body.item, ...next];
        }
        return next;
      });

      if (body.item.status === "SUCCEEDED") {
        const nextState = await refreshPayments();
        setMessage(getSuccessfulPaymentMessage(nextState));
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function applyMockResult(action: "succeed" | "cancel") {
    if (!latestPayment) {
      return;
    }

    setIsUpdating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/payments/${latestPayment.id}/mock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const body = (await response.json()) as PaymentMockResponse;

      if (!response.ok || !body.item) {
        setError(
          body.error ?? "Не удалось изменить статус mock-платежа",
        );
        return;
      }

      const paymentItem = body.item;
      setPayments((prev) => prev.map((item) => (item.id === paymentItem.id ? paymentItem : item)));

      if (body.item.status === "SUCCEEDED") {
        const nextState = await refreshPayments();
        setMessage(getSuccessfulPaymentMessage(nextState));
      } else if (body.item.status === "CANCELED") {
        setMessage("Платеж отменен. Можно создать новый.");
      }
    } finally {
      setIsUpdating(false);
    }
  }

  const canUseTempPayButton =
    readiness.ready && (workflowStatus === "DRAFT" || workflowStatus === "REJECTED");

  async function runTempPayment() {
    if (!canUseTempPayButton) {
      return;
    }

    setIsTempPaying(true);
    setError("");
    setMessage("");

    try {
      if (canSubmitModerationWithPaidPlacement) {
        await submitForModeration();
        return;
      }

      let targetPayment: SerializedPayment | null =
        latestPayment && latestPayment.provider === "MOCK" && isOpenPayment(latestPayment.status)
          ? latestPayment
          : null;

      if (!targetPayment) {
        const createResponse = await fetch(`/api/properties/${propertyId}/payments`, {
          method: "POST",
        });
        const createBody = (await createResponse.json()) as PaymentRouteResponse;

        if (!createResponse.ok) {
          if (
            createBody.item &&
            createBody.item.provider === "MOCK" &&
            isOpenPayment(createBody.item.status)
          ) {
            targetPayment = createBody.item;
          } else {
            setError(
              createBody.error ?? "Не удалось создать временный mock-платеж",
            );
            return;
          }
        } else if (createBody.item) {
          targetPayment = createBody.item;
        }
      }

      if (!targetPayment) {
        setError("Не найден платеж для временного подтверждения.");
        return;
      }

      const mockResponse = await fetch(`/api/payments/${targetPayment.id}/mock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "succeed" }),
      });
      const mockBody = (await mockResponse.json()) as PaymentMockResponse;

      if (!mockResponse.ok || !mockBody.item) {
        setError(
          mockBody.error ?? "Не удалось зачесть временную оплату",
        );
        return;
      }

      const paymentItem = mockBody.item;
      setPayments((prev) => [paymentItem, ...prev.filter((item) => item.id !== paymentItem.id)]);
      const nextState = await refreshPayments();
      setMessage(getSuccessfulPaymentMessage(nextState));
    } finally {
      setIsTempPaying(false);
    }
  }

  const primaryActionLabel = canSubmitModerationWithPaidPlacement
    ? workflowStatus === "REJECTED"
      ? "Повторно отправить на модерацию"
      : "Отправить на модерацию"
    : "Перейти к оплате";
  const primaryActionDisabled = canSubmitModerationWithPaidPlacement
    ? isSubmittingModeration
    : isCreating || !canCreatePayment;
  const primaryActionPendingLabel = canSubmitModerationWithPaidPlacement
    ? "Отправка..."
    : "Создание...";
  const readinessIssues = useMemo<PaymentReadinessIssue[]>(() => {
    if (readiness.issues && readiness.issues.length > 0) {
      return readiness.issues;
    }

    return readiness.reasons.map((reason, index) => ({
      id: `legacy-${index}-${reason}`,
      reason,
      href: `/dashboard/objects/${propertyId}/about`,
    }));
  }, [propertyId, readiness.issues, readiness.reasons]);

  const statusMeta: Record<
    PropertyStatusValue,
    { label: string; dot: string; bg: string; text: string }
  > = {
    DRAFT: {
      label: "Черновик",
      dot: "bg-olive/40",
      bg: "bg-olive/8",
      text: "text-olive/70",
    },
    PENDING_MODERATION: {
      label: "На модерации",
      dot: "bg-amber-400",
      bg: "bg-amber-50",
      text: "text-amber-700",
    },
    PUBLISHED: {
      label: "Опубликована",
      dot: "bg-emerald-500",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    },
    REJECTED: {
      label: "Отклонена",
      dot: "bg-red-400",
      bg: "bg-red-50",
      text: "text-red-700",
    },
  };
  const sm = statusMeta[workflowStatus] ?? statusMeta.DRAFT;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-olive/10 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-olive/8 bg-cream/60 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-olive">Оплата размещения</h1>
              <p className="mt-0.5 text-sm text-olive/60">
                <span className="font-medium text-olive">{propertyName}</span>
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${sm.bg} ${sm.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
              {sm.label}
            </span>
          </div>

          {/* Readiness hint */}
          <p className={`mt-3 text-sm ${readiness.ready ? "text-emerald-700" : "text-olive/70"}`}>
            {readiness.ready ? (
              <span className="flex items-center gap-1.5">
                <AppIcon icon={CircleCheckBig} className="h-4 w-4 text-emerald-500" />
                {readinessHint}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <AppIcon icon={TriangleAlert} className="h-4 w-4 text-amber-500" />
                {readinessHint}
              </span>
            )}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Moderation notes */}
          {moderationNotes ? (
            <div className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm">
              <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <div>
                <p className="font-semibold text-orange-800">Комментарий модератора</p>
                <p className="mt-0.5 whitespace-pre-line text-orange-700">{moderationNotes}</p>
              </div>
            </div>
          ) : null}

          {/* Info notice */}
          <div className="flex gap-3 rounded-xl border border-olive/10 bg-cream/70 p-3 text-sm text-olive/75">
            <AppIcon icon={CircleAlert} className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>
                После успешной оплаты система автоматически отправит карточку на модерацию, если она
                заполнена полностью и тариф покрыт.
              </p>
              <p>
                Если доплата не нужна и размещение уже активно, изменения можно отправить на
                модерацию кнопкой ниже.
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid gap-2 sm:grid-cols-4">
            {/* Active rooms */}
            <div className="rounded-xl bg-cream p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-olive/50">
                Активных номеров
              </p>
              <p
                className={`mt-1.5 text-2xl font-bold leading-none ${readiness.roomCount > 0 ? "text-olive" : "text-olive/60"}`}
              >
                {readiness.roomCount}
              </p>
              <p className="mt-2 text-[11px] text-olive/60">
                {readiness.roomCount > 0 ? "номеров активно" : "нет активных"}
              </p>
            </div>

            {/* Tariff */}
            <div className="rounded-xl bg-cream p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-olive/50">
                Тариф
              </p>
              <p
                className={`mt-1.5 text-base font-semibold leading-tight ${readiness.quote ? "text-olive" : "text-olive/35"}`}
              >
                {readiness.quote ? readiness.quote.tariff.title : "Не рассчитан"}
              </p>
              {readiness.quote ? (
                <p className="mt-1 text-lg font-bold text-olive">
                  {formatMoney(readiness.quote.amount)}
                </p>
              ) : null}
            </div>

            {/* Pricing group */}
            <div className="rounded-xl bg-cream p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-olive/50">
                Категория
              </p>
              <p
                className={`mt-1.5 text-base font-semibold leading-tight ${readiness.quote ? "text-olive" : "text-olive/35"}`}
              >
                {readiness.quote
                  ? getPricingGroupLabel(readiness.quote.pricingGroup)
                  : "Не определена"}
              </p>
            </div>
          </div>

          {/* Payment summary */}
          {readiness.quote && readiness.ready && amountDue > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-3 text-sm font-semibold text-olive">Счёт к оплате</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-olive/65">Категория</span>
                  <span className="text-right font-medium text-olive">
                    {readiness.quote.pricingGroup === "MULTI_ROOM"
                      ? "Гостиничный формат"
                      : "Отдельный объект"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-olive/65">Тариф</span>
                  <span className="text-right font-medium text-olive">
                    {readiness.quote.tariff.title}
                  </span>
                </div>
                {readiness.quote.pricingGroup === "MULTI_ROOM" && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-olive/65">Номеров</span>
                    <span className="font-medium text-olive">{readiness.quote.roomCount}</span>
                  </div>
                )}
                {hasOutstandingTopUp ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-olive/65">Уже оплачено</span>
                      <span className="font-medium text-olive">
                        {formatMoney(placement.coveredAmount)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-olive/65">Новый тариф</span>
                      <span className="font-medium text-olive">
                        {formatMoney(readiness.quote.amount)}
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="mt-1 flex items-center justify-between border-t border-primary/15 pt-3">
                  <span className="font-semibold text-olive">Итого</span>
                  <span className="text-2xl font-bold tabular-nums text-olive">
                    {new Intl.NumberFormat("ru-RU").format(amountDue)} ₽
                  </span>
                </div>
              </div>
            </div>
          )}

          {hasOutstandingTopUp ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Для текущего количества номеров прежний платёж покрывает размещение не полностью.
              Система выставит только разницу между уже оплаченным тарифом и новым.
            </div>
          ) : null}

          {/* Paid-until info */}
          {readiness.quote && paidUntilIso ? (
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${hasActivePlacement ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
            >
              <AppIcon
                icon={hasActivePlacement ? CalendarDays : CircleX}
                className="h-4 w-4 shrink-0"
              />
              {hasActivePlacement ? (
                <span>
                  Размещение оплачено до{" "}
                  <strong>{formatDate(paidUntilIso)}</strong>
                </span>
              ) : (
                <span>
                  Срок прошлой оплаты истёк:{" "}
                  <strong>{formatDate(paidUntilIso)}</strong>
                </span>
              )}
            </div>
          ) : null}

          {/* Readiness errors */}
          {!readiness.ready ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-red-800">
                <AppIcon icon={CircleAlert} className="h-4 w-4" />
                Необходимо устранить:
              </p>
              <ul className="space-y-1 pl-1">
                {readinessIssues.map((issue) => (
                  <li key={issue.id} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    <div className="space-y-1">
                      <p>{issue.reason}</p>
                      <Link
                        href={issue.href}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                      >
                        Перейти и исправить
                        <AppIcon icon={ChevronRight} className="h-3 w-3" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href={`/dashboard/objects/${propertyId}/about`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
              >
                Вернуться к вкладкам объекта
                <AppIcon icon={ChevronRight} className="h-3 w-3" />
              </Link>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              onClick={() =>
                void (canSubmitModerationWithPaidPlacement
                  ? submitForModeration()
                  : createPayment())
              }
              disabled={primaryActionDisabled || isTempPaying}
            >
              {isCreating || isSubmittingModeration
                ? primaryActionPendingLabel
                : primaryActionLabel}
            </Button>
            {/* TODO(temp): remove this button after payment QA is finished. */}
            <Button
              variant="secondary"
              onClick={() => void runTempPayment()}
              disabled={
                isTempPaying ||
                isCreating ||
                isSubmittingModeration ||
                isUpdating ||
                !canUseTempPayButton
              }
            >
              {isTempPaying
                ? "Проводим..."
                : "Временно: зачесть оплату"}
            </Button>
            <div className="mx-1 h-5 w-px bg-olive/15 hidden sm:block" />
            <Button variant="ghost" onClick={() => void refreshPayments()} disabled={isUpdating}>
              {isUpdating ? "Обновление..." : "Обновить"}
            </Button>
            <Link
              href={`/dashboard/objects/${propertyId}/about`}
              className="inline-flex items-center rounded-xl border border-olive/20 px-4 py-2 text-sm font-semibold text-olive/70 transition hover:border-olive/30 hover:bg-cream hover:text-olive"
            >
              К объекту
            </Link>
          </div>
        </div>
      </section>

      {latestPayment ? (
        <section className="rounded-2xl border border-olive/10 bg-white p-4">
          <h2 className="text-lg text-olive">Последний платеж</h2>
          <p className="mt-1 text-sm text-olive/75">
            Статус:{" "}
            <span className="font-semibold text-olive">{latestPayment.statusLabel}</span>
          </p>
          <p className="text-sm text-olive/75">
            Сумма:{" "}
            <span className="font-semibold text-olive">{formatMoney(latestPayment.amount)}</span>
          </p>
          <p className="text-sm text-olive/75">
            Создан: {formatDateTime(latestPayment.createdAt)}
          </p>

          {isOpenPayment(latestPayment.status) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {latestPayment.provider === "YOOKASSA" && latestPayment.confirmationUrl ? (
                <a
                  href={latestPayment.confirmationUrl}
                  className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Открыть YooKassa
                </a>
              ) : null}

              {latestPayment.provider === "YOOKASSA" ? (
                <Button
                  variant="ghost"
                  onClick={() => void refreshLatestPaymentStatus()}
                  disabled={isUpdating}
                >
                  Проверить статус
                </Button>
              ) : null}

              {latestPayment.provider === "MOCK" ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => void applyMockResult("succeed")}
                    disabled={isUpdating}
                  >
                    Смоделировать успех
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void applyMockResult("cancel")}
                    disabled={isUpdating}
                  >
                    Смоделировать отмену
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {latestPayment.status === "SUCCEEDED" ? (
            <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-700">
              <p>Оплата подтверждена.</p>
              {workflowStatus === "PENDING_MODERATION" ? (
                <p className="mt-1">Карточка уже находится на модерации.</p>
              ) : workflowStatus === "REJECTED" ? (
                <p className="mt-1">
                  После исправлений отправьте карточку повторно на модерацию без дополнительной
                  оплаты.
                </p>
              ) : (
                <p className="mt-1">
                  Размещение активно. Если карточка ещё не ушла на модерацию автоматически, её можно
                  отправить кнопкой выше.
                </p>
              )}
            </div>
          ) : null}

          {latestPayment.status === "CANCELED" ? (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              Платеж отменен или не прошел. Можно повторить оплату.
            </p>
          ) : null}
        </section>
      ) : null}

      {payments.length > 0 ? (
        <section className="rounded-2xl border border-olive/10 bg-white p-4">
          <h2 className="text-lg text-olive">История платежей</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-olive/65">
                  <th className="py-1 pr-4">ID</th>
                  <th className="py-1 pr-4">Тариф</th>
                  <th className="py-1 pr-4">Сумма</th>
                  <th className="py-1 pr-4">Статус</th>
                  <th className="py-1">Дата</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-olive/10">
                    <td className="py-1 pr-4 font-mono text-xs text-olive">
                      {payment.id.slice(0, 12)}...
                    </td>
                    <td className="py-1 pr-4 text-olive">{payment.tariffCode}</td>
                    <td className="py-1 pr-4 text-olive">{formatMoney(payment.amount)}</td>
                    <td className="py-1 pr-4 text-olive">{payment.statusLabel}</td>
                    <td className="py-1 text-olive">{formatDateTime(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
    </div>
  );
}
