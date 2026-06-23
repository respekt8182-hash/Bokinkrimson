import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Landmark, Route, Sparkles, Trees } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import type { HomeCityShowcaseItem } from "@/lib/home-cities";
import type { StaticAttraction } from "@/lib/static-attractions";
import { attractionsHubPath } from "@/lib/seo/routes";
import { getDailyDateKey, selectDailyItems } from "@/lib/daily-selection";
import { isHomeAttractionCandidate } from "@/lib/home-attractions";

type HomeGuideSectionsProps = {
  cities: HomeCityShowcaseItem[];
  attractions: StaticAttraction[];
};

const cityDescriptions: Record<string, string> = {
  Ялта: "Дворцы, парки, набережные и маршруты Южного берега",
  Севастополь: "История, бухты, музеи и памятные места",
  Керчь: "Античность, крепости, море и военная история",
  Евпатория: "Старый город, архитектура, музеи и прогулочные маршруты",
  Алушта: "Горные маршруты, парки и места у моря",
  Алупка: "Дворцы, старинные парки и виды на Ай-Петри",
  Судак: "Крепость, бухты, тропы и заповедная природа",
  Феодосия: "Музеи, набережная, история и места Восточного Крыма",
};

function attractionSearchHref(query: string): string {
  return `${attractionsHubPath}?q=${encodeURIComponent(query)}`;
}

export function HomeGuideSections({ cities, attractions }: HomeGuideSectionsProps) {
  const attractionCandidates = attractions.filter(isHomeAttractionCandidate);
  const visibleAttractions = selectDailyItems(attractionCandidates, {
    dateKey: getDailyDateKey(),
    selectionKey: "home-attractions-without-beaches",
    limit: 8,
    getId: (item) => item.id,
  });

  return (
    <div className="space-y-10 pb-4 pt-8 sm:space-y-14 sm:pt-12">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl text-midnight sm:text-3xl md:text-4xl">
              Откройте Крым по городам
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-olive/68 sm:text-base">
              Выбирайте город и смотрите достопримечательности, маршруты, исторические места и
              интересные локации рядом.
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cities.slice(0, 8).map((city) => (
            <Link
              key={city.key}
              href={`${attractionsHubPath}?location=${encodeURIComponent(city.locationName)}`}
              prefetch={false}
              className="group relative min-h-64 overflow-hidden rounded-[26px] bg-olive"
            >
              <Image
                src={city.imageSrc}
                alt={`Достопримечательности города ${city.title}`}
                fill
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <h3 className="text-xl font-semibold">{city.title}</h3>
                <p className="mt-1 text-sm leading-5 text-white/78">
                  {cityDescriptions[city.title] ?? "Места, маршруты и интересные локации рядом"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Подборки путеводителя
            </p>
            <h2 className="mt-1 font-heading text-2xl text-midnight sm:text-3xl md:text-4xl">
              Что посмотреть в Крыму
            </h2>
          </div>
          <Link
            href={attractionsHubPath}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/70 bg-white/82 px-4 text-sm font-semibold text-olive shadow-[0_12px_28px_-22px_rgba(58,43,35,0.45)] ring-1 ring-olive/10 backdrop-blur transition hover:bg-primary hover:text-white"
          >
            Все достопримечательности <AppIcon icon={ArrowUpRight} className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { label: "Неочевидный Крым", query: "необычные места", icon: Sparkles },
            { label: "История и культура", query: "история", icon: Landmark },
            { label: "Маршрут выходного дня", query: "маршрут", icon: Route },
            { label: "Новые места", query: "новые места", icon: Trees },
          ].map((item) => (
            <Link
              key={item.label}
              href={attractionSearchHref(item.query)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-olive/10 bg-white px-4 py-2.5 text-sm font-semibold text-olive shadow-sm transition hover:border-primary/30 hover:text-primary"
            >
              <AppIcon icon={item.icon} className="h-4 w-4" /> {item.label}
            </Link>
          ))}
        </div>
        {visibleAttractions.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleAttractions.map((attraction) => {
              const image = attraction.gallery.find(
                (item) => item.url && !item.url.includes("zaglushka"),
              );
              if (!image) return null;
              return (
                <Link
                  key={attraction.id}
                  href={`/attractions/${attraction.slug}`}
                  prefetch={false}
                  className="group flex overflow-hidden rounded-[24px] bg-white shadow-[0_16px_40px_-30px_rgba(58,43,35,0.7)] ring-1 ring-olive/10 sm:flex-col"
                >
                  <div className="relative min-h-40 w-[42%] shrink-0 bg-sand sm:aspect-[4/3] sm:w-full">
                    <Image
                      src={image.url}
                      alt={image.alt || attraction.title}
                      fill
                      sizes="(max-width: 639px) 42vw, (max-width: 1023px) 50vw, 25vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {attraction.category || "Интересное место"}
                    </p>
                    <h3 className="mt-1 line-clamp-2 font-semibold leading-5 text-midnight">
                      {attraction.title}
                    </h3>
                    <p className="mt-1 text-xs text-olive/58">
                      {[attraction.locationName, attraction.districtName]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-olive/70">
                      {attraction.shortDescription || attraction.metaDescription}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-olive/20 bg-white/70 p-8 text-center text-olive/65">
            Новые карточки достопримечательностей скоро появятся здесь.
          </div>
        )}
      </section>
    </div>
  );
}
