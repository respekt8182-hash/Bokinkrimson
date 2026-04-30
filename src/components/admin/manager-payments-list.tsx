// Admin component for managing manager payment requests.
"use client";

import {
  Car,
  CircleAlert,
  CircleCheckBig,
  Clock3,
  Compass,
  CreditCard,
  House,
  Phone,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";

type ManagerPayment = {
  id: string;
  amount: number;
  tariffCode: string;
  roomCount: number;
  status: string;
  provider: string;
  createdAt: string;
  paidAt: string | null;
  canceledAt: string | null;
  managerNotes: string | null;
  confirmedById: string | null;
  property: {
    id: string;
    name: string | null;
    status: string;
    type: string | null;
  } | null;
  excursion: {
    id: string;
    title: string | null;
    status: string;
  } | null;
  transfer: {
    id: string;
    title: string | null;
    status: string | null;
    transferType: string | null;
    locationName: string | null;
    vehicleModel: string | null;
  } | null;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
};

type ManagerPaymentsListProps = {
  pendingPayments: ManagerPayment[];
  completedPayments: ManagerPayment[];
};

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU");
}

function getBaseTariffCode(tariffCode: string): string {
  return tariffCode.startsWith("transfer_standard:") ? "transfer_standard" : tariffCode;
}

function getTariffLabel(tariffCode: string): string {
  const baseCode = getBaseTariffCode(tariffCode);
  const labels: Record<string, string> = {
    MULTI_ROOM_SMALL: "Гостиничный формат · 1–6 номеров",
    MULTI_ROOM_MEDIUM: "Гостиничный формат · 7–16 номеров",
    MULTI_ROOM_LARGE: "Гостиничный формат · 17–25 номеров",
    MULTI_ROOM_XL: "Гостиничный формат · 26+ номеров",
    UNIT_SINGLE: "Отдельный объект размещения",
    excursion_standard: "Публикация карточки экскурсии",
    tour_standard: "Публикация карточки тура",
    transfer_standard: "Публикация карточки трансфера",
  };

  return labels[baseCode] ?? baseCode;
}

function PaymentCard({ payment, onAction }: { payment: ManagerPayment; onAction?: () => void }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const isPending = payment.status === "CREATED" || payment.status === "PENDING";
  const tariffCode = getBaseTariffCode(payment.tariffCode);
  const entityName = payment.property
    ? (payment.property.name ?? "Объект без названия")
    : payment.excursion
      ? (payment.excursion.title ?? "Экскурсия без названия")
      : payment.transfer
        ? (payment.transfer.title ?? "Трансфер без названия")
        : "—";
  const entityHref = payment.property
    ? `/admin/moderation/${payment.property.id}`
    : payment.excursion
      ? `/admin/moderation/excursions/${payment.excursion.id}`
      : payment.transfer
        ? `/admin/transfers/${payment.transfer.id}`
        : null;
  const entityType = payment.property
    ? "Объект размещения"
    : payment.excursion
      ? tariffCode === "tour_standard"
        ? "Тур"
        : "Экскурсия"
      : payment.transfer
        ? "Трансфер"
        : "Карточка";
  const entityLabel = payment.transfer
    ? "Карточка трансфера"
    : payment.excursion
      ? tariffCode === "tour_standard"
        ? "Карточка тура"
        : "Карточка экскурсии"
      : payment.property
        ? "Карточка объекта"
        : "Карточка";
  const EntityIcon = payment.transfer
    ? Car
    : payment.excursion
      ? Compass
      : payment.property
        ? House
        : CreditCard;
  const transferDetails = payment.transfer
    ? [
        payment.transfer.transferType,
        payment.transfer.locationName,
        payment.transfer.vehicleModel,
      ].filter(Boolean)
    : [];

  async function handleAction(action: "confirm" | "reject") {
    setLoading(action);
    setError("");

    try {
      const response = await fetch(`/api/admin/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Ошибка при обработке");
        return;
      }

      setDone(true);
      router.refresh();
      onAction?.();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
        Действие выполнено. Страница обновляется...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-olive/10 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                isPending
                  ? "bg-amber-50 text-amber-700"
                  : payment.status === "SUCCEEDED"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
              }`}
            >
              <AppIcon
                icon={isPending ? Clock3 : payment.status === "SUCCEEDED" ? CircleCheckBig : X}
                className="h-3 w-3"
              />
              {isPending
                ? "Ожидает подтверждения"
                : payment.status === "SUCCEEDED"
                  ? "Подтверждено"
                  : "Отклонено"}
            </span>
            <span className="text-xs text-olive/40">{payment.id.slice(0, 12)}...</span>
          </div>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-olive">
            {formatMoney(payment.amount)}
          </p>
        </div>
        <div className="text-right text-xs text-olive/55">
          <p>{formatDate(payment.createdAt)}</p>
          {payment.paidAt && (
            <p className="text-emerald-600">Оплачен: {formatDate(payment.paidAt)}</p>
          )}
        </div>
      </div>

      {/* Entity info */}
      <div className="mt-3 rounded-xl bg-cream p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-olive/50">{entityLabel}</p>
        <div className="mt-1 flex items-center gap-2">
          <AppIcon icon={EntityIcon} className="h-4 w-4 shrink-0 text-primary" />
          {entityHref ? (
            <Link href={entityHref} className="text-sm font-semibold text-primary hover:underline">
              {entityName}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-olive">{entityName}</span>
          )}
        </div>
        {transferDetails.length > 0 ? (
          <p className="mt-1 text-xs text-olive/55">{transferDetails.join(" • ")}</p>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-white/65 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-olive/45">
              Тип карточки
            </p>
            <p className="mt-0.5 text-sm font-semibold text-olive">{entityType}</p>
          </div>
          <div className="rounded-xl bg-white/65 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-olive/45">Тариф</p>
            <p className="mt-0.5 text-sm font-semibold text-olive">
              {getTariffLabel(payment.tariffCode)}
            </p>
            <p className="mt-0.5 text-xs text-olive/48">
              {tariffCode}
              {payment.property ? ` • ${payment.roomCount} ном.` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Owner info */}
      <div className="mt-2 rounded-xl bg-cream p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-olive/50">Владелец</p>
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-2 text-sm text-olive">
            <AppIcon icon={User} className="h-3.5 w-3.5 text-olive/40" />
            <span className="font-medium">
              {payment.owner.firstName} {payment.owner.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-olive">
            <AppIcon icon={Phone} className="h-3.5 w-3.5 text-olive/40" />
            <a href={`tel:${payment.owner.phone}`} className="text-primary hover:underline">
              {payment.owner.phone}
            </a>
          </div>
          {payment.owner.email && (
            <p className="pl-5.5 text-xs text-olive/55">{payment.owner.email}</p>
          )}
        </div>
      </div>

      {/* Manager notes (if already processed) */}
      {payment.managerNotes && (
        <div className="mt-2 rounded-xl bg-olive/5 p-3">
          <p className="text-xs font-medium text-olive/50">Комментарий менеджера</p>
          <p className="mt-0.5 text-sm text-olive">{payment.managerNotes}</p>
        </div>
      )}

      {/* Actions for pending */}
      {isPending && (
        <div className="mt-3 space-y-3 border-t border-olive/10 pt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Комментарий (необязательно)"
            className="w-full rounded-xl border border-olive/15 bg-cream/50 px-3 py-2 text-sm text-olive placeholder:text-olive/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleAction("confirm")} disabled={loading !== null}>
              {loading === "confirm" ? "Подтверждаем..." : "Подтвердить оплату"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void handleAction("reject")}
              disabled={loading !== null}
              className="border border-red-200 bg-red-50 text-red-700 ring-0 hover:bg-red-100 hover:text-red-800"
            >
              {loading === "reject" ? "Отклоняем..." : "Отклонить"}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AppIcon icon={CircleAlert} className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ManagerPaymentsList({
  pendingPayments,
  completedPayments,
}: ManagerPaymentsListProps) {
  return (
    <div className="space-y-6">
      {/* Pending section */}
      <section>
        <h2 className="text-lg font-semibold text-olive">
          Ожидают подтверждения
          {pendingPayments.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-700">
              {pendingPayments.length}
            </span>
          )}
        </h2>
        {pendingPayments.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-olive/20 bg-cream/50 p-4 text-sm text-olive/55">
            Нет заявок, ожидающих подтверждения
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {pendingPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
          </div>
        )}
      </section>

      {/* Completed section */}
      {completedPayments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-olive">История</h2>
          <div className="mt-3 space-y-3">
            {completedPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
