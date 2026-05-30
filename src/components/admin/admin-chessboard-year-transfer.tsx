"use client";

import { ArrowRight, CalendarDays, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminNotice, AdminPanel, adminInputClass } from "@/components/admin/admin-ui";

type CopyYearResult = {
  copiedCount: number;
  roomsCount: number;
  propertiesCount: number;
  replacedCount: number;
  skippedRoomsCount?: number;
  skippedPricesCount?: number;
  sourceYear: number;
  targetYear: number;
};

type ConflictPreviewItem = {
  propertyId: string;
  propertyName: string | null;
  propertyPublicId: number | null;
  roomTitle: string;
  dateFrom: string;
  dateTo: string;
};

type CopyYearErrorBody = {
  error?: string;
  conflictsCount?: number;
  conflictPreview?: ConflictPreviewItem[];
};

function parseYearInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) {
    return null;
  }

  const year = Number.parseInt(trimmed, 10);
  return year >= 2000 && year <= 2100 ? year : null;
}

function readErrorMessage(body: CopyYearErrorBody, fallback: string): string {
  return typeof body.error === "string" && body.error.trim() ? body.error : fallback;
}

function formatObjectLabel(item: ConflictPreviewItem): string {
  const name = item.propertyName?.trim() || "Объект без названия";
  return item.propertyPublicId ? `${name} #${item.propertyPublicId}` : name;
}

export function AdminChessboardYearTransfer() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [sourceYearInput, setSourceYearInput] = useState(String(currentYear));
  const [targetYearInput, setTargetYearInput] = useState(String(currentYear + 1));
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [conflictsCount, setConflictsCount] = useState(0);
  const [conflictPreview, setConflictPreview] = useState<ConflictPreviewItem[]>([]);
  const [result, setResult] = useState<CopyYearResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sourceYear = parseYearInput(sourceYearInput);
    const targetYear = parseYearInput(targetYearInput);

    if (!sourceYear || !targetYear) {
      setError("Укажите годы в формате 2026");
      setConflictsCount(0);
      setConflictPreview([]);
      setResult(null);
      return;
    }

    if (sourceYear === targetYear) {
      setError("Годы должны отличаться");
      setConflictsCount(0);
      setConflictPreview([]);
      setResult(null);
      return;
    }

    if (
      replaceExisting &&
      !window.confirm(
        `Удалить существующие цены ${targetYear} года по всем объектам и записать их заново?`,
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setConflictsCount(0);
    setConflictPreview([]);
    setResult(null);

    try {
      const response = await fetch("/api/admin/chessboard/copy-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceYear,
          targetYear,
          replaceExisting,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as CopyYearResult & CopyYearErrorBody;

      if (!response.ok) {
        setError(readErrorMessage(body, "Не удалось перенести шахматки"));
        setConflictsCount(body.conflictsCount ?? 0);
        setConflictPreview(Array.isArray(body.conflictPreview) ? body.conflictPreview : []);
        return;
      }

      setResult(body);
      setSourceYearInput(String(sourceYear));
      setTargetYearInput(String(targetYear));
    } catch {
      setError("Не удалось перенести шахматки");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AdminPanel
      title="Массовый перенос шахматок"
      description="Копирует ценовые периоды всех активных номеров из выбранного года в другой. С ноября система дополнительно запускает безопасный автоперенос на следующий год и не трогает уже заполненные цены."
      actions={
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarDays className="h-5 w-5" />
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_1.1fr_auto] lg:items-end"
      >
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-olive">С какого года</span>
          <input
            type="text"
            inputMode="numeric"
            value={sourceYearInput}
            onChange={(event) => setSourceYearInput(event.target.value)}
            placeholder="2026"
            className={adminInputClass}
          />
        </label>

        <div className="hidden pb-3 text-olive/40 lg:block">
          <ArrowRight className="h-5 w-5" />
        </div>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-olive">На какой год</span>
          <input
            type="text"
            inputMode="numeric"
            value={targetYearInput}
            onChange={(event) => setTargetYearInput(event.target.value)}
            placeholder="2027"
            className={adminInputClass}
          />
        </label>

        <label className="flex min-h-[46px] items-center gap-3 rounded-2xl border border-olive/12 bg-cream/55 px-4 py-3 text-sm text-olive">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(event) => setReplaceExisting(event.target.checked)}
            className="h-4 w-4 rounded border-olive/30 text-primary focus:ring-primary/20"
          />
          <span>
            <span className="block font-semibold">Заменить целевой год</span>
            <span className="block text-xs text-olive/55">
              Существующие цены выбранного года будут удалены.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCw className={`h-4 w-4 ${isSubmitting ? "animate-spin" : ""}`} />
          {isSubmitting ? "Перенос..." : "Перенести"}
        </button>
      </form>

      {error ? (
        <AdminNotice className="mt-4">
          <p className="font-semibold">{error}</p>
          {conflictsCount > 0 ? (
            <p className="mt-1">
              Конфликтующих периодов: {conflictsCount}. Включите замену целевого года, если нужно
              перезаписать цены.
            </p>
          ) : null}
        </AdminNotice>
      ) : null}

      {conflictPreview.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70">
          <div className="divide-y divide-amber-200/70">
            {conflictPreview.map((item, index) => (
              <div
                key={`${item.propertyId}-${item.roomTitle}-${item.dateFrom}-${index}`}
                className="grid gap-1 px-4 py-3 text-sm text-amber-950 md:grid-cols-[1.2fr_1fr_auto]"
              >
                <span className="font-semibold">{formatObjectLabel(item)}</span>
                <span>{item.roomTitle}</span>
                <span className="text-amber-900/75">
                  {item.dateFrom} - {item.dateTo}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Периоды</p>
            <p className="mt-1 text-xl font-semibold">{result.copiedCount}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Номера</p>
            <p className="mt-1 text-xl font-semibold">{result.roomsCount}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Объекты</p>
            <p className="mt-1 text-xl font-semibold">{result.propertiesCount}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Заменено</p>
            <p className="mt-1 text-xl font-semibold">{result.replacedCount}</p>
          </div>
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sky-900">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Пропущено</p>
            <p className="mt-1 text-xl font-semibold">{result.skippedRoomsCount ?? 0}</p>
          </div>
        </div>
      ) : null}
    </AdminPanel>
  );
}
