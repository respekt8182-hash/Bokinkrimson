"use client";

import { ChevronDown, ChevronRight, ChevronUp, Globe, Mail, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark, type ContactBrand } from "@/components/ui/contact-brand-mark";
import { trackListingAction } from "@/lib/client-listing-actions";
import { cn } from "@/lib/cn";
import {
  normalizeEmailHref,
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import {
  getPhoneListingActionType,
  type ListingActionType,
  type ListingEntityType,
} from "@/lib/listing-analytics";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import {
  buildWebsiteFaviconUrl,
  normalizeWebsiteUrl,
  readWebsiteHostname,
} from "@/lib/website-favicon";

type PropertyContactsPanelProps = {
  phone: string | null;
  phoneLabel?: string | null;
  phoneName?: string | null;
  extraPhones?: Array<{
    phone: string;
    label?: string | null;
    name?: string | null;
  }>;
  websiteUrl: string | null;
  email: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
  text?: PropertyContactsPanelText;
  variant?: "default" | "compact";
  secondaryContactsCompact?: boolean;
  secondaryContactsNoWrap?: boolean;
  hideEmptyState?: boolean;
  hideSecondaryContactsEyebrow?: boolean;
  tracking?: {
    entityType: ListingEntityType;
    entityId: string;
  } | null;
};

export type PropertyContactsPanelText = {
  emptyState?: string;
  primaryPhoneEyebrow?: string;
  primaryPhoneFallbackName?: string;
  secondaryContactsEyebrow?: string;
  websiteLabel?: string;
  websiteCaptionFallback?: string;
  emailLabel?: string;
  emailCaption?: string;
  whatsappCaption?: string;
  telegramCaption?: string;
  vkCaption?: string;
  maxCaption?: string;
  okCaption?: string;
};

type ContactAction = {
  id: string;
  label: string;
  href: string;
  brand: ContactBrand;
  caption: string;
  className: string;
  compactLabel?: string;
  compactDescription?: string | null;
};

type PhoneItem = {
  key: string;
  href: string | null;
  label: string;
  name: string | null;
};

function PhoneIcon() {
  return <AppIcon icon={Phone} className="h-[18px] w-[18px]" />;
}

function GlobeIcon() {
  return <AppIcon icon={Globe} className="h-[18px] w-[18px]" />;
}

function MailIcon() {
  return <AppIcon icon={Mail} className="h-[18px] w-[18px]" />;
}

function normalizePhoneHref(phone: string): string | null {
  const value = phone.trim();
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

function formatWebsiteCaption(hostname: string | null, fallback: string): string {
  if (!hostname) {
    return fallback;
  }

  const normalizedHostname = hostname.replace(/^www\./i, "");
  if (normalizedHostname.length > 32 || normalizedHostname.includes("xn--")) {
    return fallback;
  }

  return normalizedHostname;
}

function ContactChannelLink(props: {
  label: string;
  compactLabel?: string;
  href: string;
  caption: string;
  compactDescription?: string | null;
  icon: ReactNode;
  className?: string;
  compact?: boolean;
  fullWidthCompact?: boolean;
  iconOnlyCompact?: boolean;
  external?: boolean;
  onClick?: () => void;
}) {
  const {
    label,
    compactLabel,
    href,
    caption,
    compactDescription = null,
    icon,
    className,
    compact = false,
    fullWidthCompact = false,
    iconOnlyCompact = false,
    external = true,
    onClick,
  } = props;
  const effectiveLabel = compact ? (compactLabel ?? label) : label;
  const showCompactAsIconOnly = compact && iconOnlyCompact;

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "group flex items-center border text-left transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-terra/25",
        showCompactAsIconOnly
          ? "h-10 w-10 shrink-0 justify-center rounded-[14px] p-0 shadow-[0_10px_22px_rgba(58,43,35,0.04)]"
          : compact
          ? fullWidthCompact
            ? "h-full w-full gap-2.5 rounded-[18px] px-3 py-3 shadow-[0_10px_22px_rgba(58,43,35,0.04)]"
            : "h-12 w-full flex-col justify-center gap-1 rounded-[16px] px-2 py-2 shadow-[0_10px_22px_rgba(58,43,35,0.04)]"
          : "w-full gap-3 rounded-[20px] px-3.5 py-3.5 shadow-[0_14px_30px_rgba(58,43,35,0.05)]",
        compact && fullWidthCompact && !showCompactAsIconOnly && "col-span-full",
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center border border-white/80 bg-white/95",
          showCompactAsIconOnly
            ? "h-8 w-8 rounded-[11px] shadow-[0_8px_18px_rgba(58,43,35,0.06)]"
            : compact
            ? fullWidthCompact
              ? "h-10 w-10 rounded-[14px] shadow-[0_8px_18px_rgba(58,43,35,0.06)]"
              : "h-8 w-8 rounded-[12px] shadow-[0_8px_18px_rgba(58,43,35,0.06)]"
            : "h-11 w-11 rounded-[16px] shadow-[0_10px_22px_rgba(58,43,35,0.08)]",
        )}
      >
        {icon}
      </span>
      {!showCompactAsIconOnly ? (
        <span className={cn(compact && !fullWidthCompact ? "w-full" : "min-w-0 flex-1")}>
          <span
            className={cn(
              "block font-semibold text-olive",
              compact
                ? fullWidthCompact
                  ? "text-[12.5px] leading-[1.15] whitespace-normal break-words"
                  : "truncate text-center text-[10.5px] leading-none"
                : "truncate text-sm",
            )}
          >
            {effectiveLabel}
          </span>
          {!compact ? (
            <span className="mt-0.5 block truncate text-xs text-olive/56">{caption}</span>
          ) : compactDescription && fullWidthCompact ? (
            <span className="mt-1 block text-[11px] leading-4 text-olive/54">
              {compactDescription}
            </span>
          ) : null}
        </span>
      ) : null}
      {!compact || (fullWidthCompact && !showCompactAsIconOnly) ? (
        <AppIcon
          icon={ChevronRight}
          className={cn(
            "shrink-0 text-olive/35 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary",
            compact ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
        />
      ) : null}
    </a>
  );
}

export function PropertyContactsPanel({
  phone,
  phoneLabel = null,
  phoneName = null,
  extraPhones = [],
  websiteUrl,
  email,
  whatsappUrl,
  telegramUrl,
  vkUrl,
  maxUrl,
  okUrl,
  text,
  variant = "default",
  secondaryContactsCompact = false,
  secondaryContactsNoWrap = false,
  hideEmptyState = false,
  hideSecondaryContactsEyebrow = false,
  tracking = null,
}: PropertyContactsPanelProps) {
  const [isPhoneExpanded, setIsPhoneExpanded] = useState(false);
  const isCompact = variant === "compact";
  const isSecondaryContactsCompact = isCompact || secondaryContactsCompact;
  const preparedPhone = phone?.trim() ? phone.trim() : null;
  const preparedExtraPhones = extraPhones
    .map((item) => ({
      phone: item.phone.trim(),
      label: item.label?.trim() || null,
      name: item.name?.trim() || null,
    }))
    .filter((item) => item.phone.length > 0);
  const preparedWebsiteUrl = websiteUrl?.trim() ? websiteUrl.trim() : null;
  const preparedEmailHref = normalizeEmailHref(email);
  const preparedWhatsappUrl = normalizeWhatsappUrl(whatsappUrl);
  const preparedTelegramUrl = normalizeTelegramProfileUrl(telegramUrl);
  const preparedVkUrl = normalizeVkProfileUrl(vkUrl);
  const preparedMaxUrl = normalizeMaxProfileUrl(maxUrl);
  const preparedOkUrl = normalizeOkProfileUrl(okUrl);
  const normalizedWebsiteHref = preparedWebsiteUrl ? normalizeWebsiteUrl(preparedWebsiteUrl) : null;
  const [failedWebsiteFaviconUrl, setFailedWebsiteFaviconUrl] = useState<string | null>(null);
  const copy = {
    emptyState: text?.emptyState ?? "Контакты владельца пока не добавлены.",
    primaryPhoneEyebrow: text?.primaryPhoneEyebrow ?? "Телефон владельца",
    primaryPhoneFallbackName: text?.primaryPhoneFallbackName ?? "Основной номер для связи",
    secondaryContactsEyebrow: text?.secondaryContactsEyebrow ?? "Другие способы связи",
    websiteLabel: text?.websiteLabel ?? "Сайт владельца",
    websiteCaptionFallback: text?.websiteCaptionFallback ?? "Открыть сайт владельца",
    emailLabel: text?.emailLabel ?? "Написать на почту",
    emailCaption: text?.emailCaption ?? "Открыть письмо в почтовом клиенте",
    whatsappCaption: text?.whatsappCaption ?? "Открыть чат с владельцем",
    telegramCaption: text?.telegramCaption ?? "Написать в Telegram",
    vkCaption: text?.vkCaption ?? "Открыть страницу VK",
    maxCaption: text?.maxCaption ?? "Открыть профиль Max",
    okCaption: text?.okCaption ?? "Открыть профиль в Одноклассниках",
  } satisfies Required<PropertyContactsPanelText>;

  const websiteFaviconUrl = buildWebsiteFaviconUrl(preparedWebsiteUrl);
  const websiteHostname = readWebsiteHostname(preparedWebsiteUrl);
  const websiteCaption = formatWebsiteCaption(websiteHostname, copy.websiteCaptionFallback);
  const shouldShowWebsiteFavicon = Boolean(
    websiteFaviconUrl && websiteFaviconUrl !== failedWebsiteFaviconUrl,
  );

  const phoneItems = [
    preparedPhone
      ? {
          key: "primary",
          href: normalizePhoneHref(preparedPhone),
          label: phoneLabel?.trim() || preparedPhone,
          name: phoneName?.trim() || null,
        }
      : null,
    ...preparedExtraPhones.map((item, index) => ({
      key: `extra-${index}`,
      href: normalizePhoneHref(item.phone),
      label: item.label || item.phone,
      name: item.name,
    })),
  ].filter((item): item is PhoneItem => item !== null);

  const primaryPhone = phoneItems[0] ?? null;
  const extraPhoneItems = phoneItems.slice(1);

  const actions: ContactAction[] = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      compactLabel: "WA",
      href: preparedWhatsappUrl ?? "",
      brand: "whatsapp",
      caption: copy.whatsappCaption,
      className:
        "border-[#25D366]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(37,211,102,0.12))] hover:border-[#25D366]/34 hover:shadow-[0_16px_32px_rgba(37,211,102,0.14)]",
    },
    {
      id: "telegram",
      label: "Telegram",
      compactLabel: "TG",
      href: preparedTelegramUrl ?? "",
      brand: "telegram",
      caption: copy.telegramCaption,
      className:
        "border-[#27A7E7]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(39,167,231,0.12))] hover:border-[#27A7E7]/34 hover:shadow-[0_16px_32px_rgba(39,167,231,0.14)]",
    },
    {
      id: "vk",
      label: "VK",
      compactLabel: "VK",
      href: preparedVkUrl ?? "",
      brand: "vk",
      caption: copy.vkCaption,
      className:
        "border-[#0077FF]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(0,119,255,0.12))] hover:border-[#0077FF]/34 hover:shadow-[0_16px_32px_rgba(0,119,255,0.14)]",
    },
    {
      id: "max",
      label: "Max",
      compactLabel: "Max",
      href: preparedMaxUrl ?? "",
      brand: "max",
      caption: copy.maxCaption,
      className:
        "border-[#FF7A1A]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(255,122,26,0.12))] hover:border-[#FF7A1A]/34 hover:shadow-[0_16px_32px_rgba(255,122,26,0.14)]",
    },
    {
      id: "ok",
      compactLabel: "OK",
      label: "Одноклассники",
      href: preparedOkUrl ?? "",
      brand: "ok",
      caption: copy.okCaption,
      className:
        "border-[#EE8208]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(238,130,8,0.12))] hover:border-[#EE8208]/34 hover:shadow-[0_16px_32px_rgba(238,130,8,0.14)]",
    },
  ];

  const visibleActions = actions.filter((item) => item.href.trim().length > 0);
  const hasSecondaryContacts = Boolean(
    normalizedWebsiteHref || preparedEmailHref || visibleActions.length > 0,
  );
  const hasAnyContact = Boolean(phoneItems.length > 0 || hasSecondaryContacts);
  const trackAction = (actionType: ListingActionType) => {
    if (tracking) {
      trackListingAction({ ...tracking, actionType });
    }
  };

  return (
    <div className={cn("space-y-4", isCompact && "space-y-3")}>
      {!hasAnyContact && !hideEmptyState ? (
        <p className="text-sm text-olive/60">{copy.emptyState}</p>
      ) : null}

      {primaryPhone ? (
        <div
          className={cn(
            "rounded-[24px] border border-primary/14 bg-[linear-gradient(160deg,rgba(247,251,250,0.96),rgba(229,245,243,0.98))] shadow-[0_18px_40px_rgba(15,118,110,0.08)]",
            isCompact ? "p-3" : "p-4",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(145deg,rgba(15,118,110,0.98),rgba(14,116,144,0.92))] text-white shadow-[0_16px_32px_rgba(15,118,110,0.22)]",
                isCompact ? "h-9 w-9" : "h-11 w-11",
              )}
            >
              <PhoneIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/72">
                {primaryPhone.name || copy.primaryPhoneEyebrow}
              </p>
              {primaryPhone.href ? (
                <a
                  href={primaryPhone.href}
                  onClick={() => trackAction("phone_primary")}
                  className={cn(
                    "mt-2 block font-semibold leading-tight text-olive transition-colors hover:text-primary",
                    isCompact ? "text-base" : "text-lg",
                  )}
                >
                  {primaryPhone.label}
                </a>
              ) : (
                <p
                  className={cn(
                    "mt-2 font-semibold leading-tight text-olive",
                    isCompact ? "text-base" : "text-lg",
                  )}
                >
                  {primaryPhone.label}
                </p>
              )}
              <p className={cn("mt-1 text-olive/58", isCompact ? "text-[13px]" : "text-sm")}>
                {copy.primaryPhoneFallbackName}
              </p>
            </div>
          </div>

          {extraPhoneItems.length > 0 ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setIsPhoneExpanded((value) => !value)}
                aria-expanded={isPhoneExpanded}
                className={cn(
                  "flex w-full items-center justify-between rounded-[18px] border border-primary/10 bg-white/82 text-left shadow-[0_10px_24px_rgba(58,43,35,0.05)] transition-all duration-200 hover:border-primary/18 hover:bg-white focus:outline-none focus:ring-2 focus:ring-terra/25",
                  isCompact ? "px-3.5 py-2.5" : "px-4 py-3",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-olive">Дополнительные</span>
                  <span className="mt-0.5 block text-xs text-olive/55">
                    {isPhoneExpanded
                      ? "Скрыть дополнительные номера"
                      : `Показать ещё ${extraPhoneItems.length}`}
                  </span>
                </span>
                <span className="ml-3 flex items-center gap-2">
                  <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                    {extraPhoneItems.length}
                  </span>
                  <AppIcon
                    icon={isPhoneExpanded ? ChevronUp : ChevronDown}
                    className="h-4 w-4 text-primary"
                  />
                </span>
              </button>
            </div>
          ) : null}

          {isPhoneExpanded ? (
            <div className="mt-3 space-y-2">
              {extraPhoneItems.map((item, index) => {
                const content = (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive/45">
                      {item.name || `Доп. номер ${index + 1}`}
                    </p>
                    <p className="mt-1 truncate text-base font-semibold text-olive">{item.label}</p>
                  </>
                );

                return item.href ? (
                  <a
                    key={item.key}
                    href={item.href}
                    onClick={() => trackAction(getPhoneListingActionType(index + 1))}
                    className={cn(
                      "block rounded-[18px] border border-white/80 bg-white/88 shadow-sm transition-colors hover:border-primary/14 hover:text-primary",
                      isCompact ? "px-3.5 py-2.5" : "px-4 py-3",
                    )}
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-[18px] border border-white/80 bg-white/88 shadow-sm",
                      isCompact ? "px-3.5 py-2.5" : "px-4 py-3",
                    )}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasSecondaryContacts ? (
        <div className={cn(isSecondaryContactsCompact ? "space-y-2.5" : "space-y-2")}>
          {!hideSecondaryContactsEyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/42">
              {copy.secondaryContactsEyebrow}
            </p>
          ) : null}

          <div
            className={cn(
              isSecondaryContactsCompact
                ? cn("flex gap-1.5", secondaryContactsNoWrap ? "flex-nowrap" : "flex-wrap")
                : "space-y-2",
            )}
          >
            {normalizedWebsiteHref ? (
              <ContactChannelLink
                label={copy.websiteLabel}
                href={normalizedWebsiteHref}
                caption={websiteCaption}
                onClick={() => trackAction("website")}
                compact={isSecondaryContactsCompact}
                iconOnlyCompact={isSecondaryContactsCompact}
                className="border-primary/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(14,116,144,0.10))] hover:border-primary/30 hover:shadow-[0_16px_30px_rgba(14,116,144,0.12)]"
                icon={
                  shouldShowWebsiteFavicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={websiteFaviconUrl!}
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-5 rounded-sm object-contain"
                      onError={() => setFailedWebsiteFaviconUrl(websiteFaviconUrl)}
                    />
                  ) : (
                    <GlobeIcon />
                  )
                }
              />
            ) : null}

            {preparedEmailHref ? (
              <ContactChannelLink
                label={copy.emailLabel}
                compactLabel="Email"
                href={preparedEmailHref}
                caption={copy.emailCaption}
                onClick={() => trackAction("email")}
                compact={isSecondaryContactsCompact}
                iconOnlyCompact={isSecondaryContactsCompact}
                external={false}
                className="border-amber-500/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(245,158,11,0.12))] hover:border-amber-500/34 hover:shadow-[0_16px_30px_rgba(245,158,11,0.12)]"
                icon={<MailIcon />}
              />
            ) : null}

            {visibleActions.map((action) => (
              <ContactChannelLink
                key={action.id}
                label={action.id === "ok" ? "Одноклассники" : action.label}
                compactLabel={action.compactLabel}
                href={action.href}
                caption={action.caption}
                onClick={() => trackAction(action.id as ListingActionType)}
                compact={isSecondaryContactsCompact}
                iconOnlyCompact={isSecondaryContactsCompact}
                compactDescription={action.compactDescription}
                className={action.className}
                icon={<ContactBrandMark brand={action.brand} bare className="h-5 w-5" />}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
