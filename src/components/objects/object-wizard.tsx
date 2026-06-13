"use client";

import type { PetsPolicy, SmokingPolicy } from "@prisma/client";
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  CircleX,
  ClipboardList,
  FileText,
  ImageIcon,
  Info,
  ListChecks,
  MapPin,
  MoreVertical,
  Plus,
  Save,
  Sparkles,
  Star,
  TriangleAlert,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { type TextareaHTMLAttributes, useEffect, useMemo, useRef, useState } from "react";
import { PropertyMediaManager } from "@/components/media/property-media-manager";
import { YandexMapPicker } from "@/components/maps/yandex-map-picker";
import { PropertyRulesExtraFields } from "@/components/objects/property-rules-extra-fields";
import { PlacementPromoNotice } from "@/components/pricing/placement-promo";
import { RoomAmenitiesManager } from "@/components/rooms/room-amenities-manager";
import { RoomFundManager } from "@/components/rooms/room-fund-manager";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyTypeIcon } from "@/components/ui/property-type-icon";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/cn";
import {
  crimeaLocations,
  getPlacementPricingGroupByType,
  normalizePropertyTypeId,
  placementPricingGroupInfo,
  petsPolicyOptions,
  propertyTypes,
  propertyTypeById,
  smokingPolicyOptions,
} from "@/lib/constants";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import type { SerializedProperty } from "@/lib/properties";
import type { SerializedRoom } from "@/lib/rooms";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";

// Owner object editor:
// - renders object tabs
// - persists draft sections via PATCH /api/properties/[id]
// - coordinates media/rooms/pricing child managers
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type WizardTabId = WizardStep | "room_amenities";

type WizardResponse = {
  item: SerializedProperty;
  recommendedStep: WizardStep;
};

type RoomFeatureItem = {
  id: string;
  name: string;
  category: string;
};

type LocationSuggestionItem = {
  id: string;
  name: string;
};

type ObjectWizardProps = {
  initialProperty: SerializedProperty;
  initialStep: WizardStep;
  forcedStep?: WizardStep | null;
  initialRooms: SerializedRoom[];
  displayPropertyNumber: number;
  // Shared room-feature catalog is currently consumed by RoomAmenitiesManager.
  // RoomFundManager no longer edits amenities directly.
  roomFeatureItems: RoomFeatureItem[];
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { error?: string };
      if (body.error?.trim()) {
        return body.error;
      }
      return fallback;
    }

    const text = (await response.text()).trim();
    if (text) {
      return text;
    }
  } catch {
    // Ignore parsing issues and keep fallback.
  }

  return fallback;
}

const tabTitles: Array<{ id: WizardTabId; title: string; description: string }> = [
  { id: 1, title: "Информация", description: "Информация об объекте" },
  { id: 3, title: "Локация", description: "Локация" },
  { id: 4, title: "Контакты", description: "Контакты владельца" },
  { id: 5, title: "Об объекте", description: "Об объекте" },
  { id: 6, title: "Правила", description: "Правила проживания" },
  { id: 7, title: "КСР", description: "Договоры и отчеты (КСР)" },
  { id: 8, title: "Фото", description: "Фото объекта" },
  { id: 9, title: "Номера", description: "Номера" },
  { id: "room_amenities", title: "Удобства", description: "Удобства в номерах" },
  { id: 10, title: "Шахматка", description: "Шахматка цен" },
];

const tabOrder: WizardTabId[] = tabTitles.map((tab) => tab.id);

type WizardSidebarSection = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  steps: WizardTabId[];
};

type WizardTopMilestone = {
  title: string;
  caption: string;
  icon: LucideIcon;
  targetStep: WizardTabId;
  steps: WizardTabId[];
};

const sidebarSections: WizardSidebarSection[] = [
  {
    id: "main",
    title: "Основное",
    description: "Расскажите о вашем объекте и его особенностях",
    icon: ClipboardList,
    steps: [1, 3, 7, 4, 5, 6, 8],
  },
  {
    id: "rooms",
    title: "Номера",
    description: "Добавьте номера, цены и условия размещения",
    icon: BedDouble,
    steps: [9],
  },
  {
    id: "amenities",
    title: "Удобства",
    description: "Укажите доступные удобства и услуги для гостей",
    icon: Star,
    steps: ["room_amenities"],
  },
  {
    id: "payment",
    title: "Оплата",
    description: "Настройте публикацию и перейдите к оплате",
    icon: WalletCards,
    steps: [10],
  },
];

const topMilestones: WizardTopMilestone[] = [
  {
    title: "Информация",
    caption: "1 из 5",
    icon: Info,
    targetStep: 1,
    steps: [1, 5],
  },
  {
    title: "Локация",
    caption: "2 из 5",
    icon: MapPin,
    targetStep: 3,
    steps: [3],
  },
  {
    title: "Правила и регистрация",
    caption: "3 из 5",
    icon: ListChecks,
    targetStep: 6,
    steps: [6, 7],
  },
  {
    title: "Контакты",
    caption: "4 из 5",
    icon: UserRound,
    targetStep: 4,
    steps: [4],
  },
  {
    title: "Фото объекта",
    caption: "5 из 5",
    icon: ImageIcon,
    targetStep: 8,
    steps: [8],
  },
];

const sectionHelpItems = [
  {
    title: "Выберите точный тип объекта",
    text: "Это поможет гостям быстрее понять, подходит ли им ваше предложение.",
  },
  {
    title: "Дайте понятное название",
    text: "Укажите лаконичное и запоминающееся название вашего объекта.",
  },
  {
    title: "Кратко и по делу",
    text: "Короткое описание должно зацепить и вызвать интерес.",
  },
  {
    title: "Подробности важны",
    text: "Расскажите о комфорте, особенностях и преимуществах объекта.",
  },
  {
    title: "Ответьте на вопросы гостей",
    text: "Это снизит количество уточняющих сообщений и сэкономит время.",
  },
];

const propertyTypeCards = [
  {
    typeId: "hotel",
    title: "Гостиница",
    text: "Отель, мини-отель, хостел и пр.",
  },
  {
    typeId: "apartment",
    title: "Квартира",
    text: "Апартаменты или квартира",
  },
  {
    typeId: "house",
    title: "Дом",
    text: "Частный дом или коттедж",
  },
  {
    typeId: "guest_house",
    title: "Таунхаус",
    text: "Дом с отдельным входом",
  },
  {
    typeId: "other",
    title: "Другое",
    text: "Иной тип размещения",
  },
] as const;

const primaryPropertyTypeIds = new Set<string>(["hotel", "apartment", "house", "guest_house"]);

const otherPropertyTypeOptions = propertyTypes.filter(
  (item) => !primaryPropertyTypeIds.has(item.id),
);

function isOtherPropertyTypeId(typeId: string): boolean {
  return Boolean(typeId) && !primaryPropertyTypeIds.has(typeId);
}

function isWizardStepDone(step: WizardTabId, property: SerializedProperty): boolean {
  return step === "room_amenities"
    ? property.progress.step9
    : Boolean(property.progress[`step${step}` as keyof typeof property.progress]);
}

function buildRulesSnapshot({
  checkInFrom,
  checkOutUntil,
  childrenAllowed,
  childrenMinAge,
  petsPolicy,
  smokingPolicy,
  quietHoursEnabled,
  quietHoursFrom,
  quietHoursTo,
  parkingInfo,
  mealOptions,
  prepaymentPolicy,
}: {
  checkInFrom: string;
  checkOutUntil: string;
  childrenAllowed: boolean | null;
  childrenMinAge: number | null;
  petsPolicy: PetsPolicy;
  smokingPolicy: SmokingPolicy;
  quietHoursEnabled: boolean | null;
  quietHoursFrom: string;
  quietHoursTo: string;
  parkingInfo: string;
  mealOptions: string;
  prepaymentPolicy: string;
}) {
  return JSON.stringify({
    checkInFrom,
    checkOutUntil,
    childrenAllowed,
    childrenMinAge: childrenAllowed ? childrenMinAge : null,
    petsPolicy,
    smokingPolicy,
    quietHoursEnabled,
    quietHoursFrom: quietHoursEnabled ? quietHoursFrom : null,
    quietHoursTo: quietHoursEnabled ? quietHoursTo : null,
    parkingInfo: parkingInfo || null,
    mealOptions: mealOptions || null,
    prepaymentPolicy: prepaymentPolicy || null,
  });
}

function normalizeStep(step: WizardStep): WizardStep {
  return step === 2 ? 3 : step;
}

function mapStepToTab(step: WizardStep): WizardTabId {
  return normalizeStep(step);
}

function normalizeLocationLookup(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(
      /^(?:г\.?|город|пгт\.?|посёлок городского типа|поселок городского типа|пос\.?|посёлок|поселок|с\.?|село|д\.?|деревня)\s+/,
      "",
    )
    .replace(/\s+/g, " ");
}

function findLocationSuggestionByName(
  value: string,
  items: readonly LocationSuggestionItem[],
): LocationSuggestionItem | null {
  const normalizedValue = normalizeLocationLookup(value);
  if (!normalizedValue) {
    return null;
  }

  return items.find((item) => normalizeLocationLookup(item.name) === normalizedValue) ?? null;
}

// Shared textarea style so step blocks stay visually consistent.
function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive outline-none placeholder:text-olive/50 focus:border-terra focus:ring-2 focus:ring-terra/20",
        props.className,
      )}
    />
  );
}

export function ObjectWizard({
  initialProperty,
  initialStep,
  forcedStep = null,
  initialRooms,
  roomFeatureItems,
}: ObjectWizardProps) {
  const normalizedInitialStep: WizardStep = normalizeStep(forcedStep ?? initialStep);
  const normalizedInitialTab = mapStepToTab(normalizedInitialStep);
  const [property, setProperty] = useState(initialProperty);
  const [activeStep, setActiveStep] = useState<WizardTabId>(normalizedInitialTab);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [addressLookupPending, setAddressLookupPending] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isRegistryChecking, setIsRegistryChecking] = useState(false);
  const [registryCheckMessage, setRegistryCheckMessage] = useState("");
  const addressChangeSourceRef = useRef<"input" | "map" | "system">("system");

  const [selectedType, setSelectedType] = useState(
    normalizePropertyTypeId(initialProperty.type) ?? "",
  );
  const [isOtherTypeMenuOpen, setIsOtherTypeMenuOpen] = useState(false);
  const [locationInput, setLocationInput] = useState(initialProperty.locationName ?? "");
  const [selectedLocationId, setSelectedLocationId] = useState(initialProperty.locationId ?? "");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestionItem[]>(
    crimeaLocations.map((location) => ({ id: location.id, name: location.name })),
  );
  const shouldShowLocationSuggestions = locationInput.trim().length === 0;
  const [name, setName] = useState(initialProperty.name ?? "");
  const [address, setAddress] = useState(initialProperty.address ?? "");
  const [seaDistance, setSeaDistance] = useState(initialProperty.seaDistance ?? "");
  const [latitude, setLatitude] = useState<number | null>(initialProperty.latitude);
  const [longitude, setLongitude] = useState<number | null>(initialProperty.longitude);
  const [mapDraftLatitude, setMapDraftLatitude] = useState<number | null>(initialProperty.latitude);
  const [mapDraftLongitude, setMapDraftLongitude] = useState<number | null>(
    initialProperty.longitude,
  );
  const [mapDraftAddress, setMapDraftAddress] = useState(initialProperty.address ?? "");
  const [mapDraftLocationName, setMapDraftLocationName] = useState(
    initialProperty.locationName ?? "",
  );
  const [mapDraftLocationId, setMapDraftLocationId] = useState(initialProperty.locationId ?? "");

  const [phone, setPhone] = useState(initialProperty.phone ?? "");
  const [phoneName, setPhoneName] = useState(initialProperty.phoneName ?? "");
  const [phone2, setPhone2] = useState(initialProperty.phone2 ?? "");
  const [phone2Name, setPhone2Name] = useState(initialProperty.phone2Name ?? "");
  const [phone3, setPhone3] = useState(initialProperty.phone3 ?? "");
  const [phone3Name, setPhone3Name] = useState(initialProperty.phone3Name ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialProperty.websiteUrl ?? "");
  const [contactEmail, setContactEmail] = useState(initialProperty.contactEmail ?? "");
  const [contactPersonName, setContactPersonName] = useState(
    initialProperty.contactPersonName ?? "",
  );
  const [contactPersonRole, setContactPersonRole] = useState(
    initialProperty.contactPersonRole ?? "",
  );
  const [listingChannels, setListingChannels] = useState(initialProperty.listingChannels ?? "");
  const [whatsappUrl, setWhatsappUrl] = useState(initialProperty.whatsappUrl ?? "");
  const [telegramUrl, setTelegramUrl] = useState(initialProperty.telegramUrl ?? "");
  const [vkUrl, setVkUrl] = useState(initialProperty.vkUrl ?? "");
  const [maxUrl, setMaxUrl] = useState(initialProperty.maxUrl ?? "");
  const [okUrl, setOkUrl] = useState(initialProperty.okUrl ?? "");

  const [shortDescription, setShortDescription] = useState(
    (initialProperty.description ?? "").slice(0, 160),
  );
  const [description, setDescription] = useState(initialProperty.description ?? "");

  const [checkInFrom, setCheckInFrom] = useState(initialProperty.checkInFrom ?? "");
  const [checkOutUntil, setCheckOutUntil] = useState(initialProperty.checkOutUntil ?? "");
  const [childrenAllowed, setChildrenAllowed] = useState<boolean | null>(
    initialProperty.childrenAllowed,
  );
  const [childrenMinAge, setChildrenMinAge] = useState<number | null>(
    initialProperty.childrenMinAge,
  );
  const [petsPolicy, setPetsPolicy] = useState<PetsPolicy>(
    initialProperty.petsPolicy ?? "FORBIDDEN",
  );
  const [smokingPolicy, setSmokingPolicy] = useState<SmokingPolicy>(
    initialProperty.smokingPolicy ?? "FORBIDDEN",
  );
  const [quietHoursEnabled, setQuietHoursEnabled] = useState<boolean | null>(
    initialProperty.quietHoursEnabled,
  );
  const [quietHoursFrom, setQuietHoursFrom] = useState(initialProperty.quietHoursFrom ?? "");
  const [quietHoursTo, setQuietHoursTo] = useState(initialProperty.quietHoursTo ?? "");
  const [parkingInfo, setParkingInfo] = useState(initialProperty.parkingInfo ?? "");
  const [mealOptions, setMealOptions] = useState(initialProperty.mealOptions ?? "");
  const [prepaymentPolicy, setPrepaymentPolicy] = useState(initialProperty.prepaymentPolicy ?? "");
  const initialRulesSnapshotRef = useRef(
    buildRulesSnapshot({
      checkInFrom: initialProperty.checkInFrom ?? "",
      checkOutUntil: initialProperty.checkOutUntil ?? "",
      childrenAllowed: initialProperty.childrenAllowed,
      childrenMinAge: initialProperty.childrenMinAge,
      petsPolicy: initialProperty.petsPolicy ?? "FORBIDDEN",
      smokingPolicy: initialProperty.smokingPolicy ?? "FORBIDDEN",
      quietHoursEnabled: initialProperty.quietHoursEnabled,
      quietHoursFrom: initialProperty.quietHoursFrom ?? "",
      quietHoursTo: initialProperty.quietHoursTo ?? "",
      parkingInfo: initialProperty.parkingInfo ?? "",
      mealOptions: initialProperty.mealOptions ?? "",
      prepaymentPolicy: initialProperty.prepaymentPolicy ?? "",
    }),
  );
  const lastSavedRulesSnapshotRef = useRef(initialRulesSnapshotRef.current);

  const [registryNumber, setRegistryNumber] = useState(initialProperty.registryNumber ?? "");

  const stepStates = useMemo(() => {
    return tabTitles.map((step) => {
      const done =
        step.id === "room_amenities"
          ? property.progress.step9
          : (property.progress[`step${step.id}` as keyof typeof property.progress] as boolean);
      return {
        ...step,
        done,
        index: tabOrder.indexOf(step.id),
      };
    });
  }, [property]);

  const selectedTypeInfo = selectedType ? propertyTypeById[selectedType] : null;
  const selectedTypePricingGroup = getPlacementPricingGroupByType(selectedType || null);
  const selectedTypePricingInfo = placementPricingGroupInfo[selectedTypePricingGroup];
  const activeStepIndex = Math.max(0, tabOrder.indexOf(activeStep));
  const activeStepState = stepStates.find((step) => step.id === activeStep) ?? stepStates[0];
  const completedStepCount = stepStates.filter((step) => step.done).length;
  const activeSidebarSection =
    sidebarSections.find((section) => section.steps.includes(activeStep)) ?? sidebarSections[0];
  const activeTopMilestone =
    topMilestones.find((milestone) => milestone.steps.includes(activeStep)) ?? topMilestones[0];
  const nameLength = name.length;
  const shortDescriptionLength = shortDescription.length;
  const descriptionLength = description.length;
  const rulesSnapshot = buildRulesSnapshot({
    checkInFrom,
    checkOutUntil,
    childrenAllowed,
    childrenMinAge,
    petsPolicy,
    smokingPolicy,
    quietHoursEnabled,
    quietHoursFrom,
    quietHoursTo,
    parkingInfo,
    mealOptions,
    prepaymentPolicy,
  });
  const canAutoSaveRules =
    Boolean(checkInFrom && checkOutUntil) &&
    childrenAllowed !== null &&
    quietHoursEnabled !== null &&
    (!quietHoursEnabled || Boolean(quietHoursFrom && quietHoursTo));

  function openStep(step: WizardTabId) {
    const normalized = typeof step === "number" ? mapStepToTab(step) : step;
    const index = tabOrder.indexOf(normalized);
    if (index === -1) {
      return;
    }
    setError("");
    setActiveStep(normalized);
  }

  function openMapDialog() {
    setMapDraftLatitude(latitude);
    setMapDraftLongitude(longitude);
    setMapDraftAddress(address);
    setMapDraftLocationName(locationInput);
    setMapDraftLocationId(selectedLocationId);
    setIsMapDialogOpen(true);
    setError("");
  }

  function closeMapDialog() {
    setIsMapDialogOpen(false);
  }

  function applyMapSelection() {
    if (mapDraftLatitude === null || mapDraftLongitude === null) {
      setError("Отметьте точку на карте и затем сохраните.");
      return;
    }

    setLatitude(mapDraftLatitude);
    setLongitude(mapDraftLongitude);

    if (mapDraftAddress.trim()) {
      addressChangeSourceRef.current = "map";
      setAddress(mapDraftAddress.trim());
    }

    if (mapDraftLocationName.trim()) {
      setLocationInput(mapDraftLocationName.trim());
      setSelectedLocationId(mapDraftLocationId.trim());
    }

    setIsMapDialogOpen(false);
    setError("");
  }

  function applyProperty(item: SerializedProperty) {
    // After every successful save we sync full local state from server snapshot.
    setProperty(item);
    setSelectedType(normalizePropertyTypeId(item.type) ?? "");
    setLocationInput(item.locationName ?? "");
    setSelectedLocationId(item.locationId ?? "");
    setName(item.name ?? "");
    setAddress(item.address ?? "");
    setSeaDistance(item.seaDistance ?? "");
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setMapDraftLatitude(item.latitude);
    setMapDraftLongitude(item.longitude);
    setMapDraftAddress(item.address ?? "");
    setMapDraftLocationName(item.locationName ?? "");
    setMapDraftLocationId(item.locationId ?? "");
    setPhone(item.phone ?? "");
    setPhoneName(item.phoneName ?? "");
    setPhone2(item.phone2 ?? "");
    setPhone2Name(item.phone2Name ?? "");
    setPhone3(item.phone3 ?? "");
    setPhone3Name(item.phone3Name ?? "");
    setWebsiteUrl(item.websiteUrl ?? "");
    setContactEmail(item.contactEmail ?? "");
    setContactPersonName(item.contactPersonName ?? "");
    setContactPersonRole(item.contactPersonRole ?? "");
    setListingChannels(item.listingChannels ?? "");
    setWhatsappUrl(item.whatsappUrl ?? "");
    setTelegramUrl(item.telegramUrl ?? "");
    setVkUrl(item.vkUrl ?? "");
    setMaxUrl(item.maxUrl ?? "");
    setOkUrl(item.okUrl ?? "");
    setShortDescription((item.description ?? "").slice(0, 160));
    setDescription(item.description ?? "");
    setCheckInFrom(item.checkInFrom ?? "");
    setCheckOutUntil(item.checkOutUntil ?? "");
    setChildrenAllowed(item.childrenAllowed);
    setChildrenMinAge(item.childrenMinAge);
    setPetsPolicy(item.petsPolicy ?? "FORBIDDEN");
    setSmokingPolicy(item.smokingPolicy ?? "FORBIDDEN");
    setQuietHoursEnabled(item.quietHoursEnabled);
    setQuietHoursFrom(item.quietHoursFrom ?? "");
    setQuietHoursTo(item.quietHoursTo ?? "");
    setParkingInfo(item.parkingInfo ?? "");
    setMealOptions(item.mealOptions ?? "");
    setPrepaymentPolicy(item.prepaymentPolicy ?? "");
    lastSavedRulesSnapshotRef.current = buildRulesSnapshot({
      checkInFrom: item.checkInFrom ?? "",
      checkOutUntil: item.checkOutUntil ?? "",
      childrenAllowed: item.childrenAllowed,
      childrenMinAge: item.childrenMinAge,
      petsPolicy: item.petsPolicy ?? "FORBIDDEN",
      smokingPolicy: item.smokingPolicy ?? "FORBIDDEN",
      quietHoursEnabled: item.quietHoursEnabled,
      quietHoursFrom: item.quietHoursFrom ?? "",
      quietHoursTo: item.quietHoursTo ?? "",
      parkingInfo: item.parkingInfo ?? "",
      mealOptions: item.mealOptions ?? "",
      prepaymentPolicy: item.prepaymentPolicy ?? "",
    });
    setRegistryNumber(item.registryNumber ?? "");
    addressChangeSourceRef.current = "system";
  }

  async function refreshProperty() {
    const response = await fetch(`/api/properties/${property.id}`);

    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as {
      item: SerializedProperty;
      recommendedStep: WizardStep;
    };

    applyProperty(body.item);
  }

  async function patchStep(payload: unknown): Promise<WizardResponse | null> {
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, "Не удалось сохранить изменения");
        setError(errorMessage);
        return null;
      }

      const body = (await response.json()) as WizardResponse;
      applyProperty(body.item);
      return body;
    } finally {
      setIsSaving(false);
    }
  }

  async function persistStep1Details(): Promise<WizardResponse | null> {
    if (!selectedType) {
      setError("Выберите тип объекта");
      return null;
    }
    if (!name.trim()) {
      setError("Введите название объекта");
      return null;
    }
    const body = await patchStep({ step: 1, data: { type: selectedType, name: name.trim() } });
    if (!body) return null;

    const preparedDescription = description.trim() || shortDescription.trim();
    if (preparedDescription) {
      const descriptionBody = await patchStep({
        step: 5,
        data: {
          description: preparedDescription,
          amenityIds: [],
          customAmenities: [],
        },
      });
      if (!descriptionBody) return null;
    }

    return body;
  }

  async function saveStep1Draft() {
    await persistStep1Details();
  }

  async function saveStep1() {
    const body = await persistStep1Details();
    if (!body) return;
    openStep(body.recommendedStep);
  }

  async function saveStep3() {
    const cleanedLocation = locationInput.trim();
    const cleanedSeaDistance = seaDistance.trim();
    if (!cleanedLocation) return setError("Укажите населенный пункт");
    if (!address.trim()) return setError("Введите адрес");
    if (latitude === null || longitude === null) return setError("Укажите координаты");

    const exactKnownLocation =
      locationSuggestions.find(
        (location) => location.name.toLowerCase() === cleanedLocation.toLowerCase(),
      ) ??
      crimeaLocations.find(
        (location) => location.name.toLowerCase() === cleanedLocation.toLowerCase(),
      ) ??
      null;

    const body = await patchStep({
      step: 3,
      data: {
        locationId: selectedLocationId || exactKnownLocation?.id || null,
        locationName: cleanedLocation,
        address: address.trim(),
        seaDistance: cleanedSeaDistance,
        latitude,
        longitude,
      },
    });
    if (body) openStep(body.recommendedStep);
  }

  async function saveStep4() {
    if (!phone.trim()) return setError("Введите телефон");
    if (!contactPersonName.trim()) return setError("Введите ФИО контактного лица");
    if (!contactEmail.trim()) return setError("Введите email контактного лица");
    const body = await patchStep({
      step: 4,
      data: {
        phone: phone.trim(),
        phoneName: phoneName.trim(),
        phone2: phone2.trim(),
        phone2Name: phone2Name.trim(),
        phone3: phone3.trim(),
        phone3Name: phone3Name.trim(),
        websiteUrl: websiteUrl.trim(),
        contactEmail: contactEmail.trim(),
        contactPersonName: contactPersonName.trim(),
        contactPersonRole: contactPersonRole.trim(),
        listingChannels: listingChannels.trim(),
        whatsappUrl: normalizeWhatsappUrl(whatsappUrl) ?? "",
        telegramUrl: normalizeTelegramProfileUrl(telegramUrl) ?? "",
        vkUrl: normalizeVkProfileUrl(vkUrl) ?? "",
        maxUrl: normalizeMaxProfileUrl(maxUrl) ?? "",
        okUrl: normalizeOkProfileUrl(okUrl) ?? "",
        receiveRequests: false,
      },
    });
    if (body) openStep(body.recommendedStep);
  }

  async function saveStep5() {
    if (!description.trim()) return setError("Добавьте описание объекта");

    const body = await patchStep({
      step: 5,
      data: {
        description: description.trim(),
        amenityIds: [],
        customAmenities: [],
      },
    });
    if (body) openStep(body.recommendedStep);
  }

  async function persistStep7(nextStep: WizardTabId | null = null) {
    const normalizedRegistryNumber = registryNumber.trim();
    const body = await patchStep({
      step: 7,
      data: {
        classificationApplicable: true,
        starRating: null,
        registryNumber: normalizedRegistryNumber,
        selfAssessmentPassed: null,
      },
    });

    if (body) {
      if (nextStep) {
        openStep(nextStep);
      } else {
        openStep(body.recommendedStep);
      }
    }
  }

  async function saveStep7() {
    const normalizedRegistryNumber = registryNumber.trim();
    if (!normalizedRegistryNumber) {
      return setError("Укажите номер записи в реестре КСР");
    }
    if (normalizedRegistryNumber.length < 3) {
      setError("Номер записи в реестре слишком короткий");
      return;
    }
    await persistStep7();
  }

  async function verifyRegistryNumber() {
    const normalizedRegistryNumber = registryNumber.trim();

    if (!normalizedRegistryNumber) {
      setRegistryCheckMessage("Введите номер записи в реестре, чтобы выполнить проверку.");
      return;
    }

    if (normalizedRegistryNumber.length < 3) {
      setRegistryCheckMessage("Номер записи в реестре слишком короткий для проверки.");
      return;
    }

    setRegistryCheckMessage("");
    setIsRegistryChecking(true);
    try {
      const response = await fetch(
        `/api/ksr/verify?number=${encodeURIComponent(normalizedRegistryNumber)}`,
      );
      const body = (await response.json()) as { message?: string };

      if (!response.ok) {
        setRegistryCheckMessage(body.message ?? "Не удалось проверить номер записи в реестре.");
        return;
      }

      setRegistryCheckMessage(
        body.message ??
          "Номер сохранен. Автоматическая проверка временно недоступна, администратор проверит данные на модерации.",
      );
    } catch {
      setRegistryCheckMessage(
        "Проверка временно недоступна. Номер будет проверен администратором при модерации.",
      );
    } finally {
      setIsRegistryChecking(false);
    }
  }

  async function continueFromLocation() {
    const normalizedRegistryNumber = registryNumber.trim();
    if (!normalizedRegistryNumber) {
      setError("После выбора типа и локации нужно указать номер записи в реестре КСР");
      return;
    }

    if (normalizedRegistryNumber.length < 3) {
      setError("Номер записи в реестре слишком короткий");
      return;
    }

    await persistStep7(4);
  }

  async function findAddressOnMap() {
    if (address.trim().length < 5) return setError("Введите адрес длиной минимум 5 символов");
    setAddressLookupPending(true);
    setError("");
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(address.trim())}`);
      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, "Не удалось найти адрес");
        setError(errorMessage);
        return;
      }
      const body = (await response.json()) as {
        item: { latitude: number; longitude: number; address: string };
      };
      setLatitude(body.item.latitude);
      setLongitude(body.item.longitude);
      addressChangeSourceRef.current = "system";
      setAddress(body.item.address);
    } finally {
      setAddressLookupPending(false);
    }
  }

  useEffect(() => {
    const abortController = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/reference/locations?query=${encodeURIComponent(locationInput.trim())}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as { items: LocationSuggestionItem[] };
        setLocationSuggestions(body.items);
      } catch {
        // ignore aborted or transient request errors while typing
      }
    }, 180);

    return () => {
      abortController.abort();
      clearTimeout(timer);
    };
  }, [locationInput]);

  useEffect(() => {
    if (!canAutoSaveRules || rulesSnapshot === lastSavedRulesSnapshotRef.current) {
      return;
    }

    const abortController = new AbortController();
    void (async () => {
      setError("");

      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 6,
          data: JSON.parse(rulesSnapshot),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        if (abortController.signal.aborted) {
          return;
        }
        setError(await readErrorMessage(response, "Не удалось сохранить правила проживания"));
        return;
      }

      const body = (await response.json()) as WizardResponse;
      lastSavedRulesSnapshotRef.current = rulesSnapshot;
      applyProperty(body.item);
    })().catch((cause: unknown) => {
      if (abortController.signal.aborted) {
        return;
      }
      if (cause instanceof Error && cause.name === "AbortError") {
        return;
      }
      setError("Не удалось сохранить правила проживания");
    });

    return () => {
      abortController.abort();
    };
  }, [canAutoSaveRules, property.id, rulesSnapshot]);

  return (
    <div className="object-create-page mx-auto w-full max-w-[2440px]">
      <div className="grid gap-8 2xl:grid-cols-[410px_minmax(0,1fr)_460px]">
        <aside className="space-y-4 2xl:sticky 2xl:top-32 2xl:self-start">
          {sidebarSections.map((section, sectionIndex) => {
            const isActive = section.id === activeSidebarSection.id;
            const isDone = section.steps.every((step) => isWizardStepDone(step, property));
            const sectionStepStates = stepStates.filter((step) => section.steps.includes(step.id));

            return (
              <section
                key={section.id}
                className={cn(
                  "rounded-[8px] border bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition",
                  isActive
                    ? "border-primary/25 bg-[linear-gradient(90deg,rgba(15,118,110,0.1),rgba(255,255,255,0.92))] shadow-[0_12px_36px_rgba(15,118,110,0.08)] ring-1 ring-primary/15"
                    : "border-olive/10 hover:border-primary/18",
                )}
              >
                <button
                  type="button"
                  onClick={() => openStep(section.steps[0])}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px]",
                      isActive ? "bg-primary text-white" : "bg-primary/8 text-primary",
                    )}
                  >
                    <AppIcon icon={section.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-3 text-base font-semibold text-olive">
                      <span className="text-sm">{sectionIndex + 1}</span>
                      <span>{section.title}</span>
                      {isDone ? (
                        <AppIcon icon={CheckCircle2} className="ml-auto h-4 w-4 text-primary" />
                      ) : null}
                    </span>
                    <span className="mt-2 block max-w-[250px] text-sm leading-6 text-olive/58">
                      {section.description}
                    </span>
                  </span>
                </button>

                {isActive ? (
                  <div className="mt-7 space-y-6 border-l border-olive/18 pl-8">
                    {sectionStepStates.map((step) => (
                      <button
                        key={String(step.id)}
                        type="button"
                        onClick={() => openStep(step.id)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span
                          className={cn(
                            "-ml-[39px] h-4 w-4 rounded-full border bg-white",
                            step.id === activeStep
                              ? "border-primary bg-primary"
                              : step.done
                                ? "border-primary bg-primary/25"
                                : "border-olive/30 bg-white",
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm leading-5",
                            step.id === activeStep
                              ? "font-semibold text-primary"
                              : "font-medium text-olive/65",
                          )}
                        >
                          {step.title}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </aside>

        <main className="min-w-0 bg-white">
          <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h1 className="font-heading text-3xl font-semibold leading-tight text-olive md:text-[34px]">
                  {property.name ? "Редактирование объекта" : "Создание объекта"}
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-olive/62">
                  Заполните информацию о вашем объекте. Это поможет гостям лучше вас найти и
                  забронировать.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
                  {property.statusLabel}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-olive/56 ring-1 ring-olive/10">
                  {completedStepCount}/{stepStates.length}
                </span>
              </div>
            </div>

            {property.moderationNotes ? (
              <div className="flex gap-2 rounded-[8px] bg-terra/8 p-3">
                <AppIcon icon={TriangleAlert} className="mt-0.5 h-4 w-4 shrink-0 text-terra" />
                <div className="text-sm text-olive/85">
                  <p className="font-semibold text-olive">Комментарий модератора</p>
                  <p className="mt-0.5 whitespace-pre-line">{property.moderationNotes}</p>
                </div>
              </div>
            ) : null}

            <div className="grid overflow-hidden rounded-[8px] border border-olive/12 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.03)] md:grid-cols-5">
              {topMilestones.map((milestone) => {
                const isActive = milestone.steps.includes(activeStep);
                const isDone = milestone.steps.every((step) => isWizardStepDone(step, property));

                return (
                  <button
                    key={milestone.title}
                    type="button"
                    onClick={() => openStep(milestone.targetStep)}
                    className={cn(
                      "relative min-h-[96px] border-r border-olive/8 bg-white px-5 py-4 text-left transition last:border-r-0",
                      isActive ? "bg-primary/5" : "hover:bg-primary/3",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                          isActive ? "bg-primary text-white" : "bg-olive/6 text-olive/70",
                        )}
                      >
                        <AppIcon icon={milestone.icon} className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-olive">
                          {milestone.title}
                        </span>
                        <span className="mt-1 block text-xs font-medium text-olive/48">
                          {milestone.caption}
                        </span>
                      </span>
                      {isDone ? (
                        <AppIcon icon={CheckCircle2} className="ml-auto h-4 w-4 text-primary" />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "absolute bottom-0 left-0 h-1 w-full rounded-full",
                        isActive ? "bg-primary" : "bg-olive/8",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            <div className="h-2 rounded-full bg-olive/6">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${((activeStepIndex + 1) / stepStates.length) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-olive/48">
              <span>
                Сейчас: <span className="font-semibold text-olive/70">{activeStepState.title}</span>
              </span>
              <span>
                Шаг {activeStepIndex + 1} из {stepStates.length}
              </span>
            </div>
          </div>

          {activeStep === 1 ? (
            <section className="wizard-section-enter mt-9 space-y-7">
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-olive">1. Тип объекта</h2>
              </div>

              <PlacementPromoNotice compact />

              <div className="grid gap-4 lg:grid-cols-5">
                {propertyTypeCards.map((item) => {
                  const isOtherCard = item.typeId === "other";
                  const isSelected = isOtherCard
                    ? isOtherPropertyTypeId(selectedType)
                    : selectedType === item.typeId;
                  const cardTitle = item.typeId === "guest_house" ? "Гостевой дом" : item.title;
                  const cardText =
                    item.typeId === "guest_house"
                      ? "Небольшой объект с номерами для гостей"
                      : isOtherCard && isSelected
                        ? (propertyTypeById[selectedType]?.name ?? item.text)
                        : item.text;

                  return (
                    <button
                      key={item.typeId}
                      type="button"
                      onClick={() => {
                        if (isOtherCard) {
                          setIsOtherTypeMenuOpen((value) => !value);
                          return;
                        }

                        setSelectedType(item.typeId);
                        setIsOtherTypeMenuOpen(false);
                      }}
                      aria-expanded={isOtherCard ? isOtherTypeMenuOpen : undefined}
                      className={cn(
                        "relative min-h-[132px] rounded-[8px] border bg-white p-5 text-left transition",
                        isSelected
                          ? "border-primary/70 bg-primary/4 shadow-[0_16px_36px_rgba(15,118,110,0.12)] ring-1 ring-primary/20"
                          : "border-olive/12 hover:border-primary/24 hover:shadow-[0_12px_28px_rgba(58,43,35,0.05)]",
                      )}
                    >
                      <span className="flex items-center gap-4">
                        <span
                          className={cn(
                            "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                            isSelected ? "bg-primary/12 text-primary" : "bg-olive/6 text-olive/65",
                          )}
                        >
                          {isOtherCard ? (
                            <AppIcon icon={MoreVertical} className="h-6 w-6 rotate-90" />
                          ) : (
                            <PropertyTypeIcon typeId={item.typeId} className="h-6 w-6" />
                          )}
                        </span>
                        <span className="min-w-0 pt-0.5">
                          <span className="block text-base font-semibold text-olive">
                            {cardTitle}
                          </span>
                          <span className="mt-2 block text-sm leading-6 text-olive/58">
                            {cardText}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {isOtherTypeMenuOpen ? (
                <div className="ml-auto grid w-full gap-2 rounded-[8px] border border-olive/12 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.12)] sm:max-w-md sm:grid-cols-2">
                  {otherPropertyTypeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(option.id);
                        setIsOtherTypeMenuOpen(false);
                      }}
                      className={cn(
                        "flex min-w-0 items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm transition",
                        selectedType === option.id
                          ? "bg-primary/8 font-semibold text-primary"
                          : "text-olive/76 hover:bg-olive/5 hover:text-olive",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          selectedType === option.id ? "bg-primary/12" : "bg-olive/6",
                        )}
                      >
                        <PropertyTypeIcon typeId={option.id} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 truncate">{option.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedTypeInfo ? (
                <div className="rounded-[8px] border border-primary/16 bg-primary/5 p-4 text-sm text-olive/76">
                  <p className="font-semibold text-olive">
                    {selectedTypeInfo.name} · {selectedTypePricingInfo.title}
                  </p>
                  <p className="mt-1 leading-6">{selectedTypePricingInfo.details}</p>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-base font-semibold text-olive">2. Название объекта</label>
                  <span className="text-xs font-medium text-olive/45">{nameLength}/100</span>
                </div>
                <Input
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Например: Вилла «Морской бриз» в Судаке"
                  className="h-16 rounded-[8px] border-olive/14 bg-white/95 px-5 text-base"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-base font-semibold text-olive">3. Краткое описание</label>
                  <span className="text-xs font-medium text-olive/45">
                    {shortDescriptionLength}/160
                  </span>
                </div>
                <Input
                  value={shortDescription}
                  maxLength={160}
                  onChange={(event) => setShortDescription(event.target.value)}
                  placeholder="Например: Уютный гостевой дом в 5 минутах от моря. Комфортные номера, бассейн, парковка."
                  className="h-16 rounded-[8px] border-olive/14 bg-white/95 px-5 text-base"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-base font-semibold text-olive">
                      4. Подробное описание
                    </label>
                    <p className="mt-1 text-sm text-olive/58">
                      Расскажите подробнее о вашем объекте: преимущества, особенности, для кого он
                      подходит.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-olive/45">
                    {descriptionLength}/2000
                  </span>
                </div>
                <div className="overflow-hidden rounded-[8px] border border-olive/14 bg-white">
                  <div className="flex items-center gap-2 border-b border-olive/10 px-5 py-3 text-olive/68">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] font-bold">
                      B
                    </span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] italic">
                      I
                    </span>
                    <span className="mx-1 h-5 w-px bg-olive/10" />
                    <AppIcon icon={FileText} className="h-4 w-4" />
                    <AppIcon icon={CircleHelp} className="h-4 w-4" />
                  </div>
                  <TextArea
                    className="h-32 rounded-none border-0 px-5 py-4 text-base focus:border-transparent focus:ring-0"
                    maxLength={2000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Расскажите подробнее о вашем объекте: преимущества, особенности, для кого он подходит..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold text-olive">5. Часто задаваемые вопросы</h3>
                <button
                  type="button"
                  onClick={() => openStep(5)}
                  className="flex min-h-16 w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-primary/35 bg-white text-base font-semibold text-primary transition hover:bg-primary/5"
                >
                  <AppIcon icon={Plus} className="h-4 w-4" />
                  Добавить вопрос
                </button>
              </div>

              <div className="flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/dashboard/objects"
                  className="inline-flex min-h-11 items-center justify-center rounded-[8px] px-5 text-sm font-semibold text-olive ring-1 ring-[color:var(--border)] transition hover:bg-primary hover:text-white"
                >
                  <AppIcon icon={ChevronLeft} className="mr-2 h-4 w-4" />
                  Назад
                </Link>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="ghost"
                    onClick={saveStep1Draft}
                    disabled={isSaving}
                    className="min-h-11 rounded-[8px] px-5 text-primary hover:bg-primary hover:text-white"
                  >
                    <AppIcon icon={Save} className="mr-2 h-4 w-4" />
                    {isSaving ? "Сохранение..." : "Сохранить черновик"}
                  </Button>
                  <Button
                    onClick={saveStep1}
                    disabled={isSaving}
                    className="min-h-11 rounded-[8px] px-6"
                  >
                    {isSaving ? "Сохранение..." : "Далее"}
                    <AppIcon icon={ArrowRight} className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {activeStep === 3 ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">Локация и адрес</h2>
              <Input
                value={locationInput}
                onChange={(event) => {
                  setLocationInput(event.target.value);
                  setSelectedLocationId("");
                }}
                placeholder="Населенный пункт: Ялта, Судак..."
              />
              {shouldShowLocationSuggestions ? (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-olive/20 bg-white">
                  {locationSuggestions.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      className={cn(
                        "block w-full px-3 py-2 text-left text-sm hover:bg-cream",
                        selectedLocationId === location.id
                          ? "bg-cream font-semibold text-olive"
                          : "text-olive/80",
                      )}
                      onClick={() => {
                        setSelectedLocationId(location.id);
                        setLocationInput(location.name);
                      }}
                    >
                      {location.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-olive/60">
                Если населенного пункта нет в списке, можно ввести его вручную. Он появится в общем
                списке только после одобрения объявления администратором.
              </p>
              <Input
                value={address}
                onChange={(event) => {
                  addressChangeSourceRef.current = "input";
                  setAddress(event.target.value);
                }}
                placeholder="Адрес"
              />
              <div className="space-y-1">
                <Input
                  value={seaDistance}
                  onChange={(event) => setSeaDistance(event.target.value)}
                  placeholder="До моря, например: 700 м или 1.1 км"
                />
                <p className="text-xs text-olive/60">Необязательное поле. Можно оставить пустым.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={findAddressOnMap}
                  disabled={addressLookupPending}
                >
                  {addressLookupPending ? "Поиск..." : "Найти адрес по тексту"}
                </Button>
                <Button variant="ghost" onClick={openMapDialog}>
                  Открыть карту
                </Button>
              </div>
              <div className="rounded-xl border border-olive/15 bg-white p-3 text-sm text-olive/80">
                <p>
                  Координаты:{" "}
                  {latitude !== null && longitude !== null
                    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                    : "не выбраны"}
                </p>
                <p className="mt-1 text-xs text-olive/65">
                  Карта открывается отдельным окном по кнопке «Открыть карту».
                </p>
              </div>

              {name.trim().length > 0 && address.trim().length > 0 ? (
                <div className="space-y-3 rounded-xl border border-olive/15 bg-white p-4 text-sm text-olive/85">
                  <h3 className="text-base font-semibold text-olive">
                    Добавьте номер записи в реестре классифицированных средств размещения
                  </h3>
                  <p>
                    Номер записи обязателен, если объект является средством размещения: гостиницей,
                    отелем, хостелом, санаторием, базой отдыха, кемпингом, глэмпингом, гостевым
                    домом в регионе эксперимента или похожим форматом. Он нужен для проверки статуса
                    объекта и прохождения модерации.
                  </p>
                  <p>
                    Если вы сдаете жилое помещение во временное владение и пользование без статуса
                    средства размещения, номер записи может быть неприменим.
                  </p>
                  <p className="text-xs text-olive/70">
                    Основание: ФЗ N 132-ФЗ от 24.11.1996, ФЗ N 436-ФЗ от 30.11.2024, постановления
                    Правительства РФ N 1951 и N 1952 от 27.12.2024, ФЗ N 127-ФЗ от 07.06.2025.
                  </p>
                  <Input
                    value={registryNumber}
                    onChange={(event) => setRegistryNumber(event.target.value)}
                    placeholder="Номер записи в реестре"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void verifyRegistryNumber()}
                      disabled={isRegistryChecking}
                    >
                      {isRegistryChecking ? "Проверяем..." : "Проверить номер"}
                    </Button>
                    <a
                      href="https://tourism.fsa.gov.ru/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-sm font-semibold text-terra hover:underline"
                    >
                      Открыть реестр КСР
                    </a>
                  </div>
                  {registryCheckMessage ? (
                    <p className="rounded-xl bg-cream px-3 py-2 text-xs text-olive/75">
                      {registryCheckMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep(1)}>
                  Назад
                </Button>
                <Button onClick={saveStep3} disabled={isSaving}>
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button variant="ghost" onClick={() => void continueFromLocation()}>
                  Далее
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === 4 ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">
                Контакты и каналы связи
              </h2>
              <p className="rounded-xl bg-cream p-3 text-sm text-olive/75">
                Эти данные в первую очередь видит администратор, чтобы связаться с владельцем
                объявления.
              </p>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-olive">Телефон (основной)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-olive">Номер телефона</p>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+7 (___) ___-__-__"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-olive">Имя (необязательно)</p>
                    <Input
                      value={phoneName}
                      onChange={(event) => setPhoneName(event.target.value)}
                      placeholder="Иван"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-olive">
                  Дополнительный телефон 2 (необязательно)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-olive">Номер телефона</p>
                    <Input
                      type="tel"
                      value={phone2}
                      onChange={(event) => setPhone2(event.target.value)}
                      placeholder="+7 (___) ___-__-__"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-olive">Имя (необязательно)</p>
                    <Input
                      value={phone2Name}
                      onChange={(event) => setPhone2Name(event.target.value)}
                      placeholder="Мария"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-olive">
                  Дополнительный телефон 3 (необязательно)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-olive">Номер телефона</p>
                    <Input
                      type="tel"
                      value={phone3}
                      onChange={(event) => setPhone3(event.target.value)}
                      placeholder="+7 (___) ___-__-__"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-olive">Имя (необязательно)</p>
                    <Input
                      value={phone3Name}
                      onChange={(event) => setPhone3Name(event.target.value)}
                      placeholder="Пётр"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-olive">Сайт (необязательно)</p>
                <Input
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://example.ru"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-olive">Email</p>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="contact@example.ru"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-olive">ФИО контактного лица</p>
                  <Input
                    value={contactPersonName}
                    onChange={(event) => setContactPersonName(event.target.value)}
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-olive">Должность (необязательно)</p>
                  <Input
                    value={contactPersonRole}
                    onChange={(event) => setContactPersonRole(event.target.value)}
                    placeholder="Управляющий / владелец"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-olive">
                  Где еще размещаетесь (необязательно)
                </p>
                <TextArea
                  className="h-20"
                  value={listingChannels}
                  onChange={(event) => setListingChannels(event.target.value)}
                  placeholder="Например: сайт объекта, агрегаторы, соцсети"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-olive">WhatsApp (необязательно)</p>
                  <Input
                    type="text"
                    value={whatsappUrl}
                    onChange={(event) => setWhatsappUrl(event.target.value)}
                    onBlur={() =>
                      setWhatsappUrl((value) => normalizeWhatsappUrl(value) ?? value.trim())
                    }
                    placeholder="+7 999 123-45-67 или https://wa.me/79991234567"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-olive">Telegram (необязательно)</p>
                  <Input
                    type="text"
                    value={telegramUrl}
                    onChange={(event) => setTelegramUrl(event.target.value)}
                    onBlur={() =>
                      setTelegramUrl((value) => normalizeTelegramProfileUrl(value) ?? value.trim())
                    }
                    placeholder="@username, username или телефон"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-olive">VK (необязательно)</p>
                  <Input
                    type="url"
                    value={vkUrl}
                    onChange={(event) => setVkUrl(event.target.value)}
                    placeholder="https://vk.com/username"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-olive">Max (необязательно)</p>
                  <Input
                    type="url"
                    value={maxUrl}
                    onChange={(event) => setMaxUrl(event.target.value)}
                    placeholder="https://max.ru/username"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-sm font-medium text-olive">Одноклассники (необязательно)</p>
                  <Input
                    type="url"
                    value={okUrl}
                    onChange={(event) => setOkUrl(event.target.value)}
                    placeholder="https://ok.ru/profile/..."
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep(3)}>
                  Назад
                </Button>
                <Button onClick={saveStep4} disabled={isSaving}>
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button variant="ghost" onClick={() => openStep(5)}>
                  Далее
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === 5 ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">Описание объекта</h2>
              <TextArea
                className="h-32"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Описание объекта"
              />
              <p className="rounded-xl bg-cream p-3 text-sm text-olive/75">
                Услуги и оснащение редактируются в шаге «Удобства в номерах» через номера.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep(4)}>
                  Назад
                </Button>
                <Button onClick={saveStep5} disabled={isSaving}>
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button variant="ghost" onClick={() => openStep(6)}>
                  Далее
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === 6 ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">Правила проживания</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-olive">Заезд после</span>
                  <TimePicker
                    name="checkInFrom"
                    value={checkInFrom}
                    onChange={setCheckInFrom}
                    ariaLabel="Время заезда"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-olive">Выезд до</span>
                  <TimePicker
                    name="checkOutUntil"
                    value={checkOutUntil}
                    onChange={setCheckOutUntil}
                    ariaLabel="Время выезда"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={childrenAllowed === true ? "primary" : "ghost"}
                  onClick={() => setChildrenAllowed(true)}
                >
                  Дети: да
                </Button>
                <Button
                  variant={childrenAllowed === false ? "primary" : "ghost"}
                  onClick={() => {
                    setChildrenAllowed(false);
                    setChildrenMinAge(null);
                  }}
                >
                  Дети: нет
                </Button>
              </div>
              {childrenAllowed ? (
                <div className="space-y-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={17}
                    value={childrenMinAge ?? ""}
                    onChange={(event) =>
                      setChildrenMinAge(event.target.value ? Number(event.target.value) : null)
                    }
                    placeholder="Возраст детей с"
                  />
                  <p className="text-xs text-olive/60">
                    Если поле оставить пустым, разрешены дети любого возраста.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-olive">Животные</span>
                  <select
                    className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
                    value={petsPolicy}
                    onChange={(event) => setPetsPolicy(event.target.value as PetsPolicy)}
                  >
                    {petsPolicyOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-olive">Курение</span>
                  <select
                    className="w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-sm text-olive"
                    value={smokingPolicy}
                    onChange={(event) => setSmokingPolicy(event.target.value as SmokingPolicy)}
                  >
                    {smokingPolicyOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={quietHoursEnabled === true ? "primary" : "ghost"}
                  onClick={() => setQuietHoursEnabled(true)}
                >
                  Тихие часы: да
                </Button>
                <Button
                  variant={quietHoursEnabled === false ? "primary" : "ghost"}
                  onClick={() => {
                    setQuietHoursEnabled(false);
                    setQuietHoursFrom("");
                    setQuietHoursTo("");
                  }}
                >
                  Тихие часы: нет
                </Button>
              </div>
              {quietHoursEnabled ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TimePicker
                    name="quietHoursFrom"
                    value={quietHoursFrom}
                    onChange={setQuietHoursFrom}
                    ariaLabel="Начало тихих часов"
                  />
                  <TimePicker
                    name="quietHoursTo"
                    value={quietHoursTo}
                    onChange={setQuietHoursTo}
                    ariaLabel="Конец тихих часов"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold text-olive">Дополнительные условия</h3>
                  <p className="text-xs leading-5 text-olive/55">
                    Парковка, питание и предоплата теперь собираются короткими вариантами и
                    аккуратно отображаются на витрине.
                  </p>
                </div>
                <PropertyRulesExtraFields
                  parkingInfo={parkingInfo}
                  onParkingInfoChange={setParkingInfo}
                  mealOptions={mealOptions}
                  onMealOptionsChange={setMealOptions}
                  prepaymentPolicy={prepaymentPolicy}
                  onPrepaymentPolicyChange={setPrepaymentPolicy}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep(5)}>
                  Назад
                </Button>
                <Button variant="ghost" onClick={() => openStep(7)}>
                  Далее
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === 7 ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">КСР</h2>
              <div className="rounded-xl border border-olive/15 bg-white p-4 text-sm text-olive/80">
                <p className="font-semibold text-olive">
                  Добавьте номер записи в реестре классифицированных средств размещения
                </p>
                <p className="mt-2">
                  Номер записи обязателен для средств размещения: гостиниц, отелей, хостелов,
                  санаториев, баз отдыха, кемпингов, глэмпингов, гостевых домов в регионах
                  эксперимента и похожих объектов. Он нужен для проверки статуса объекта и
                  модерации.
                </p>
                <p className="mt-2">
                  Если объект является жилым помещением и не используется для услуг средства
                  размещения, номер записи может быть неприменим.
                </p>
                <p className="mt-2 text-xs text-olive/70">
                  Основание: ФЗ N 132-ФЗ от 24.11.1996, ФЗ N 436-ФЗ от 30.11.2024, постановления
                  Правительства РФ N 1951 и N 1952 от 27.12.2024, ФЗ N 127-ФЗ от 07.06.2025.
                </p>
                <a
                  href="https://tourism.fsa.gov.ru/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-terra hover:underline"
                >
                  Перейти в реестр КСР
                </a>
              </div>
              <Input
                value={registryNumber}
                onChange={(event) => setRegistryNumber(event.target.value)}
                placeholder="Номер записи в реестре"
              />

              {registryNumber.trim().length > 0 ? (
                <p className="rounded-xl bg-sage/20 p-3 text-sm text-olive/80">
                  Номер записи в реестре добавлен:{" "}
                  <span className="font-semibold">{registryNumber.trim()}</span>
                </p>
              ) : (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  Укажите номер записи в реестре КСР, чтобы продолжить заполнение объекта.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep(3)}>
                  Назад
                </Button>
                <Button onClick={saveStep7} disabled={isSaving}>
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button variant="ghost" onClick={() => openStep(4)}>
                  Далее
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === 8 ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">Фото и видео</h2>
              <PropertyMediaManager
                propertyId={property.id}
                initialMedia={property.media}
                onChanged={refreshProperty}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep(7)}>
                  Назад
                </Button>
                <Button variant="ghost" onClick={() => openStep(9)}>
                  Далее
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === 9 ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">Номерной фонд</h2>
              <RoomFundManager
                propertyId={property.id}
                initialRooms={initialRooms}
                onChanged={refreshProperty}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep(8)}>
                  Назад
                </Button>
                <Button variant="ghost" onClick={() => openStep("room_amenities")}>
                  Далее
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === "room_amenities" ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">Удобства</h2>
              <RoomAmenitiesManager
                propertyId={property.id}
                initialRooms={initialRooms}
                roomFeatureItems={roomFeatureItems}
                onChanged={refreshProperty}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep(9)}>
                  Назад
                </Button>
                <Button variant="ghost" onClick={() => openStep(10)}>
                  Далее
                </Button>
              </div>
            </section>
          ) : null}

          {activeStep === 10 ? (
            <section className="wizard-section-enter space-y-4">
              <h2 className="text-lg font-semibold text-olive md:text-xl">Шахматка цен</h2>
              <div className="space-y-3 rounded-2xl border border-olive/15 bg-white p-4">
                <p className="text-sm text-olive/80">
                  Цены настраиваются только в шахматке этого объекта. Откройте шахматку и заполните
                  периоды цен по каждому номеру.
                </p>
                <p className="text-sm text-olive/80">
                  Статус цен:{" "}
                  <span className="font-semibold text-olive">
                    {property.progress.step10
                      ? "Готово, цены настроены по всем номерам"
                      : "Не завершено, заполните цены в шахматке"}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/chessboard?propertyId=${property.id}&from=prices`}
                    className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    Открыть шахматку
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => openStep("room_amenities")}>
                  Назад
                </Button>
                {property.progress.step10 ? (
                  <Link
                    href={`/dashboard/objects/${property.id}/payment`}
                    className="inline-flex items-center rounded-xl bg-terra px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    К публикации
                  </Link>
                ) : (
                  <span className="inline-flex cursor-not-allowed items-center rounded-xl bg-terra/45 px-4 py-2.5 text-sm font-semibold text-white/90">
                    К публикации после настройки цен
                  </span>
                )}
              </div>
            </section>
          ) : null}
        </main>

        <aside className="space-y-7 2xl:sticky 2xl:top-32 2xl:self-start">
          <section className="rounded-[8px] border border-olive/10 bg-white p-7 shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/8 text-primary">
                <AppIcon icon={Sparkles} className="h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold text-primary">Как заполнить этот раздел</h2>
            </div>

            <div className="mt-8 space-y-7">
              {sectionHelpItems.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <AppIcon icon={CheckCircle2} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-base font-semibold text-olive">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-olive/58">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-9 overflow-hidden rounded-[8px] border border-white/80 bg-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dashboard-prof/sections-housing.png"
                alt=""
                className="h-56 w-full object-cover"
              />
            </div>
          </section>

          <section className="rounded-[8px] border border-primary/20 bg-white p-6 shadow-[0_8px_28px_rgba(15,118,110,0.05)]">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] bg-primary text-white shadow-[0_12px_28px_rgba(15,118,110,0.22)]">
                <AppIcon icon={Save} className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-semibold text-primary">Заполняйте по шагам</p>
                <p className="mt-2 text-sm leading-6 text-olive/62">
                  Активный блок: {activeTopMilestone.title}. Черновик можно сохранить и вернуться
                  позже.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {isMapDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/55 sm:items-center sm:p-4">
          <div className="w-full max-h-[95vh] overflow-y-auto rounded-t-2xl border border-olive/15 bg-white p-4 shadow-2xl sm:max-w-4xl sm:rounded-2xl md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-olive">Отметка на карте</h3>
              <button
                type="button"
                onClick={closeMapDialog}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/15 text-olive/60 transition hover:bg-cream hover:text-olive"
                aria-label="Закрыть карту"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <YandexMapPicker
                latitude={mapDraftLatitude}
                longitude={mapDraftLongitude}
                onCoordinatesChange={(lat, lng) => {
                  setMapDraftLatitude(lat);
                  setMapDraftLongitude(lng);
                }}
                initialSearchValue={mapDraftLocationName || locationInput}
                onLocationSearchResolved={(item) => {
                  const exactMatch =
                    findLocationSuggestionByName(item.name, locationSuggestions) ??
                    findLocationSuggestionByName(
                      item.name,
                      crimeaLocations.map((location) => ({ id: location.id, name: location.name })),
                    );
                  setMapDraftLocationName(exactMatch?.name ?? item.name);
                  setMapDraftLocationId(exactMatch?.id ?? "");
                }}
                onAddressResolved={(resolvedItem) => {
                  setMapDraftAddress(resolvedItem.address);
                  const localityFromGeocode =
                    resolvedItem.localityDisplayName?.trim() ??
                    resolvedItem.localityName?.trim() ??
                    "";
                  if (localityFromGeocode) {
                    const exactMatch =
                      findLocationSuggestionByName(localityFromGeocode, locationSuggestions) ??
                      findLocationSuggestionByName(
                        localityFromGeocode,
                        crimeaLocations.map((location) => ({
                          id: location.id,
                          name: location.name,
                        })),
                      );
                    setMapDraftLocationName(exactMatch?.name ?? localityFromGeocode);
                    setMapDraftLocationId(exactMatch?.id ?? "");
                  }
                }}
              />
            </div>

            <div className="mt-3 rounded-xl bg-cream p-3 text-sm text-olive/80">
              <p>Населенный пункт: {mapDraftLocationName || "еще не определен"}</p>
              <p>
                Выбрано:{" "}
                {mapDraftLatitude !== null && mapDraftLongitude !== null
                  ? `${mapDraftLatitude.toFixed(6)}, ${mapDraftLongitude.toFixed(6)}`
                  : "точка не выбрана"}
              </p>
              <p className="mt-1 text-xs text-olive/65">
                Адрес по карте: {mapDraftAddress || "еще не определен"}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={closeMapDialog}>
                Закрыть
              </Button>
              <Button onClick={applyMapSelection}>Сохранить</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error message */}
      {error ? (
        <div className="wizard-label-enter flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5">
          <AppIcon icon={CircleX} className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {/* Footer info */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-olive/45">
        <span>Обновлено {new Date(property.updatedAt).toLocaleString("ru-RU")}</span>
        <span className="hidden sm:inline">|</span>
        <span>Номеров: {property.activeRoomsCount}</span>
        <span>
          Тип:{" "}
          {property.type ? (propertyTypeById[property.type]?.name ?? property.type) : "Не выбран"}
        </span>
      </div>
    </div>
  );
}
