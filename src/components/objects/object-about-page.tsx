"use client";

import Image from "next/image";
import {
  Building2,
  Check,
  Globe,
  ImageIcon as PhotoIcon,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type TextareaHTMLAttributes, useEffect, useMemo, useRef, useState } from "react";
import { FaqEditor } from "@/components/excursions/editor/faq-editor";
import { YandexMapPicker } from "@/components/maps/yandex-map-picker";
import { PropertyMediaManager } from "@/components/media/property-media-manager";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  crimeaLocations,
  normalizePropertyTypeId,
  propertyAboutLimits,
  propertyTypes,
} from "@/lib/constants";
import {
  normalizeMaxProfileUrl,
  normalizeOkProfileUrl,
  normalizeVkProfileUrl,
  normalizeWhatsappUrl,
} from "@/lib/contact-links";
import type { SerializedProperty } from "@/lib/properties";
import { normalizeTelegramProfileUrl } from "@/lib/telegram";
import { buildWebsiteFaviconUrl } from "@/lib/website-favicon";
import type { FaqItem } from "@/types/excursions";

type LocationSuggestionItem = {
  id: string;
  name: string;
};

type ReverseGeocodeItem = {
  address: string;
  localityName?: string | null;
  localityDisplayName?: string | null;
};

type ObjectAboutPageProps = {
  initialProperty: SerializedProperty;
  displayPropertyNumber: number;
  initialBlock?: AboutBlockId;
  basePath?: string;
};

type PatchStepResponse = {
  item: SerializedProperty;
};

type LocationLookupResponse = {
  items?: Array<{
    id: string;
    name: string;
  }>;
};

type AboutBlockId = "info" | "location" | "ksr" | "contacts" | "photo";
type AboutFieldId =
  | "type"
  | "name"
  | "description"
  | "location"
  | "address"
  | "map"
  | "registryNumber"
  | "phone";

const aboutBlockOrder: AboutBlockId[] = ["info", "location", "ksr", "contacts", "photo"];

const aboutBlockCopy: Record<AboutBlockId, { title: string; description: string }> = {
  info: {
    title: "Информация",
    description:
      "Начнем с базовых данных: выберите тип объекта, добавьте название и короткое понятное описание.",
  },
  location: {
    title: "Локация",
    description:
      "Укажите город, адрес и точку на карте. Так гости быстрее поймут, где находится объект.",
  },
  ksr: {
    title: "КСР",
    description:
      "Добавьте номер из реестра или спокойно пропустите шаг, если для вашего объекта он не нужен.",
  },
  contacts: {
    title: "Контакты",
    description:
      "Укажите телефоны и способы связи. Можно добавить несколько телефонов и выбрать удобные мессенджеры.",
  },
  photo: {
    title: "Фото",
    description:
      "Добавьте фото фасада, общих зон и территории. Хорошие снимки помогают гостям быстрее принять решение.",
  },
};

function getInitialBlock(property: SerializedProperty): AboutBlockId {
  if (!property.progress.step1 || !property.progress.step5) {
    return "info";
  }

  if (!property.progress.step3) {
    return "location";
  }

  if (!property.progress.step7) {
    return "ksr";
  }

  if (!property.progress.step4) {
    return "contacts";
  }

  return "photo";
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === "string" && body.error.trim().length > 0) {
      return body.error;
    }
  } catch {
    // Ignore parse error.
  }

  return fallback;
}

function normalizeLocation(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(
      /^(?:г\.?|город|пгт|с\.?|село|пос\.?|поселок(?:\s+городского\s+типа)?|посёлок(?:\s+городского\s+типа)?|д\.?|деревня|х\.?|хутор)\s+/,
      "",
    )
    .replace(/\s+/g, " ");
}

function normalizeLocationLookupText(value: string): string {
  return normalizeLocation(value)
    .replace(/[^a-z0-9а-я\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

export function ObjectAboutPage({
  initialProperty,
  displayPropertyNumber,
  initialBlock,
  basePath = "/dashboard/objects",
}: ObjectAboutPageProps) {
  const router = useRouter();
  const [property, setProperty] = useState(initialProperty);
  const [activeBlock, setActiveBlock] = useState<AboutBlockId>(() => {
    if (initialBlock && aboutBlockOrder.includes(initialBlock)) {
      return initialBlock;
    }

    return getInitialBlock(initialProperty);
  });
  const [isKsrWarningOpen, setIsKsrWarningOpen] = useState(false);

  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  const [isSavingKsr, setIsSavingKsr] = useState(false);
  const [isSkippingKsr, setIsSkippingKsr] = useState(false);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isResolvingLocationFromMap, setIsResolvingLocationFromMap] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AboutFieldId, string>>>({});

  const [selectedType, setSelectedType] = useState(
    normalizePropertyTypeId(initialProperty.type) ?? "",
  );
  const [description, setDescription] = useState(initialProperty.description ?? "");
  const [faqItems, setFaqItems] = useState<FaqItem[]>(initialProperty.faqItems ?? []);

  const [locationInput, setLocationInput] = useState(initialProperty.locationName ?? "");
  const [selectedLocationId, setSelectedLocationId] = useState(initialProperty.locationId ?? "");
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
  const locationResolveTokenRef = useRef(0);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestionItem[]>(
    crimeaLocations.map((location) => ({ id: location.id, name: location.name })),
  );

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
  const [whatsappUrl, setWhatsappUrl] = useState(initialProperty.whatsappUrl ?? "");
  const [telegramUrl, setTelegramUrl] = useState(initialProperty.telegramUrl ?? "");
  const [vkUrl, setVkUrl] = useState(initialProperty.vkUrl ?? "");
  const [maxUrl, setMaxUrl] = useState(initialProperty.maxUrl ?? "");
  const [okUrl, setOkUrl] = useState(initialProperty.okUrl ?? "");

  const [showPhone2, setShowPhone2] = useState(
    Boolean(initialProperty.phone2 || initialProperty.phone3),
  );
  const [showPhone3, setShowPhone3] = useState(Boolean(initialProperty.phone3));
  const [showWebsite, setShowWebsite] = useState(Boolean(initialProperty.websiteUrl));
  const [showWhatsapp, setShowWhatsapp] = useState(Boolean(initialProperty.whatsappUrl));
  const [showTelegram, setShowTelegram] = useState(Boolean(initialProperty.telegramUrl));
  const [showVk, setShowVk] = useState(Boolean(initialProperty.vkUrl));
  const [showMax, setShowMax] = useState(Boolean(initialProperty.maxUrl));
  const [showOk, setShowOk] = useState(Boolean(initialProperty.okUrl));
  const [failedWebsiteFaviconUrl, setFailedWebsiteFaviconUrl] = useState<string | null>(null);

  const websiteFaviconUrl = useMemo(() => buildWebsiteFaviconUrl(websiteUrl), [websiteUrl]);
  const shouldShowWebsiteFavicon = Boolean(
    websiteFaviconUrl && websiteFaviconUrl !== failedWebsiteFaviconUrl,
  );

  const [registryNumber, setRegistryNumber] = useState(
    initialProperty.registryNumberPending ?? initialProperty.registryNumber ?? "",
  );
  const hasKsrNumber = Boolean(
    (property.registryNumberPending ?? property.registryNumber ?? "").trim(),
  );
  const hasAnyNonKsrProgress =
    property.progress.step1 ||
    property.progress.step3 ||
    property.progress.step4 ||
    property.progress.step5 ||
    property.progress.step8;

  function setSoftError(message: string, field?: AboutFieldId) {
    setError(message);
    setSuccess("");
    setFieldErrors(field ? { [field]: message } : {});
  }

  function clearFieldError(field: AboutFieldId) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  const blockChecks: Array<{
    id: AboutBlockId;
    title: string;
    hint: string;
    icon: LucideIcon;
    done: boolean;
  }> = [
    {
      id: "info",
      title: "Информация",
      hint: "Тип, название, описание",
      icon: Building2,
      done: property.progress.step1 && property.progress.step5,
    },
    {
      id: "location",
      title: "Локация",
      hint: "Город, адрес, точка на карте",
      icon: MapPin,
      done: property.progress.step3,
    },
    {
      id: "ksr",
      title: "КСР",
      hint: "Реестр или причина пропуска",
      icon: ListChecks,
      done:
        property.progress.step7 &&
        (hasKsrNumber || (property.classificationApplicable === false && hasAnyNonKsrProgress)),
    },
    {
      id: "contacts",
      title: "Контакты",
      hint: "Телефоны и каналы связи",
      icon: Phone,
      done: property.progress.step4,
    },
    {
      id: "photo",
      title: "Фото",
      hint: "Фасад и общие зоны",
      icon: PhotoIcon,
      done: property.progress.step8,
    },
  ];

  const activeBlockIndex = aboutBlockOrder.indexOf(activeBlock);
  const previousBlock = activeBlockIndex > 0 ? aboutBlockOrder[activeBlockIndex - 1] : null;
  const isAnySaving =
    isSavingInfo || isSavingLocation || isSavingContacts || isSavingKsr || isSkippingKsr;
  const completedBlocksCount = blockChecks.filter((item) => item.done).length;
  const progressPercent = Math.round((completedBlocksCount / blockChecks.length) * 100);

  function moveToNextBlock() {
    if (activeBlockIndex >= aboutBlockOrder.length - 1) {
      router.push(`${basePath}/${property.id}/rules`);
      return;
    }

    setActiveBlock(aboutBlockOrder[activeBlockIndex + 1]);
  }

  async function saveActiveBlockBeforeSwitch(): Promise<boolean> {
    switch (activeBlock) {
      case "info":
        return saveInfoBlock();
      case "location":
        return saveLocationBlock();
      case "contacts":
        return saveContactsBlock();
      case "ksr": {
        const normalizedRegistryNumber = registryNumber.trim();

        if (!normalizedRegistryNumber) {
          if (!property.classificationApplicable) {
            return true;
          }

          setIsKsrWarningOpen(true);
          setError("");
          setSuccess("");
          setFieldErrors({});
          return false;
        }

        return saveKsrBlock();
      }
      case "photo":
      default:
        return true;
    }
  }

  async function switchBlockWithAutosave(nextBlock: AboutBlockId) {
    if (nextBlock === activeBlock || isAnySaving) {
      return;
    }

    const nextBlockIndex = aboutBlockOrder.indexOf(nextBlock);
    if (nextBlockIndex === -1) {
      return;
    }

    // Allow free backward navigation without forcing validation/save.
    if (nextBlockIndex <= activeBlockIndex) {
      setError("");
      setSuccess("");
      setFieldErrors({});
      setActiveBlock(nextBlock);
      return;
    }

    const saved = await saveActiveBlockBeforeSwitch();
    if (!saved) {
      return;
    }

    setActiveBlock(nextBlock);
  }

  function hasStrictLocationMatch(sourceValue: string, locationName: string): boolean {
    if (!sourceValue || !locationName) {
      return false;
    }

    if (sourceValue === locationName) {
      return true;
    }

    return ` ${sourceValue} `.includes(` ${locationName} `);
  }

  function findExactLocationSuggestion(
    value: string,
    items: LocationSuggestionItem[],
  ): LocationSuggestionItem | null {
    const normalizedValue = normalizeLocationLookupText(value);
    if (!normalizedValue) {
      return null;
    }

    return items.find((item) => normalizeLocationLookupText(item.name) === normalizedValue) ?? null;
  }

  async function resolveLocationFromAddress(
    addressValue: string,
    localityHint?: string,
  ): Promise<LocationSuggestionItem | null> {
    const candidates = [localityHint ?? "", addressValue]
      .map((value) => value.trim())
      .filter((value, index, self) => value.length > 0 && self.indexOf(value) === index);

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeLocationLookupText(candidate);
      if (!normalizedCandidate) {
        continue;
      }

      const builtInMatch = crimeaLocations.find((location) =>
        hasStrictLocationMatch(normalizedCandidate, normalizeLocationLookupText(location.name)),
      );
      if (builtInMatch) {
        return { id: builtInMatch.id, name: builtInMatch.name };
      }

      try {
        const response = await fetch(
          `/api/reference/locations?query=${encodeURIComponent(candidate)}`,
        );
        if (!response.ok) {
          continue;
        }

        const body = (await response.json()) as LocationLookupResponse;
        const strictMatch =
          body.items?.find((item) =>
            hasStrictLocationMatch(normalizedCandidate, normalizeLocationLookupText(item.name)),
          ) ?? null;
        if (strictMatch) {
          return { id: strictMatch.id, name: strictMatch.name };
        }
      } catch {
        continue;
      }
    }

    return null;
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

        const body = (await response.json()) as LocationLookupResponse;
        setLocationSuggestions(body.items ?? []);
      } catch {
        // Ignore aborted or transient request errors while typing.
      }
    }, 180);

    return () => {
      abortController.abort();
      clearTimeout(timer);
    };
  }, [locationInput]);

  useEffect(() => {
    const normalizedValue = normalizeLocationLookupText(locationInput);
    if (!normalizedValue) {
      return;
    }

    const exactMatch =
      locationSuggestions.find(
        (item) => normalizeLocationLookupText(item.name) === normalizedValue,
      ) ?? null;
    if (exactMatch && selectedLocationId !== exactMatch.id) {
      setSelectedLocationId(exactMatch.id);
    }
  }, [locationInput, locationSuggestions, selectedLocationId]);

  function openMapDialog() {
    setMapDraftLatitude(latitude);
    setMapDraftLongitude(longitude);
    setMapDraftAddress(address);
    setMapDraftLocationName(locationInput);
    setMapDraftLocationId(selectedLocationId);
    setIsMapDialogOpen(true);
    setError("");
    setFieldErrors({});
  }

  function closeMapDialog() {
    setIsMapDialogOpen(false);
  }

  function saveMapSelection() {
    if (mapDraftLatitude === null || mapDraftLongitude === null || !mapDraftAddress.trim()) {
      setSoftError("Выберите точку на карте и нажмите «Подтвердить геопозицию».", "map");
      return;
    }

    setLatitude(mapDraftLatitude);
    setLongitude(mapDraftLongitude);
    setAddress(mapDraftAddress.trim());
    setLocationInput(mapDraftLocationName.trim());
    setSelectedLocationId(mapDraftLocationId.trim());
    setIsMapDialogOpen(false);
    setError("");
    setSuccess("");
    setFieldErrors({});
  }

  function applyProperty(item: SerializedProperty) {
    setProperty(item);
    setSelectedType(normalizePropertyTypeId(item.type) ?? "");
    setDescription(item.description ?? "");
    setFaqItems(item.faqItems ?? []);
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
    setWhatsappUrl(item.whatsappUrl ?? "");
    setTelegramUrl(item.telegramUrl ?? "");
    setVkUrl(item.vkUrl ?? "");
    setMaxUrl(item.maxUrl ?? "");
    setOkUrl(item.okUrl ?? "");
    setShowPhone2(Boolean(item.phone2 || item.phone3));
    setShowPhone3(Boolean(item.phone3));
    setShowWebsite(Boolean(item.websiteUrl));
    setShowWhatsapp(Boolean(item.whatsappUrl));
    setShowTelegram(Boolean(item.telegramUrl));
    setShowVk(Boolean(item.vkUrl));
    setShowMax(Boolean(item.maxUrl));
    setShowOk(Boolean(item.okUrl));
    setRegistryNumber(item.registryNumberPending ?? item.registryNumber ?? "");
  }

  async function patchStep(
    step: 1 | 3 | 4 | 5 | 7,
    data: unknown,
  ): Promise<SerializedProperty | null> {
    const response = await fetch(`/api/properties/${property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, data }),
    });

    if (!response.ok) {
      setSoftError(await readErrorMessage(response, "Не удалось сохранить изменения"));
      return null;
    }

    const body = (await response.json()) as PatchStepResponse;
    applyProperty(body.item);
    setError("");
    setFieldErrors({});
    setSuccess("Изменения сохранены");
    return body.item;
  }

  async function saveInfoBlock(): Promise<boolean> {
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    if (!selectedType) {
      setSoftError("Выберите тип объекта, чтобы продолжить", "type");
      return false;
    }

    if (!normalizedName) {
      setSoftError("Введите название объекта, чтобы продолжить", "name");
      return false;
    }

    if (!normalizedDescription) {
      setSoftError("Добавьте короткое описание объекта, чтобы продолжить", "description");
      return false;
    }

    if (normalizedDescription.length < propertyAboutLimits.description.min) {
      setSoftError(
        `Описание объекта должно содержать минимум ${propertyAboutLimits.description.min} символов`,
        "description",
      );
      return false;
    }

    if (normalizedDescription.length > propertyAboutLimits.description.max) {
      setSoftError(
        `Описание объекта не должно превышать ${propertyAboutLimits.description.max} символов`,
        "description",
      );
      return false;
    }

    if (faqItems.some((item) => item.q.trim().length > propertyAboutLimits.faq.questionMax)) {
      setSoftError(
        `Вопрос в FAQ не должен превышать ${propertyAboutLimits.faq.questionMax} символов`,
      );
      return false;
    }

    if (faqItems.some((item) => item.a.trim().length > propertyAboutLimits.faq.answerMax)) {
      setSoftError(`Ответ в FAQ не должен превышать ${propertyAboutLimits.faq.answerMax} символов`);
      return false;
    }

    setIsSavingInfo(true);

    try {
      const normalizedFaqItems = faqItems
        .map((item) => ({
          q: item.q.trim(),
          a: item.a.trim(),
        }))
        .filter((item) => item.q.length > 0 && item.a.length > 0)
        .slice(0, propertyAboutLimits.faq.maxItems);

      const afterStep1 = await patchStep(1, { type: selectedType, name: normalizedName });
      if (!afterStep1) {
        return false;
      }

      const afterStep5 = await patchStep(5, {
        description: normalizedDescription,
        faqItems: normalizedFaqItems,
        amenityIds: [],
        customAmenities: [],
      });
      return Boolean(afterStep5);
    } finally {
      setIsSavingInfo(false);
    }
  }

  async function saveLocationBlock(): Promise<boolean> {
    const normalizedLocation = locationInput.trim();
    const normalizedAddress = address.trim();
    const normalizedSeaDistance = seaDistance.trim();

    if (!normalizedLocation) {
      setSoftError("Укажите город или населённый пункт, чтобы продолжить", "location");
      return false;
    }

    if (!normalizedAddress) {
      setSoftError("Укажите адрес объекта, чтобы продолжить", "address");
      return false;
    }

    if (latitude === null || longitude === null) {
      setSoftError("Поставьте метку на карте, чтобы продолжить", "map");
      return false;
    }

    const exactKnownLocation =
      crimeaLocations.find(
        (location) => normalizeLocation(location.name) === normalizeLocation(normalizedLocation),
      ) ?? null;

    setIsSavingLocation(true);
    try {
      const updated = await patchStep(3, {
        locationId: selectedLocationId || exactKnownLocation?.id || null,
        locationName: normalizedLocation,
        address: normalizedAddress,
        seaDistance: normalizedSeaDistance,
        latitude,
        longitude,
      });

      return Boolean(updated);
    } finally {
      setIsSavingLocation(false);
    }
  }

  async function saveContactsBlock(): Promise<boolean> {
    if (!phone.trim()) {
      setSoftError("Заполните номер телефона, чтобы продолжить", "phone");
      return false;
    }

    setIsSavingContacts(true);
    try {
      const updated = await patchStep(4, {
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
        listingChannels: "",
        whatsappUrl: showWhatsapp ? (normalizeWhatsappUrl(whatsappUrl) ?? "") : "",
        telegramUrl: showTelegram ? (normalizeTelegramProfileUrl(telegramUrl) ?? "") : "",
        vkUrl: normalizeVkProfileUrl(vkUrl) ?? "",
        maxUrl: showMax ? (normalizeMaxProfileUrl(maxUrl) ?? "") : "",
        okUrl: normalizeOkProfileUrl(okUrl) ?? "",
        receiveRequests: false,
      });
      return Boolean(updated);
    } finally {
      setIsSavingContacts(false);
    }
  }

  async function saveKsrBlock(): Promise<boolean> {
    const normalizedRegistryNumber = registryNumber.trim();

    if (!normalizedRegistryNumber) {
      setSoftError(
        "Укажите номер записи в реестре КСР или выберите пропуск шага",
        "registryNumber",
      );
      return false;
    }

    if (normalizedRegistryNumber.length < 3) {
      setSoftError("Номер записи в реестре слишком короткий", "registryNumber");
      return false;
    }

    setIsSavingKsr(true);
    try {
      const updated = await patchStep(7, {
        classificationApplicable: true,
        starRating: null,
        registryNumber: normalizedRegistryNumber,
        selfAssessmentPassed: null,
      });

      if (updated) {
        setError("");
        setFieldErrors({});
        setSuccess(
          "После отправки номер записи в реестре уйдет на модерацию. Если все хорошо, номер пройдет проверку.",
        );
      }

      return Boolean(updated);
    } finally {
      setIsSavingKsr(false);
    }
  }

  async function goNextFromInfo() {
    const saved = await saveInfoBlock();
    if (!saved) {
      return;
    }

    moveToNextBlock();
  }

  async function goNextFromLocation() {
    const saved = await saveLocationBlock();
    if (!saved) {
      return;
    }

    moveToNextBlock();
  }

  async function goNextFromKsr() {
    const normalizedRegistryNumber = registryNumber.trim();

    if (!normalizedRegistryNumber) {
      if (!property.classificationApplicable) {
        moveToNextBlock();
        return;
      }

      setIsKsrWarningOpen(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      return;
    }

    const saved = await saveKsrBlock();
    if (!saved) {
      return;
    }

    moveToNextBlock();
  }

  async function goNextFromContacts() {
    const saved = await saveContactsBlock();
    if (!saved) {
      return;
    }

    moveToNextBlock();
  }

  async function continueWithoutKsr() {
    setIsSkippingKsr(true);
    setError("");
    setSuccess("");
    setFieldErrors({});

    try {
      const updated = await patchStep(7, {
        classificationApplicable: false,
        starRating: null,
        registryNumber: null,
        registryDetails: null,
        selfAssessmentPassed: null,
      });

      if (!updated) {
        return;
      }

      setRegistryNumber("");
      setIsKsrWarningOpen(false);
      moveToNextBlock();
    } finally {
      setIsSkippingKsr(false);
    }
  }

  const activeBlockMeta = blockChecks[activeBlockIndex] ?? blockChecks[0];
  const activeBlockTitle = activeBlockMeta?.title ?? "Раздел";
  const activeBlockCopy = aboutBlockCopy[activeBlock];
  const isCurrentBlockSaving =
    (activeBlock === "info" && isSavingInfo) ||
    (activeBlock === "location" && isSavingLocation) ||
    (activeBlock === "contacts" && isSavingContacts) ||
    (activeBlock === "ksr" && (isSavingKsr || isSkippingKsr));
  const currentProgressPercent = Math.round(((activeBlockIndex + 1) / blockChecks.length) * 100);
  const hasUnsavedChanges = useMemo(() => {
    const savedType = normalizePropertyTypeId(property.type) ?? "";
    const savedRegistryNumber = property.registryNumberPending ?? property.registryNumber ?? "";

    return (
      selectedType !== savedType ||
      name !== (property.name ?? "") ||
      description !== (property.description ?? "") ||
      JSON.stringify(faqItems) !== JSON.stringify(property.faqItems ?? []) ||
      locationInput !== (property.locationName ?? "") ||
      selectedLocationId !== (property.locationId ?? "") ||
      address !== (property.address ?? "") ||
      seaDistance !== (property.seaDistance ?? "") ||
      latitude !== property.latitude ||
      longitude !== property.longitude ||
      phone !== (property.phone ?? "") ||
      phoneName !== (property.phoneName ?? "") ||
      phone2 !== (property.phone2 ?? "") ||
      phone2Name !== (property.phone2Name ?? "") ||
      phone3 !== (property.phone3 ?? "") ||
      phone3Name !== (property.phone3Name ?? "") ||
      websiteUrl !== (property.websiteUrl ?? "") ||
      contactEmail !== (property.contactEmail ?? "") ||
      contactPersonName !== (property.contactPersonName ?? "") ||
      contactPersonRole !== (property.contactPersonRole ?? "") ||
      whatsappUrl !== (property.whatsappUrl ?? "") ||
      telegramUrl !== (property.telegramUrl ?? "") ||
      vkUrl !== (property.vkUrl ?? "") ||
      maxUrl !== (property.maxUrl ?? "") ||
      okUrl !== (property.okUrl ?? "") ||
      registryNumber !== savedRegistryNumber
    );
  }, [
    address,
    contactEmail,
    contactPersonName,
    contactPersonRole,
    description,
    faqItems,
    latitude,
    locationInput,
    longitude,
    maxUrl,
    name,
    okUrl,
    phone,
    phone2,
    phone2Name,
    phone3,
    phone3Name,
    phoneName,
    property,
    registryNumber,
    seaDistance,
    selectedLocationId,
    selectedType,
    telegramUrl,
    vkUrl,
    websiteUrl,
    whatsappUrl,
  ]);
  const saveStatusLabel = isAnySaving
    ? "Сохраняем..."
    : hasUnsavedChanges
      ? "Есть несохраненные изменения"
      : "Сохранено";
  const saveStatusClass = isAnySaving
    ? "bg-primary/10 text-primary"
    : hasUnsavedChanges
      ? "bg-amber-50 text-amber-800"
      : "bg-sage/20 text-olive";
  const mobilePrimaryActionLabel =
    activeBlock === "photo"
      ? "Готово"
      : isCurrentBlockSaving
        ? "Сохраняем..."
        : "Сохранить и дальше";

  async function handlePrimaryBlockAction() {
    switch (activeBlock) {
      case "info":
        await goNextFromInfo();
        return;
      case "location":
        await goNextFromLocation();
        return;
      case "ksr":
        await goNextFromKsr();
        return;
      case "contacts":
        await goNextFromContacts();
        return;
      case "photo":
        router.push(`${basePath}/${property.id}/rules`);
        return;
      default:
        return;
    }
  }

  return (
    <div className="pb-28 sm:pb-0">
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <section className="rounded-3xl border border-olive/10 bg-white/95 p-4 shadow-[0_18px_44px_-34px_rgba(15,74,64,0.34)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Карточка недвижимости #{displayPropertyNumber}
              </p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight text-olive sm:text-3xl">
                Шаг {activeBlockIndex + 1} из {blockChecks.length} - {activeBlockCopy.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-olive/64">
                {activeBlockCopy.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold",
                  saveStatusClass,
                )}
              >
                {saveStatusLabel}
              </span>
              <span className="inline-flex items-center rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-olive/64">
                Готово {completedBlocksCount}/{blockChecks.length} ({progressPercent}%)
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-olive/8">
              <div
                className="wizard-progress-bar h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${currentProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="custom-scrollbar -mx-1 mt-4 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
            {blockChecks.map((item, index) => {
              const isCurrent = activeBlock === item.id;
              const StepIcon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.title}
                  onClick={() => void switchBlockWithAutosave(item.id)}
                  disabled={isAnySaving}
                  className={cn(
                    "group flex min-w-[128px] flex-1 items-center gap-2 overflow-hidden rounded-2xl border px-2.5 py-3 text-left transition-all duration-200 sm:min-w-0",
                    isCurrent
                      ? "border-primary/32 bg-primary/8 shadow-sm ring-1 ring-primary/14"
                      : "border-olive/10 bg-white hover:border-primary/20 hover:bg-cream/45",
                    !isCurrent && item.done && "text-olive",
                    !isCurrent && !item.done && "text-olive/68",
                    isAnySaving && "cursor-not-allowed opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                      isCurrent
                        ? "bg-primary/12 text-primary"
                        : item.done
                          ? "bg-white text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-olive/6 text-olive/50 group-hover:bg-primary/8 group-hover:text-primary",
                    )}
                  >
                    {item.done && !isCurrent ? (
                      <AppIcon icon={Check} className="h-4 w-4 wizard-check-enter" />
                    ) : (
                      <AppIcon icon={StepIcon} className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-[11px] font-semibold text-olive/42">
                      Шаг {index + 1}
                    </span>
                    <span className="block truncate text-sm font-semibold leading-tight text-olive">
                      {item.title}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {error ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          ) : success && !hasUnsavedChanges ? (
            <p className="mt-3 rounded-2xl border border-sage/30 bg-sage/15 px-3 py-2 text-sm text-olive/75">
              {success}
            </p>
          ) : null}
        </section>

        {activeBlock === "info" ? (
          <section className="wizard-section-enter overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)]">
            <div className="border-b border-olive/8 bg-white/50 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm shadow-primary/10">
                  <AppIcon icon={Building2} className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-olive">Информация об объекте</h2>
                  <p className="mt-1 text-sm leading-relaxed text-olive/58">
                    Заполните базовые сведения. Этого достаточно, чтобы перейти к адресу и
                    контактам.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-olive">1. Тип объекта</span>
                  {selectedType ? (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      Выбрано
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-olive/8 px-2.5 py-0.5 text-[11px] font-medium text-olive/50">
                      Не выбрано
                    </span>
                  )}
                </div>
                <p className="text-xs text-olive/50">
                  Выберите один вариант, который лучше всего описывает ваш объект
                </p>
                {fieldErrors.type ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {fieldErrors.type}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {propertyTypes.map((item) => {
                    const isSelected = selectedType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedType(item.id);
                          clearFieldError("type");
                        }}
                        className={cn(
                          "group flex items-center rounded-2xl border p-3.5 text-left transition-all duration-200",
                          isSelected
                            ? "border-primary/35 bg-gradient-to-br from-primary/8 to-foam ring-1 ring-primary/20 shadow-sm shadow-primary/10"
                            : "border-olive/12 bg-white/70 hover:border-olive/22 hover:bg-white hover:shadow-sm",
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm font-semibold leading-tight transition-colors",
                            isSelected ? "text-primary" : "text-olive/80 group-hover:text-olive",
                          )}
                        >
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-olive">2. Название объекта</span>
                <Input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearFieldError("name");
                  }}
                  maxLength={120}
                  placeholder="Например: Гостевой дом «Крымский»"
                  className={cn(fieldErrors.name && "border-amber-300 bg-amber-50/45")}
                />
                {fieldErrors.name ? (
                  <p className="text-xs font-medium text-amber-800">{fieldErrors.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-olive">3. Описание объекта</span>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      description.length > propertyAboutLimits.description.max
                        ? "text-red-500"
                        : "text-olive/45",
                    )}
                  >
                    {description.length}/{propertyAboutLimits.description.max}
                  </span>
                </div>
                <TextArea
                  value={description}
                  onChange={(event) => {
                    setDescription(
                      event.target.value.slice(0, propertyAboutLimits.description.max),
                    );
                    clearFieldError("description");
                  }}
                  maxLength={propertyAboutLimits.description.max}
                  rows={5}
                  placeholder="Расскажите об объекте: что делает его особенным, какая атмосфера, чем вы гордитесь"
                  className={cn(fieldErrors.description && "border-amber-300 bg-amber-50/45")}
                />
                {fieldErrors.description ? (
                  <p className="text-xs font-medium text-amber-800">{fieldErrors.description}</p>
                ) : null}
                <p className="text-xs text-olive/45">
                  Хорошее описание помогает гостям выбрать именно ваш объект. Оптимально 2-4 абзаца,
                  до {propertyAboutLimits.description.max} символов.
                </p>
              </div>

              <div className="space-y-3 rounded-3xl border border-primary/12 bg-gradient-to-br from-white via-foam/55 to-cream/70 p-4 shadow-[0_14px_34px_-24px_rgba(15,118,110,0.34)] sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/70 bg-white/75 px-3 py-2.5 shadow-sm shadow-olive/5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/12">
                      <AppIcon icon={ListChecks} className="h-4 w-4" />
                    </span>
                    <p className="truncate text-sm font-semibold text-olive">
                      Часто задаваемые вопросы
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/12">
                    {faqItems.filter((item) => item.q.trim() && item.a.trim()).length}/
                    {propertyAboutLimits.faq.maxItems}
                  </span>
                </div>
                <FaqEditor
                  items={faqItems}
                  onChange={(items) =>
                    setFaqItems(items.slice(0, propertyAboutLimits.faq.maxItems))
                  }
                  maxItems={propertyAboutLimits.faq.maxItems}
                  questionMaxLength={propertyAboutLimits.faq.questionMax}
                  answerMaxLength={propertyAboutLimits.faq.answerMax}
                  showCounters
                />
              </div>

              <div className="hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/8 bg-white/60 px-4 py-3 sm:flex">
                <p className="text-xs text-olive/50">Шаг 1 из 5 - Информация</p>
                <Button onClick={() => void goNextFromInfo()} disabled={isSavingInfo}>
                  {isSavingInfo ? "Сохраняем..." : "Далее"}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {activeBlock === "location" ? (
          <section className="wizard-section-enter overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)]">
            <div className="border-b border-olive/8 bg-white/50 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm shadow-primary/10">
                  <AppIcon icon={MapPin} className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-olive">Локация</h2>
                  <p className="mt-1 text-sm leading-relaxed text-olive/58">
                    Укажите населенный пункт, адрес и точку на карте. Это поможет гостям быстро
                    сориентироваться.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1.5 rounded-2xl border border-olive/10 bg-white/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-olive">1. Населённый пункт</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary/70">
                        <AppIcon icon={ListChecks} className="h-2.5 w-2.5" />
                        Список
                      </span>
                    </div>
                    <Input
                      value={locationInput}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        const exactMatch = findExactLocationSuggestion(
                          nextValue,
                          locationSuggestions,
                        );
                        setLocationInput(nextValue);
                        setSelectedLocationId(exactMatch?.id ?? "");
                        clearFieldError("location");
                      }}
                      list={`property-location-suggestions-${property.id}`}
                      placeholder="Начните вводить город или посёлок"
                      autoComplete="off"
                      className={cn(fieldErrors.location && "border-amber-300 bg-amber-50/45")}
                    />
                    <datalist id={`property-location-suggestions-${property.id}`}>
                      {locationSuggestions.map((item) => (
                        <option key={item.id} value={item.name} />
                      ))}
                    </datalist>
                    <p className="text-xs text-olive/55">
                      Выберите вариант из списка. Так объявление попадёт в правильный поиск по
                      Крыму.
                    </p>
                    {fieldErrors.location ? (
                      <p className="text-xs font-medium text-amber-800">{fieldErrors.location}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 rounded-2xl border border-olive/10 bg-white/70 p-3">
                      <span className="text-sm font-semibold text-olive">2. Адрес</span>
                      <Input
                        value={address}
                        onChange={(event) => {
                          setAddress(event.target.value);
                          clearFieldError("address");
                        }}
                        placeholder="Улица, дом"
                        className={cn(fieldErrors.address && "border-amber-300 bg-amber-50/45")}
                      />
                      {fieldErrors.address ? (
                        <p className="text-xs font-medium text-amber-800">{fieldErrors.address}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1.5 rounded-2xl border border-olive/10 bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-olive">До моря</span>
                        <span className="inline-flex items-center rounded-full bg-olive/8 px-2 py-0.5 text-[10px] font-medium text-olive/45">
                          Необяз.
                        </span>
                      </div>
                      <Input
                        value={seaDistance}
                        onChange={(event) => setSeaDistance(event.target.value)}
                        placeholder="700 м или 1.1 км"
                      />
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "overflow-hidden rounded-2xl border border-olive/15 bg-cream",
                    fieldErrors.map && "border-amber-300 ring-2 ring-amber-100",
                  )}
                >
                  <div className="relative h-52 sm:h-60 lg:h-64">
                    <Image
                      src="/crimea-map-preview.svg"
                      alt="Превью карты Крыма"
                      fill
                      sizes="(min-width: 1024px) 360px, 100vw"
                      className="scale-110 object-cover object-center"
                      priority={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight/60 via-midnight/15 to-transparent" />
                    <div className="absolute inset-x-4 bottom-4 space-y-2">
                      <div className="rounded-xl bg-white/92 px-3 py-2 text-xs text-olive shadow-sm">
                        <p className="truncate font-semibold">
                          {locationInput.trim() || "Населённый пункт не выбран"}
                        </p>
                        <p className="mt-0.5 truncate text-olive/58">
                          {address.trim() || "Адрес появится после выбора точки"}
                        </p>
                      </div>
                      <Button type="button" onClick={openMapDialog} className="w-full">
                        <AppIcon icon={MapPin} className="mr-1.5 h-4 w-4" />
                        Выбрать точку на карте
                      </Button>
                    </div>
                  </div>
                </div>
                {fieldErrors.map ? (
                  <p className="text-xs font-medium text-amber-800">{fieldErrors.map}</p>
                ) : null}
              </div>

              <div className="hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/8 bg-white/60 px-4 py-3 sm:flex">
                <p className="text-xs text-olive/50">Шаг 2 из 5 - Локация</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => previousBlock && void switchBlockWithAutosave(previousBlock)}
                    disabled={isAnySaving}
                  >
                    Назад
                  </Button>
                  <Button onClick={() => void goNextFromLocation()} disabled={isSavingLocation}>
                    {isSavingLocation ? "Сохраняем..." : "Далее"}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeBlock === "ksr" ? (
          <section className="wizard-section-enter space-y-4 rounded-3xl border border-olive/10 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AppIcon icon={ListChecks} className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-olive">Реестр КСР</h2>
                <p className="mt-1 text-sm leading-relaxed text-olive/58">
                  Этот раздел нужен для проверки средств размещения. Если ваш объект не относится к
                  ним, шаг можно пропустить.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-olive/15 bg-cream/35 p-4 text-sm text-olive/80">
              <p className="font-semibold text-olive">Что это такое?</p>
              <p className="mt-2">
                КСР - это реестр, по которому проверяют гостиницы, гостевые дома, базы отдыха,
                санатории, кемпинги и похожие форматы размещения.
              </p>
              <p className="mt-3 font-semibold text-olive">Можно ли пропустить этот шаг?</p>
              <p className="mt-1">
                Да, если вы сдаете обычное жилое помещение: квартиру, комнату, дом или часть дома
                без статуса гостиницы или гостевого дома. В этом случае нажмите &laquo;Далее&raquo;
                без номера и подтвердите пропуск.
              </p>
              <p className="mt-2">
                Если объект работает как средство размещения, номер записи нужен для модерации
                объявления.
              </p>
              <p className="mt-3 font-semibold text-olive">Как найти номер?</p>
              <p className="mt-1">
                Откройте реестр, найдите объект по названию или адресу и скопируйте номер записи.
              </p>
              <p className="mt-2 text-xs text-olive/55">
                Основание: ФЗ N 132-ФЗ от 24.11.1996, ФЗ N 436-ФЗ от 30.11.2024, постановления
                Правительства РФ N 1951 и N 1952 от 27.12.2024, ФЗ N 127-ФЗ от 07.06.2025.
              </p>
              <a
                href="https://tourism.fsa.gov.ru/"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-terra/10 px-3 py-2 text-sm font-semibold text-terra transition hover:bg-terra/15"
              >
                <AppIcon icon={Globe} className="h-4 w-4" />
                Открыть реестр КСР
              </a>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-olive">Номер записи в реестре</span>
              <Input
                value={registryNumber}
                onChange={(event) => {
                  setRegistryNumber(event.target.value);
                  clearFieldError("registryNumber");
                }}
                placeholder="Например: 012345678"
                className={cn(fieldErrors.registryNumber && "border-amber-300 bg-amber-50/45")}
              />
              <p className="text-xs text-olive/50">
                Скопируйте номер с сайта реестра и вставьте сюда
              </p>
              {fieldErrors.registryNumber ? (
                <p className="text-xs font-medium text-amber-800">{fieldErrors.registryNumber}</p>
              ) : null}
            </div>
            {!property.classificationApplicable ? (
              <p className="rounded-xl bg-sage/20 px-3 py-2 text-sm text-olive">
                КСР отмечен как неприменимый для этого объекта. Раздел завершен без номера реестра.
              </p>
            ) : null}
            {property.registryModerationPending ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                После отправки номер записи в реестре уйдет на модерацию. Если все хорошо, номер
                пройдет проверку и будет показан в карточке объекта.
                <span className="block pt-1 text-xs text-amber-700">
                  На проверке: {property.registryNumberPending}
                </span>
              </p>
            ) : null}
            {!property.registryModerationPending && property.registryNumber ? (
              <p className="rounded-xl bg-sage/20 px-3 py-2 text-sm text-olive">
                Подтвержденный номер в карточке: {property.registryNumber}
              </p>
            ) : null}
            <div className="hidden flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4 sm:flex">
              <Button
                variant="ghost"
                onClick={() => previousBlock && void switchBlockWithAutosave(previousBlock)}
                disabled={isAnySaving}
              >
                Назад
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void goNextFromKsr()} disabled={isSavingKsr}>
                  Далее
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {activeBlock === "contacts" ? (
          <section className="wizard-section-enter space-y-5 rounded-3xl border border-olive/10 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <AppIcon icon={Phone} className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-olive">Контакты</h2>
                <p className="mt-1 text-sm leading-relaxed text-olive/58">
                  Эти данные будут использоваться в объявлении, чтобы гости могли связаться с вами.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-olive/10 bg-cream/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-olive">Телефон 1</p>
                    <p className="mt-0.5 text-xs text-olive/55">Основной контакт для гостей</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    Обязательно
                  </span>
                </div>

                <div className="mt-3 grid gap-2.5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                      <AppIcon icon={Phone} className="h-4 w-4" />
                    </span>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        clearFieldError("phone");
                      }}
                      placeholder="Номер телефона"
                      className={cn(
                        "pl-10",
                        fieldErrors.phone && "border-amber-300 bg-amber-50/45",
                      )}
                    />
                    {fieldErrors.phone ? (
                      <p className="mt-1 text-xs font-medium text-amber-800">{fieldErrors.phone}</p>
                    ) : null}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                      <AppIcon icon={UserRound} className="h-4 w-4" />
                    </span>
                    <Input
                      value={phoneName}
                      onChange={(event) => setPhoneName(event.target.value)}
                      placeholder="Имя контактного лица"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {showPhone2 ? (
                <div className="rounded-2xl border border-olive/10 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-olive">Телефон 2</p>
                      <p className="mt-0.5 text-xs text-olive/55">Дополнительный контакт</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPhone2("");
                        setPhone2Name("");
                        setPhone3("");
                        setPhone3Name("");
                        setShowPhone2(false);
                        setShowPhone3(false);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/12 text-olive/45 transition hover:bg-cream hover:text-olive"
                      aria-label="Убрать второй телефон"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2.5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                        <AppIcon icon={Phone} className="h-4 w-4" />
                      </span>
                      <Input
                        type="tel"
                        value={phone2}
                        onChange={(event) => setPhone2(event.target.value)}
                        placeholder="Номер телефона"
                        className="pl-10"
                      />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                        <AppIcon icon={UserRound} className="h-4 w-4" />
                      </span>
                      <Input
                        value={phone2Name}
                        onChange={(event) => setPhone2Name(event.target.value)}
                        placeholder="Имя контактного лица"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {showPhone3 ? (
                <div className="rounded-2xl border border-olive/10 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-olive">Телефон 3</p>
                      <p className="mt-0.5 text-xs text-olive/55">Еще один контакт, если нужен</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPhone3("");
                        setPhone3Name("");
                        setShowPhone3(false);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/12 text-olive/45 transition hover:bg-cream hover:text-olive"
                      aria-label="Убрать третий телефон"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2.5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                        <AppIcon icon={Phone} className="h-4 w-4" />
                      </span>
                      <Input
                        type="tel"
                        value={phone3}
                        onChange={(event) => setPhone3(event.target.value)}
                        placeholder="Номер телефона"
                        className="pl-10"
                      />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                        <AppIcon icon={UserRound} className="h-4 w-4" />
                      </span>
                      <Input
                        value={phone3Name}
                        onChange={(event) => setPhone3Name(event.target.value)}
                        placeholder="Имя контактного лица"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {(!showPhone2 || (showPhone2 && !showPhone3)) && (
                <button
                  type="button"
                  onClick={() => {
                    if (!showPhone2) {
                      setShowPhone2(true);
                      return;
                    }

                    setShowPhone3(true);
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-olive/20 bg-cream/40 px-3 py-2 text-sm font-semibold text-olive/65 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  <AppIcon icon={Plus} className="h-4 w-4" />
                  Добавить еще телефон
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-olive/10 bg-white p-4">
              <p className="text-sm font-semibold text-olive">Email</p>
              <p className="mt-0.5 text-xs text-olive/55">
                Можно использовать для уведомлений или дополнительной связи.
              </p>
              <div className="relative mt-3">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                  <AppIcon icon={Mail} className="h-4 w-4" />
                </span>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="name@example.ru"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-olive/10 bg-white p-4">
              <p className="text-sm font-semibold text-olive">Сайт и соцсети</p>
              <p className="mt-0.5 text-xs text-olive/55">
                Добавьте только те каналы, которые действительно хотите показать гостям.
              </p>

              <div className="mt-3 space-y-2.5">
                {showWebsite ? (
                  <div className="relative">
                    <span
                      className={cn(
                        "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2",
                        shouldShowWebsiteFavicon ? "" : "text-[color:var(--icon-muted)]",
                      )}
                    >
                      {shouldShowWebsiteFavicon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={websiteFaviconUrl!}
                          alt=""
                          aria-hidden="true"
                          className="h-4 w-4 rounded-sm object-contain"
                          onError={() => setFailedWebsiteFaviconUrl(websiteFaviconUrl)}
                        />
                      ) : (
                        <AppIcon icon={Globe} className="h-4 w-4" />
                      )}
                    </span>
                    <Input
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="Сайт"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setWebsiteUrl("");
                        setShowWebsite(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Убрать сайт"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showWhatsapp ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="whatsapp" bare className="h-4 w-4" />
                    </span>
                    <Input
                      value={whatsappUrl}
                      onChange={(event) => setWhatsappUrl(event.target.value)}
                      onBlur={() =>
                        setWhatsappUrl((value) => normalizeWhatsappUrl(value) ?? value.trim())
                      }
                      placeholder="WhatsApp: номер или ссылка"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setWhatsappUrl("");
                        setShowWhatsapp(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Убрать WhatsApp"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showTelegram ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                    </span>
                    <Input
                      value={telegramUrl}
                      onChange={(event) => setTelegramUrl(event.target.value)}
                      onBlur={() =>
                        setTelegramUrl(
                          (value) => normalizeTelegramProfileUrl(value) ?? value.trim(),
                        )
                      }
                      placeholder="Telegram: @username или телефон"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTelegramUrl("");
                        setShowTelegram(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Убрать Telegram"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showVk ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="vk" bare className="h-4 w-4" />
                    </span>
                    <Input
                      value={vkUrl}
                      onChange={(event) => setVkUrl(event.target.value)}
                      placeholder="ВКонтакте URL"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setVkUrl("");
                        setShowVk(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Убрать ВКонтакте"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showOk ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="ok" bare className="h-4 w-4" />
                    </span>
                    <Input
                      value={okUrl}
                      onChange={(event) => setOkUrl(event.target.value)}
                      placeholder="Одноклассники URL"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOkUrl("");
                        setShowOk(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Убрать Одноклассники"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {showMax ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                      <ContactBrandMark brand="max" bare className="h-4 w-4" />
                    </span>
                    <Input
                      value={maxUrl}
                      onChange={(event) => setMaxUrl(event.target.value)}
                      placeholder="Max URL"
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMaxUrl("");
                        setShowMax(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                      aria-label="Убрать Max"
                    >
                      <AppIcon icon={X} className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                {(!showWebsite ||
                  !showWhatsapp ||
                  !showTelegram ||
                  !showVk ||
                  !showOk ||
                  !showMax) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {!showWebsite ? (
                      <button
                        type="button"
                        onClick={() => setShowWebsite(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/18 bg-cream/35 px-3 py-2 text-xs font-semibold text-olive/62 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        <AppIcon icon={Globe} className="h-4 w-4" />
                        Сайт
                      </button>
                    ) : null}
                    {!showWhatsapp ? (
                      <button
                        type="button"
                        onClick={() => setShowWhatsapp(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/18 bg-cream/35 px-3 py-2 text-xs font-semibold text-olive/62 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        <ContactBrandMark brand="whatsapp" bare className="h-4 w-4" />
                        WhatsApp
                      </button>
                    ) : null}
                    {!showTelegram ? (
                      <button
                        type="button"
                        onClick={() => setShowTelegram(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/18 bg-cream/35 px-3 py-2 text-xs font-semibold text-olive/62 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                        Telegram
                      </button>
                    ) : null}
                    {!showVk ? (
                      <button
                        type="button"
                        onClick={() => setShowVk(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/18 bg-cream/35 px-3 py-2 text-xs font-semibold text-olive/62 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        <ContactBrandMark brand="vk" bare className="h-4 w-4" />
                        ВКонтакте
                      </button>
                    ) : null}
                    {!showOk ? (
                      <button
                        type="button"
                        onClick={() => setShowOk(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/18 bg-cream/35 px-3 py-2 text-xs font-semibold text-olive/62 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        <ContactBrandMark brand="ok" bare className="h-4 w-4" />
                        Одноклассники
                      </button>
                    ) : null}
                    {!showMax ? (
                      <button
                        type="button"
                        onClick={() => setShowMax(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/18 bg-cream/35 px-3 py-2 text-xs font-semibold text-olive/62 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        <ContactBrandMark brand="max" bare className="h-4 w-4" />
                        Max
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="hidden flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4 sm:flex">
              <Button
                variant="ghost"
                onClick={() => previousBlock && void switchBlockWithAutosave(previousBlock)}
                disabled={isAnySaving}
              >
                Назад
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void goNextFromContacts()} disabled={isSavingContacts}>
                  Далее
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {activeBlock === "photo" ? (
          <section className="wizard-section-enter space-y-4 rounded-3xl border border-olive/10 bg-white p-4 sm:p-5">
            <div>
              <h2 className="text-xl font-semibold text-olive">Фото объекта</h2>
              <p className="mt-1 text-sm text-olive/55">
                Загрузите фотографии вашего объекта: фасад, территорию, общие зоны. Фото номеров
                добавляются отдельно на вкладке «Номера».
              </p>
            </div>
            <div className="grid gap-2 text-sm text-olive/70 sm:grid-cols-3">
              <div className="rounded-2xl border border-olive/10 bg-cream/35 p-3">
                <p className="font-semibold text-olive">Фасад</p>
                <p className="mt-1 text-xs leading-relaxed text-olive/58">
                  Лучше выбрать светлое фото входа или здания целиком.
                </p>
              </div>
              <div className="rounded-2xl border border-olive/10 bg-cream/35 p-3">
                <p className="font-semibold text-olive">Общие зоны</p>
                <p className="mt-1 text-xs leading-relaxed text-olive/58">
                  Покажите двор, ресепшен, кухню, бассейн или другие общие места.
                </p>
              </div>
              <div className="rounded-2xl border border-olive/10 bg-cream/35 p-3">
                <p className="font-semibold text-olive">Качество</p>
                <p className="mt-1 text-xs leading-relaxed text-olive/58">
                  Используйте четкие горизонтальные снимки без темных фильтров.
                </p>
              </div>
            </div>
            <PropertyMediaManager
              propertyId={property.id}
              initialMedia={property.media}
              onChanged={async () => {
                const response = await fetch(`/api/properties/${property.id}`);
                if (!response.ok) {
                  return;
                }
                const body = (await response.json()) as { item: SerializedProperty };
                applyProperty(body.item);
              }}
            />
            <div className="hidden flex-wrap items-center justify-between gap-2 border-t border-olive/10 pt-4 sm:flex">
              <Button
                variant="ghost"
                onClick={() => previousBlock && void switchBlockWithAutosave(previousBlock)}
                disabled={isAnySaving}
              >
                Назад
              </Button>
              <Button onClick={() => router.push(`${basePath}/${property.id}/rules`)}>
                Готово
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <div className="sticky-bottom-enter sticky bottom-0 z-30 -mx-4 border-t border-olive/10 glass-mobile-bar px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/45">
              Шаг {activeBlockIndex + 1} из {blockChecks.length}
            </p>
            <p className="truncate text-sm font-semibold text-olive">{activeBlockTitle}</p>
          </div>
          <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {completedBlocksCount}/{blockChecks.length}
          </span>
        </div>

        <div className={cn("mt-3 grid gap-2", previousBlock ? "grid-cols-2" : "grid-cols-1")}>
          {previousBlock ? (
            <Button
              variant="ghost"
              onClick={() => void switchBlockWithAutosave(previousBlock)}
              disabled={isAnySaving}
              className="min-h-11 w-full"
            >
              Назад
            </Button>
          ) : null}
          <Button
            onClick={() => void handlePrimaryBlockAction()}
            disabled={isAnySaving}
            className="min-h-11 w-full"
          >
            {mobilePrimaryActionLabel}
          </Button>
        </div>
      </div>

      {isMapDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/55 sm:items-center sm:p-4">
          <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-3xl border border-olive/15 bg-white p-4 shadow-2xl sm:max-w-4xl sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl text-olive">Выбор точки на карте</h3>
                <p className="text-xs text-olive/70">
                  Поставьте маркер на объект, подтвердите геопозицию и нажмите «Сохранить». Закрытие
                  по крестику не сохранит изменения.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMapDialog}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/20 text-olive hover:bg-cream"
                aria-label="Закрыть карту"
              >
                <AppIcon icon={X} className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <YandexMapPicker
                latitude={mapDraftLatitude}
                longitude={mapDraftLongitude}
                onCoordinatesChange={(nextLat, nextLng) => {
                  setMapDraftLatitude(nextLat);
                  setMapDraftLongitude(nextLng);
                }}
                initialSearchValue={mapDraftLocationName || locationInput}
                onLocationSearchResolved={(item) => {
                  const exactMatch =
                    findExactLocationSuggestion(item.name, locationSuggestions) ??
                    findExactLocationSuggestion(
                      item.name,
                      crimeaLocations.map((location) => ({ id: location.id, name: location.name })),
                    );
                  setMapDraftLocationName(exactMatch?.name ?? item.name);
                  setMapDraftLocationId(exactMatch?.id ?? "");
                }}
                onAddressResolved={(resolvedItem: ReverseGeocodeItem) => {
                  setMapDraftAddress(resolvedItem.address);
                  const localityFromGeocode =
                    resolvedItem.localityDisplayName?.trim() ??
                    resolvedItem.localityName?.trim() ??
                    "";

                  if (localityFromGeocode) {
                    setMapDraftLocationName(localityFromGeocode);
                    setMapDraftLocationId("");
                  }

                  const token = Date.now();
                  locationResolveTokenRef.current = token;
                  setIsResolvingLocationFromMap(true);

                  void resolveLocationFromAddress(resolvedItem.address, localityFromGeocode).then(
                    (resolvedLocation) => {
                      if (locationResolveTokenRef.current !== token) {
                        return;
                      }

                      setMapDraftLocationName(resolvedLocation?.name ?? localityFromGeocode);
                      setMapDraftLocationId(resolvedLocation?.id ?? "");
                      setIsResolvingLocationFromMap(false);
                    },
                  );
                }}
              />
            </div>

            <div className="mt-3 space-y-1 rounded-xl bg-cream p-3 text-sm text-olive/80">
              <p>
                Населенный пункт:{" "}
                <span className="font-semibold text-olive">
                  {mapDraftLocationName ||
                    (isResolvingLocationFromMap ? "Определяем..." : "Не определен")}
                </span>
              </p>
              <p>Адрес: {mapDraftAddress || "Не определен"}</p>
              <p className="text-xs text-olive/65">
                Координаты:{" "}
                {mapDraftLatitude !== null && mapDraftLongitude !== null
                  ? `${mapDraftLatitude.toFixed(6)}, ${mapDraftLongitude.toFixed(6)}`
                  : "точка не выбрана"}
              </p>
            </div>

            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={closeMapDialog} className="w-full sm:w-auto">
                Закрыть
              </Button>
              <Button onClick={saveMapSelection} className="w-full sm:w-auto">
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isKsrWarningOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/55 sm:items-center sm:p-4">
          <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl border border-olive/15 bg-white p-4 shadow-xl sm:max-w-xl sm:rounded-2xl">
            <h3 className="text-xl text-olive">Вы не добавили номер записи в реестре</h3>
            <p className="mt-2 text-sm text-olive/80">
              Продолжив без номера записи, вы подтверждаете, что объект не является средством
              размещения и передается как жилое помещение во временное владение и пользование. Для
              гостиницы, гостевого дома, санатория, базы отдыха, кемпинга или похожего формата номер
              записи в реестре обязателен.
            </p>
            <p className="mt-2 text-xs text-olive/70">
              Основание: ФЗ N 132-ФЗ от 24.11.1996, ФЗ N 436-ФЗ от 30.11.2024, постановления
              Правительства РФ N 1951 и N 1952 от 27.12.2024, ФЗ N 127-ФЗ от 07.06.2025.
            </p>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => setIsKsrWarningOpen(false)}
                disabled={isSkippingKsr}
                className="w-full sm:w-auto"
              >
                Назад
              </Button>
              <Button
                onClick={() => void continueWithoutKsr()}
                disabled={isSkippingKsr}
                className="w-full sm:w-auto"
              >
                {isSkippingKsr ? "Сохранение..." : "Идти дальше"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
