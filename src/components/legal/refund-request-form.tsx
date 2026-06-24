"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";

type RefundResult = {
  requestNumber: string;
  preliminaryAmount: string;
  notice: string;
};

export function RefundRequestForm() {
  const [error, setError] = useState("");
  const [result, setResult] = useState<RefundResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      orderNumber: String(form.get("orderNumber") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      serviceType: String(form.get("serviceType") ?? ""),
      paidAmount: Number(form.get("paidAmount") ?? 0),
      paidAt: String(form.get("paidAt") ?? ""),
      reason: String(form.get("reason") ?? ""),
      comment: String(form.get("comment") ?? ""),
      usedDays: Number(form.get("usedDays") ?? 0),
      totalServiceDays: Number(form.get("totalServiceDays") ?? 1),
      documentedActualExpenses: Number(form.get("documentedActualExpenses") ?? 0),
      personalDataConsent: form.get("personalDataConsent") === "on",
    };

    try {
      const response = await fetch("/api/refund-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as Partial<RefundResult> & { error?: string };

      if (!response.ok || !body.requestNumber || !body.notice) {
        setError(body.error ?? "Не удалось отправить обращение");
        return;
      }

      setResult({
        requestNumber: body.requestNumber,
        preliminaryAmount: String(body.preliminaryAmount ?? "0"),
        notice: body.notice,
      });
      event.currentTarget.reset();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-olive/10">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Номер заказа</span>
          <input name="orderNumber" required className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Вид услуги</span>
          <input name="serviceType" required className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">ФИО</span>
          <input name="fullName" required className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Email</span>
          <input name="email" type="email" required className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Телефон</span>
          <input name="phone" className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Дата оплаты</span>
          <input name="paidAt" type="date" className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Сумма оплаты</span>
          <input name="paidAmount" type="number" min="0" step="0.01" required className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Причина</span>
          <input name="reason" required className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Использовано дней</span>
          <input name="usedDays" type="number" min="0" defaultValue="0" className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-olive">Всего дней услуги</span>
          <input name="totalServiceDays" type="number" min="1" defaultValue="1" className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-semibold text-olive">Документально подтвержденные расходы</span>
          <input name="documentedActualExpenses" type="number" min="0" step="0.01" defaultValue="0" className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-semibold text-olive">Комментарий</span>
          <textarea name="comment" rows={4} className="rounded-xl border border-olive/15 px-3 py-2" />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm leading-6 text-olive/75">
        <input type="checkbox" name="personalDataConsent" required className="mt-1" />
        <span>
          Даю согласие на обработку персональных данных на условиях{" "}
          <Link href="/legal/personal-data-consent" target="_blank" className="font-semibold text-terra hover:underline">
            Согласия на обработку персональных данных
          </Link>
          .
        </span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
          Обращение {result.requestNumber} создано. Предварительная сумма: {result.preliminaryAmount} руб. {result.notice}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-olive/25"
      >
        {isSubmitting ? "Отправляем..." : "Отправить обращение"}
      </button>
    </form>
  );
}
