"use client";

import {
  Accessibility,
  AirVent,
  Baby,
  Bath,
  ChevronDown,
  CookingPot,
  Monitor,
  PanelsTopLeft,
  PawPrint,
  ShieldCheck,
  Shirt,
  Star,
  TvMinimalPlay,
  WashingMachine,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { SeaToggle } from "@/components/ui/sea-toggle";
import { cn } from "@/lib/cn";
import type { SerializedRoom } from "@/lib/rooms";

// Owner-facing editor for "Amenities in rooms" step.
// Each feature is edited and saved independently, so one failed save
// does not block editing of other feature cards.
type RoomFeatureItem = {
  id: string;
  name: string;
  category: string;
};

type RoomCategoryItem = {
  id: string;
  propertyName: string;
  title: string;
};

type AmenitySettingState = {
  enabled: boolean;
  isPaid: boolean | null;
  isKeyAmenity: boolean;
  applyToAllCategories: boolean;
  categoryIds: string[];
};

type AmenitySettingItem = {
  id: string;
  name: string;
  category: string;
  setting: AmenitySettingState;
};

type AmenityGroupDefinition = {
  key: string;
  title: string;
  featureIds: readonly string[];
  description?: string;
  icon: ReactNode;
};

type AmenityGroupView = {
  key: string;
  title: string;
  description?: string;
  icon: ReactNode;
  items: AmenitySettingItem[];
};

type RoomAmenitiesApiResponse = {
  items: AmenitySettingItem[];
  roomCategories: RoomCategoryItem[];
};

type RoomAmenitiesManagerProps = {
  propertyId: string;
  initialRooms?: SerializedRoom[];
  roomFeatureItems?: RoomFeatureItem[];
  onChanged?: () => Promise<void>;
};

const paidOptionFeatureIds = new Set<string>([
  "hair_dryer",
  "fan",
  "heater",
  "kettle",
  "mini_bar",
  "clothes_dryer",
  "iron",
  "ironing_board",
  "desk_lamp",
  "monitor",
  "pet_food",
  "safe",
  "lockers",
]);

const MAX_KEY_AMENITIES_PER_PROPERTY = 4;

const featureDisplayNameById: Record<string, string> = {
  heated_floor: "Тёплый пол",
  cookware: "Кухонные принадлежности и посуда / столовые приборы",
  water_tea_coffee: "Вода, чай и/или кофе",
  pet_towels: "Полотенца для купания",
  pet_cleanup_bags: "Пакеты для уборки за животными",
  pet_food: "Корм",
};

const keyAmenityStarIcon = <AppIcon icon={Star} className="h-4 w-4" filled aria-hidden />;

function renderFeatureIcon(featureId?: string) {
  return <AmenityIcon featureId={featureId} className="h-4 w-4" />;
}

const amenityGroupDefinitions: readonly AmenityGroupDefinition[] = [
  {
    key: "personal-care",
    title: "Для личной гигиены и ухода за собой",
    description: undefined,
    featureIds: [
      "shower",
      "bath",
      "shower_cabin",
      "toilet",
      "urinal",
      "bidet",
      "hygienic_shower",
      "toiletries",
      "hair_dryer",
    ],
    icon: <AppIcon icon={Bath} className="h-4 w-4" />,
  },
  {
    key: "clothes",
    title: "Одежда",
    featureIds: ["bathrobe", "slippers"],
    icon: <AppIcon icon={Shirt} className="h-4 w-4" />,
  },
  {
    key: "temperature",
    title: "Температурный режим",
    featureIds: [
      "air_conditioner",
      "fan",
      "heating",
      "heater",
      "fireplace",
      "electric_blanket",
      "heated_floor",
    ],
    icon: <AppIcon icon={AirVent} className="h-4 w-4" />,
  },
  {
    key: "food",
    title: "Питание",
    featureIds: [
      "private_kitchen",
      "kitchenette",
      "refrigerator",
      "stove",
      "oven",
      "microwave",
      "kettle",
      "coffee_machine",
      "cookware",
      "mini_bar",
      "water_tea_coffee",
    ],
    icon: <AppIcon icon={CookingPot} className="h-4 w-4" />,
  },
  {
    key: "clothing-care",
    title: "Для ухода за одеждой",
    featureIds: ["washing_machine", "dryer_machine", "clothes_dryer", "iron", "ironing_board"],
    icon: <AppIcon icon={WashingMachine} className="h-4 w-4" />,
  },
  {
    key: "window-view",
    title: "Вид из окна",
    featureIds: [
      "panoramic_windows",
      "no_window",
      "balcony",
      "view_city",
      "view_river",
      "view_lake",
      "view_sea",
      "partial_sea_view",
      "view_ocean",
      "view_embankment",
      "view_forest",
      "view_mountain",
      "view_stadium",
      "view_landmark",
      "view_courtyard",
    ],
    icon: <AppIcon icon={PanelsTopLeft} className="h-4 w-4" />,
  },
  {
    key: "work",
    title: "Для работы",
    featureIds: [
      "wifi",
      "desk",
      "sockets_near_desk",
      "adapter",
      "usb_port",
      "work_chair",
      "desk_lamp",
      "monitor",
    ],
    icon: <AppIcon icon={Monitor} className="h-4 w-4" />,
  },
  {
    key: "entertainment",
    title: "Развлечения",
    featureIds: ["tv", "online_cinema", "yandex_station"],
    icon: <AppIcon icon={TvMinimalPlay} className="h-4 w-4" />,
  },
  {
    key: "children",
    title: "Отдыхать с детьми",
    featureIds: [
      "kids_slippers",
      "kids_bathrobe",
      "kids_toiletries",
      "playpen",
      "feeding_chair",
      "changing_table",
      "baby_bath",
      "baby_monitor",
    ],
    icon: <AppIcon icon={Baby} className="h-4 w-4" />,
  },
  {
    key: "pets",
    title: "Отдыхать с животными",
    featureIds: [
      "pet_friendly",
      "pet_bowls",
      "pet_food_bowl",
      "pet_water_bowl",
      "pet_toiletries",
      "pet_bed",
      "pet_towels",
      "pet_pads",
      "pet_cleanup_bags",
      "pet_food",
      "paw",
    ],
    icon: <AppIcon icon={PawPrint} className="h-4 w-4" />,
  },
  {
    key: "accessibility",
    title: "Безбарьерная среда",
    featureIds: [
      "wheelchair_access",
      "elevator",
      "ramp",
      "accessible_space",
      "bedside_handrails",
      "bath_handrails",
      "toilet_handrails",
      "low_sink",
      "tilted_mirror",
      "barrier_free_shower",
      "shower_chair",
    ],
    icon: <AppIcon icon={Accessibility} className="h-4 w-4" />,
  },
  {
    key: "security",
    title: "Для полной безопасности",
    featureIds: ["safe", "lockers", "private_entrance"],
    icon: <AppIcon icon={ShieldCheck} className="h-4 w-4" />,
  },
] as const;

function supportsPaidOption(featureId: string): boolean {
  return paidOptionFeatureIds.has(featureId);
}

function readError(body: unknown, fallback: string): string {
  if (typeof body === "object" && body && "error" in body) {
    const value = (body as { error?: unknown }).error;
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getSelectedRoomIds(draft: AmenitySettingState, rooms: RoomCategoryItem[]): string[] {
  if (draft.applyToAllCategories) {
    return rooms.map((room) => room.id);
  }

  const roomIds = new Set(rooms.map((room) => room.id));
  return dedupe(draft.categoryIds).filter((roomId) => roomIds.has(roomId));
}

export function RoomAmenitiesManager({ propertyId, onChanged }: RoomAmenitiesManagerProps) {
  // The API returns canonical settings for all room features.
  // We keep local draft state per feature so each card can be edited/saved independently.
  const [items, setItems] = useState<AmenitySettingItem[]>([]);
  const [roomCategories, setRoomCategories] = useState<RoomCategoryItem[]>([]);
  const [draftByFeatureId, setDraftByFeatureId] = useState<Record<string, AmenitySettingState>>({});
  const [savingByFeatureId, setSavingByFeatureId] = useState<Record<string, boolean>>({});
  const [errorByFeatureId, setErrorByFeatureId] = useState<Record<string, string>>({});
  const [roomPickerOpenByFeatureId, setRoomPickerOpenByFeatureId] = useState<
    Record<string, boolean>
  >({});
  const [roomPickerSelectionByFeatureId, setRoomPickerSelectionByFeatureId] = useState<
    Record<string, string[]>
  >({});
  const roomPickerContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [starPulseByFeatureId, setStarPulseByFeatureId] = useState<Record<string, boolean>>({});
  const starPulseTimeoutByFeatureId = useRef<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");

  // Build render groups from static definitions + server-delivered feature settings.
  const groupedItems = useMemo<AmenityGroupView[]>(() => {
    const itemByFeatureId = new Map(items.map((item) => [item.id, item]));

    return amenityGroupDefinitions
      .map((group) => ({
        key: group.key,
        title: group.title,
        description: group.description,
        icon: group.icon,
        items: group.featureIds
          .map((featureId) => itemByFeatureId.get(featureId))
          .filter((item): item is AmenitySettingItem => Boolean(item)),
      }))
      .filter((group) => group.items.length > 0);
  }, [items]);
  const selectedKeyAmenitiesCount = useMemo(
    () =>
      Object.values(draftByFeatureId).filter((setting) => setting.enabled && setting.isKeyAmenity)
        .length,
    [draftByFeatureId],
  );
  const keyAmenitiesLimitReached = selectedKeyAmenitiesCount >= MAX_KEY_AMENITIES_PER_PROPERTY;

  async function load() {
    setIsLoading(true);
    setGlobalError("");

    try {
      const response = await fetch(`/api/properties/${propertyId}/room-amenities`);
      const body = (await response.json()) as RoomAmenitiesApiResponse & { error?: string };

      if (!response.ok) {
        setGlobalError(readError(body, "Не удалось загрузить настройки удобств"));
        return;
      }

      const nextItems = body.items ?? [];
      // Convert server payload to local editable draft map keyed by feature id.
      const nextDraft = nextItems.reduce(
        (map, item) => {
          const canUsePaidOption = supportsPaidOption(item.id);
          map[item.id] = {
            enabled: item.setting.enabled,
            isPaid: canUsePaidOption ? (item.setting.isPaid ?? false) : null,
            isKeyAmenity: item.setting.enabled && item.setting.isKeyAmenity === true,
            applyToAllCategories: item.setting.applyToAllCategories,
            categoryIds: dedupe(item.setting.categoryIds),
          };
          return map;
        },
        {} as Record<string, AmenitySettingState>,
      );

      setItems(nextItems);
      setRoomCategories(body.roomCategories ?? []);
      setDraftByFeatureId(nextDraft);
      setErrorByFeatureId({});
      setRoomPickerOpenByFeatureId({});
      setRoomPickerSelectionByFeatureId({});
      setStarPulseByFeatureId({});
    } catch {
      setGlobalError("Не удалось загрузить настройки удобств");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  useEffect(() => {
    return () => {
      Object.values(starPulseTimeoutByFeatureId.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      starPulseTimeoutByFeatureId.current = {};
    };
  }, []);

  function triggerStarPulse(featureId: string) {
    const previousTimeout = starPulseTimeoutByFeatureId.current[featureId];
    if (previousTimeout) {
      window.clearTimeout(previousTimeout);
    }

    setStarPulseByFeatureId((previous) => ({
      ...previous,
      [featureId]: true,
    }));

    starPulseTimeoutByFeatureId.current[featureId] = window.setTimeout(() => {
      setStarPulseByFeatureId((previous) => {
        const next = { ...previous };
        delete next[featureId];
        return next;
      });
      delete starPulseTimeoutByFeatureId.current[featureId];
    }, 450);
  }

  // Close room picker popovers on outside click or Escape.
  useEffect(() => {
    const openFeatureIds = Object.entries(roomPickerOpenByFeatureId)
      .filter(([, isOpen]) => isOpen)
      .map(([featureId]) => featureId);

    if (openFeatureIds.length === 0) {
      return;
    }

    const closeOpenPickers = () => {
      setRoomPickerOpenByFeatureId((previous) => {
        const next = { ...previous };
        openFeatureIds.forEach((featureId) => {
          delete next[featureId];
        });
        return next;
      });
      setRoomPickerSelectionByFeatureId((previous) => {
        const next = { ...previous };
        openFeatureIds.forEach((featureId) => {
          delete next[featureId];
        });
        return next;
      });
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const isInsideAnyOpenPicker = openFeatureIds.some((featureId) => {
        const container = roomPickerContainerRefs.current[featureId];
        return container ? container.contains(target) : false;
      });

      if (!isInsideAnyOpenPicker) {
        closeOpenPickers();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOpenPickers();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [roomPickerOpenByFeatureId]);

  function openRoomPicker(featureId: string, selectedRoomIds: string[]) {
    setRoomPickerSelectionByFeatureId((previous) => ({
      ...previous,
      [featureId]: dedupe(selectedRoomIds),
    }));
    setRoomPickerOpenByFeatureId({ [featureId]: true });
  }

  function closeRoomPicker(featureId: string) {
    setRoomPickerOpenByFeatureId((previous) => {
      const next = { ...previous };
      delete next[featureId];
      return next;
    });
    setRoomPickerSelectionByFeatureId((previous) => {
      const next = { ...previous };
      delete next[featureId];
      return next;
    });
  }

  function toggleRoomPickerSelection(featureId: string, roomId: string) {
    setRoomPickerSelectionByFeatureId((previous) => {
      const current = previous[featureId] ?? [];
      const next = current.includes(roomId)
        ? current.filter((item) => item !== roomId)
        : [...current, roomId];

      return {
        ...previous,
        [featureId]: dedupe(next),
      };
    });
  }

  function setDraft(featureId: string, nextDraft: AmenitySettingState) {
    setDraftByFeatureId((previous) => ({
      ...previous,
      [featureId]: nextDraft,
    }));
    setErrorByFeatureId((previous) => ({
      ...previous,
      [featureId]: "",
    }));
  }

  async function saveFeature(item: AmenitySettingItem, overrideDraft?: AmenitySettingState) {
    const draft = overrideDraft ?? draftByFeatureId[item.id] ?? item.setting;
    const canUsePaidOption = supportsPaidOption(item.id);
    const normalizedIsPaid = canUsePaidOption ? (draft.isPaid ?? false) : null;
    setSavingByFeatureId((previous) => ({ ...previous, [item.id]: true }));
    setErrorByFeatureId((previous) => ({ ...previous, [item.id]: "" }));

    try {
      const response = await fetch(`/api/properties/${propertyId}/room-amenities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureId: item.id,
          enabled: draft.enabled,
          // Only whitelisted features support paid/free switch.
          isPaid: normalizedIsPaid,
          isKeyAmenity: draft.enabled && draft.isKeyAmenity,
          applyToAllCategories: draft.applyToAllCategories,
          categoryIds: draft.categoryIds,
        }),
      });

      const body = (await response.json()) as {
        item?: {
          featureId: string;
          enabled: boolean;
          isPaid: boolean | null;
          isKeyAmenity: boolean;
          applyToAllCategories: boolean;
          categoryIds: string[];
        };
        error?: string;
      };

      if (!response.ok) {
        setErrorByFeatureId((previous) => ({
          ...previous,
          [item.id]: readError(body, "Не удалось сохранить настройки удобства"),
        }));
        return;
      }

      const saved = body.item;
      if (saved) {
        // Keep server-confirmed settings as source of truth and resync local draft.
        setItems((previous) =>
          previous.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  setting: {
                    enabled: saved.enabled,
                    isPaid: saved.isPaid,
                    isKeyAmenity: saved.isKeyAmenity,
                    applyToAllCategories: saved.applyToAllCategories,
                    categoryIds: saved.categoryIds,
                  },
                }
              : entry,
          ),
        );
        setDraftByFeatureId((previous) => ({
          ...previous,
          [item.id]: {
            enabled: saved.enabled,
            isPaid: canUsePaidOption ? (saved.isPaid ?? false) : null,
            isKeyAmenity: saved.enabled && saved.isKeyAmenity,
            applyToAllCategories: saved.applyToAllCategories,
            categoryIds: saved.categoryIds,
          },
        }));
      }

      if (onChanged) {
        await onChanged();
      }
    } catch {
      setErrorByFeatureId((previous) => ({
        ...previous,
        [item.id]: "Не удалось сохранить настройки удобства",
      }));
    } finally {
      setSavingByFeatureId((previous) => ({ ...previous, [item.id]: false }));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-olive/70">Загрузка удобств...</p>;
  }

  return (
    <div className="space-y-4">
      {globalError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{globalError}</p>
      ) : null}

      {groupedItems.map((group) => (
        <section key={group.key} className="rounded-2xl border border-olive/12 bg-white">
          <div className="flex items-center gap-3 border-b border-olive/8 px-4 py-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cream text-olive">
              {group.icon}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-olive">{group.title}</h3>
              {group.description ? (
                <p className="mt-0.5 text-xs leading-tight text-olive/55">{group.description}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 p-3 min-[480px]:grid-cols-2">
            {group.items.map((item) => {
              const draft = draftByFeatureId[item.id] ?? item.setting;
              const isSaving = savingByFeatureId[item.id] ?? false;
              const error = errorByFeatureId[item.id] ?? "";
              const canUsePaidOption = supportsPaidOption(item.id);
              const displayFeatureName = featureDisplayNameById[item.id] ?? item.name;
              const featureIcon = renderFeatureIcon(item.id);
              const selectedRoomIds = getSelectedRoomIds(draft, roomCategories);
              const pickerSelectedRoomIds =
                roomPickerSelectionByFeatureId[item.id] ?? selectedRoomIds;
              const allRoomsSelected =
                roomCategories.length === 0 || selectedRoomIds.length === roomCategories.length;
              const hasAtLeastOnePickedRoom =
                roomCategories.length === 0 || pickerSelectedRoomIds.length > 0;
              const selectionLabel = allRoomsSelected
                ? "Все номера"
                : `Выбрано: ${selectedRoomIds.length}`;
              const isRoomPickerOpen = roomPickerOpenByFeatureId[item.id] ?? false;
              const canMarkAsKeyAmenity = draft.isKeyAmenity || !keyAmenitiesLimitReached;
              const keyAmenityActionDisabled = isSaving || !canMarkAsKeyAmenity;
              const keyAmenityButtonTitle = canMarkAsKeyAmenity
                ? draft.isKeyAmenity
                  ? "Убрать из ключевых удобств"
                  : "Добавить в ключевые удобства"
                : `Можно выбрать не более ${MAX_KEY_AMENITIES_PER_PROPERTY} ключевых удобств`;

              return (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-xl border transition-all",
                    draft.enabled
                      ? "border-sage/60 bg-sage/10"
                      : "border-olive/10 bg-cream/30 hover:border-olive/20 hover:bg-cream/50",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                            draft.enabled ? "bg-sage/30 text-olive" : "bg-white/85 text-olive/60",
                          )}
                        >
                          {featureIcon}
                        </span>
                        <p className="min-w-0 text-sm font-medium leading-5 text-olive">
                          {displayFeatureName}
                        </p>
                      </div>
                    </div>
                    <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                      {draft.enabled ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!draft.isKeyAmenity && keyAmenitiesLimitReached) {
                              setErrorByFeatureId((previous) => ({
                                ...previous,
                                [item.id]: `Можно выбрать не более ${MAX_KEY_AMENITIES_PER_PROPERTY} ключевых удобств`,
                              }));
                              return;
                            }

                            const nextDraft: AmenitySettingState = {
                              ...draft,
                              isKeyAmenity: !draft.isKeyAmenity,
                            };
                            setDraft(item.id, nextDraft);
                            triggerStarPulse(item.id);
                            void saveFeature(item, nextDraft);
                          }}
                          disabled={keyAmenityActionDisabled}
                          aria-pressed={draft.isKeyAmenity}
                          aria-label={
                            draft.isKeyAmenity
                              ? `Убрать удобство ${item.name} из ключевых`
                              : `Добавить удобство ${item.name} в ключевые`
                          }
                          title={keyAmenityButtonTitle}
                          className={cn(
                            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-45",
                            draft.isKeyAmenity
                              ? "border-amber-300 bg-amber-100 text-amber-600 shadow-[0_0_0_2px_rgba(251,191,36,0.16)]"
                              : "border-olive/18 bg-white text-olive/45 hover:border-amber-300 hover:text-amber-500",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex h-4 w-4 items-center justify-center transition-transform",
                              starPulseByFeatureId[item.id] ? "animate-[pulse_420ms_ease-out]" : "",
                              draft.isKeyAmenity ? "scale-110" : "",
                            )}
                          >
                            {keyAmenityStarIcon}
                          </span>
                        </button>
                      ) : null}

                      <div
                        className="relative"
                        ref={(node) => {
                          roomPickerContainerRefs.current[item.id] = node;
                        }}
                      >
                        {draft.enabled ? (
                          <button
                            type="button"
                            onClick={() =>
                              isRoomPickerOpen
                                ? closeRoomPicker(item.id)
                                : openRoomPicker(item.id, selectedRoomIds)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-olive/15 bg-cream/35 px-2.5 py-1.5 text-left"
                          >
                            <span className="text-xs font-medium text-olive">{selectionLabel}</span>
                            <AppIcon
                              icon={ChevronDown}
                              className={cn(
                                "h-4 w-4 text-olive/70 transition-transform",
                                isRoomPickerOpen ? "rotate-180" : "",
                              )}
                            />
                          </button>
                        ) : null}

                        {draft.enabled && isRoomPickerOpen ? (
                          <>
                            <button
                              type="button"
                              aria-label="Закрыть выбор номеров"
                              onClick={() => closeRoomPicker(item.id)}
                              className="fixed inset-0 z-20 bg-black/10 sm:hidden"
                            />
                            <div className="fixed left-1/2 top-1/2 z-30 w-[calc(100vw-1.5rem)] max-w-[22rem] -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-xl border border-olive/15 bg-white p-3 shadow-lg sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:translate-x-0 sm:translate-y-0">
                              {roomCategories.length === 0 ? (
                                <p className="text-sm text-olive/70">
                                  Номера пока не добавлены. Подтвердите настройку, и она будет
                                  применяться ко всем номерам объекта.
                                </p>
                              ) : (
                                <div className="max-h-52 space-y-1 overflow-y-auto overscroll-contain pr-1 sm:max-h-72">
                                  {roomCategories.map((roomCategory) => {
                                    const selected = pickerSelectedRoomIds.includes(
                                      roomCategory.id,
                                    );

                                    return (
                                      <button
                                        key={roomCategory.id}
                                        type="button"
                                        onClick={() =>
                                          toggleRoomPickerSelection(item.id, roomCategory.id)
                                        }
                                        className="flex w-full items-start gap-2 rounded-lg border border-olive/12 bg-white px-3 py-2 text-left hover:bg-cream/40"
                                      >
                                        <span
                                          className={cn(
                                            "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold transition",
                                            selected
                                              ? "border-black bg-black text-white"
                                              : "border-zinc-400 bg-white text-transparent",
                                          )}
                                        >
                                          ✓
                                        </span>
                                        <span className="min-w-0">
                                          <span className="block truncate text-xs text-olive/70">
                                            {roomCategory.propertyName}
                                          </span>
                                          <span className="block text-sm font-medium leading-5 text-olive">
                                            {roomCategory.title}
                                          </span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {!hasAtLeastOnePickedRoom ? (
                                <p className="text-xs text-red-700">Выберите хотя бы один номер</p>
                              ) : null}

                              <div className="flex flex-wrap items-center gap-2">
                                <Button variant="ghost" onClick={() => closeRoomPicker(item.id)}>
                                  Отменить
                                </Button>
                                <Button
                                  onClick={async () => {
                                    const normalizedSelectedRoomIds = dedupe(
                                      pickerSelectedRoomIds.filter((roomId) =>
                                        roomCategories.some(
                                          (roomCategory) => roomCategory.id === roomId,
                                        ),
                                      ),
                                    );
                                    if (
                                      roomCategories.length > 0 &&
                                      normalizedSelectedRoomIds.length === 0
                                    ) {
                                      return;
                                    }
                                    const nextApplyToAll =
                                      roomCategories.length === 0 ||
                                      normalizedSelectedRoomIds.length === roomCategories.length;
                                    const nextDraft: AmenitySettingState = {
                                      ...draft,
                                      applyToAllCategories: nextApplyToAll,
                                      categoryIds: nextApplyToAll ? [] : normalizedSelectedRoomIds,
                                    };
                                    setDraft(item.id, nextDraft);
                                    await saveFeature(item, nextDraft);
                                    closeRoomPicker(item.id);
                                  }}
                                  disabled={isSaving || !hasAtLeastOnePickedRoom}
                                >
                                  {isSaving ? "Сохранение..." : "Подтвердить"}
                                </Button>
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>

                      <SeaToggle
                        pressed={draft.enabled}
                        onPressedChange={(nextEnabled) => {
                          const canUsePaidOption = supportsPaidOption(item.id);
                          const nextDraft: AmenitySettingState = nextEnabled
                            ? {
                                ...draft,
                                enabled: true,
                                // On switch ON default to "all rooms selected".
                                isPaid: canUsePaidOption ? (draft.isPaid ?? false) : null,
                                applyToAllCategories: true,
                                categoryIds: [],
                              }
                            : {
                                ...draft,
                                enabled: false,
                                isKeyAmenity: false,
                              };
                          setDraft(item.id, nextDraft);
                          if (nextEnabled) {
                            triggerStarPulse(item.id);
                          }
                          // Do not auto-open picker on switch click.
                          closeRoomPicker(item.id);
                          void saveFeature(item, nextDraft);
                        }}
                        disabled={isSaving}
                        aria-label={
                          draft.enabled
                            ? `Отключить удобство ${item.name}`
                            : `Включить удобство ${item.name}`
                        }
                      />
                    </div>
                  </div>

                  {draft.enabled ? (
                    <>
                      {canUsePaidOption ? (
                        <div className="border-t border-sage/25 px-3 pb-2.5 pt-2">
                          <div className="inline-flex rounded-lg border border-olive/20 bg-white p-0.5 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                const nextDraft: AmenitySettingState = {
                                  ...draft,
                                  isPaid: false,
                                };
                                setDraft(item.id, nextDraft);
                                void saveFeature(item, nextDraft);
                              }}
                              className={cn(
                                "rounded-md px-2 py-1 disabled:cursor-not-allowed disabled:opacity-55",
                                draft.isPaid === false ? "bg-primary text-white" : "text-olive/75",
                              )}
                              disabled={isSaving}
                            >
                              Бесплатно
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextDraft: AmenitySettingState = {
                                  ...draft,
                                  isPaid: true,
                                };
                                setDraft(item.id, nextDraft);
                                void saveFeature(item, nextDraft);
                              }}
                              className={cn(
                                "rounded-md px-2 py-1 disabled:cursor-not-allowed disabled:opacity-55",
                                draft.isPaid === true ? "bg-primary text-white" : "text-olive/75",
                              )}
                              disabled={isSaving}
                            >
                              Платно
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {error ? <p className="px-3 pb-2.5 text-xs text-red-700">{error}</p> : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
