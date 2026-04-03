"use client";

import Image from "next/image";
import {
  BriefcaseBusiness,
  Building2,
  Check,
  Globe,
  ListChecks,
  MapPin,
  Phone,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type TextareaHTMLAttributes, useEffect, useMemo, useRef, useState } from "react";
import { FaqEditor } from "@/components/excursions/editor/faq-editor";
import { YandexMapPicker } from "@/components/maps/yandex-map-picker";
import { PropertyMediaManager } from "@/components/media/property-media-manager";
import { AppIcon } from "@/components/ui/app-icon";
import { ContactBrandMark } from "@/components/ui/contact-brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  crimeaLocations,
  mediaLimits,
  normalizePropertyTypeId,
  propertyAboutLimits,
  propertyTypes,
} from "@/lib/constants";
import { accommodationPhotoUploadLimitsLabel } from "@/lib/photo-upload";
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

const aboutBlockOrder: AboutBlockId[] = ["info", "location", "ksr", "contacts", "photo"];

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
  return normalizeLocation(value).replace(/[^a-z0-9а-я\s-]+/g, " ").replace(/\s+/g, " ").trim();
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
  const [phone2, setPhone2] = useState(initialProperty.phone2 ?? "");
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

  const [showContactRole, setShowContactRole] = useState(
    Boolean(initialProperty.contactPersonRole),
  );
  const [showWebsite, setShowWebsite] = useState(Boolean(initialProperty.websiteUrl));
  const [showListingChannels, setShowListingChannels] = useState(
    Boolean(initialProperty.listingChannels),
  );
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

  const blockChecks: Array<{ id: AboutBlockId; title: string; done: boolean }> = [
    {
      id: "info",
      title: "Информация",
      done: property.progress.step1 && property.progress.step5,
    },
    {
      id: "location",
      title: "Локация",
      done: property.progress.step3,
    },
    {
      id: "ksr",
      title: "КСР",
      done:
        property.progress.step7 &&
        (hasKsrNumber || (property.classificationApplicable === false && hasAnyNonKsrProgress)),
    },
    {
      id: "contacts",
      title: "Контакты",
      done: property.progress.step4,
    },
    {
      id: "photo",
      title: "Фото",
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

    return (
      items.find(
        (item) => normalizeLocationLookupText(item.name) === normalizedValue,
      ) ?? null
    );
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
  }

  function closeMapDialog() {
    setIsMapDialogOpen(false);
  }

  function saveMapSelection() {
    if (mapDraftLatitude === null || mapDraftLongitude === null || !mapDraftAddress.trim()) {
      setError("Выберите точку на карте и дождитесь определения адреса.");
      setSuccess("");
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
    setPhone2(item.phone2 ?? "");
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
      setError(await readErrorMessage(response, "Не удалось сохранить изменения"));
      setSuccess("");
      return null;
    }

    const body = (await response.json()) as PatchStepResponse;
    applyProperty(body.item);
    setError("");
    setSuccess("");
    return body.item;
  }

  async function saveInfoBlock(): Promise<boolean> {
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    if (!selectedType) {
      setError("Выберите тип объекта");
      setSuccess("");
      return false;
    }

    if (!normalizedName) {
      setError("Введите название объекта");
      setSuccess("");
      return false;
    }

    if (!normalizedDescription) {
      setError("Добавьте описание объекта");
      setSuccess("");
      return false;
    }

    if (normalizedDescription.length < propertyAboutLimits.description.min) {
      setError(
        `Описание объекта должно содержать минимум ${propertyAboutLimits.description.min} символов`,
      );
      setSuccess("");
      return false;
    }

    if (normalizedDescription.length > propertyAboutLimits.description.max) {
      setError(
        `Описание объекта не должно превышать ${propertyAboutLimits.description.max} символов`,
      );
      setSuccess("");
      return false;
    }

    if (faqItems.some((item) => item.q.trim().length > propertyAboutLimits.faq.questionMax)) {
      setError(`Вопрос в FAQ не должен превышать ${propertyAboutLimits.faq.questionMax} символов`);
      setSuccess("");
      return false;
    }

    if (faqItems.some((item) => item.a.trim().length > propertyAboutLimits.faq.answerMax)) {
      setError(`Ответ в FAQ не должен превышать ${propertyAboutLimits.faq.answerMax} символов`);
      setSuccess("");
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
      setError("Укажите населённый пункт");
      setSuccess("");
      return false;
    }

    if (!normalizedAddress) {
      setError("Укажите адрес объекта");
      setSuccess("");
      return false;
    }

    if (latitude === null || longitude === null) {
      setError("Поставьте метку на карте, чтобы сохранить координаты объекта");
      setSuccess("");
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
      setError("Введите телефон");
      setSuccess("");
      return false;
    }

    setIsSavingContacts(true);
    try {
      const normalizedContactPersonName = contactPersonName.trim();

      const updated = await patchStep(4, {
        phone: phone.trim(),
        phoneName: normalizedContactPersonName || (property.phoneName ?? ""),
        phone2: phone2.trim(),
        phone2Name: normalizedContactPersonName || (property.phone2Name ?? ""),
        phone3: property.phone3 ?? "",
        phone3Name: property.phone3Name ?? "",
        websiteUrl: websiteUrl.trim(),
        contactEmail: contactEmail.trim(),
        contactPersonName: normalizedContactPersonName,
        contactPersonRole: contactPersonRole.trim(),
        listingChannels: listingChannels.trim(),
        whatsappUrl: whatsappUrl.trim(),
        telegramUrl: normalizeTelegramProfileUrl(telegramUrl) ?? "",
        vkUrl: vkUrl.trim(),
        maxUrl: maxUrl.trim(),
        okUrl: okUrl.trim(),
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
      setError("Укажите номер записи в реестре КСР");
      setSuccess("");
      return false;
    }

    if (normalizedRegistryNumber.length < 3) {
      setError("Номер записи в реестре слишком короткий");
      setSuccess("");
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
  const isCurrentBlockSaving =
    (activeBlock === "info" && isSavingInfo) ||
    (activeBlock === "location" && isSavingLocation) ||
    (activeBlock === "contacts" && isSavingContacts) ||
    (activeBlock === "ksr" && (isSavingKsr || isSkippingKsr));
  const mobilePrimaryActionLabel =
    activeBlock === "photo"
      ? "К правилам"
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
    <div className="space-y-4 pb-28 sm:space-y-5 sm:pb-0">
      <div className="space-y-4 overflow-hidden rounded-3xl border border-primary/18 bg-gradient-to-br from-foam via-white to-cream p-4 shadow-[0_18px_34px_-26px_rgba(15,118,110,0.95)] sm:p-6">
        <div className="sm:hidden">
          <div className="rounded-[24px] border border-primary/12 bg-white/88 p-3 shadow-[0_20px_38px_-26px_rgba(15,118,110,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/60">
                  Этап {activeBlockIndex + 1}/{blockChecks.length}
                </p>
                <p className="mt-1 truncate text-lg font-semibold text-olive">
                  {activeBlockTitle}
                </p>
              </div>
              <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {completedBlocksCount}/{blockChecks.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-olive/55">
              Карточка объекта #{displayPropertyNumber}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl text-olive sm:text-3xl">Об объекте</h1>
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                этап {activeBlockIndex + 1} из {blockChecks.length}
              </span>
            </div>
          </div>

          <span className="inline-flex items-center rounded-full border border-primary/20 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary shadow-sm shadow-primary/10">
            {property.statusLabel}
          </span>
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/70 bg-white/75 p-3 backdrop-blur-sm sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-olive/55">
                Прогресс заполнения
              </span>
              <span className="text-xs font-semibold tabular-nums text-primary">
                {progressPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary/12">
              <div
                className="wizard-progress-bar h-full rounded-full bg-gradient-to-r from-primary via-teal-600 to-sun transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-olive/45 sm:hidden">
              Переключайтесь между шагами сверху, а продолжить можно из нижней панели.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-olive/70">
            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-primary">
              {completedBlocksCount}
            </span>
            <span>из {blockChecks.length} этапов</span>
          </div>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {blockChecks.map((item, index) => {
              const isCurrent = activeBlock === item.id;
              const statusLabel = isCurrent ? "Текущий" : item.done ? "Готово" : "Ожидает";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void switchBlockWithAutosave(item.id)}
                  disabled={isAnySaving}
                  className={cn(
                    "group rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                    index === blockChecks.length - 1 && "col-span-2",
                    isCurrent &&
                      "border-sun/50 bg-gradient-to-br from-sun/[0.10] to-sun/[0.04] shadow-[0_10px_18px_-14px_rgba(14,116,144,0.5)] ring-1 ring-sun/20",
                    !isCurrent &&
                      item.done &&
                      "border-primary/20 bg-white/95 hover:border-primary/30 hover:bg-primary/[0.04]",
                    !isCurrent &&
                      !item.done &&
                      "border-olive/12 bg-white/80 hover:border-olive/20 hover:bg-white",
                    isAnySaving && "cursor-not-allowed opacity-70",
                  )}
                  title={item.title}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-1.5 text-xs font-bold transition-colors",
                        isCurrent
                          ? "bg-sun text-white shadow-sm shadow-sun/30 ring-1 ring-white/80"
                          : item.done
                            ? "bg-primary/10 text-primary/85"
                            : "bg-olive/8 text-olive/60",
                      )}
                    >
                      {item.done && !isCurrent ? (
                        <AppIcon icon={Check} className="h-4 w-4 wizard-check-enter" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </span>

                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        isCurrent
                          ? "text-sun/95"
                          : item.done
                            ? "text-primary/65"
                            : "text-olive/45",
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <p
                    className={cn(
                      "mt-2 text-sm font-semibold leading-tight",
                      isCurrent
                        ? "font-bold text-olive"
                        : item.done
                          ? "text-olive/75"
                          : "text-olive/80",
                    )}
                  >
                    {item.title}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="custom-scrollbar hidden overflow-x-auto pb-2 sm:block">
            <div className="mx-auto flex min-w-max items-stretch justify-center gap-2">
              {blockChecks.map((item, index) => {
                const isCurrent = activeBlock === item.id;
                const statusLabel = isCurrent ? "Текущий" : item.done ? "Готово" : "Ожидает";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void switchBlockWithAutosave(item.id)}
                    disabled={isAnySaving}
                    className={cn(
                      "group min-w-[132px] rounded-2xl border px-3 py-3 text-left transition-all duration-200 sm:min-w-[148px]",
                      isCurrent &&
                        "border-sun/50 bg-gradient-to-br from-sun/[0.10] to-sun/[0.04] shadow-[0_10px_18px_-14px_rgba(14,116,144,0.5)] ring-1 ring-sun/20",
                      !isCurrent &&
                        item.done &&
                        "border-primary/20 bg-white/95 hover:border-primary/30 hover:bg-primary/[0.04]",
                      !isCurrent &&
                        !item.done &&
                        "border-olive/12 bg-white/80 hover:border-olive/20 hover:bg-white",
                      isAnySaving && "cursor-not-allowed opacity-70",
                    )}
                    title={item.title}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-bold transition-colors",
                          isCurrent
                            ? "bg-sun text-white shadow-sm shadow-sun/30 ring-1 ring-white/80"
                            : item.done
                              ? "bg-primary/10 text-primary/85"
                              : "bg-olive/8 text-olive/60",
                        )}
                      >
                        {item.done && !isCurrent ? (
                          <AppIcon icon={Check} className="h-4 w-4 wizard-check-enter" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </span>

                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide",
                          isCurrent
                            ? "text-sun/95"
                            : item.done
                              ? "text-primary/65"
                              : "text-olive/45",
                        )}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <p
                      className={cn(
                        "mt-2 text-sm font-semibold leading-tight",
                        isCurrent
                          ? "font-bold text-olive"
                          : item.done
                            ? "text-olive/75"
                            : "text-olive/80",
                      )}
                    >
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {activeBlock === "info" ? (
        <section className="wizard-section-enter overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-foam via-white to-cream shadow-[0_14px_36px_-18px_rgba(15,118,110,0.20)]">
          <div className="border-b border-olive/8 bg-white/50 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm shadow-primary/10">
                <AppIcon icon={Building2} className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-olive">Информация об объекте</h2>
                <p className="mt-0.5 text-sm text-olive/55">Тип, название и описание</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-olive/70">
              Заполните основные данные об объекте: выберите тип, укажите название и добавьте описание.
              Эти данные увидят гости при поиске жилья.
            </p>

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
              <p className="text-xs text-olive/50">Выберите один вариант, который лучше всего описывает ваш объект</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {propertyTypes.map((item) => {
                  const isSelected = selectedType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedType(item.id)}
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
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder="Например: Гостевой дом «Крымский»"
              />
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
                onChange={(event) =>
                  setDescription(event.target.value.slice(0, propertyAboutLimits.description.max))
                }
                maxLength={propertyAboutLimits.description.max}
                rows={5}
                placeholder="Расскажите об объекте: что делает его особенным, какая атмосфера, чем вы гордитесь"
              />
              <p className="text-xs text-olive/45">
                Хорошее описание помогает гостям выбрать именно ваш объект. Оптимально 2-4 абзаца,
                до {propertyAboutLimits.description.max} символов.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-olive/10 bg-white/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-olive">Часто задаваемые вопросы</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {faqItems.filter((item) => item.q.trim() && item.a.trim()).length}/
                  {propertyAboutLimits.faq.maxItems}
                </span>
              </div>
              <FaqEditor
                items={faqItems}
                onChange={(items) => setFaqItems(items.slice(0, propertyAboutLimits.faq.maxItems))}
                maxItems={propertyAboutLimits.faq.maxItems}
                questionMaxLength={propertyAboutLimits.faq.questionMax}
                answerMaxLength={propertyAboutLimits.faq.answerMax}
                showCounters
              />
            </div>

            <div className="hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/8 bg-white/60 px-4 py-3 sm:flex">
              <p className="text-xs text-olive/50">Шаг 1 из 5 — Информация</p>
              <Button onClick={() => void goNextFromInfo()} disabled={isSavingInfo}>
                {isSavingInfo ? "Сохраняем..." : "Далее →"}
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
                <p className="mt-0.5 text-sm text-olive/55">Адрес и расположение на карте</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-olive/70">
              Укажите, где находится ваш объект. Гости смогут найти его по населённому пункту и увидят точку на карте.
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-olive">Населённый пункт</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary/70">
                  <AppIcon icon={ListChecks} className="h-2.5 w-2.5" />
                  Карта + список
                </span>
              </div>
              <Input
                value={locationInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  const exactMatch = findExactLocationSuggestion(nextValue, locationSuggestions);
                  setLocationInput(nextValue);
                  setSelectedLocationId(exactMatch?.id ?? "");
                }}
                list={`property-location-suggestions-${property.id}`}
                placeholder="Начните вводить и выберите из списка или по метке на карте"
                autoComplete="off"
              />
              <datalist id={`property-location-suggestions-${property.id}`}>
                {locationSuggestions.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
              <p className="text-xs text-olive/55">
                Можно выбрать населённый пункт вручную из списка. Метка на карте по-прежнему
                подставляет его автоматически.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-semibold text-olive">Адрес</span>
                <Input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Улица, дом"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-olive">Дистанция до моря</span>
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

            <div className="overflow-hidden rounded-2xl border border-olive/15 bg-cream">
              <div className="relative h-44 sm:h-52">
                <Image
                  src="/crimea-map-preview.svg"
                  alt="Превью карты Крыма"
                  fill
                  sizes="100vw"
                  className="scale-110 object-cover object-center"
                  priority={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-midnight/60 via-midnight/15 to-transparent" />
                <div className="absolute inset-x-4 bottom-4">
                  <Button type="button" onClick={openMapDialog} className="w-full sm:w-auto">
                    <AppIcon icon={MapPin} className="mr-1.5 h-4 w-4" />
                    Открыть карту
                  </Button>
                </div>
              </div>
            </div>

            <div className="hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/8 bg-white/60 px-4 py-3 sm:flex">
              <p className="text-xs text-olive/50">Шаг 2 из 5 — Локация</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => previousBlock && void switchBlockWithAutosave(previousBlock)}
                  disabled={isAnySaving}
                >
                  ← Назад
                </Button>
                <Button onClick={() => void goNextFromLocation()} disabled={isSavingLocation}>
                  {isSavingLocation ? "Сохраняем..." : "Далее →"}
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
              <p className="mt-0.5 text-sm text-olive/55">Классифицированные средства размещения</p>
            </div>
          </div>

          <div className="rounded-xl border border-olive/15 bg-cream/35 p-4 text-sm text-olive/80">
            <p className="font-semibold text-olive">
              Что это такое?
            </p>
            <p className="mt-2">
              Все гостиницы, отели и гостевые дома в России должны быть внесены в реестр КСР.
              Укажите номер записи из реестра — он нужен для прохождения модерации.
            </p>
            <p className="mt-2 font-semibold text-olive">Как найти номер?</p>
            <p className="mt-1">
              Перейдите на сайт реестра, найдите свой объект и скопируйте номер записи.
            </p>
            <p className="mt-2 text-xs text-olive/55">
              Требования ФЗ N 132 от 24.11.1996 и N 127 от 07.06.2025.
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
              onChange={(event) => setRegistryNumber(event.target.value)}
              placeholder="Например: 012345678"
            />
            <p className="text-xs text-olive/50">Скопируйте номер с сайта реестра и вставьте сюда</p>
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
        <section className="wizard-section-enter space-y-6 rounded-3xl border border-olive/10 bg-white p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <AppIcon icon={Phone} className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-olive">Контакты</h2>
              <p className="mt-0.5 text-sm text-olive/55">Как гости смогут с вами связаться</p>
            </div>
          </div>

          <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-olive/70">
            Укажите хотя бы один телефон — он обязателен. Мессенджеры и соцсети добавляйте по желанию, чтобы гостям было удобнее связаться.
          </p>

          {/* Required fields */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
              Основные данные (обязательно)
            </p>
            <div className="space-y-2.5">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                  <AppIcon icon={Phone} className="h-4 w-4" />
                </span>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Телефон *"
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                  <AppIcon icon={Phone} className="h-4 w-4" />
                </span>
                <Input
                  type="tel"
                  value={phone2}
                  onChange={(event) => setPhone2(event.target.value)}
                  placeholder="Телефон 2"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Optional fields */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
              Дополнительно
            </p>
            <div className="space-y-2.5">
              {showContactRole && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                    <AppIcon icon={BriefcaseBusiness} className="h-4 w-4" />
                  </span>
                  <Input
                    value={contactPersonRole}
                    onChange={(event) => setContactPersonRole(event.target.value)}
                    placeholder="Должность"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setContactPersonRole("");
                      setShowContactRole(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                </div>
              )}
              {showListingChannels && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--icon-muted)]">
                    <AppIcon icon={ListChecks} className="h-4 w-4" />
                  </span>
                  <Input
                    value={listingChannels}
                    onChange={(event) => setListingChannels(event.target.value)}
                    placeholder="Площадки размещения"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setListingChannels("");
                      setShowListingChannels(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Messengers & Socials */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-olive/40">
              Мессенджеры и соцсети
            </p>
            <div className="space-y-2.5">
              {showWebsite && (
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
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                </div>
              )}
              {showWhatsapp && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                    <ContactBrandMark brand="whatsapp" bare className="h-4 w-4" />
                  </span>
                  <Input
                    value={whatsappUrl}
                    onChange={(event) => setWhatsappUrl(event.target.value)}
                    placeholder="WhatsApp URL"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsappUrl("");
                      setShowWhatsapp(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                </div>
              )}
              {showTelegram && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                    <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                  </span>
                  <Input
                    value={telegramUrl}
                    onChange={(event) => setTelegramUrl(event.target.value)}
                    placeholder="Telegram: @username или username"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTelegramUrl("");
                      setShowTelegram(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[color:var(--icon-nav)] transition hover:text-[color:var(--icon-default)]"
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                </div>
              )}
              {showVk && (
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
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                </div>
              )}
              {showMax && (
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
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                </div>
              )}
              {showOk && (
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
                  >
                    <AppIcon icon={X} className="h-4 w-4" />
                  </button>
                </div>
              )}
              {(!showWebsite ||
                !showWhatsapp ||
                !showTelegram ||
                !showVk ||
                !showMax ||
                !showOk) && (
                <div className="flex flex-wrap gap-2">
                  {!showWebsite && (
                    <button
                      type="button"
                      onClick={() => setShowWebsite(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-olive/20 bg-cream/40 px-3 py-1.5 text-xs font-medium text-olive/60 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus:outline-none"
                    >
                      <AppIcon icon={Globe} className="h-4 w-4" />
                      Сайт
                    </button>
                  )}
                  {!showWhatsapp && (
                    <button
                      type="button"
                      onClick={() => setShowWhatsapp(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#25D366]/35 bg-[#25D366]/5 px-3 py-1.5 text-xs font-medium text-[#25D366] transition hover:border-[#25D366]/60 hover:bg-[#25D366]/10 focus:outline-none"
                    >
                      <ContactBrandMark brand="whatsapp" bare className="h-4 w-4" />
                      WhatsApp
                    </button>
                  )}
                  {!showTelegram && (
                    <button
                      type="button"
                      onClick={() => setShowTelegram(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#2AABEE]/35 bg-[#2AABEE]/5 px-3 py-1.5 text-xs font-medium text-[#2AABEE] transition hover:border-[#2AABEE]/60 hover:bg-[#2AABEE]/10 focus:outline-none"
                    >
                      <ContactBrandMark brand="telegram" bare className="h-4 w-4" />
                      Telegram
                    </button>
                  )}
                  {!showVk && (
                    <button
                      type="button"
                      onClick={() => setShowVk(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#0077FF]/35 bg-[#0077FF]/5 px-3 py-1.5 text-xs font-medium text-[#0077FF] transition hover:border-[#0077FF]/60 hover:bg-[#0077FF]/10 focus:outline-none"
                    >
                      <ContactBrandMark brand="vk" bare className="h-4 w-4" />
                      ВКонтакте
                    </button>
                  )}
                  {!showMax && (
                    <button
                      type="button"
                      onClick={() => setShowMax(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#FF6600]/35 bg-[#FF6600]/5 px-3 py-1.5 text-xs font-medium text-[#FF6600] transition hover:border-[#FF6600]/60 hover:bg-[#FF6600]/10 focus:outline-none"
                    >
                      <ContactBrandMark brand="max" bare className="h-4 w-4" />
                      Max
                    </button>
                  )}
                  {!showOk && (
                    <button
                      type="button"
                      onClick={() => setShowOk(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#EE8208]/35 bg-[#EE8208]/5 px-3 py-1.5 text-xs font-medium text-[#EE8208] transition hover:border-[#EE8208]/60 hover:bg-[#EE8208]/10 focus:outline-none"
                    >
                      <ContactBrandMark brand="ok" bare className="h-4 w-4" />
                      Одноклассники
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
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
              Загрузите фотографии вашего объекта — фасад, территорию, общие зоны. Фото номеров добавляются отдельно на вкладке «Номера».
            </p>
          </div>
          <p className="rounded-xl bg-primary/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-olive/70">
            Можно загрузить до {mediaLimits.property.images} фото и до{" "}
            {mediaLimits.property.videos} видео. Требования к фото: {accommodationPhotoUploadLimitsLabel}. Первое фото станет обложкой карточки.
          </p>
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
              Далее
            </Button>
          </div>
        </section>
      ) : null}

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
                  Поставьте маркер на объект и нажмите «Сохранить». Закрытие по крестику не сохранит
                  изменения.
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

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-sage/20 px-3 py-2 text-sm text-olive">{success}</p>
      ) : null}

      {isKsrWarningOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/55 sm:items-center sm:p-4">
          <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl border border-olive/15 bg-white p-4 shadow-xl sm:max-w-xl sm:rounded-2xl">
            <h3 className="text-xl text-olive">Вы не добавили номер записи в реестре</h3>
            <p className="mt-2 text-sm text-olive/80">
              Продолжив регистрацию объекта размещения без номера записи в реестре, вы
              подтверждаете, что объект предоставляется во временное владение и пользование и не
              используется для оказания услуг средства размещения.
            </p>
            <p className="mt-2 text-xs text-olive/70">
              Требования ФЗ N 132 от 24.11.1996 и N 127 от 07.06.2025.
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
