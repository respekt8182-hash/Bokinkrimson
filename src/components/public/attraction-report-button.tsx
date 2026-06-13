"use client";

import { CheckCircle2, Send, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  ATTRACTION_REPORT_REASON_OPTIONS,
  type AttractionReportReasonCode,
} from "@/lib/attraction-reports";
import { cn } from "@/lib/cn";

type AttractionReportButtonProps = {
  attractionId: string;
  attractionTitle: string;
};

type SubmitState = "idle" | "submitting" | "sent" | "error";

export function AttractionReportButton({
  attractionId,
  attractionTitle,
}: AttractionReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AttractionReportReasonCode>(
    ATTRACTION_REPORT_REASON_OPTIONS[0].value,
  );
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  function resetDialog(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setSubmitState("idle");
      setMessage(null);
      setAuthRequired(false);
    }
  }

  async function handleSubmit() {
    setSubmitState("submitting");
    setMessage(null);
    setAuthRequired(false);

    try {
      const response = await fetch(`/api/public/attractions/${encodeURIComponent(attractionId)}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
        code?: string;
      } | null;

      if (!response.ok) {
        setSubmitState("error");
        setAuthRequired(response.status === 401 || payload?.code === "AUTH_REQUIRED");
        setMessage(payload?.error ?? "Не удалось отправить сообщение. Попробуйте позже.");
        return;
      }

      setSubmitState("sent");
      setMessage(payload?.message ?? "Спасибо, мы передали сообщение администратору.");
    } catch {
      setSubmitState("error");
      setMessage("Не удалось отправить сообщение. Проверьте подключение и попробуйте ещё раз.");
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 border-t border-olive/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-olive">Заметили неточность?</p>
          <p className="mt-1 text-xs leading-5 text-olive/55">
            Выберите тип ошибки, и администратор проверит карточку.
          </p>
        </div>
        <button
          type="button"
          onClick={() => resetDialog(true)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 sm:w-auto"
        >
          <TriangleAlert className="h-4 w-4" />
          Сообщить об ошибке
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/50 px-3 pb-3 pt-10 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(43,31,25,0.26)]">
            <div className="flex items-start justify-between gap-4 border-b border-olive/10 p-5">
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-tight text-olive">Что не так?</p>
                <p className="mt-1 truncate text-sm text-olive/58" title={attractionTitle}>
                  {attractionTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => resetDialog(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cream text-olive transition hover:bg-sand"
                aria-label="Закрыть"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-5">
              <div className="grid gap-2">
                {ATTRACTION_REPORT_REASON_OPTIONS.map((option) => {
                  const checked = reason === option.value;

                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-2xl border p-3 transition",
                        checked
                          ? "border-primary/35 bg-primary/7 shadow-[0_10px_24px_rgba(15,118,110,0.08)]"
                          : "border-olive/10 bg-cream/45 hover:border-primary/22 hover:bg-primary/5",
                      )}
                    >
                      <input
                        type="radio"
                        name="attraction-report-reason"
                        value={option.value}
                        checked={checked}
                        onChange={() => setReason(option.value)}
                        className="mt-1 h-4 w-4 border-olive/25 text-primary focus:ring-primary/20"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-olive">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-olive/55">
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {message ? (
                <div
                  className={cn(
                    "mt-4 rounded-2xl border px-4 py-3 text-sm leading-6",
                    submitState === "sent"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-900",
                  )}
                >
                  <div className="flex gap-2">
                    {submitState === "sent" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div>
                      <p>{message}</p>
                      {authRequired ? (
                        <Link
                          href="/auth/login"
                          className="mt-1 inline-flex font-semibold text-primary hover:text-primary-hover"
                        >
                          Войти в аккаунт
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2 border-t border-olive/10 bg-cream/45 p-4 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={() => resetDialog(false)}
                className="h-11 rounded-2xl border border-olive/12 bg-white px-4 text-sm font-semibold text-olive transition hover:border-primary/20 hover:text-primary"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitState === "submitting" || submitState === "sent"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitState === "sent" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitState === "submitting"
                  ? "Отправляем..."
                  : submitState === "sent"
                    ? "Отправлено"
                    : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
