"use client";

import { CalendarDays, Check, Copy, MessageSquareText, Users, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { LeadMessageAuthorToggle } from "@/components/leads/lead-message-author-toggle";
import { AppIcon } from "@/components/ui/app-icon";
import { useLeadMessageAuthorGender } from "@/hooks/use-lead-message-author-gender";
import { cn } from "@/lib/cn";
import { buildExcursionLeadMessage, getOfferLabels } from "@/lib/lead-message-author";

type ExcursionLeadFormProps = {
  offerType?: string | null;
  excursionTitle: string;
  priceLabel: string;
  durationLabel: string;
  locationName: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  phone: string | null;
  organizerName: string;
  onCopySuccess?: (() => void) | null;
};

function buildPreviewMeta(params: {
  offerType?: string | null;
  locationName: string | null;
  priceLabel: string;
  durationLabel: string;
}): string[] {
  const offer = getOfferLabels(params.offerType);

  return [offer.badge, params.locationName, params.priceLabel, params.durationLabel].filter(
    (item): item is string => Boolean(item?.trim()),
  );
}

export function ExcursionLeadForm({
  offerType = null,
  excursionTitle,
  priceLabel,
  durationLabel,
  locationName,
  organizerName,
  onCopySuccess = null,
}: ExcursionLeadFormProps) {
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const { authorGender, setAuthorGender } = useLeadMessageAuthorGender();

  const dateId = useId();
  const guestsId = useId();
  const messageId = useId();

  const previewMessage = useMemo(
    () =>
      buildExcursionLeadMessage({
        authorGender,
        offerType,
        organizerName,
        excursionTitle,
        locationName,
        date,
        guests,
        message,
      }),
    [authorGender, offerType, organizerName, excursionTitle, locationName, date, guests, message],
  );

  const previewMeta = useMemo(
    () =>
      buildPreviewMeta({
        offerType,
        locationName,
        priceLabel,
        durationLabel,
      }),
    [offerType, locationName, priceLabel, durationLabel],
  );

  const inputClassName =
    "w-full rounded-2xl border border-olive/10 bg-white px-4 py-3 pl-11 text-sm text-olive placeholder:text-olive/32 outline-none transition hover:border-olive/18 focus:border-primary/40 focus:ring-2 focus:ring-primary/8";

  async function handleCopy() {
    let didCopy = false;

    try {
      await navigator.clipboard.writeText(previewMessage);
      didCopy = true;
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = previewMessage;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      didCopy = document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    if (!didCopy) {
      return;
    }

    if (onCopySuccess) {
      onCopySuccess();
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[26px] border border-olive/10 bg-[linear-gradient(180deg,rgba(245,240,229,0.95),rgba(255,255,255,0.98))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70">
              Готовое сообщение
            </p>
          </div>
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm">
            <AppIcon icon={MessageSquareText} className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="mt-3 rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-[0_14px_34px_rgba(74,59,37,0.08)]">
          <pre className="whitespace-pre-wrap break-words font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-olive/84">
            {previewMessage}
          </pre>
        </div>

        <LeadMessageAuthorToggle
          value={authorGender}
          onChange={(value) => {
            setAuthorGender(value);
            setCopied(false);
          }}
          className="mt-3"
        />

        {previewMeta.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {previewMeta.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="inline-flex rounded-full border border-olive/10 bg-white/80 px-3 py-1 text-[11px] font-medium text-olive/62"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/45">
            Детали заявки
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-olive/60">
            Эти данные сразу подставятся в текст выше.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <label htmlFor={dateId} className="sr-only">
              Дата экскурсии
            </label>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-olive/28">
              <AppIcon icon={CalendarDays} className="h-4 w-4" />
            </span>
            <input
              id={dateId}
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setCopied(false);
              }}
              className={inputClassName}
            />
          </div>

          <div className="relative">
            <label htmlFor={guestsId} className="sr-only">
              Количество человек
            </label>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-olive/28">
              <AppIcon icon={Users} className="h-4 w-4" />
            </span>
            <input
              id={guestsId}
              type="number"
              min={1}
              max={100}
              value={guests}
              onChange={(event) => {
                setGuests(event.target.value);
                setCopied(false);
              }}
              placeholder="Количество человек"
              className={inputClassName}
            />
          </div>
        </div>

        <div className="relative">
          <label htmlFor={messageId} className="sr-only">
            Дополнительные вопросы или пожелания
          </label>
          <span className="pointer-events-none absolute left-4 top-4 text-olive/28">
            <AppIcon icon={MessageSquareText} className="h-4 w-4" />
          </span>
          <textarea
            id={messageId}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setCopied(false);
            }}
            placeholder="Например: хотим приватный формат, будем с ребёнком, нужен трансфер или есть вопрос по маршруту."
            rows={4}
            className="min-h-[112px] w-full resize-none rounded-2xl border border-olive/10 bg-white px-4 py-3 pl-11 text-sm text-olive placeholder:text-olive/32 outline-none transition hover:border-olive/18 focus:border-primary/40 focus:ring-2 focus:ring-primary/8"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-[14px] font-semibold shadow-sm transition active:scale-[0.97]",
          copied ? "bg-emerald-600 text-white" : "bg-[#e8621a] text-white hover:bg-[#d45615]",
        )}
      >
        <AppIcon icon={copied ? Check : Copy} className="h-4 w-4" />
        {copied ? "Скопировано" : "Копировать"}
      </button>

      <p className="text-center text-[11px] leading-5 text-olive/35">
        Данные не сохраняются на сайте
      </p>
    </div>
  );
}

type ExcursionLeadModalProps = ExcursionLeadFormProps & {
  open: boolean;
  onClose: () => void;
  priceTo: number | null;
  priceFrom: number | null;
  currency: string;
  title?: string;
};

export function ExcursionLeadModal({
  open,
  onClose,
  priceTo,
  priceFrom,
  currency,
  title = "Заявка на бронирование",
  ...formProps
}: ExcursionLeadModalProps) {
  void priceTo;
  void priceFrom;
  void currency;

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-midnight/55 backdrop-blur-[2px] animate-in fade-in duration-200"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-3 bottom-3 z-[51] flex max-h-[85vh] flex-col rounded-[28px] bg-white shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:zoom-in-95 sm:slide-in-from-bottom-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-olive/10 px-5 py-3.5">
          <div>
            <h3 className="text-[15px] font-semibold text-olive">{title}</h3>
            <p className="text-xs text-olive/45">
              {formProps.priceLabel}
              {formProps.durationLabel ? ` В· ${formProps.durationLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/16 text-olive/70 transition hover:bg-cream"
          >
            <AppIcon icon={X} className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ExcursionLeadForm {...formProps} onCopySuccess={onClose} />
        </div>
      </div>
    </>
  );
}
