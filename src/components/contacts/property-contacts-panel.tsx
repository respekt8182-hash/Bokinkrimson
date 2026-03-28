"use client";

import { Globe, Mail, Phone } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark, type ContactBrand } from "@/components/ui/contact-brand-mark";
import { cn } from "@/lib/cn";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { buildWebsiteFaviconUrl } from "@/lib/website-favicon";

type PropertyContactsPanelProps = {
  phone: string | null;
  websiteUrl: string | null;
  email: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  vkUrl: string | null;
  maxUrl: string | null;
  okUrl: string | null;
};

type ContactAction = {
  id: string;
  label: string;
  href: string;
  short: string;
  brand: ContactBrand;
  className: string;
};

function PhoneIcon() {
  return <AppIcon icon={Phone} className="h-[18px] w-[18px]" />;
}

function MailIcon() {
  return <AppIcon icon={Mail} className="h-[18px] w-[18px]" />;
}

function GlobeIcon() {
  return <AppIcon icon={Globe} className="h-[18px] w-[18px]" />;
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

  return hasLeadingPlus ? `+${digits}` : digits;
}

function ContactIconLink(props: {
  label: string;
  href: string;
  short: string;
  className?: string;
  brand?: ContactBrand;
  children?: ReactNode;
}) {
  const { label, href, short, className, brand, children } = props;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/70 bg-white/82 text-xs font-semibold shadow-[0_12px_28px_rgba(15,118,110,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-terra/30",
        className,
      )}
      data-brand={brand}
    >
      {children ?? short}
    </a>
  );
}

export function PropertyContactsPanel({
  phone,
  websiteUrl,
  email,
  whatsappUrl,
  telegramUrl,
  vkUrl,
  maxUrl,
  okUrl,
}: PropertyContactsPanelProps) {
  const [isPhoneExpanded, setIsPhoneExpanded] = useState(false);
  const isLikelyMobile =
    typeof window !== "undefined" &&
    (window.matchMedia("(pointer: coarse)").matches ||
      /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(window.navigator.userAgent));

  const preparedPhone = phone?.trim() ? phone.trim() : null;
  const preparedWebsiteUrl = websiteUrl?.trim() ? websiteUrl.trim() : null;
  const preparedEmail = email?.trim() ? email.trim() : null;
  const preparedWhatsappUrl = whatsappUrl?.trim() ? whatsappUrl.trim() : null;
  const preparedTelegramUrl = normalizeTelegramProfileUrl(telegramUrl);
  const preparedVkUrl = vkUrl?.trim() ? vkUrl.trim() : null;
  const preparedMaxUrl = maxUrl?.trim() ? maxUrl.trim() : null;
  const preparedOkUrl = okUrl?.trim() ? okUrl.trim() : null;
  const [failedWebsiteFaviconUrl, setFailedWebsiteFaviconUrl] = useState<string | null>(null);

  const websiteFaviconUrl = useMemo(
    () => buildWebsiteFaviconUrl(preparedWebsiteUrl),
    [preparedWebsiteUrl],
  );
  const shouldShowWebsiteFavicon = Boolean(
    websiteFaviconUrl && websiteFaviconUrl !== failedWebsiteFaviconUrl,
  );

  const phoneHref = useMemo(() => {
    if (!preparedPhone) {
      return null;
    }

    const normalized = normalizePhoneHref(preparedPhone);
    return normalized ? `tel:${normalized}` : null;
  }, [preparedPhone]);

  const actions = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: preparedWhatsappUrl ?? "",
      short: "WA",
      brand: "whatsapp",
      className:
        "border-[#25D366]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(37,211,102,0.12))] hover:border-[#25D366]/38 hover:shadow-[0_16px_32px_rgba(37,211,102,0.16),inset_0_1px_0_rgba(255,255,255,0.96)]",
    },
    {
      id: "telegram",
      label: "Telegram",
      href: preparedTelegramUrl ?? "",
      short: "TG",
      brand: "telegram",
      className:
        "border-[#27A7E7]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(39,167,231,0.12))] hover:border-[#27A7E7]/38 hover:shadow-[0_16px_32px_rgba(39,167,231,0.16),inset_0_1px_0_rgba(255,255,255,0.96)]",
    },
    {
      id: "vk",
      label: "VK",
      href: preparedVkUrl ?? "",
      short: "VK",
      brand: "vk",
      className:
        "border-[#0077FF]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(0,119,255,0.12))] hover:border-[#0077FF]/38 hover:shadow-[0_16px_32px_rgba(0,119,255,0.16),inset_0_1px_0_rgba(255,255,255,0.96)]",
    },
    {
      id: "max",
      label: "Max",
      href: preparedMaxUrl ?? "",
      short: "MX",
      brand: "max",
      className:
        "border-[#FF7A1A]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(255,122,26,0.12))] hover:border-[#FF7A1A]/38 hover:shadow-[0_16px_32px_rgba(255,122,26,0.16),inset_0_1px_0_rgba(255,255,255,0.96)]",
    },
    {
      id: "ok",
      label: "РћРґРЅРѕРєР»Р°СЃСЃРЅРёРєРё",
      href: preparedOkUrl ?? "",
      short: "OK",
      brand: "ok",
      className:
        "border-[#EE8208]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(238,130,8,0.12))] hover:border-[#EE8208]/38 hover:shadow-[0_16px_32px_rgba(238,130,8,0.16),inset_0_1px_0_rgba(255,255,255,0.96)]",
    },
  ] satisfies ContactAction[];

  const visibleActions = actions.filter((item) => item.href.trim().length > 0);

  const hasAnyContact = Boolean(
    preparedPhone || preparedWebsiteUrl || preparedEmail || visibleActions.length > 0,
  );

  return (
    <div className="space-y-3">
      {!hasAnyContact ? (
        <p className="text-sm text-olive/60">РљРѕРЅС‚Р°РєС‚С‹ РІР»Р°РґРµР»СЊС†Р° РїРѕРєР° РЅРµ РґРѕР±Р°РІР»РµРЅС‹.</p>
      ) : null}

      {hasAnyContact ? (
        <div className="flex flex-wrap gap-2">
          {preparedPhone ? (
            <button
              type="button"
              onClick={() => setIsPhoneExpanded((value) => !value)}
              title={isPhoneExpanded ? "РЎРєСЂС‹С‚СЊ С‚РµР»РµС„РѕРЅ" : "РџРѕРєР°Р·Р°С‚СЊ С‚РµР»РµС„РѕРЅ"}
              aria-label={isPhoneExpanded ? "РЎРєСЂС‹С‚СЊ С‚РµР»РµС„РѕРЅ" : "РџРѕРєР°Р·Р°С‚СЊ С‚РµР»РµС„РѕРЅ"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-primary/22 bg-[linear-gradient(145deg,rgba(15,118,110,0.98),rgba(14,116,144,0.92))] text-white shadow-[0_16px_32px_rgba(15,118,110,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-terra/30"
            >
              <PhoneIcon />
            </button>
          ) : null}

          {preparedWebsiteUrl ? (
            <ContactIconLink
              label="РЎР°Р№С‚"
              href={preparedWebsiteUrl}
              short="WEB"
              className="border-primary/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(14,116,144,0.10))] text-primary hover:border-primary/32 hover:shadow-[0_16px_30px_rgba(14,116,144,0.14),inset_0_1px_0_rgba(255,255,255,0.96)]"
            >
              {shouldShowWebsiteFavicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={websiteFaviconUrl!}
                  alt=""
                  aria-hidden="true"
                  className="h-4 w-4 rounded-sm object-contain"
                  onError={() => setFailedWebsiteFaviconUrl(websiteFaviconUrl)}
                />
              ) : (
                <GlobeIcon />
              )}
            </ContactIconLink>
          ) : null}

          {preparedEmail ? (
            <a
              href={`mailto:${preparedEmail}`}
              title="Email"
              aria-label="Email"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-terra/14 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(167,101,73,0.10))] text-terra shadow-[0_12px_28px_rgba(167,101,73,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] hover:border-terra/28 hover:shadow-[0_16px_30px_rgba(167,101,73,0.14),inset_0_1px_0_rgba(255,255,255,0.96)] focus:outline-none focus:ring-2 focus:ring-terra/30"
            >
              <MailIcon />
            </a>
          ) : null}

          {visibleActions.map((action) => (
            <ContactIconLink
              key={action.id}
              label={action.label}
              href={action.href}
              short={action.short}
              brand={action.brand}
              className={action.className}
            >
              <ContactBrandMark brand={action.brand} bare className="h-5 w-5" />
            </ContactIconLink>
          ))}
        </div>
      ) : null}

      {preparedPhone && isPhoneExpanded ? (
        <div className="inline-flex max-w-full items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
          <span className="text-olive/70">РўРµР»РµС„РѕРЅ:</span>
          {isLikelyMobile && phoneHref ? (
            <a
              href={phoneHref}
              className="font-semibold text-olive hover:text-terra hover:underline"
            >
              {preparedPhone}
            </a>
          ) : (
            <span className="font-semibold text-olive">{preparedPhone}</span>
          )}
          <button
            type="button"
            onClick={() => setIsPhoneExpanded(false)}
            aria-label="РЎРєСЂС‹С‚СЊ С‚РµР»РµС„РѕРЅ"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-semibold text-olive shadow-sm hover:bg-sand"
          >
            x
          </button>
        </div>
      ) : null}
    </div>
  );
}
