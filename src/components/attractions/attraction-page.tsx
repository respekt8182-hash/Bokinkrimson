import type { ReactNode } from "react";
import { Camera, CircleAlert, Clock3, Compass, MapPin, Sparkles } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import {
  attractionTemplateRegistry,
  determineAttractionTemplate,
  type AttractionTemplateInput,
} from "@/lib/attraction-templates";
import { getSmartAttractionFaq, normalizeAttractionText, uniqueAttractionTexts } from "@/lib/normalize-attraction-text";

type Fact = { label: string; value: string };
type Section = { title: string; body: string[]; list?: string[] };
type FaqItem = { question: string; answer: string };

export type AttractionPagePlace = AttractionTemplateInput & {
  id: string;
  category: string | null;
  locationName: string | null;
  districtName: string | null;
  address: string | null;
  shortDescription: string | null;
  description: string | null;
  tags: string[];
  facts: Fact[];
  sections: Section[];
  nearby: string[];
  faq: FaqItem[];
};

function GuideSection({
  id,
  title,
  icon,
  children,
}: {
  id?: string;
  title: string;
  icon: typeof Sparkles;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-[132px] rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(58,43,35,0.08)] sm:p-6 md:scroll-mt-[152px]"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/8 text-primary">
          <AppIcon icon={icon} className="h-5 w-5" />
        </span>
        <h2 className="font-heading text-xl font-semibold text-olive">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function findFact(facts: Fact[], pattern: RegExp): Fact | undefined {
  return facts.find((fact) => pattern.test(fact.label));
}

export function AttractionFacts({ place }: { place: AttractionPagePlace }) {
  const templateType = determineAttractionTemplate(place);
  const template = attractionTemplateRegistry[templateType];
  const location = [place.locationName, place.districtName].filter(Boolean).join(", ");
  const configured: Fact[] = [
    { label: "Тип места", value: template.label },
    ...(location ? [{ label: "Где находится", value: location }] : []),
    ...(place.address ? [{ label: "Ориентир", value: place.address }] : []),
  ];
  const preferred = [
    findFact(place.facts, /время|длитель/iu),
    findFact(place.facts, /сезон|лучшее время/iu),
    findFact(place.facts, /формат|посещен/iu),
    findFact(place.facts, /вход|режим|огранич/iu),
  ].filter((fact): fact is Fact => Boolean(fact));
  const facts = [...configured, ...preferred]
    .filter((fact, index, all) => all.findIndex((entry) => entry.label === fact.label) === index)
    .slice(0, 6);

  return (
    <GuideSection id="overview" title="Главное" icon={Compass}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <div key={`${fact.label}-${fact.value}`} className="rounded-2xl bg-cream/72 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/42">
              {fact.label}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-olive">
              {normalizeAttractionText(fact.value)}
            </p>
          </div>
        ))}
      </div>
    </GuideSection>
  );
}

export function AttractionHighlights({ place }: { place: AttractionPagePlace }) {
  const template = attractionTemplateRegistry[determineAttractionTemplate(place)];
  return (
    <GuideSection title="Что посмотреть и сделать" icon={Sparkles}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {template.highlights.map((highlight, index) => (
          <div key={highlight} className="flex gap-3 rounded-2xl border border-olive/8 bg-cream/55 p-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">
              {index + 1}
            </span>
            <p className="text-sm font-semibold leading-6 text-olive">{highlight}</p>
          </div>
        ))}
      </div>
    </GuideSection>
  );
}

export function VisitPlanner({ place }: { place: AttractionPagePlace }) {
  const template = attractionTemplateRegistry[determineAttractionTemplate(place)];
  const scenarios = template.planner.filter((entry) => !entry.needsNearby || place.nearby.length > 0);
  return (
    <div id="visit-planner" className="scroll-mt-[132px] md:scroll-mt-[152px]">
      <GuideSection title="Как спланировать визит" icon={Clock3}>
        <div className="grid gap-3 md:grid-cols-3">
          {scenarios.map((scenario) => (
            <div key={scenario.duration} className="rounded-2xl border border-primary/12 bg-primary/[0.035] p-4">
              <p className="text-sm font-bold text-primary">Если есть {scenario.duration.toLocaleLowerCase("ru-RU")}</p>
              <p className="mt-2 text-sm leading-6 text-olive/68">{scenario.text}</p>
            </div>
          ))}
        </div>
      </GuideSection>
    </div>
  );
}

export function PhotoTips({ place }: { place: AttractionPagePlace }) {
  const tips = attractionTemplateRegistry[determineAttractionTemplate(place)].photoTips;
  return (
    <GuideSection title="Фототочки" icon={Camera}>
      <div className="flex flex-wrap gap-2">
        {tips.map((tip) => (
          <span key={tip} className="rounded-full border border-olive/10 bg-cream/72 px-4 py-2 text-sm font-semibold text-olive">
            {tip}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-olive/58">Учитывайте правила съёмки на территории и не заходите ради кадра на закрытые или опасные участки.</p>
    </GuideSection>
  );
}

export function ImportantToKnow({ place }: { place: AttractionPagePlace }) {
  const tips = attractionTemplateRegistry[determineAttractionTemplate(place)].important;
  return (
    <GuideSection title="Важно знать" icon={CircleAlert}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tips.map((tip) => (
          <li key={tip} className="rounded-2xl bg-cream/65 px-4 py-3 text-sm leading-6 text-olive/72">{tip}</li>
        ))}
      </ul>
    </GuideSection>
  );
}

export function SmartFAQ({ place, comparedText = "" }: { place: AttractionPagePlace; comparedText?: string }) {
  const items = getSmartAttractionFaq(place.faq, comparedText);
  if (items.length === 0) return null;

  return (
    <GuideSection id="faq" title="Частые вопросы" icon={CircleAlert}>
      <div className="space-y-2">
        {items.map((item) => (
          <details key={item.question} className="group rounded-2xl border border-olive/10 bg-cream/60 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-olive marker:hidden">{item.question}</summary>
            <p className="mt-3 text-sm leading-6 text-olive/68">{item.answer}</p>
          </details>
        ))}
      </div>
    </GuideSection>
  );
}

function WhyVisit({ place }: { place: AttractionPagePlace }) {
  const template = attractionTemplateRegistry[determineAttractionTemplate(place)];
  const whySections = place.sections.filter((section) => /почему|стоит|об объекте|описание/iu.test(section.title));
  const paragraphs = uniqueAttractionTexts([
    place.description,
    ...whySections.flatMap((section) => section.body),
  ]).slice(0, 3);
  const content = paragraphs.length > 0 ? paragraphs : [template.fallback];
  return (
    <GuideSection id="details" title="Почему сюда едут" icon={Sparkles}>
      <div className="space-y-3 text-sm leading-7 text-olive/72 md:text-base">
        {content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
    </GuideSection>
  );
}

function ExistingDetails({ place }: { place: AttractionPagePlace }) {
  const sections = place.sections.filter((section) => !/почему|стоит|практич|что посмотреть рядом|рядом/iu.test(section.title));
  if (sections.length === 0) return null;
  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const body = uniqueAttractionTexts(section.body);
        const list = uniqueAttractionTexts(section.list ?? []);
        if (body.length === 0 && list.length === 0) return null;
        return (
          <GuideSection key={section.title} title={normalizeAttractionText(section.title)} icon={MapPin}>
            <div className="space-y-3 text-sm leading-7 text-olive/72 md:text-base">
              {body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {list.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {list.map((entry) => <li key={entry} className="rounded-2xl bg-cream/72 px-4 py-3 text-sm font-semibold text-olive">{entry}</li>)}
                </ul>
              ) : null}
            </div>
          </GuideSection>
        );
      })}
    </div>
  );
}

export function AttractionPage({
  place,
  mobileHeader,
  reportAction,
  mapSection,
}: {
  place: AttractionPagePlace;
  mobileHeader?: ReactNode;
  reportAction?: ReactNode;
  mapSection?: ReactNode;
}) {
  const comparedText = [place.description, ...place.sections.flatMap((section) => section.body)].join(" ");
  return (
    <div className="space-y-5" data-attraction-template={determineAttractionTemplate(place)}>
      {mobileHeader}
      <AttractionFacts place={place} />
      {reportAction}
      <WhyVisit place={place} />
      <AttractionHighlights place={place} />
      <VisitPlanner place={place} />
      <PhotoTips place={place} />
      <ImportantToKnow place={place} />
      <ExistingDetails place={place} />
      {mapSection}
      <SmartFAQ place={place} comparedText={comparedText} />
    </div>
  );
}
