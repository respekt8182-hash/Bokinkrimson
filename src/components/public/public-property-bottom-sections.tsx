"use client";

// Client component for public property bottom sections in the public module.
import { CircleHelp, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ExcursionFaq } from "@/components/excursions/excursion-faq";
import { AppIcon } from "@/components/ui/app-icon";
import type { PublicPropertyCard } from "@/lib/public-properties";

type PublicPropertyBottomSectionsProps = {
  item: Pick<PublicPropertyCard, "amenityHighlights" | "amenityGroups" | "faqItems" | "classification">;
};

export function PublicPropertyBottomSections({ item }: PublicPropertyBottomSectionsProps) {
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  const registryNumber = item.classification.registryNumber?.trim() ?? "";
  const hasRegistryNumber = registryNumber.length > 0;
  const registryLink = useMemo(() => {
    const rawValue = item.classification.registryDetails?.trim() ?? "";
    if (/^https?:\/\//i.test(rawValue)) {
      return rawValue;
    }

    return "https://tourism.fsa.gov.ru/";
  }, [item.classification.registryDetails]);

  if (item.faqItems.length === 0 && !hasRegistryNumber) {
    return null;
  }

  return (
    <div className="space-y-6">
      {item.faqItems.length > 0 ? (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-olive/10 shadow-[0_12px_30px_rgba(15,118,110,0.08)] md:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <AppIcon icon={Sparkles} className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl text-olive">Часто задаваемые вопросы</h2>
              <p className="mt-1 text-sm text-olive/70">
                Короткие ответы на самые частые вопросы по объекту.
              </p>
            </div>
          </div>
          <ExcursionFaq items={item.faqItems} />
        </section>
      ) : null}

      {hasRegistryNumber ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setIsRegistryOpen((previous) => !previous)}
            className="inline-flex items-center gap-2 rounded-full border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive shadow-[0_10px_24px_rgba(58,43,35,0.06)] transition hover:bg-cream"
          >
            <span>Объект №{registryNumber}</span>
            <AppIcon icon={CircleHelp} className="h-4 w-4" />
          </button>

          {isRegistryOpen ? (
            <div className="w-full max-w-xl rounded-3xl border border-olive/12 bg-white p-5 shadow-[0_20px_50px_rgba(58,43,35,0.14)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-olive">Этот объект прошёл классификацию</p>
                  <p className="mt-2 text-sm text-olive/72">
                    Номер записи в реестре: <span className="font-semibold text-olive">{registryNumber}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegistryOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/12 text-olive/60 transition hover:bg-cream"
                  aria-label="Закрыть сведения о классификации"
                >
                  <AppIcon icon={X} className="h-4 w-4" />
                </button>
              </div>

              <a
                href={registryLink}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                Подробнее в реестре классифицированных средств размещения
              </a>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
