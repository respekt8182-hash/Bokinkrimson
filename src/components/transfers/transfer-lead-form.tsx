"use client";

import { Check, Copy, MessageSquareText, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { LeadMessageAuthorToggle } from "@/components/leads/lead-message-author-toggle";
import { AppIcon } from "@/components/ui/app-icon";
import { useLeadMessageAuthorGender } from "@/hooks/use-lead-message-author-gender";
import { useListingLeadNumber } from "@/hooks/use-listing-lead-number";
import { trackListingAction } from "@/lib/client-listing-actions";
import { cn } from "@/lib/cn";
import { buildTransferLeadMessage } from "@/lib/lead-message-author";
import type { ListingEntityType } from "@/lib/listing-analytics";

type TransferLeadFormProps = {
  transferTitle: string;
  locationName: string | null;
  priceLabel: string;
  vehicleOptions: string[];
  triggerLabel?: string;
  triggerClassName?: string;
  entityPublicId?: number | null;
  tracking?: {
    entityType: ListingEntityType;
    entityId: string;
  } | null;
};

export function TransferLeadForm({
  transferTitle,
  locationName,
  priceLabel,
  vehicleOptions,
  triggerLabel = "Заказать трансфер",
  triggerClassName,
  entityPublicId = null,
  tracking = null,
}: TransferLeadFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [extra, setExtra] = useState("");
  const [copied, setCopied] = useState(false);
  const { authorGender, setAuthorGender } = useLeadMessageAuthorGender();
  const extraInfoId = useId();
  const vehicleOption = vehicleOptions[0] ?? null;
  const lead = useListingLeadNumber({
    enabled: isOpen && Boolean(tracking),
    entityType: tracking?.entityType ?? "transfer",
    entityId: tracking?.entityId ?? "",
    fallbackEntityPublicId: entityPublicId,
  });
  const leadRequired = Boolean(tracking);
  const copyDisabled = leadRequired && (lead.loading || !lead.leadNumber);

  const previewMessage = useMemo(
    () =>
      buildTransferLeadMessage({
        authorGender,
        transferTitle,
        locationName,
        priceLabel,
        vehicleOption,
        extra,
        leadNumber: lead.leadNumber,
        entityPublicId: lead.entityPublicId ?? entityPublicId,
      }),
    [
      authorGender,
      transferTitle,
      locationName,
      priceLabel,
      vehicleOption,
      extra,
      lead.leadNumber,
      lead.entityPublicId,
      entityPublicId,
    ],
  );

  function openModal() {
    if (tracking) {
      trackListingAction({ ...tracking, actionType: "lead_phrase" });
    }

    setExtra("");
    setCopied(false);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setCopied(false);
  }

  async function handleCopy() {
    if (copyDisabled) {
      return;
    }

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

    if (didCopy) {
      if (tracking) {
        trackListingAction({ ...tracking, actionType: "lead_copy", leadNumber: lead.leadNumber });
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
      setIsOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold shadow-sm transition active:scale-[0.97]",
          triggerClassName ??
            "h-11 w-full rounded-xl bg-[#e8621a] px-4 text-[14px] text-white hover:bg-[#d45615]",
        )}
      >
        <AppIcon icon={MessageSquareText} className="h-4 w-4" />
        {triggerLabel}
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={closeModal}
            className="fixed inset-x-0 -top-8 z-50 h-[calc(100dvh_+_160px)] min-h-[calc(100svh_+_160px)] bg-[linear-gradient(180deg,rgba(58,43,35,0.92)_0%,rgba(43,31,25,0.96)_100%)] backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-3 bottom-3 z-[51] flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-olive/10 px-5 py-3.5">
              <h3 className="text-[15px] font-semibold text-olive">Сообщение водителю</h3>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/16 text-olive/70 transition hover:bg-cream"
              >
                <AppIcon icon={X} className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-[13px] leading-relaxed text-olive/70">
                Скопируйте готовое сообщение нажатием кнопки ниже и отправьте его водителю в любой
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
                <label
                  htmlFor={extraInfoId}
                  className="block text-[12px] font-medium text-olive/60"
                >
                  Дополнительная информация (необязательно)
                </label>
                <textarea
                  id={extraInfoId}
                  value={extra}
                  onChange={(event) => {
                    setExtra(event.target.value);
                    setCopied(false);
                  }}
                  placeholder="Например: нужно детское кресло, будет багаж, нужна встреча с табличкой..."
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-xl border border-olive/16 bg-white px-3.5 py-2.5 text-[13px] text-olive placeholder:text-olive/35 outline-none transition focus:border-olive/30 focus:ring-2 focus:ring-sage/25"
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-olive/10 px-5 py-3.5">
              {lead.error ? (
                <p className="mb-2 text-center text-xs text-red-600">{lead.error}</p>
              ) : null}
              <button
                type="button"
                onClick={handleCopy}
                disabled={copyDisabled}
                className={cn(
                  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold shadow-sm transition active:scale-[0.97]",
                  copyDisabled
                    ? "cursor-not-allowed bg-olive/20 text-olive/45 shadow-none"
                    : copied
                      ? "bg-emerald-600 text-white"
                      : "bg-[#e8621a] text-white hover:bg-[#d45615]",
                )}
              >
                <AppIcon icon={copied ? Check : Copy} className="h-4.5 w-4.5" />
                {copied
                  ? "Скопировано!"
                  : lead.loading
                    ? "Готовим номер обращения..."
                    : "Скопировать сообщение"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
