"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ListingPaymentEntityType = "property" | "excursion" | "transfer";

type TariffOption = {
  value: "season" | "offseason" | "yearly" | "year";
  label: string;
};

type AdminListingPaymentConfirmationProps = {
  entityType: ListingPaymentEntityType;
  entityId: string;
  entityLabel: string;
  tariffOptions: TariffOption[];
};

export function AdminListingPaymentConfirmation({
  entityType,
  entityId,
  entityLabel,
  tariffOptions,
}: AdminListingPaymentConfirmationProps) {
  const router = useRouter();
  const defaultTariff = tariffOptions[0]?.value ?? "year";
  const [tariff, setTariff] = useState(defaultTariff);
  const [notes, setNotes] = useState("");
  const [processingAction, setProcessingAction] = useState<"confirm" | "request" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTariffLabel = useMemo(
    () => tariffOptions.find((option) => option.value === tariff)?.label ?? tariff,
    [tariff, tariffOptions],
  );

  async function submitPayment(action: "confirm" | "request") {
    setProcessingAction(action);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/listing-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          tariff,
          notes,
          action,
        }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Не удалось подтвердить оплату");
        return;
      }

      setMessage(
        action === "confirm"
          ? `Оплата подтверждена: ${selectedTariffLabel}`
          : `Заявка на оплату отправлена в раздел «Оплата»: ${selectedTariffLabel}`,
      );
      setNotes("");
      router.refresh();
    } catch {
      setError(
        action === "confirm" ? "Не удалось подтвердить оплату" : "Не удалось отправить оплату",
      );
    } finally {
      setProcessingAction(null);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-olive">Подтвердить оплату</h3>
          <p className="mt-1 text-xs leading-5 text-olive/58">
            Можно сразу создать оплаченный период или отправить заявку в раздел «Оплата».
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          {entityLabel}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-olive/70">Тариф</span>
          <select
            value={tariff}
            onChange={(event) => setTariff(event.target.value as typeof tariff)}
            className="w-full rounded-xl border border-olive/12 bg-white px-3 py-2 text-sm text-olive outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/10"
          >
            {tariffOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-olive/70">Комментарий</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-[72px] w-full resize-y rounded-xl border border-olive/12 bg-white px-3 py-2 text-sm text-olive outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/10"
          />
        </label>
      </div>

      {error ? <p className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="mt-2 text-xs font-semibold text-emerald-700">{message}</p> : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void submitPayment("confirm")}
          disabled={processingAction !== null}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processingAction === "confirm" ? "Подтверждаем..." : "Подтвердить оплату"}
        </button>
        <button
          type="button"
          onClick={() => void submitPayment("request")}
          disabled={processingAction !== null}
          className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processingAction === "request" ? "Отправляем..." : "Отправить в оплату"}
        </button>
      </div>
    </section>
  );
}
