import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Compass,
  FileText,
  Heart,
  MessageCircle,
  Phone,
} from "lucide-react";
import { CookieSettingsButton } from "@/components/legal/cookie-consent-banner";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { companyConfig } from "@/config/company";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

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

export function SiteFooter() {
  const year = new Date().getFullYear();
  const phoneHref = normalizePhoneHref(companyConfig.phone);
  const telegramUrl = normalizeTelegramProfileUrl(companyConfig.publicMessengerLinks.telegram);
  const maxUrl = companyConfig.publicMessengerLinks.max.trim() || null;
  const infoLinks = [
    { href: `mailto:${companyConfig.supportEmail}`, label: "Связаться с нами" },
  ];

  return (
    <footer className="site-footer border-t border-olive/10 bg-[#f4efe7]">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 md:py-7 lg:px-8">
        <div className="rounded-2xl border border-olive/10 bg-white/58 px-4 py-5 shadow-[0_18px_50px_-44px_rgba(58,43,35,0.42)] md:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(280px,1.2fr)_0.9fr] lg:gap-10">
            <section aria-labelledby="footer-brand">
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35"
                aria-label={`${companyConfig.brandName}, на главную`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Compass className="h-4 w-4" />
                </span>
                <span>
                  <span id="footer-brand" className="block text-base font-semibold text-olive">
                    {companyConfig.brandName}
                  </span>
                </span>
              </Link>

              <address className="mt-4 space-y-3 not-italic">
                {phoneHref ? (
                  <a
                    href={phoneHref}
                    className="group inline-flex items-center gap-2.5 rounded-xl py-1 pr-3 text-olive transition duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Phone className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-base font-semibold leading-tight">
                        {companyConfig.phone}
                      </span>
                      <span className="block text-xs text-olive/52">Позвонить команде</span>
                    </span>
                  </a>
                ) : null}

                <div className="flex items-center gap-2.5 text-sm text-olive/62">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/10 text-terra">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold text-olive">Время работы</span>
                    <span>{companyConfig.workingHoursLabel}</span>
                  </span>
                </div>
              </address>

              <div className="mt-4 flex flex-wrap gap-2" aria-label="Мессенджеры">
                {telegramUrl ? (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-3 text-sm font-semibold text-olive transition duration-200 hover:border-primary/25 hover:bg-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35"
                    aria-label="Написать в Telegram"
                  >
                    <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                    Telegram
                  </a>
                ) : null}
                {maxUrl ? (
                  <a
                    href={maxUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-terra/15 bg-white/70 px-3 text-sm font-semibold text-olive transition duration-200 hover:border-terra/25 hover:bg-white hover:text-terra focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35"
                    aria-label="Написать в Max"
                  >
                    <ContactBrandMark brand="max" bare className="h-4 w-4" />
                    Max
                  </a>
                ) : null}
              </div>
            </section>

            <nav aria-labelledby="footer-help">
              <h2
                id="footer-help"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-olive/45"
              >
                Помощь
              </h2>
              <ul className="mt-3 grid gap-1.5">
                <li>
                  <Link
                    href="/documents"
                    prefetch={false}
                    className="group flex min-h-10 items-center justify-between gap-3 rounded-xl border border-olive/10 bg-white/58 px-3 text-sm font-semibold text-olive/72 transition duration-200 hover:border-terra/20 hover:bg-white/82 hover:text-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4 text-terra" />
                      Все документы
                    </span>
                    <ArrowRight className="h-4 w-4 text-olive/38 transition duration-200 group-hover:translate-x-1 group-hover:text-terra" />
                  </Link>
                </li>
                <li>
                  <CookieSettingsButton className="flex min-h-10 w-full items-center rounded-xl border border-olive/10 bg-white/58 px-3 text-left text-sm font-semibold text-olive/72 transition duration-200 hover:border-terra/20 hover:bg-white/82 hover:text-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35" />
                </li>
                {infoLinks.map((item) => (
                  <li key={item.href}>
                    {item.href.startsWith("mailto:") ? (
                      <a
                        href={item.href}
                        className="group flex min-h-10 items-center justify-between gap-3 rounded-xl border border-olive/10 bg-white/58 px-3 text-sm font-semibold text-olive/72 transition duration-200 hover:border-terra/20 hover:bg-white/82 hover:text-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/35"
                      >
                        <span className="inline-flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          {item.label}
                        </span>
                        <ArrowRight className="h-4 w-4 text-olive/38 transition duration-200 group-hover:translate-x-1 group-hover:text-terra" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-olive/10 pt-4 text-xs text-olive/52 md:flex-row md:items-center md:justify-between">
            <p>
              &copy; {year} {companyConfig.brandName}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-olive/38">
                Сделано с <Heart className="h-3.5 w-3.5 fill-terra/35 text-terra/55" /> в Крыму
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
