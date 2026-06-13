import {
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  LayoutGrid,
  MessageSquareText,
  MapPin,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { getPropertyProgress } from "@/lib/properties";

type SectionSlug =
  | "about-info"
  | "about-location"
  | "about"
  | "rules"
  | "room-categories"
  | "external-reviews"
  | "amenities"
  | "chessboard"
  | "payment";

type ObjectSectionNavProps = {
  propertyId: string;
  activeSection: SectionSlug;
  basePath?: string;
  backHref?: string;
  backLabel?: string;
  includePayment?: boolean;
  includeExternalReviews?: boolean;
  showChessboardTab?: boolean;
};

type SectionItem = {
  slug: SectionSlug;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: "primary" | "sky" | "terra" | "emerald" | "gold";
  hiddenInTabs?: boolean;
};

const sections: SectionItem[] = [
  {
    slug: "about-info",
    label: "Основное",
    description: "Расскажите о вашем объекте и его особенностях",
    icon: MessageSquareText,
    tone: "primary",
  },
  {
    slug: "about-location",
    label: "Локация",
    description: "Адрес и карта",
    icon: MapPin,
    tone: "primary",
    hiddenInTabs: true,
  },
  {
    slug: "rules",
    label: "Правила размещения",
    description: "Условия и реестр",
    icon: ShieldCheck,
    tone: "sky",
  },
  {
    slug: "room-categories",
    label: "Номера",
    description: "Категории, фото, цены",
    icon: BedDouble,
    tone: "terra",
  },
  {
    slug: "external-reviews",
    label: "Отзывы",
    description: "Отзывы с других сайтов",
    icon: MessageSquareText,
    tone: "sky",
  },
  {
    slug: "amenities",
    label: "Удобства",
    description: "Что есть на объекте",
    icon: Sparkles,
    tone: "emerald",
  },
  {
    slug: "payment",
    label: "Оплата",
    description: "Настройте оплату и правила предоплаты",
    icon: WalletCards,
    tone: "gold",
  },
  {
    slug: "chessboard",
    label: "Шахматка",
    description: "Календарь занятости",
    icon: LayoutGrid,
    tone: "primary",
    hiddenInTabs: true,
  },
];

async function getSectionCompletion(
  propertyId: string,
): Promise<Record<SectionSlug, boolean> | null> {
  const [property, enabledRoomAmenitiesCount] = await Promise.all([
    db.property.findUnique({
      where: { id: propertyId },
      select: {
        type: true,
        locationId: true,
        locationName: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        phone: true,
        description: true,
        checkInFrom: true,
        checkOutUntil: true,
        childrenAllowed: true,
        childrenMinAge: true,
        petsPolicy: true,
        smokingPolicy: true,
        quietHoursEnabled: true,
        quietHoursFrom: true,
        quietHoursTo: true,
        classificationApplicable: true,
        starRating: true,
        registryNumber: true,
        registryNumberPending: true,
        selfAssessmentPassed: true,
        media: {
          where: { roomId: null },
          select: {
            id: true,
            type: true,
            url: true,
            sortOrder: true,
          },
        },
        rooms: {
          where: { isActive: true },
          select: {
            id: true,
            prices: {
              select: { id: true },
            },
          },
        },
        amenities: {
          include: {
            amenity: {
              select: { id: true, name: true, category: true },
            },
          },
        },
        customAmenities: {
          select: { name: true },
        },
      },
    }),
    db.objectRoomAmenitySetting.count({
      where: {
        propertyId,
        enabled: true,
      },
    }),
  ]);

  if (!property) {
    return null;
  }

  const progress = getPropertyProgress(property);
  const aboutDone =
    progress.step1 && progress.step3 && progress.step4 && progress.step5 && progress.step8;

  return {
    about: aboutDone,
    "about-info": aboutDone,
    "about-location": progress.step3,
    rules: progress.step6 && progress.step7,
    "room-categories": progress.step9,
    "external-reviews": true,
    amenities: enabledRoomAmenitiesCount > 0,
    payment: progress.step10,
    chessboard: progress.step10,
  };
}

export async function ObjectSectionNav({
  propertyId,
  activeSection,
  basePath = "/dashboard/objects",
  backHref = basePath,
  backLabel = "Вся недвижимость",
  includePayment = true,
  includeExternalReviews,
  showChessboardTab = false,
}: ObjectSectionNavProps) {
  const shouldIncludeExternalReviews =
    includeExternalReviews ?? activeSection === "external-reviews";
  const shouldShowChessboardTab = showChessboardTab || activeSection === "chessboard";
  const availableSections = sections.filter(
    (section) =>
      section.slug !== "about" &&
      (includePayment || section.slug !== "payment") &&
      (shouldIncludeExternalReviews || section.slug !== "external-reviews"),
  );
  const normalizedActiveSection: SectionSlug =
    activeSection === "about" || activeSection === "about-location" ? "about-info" : activeSection;
  const activeIndex = availableSections.findIndex(
    (section) => section.slug === normalizedActiveSection,
  );
  const visibleSections = availableSections.filter(
    (section) => shouldShowChessboardTab || !section.hiddenInTabs,
  );
  const visibleActiveIndex = visibleSections.findIndex(
    (section) => section.slug === normalizedActiveSection,
  );
  const completionBySection = await getSectionCompletion(propertyId);

  const completionFallback = Object.fromEntries(
    visibleSections.map((section, index) => [section.slug, index < visibleActiveIndex]),
  ) as Record<string, boolean>;

  const prevSection =
    activeIndex > 0
      ? availableSections
          .slice(0, activeIndex)
          .findLast((section) => shouldShowChessboardTab || !section.hiddenInTabs)
      : null;
  const nextSection =
    activeIndex >= 0 && activeIndex < availableSections.length - 1
      ? availableSections
          .slice(activeIndex + 1)
          .find((section) => shouldShowChessboardTab || !section.hiddenInTabs)
      : null;

  const steps = visibleSections.map((section) => {
    const isComplete = completionBySection?.[section.slug] ?? completionFallback[section.slug];
    const href =
      section.slug === "about-info"
        ? `${basePath}/${propertyId}/about?block=info`
        : section.slug === "about-location"
          ? `${basePath}/${propertyId}/about?block=location`
          : `${basePath}/${propertyId}/${section.slug}`;

    return {
      ...section,
      complete: isComplete,
      href,
    };
  });
  const completedCount = steps.filter((step) => step.complete).length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <nav aria-label="Разделы объявления" className="min-w-0 lg:sticky lg:top-32 lg:self-start">
      <div className="min-w-0 rounded-[8px] border border-olive/10 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3 border-b border-olive/8 pb-5">
          <div>
            <p className="text-base font-semibold text-olive">Создание объекта</p>
            <p className="mt-1 text-xs text-olive/52">
              Заполнено {completedCount}/{steps.length} · {progressPercent}%
            </p>
          </div>
          <Link
            href={backHref}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-olive/10 bg-white text-olive/58 transition hover:border-primary/25 hover:text-primary"
            aria-label={backLabel}
            title={backLabel}
          >
            <AppIcon icon={ChevronLeft} className="h-4 w-4" />
          </Link>
        </div>

        <div className="custom-scrollbar -mx-1 mt-5 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 lg:pb-0">
          {steps.map((step, index) => {
            const isActive = step.slug === normalizedActiveSection;
            const StepIcon = step.icon;

            return (
              <Link
                key={step.slug}
                href={step.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex min-w-[226px] items-center gap-4 rounded-[8px] border px-4 py-4 transition lg:min-w-0",
                  isActive
                    ? "border-primary/28 bg-[linear-gradient(90deg,rgba(15,118,110,0.1),rgba(255,255,255,0.92))] text-primary shadow-[0_12px_36px_rgba(15,118,110,0.08)] ring-1 ring-primary/12"
                    : "border-transparent bg-white text-olive hover:border-primary/18 hover:bg-foam/45",
                )}
              >
                <span
                  className={cn(
                    "relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                    isActive
                      ? "border-primary bg-primary text-white"
                      : step.complete
                        ? "border-primary/22 bg-primary/10 text-primary"
                        : "border-olive/12 bg-white text-olive/65 group-hover:border-primary/22 group-hover:text-primary",
                  )}
                >
                  {step.complete && !isActive ? (
                    <AppIcon icon={Check} className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <AppIcon
                      icon={StepIcon}
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-primary" : "text-primary/72",
                      )}
                    />
                    <span className="truncate text-base font-semibold text-olive">
                      {step.label}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-sm leading-snug text-olive/54">
                    {step.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-7 rounded-[8px] border border-primary/12 bg-foam/70 p-4 text-primary">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
              <AppIcon icon={CircleHelp} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Нужна помощь?</p>
              <Link
                href="/cooperation"
                className="mt-1 inline-flex items-center gap-1 text-sm text-primary/85 hover:text-primary"
              >
                Посмотрите инструкцию
                <AppIcon icon={ChevronRight} className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 hidden grid-cols-2 gap-2 border-t border-olive/8 pt-4 sm:grid">
          {prevSection ? (
            <Link
              href={
                prevSection.slug === "about-info"
                  ? `${basePath}/${propertyId}/about?block=info`
                  : prevSection.slug === "about-location"
                    ? `${basePath}/${propertyId}/about?block=location`
                    : `${basePath}/${propertyId}/${prevSection.slug}`
              }
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-olive/12 bg-white text-sm font-semibold text-olive/70 transition hover:bg-cream hover:text-olive"
            >
              <AppIcon icon={ChevronLeft} className="h-4 w-4" />
              Назад
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center justify-center rounded-xl border border-dashed border-olive/10 text-sm font-semibold text-olive/30">
              Назад
            </span>
          )}
          {nextSection ? (
            <Link
              href={
                nextSection.slug === "about-info"
                  ? `${basePath}/${propertyId}/about?block=info`
                  : nextSection.slug === "about-location"
                    ? `${basePath}/${propertyId}/about?block=location`
                    : `${basePath}/${propertyId}/${nextSection.slug}`
              }
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Далее
              <AppIcon icon={ChevronRight} className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center justify-center rounded-xl bg-olive/8 text-sm font-semibold text-olive/40">
              Готово
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
