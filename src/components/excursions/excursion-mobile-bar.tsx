"use client";

import { Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { FavoriteToggleButton } from "@/components/favorites/favorite-toggle-button";
import { ExcursionLeadModal } from "./excursion-lead-form";
import { ExcursionPriceDisplay } from "./excursion-price-display";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { cn } from "@/lib/cn";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import type { FavoriteEntityType } from "@/lib/favorite-entities";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

type ExcursionMobileBarProps = {
  priceLabel: string;
  availabilityLabel: string;
  actionLabel: string;
  actionDisabled?: boolean;
  favoriteItemId: string;
  favoriteEntityType: FavoriteEntityType;
  offerType?: string | null;
  excursionTitle: string;
  durationLabel: string;
  locationName: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  phone: string | null;
  organizerName: string;
};

type MobileQuickAction = {
  id: "whatsapp" | "telegram" | "vk" | "max" | "ok" | "phone";
  label: string;
  href: string;
  icon: ReactNode;
  className: string;
};

export function ExcursionMobileBar({
  priceLabel,
  availabilityLabel,
  actionLabel,
  actionDisabled = false,
  favoriteItemId,
  favoriteEntityType,
  ...formProps
}: ExcursionMobileBarProps) {
  const [open, setOpen] = useState(false);
  const phoneHref = normalizePhoneHref(formProps.phone);
  const whatsappUrl = normalizeWhatsappUrl(formProps.whatsappUrl);
  const telegramUrl = normalizeTelegramProfileUrl(formProps.telegramUrl);
  const vkUrl = normalizeVkProfileUrl(formProps.vkUrl);
  const maxUrl = normalizeMaxProfileUrl(formProps.maxUrl);
  const okUrl = normalizeOkProfileUrl(formProps.okUrl);
  const brandIconClassName = "h-4.5 w-4.5 items-center justify-center";
  const quickActions: MobileQuickAction[] = [];

  if (whatsappUrl) {
    quickActions.push({
      id: "whatsapp",
      label: "WhatsApp",
      href: whatsappUrl,
      icon: <ContactBrandMark brand="whatsapp" bare className={brandIconClassName} />,
      className:
        "border-[#25D366]/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(37,211,102,0.12))] text-[#18834a]",
    });
  }

  if (telegramUrl) {
    quickActions.push({
      id: "telegram",
      label: "Telegram",
      href: telegramUrl,
      icon: <ContactBrandMark brand="telegram" bare className={brandIconClassName} />,
      className:
        "border-[#27A7E7]/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(39,167,231,0.12))] text-[#1274a7]",
    });
  }

  if (vkUrl) {
    quickActions.push({
      id: "vk",
      label: "VK",
      href: vkUrl,
      icon: <ContactBrandMark brand="vk" bare className={brandIconClassName} />,
      className:
        "border-[#0077FF]/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(0,119,255,0.12))] text-[#005fd1]",
    });
  }

  if (maxUrl) {
    quickActions.push({
      id: "max",
      label: "Max",
      href: maxUrl,
      icon: <ContactBrandMark brand="max" bare className={brandIconClassName} />,
      className:
        "border-[#FF7A1A]/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(255,122,26,0.12))] text-[#d4630f]",
    });
  }

  if (okUrl) {
    quickActions.push({
      id: "ok",
      label: "Однокл.",
      href: okUrl,
      icon: <ContactBrandMark brand="ok" bare className={brandIconClassName} />,
      className:
        "border-[#EE8208]/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(238,130,8,0.12))] text-[#cc6d00]",
    });
  }

  if (phoneHref) {
    quickActions.push({
      id: "phone",
      label: "\u041f\u043e\u0437\u0432\u043e\u043d\u0438\u0442\u044c",
      href: phoneHref,
      icon: <AppIcon icon={Phone} className="h-4.5 w-4.5" />,
      className:
        "border-primary/14 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(14,116,144,0.10))] text-primary",
    });
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 lg:hidden">
        <div className="sticky-bottom-enter glass-mobile-bar mx-auto max-w-[430px] rounded-[30px] border border-white/80 px-3.5 py-3.5 shadow-[0_20px_46px_rgba(58,43,35,0.18)]">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <ExcursionPriceDisplay priceLabel={priceLabel} size="mobile" />
              {availabilityLabel ? (
                <p className="mt-1.5 truncate text-[11px] leading-4 text-olive/50">
                  {availabilityLabel}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <FavoriteToggleButton
                itemId={favoriteItemId}
                entityType={favoriteEntityType}
                initialIsFavorite={false}
                variant="icon"
                className="h-11 w-11 border-white/80 bg-white/96"
              />
              <button
                type="button"
                onClick={() => {
                  if (!actionDisabled) {
                    setOpen(true);
                  }
                }}
                disabled={actionDisabled}
                className="inline-flex h-11 items-center justify-center rounded-[18px] bg-[#e8621a] px-5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(232,98,26,0.24)] transition hover:bg-[#d45615] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLabel}
              </button>
            </div>
          </div>

          {quickActions.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {quickActions.map((action) => (
                <a
                  key={action.id}
                  href={action.href}
                  target={action.id === "phone" ? undefined : "_blank"}
                  rel={action.id === "phone" ? undefined : "noreferrer noopener"}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[16px] border px-2 py-2 text-[11px] font-semibold shadow-[0_10px_22px_rgba(58,43,35,0.06)] transition hover:-translate-y-0.5",
                    action.className,
                  )}
                >
                  {action.icon}
                  <span className="min-w-0 text-center leading-[1.08] whitespace-normal break-words">
                    {action.id === "ok" ? "Одноклассники" : action.label}
                  </span>
                </a>
              ))}
            </div>
          ) : null}
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
        title={actionLabel}
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
