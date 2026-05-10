"use client";

import { MessageSquareText, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ExcursionLeadModal } from "./excursion-lead-form";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarImage } from "@/components/ui/avatar-image";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { ContactWebsiteMark } from "@/components/ui/contact-website-mark";
import { trackListingAction } from "@/lib/client-listing-actions";
import { cn } from "@/lib/cn";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import { getContactActionTypeFromChannel, type ListingEntityType } from "@/lib/listing-analytics";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { normalizeWebsiteUrl } from "@/lib/website-favicon";

type ExcursionMobileBarProps = {
  priceLabel: string;
  availabilityLabel: string;
  actionLabel: string;
  actionDisabled?: boolean;
  offerType?: string | null;
  excursionTitle: string;
  durationLabel: string;
  locationName: string | null;
  websiteUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  phone: string | null;
  organizerName: string;
  organizerAvatarUrl?: string | null;
  tracking?: {
    entityType: ListingEntityType;
    entityId: string;
  } | null;
};

type MobileQuickAction = {
  id: "website" | "whatsapp" | "telegram" | "vk" | "max" | "ok" | "phone";
  label: string;
  href: string;
  icon: ReactNode;
  className: string;
};

const DATES_FALLBACK_LABEL =
  "\u0414\u0430\u0442\u044b \u0443\u0442\u043e\u0447\u043d\u044f\u044e\u0442\u0441\u044f";

function getOrganizerInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ExcursionMobileBar({
  priceLabel,
  availabilityLabel,
  actionLabel,
  actionDisabled = false,
  websiteUrl,
  tracking = null,
  ...formProps
}: ExcursionMobileBarProps) {
  const [open, setOpen] = useState(false);
  const phoneHref = normalizePhoneHref(formProps.phone);
  const normalizedWebsiteUrl = websiteUrl?.trim() ? normalizeWebsiteUrl(websiteUrl) : null;
  const whatsappUrl = normalizeWhatsappUrl(formProps.whatsappUrl);
  const telegramUrl = normalizeTelegramProfileUrl(formProps.telegramUrl);
  const vkUrl = normalizeVkProfileUrl(formProps.vkUrl);
  const maxUrl = normalizeMaxProfileUrl(formProps.maxUrl);
  const okUrl = normalizeOkProfileUrl(formProps.okUrl);
  const brandIconClassName = "h-4 w-4 items-center justify-center";
  const statusLabel = availabilityLabel || DATES_FALLBACK_LABEL;
  const organizerInitials = getOrganizerInitials(formProps.organizerName);
  const quickActions: MobileQuickAction[] = [];

  if (normalizedWebsiteUrl) {
    quickActions.push({
      id: "website",
      label: "\u0421\u0430\u0439\u0442",
      href: normalizedWebsiteUrl,
      icon: (
        <ContactWebsiteMark
          websiteUrl={normalizedWebsiteUrl}
          className={brandIconClassName}
          iconClassName="text-primary"
        />
      ),
      className:
        "border-primary/18 bg-primary/10 text-primary shadow-[0_8px_18px_rgba(15,118,110,0.14)]",
    });
  }

  if (whatsappUrl) {
    quickActions.push({
      id: "whatsapp",
      label: "WhatsApp",
      href: whatsappUrl,
      icon: <ContactBrandMark brand="whatsapp" bare className={brandIconClassName} />,
      className: "border-[#25D366]/22 bg-[#25D366]/10 shadow-[0_8px_18px_rgba(37,211,102,0.16)]",
    });
  }

  if (telegramUrl) {
    quickActions.push({
      id: "telegram",
      label: "Telegram",
      href: telegramUrl,
      icon: <ContactBrandMark brand="telegram" bare className={brandIconClassName} />,
      className: "border-[#2AABEE]/22 bg-[#2AABEE]/10 shadow-[0_8px_18px_rgba(42,171,238,0.16)]",
    });
  }

  if (vkUrl) {
    quickActions.push({
      id: "vk",
      label: "VK",
      href: vkUrl,
      icon: <ContactBrandMark brand="vk" bare className={brandIconClassName} />,
      className: "border-[#0077FF]/20 bg-[#0077FF]/9 shadow-[0_8px_18px_rgba(0,119,255,0.14)]",
    });
  }

  if (maxUrl) {
    quickActions.push({
      id: "max",
      label: "Max",
      href: maxUrl,
      icon: <ContactBrandMark brand="max" bare className={brandIconClassName} />,
      className: "border-[#FF7A1A]/22 bg-[#FF7A1A]/10 shadow-[0_8px_18px_rgba(255,122,26,0.15)]",
    });
  }

  if (okUrl) {
    quickActions.push({
      id: "ok",
      label: "OK",
      href: okUrl,
      icon: <ContactBrandMark brand="ok" bare className={brandIconClassName} />,
      className: "border-[#EE8208]/22 bg-[#EE8208]/10 shadow-[0_8px_18px_rgba(238,130,8,0.15)]",
    });
  }

  if (phoneHref) {
    quickActions.push({
      id: "phone",
      label: "\u041f\u043e\u0437\u0432\u043e\u043d\u0438\u0442\u044c",
      href: phoneHref,
      icon: <AppIcon icon={Phone} className="h-4 w-4 text-primary" />,
      className:
        "border-primary/18 bg-primary/10 text-primary shadow-[0_8px_18px_rgba(15,118,110,0.14)]",
    });
  }

  function trackQuickAction(actionId: MobileQuickAction["id"]) {
    const actionType = getContactActionTypeFromChannel(actionId);
    if (tracking && actionType) {
      trackListingAction({ ...tracking, actionType });
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-olive/15 bg-white/97 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] shadow-[0_-4px_24px_rgba(15,118,110,0.12)] backdrop-blur-sm lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <AvatarImage
                src={formProps.organizerAvatarUrl}
                alt={formProps.organizerName}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-olive/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-xs font-semibold text-olive/65 ring-1 ring-olive/10">
                  {organizerInitials || "?"}
                </span>
              </AvatarImage>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-olive">{priceLabel}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-primary/85">
                  <span className="truncate">{statusLabel}</span>
                </p>
              </div>
            </div>

            {quickActions.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {quickActions.map((action) => (
                  <a
                    key={action.id}
                    href={action.href}
                    target={action.id === "phone" ? undefined : "_blank"}
                    rel={action.id === "phone" ? undefined : "noreferrer noopener"}
                    title={action.label}
                    aria-label={action.label}
                    onClick={() => trackQuickAction(action.id)}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-xl border transition active:scale-[0.96]",
                      action.className,
                    )}
                  >
                    {action.icon}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!actionDisabled) {
                  if (tracking) {
                    trackListingAction({ ...tracking, actionType: "lead_phrase" });
                  }

                  setOpen(true);
                }
              }}
              disabled={actionDisabled}
              className="btn-primary inline-flex h-11 min-w-[132px] items-center justify-center gap-2 rounded-2xl px-3.5 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(15,118,110,0.24)] transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:min-w-[148px] sm:px-4 sm:text-sm"
            >
              <AppIcon icon={MessageSquareText} className="h-4 w-4" />
              {actionLabel}
            </button>
          </div>
        </div>
      </div>

      <ExcursionLeadModal
        open={open && !actionDisabled}
        onClose={() => setOpen(false)}
        priceTo={null}
        priceFrom={null}
        currency="RUB"
        {...formProps}
        priceLabel={priceLabel}
        tracking={tracking}
      />
    </>
  );
}

function normalizePhoneHref(phone: string | null): string | null {
  const value = phone?.trim() ?? "";
  if (!value) {
    return null;
  }

  const hasLeadingPlus = value.startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  return hasLeadingPlus ? `tel:+${digits}` : `tel:${digits}`;
}
