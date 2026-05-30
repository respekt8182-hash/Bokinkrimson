import {
  BedDouble,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  MessageSquareText,
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
    slug: "about",
    label: "Основное",
    description: "Тип, локация, контакты, фото",
    icon: Building2,
    tone: "primary",
  },
  {
    slug: "rules",
    label: "Правила",
    description: "Заезд, выезд, условия проживания",
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
    description: "Что есть в номерах",
    icon: Sparkles,
    tone: "emerald",
  },
  {
    slug: "payment",
    label: "Оплата",
    description: "Публикация объявления",
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

const toneClassByName: Record<SectionItem["tone"], { active: string; idle: string; icon: string }> = {
  primary: {
    active: "border-primary/30 bg-primary/8 text-primary",
    idle: "border-primary/10 bg-primary/7 text-primary/72",
    icon: "bg-primary/10 text-primary",
  },
  sky: {
    active: "border-sky-300/70 bg-sky-50 text-sky-700",
    idle: "border-sky-200/55 bg-sky-50/55 text-sky-700/72",
    icon: "bg-sky-100 text-sky-700",
  },
  terra: {
    active: "border-terra/28 bg-terra/8 text-terra",
    idle: "border-terra/12 bg-terra/6 text-terra/75",
    icon: "bg-terra/10 text-terra",
  },
  emerald: {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    idle: "border-emerald-100 bg-emerald-50/60 text-emerald-700/75",
    icon: "bg-emerald-100 text-emerald-700",
  },
  gold: {
    active: "border-sage/36 bg-sage/16 text-amber-800",
    idle: "border-sage/18 bg-sage/10 text-amber-800/75",
    icon: "bg-sage/18 text-amber-800",
  },
};

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
    progress.step1 &&
    progress.step3 &&
    progress.step4 &&
    progress.step5 &&
    progress.step7 &&
    progress.step8;

  return {
    about: aboutDone,
    rules: progress.step6,
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
      (includePayment || section.slug !== "payment") &&
      (shouldIncludeExternalReviews || section.slug !== "external-reviews"),
  );
  const activeIndex = availableSections.findIndex((section) => section.slug === activeSection);
  const visibleSections = availableSections.filter(
    (section) => shouldShowChessboardTab || !section.hiddenInTabs,
  );
  const visibleActiveIndex = visibleSections.findIndex((section) => section.slug === activeSection);
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

    return {
      ...section,
      complete: isComplete,
      href: `${basePath}/${propertyId}/${section.slug}`,
    };
  });
  const completedCount = steps.filter((step) => step.complete).length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <nav
      aria-label="Разделы объявления"
      className="min-w-0 lg:sticky lg:top-20 lg:self-start"
    >
      <div className="min-w-0 rounded-2xl border border-olive/10 bg-white/95 p-3 shadow-[0_18px_36px_-30px_rgba(15,74,64,0.34)]">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-olive/58 transition hover:bg-cream hover:text-olive"
        >
          <AppIcon icon={ChevronLeft} className="h-4 w-4" />
          {backLabel}
        </Link>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 text-xs text-olive/55">
            <span>Заполнено</span>
            <span className="font-semibold text-primary">{completedCount}/{steps.length}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-olive/8">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="custom-scrollbar -mx-1 mt-3 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1.5 lg:overflow-visible lg:px-0 lg:pb-0">
          {steps.map((step, index) => {
            const isActive = step.slug === activeSection;
            const StepIcon = step.icon;
            const toneClasses = toneClassByName[step.tone];

            return (
              <Link
                key={step.slug}
                href={step.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex min-w-[188px] items-center gap-2.5 rounded-xl border px-3 py-2.5 transition lg:min-w-0",
                  isActive
                    ? cn(toneClasses.active, "shadow-sm")
                    : "border-olive/10 bg-white text-olive hover:border-primary/20 hover:bg-cream/50",
                )}
              >
                <span
                  className={cn(
                    "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    isActive ? toneClasses.icon : "bg-olive/6 text-olive/55 group-hover:bg-primary/8 group-hover:text-primary",
                  )}
                >
                  <AppIcon icon={StepIcon} className="h-[18px] w-[18px]" />
                  {step.complete ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white">
                      <AppIcon icon={Check} className="h-2.5 w-2.5" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-olive/40">{index + 1}</span>
                    <span className="truncate text-sm font-semibold">{step.label}</span>
                  </span>
                  <span className="mt-0.5 hidden text-xs leading-snug text-olive/54 sm:block">
                    {step.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-3 hidden grid-cols-2 gap-2 border-t border-olive/8 pt-3 sm:grid">
          {prevSection ? (
            <Link
              href={`${basePath}/${propertyId}/${prevSection.slug}`}
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
              href={`${basePath}/${propertyId}/${nextSection.slug}`}
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
