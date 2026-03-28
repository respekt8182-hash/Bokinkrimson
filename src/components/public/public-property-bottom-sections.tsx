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
  const [isAmenitiesOpen, setIsAmenitiesOpen] = useState(false);
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

  const hasAmenities = item.amenityGroups.combined.length > 0;

  if (!hasAmenities && item.faqItems.length === 0 && !hasRegistryNumber) {
    return null;
  }

  return (
    <div className="space-y-6">
      {hasAmenities ? (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-olive/10 shadow-[0_12px_30px_rgba(15,118,110,0.08)] md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl text-olive">Удобства и услуги</h2>
              <p className="mt-1 text-sm text-olive/70">
                Показываем ключевые услуги объекта и всех номеров.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAmenitiesOpen(true)}
              className="rounded-full border border-olive/15 bg-cream/60 px-4 py-2 text-sm font-semibold text-olive transition hover:bg-cream"
            >
              Все удобства
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {item.amenityHighlights.map((amenity) => (
              <div
                key={amenity}
                className="rounded-2xl border border-olive/10 bg-cream/45 px-4 py-3 text-sm font-semibold text-olive"
              >
                {amenity}
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
        <section className="relative">
          <button
            type="button"
            onClick={() => setIsRegistryOpen((previous) => !previous)}
            className="inline-flex items-center gap-2 rounded-full border border-olive/12 bg-white px-4 py-2 text-sm font-semibold text-olive shadow-[0_10px_24px_rgba(58,43,35,0.06)] transition hover:bg-cream"
          >
            <span>Объект №{registryNumber}</span>
            <AppIcon icon={CircleHelp} className="h-4 w-4" />
          </button>

          {isRegistryOpen ? (
            <div className="absolute left-0 top-full z-20 mt-3 w-full max-w-xl rounded-3xl border border-olive/12 bg-white p-5 shadow-[0_20px_50px_rgba(58,43,35,0.14)]">
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

      {isAmenitiesOpen ? (
        <div className="fixed inset-0 z-50 bg-midnight/55 p-4">
          <div className="mx-auto max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-olive/10 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl text-olive">Все удобства</h3>
                <p className="mt-1 text-sm text-olive/70">
                  Полный список услуг по объекту и по всем доступным номерам.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAmenitiesOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-olive/12 text-olive/60 transition hover:bg-cream"
                aria-label="Закрыть полный список удобств"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {item.amenityGroups.property.length > 0 ? (
                <div className="rounded-2xl border border-olive/10 bg-cream/45 p-4">
                  <p className="text-sm font-semibold text-olive">На территории объекта</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.amenityGroups.property.map((amenity) => (
                      <span
                        key={`property-${amenity}`}
                        className="rounded-full bg-white px-3 py-1.5 text-xs text-olive/80 ring-1 ring-olive/10"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {item.amenityGroups.rooms.length > 0 ? (
                <div className="rounded-2xl border border-olive/10 bg-cream/45 p-4">
                  <p className="text-sm font-semibold text-olive">В номерах</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.amenityGroups.rooms.map((amenity) => (
                      <span
                        key={`room-${amenity}`}
                        className="rounded-full bg-white px-3 py-1.5 text-xs text-olive/80 ring-1 ring-olive/10"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
