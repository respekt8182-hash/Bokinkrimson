import Link from "next/link";
import { Clock3, Compass, FileText, Heart, MapPin, Phone } from "lucide-react";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { companyConfig } from "@/config/company";
import {
  buildHousingLocationPath,
  excursionsHubPath,
  housingHubPath,
  toursHubPath,
} from "@/lib/seo/routes";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

const navigationLinks = [
  { href: "/about", label: "О сервисе" },
  { href: "/cooperation", label: "Сотрудничество" },
];

const documentLinks = [
  {
    href: "/consent",
    label: "Согласие на обработку персональных данных",
  },
  { href: "/uslugi-i-tarify", label: "Услуги и тарифы" },
  { href: "/legal/privacy", label: "Политика конфиденциальности" },
  { href: "/legal/terms", label: "Пользовательское соглашение" },
  { href: "/oferta", label: "Договор оферты" },
];

const popularLinks = [
  { href: housingHubPath, label: "Жильё в Крыму" },
  { href: buildHousingLocationPath("yalta"), label: "Жильё в Ялте" },
  { href: buildHousingLocationPath("alushta"), label: "Жильё в Алуште" },
  { href: excursionsHubPath, label: "Экскурсии по Крыму" },
  { href: "/excursions/yalta", label: "Экскурсии в Ялте" },
  { href: toursHubPath, label: "Туры по Крыму" },
];

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
  const telegramUrl = normalizeTelegramProfileUrl(
    companyConfig.publicMessengerLinks.telegram,
  );
  const maxUrl = companyConfig.publicMessengerLinks.max.trim() || null;

  return (
    <footer className="relative overflow-hidden border-t border-olive/8 bg-gradient-to-b from-sand/40 to-sand/70">
      <div className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full bg-primary/[0.03] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-terra/[0.04] blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 lg:gap-8">
          <div className="group rounded-2xl border border-olive/[0.06] bg-white/60 px-5 py-3.5 backdrop-blur-sm transition-all duration-300 hover:border-primary/10 hover:bg-white/80 hover:shadow-[0_8px_30px_-12px_rgba(15,118,110,0.08)]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/[0.07]">
                <Compass className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-olive/40">
                Навигация
              </p>
            </div>
            <div className="grid gap-0">
              {navigationLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group/link -mx-2 flex min-h-8 items-center gap-2 rounded-xl px-3 py-1 text-sm text-olive/65 transition-all duration-200 hover:bg-primary/[0.04] hover:text-olive"
                >
                  <span className="h-1 w-1 rounded-full bg-primary/30 transition-all duration-200 group-hover/link:h-1.5 group-hover/link:w-1.5 group-hover/link:bg-primary/60" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="group rounded-2xl border border-olive/[0.06] bg-white/60 px-5 py-3.5 backdrop-blur-sm transition-all duration-300 hover:border-primary/10 hover:bg-white/80 hover:shadow-[0_8px_30px_-12px_rgba(15,118,110,0.08)]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/[0.07]">
                <MapPin className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-olive/40">
                Популярное
              </p>
            </div>
            <div className="grid gap-0">
              {popularLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group/link -mx-2 flex min-h-8 items-center gap-2 rounded-xl px-3 py-1 text-sm text-olive/65 transition-all duration-200 hover:bg-primary/[0.04] hover:text-olive"
                >
                  <span className="h-1 w-1 rounded-full bg-primary/30 transition-all duration-200 group-hover/link:h-1.5 group-hover/link:w-1.5 group-hover/link:bg-primary/60" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="group rounded-2xl border border-olive/[0.06] bg-white/60 px-5 py-3.5 backdrop-blur-sm transition-all duration-300 hover:border-terra/10 hover:bg-white/80 hover:shadow-[0_8px_30px_-12px_rgba(167,101,73,0.08)]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-terra/[0.07]">
                <FileText className="h-3.5 w-3.5 text-terra" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-olive/40">
                Документы
              </p>
            </div>
            <div className="grid gap-0">
              {documentLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group/link -mx-2 flex min-h-8 items-center gap-2 rounded-xl px-3 py-1 text-sm text-olive/65 transition-all duration-200 hover:bg-terra/[0.04] hover:text-olive"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-terra/30 transition-all duration-200 group-hover/link:h-1.5 group-hover/link:w-1.5 group-hover/link:bg-terra/60" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="group rounded-2xl border border-olive/[0.06] bg-white/60 px-5 py-3.5 backdrop-blur-sm transition-all duration-300 hover:border-primary/10 hover:bg-white/80 hover:shadow-[0_8px_30px_-12px_rgba(15,118,110,0.08)]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/[0.07]">
                <Phone className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-olive/40">
                Связь с нами
              </p>
            </div>
            <div className="space-y-2.5">
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="group/link -mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 hover:bg-primary/[0.04]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary">
                    <Phone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-olive">
                      {companyConfig.phone}
                    </span>
                    <span className="block text-xs text-olive/55">Позвонить команде</span>
                  </span>
                </a>
              ) : null}

              {telegramUrl ? (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group/link -mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 hover:bg-primary/[0.04]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#27A7E7]/10">
                    <ContactBrandMark brand="telegram" bare className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-olive">Telegram</span>
                    <span className="block truncate text-xs text-olive/55">@Krymvokrug</span>
                  </span>
                </a>
              ) : null}

              {maxUrl ? (
                <a
                  href={maxUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group/link -mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 hover:bg-primary/[0.04]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF7A1A]/10">
                    <ContactBrandMark brand="max" bare className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-olive">Max</span>
                    <span className="block text-xs text-olive/55">Быстрая связь с командой</span>
                  </span>
                </a>
              ) : null}

              <div className="-mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-terra/[0.08] text-terra">
                  <Clock3 className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-olive">Время работы</span>
                  <span className="block text-xs text-olive/55">
                    {companyConfig.workingHoursLabel}
                  </span>
                </span>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-olive/[0.06] pt-8 text-center">
          <p className="flex items-center gap-1.5 text-xs text-olive/35">
            Сделано с <Heart className="inline h-3 w-3 fill-terra/40 text-terra/50" /> в Крыму
          </p>
          <p className="text-xs text-olive/25">&copy; {year} {companyConfig.brandName}</p>
        </div>
      </div>
    </footer>
  );
}
