import { BadgeCheck, Phone } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark, type ContactBrand } from "@/components/ui/contact-brand-mark";
import { trackListingAction } from "@/lib/client-listing-actions";
import { cn } from "@/lib/cn";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import type { ListingActionType, ListingEntityType } from "@/lib/listing-analytics";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

type CompactContactStickyCardProps = {
  name: string;
  verificationLabel: string;
  phone: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  badges?: string[];
  note?: string | null;
  className?: string;
  tracking?: {
    entityType: ListingEntityType;
    entityId: string;
  } | null;
};

type ContactChannel = {
  key: string;
  href: string;
  label: string;
  brand: ContactBrand;
};

function normalizePhoneHref(phone: string | null | undefined): string | null {
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

function buildChannels(params: {
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
}): ContactChannel[] {
  const preparedWhatsappUrl = normalizeWhatsappUrl(params.whatsappUrl);
  const preparedTelegramUrl = normalizeTelegramProfileUrl(params.telegramUrl);
  const preparedVkUrl = normalizeVkProfileUrl(params.vkUrl);
  const preparedMaxUrl = normalizeMaxProfileUrl(params.maxUrl);
  const preparedOkUrl = normalizeOkProfileUrl(params.okUrl);

  return [
    preparedWhatsappUrl
      ? {
          key: "whatsapp",
          href: preparedWhatsappUrl,
          label: "WhatsApp",
          brand: "whatsapp" as const,
        }
      : null,
    preparedTelegramUrl
      ? {
          key: "telegram",
          href: preparedTelegramUrl,
          label: "Telegram",
          brand: "telegram" as const,
        }
      : null,
    preparedVkUrl ? { key: "vk", href: preparedVkUrl, label: "VK", brand: "vk" as const } : null,
    preparedMaxUrl
      ? { key: "max", href: preparedMaxUrl, label: "Max", brand: "max" as const }
      : null,
    preparedOkUrl ? { key: "ok", href: preparedOkUrl, label: "OK", brand: "ok" as const } : null,
  ].filter((item): item is ContactChannel => item !== null);
}

export function CompactContactStickyCard({
  name,
  verificationLabel,
  phone,
  whatsappUrl,
  telegramUrl,
  vkUrl,
  maxUrl,
  okUrl,
  badges = [],
  note = null,
  className,
  tracking = null,
}: CompactContactStickyCardProps) {
  const phoneHref = normalizePhoneHref(phone);
  const phoneLabel = formatPhoneLabel(phone);
  const channels = buildChannels({ whatsappUrl, telegramUrl, vkUrl, maxUrl, okUrl });
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const trackAction = (actionType: ListingActionType) => {
    if (tracking) {
      trackListingAction({ ...tracking, actionType });
    }
  };

  return (
    <article
      className={cn(
        "rounded-[26px] border border-olive/10 bg-white p-4 shadow-[0_14px_36px_rgba(58,43,35,0.06)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/18 to-primary/8 text-sm font-bold text-primary ring-2 ring-primary/15 ring-offset-1 ring-offset-white/70">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-olive">{name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-primary/85">
            <AppIcon icon={BadgeCheck} className="h-3.5 w-3.5" />
            <span>{verificationLabel}</span>
          </p>
        </div>
      </div>

      {badges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-olive/72 ring-1 ring-olive/10"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      {note ? <p className="mt-3 text-xs leading-5 text-olive/58">{note}</p> : null}

      {phoneHref && phoneLabel ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/42">
            Телефон
          </p>
          <a
            href={phoneHref}
            onClick={() => trackAction("phone_primary")}
            className="mt-2 block rounded-[20px] border border-olive/10 bg-white px-4 py-3 transition hover:border-olive/18 hover:shadow-sm"
          >
            <span className="block text-[1.35rem] font-semibold leading-tight text-olive">
              {phoneLabel}
            </span>
          </a>
        </div>
      ) : null}

      {channels.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {channels.map((channel) => (
            <a
              key={channel.key}
              href={channel.href}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => trackAction(channel.key as ListingActionType)}
              className="flex items-center gap-2.5 rounded-[18px] border border-olive/10 bg-white px-3 py-2.5 transition hover:border-olive/18 hover:shadow-sm"
            >
              <ContactBrandMark brand={channel.brand} className="h-9 w-9 rounded-xl" />
              <span className="min-w-0 truncate text-sm font-medium text-olive">
                {channel.label}
              </span>
            </a>
          ))}
        </div>
      ) : null}

      {!phoneHref && channels.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-dashed border-olive/18 bg-cream/40 px-4 py-4 text-center text-sm text-olive/68">
          <span className="inline-flex items-center gap-2">
            <AppIcon icon={Phone} className="h-4 w-4 text-olive/42" />
            Контакты организатора появятся позже
          </span>
        </div>
      ) : null}
    </article>
  );
}
