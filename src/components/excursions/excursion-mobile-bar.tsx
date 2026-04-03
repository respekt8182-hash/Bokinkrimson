"use client";

import { useState } from "react";
import { ExcursionLeadForm } from "./excursion-lead-form";
import { AppIcon } from "@/components/ui/app-icon";
import { X } from "lucide-react";

type ExcursionMobileBarProps = {
  priceLabel: string;
  availabilityLabel: string;
  excursionTitle: string;
  durationLabel: string;
  locationName: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  phone: string | null;
  organizerName: string;
};

export function ExcursionMobileBar({
  priceLabel,
  availabilityLabel,
  ...formProps
}: ExcursionMobileBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 glass-mobile-bar px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-olive/35">Цена</p>
            <p className="mt-0.5 text-lg font-bold leading-none text-olive">{priceLabel}</p>
            {availabilityLabel && (
              <p className="mt-1 truncate text-xs text-olive/55">{availabilityLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-primary inline-flex h-12 shrink-0 items-center justify-center rounded-2xl px-6 text-sm font-bold text-white"
          >
            Оставить заявку
          </button>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-midnight/55 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-3 bottom-3 z-[51] flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-olive/10 px-5 py-3.5">
              <div>
                <h3 className="text-[15px] font-semibold text-olive">Оставить заявку</h3>
                <p className="text-xs text-olive/50">
                  {priceLabel}
                  {formProps.durationLabel ? ` · ${formProps.durationLabel}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/16 text-olive/70 transition hover:bg-cream"
              >
                <AppIcon icon={X} className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ExcursionLeadForm {...formProps} priceLabel={priceLabel} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
