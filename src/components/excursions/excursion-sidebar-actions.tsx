"use client";

import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import {
  PropertyContactsPanel,
  type PropertyContactsPanelText,
} from "@/components/contacts/property-contacts-panel";
import { ExcursionLeadModal } from "@/components/excursions/excursion-lead-form";
import { AppIcon } from "@/components/ui/app-icon";

type ExcursionSidebarActionsProps = {
  actionLabel: string;
  actionDisabled: boolean;
  offerType?: string | null;
  excursionTitle: string;
  priceLabel: string;
  durationLabel: string;
  locationName: string | null;
  phone: string | null;
  phone2: string | null;
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  organizerName: string;
  isInstantConfirmation?: boolean;
};

export const excursionContactPanelText = {
  emptyState:
    "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0442\u043E\u0440\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B.",
  primaryPhoneEyebrow:
    "\u0422\u0435\u043B\u0435\u0444\u043E\u043D \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0442\u043E\u0440\u0430",
  secondaryContactsEyebrow:
    "\u0414\u0440\u0443\u0433\u0438\u0435 \u0441\u043F\u043E\u0441\u043E\u0431\u044B \u0441\u0432\u044F\u0437\u0438",
  websiteLabel:
    "\u0421\u0430\u0439\u0442 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0442\u043E\u0440\u0430",
  websiteCaptionFallback:
    "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0430\u0439\u0442 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0442\u043E\u0440\u0430",
  whatsappCaption:
    "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0447\u0430\u0442 \u0441 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0442\u043E\u0440\u043E\u043C",
  telegramCaption: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0432 Telegram",
  vkCaption:
    "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 VK",
  maxCaption: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0447\u0430\u0442 \u0432 Max",
  okCaption:
    "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0432 \u041E\u0434\u043D\u043E\u043A\u043B\u0430\u0441\u0441\u043D\u0438\u043A\u0430\u0445",
} satisfies PropertyContactsPanelText;

function formatPhoneLabel(phone: string | null | undefined): string | null {
  const value = phone?.trim() ?? "";
  if (!value) {
    return null;
  }

  if (/[()\s-]/.test(value)) {
    return value;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    const prefix = digits.startsWith("8") ? "8" : "+7";
    const rest = digits.slice(1);
    return `${prefix} ${rest.slice(0, 3)} ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`;
  }

  return value.startsWith("+") ? `+${digits}` : digits;
}

export function ExcursionSidebarActions({
  actionLabel,
  actionDisabled,
  offerType = null,
  excursionTitle,
  priceLabel,
  durationLabel,
  locationName,
  phone,
  phone2,
  websiteUrl,
  whatsappUrl,
  telegramUrl,
  vkUrl,
  maxUrl,
  okUrl,
  organizerName,
  isInstantConfirmation = false,
}: ExcursionSidebarActionsProps) {
  const [open, setOpen] = useState(false);
  const organizerInitial = organizerName.trim()[0]?.toUpperCase() ?? "?";
  const primaryPhoneLabel = formatPhoneLabel(phone);
  const extraPhones = phone2?.trim()
    ? [
        {
          phone: phone2.trim(),
          label: formatPhoneLabel(phone2) ?? phone2.trim(),
        },
      ]
    : [];
  const contactPersonName = organizerName.trim().split(/\s+/).filter(Boolean)[0] ?? null;
  const hasContacts = [
    phone,
    phone2,
    websiteUrl,
    whatsappUrl,
    telegramUrl,
    vkUrl,
    maxUrl,
    okUrl,
  ].some((value) => (value?.trim() ?? "").length > 0);

  return (
    <>
      {hasContacts ? (
        <div className="rounded-[30px] border border-olive/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,241,0.86))] p-3.5 shadow-[0_18px_42px_rgba(58,43,35,0.08)]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-semibold text-primary ring-1 ring-olive/10">
              {organizerInitial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[15px] font-semibold text-olive">{organizerName}</p>
                {!isInstantConfirmation ? (
                  <span className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/72">
                    {"\u041D\u0430 \u0441\u0432\u044F\u0437\u0438"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-5 text-primary/85">
                <AppIcon icon={BadgeCheck} className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {isInstantConfirmation
                    ? "\u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0442\u043E\u0440 \u0431\u044B\u0441\u0442\u0440\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u0437\u0430\u044F\u0432\u043A\u0438"
                    : "\u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0442\u043E\u0440 \u043D\u0430 \u0441\u0432\u044F\u0437\u0438 \u043F\u043E \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443 \u0438 \u0432 \u043C\u0435\u0441\u0441\u0435\u043D\u0434\u0436\u0435\u0440\u0430\u0445"}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-3">
            <PropertyContactsPanel
              phone={phone}
              phoneLabel={primaryPhoneLabel}
              phoneName={contactPersonName}
              extraPhones={extraPhones}
              websiteUrl={websiteUrl}
              whatsappUrl={whatsappUrl}
              telegramUrl={telegramUrl}
              vkUrl={vkUrl}
              maxUrl={maxUrl}
              okUrl={okUrl}
              text={excursionContactPanelText}
              variant="compact"
            />
          </div>
        </div>
      ) : null}

      {actionDisabled ? (
        <div className="rounded-[20px] border border-dashed border-olive/12 bg-white/88 px-4 py-3 text-center text-[13px] leading-5 text-olive/55 shadow-[0_10px_24px_rgba(58,43,35,0.05)]">
          {
            "\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430."
          }
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-12 w-full items-center justify-center rounded-[18px] bg-[#e8621a] px-5 text-[15px] font-semibold text-white shadow-[0_18px_36px_rgba(232,98,26,0.24)] ring-4 ring-white/92 transition hover:bg-[#d45615] active:scale-[0.985]"
        >
          {actionLabel}
        </button>
      )}

      <ExcursionLeadModal
        open={open}
        onClose={() => setOpen(false)}
        priceTo={null}
        priceFrom={null}
        currency="RUB"
        offerType={offerType}
        excursionTitle={excursionTitle}
        priceLabel={priceLabel}
        durationLabel={durationLabel}
        locationName={locationName}
        whatsappUrl={whatsappUrl}
        telegramUrl={telegramUrl}
        phone={phone}
        organizerName={organizerName}
      />
    </>
  );
}
