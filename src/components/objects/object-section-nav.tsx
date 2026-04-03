import {
  UnifiedStepper,
  type UnifiedStepIconName,
  type UnifiedStepTone,
} from "@/components/ui/unified-stepper";
import { db } from "@/lib/db";
import { getPropertyProgress } from "@/lib/properties";

type SectionSlug = "about" | "rules" | "room-categories" | "amenities" | "chessboard" | "payment";

type ObjectSectionNavProps = {
  propertyId: string;
  activeSection: SectionSlug;
  basePath?: string;
  backHref?: string;
  backLabel?: string;
  includePayment?: boolean;
  showChessboardTab?: boolean;
};

type SectionItem = {
  slug: SectionSlug;
  label: string;
  iconName?: UnifiedStepIconName;
  tone?: UnifiedStepTone;
  hiddenInTabs?: boolean;
};

const sections: SectionItem[] = [
  {
    slug: "about",
    label: "\u041e\u0431\u044a\u0435\u043a\u0442",
    iconName: "building",
    tone: "teal",
  },
  {
    slug: "rules",
    label: "\u041f\u0440\u0430\u0432\u0438\u043b\u0430",
    iconName: "shield-check",
    tone: "sky",
  },
  {
    slug: "room-categories",
    label: "\u041d\u043e\u043c\u0435\u0440\u0430",
    iconName: "bed-double",
    tone: "terra",
  },
  {
    slug: "amenities",
    label: "\u0423\u0434\u043e\u0431\u0441\u0442\u0432\u0430",
    iconName: "sparkles",
    tone: "emerald",
  },
  {
    slug: "payment",
    label: "\u041e\u043f\u043b\u0430\u0442\u0430",
    iconName: "wallet-cards",
    tone: "gold",
  },
  {
    slug: "chessboard",
    label: "\u0428\u0430\u0445\u043c\u0430\u0442\u043a\u0430",
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
  backLabel = "Все объекты",
  includePayment = true,
  showChessboardTab = false,
}: ObjectSectionNavProps) {
  const availableSections = sections.filter(
    (section) => includePayment || section.slug !== "payment",
  );
  const activeIndex = availableSections.findIndex((section) => section.slug === activeSection);
  const currentStep = activeIndex >= 0 ? activeIndex : 0;

  const visibleSections = availableSections.filter(
    (section) => showChessboardTab || !section.hiddenInTabs,
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
          .findLast((section) => showChessboardTab || !section.hiddenInTabs)
      : null;
  const nextSection =
    activeIndex >= 0 && activeIndex < availableSections.length - 1
      ? availableSections
          .slice(activeIndex + 1)
          .find((section) => showChessboardTab || !section.hiddenInTabs)
      : null;

  const steps = visibleSections.map((section) => {
    const isComplete = completionBySection?.[section.slug] ?? completionFallback[section.slug];

    return {
      label: section.label,
      status: isComplete ? ("complete" as const) : ("incomplete" as const),
      done: section.slug !== activeSection && isComplete,
      showCompletionBadge: isComplete,
      href: `${basePath}/${propertyId}/${section.slug}`,
      iconName: section.iconName,
      tone: section.tone,
    };
  });

  return (
    <nav className="rounded-[28px] border border-olive/8 bg-white/95 p-2.5 shadow-[0_18px_36px_-28px_rgba(15,74,64,0.35)] sm:p-4">
      <UnifiedStepper
        steps={steps}
        currentStep={visibleActiveIndex >= 0 ? visibleActiveIndex : 0}
        showProgress={false}
        nav={{
          backHref,
          backLabel,
          prevHref: prevSection
            ? `${basePath}/${propertyId}/${prevSection.slug}`
            : undefined,
          prevLabel: prevSection?.label,
          nextHref: nextSection
            ? `${basePath}/${propertyId}/${nextSection.slug}`
            : undefined,
          nextLabel: nextSection?.label,
          counter: `${currentStep + 1}/${visibleSections.length}`,
        }}
      />
    </nav>
  );
}
