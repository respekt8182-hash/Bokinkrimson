"use client";

import { Check, Copy, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { LeadMessageAuthorToggle } from "@/components/leads/lead-message-author-toggle";
import { AppIcon } from "@/components/ui/app-icon";
import { useLeadMessageAuthorGender } from "@/hooks/use-lead-message-author-gender";
import { trackListingAction } from "@/lib/client-listing-actions";
import { cn } from "@/lib/cn";
import { buildExcursionLeadMessage } from "@/lib/lead-message-author";
import type { ListingEntityType } from "@/lib/listing-analytics";

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
  tracking?: {
    entityType: ListingEntityType;
    entityId: string;
  } | null;
};

export function ExcursionLeadForm({
  offerType = null,
  excursionTitle,
  locationName,
  organizerName,
  onCopySuccess = null,
  tracking = null,
}: ExcursionLeadFormProps) {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const { authorGender, setAuthorGender } = useLeadMessageAuthorGender();

  const messageId = useId();

  const previewMessage = useMemo(
    () =>
      buildExcursionLeadMessage({
        authorGender,
        offerType,
        organizerName,
        excursionTitle,
        locationName,
        date: "",
        guests: "",
        message,
      }),
    [authorGender, offerType, organizerName, excursionTitle, locationName, message],
  );

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

    if (tracking) {
      trackListingAction({ ...tracking, actionType: "lead_form" });
    }

    if (onCopySuccess) {
      onCopySuccess();
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-[13px] leading-relaxed text-olive/70">
          Скопируйте готовое сообщение нажатием кнопки ниже и отправьте его организатору в любой
          удобный мессенджер.
        </p>

        <LeadMessageAuthorToggle
          value={authorGender}
          onChange={(value) => {
            setAuthorGender(value);
            setCopied(false);
          }}
          className="mt-3"
        />

        <div className="mt-3 rounded-xl border border-olive/12 bg-cream/50 p-3.5">
          <pre className="whitespace-pre-wrap break-words font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-olive/85">
            {previewMessage}
          </pre>
        </div>

        <div className="mt-3">
          <label htmlFor={messageId} className="block text-[12px] font-medium text-olive/60">
            Дополнительная информация (необязательно)
          </label>
          <textarea
            id={messageId}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setCopied(false);
            }}
            placeholder="Например: хотим приватный формат, будем с ребёнком, нужен трансфер..."
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl border border-olive/16 bg-white px-3.5 py-2.5 text-[13px] text-olive placeholder:text-olive/35 outline-none transition focus:border-olive/30 focus:ring-2 focus:ring-sage/25"
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-olive/10 px-5 py-3.5">
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold shadow-sm transition active:scale-[0.97]",
            copied ? "bg-emerald-600 text-white" : "bg-[#e8621a] text-white hover:bg-[#d45615]",
          )}
        >
          <AppIcon icon={copied ? Check : Copy} className="h-4.5 w-4.5" />
          {copied ? "Скопировано!" : "Скопировать сообщение"}
        </button>
      </div>
    </>
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
  title = "Сообщение организатору",
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
        className="fixed inset-x-0 -top-8 z-50 h-[calc(100dvh_+_160px)] min-h-[calc(100svh_+_160px)] bg-[linear-gradient(180deg,rgba(58,43,35,0.92)_0%,rgba(43,31,25,0.96)_100%)] backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-3 bottom-3 z-[51] flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-[480px] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-olive/10 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-olive">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/16 text-olive/70 transition hover:bg-cream"
          >
            <AppIcon icon={X} className="h-3.5 w-3.5" />
          </button>
        </div>

        <ExcursionLeadForm {...formProps} onCopySuccess={onClose} />
      </div>
    </>
  );
}
