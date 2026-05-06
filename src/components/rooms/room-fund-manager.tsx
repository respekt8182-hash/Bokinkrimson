"use client";

import { Bath, BedDouble, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomMediaManager } from "@/components/media/room-media-manager";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SeaToggle } from "@/components/ui/sea-toggle";
import { cn } from "@/lib/cn";
import { mediaLimits } from "@/lib/constants";
import { joinRoomTitleParts, normalizeRoomTitle } from "@/lib/room-title";
import {
  additionalPlaceTypeOptions,
  bathroomLocationOptions,
  bedTypeMaxCountById,
  bedTypeOptions,
  bedTypePlacesById,
  calculateBedCapacity,
  cloneDefaultBedSetsForRoomType,
  defaultRoomMeta,
  getAllowedBedTypeIdsForRoomType,
  getDefaultBedTypeForRoomType,
  getFixedMainPlacesForRoomType,
  roomNameSuggestionsByType,
  roomTypeLabelById,
  roomTypeOptions,
  resolveMainPlacesForRoomType,
  type AdditionalPlaceTypeId,
  type BathroomLocationId,
  type BathroomToiletId,
  type BedTypeId,
  type RoomBedConfiguration,
  type RoomMeta,
  type RoomTypeId,
} from "@/lib/room-catalog";
import type { SerializedRoom } from "@/lib/rooms";

// Owner-side UI for step 9 room management (room CRUD + media).
// Important: room amenities are edited in RoomAmenitiesManager, not here.
// This file intentionally focuses on room category meta (capacity, bathroom, media).

type RoomFundManagerProps = {
  propertyId: string;
  initialRooms: SerializedRoom[];
  initialCreateMode?: boolean;
  showCreateButton?: boolean;
  onChanged?: () => Promise<void>;
};

type BedRow = {
  id: string;
  type: BedTypeId;
  count: number;
};

type BedSet = {
  id: string;
  rows: BedRow[];
};

type RoomEditorSectionId = "general" | "capacity" | "beds" | "extra" | "bathroom" | "photo";

type RoomCardDetails = {
  title: string;
  bedsText: string;
  areaText: string | null;
  duplicateKey: string;
};

type RoomCardListItem = {
  room: SerializedRoom;
  cardDetails: RoomCardDetails;
  instanceNumber: number | null;
};

const CUSTOM_ROOM_NAME_VALUE = "__custom__";
const MAX_BEDS_PER_SET = 20;
const MAX_BED_ROWS_PER_SET = 10;
const MAX_BED_SETS = 10;
const MAX_TOTAL_GUESTS = 20;
const DEFAULT_BED_TYPE: BedTypeId = "double_queen";
const MOBILE_ROOMS_PAGE_SIZE = 4;
const DESKTOP_ROOMS_PAGE_SIZE = 5;
function toFloatOrNull(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntOrNull(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function formatAreaSqmForTitle(areaSqm: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(areaSqm);
}

function formatBedsLabel(value: number): string {
  const beds = Math.max(1, Math.floor(value));
  const abs = beds % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${beds} кроватей`;
  if (last === 1) return `${beds} кровать`;
  if (last >= 2 && last <= 4) return `${beds} кровати`;
  return `${beds} кроватей`;
}

function formatExtraPlacesLabel(value: number): string {
  const places = Math.max(0, Math.floor(value));
  const abs = places % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${places} доп. мест`;
  if (last === 1) return `${places} доп. место`;
  if (last >= 2 && last <= 4) return `${places} доп. места`;
  return `${places} доп. мест`;
}

function formatPlacesLabel(value: number): string {
  const places = Math.max(0, Math.floor(value));
  const abs = places % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return `${places} мест`;
  if (last === 1) return `${places} место`;
  if (last >= 2 && last <= 4) return `${places} места`;
  return `${places} мест`;
}

function formatFloorLabel(floor: number): string {
  return `${floor} этаж`;
}

function buildRoomTitle(roomName: string, floor: number | null = null): string {
  const normalizedRoomName = normalizeRoomTitle(roomName);
  return joinRoomTitleParts(
    [normalizedRoomName, typeof floor === "number" ? formatFloorLabel(floor) : null],
    " · ",
  ).slice(0, 120);
}

function buildAutoCreatedRoomPayload() {
  const roomType = defaultRoomMeta.roomType;
  const roomName = defaultRoomMeta.roomName;
  const initialBeds = resolveMainPlacesForRoomType(roomType);
  const initialBedSets = buildDefaultBedSetsForRoomType(roomType);
  const initialBedSetsMeta = initialBedSets
    .map((set) => buildBedConfigurationFromRows(set.rows))
    .filter((configuration) => configuration.length > 0);
  const bedConfiguration = initialBedSetsMeta[0] ?? [];

  return {
    title: buildRoomTitle(roomName),
    beds: initialBeds,
    extraBeds: 0,
    roomsCount: 1,
    areaSqm: null,
    bathroomType: "IN_ROOM",
    featureIds: [],
    customFeatures: [],
    meta: {
      ...defaultRoomMeta,
      roomType,
      roomName,
      floor: null,
      nameInExtranet: null,
      bedConfiguration,
      bedSets: initialBedSetsMeta,
      hasAdditionalPlaces: false,
      additionalPlaceTypes: [],
      hasPrivateBathroom: true,
      privateBathroomLocations: ["in_room"],
      privateToiletLocations: ["in_bathroom"],
      hasSharedBathroom: false,
      sharedBathroomLocations: [],
      sharedToiletLocations: [],
      privateBathroomCount: 1,
    },
  };
}

function resolvePrimaryBedUnits(room: SerializedRoom, roomMeta: RoomMeta): number {
  const primarySet =
    roomMeta.bedSets.length > 0
      ? (roomMeta.bedSets[0] ?? [])
      : roomMeta.bedConfiguration.length > 0
        ? roomMeta.bedConfiguration
        : [];
  const totalBeds = primarySet.reduce((sum, item) => sum + Math.max(0, Math.floor(item.count)), 0);
  return totalBeds > 0 ? totalBeds : Math.max(1, room.beds);
}

function makeLocalId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createBedRow(type: BedTypeId = DEFAULT_BED_TYPE, count = 1): BedRow {
  return {
    id: makeLocalId("bed-row"),
    type,
    count: Math.max(1, Math.min(MAX_BEDS_PER_SET, count)),
  };
}

function createBedSet(rows: BedRow[] = [createBedRow()]): BedSet {
  return {
    id: makeLocalId("bed-set"),
    rows: rows.length > 0 ? rows : [createBedRow()],
  };
}

function buildBedConfigurationFromRows(rows: BedRow[]): RoomBedConfiguration[] {
  const grouped = new Map<BedTypeId, number>();

  for (const row of rows) {
    if (!Number.isInteger(row.count) || row.count <= 0) {
      continue;
    }
    grouped.set(row.type, (grouped.get(row.type) ?? 0) + row.count);
  }

  const ordered = bedTypeOptions
    .map((option) => {
      const count = grouped.get(option.id) ?? 0;
      if (count <= 0) {
        return null;
      }
      return { type: option.id, count };
    })
    .filter((item): item is RoomBedConfiguration => item !== null);

  const limited: RoomBedConfiguration[] = [];
  let usedBeds = 0;
  for (const item of ordered) {
    if (usedBeds >= MAX_BEDS_PER_SET) {
      break;
    }
    const nextCount = Math.min(item.count, MAX_BEDS_PER_SET - usedBeds);
    if (nextCount <= 0) {
      continue;
    }
    limited.push({ type: item.type, count: nextCount });
    usedBeds += nextCount;
  }

  return limited;
}

function buildBedRowsFromConfiguration(configuration: RoomBedConfiguration[]): BedRow[] {
  const limitedRows = configuration
    .filter((item) => item.count > 0)
    .slice(0, MAX_BED_ROWS_PER_SET)
    .map((item) => createBedRow(item.type, item.count));

  return limitedRows.length > 0 ? limitedRows : [createBedRow()];
}

function buildDefaultBedSetsForRoomType(roomType: RoomTypeId): BedSet[] {
  const defaultSets = cloneDefaultBedSetsForRoomType(roomType).slice(0, MAX_BED_SETS);
  if (defaultSets.length === 0) {
    return [createBedSet([createBedRow(getDefaultBedTypeForRoomType(roomType), 1)])];
  }

  return defaultSets.map((set) => createBedSet(buildBedRowsFromConfiguration(set)));
}

function buildBedSetsFromMeta(
  meta: RoomMeta | null,
  fallbackRoomType: RoomTypeId = defaultRoomMeta.roomType,
): BedSet[] {
  const effectiveRoomType = meta?.roomType ?? fallbackRoomType;
  if (!meta) {
    return buildDefaultBedSetsForRoomType(effectiveRoomType);
  }

  const sourceSets =
    meta.bedSets.length > 0
      ? meta.bedSets
      : meta.bedConfiguration.length > 0
        ? [meta.bedConfiguration]
        : [];

  if (sourceSets.length === 0) {
    return buildDefaultBedSetsForRoomType(effectiveRoomType);
  }

  return sourceSets
    .slice(0, MAX_BED_SETS)
    .map((set) => createBedSet(buildBedRowsFromConfiguration(set)));
}

function getRoomNameFromState(selectedRoomName: string, customRoomName: string): string {
  if (selectedRoomName === CUSTOM_ROOM_NAME_VALUE) {
    return customRoomName.trim();
  }

  return selectedRoomName.trim();
}

function getLegacyMeta(room: SerializedRoom): RoomMeta {
  // Backward-compat fallback for older records that do not have meta yet.
  if (room.meta) {
    return room.meta;
  }

  const hasPrivateBathroom = room.bathroomType === "IN_ROOM";
  const hasSharedBathroom = room.bathroomType !== "IN_ROOM";
  const legacyBedConfiguration: RoomBedConfiguration[] = [
    {
      type: "single",
      count: Math.max(1, Math.min(MAX_BEDS_PER_SET, room.beds)),
    },
  ];

  return {
    ...defaultRoomMeta,
    roomName: room.title,
    floor: null,
    nameInExtranet: room.title,
    bedConfiguration: legacyBedConfiguration,
    bedSets: [legacyBedConfiguration],
    hasPrivateBathroom,
    hasSharedBathroom,
    sharedBathroomLocations:
      room.bathroomType === "OUTSIDE" ? ["outside"] : hasSharedBathroom ? ["on_floor"] : [],
    sharedToiletLocations:
      room.bathroomType === "OUTSIDE" ? ["outside"] : hasSharedBathroom ? ["on_floor"] : [],
    privateBathroomCount: hasPrivateBathroom ? 1 : null,
  };
}

export function RoomFundManager({
  propertyId,
  initialRooms,
  initialCreateMode = false,
  showCreateButton = true,
  onChanged,
}: RoomFundManagerProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [rooms, setRooms] = useState<SerializedRoom[]>(initialRooms);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [roomsLoadError, setRoomsLoadError] = useState("");
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isReorderingRooms, setIsReorderingRooms] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [openedRoomMenuId, setOpenedRoomMenuId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(initialCreateMode);
  const [isCompactRoomList, setIsCompactRoomList] = useState(false);
  const [currentRoomsPage, setCurrentRoomsPage] = useState(1);
  const editorSectionRef = useRef<HTMLElement | null>(null);
  const createRoomRequestIdRef = useRef(0);
  const isCreatingRoomRef = useRef(false);
  const initialCreateHandledRef = useRef(false);
  const activeEditorRoomRef = useRef<SerializedRoom | null>(null);
  const roomEditorSectionRefs = useRef<Record<RoomEditorSectionId, HTMLElement | null>>({
    general: null,
    capacity: null,
    beds: null,
    extra: null,
    bathroom: null,
    photo: null,
  });

  const [roomType, setRoomType] = useState<RoomTypeId>(defaultRoomMeta.roomType);
  const [selectedRoomName, setSelectedRoomName] = useState(defaultRoomMeta.roomName);
  const [customRoomName, setCustomRoomName] = useState("");
  const [floorInput, setFloorInput] = useState("");
  const [nameInExtranet, setNameInExtranet] = useState("");
  const [beds, setBeds] = useState(() => resolveMainPlacesForRoomType(defaultRoomMeta.roomType));
  const [extraBeds, setExtraBeds] = useState(0);
  const [areaSqmInput, setAreaSqmInput] = useState("");
  const [bedSets, setBedSets] = useState<BedSet[]>(() =>
    buildDefaultBedSetsForRoomType(defaultRoomMeta.roomType),
  );
  const [hasAdditionalPlaces, setHasAdditionalPlaces] = useState(false);
  const [selectedAdditionalPlaceTypes, setSelectedAdditionalPlaceTypes] = useState<
    AdditionalPlaceTypeId[]
  >([]);
  const [hasPrivateBathroom, setHasPrivateBathroom] = useState(false);
  const [privateBathroomLocations, setPrivateBathroomLocations] = useState<BathroomLocationId[]>(
    [],
  );
  const [privateToiletLocations, setPrivateToiletLocations] = useState<BathroomToiletId[]>([]);
  const [privateBathroomCount, setPrivateBathroomCount] = useState(1);
  const [hasSharedBathroom, setHasSharedBathroom] = useState(false);
  const [sharedBathroomLocations, setSharedBathroomLocations] = useState<BathroomLocationId[]>([]);
  const [sharedToiletLocations, setSharedToiletLocations] = useState<BathroomToiletId[]>([]);
  const [isBathroomSectionEnabled, setIsBathroomSectionEnabled] = useState(false);

  const roomNameOptions = useMemo(() => {
    const suggestions = roomNameSuggestionsByType[roomType] ?? [defaultRoomMeta.roomName];
    const options: string[] = [];
    const seen = new Set<string>();

    for (const rawOption of suggestions) {
      const option = rawOption.trim();
      if (!option || option.toLowerCase().includes("свое")) {
        continue;
      }
      const key = option.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push(option);
    }

    return options.length > 0 ? options : [roomTypeLabelById[roomType]];
  }, [roomType]);

  const bedSetSummaries = useMemo(
    () =>
      bedSets.map((set) => {
        const configuration = buildBedConfigurationFromRows(set.rows);
        const totalBeds = configuration.reduce((sum, item) => sum + item.count, 0);
        const capacity = calculateBedCapacity(configuration);
        const hasCapacityMismatch = capacity !== beds;
        return {
          id: set.id,
          configuration,
          totalBeds,
          capacity,
          hasCapacityMismatch,
        };
      }),
    [bedSets, beds],
  );
  const bedConfiguration = useMemo(
    () => bedSetSummaries[0]?.configuration ?? [],
    [bedSetSummaries],
  );
  const bedSetsMeta = useMemo(
    () =>
      bedSetSummaries
        .map((set) => set.configuration)
        .filter((configuration) => configuration.length > 0),
    [bedSetSummaries],
  );
  const hasCapacityMismatch = bedSetSummaries.some((set) => set.hasCapacityMismatch);
  const hasBedsConfigured = bedSetSummaries.some((set) => set.totalBeds > 0);
  const minBedCapacityAcrossSets = useMemo(() => {
    const capacities = bedSetSummaries
      .map((summary) => summary.capacity)
      .filter((capacity) => capacity > 0);
    if (capacities.length === 0) {
      return 1;
    }
    return Math.min(...capacities);
  }, [bedSetSummaries]);
  const fixedMainPlacesForType = useMemo(() => getFixedMainPlacesForRoomType(roomType), [roomType]);
  const isMainPlacesFixed = fixedMainPlacesForType !== null;
  const maxMainSpotsAllowed = Math.max(1, MAX_TOTAL_GUESTS - extraBeds);
  const maxExtraBedsByTotalGuests = Math.max(0, Math.min(8, MAX_TOTAL_GUESTS - beds));
  const totalGuestsCapacity = beds + extraBeds;

  // Bed types allowed for the currently selected room type (null = no restriction).
  const allowedBedTypeIdsForType = useMemo(
    () => getAllowedBedTypeIdsForRoomType(roomType),
    [roomType],
  );

  // Clamp extra beds if the total-guest budget shrinks.
  // Main spots (beds) are NOT auto-clamped: user sets spots first, then adjusts beds to match.

  useEffect(() => {
    const resolvedBeds = resolveMainPlacesForRoomType(roomType, beds);
    if (resolvedBeds !== beds) {
      setBeds(resolvedBeds);
    }
  }, [beds, roomType]);

  useEffect(() => {
    setExtraBeds((prev) => (prev > maxExtraBedsByTotalGuests ? maxExtraBedsByTotalGuests : prev));
  }, [maxExtraBedsByTotalGuests]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncCompactRoomList = () => setIsCompactRoomList(mediaQuery.matches);

    syncCompactRoomList();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncCompactRoomList);
      return () => mediaQuery.removeEventListener("change", syncCompactRoomList);
    }

    mediaQuery.addListener(syncCompactRoomList);
    return () => mediaQuery.removeListener(syncCompactRoomList);
  }, []);

  useEffect(() => {
    if (extraBeds > 0 && !hasAdditionalPlaces) {
      setHasAdditionalPlaces(true);
    }
  }, [extraBeds, hasAdditionalPlaces]);
  const parsedFloor = useMemo(() => toIntOrNull(floorInput), [floorInput]);
  const isFloorValid = parsedFloor !== null && parsedFloor >= 1 && parsedFloor <= 99;
  const floorErrorText =
    floorInput.trim().length === 0
      ? "Укажите этаж, на котором расположен номер."
      : parsedFloor !== null && !isFloorValid
        ? "Введите этаж от 1 до 99."
        : "";
  const parsedAreaSqm = useMemo(() => toFloatOrNull(areaSqmInput), [areaSqmInput]);
  const isAreaSqmValid = parsedAreaSqm !== null && parsedAreaSqm >= 5 && parsedAreaSqm <= 5000;
  const areaSqmErrorText =
    areaSqmInput.trim().length === 0
      ? "Поле обязательное. Без площади номер не сохранится."
      : parsedAreaSqm !== null && !isAreaSqmValid
        ? "Введите площадь от 5 до 5000 м²."
        : "";
  const editingRoom = useMemo(
    () => (editingRoomId ? (rooms.find((room) => room.id === editingRoomId) ?? null) : null),
    [editingRoomId, rooms],
  );
  const canSaveRoom =
    Boolean(editingRoomId) && !isCreatingRoom && !isSaving && isFloorValid && isAreaSqmValid;
  const checklistItems = useMemo<
    Array<{ id: RoomEditorSectionId; label: string; done: boolean }>
  >(() => {
    const roomName = getRoomNameFromState(selectedRoomName, customRoomName);
    const roomFloor = toIntOrNull(floorInput);
    const areaSqm = toFloatOrNull(areaSqmInput);
    const floorIsValid = roomFloor !== null && roomFloor >= 1 && roomFloor <= 99;
    const areaSqmIsValid = areaSqm !== null && areaSqm >= 5 && areaSqm <= 5000;
    const generalSettingsDone = Boolean(
      roomType && roomName.length > 0 && floorIsValid && areaSqmIsValid,
    );
    const capacityDone =
      beds >= 1 &&
      extraBeds >= 0 &&
      extraBeds <= maxExtraBedsByTotalGuests &&
      beds + extraBeds <= MAX_TOTAL_GUESTS;
    const sleepingDone = bedConfiguration.length > 0 && hasBedsConfigured && !hasCapacityMismatch;
    const additionalBedsDone = hasAdditionalPlaces
      ? extraBeds === 0 || selectedAdditionalPlaceTypes.length > 0
      : extraBeds === 0;
    const hasAnyBathroomSelected = hasPrivateBathroom || hasSharedBathroom;
    const privateBathroomDone = hasPrivateBathroom
      ? privateBathroomLocations.length > 0 &&
        privateToiletLocations.length > 0 &&
        privateBathroomCount >= 1
      : false;
    const sharedBathroomDone = hasSharedBathroom
      ? sharedBathroomLocations.length > 0 && sharedToiletLocations.length > 0
      : false;
    const bathroomDone =
      hasAnyBathroomSelected &&
      (!hasPrivateBathroom || privateBathroomDone) &&
      (!hasSharedBathroom || sharedBathroomDone);
    // "Фото" can only be completed after first save because media uploader needs a room id.
    const photoDone = editingRoom ? editingRoom.mediaStats.imageCount >= 3 : false;

    return [
      { id: "general", label: "Общие настройки", done: generalSettingsDone },
      { id: "capacity", label: "Вместимость", done: capacityDone },
      { id: "beds", label: "Спальные места", done: sleepingDone },
      { id: "extra", label: "Дополнительные спальные места", done: additionalBedsDone },
      { id: "bathroom", label: "Ванная", done: bathroomDone },
      { id: "photo", label: "Фото", done: photoDone },
    ];
  }, [
    bedConfiguration.length,
    hasBedsConfigured,
    beds,
    customRoomName,
    editingRoom,
    extraBeds,
    floorInput,
    maxExtraBedsByTotalGuests,
    hasAdditionalPlaces,
    hasCapacityMismatch,
    hasPrivateBathroom,
    hasSharedBathroom,
    privateBathroomCount,
    privateBathroomLocations.length,
    privateToiletLocations.length,
    roomType,
    selectedAdditionalPlaceTypes.length,
    selectedRoomName,
    sharedBathroomLocations.length,
    sharedToiletLocations.length,
    areaSqmInput,
  ]);
  const completedChecklistCount = useMemo(
    () => checklistItems.filter((item) => item.done).length,
    [checklistItems],
  );
  const editorCompletionPercent =
    (completedChecklistCount / Math.max(1, checklistItems.length)) * 100;
  const saveRoomLabel = isSaving
    ? "Сохранение..."
    : isCreatingRoom
      ? "Создание..."
      : "Сохранить изменения";

  const roomsPerPage = isCompactRoomList ? MOBILE_ROOMS_PAGE_SIZE : DESKTOP_ROOMS_PAGE_SIZE;
  const roomCards = useMemo<RoomCardListItem[]>(() => {
    const groupedRoomCards = new Map<string, RoomCardListItem[]>();
    const numberedRoomIds = new Map<string, number>();
    const items = rooms.map((room) => {
      const roomMeta = getLegacyMeta(room);
      const cardDetails = getRoomCardDetails(room, roomMeta);
      const nextItem: RoomCardListItem = {
        room,
        cardDetails,
        instanceNumber: null,
      };

      const currentGroup = groupedRoomCards.get(cardDetails.duplicateKey);
      if (currentGroup) {
        currentGroup.push(nextItem);
      } else {
        groupedRoomCards.set(cardDetails.duplicateKey, [nextItem]);
      }

      return nextItem;
    });

    for (const group of groupedRoomCards.values()) {
      if (group.length < 2) {
        continue;
      }

      const stableOrderedGroup = [...group].sort((left, right) => {
        const createdAtDelta =
          new Date(left.room.createdAt).getTime() - new Date(right.room.createdAt).getTime();
        if (createdAtDelta !== 0) {
          return createdAtDelta;
        }
        return left.room.id.localeCompare(right.room.id);
      });

      stableOrderedGroup.forEach((item, index) => {
        numberedRoomIds.set(item.room.id, index + 1);
      });
    }

    return items.map((item) => ({
      ...item,
      instanceNumber: numberedRoomIds.get(item.room.id) ?? null,
    }));
  }, [rooms]);
  const totalRoomsPages = Math.max(1, Math.ceil(roomCards.length / roomsPerPage));
  const paginatedRoomCards = useMemo(() => {
    const startIndex = (currentRoomsPage - 1) * roomsPerPage;
    return roomCards.slice(startIndex, startIndex + roomsPerPage);
  }, [currentRoomsPage, roomCards, roomsPerPage]);
  const roomsRangeStart = roomCards.length === 0 ? 0 : (currentRoomsPage - 1) * roomsPerPage + 1;
  const roomsRangeEnd =
    roomCards.length === 0 ? 0 : Math.min(currentRoomsPage * roomsPerPage, roomCards.length);
  const maxVisiblePageButtons = isCompactRoomList ? 3 : 5;
  const visibleRoomsPageNumbers = useMemo(() => {
    const sideButtons = Math.floor(maxVisiblePageButtons / 2);
    let startPage = Math.max(1, currentRoomsPage - sideButtons);
    let endPage = startPage + maxVisiblePageButtons - 1;

    if (endPage > totalRoomsPages) {
      endPage = totalRoomsPages;
      startPage = Math.max(1, endPage - maxVisiblePageButtons + 1);
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  }, [currentRoomsPage, maxVisiblePageButtons, totalRoomsPages]);

  const notifyChanged = useCallback(async () => {
    if (onChanged) {
      await onChanged();
    }
  }, [onChanged]);

  const refreshRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setRoomsLoadError("");

    try {
      const response = await fetch(`/api/properties/${propertyId}/rooms`, { cache: "no-store" });
      if (!response.ok) {
        setRoomsLoadError("Не удалось загрузить номера.");
        return;
      }

      const body = (await response.json()) as { items: SerializedRoom[] };
      setRooms(() => {
        const editorRoom = activeEditorRoomRef.current;
        if (!editorRoom) {
          return body.items;
        }

        const refreshedEditorRoom = body.items.find((item) => item.id === editorRoom.id) ?? null;
        if (refreshedEditorRoom) {
          activeEditorRoomRef.current = refreshedEditorRoom;
          return body.items;
        }

        return [editorRoom, ...body.items];
      });
    } catch {
      setRoomsLoadError("Не удалось загрузить номера.");
    } finally {
      setIsLoadingRooms(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void refreshRooms();
  }, [refreshRooms]);

  useEffect(() => {
    if (!openedRoomMenuId) {
      return;
    }

    if (!rooms.some((room) => room.id === openedRoomMenuId)) {
      setOpenedRoomMenuId(null);
    }
  }, [openedRoomMenuId, rooms]);

  useEffect(() => {
    setCurrentRoomsPage((currentPage) => Math.min(currentPage, totalRoomsPages));
  }, [totalRoomsPages]);

  const resetForm = useCallback(() => {
    activeEditorRoomRef.current = null;
    setEditingRoomId(null);
    setOpenedRoomMenuId(null);
    setRoomType(defaultRoomMeta.roomType);
    setSelectedRoomName(defaultRoomMeta.roomName);
    setCustomRoomName("");
    setFloorInput("");
    setNameInExtranet("");
    setBeds(resolveMainPlacesForRoomType(defaultRoomMeta.roomType));
    setExtraBeds(0);
    setAreaSqmInput("");
    setBedSets(buildDefaultBedSetsForRoomType(defaultRoomMeta.roomType));
    setHasAdditionalPlaces(false);
    setSelectedAdditionalPlaceTypes([]);
    setHasPrivateBathroom(false);
    setPrivateBathroomLocations([]);
    setPrivateToiletLocations([]);
    setPrivateBathroomCount(1);
    setHasSharedBathroom(false);
    setSharedBathroomLocations([]);
    setSharedToiletLocations([]);
    setIsBathroomSectionEnabled(false);
    setError("");
  }, []);

  const registerEditorSectionRef = useCallback(
    (id: RoomEditorSectionId, node: HTMLElement | null) => {
      roomEditorSectionRefs.current[id] = node;
    },
    [],
  );

  const scrollToEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      editorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const clearCreateModeFromUrl = useCallback(() => {
    if (!pathname || searchParams.get("create") !== "1") {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("create");

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const startEdit = useCallback(
    (room: SerializedRoom) => {
      const meta = getLegacyMeta(room);
      activeEditorRoomRef.current = room;
      isCreatingRoomRef.current = false;
      setIsCreatingRoom(false);
      setOpenedRoomMenuId(null);
      setEditingRoomId(room.id);
      setIsEditorOpen(true);
      setRoomType(meta.roomType);
      const suggestions = (roomNameSuggestionsByType[meta.roomType] ?? []).filter(
        (option) => !option.toLowerCase().includes("свое"),
      );
      if (suggestions.includes(meta.roomName)) {
        setSelectedRoomName(meta.roomName);
        setCustomRoomName("");
      } else {
        setSelectedRoomName(CUSTOM_ROOM_NAME_VALUE);
        setCustomRoomName(meta.roomName);
      }
      setNameInExtranet(meta.nameInExtranet ?? "");
      setFloorInput(meta.floor === null ? "" : String(meta.floor));
      setBeds(resolveMainPlacesForRoomType(meta.roomType, room.beds));
      setExtraBeds(room.extraBeds);
      setAreaSqmInput(room.areaSqm === null ? "" : String(room.areaSqm));
      setBedSets(buildBedSetsFromMeta(meta, meta.roomType));
      setHasAdditionalPlaces(meta.hasAdditionalPlaces);
      setSelectedAdditionalPlaceTypes(meta.additionalPlaceTypes);
      setHasPrivateBathroom(true);
      setPrivateBathroomLocations(["in_room"]);
      setPrivateToiletLocations(["in_bathroom"]);
      setPrivateBathroomCount(1);
      setHasSharedBathroom(false);
      setSharedBathroomLocations([]);
      setSharedToiletLocations([]);
      setIsBathroomSectionEnabled(true);
      setError("");
      scrollToEditor();
    },
    [scrollToEditor],
  );

  const createRoomDraft = useCallback(async () => {
    if (isCreatingRoomRef.current) {
      return;
    }

    const requestId = createRoomRequestIdRef.current + 1;
    createRoomRequestIdRef.current = requestId;
    isCreatingRoomRef.current = true;

    resetForm();
    setIsEditorOpen(true);
    setIsCreatingRoom(true);
    scrollToEditor();

    try {
      const response = await fetch(`/api/properties/${propertyId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAutoCreatedRoomPayload()),
      });

      if (createRoomRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось автоматически создать номер");
        return;
      }

      const body = (await response.json()) as { item: SerializedRoom };
      const savedRoom = body.item;
      const nextRoomsCount = rooms.some((item) => item.id === savedRoom.id)
        ? rooms.length
        : rooms.length + 1;

      setRooms((prev) =>
        prev.some((item) => item.id === savedRoom.id)
          ? prev.map((item) => (item.id === savedRoom.id ? savedRoom : item))
          : [...prev, savedRoom],
      );
      setCurrentRoomsPage(Math.max(1, Math.ceil(nextRoomsCount / roomsPerPage)));
      startEdit(savedRoom);
      await notifyChanged();
    } catch {
      if (createRoomRequestIdRef.current === requestId) {
        setError("Не удалось автоматически создать номер");
      }
    } finally {
      if (createRoomRequestIdRef.current === requestId) {
        isCreatingRoomRef.current = false;
        setIsCreatingRoom(false);
      }
    }
  }, [notifyChanged, propertyId, resetForm, rooms, roomsPerPage, scrollToEditor, startEdit]);

  const openCreateForm = useCallback(() => {
    void createRoomDraft();
  }, [createRoomDraft]);

  const closeEditor = useCallback(() => {
    createRoomRequestIdRef.current += 1;
    isCreatingRoomRef.current = false;
    setIsCreatingRoom(false);
    resetForm();
    setIsEditorOpen(false);
    clearCreateModeFromUrl();
  }, [clearCreateModeFromUrl, resetForm]);

  function goToRoomsPage(nextPage: number) {
    setOpenedRoomMenuId(null);
    setCurrentRoomsPage(Math.min(Math.max(1, nextPage), totalRoomsPages));
  }

  useEffect(() => {
    if (!initialCreateMode) {
      initialCreateHandledRef.current = false;
      return;
    }

    if (initialCreateHandledRef.current) {
      return;
    }

    initialCreateHandledRef.current = true;
    openCreateForm();
  }, [initialCreateMode, openCreateForm]);

  function toggleStringValue<T extends string>(
    values: T[],
    setValues: (next: T[]) => void,
    nextValue: T,
  ) {
    if (values.includes(nextValue)) {
      setValues(values.filter((item) => item !== nextValue));
      return;
    }
    setValues([...values, nextValue]);
  }

  function changeBedRowType(setId: string, rowId: string, type: BedTypeId) {
    setBedSets((prev) =>
      prev.map((set) => {
        if (set.id !== setId) {
          return set;
        }
        return {
          ...set,
          rows: set.rows.map((row) => {
            if (row.id !== rowId) return row;
            const otherBeds = set.rows.reduce(
              (sum, item) => (item.id === rowId ? sum : sum + item.count),
              0,
            );
            const otherPlaces = set.rows.reduce(
              (sum, item) =>
                item.id === rowId ? sum : sum + item.count * (bedTypePlacesById[item.type] ?? 0),
              0,
            );
            const maxBySet = Math.max(1, MAX_BEDS_PER_SET - otherBeds);
            const placesPerBed = bedTypePlacesById[type] ?? 0;
            const maxByDeclaredBeds =
              placesPerBed > 0 ? Math.max(1, Math.floor((beds - otherPlaces) / placesPerBed)) : 1;
            const clampedCount = Math.min(
              row.count,
              bedTypeMaxCountById[type],
              maxBySet,
              maxByDeclaredBeds,
            );
            return { ...row, type, count: Math.max(1, clampedCount) };
          }),
        };
      }),
    );
  }

  function changeBedRowCount(setId: string, rowId: string, nextCount: number) {
    setBedSets((prev) =>
      prev.map((set) => {
        if (set.id !== setId) {
          return set;
        }
        const targetRow = set.rows.find((row) => row.id === rowId);
        const otherBeds = set.rows.reduce(
          (sum, row) => (row.id === rowId ? sum : sum + row.count),
          0,
        );
        const otherPlaces = set.rows.reduce(
          (sum, row) =>
            row.id === rowId ? sum : sum + row.count * (bedTypePlacesById[row.type] ?? 0),
          0,
        );
        const maxBySet = Math.max(1, MAX_BEDS_PER_SET - otherBeds);
        const maxByType = targetRow ? bedTypeMaxCountById[targetRow.type] : MAX_BEDS_PER_SET;
        const placesPerBed = targetRow ? (bedTypePlacesById[targetRow.type] ?? 0) : 0;
        const maxByDeclaredBeds =
          placesPerBed > 0 ? Math.max(1, Math.floor((beds - otherPlaces) / placesPerBed)) : 1;
        const maxForRow = Math.min(maxBySet, maxByType, maxByDeclaredBeds);
        const safeCount = Math.max(1, Math.min(maxForRow, nextCount));
        return {
          ...set,
          rows: set.rows.map((row) => (row.id === rowId ? { ...row, count: safeCount } : row)),
        };
      }),
    );
  }

  function addBedRow(setId: string) {
    setBedSets((prev) =>
      prev.map((set) => {
        if (set.id !== setId) {
          return set;
        }
        if (set.rows.length >= MAX_BED_ROWS_PER_SET) {
          return set;
        }
        const setTotalBeds = set.rows.reduce((sum, row) => sum + row.count, 0);
        const setTotalPlaces = set.rows.reduce(
          (sum, row) => sum + row.count * (bedTypePlacesById[row.type] ?? 0),
          0,
        );
        if (setTotalBeds >= MAX_BEDS_PER_SET) {
          return set;
        }
        if (setTotalPlaces >= beds) {
          return set;
        }
        const nextTypeFromRows = [...set.rows]
          .reverse()
          .find(
            (row) =>
              row.type !== "no_bed" &&
              (allowedBedTypeIdsForType === null || allowedBedTypeIdsForType.includes(row.type)),
          )?.type;
        const nextType =
          nextTypeFromRows ??
          bedTypeOptions.find(
            (option) =>
              option.id !== "no_bed" &&
              (allowedBedTypeIdsForType === null || allowedBedTypeIdsForType.includes(option.id)),
          )?.id ??
          getDefaultBedTypeForRoomType(roomType);
        return {
          ...set,
          rows: [...set.rows, createBedRow(nextType, 1)],
        };
      }),
    );
  }

  function removeBedRow(setId: string, rowId: string) {
    setBedSets((prev) =>
      prev.map((set) => {
        if (set.id !== setId || set.rows.length <= 1) {
          return set;
        }
        const nextRows = set.rows.filter((row) => row.id !== rowId);
        return {
          ...set,
          rows: nextRows.length > 0 ? nextRows : [createBedRow()],
        };
      }),
    );
  }

  function addBedSet() {
    setBedSets((prev) =>
      prev.length >= MAX_BED_SETS
        ? prev
        : [...prev, buildDefaultBedSetsForRoomType(roomType)[0] ?? createBedSet()],
    );
  }

  function removeBedSet(setId: string) {
    setBedSets((prev) => (prev.length <= 1 ? prev : prev.filter((set) => set.id !== setId)));
  }

  function resolveBathroomType(): "IN_ROOM" | "ON_FLOOR" | "OUTSIDE" {
    return "IN_ROOM";
  }

  async function saveRoom() {
    setError("");

    if (!editingRoomId) {
      setError("Номер создаётся автоматически. Подождите несколько секунд.");
      return;
    }

    const roomName = getRoomNameFromState(selectedRoomName, customRoomName);
    const roomFloor = parsedFloor;
    const areaSqm = parsedAreaSqm;

    if (roomFloor === null) {
      setError("Укажите этаж номера");
      return;
    }
    if (roomFloor < 1 || roomFloor > 99) {
      setError("Этаж номера должен быть от 1 до 99");
      return;
    }

    if (areaSqm === null) {
      setError("Укажите площадь номера");
      return;
    }
    if (areaSqm < 5 || areaSqm > 5000) {
      setError("Площадь номера должна быть от 5 до 5000 м²");
      return;
    }

    const title = buildRoomTitle(roomName, roomFloor);

    if (!roomName) {
      setError("Укажите название номера");
      return;
    }

    if (editingRoomId && editingRoom && editingRoom.mediaStats.imageCount < 3) {
      setError("Добавьте минимум 3 фотографии.");
      return;
    }

    if (bedSetsMeta.length === 0) {
      setError("Добавьте хотя бы один набор спальных мест");
      return;
    }

    const overLimitSetIndex = bedSetSummaries.findIndex((set) => set.totalBeds > MAX_BEDS_PER_SET);
    if (overLimitSetIndex >= 0) {
      setError(`В наборе ${overLimitSetIndex + 1} суммарно можно добавить не более 20 кроватей`);
      return;
    }

    const overDeclaredSetIndex = bedSetSummaries.findIndex((set) => set.capacity > beds);
    if (overDeclaredSetIndex >= 0) {
      setError(
        `Набор ${overDeclaredSetIndex + 1}: мест по кроватям больше, чем указано в «Основные места». Уменьшите количество кроватей или увеличьте основные места`,
      );
      return;
    }

    const mismatchSetIndex = bedSetSummaries.findIndex((set) => set.hasCapacityMismatch);
    if (mismatchSetIndex >= 0) {
      const mismatchSet = bedSetSummaries[mismatchSetIndex];
      const diff = beds - mismatchSet.capacity;
      setError(
        `Набор ${mismatchSetIndex + 1}: не хватает ${formatPlacesLabel(diff)} — добавьте кровати или уменьшите основные места`,
      );
      return;
    }

    const emptySetIndex = bedSetSummaries.findIndex((set) => set.totalBeds <= 0);
    if (emptySetIndex >= 0) {
      setError(`Набор ${emptySetIndex + 1}: добавьте минимум одну кровать`);
      return;
    }

    if (extraBeds > maxExtraBedsByTotalGuests || beds + extraBeds > MAX_TOTAL_GUESTS) {
      setError(`Суммарная вместимость номера не может превышать ${MAX_TOTAL_GUESTS} гостей`);
      return;
    }

    if (!hasAdditionalPlaces && extraBeds > 0) {
      setError("Включите дополнительные места или укажите 0 в поле «Доп. места»");
      return;
    }

    if (hasAdditionalPlaces && extraBeds > 0 && selectedAdditionalPlaceTypes.length === 0) {
      setError("Для дополнительных мест выберите хотя бы один тип");
      return;
    }

    const payload = {
      title,
      beds,
      extraBeds,
      roomsCount: 1,
      areaSqm,
      bathroomType: resolveBathroomType(),
      // Room amenities are managed on the dedicated "Удобства в номерах" screen.
      // Keep existing values on edit to avoid accidental resets from this form.
      featureIds: editingRoom?.featureIds ?? [],
      customFeatures: editingRoom?.customFeatures ?? [],
      meta: {
        roomType,
        roomName,
        floor: roomFloor,
        nameInExtranet: nameInExtranet.trim() ? nameInExtranet.trim() : null,
        bedConfiguration,
        bedSets: bedSetsMeta,
        hasAdditionalPlaces,
        additionalPlaceTypes: hasAdditionalPlaces ? selectedAdditionalPlaceTypes : [],
        hasPrivateBathroom: true,
        privateBathroomLocations: ["in_room"],
        privateToiletLocations: ["in_bathroom"],
        hasSharedBathroom: false,
        sharedBathroomLocations: [],
        sharedToiletLocations: [],
        privateBathroomCount: 1,
      },
    };

    setIsSaving(true);

    try {
      const response = await fetch(`/api/properties/${propertyId}/rooms/${editingRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Не удалось сохранить номер");
        return;
      }

      const body = (await response.json()) as { item: SerializedRoom };
      const savedRoom = body.item;

      setRooms((prev) => prev.map((item) => (item.id === savedRoom.id ? savedRoom : item)));
      setCurrentRoomsPage(1);
      closeEditor();

      await notifyChanged();
    } finally {
      setIsSaving(false);
    }
  }

  async function removeRoom(roomId: string) {
    setError("");
    setOpenedRoomMenuId(null);

    const response = await fetch(`/api/properties/${propertyId}/rooms/${roomId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Не удалось удалить номер");
      return;
    }

    setRooms((prev) => prev.filter((room) => room.id !== roomId));

    if (editingRoomId === roomId) {
      resetForm();
    }

    await notifyChanged();
  }

  async function reorderRooms(nextRooms: SerializedRoom[]) {
    if (isReorderingRooms) {
      return;
    }

    const previousRooms = rooms;
    const normalizedRooms = nextRooms.map((room, index) => ({
      ...room,
      sortOrder: index + 1,
    }));

    setError("");
    setOpenedRoomMenuId(null);
    setIsReorderingRooms(true);
    setRooms(normalizedRooms);

    try {
      const response = await fetch(`/api/properties/${propertyId}/rooms/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: normalizedRooms.map((room) => room.id),
        }),
      });

      const body = (await response.json()) as { items?: SerializedRoom[]; error?: string };

      if (!response.ok) {
        setRooms(previousRooms);
        setError(body.error ?? "Не удалось изменить порядок номеров");
        return;
      }

      if (body.items) {
        setRooms(body.items);
      }

      await notifyChanged();
    } catch {
      setRooms(previousRooms);
      setError("Не удалось изменить порядок номеров");
    } finally {
      setIsReorderingRooms(false);
    }
  }

  function moveRoom(roomId: string, direction: -1 | 1) {
    const currentIndex = rooms.findIndex((room) => room.id === roomId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= rooms.length) {
      return;
    }

    const nextRooms = [...rooms];
    const [movedRoom] = nextRooms.splice(currentIndex, 1);
    if (!movedRoom) {
      return;
    }
    nextRooms.splice(nextIndex, 0, movedRoom);
    void reorderRooms(nextRooms);
  }

  function moveRoomToPosition(roomId: string, position: number) {
    const currentIndex = rooms.findIndex((room) => room.id === roomId);
    const nextIndex = Math.max(0, Math.min(rooms.length - 1, position - 1));

    if (currentIndex < 0 || currentIndex === nextIndex) {
      return;
    }

    const nextRooms = [...rooms];
    const [movedRoom] = nextRooms.splice(currentIndex, 1);
    if (!movedRoom) {
      return;
    }
    nextRooms.splice(nextIndex, 0, movedRoom);
    void reorderRooms(nextRooms);
  }

  function getRoomCardDetails(room: SerializedRoom, roomMeta: RoomMeta): RoomCardDetails {
    const normalizedRoomName = normalizeRoomTitle(roomMeta.roomName);
    const normalizedFallbackTitle = normalizeRoomTitle(room.title);
    const baseTitle =
      buildRoomTitle(normalizedRoomName || normalizedFallbackTitle || "Номер", roomMeta.floor) ||
      "Номер";
    const areaTitle = room.areaSqm === null ? null : `${formatAreaSqmForTitle(room.areaSqm)} м²`;
    const title = areaTitle ? `${baseTitle} · ${areaTitle}` : baseTitle;
    const primaryBedUnits = resolvePrimaryBedUnits(room, roomMeta);
    const bedsText =
      room.extraBeds > 0
        ? `В номере: ${formatBedsLabel(primaryBedUnits)} + ${formatExtraPlacesLabel(room.extraBeds)}`
        : `В номере: ${formatBedsLabel(primaryBedUnits)}`;
    const areaText = room.areaSqm === null ? "Площадь: не указана" : null;

    const duplicateKey = `${baseTitle.trim().toLowerCase()}::${room.areaSqm ?? "no-area"}`;

    return { title, bedsText, areaText, duplicateKey };
  }

  function openRoomCard(room: SerializedRoom) {
    startEdit(room);
  }

  return (
    <div className="space-y-4 text-base">
      {isEditorOpen ? (
        <section
          id="room-category-form"
          ref={editorSectionRef}
          className="min-w-0 overflow-hidden rounded-2xl border border-olive/10 bg-white text-base shadow-sm"
        >
          {/* Gradient accent stripe */}
          <div className="h-1.5 bg-gradient-to-r from-primary/85 via-sun/60 to-terra/75" />

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-olive/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-terra/12 bg-gradient-to-br from-white via-cream to-terra/18 shadow-sm">
                <AppIcon icon={BedDouble} className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/40">
                  Номерной фонд
                </p>
                <h3 className="text-xl font-bold text-olive">
                  {isCreatingRoom ? "Создание номера" : "Редактирование номера"}
                </h3>
              </div>
            </div>
            <Button variant="ghost" onClick={closeEditor} className="w-full shrink-0 sm:w-auto">
              Закрыть форму
            </Button>
          </div>

          {/* Main content */}
          <div className="p-4 pb-28 sm:p-5 sm:pb-5">
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0 space-y-4">
                {/* General settings */}
                <div
                  ref={(node) => registerEditorSectionRef("general", node)}
                  data-room-editor-section="general"
                  className="min-w-0 space-y-4 scroll-mt-32 rounded-2xl border border-olive/12 bg-cream/30 p-3 sm:p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/50">
                    Основные параметры
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="min-w-0 space-y-1.5">
                      <span className="text-sm font-semibold text-olive">Тип номера</span>
                      <select
                        className="min-w-0 w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-base text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        value={roomType}
                        onChange={(event) => {
                          const nextType = event.target.value as RoomTypeId;
                          const firstSuggestion = (roomNameSuggestionsByType[nextType] ?? []).find(
                            (option) => !option.toLowerCase().includes("свое"),
                          );
                          setRoomType(nextType);
                          setSelectedRoomName(firstSuggestion ?? roomTypeLabelById[nextType]);
                          setCustomRoomName("");
                          // Auto-apply capacity and default bed configuration for the chosen type.
                          setBeds(resolveMainPlacesForRoomType(nextType));
                          setExtraBeds(0);
                          setBedSets(buildDefaultBedSetsForRoomType(nextType));
                        }}
                      >
                        {roomTypeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="min-w-0 space-y-1.5">
                      <span className="text-sm font-semibold text-olive">Название номера</span>
                      <select
                        className="min-w-0 w-full rounded-xl border border-olive/20 bg-white px-3.5 py-2.5 text-base text-olive outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        value={selectedRoomName}
                        onChange={(event) => setSelectedRoomName(event.target.value)}
                      >
                        {roomNameOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value={CUSTOM_ROOM_NAME_VALUE}>Свое название</option>
                      </select>
                    </label>
                  </div>

                  {selectedRoomName === CUSTOM_ROOM_NAME_VALUE ? (
                    <Input
                      value={customRoomName}
                      onChange={(event) => setCustomRoomName(event.target.value)}
                      placeholder="Введите свое название номера"
                      className="text-base"
                    />
                  ) : null}

                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-sm font-semibold text-olive">
                      Название в списке номеров
                    </span>
                    <Input
                      value={nameInExtranet}
                      onChange={(event) => setNameInExtranet(event.target.value)}
                      placeholder="Например, Номер 12 у окна"
                      className="text-base"
                    />
                  </label>

                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-sm font-semibold text-olive">Этаж</span>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      step="1"
                      value={floorInput}
                      onChange={(event) => setFloorInput(event.target.value)}
                      placeholder="Например, 2"
                      className={cn(
                        "text-base",
                        floorErrorText
                          ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                          : "",
                      )}
                      required
                      aria-invalid={floorErrorText ? true : undefined}
                    />
                    {floorErrorText ? (
                      <span className="text-sm text-red-600">{floorErrorText}</span>
                    ) : null}
                  </label>

                  <div
                    ref={(node) => registerEditorSectionRef("capacity", node)}
                    data-room-editor-section="capacity"
                    className="min-w-0 space-y-3 scroll-mt-32"
                  >
                    <div className="grid min-w-0 gap-3 md:grid-cols-3">
                      <div className="min-w-0 flex flex-col gap-2 rounded-xl border border-olive/12 bg-white p-3">
                        <p className="text-sm font-semibold text-olive">Основные места</p>
                        <div className="flex items-center gap-1 rounded-lg bg-cream/70 px-2 py-1.5">
                          <Button
                            variant="ghost"
                            className="h-8 w-8 rounded-lg px-0 py-0 text-lg"
                            disabled={isMainPlacesFixed || beds <= 1}
                            onClick={() => setBeds((prev) => prev - 1)}
                          >
                            −
                          </Button>
                          <span className="flex-1 text-center text-lg font-bold text-olive">
                            {beds}
                          </span>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 rounded-lg px-0 py-0 text-lg"
                            disabled={isMainPlacesFixed || beds >= maxMainSpotsAllowed}
                            onClick={() => setBeds((prev) => prev + 1)}
                          >
                            +
                          </Button>
                        </div>
                        {!hasBedsConfigured ? (
                          <p className="text-xs text-olive/55">Укажите кровати ниже</p>
                        ) : minBedCapacityAcrossSets === beds ? (
                          <p className="text-xs font-medium text-primary">✓ Кровати набраны</p>
                        ) : minBedCapacityAcrossSets < beds ? (
                          <p className="text-xs font-medium text-amber-600">
                            Набрано {minBedCapacityAcrossSets} из {beds} мест
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-red-500">
                            Лишних {formatPlacesLabel(minBedCapacityAcrossSets - beds)}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 flex flex-col gap-2 rounded-xl border border-olive/12 bg-white p-3">
                        <p className="text-sm font-semibold text-olive">Доп. места</p>
                        <div className="flex items-center gap-1 rounded-lg bg-cream/70 px-2 py-1.5">
                          <Button
                            variant="ghost"
                            className="h-8 w-8 rounded-lg px-0 py-0 text-lg"
                            disabled={extraBeds <= 0}
                            onClick={() => setExtraBeds((prev) => Math.max(0, prev - 1))}
                          >
                            −
                          </Button>
                          <span className="flex-1 text-center text-lg font-bold text-olive">
                            {extraBeds}
                          </span>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 rounded-lg px-0 py-0 text-lg"
                            disabled={extraBeds >= maxExtraBedsByTotalGuests}
                            onClick={() =>
                              setExtraBeds((prev) => Math.min(maxExtraBedsByTotalGuests, prev + 1))
                            }
                          >
                            +
                          </Button>
                        </div>
                        <p className="text-xs text-olive/55">
                          Лимит с учетом общих гостей: до{" "}
                          {formatExtraPlacesLabel(maxExtraBedsByTotalGuests)}
                        </p>
                      </div>

                      <label className="min-w-0 flex flex-col gap-2 rounded-xl border border-olive/12 bg-white p-3">
                        <span className="text-sm font-semibold text-olive">Площадь, м²</span>
                        <Input
                          type="number"
                          min={5}
                          step="0.1"
                          value={areaSqmInput}
                          onChange={(event) => setAreaSqmInput(event.target.value)}
                          placeholder="24.5"
                          className={cn(
                            "text-base",
                            areaSqmErrorText
                              ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                              : "",
                          )}
                          required
                          aria-invalid={areaSqmErrorText ? true : undefined}
                        />
                        {areaSqmErrorText ? (
                          <span className="text-sm text-red-600">{areaSqmErrorText}</span>
                        ) : null}
                      </label>
                    </div>
                    <p className="text-sm text-olive/70">
                      Итоговая вместимость номера:{" "}
                      <span className="font-semibold text-olive">
                        {formatPlacesLabel(totalGuestsCapacity)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Bed sets */}
                <div
                  ref={(node) => registerEditorSectionRef("beds", node)}
                  data-room-editor-section="beds"
                  className="min-w-0 space-y-3 scroll-mt-32 rounded-2xl border border-olive/12 bg-cream/30 p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/50">
                      <span className="inline-flex items-center gap-1.5">
                        <AppIcon icon={BedDouble} className="h-4 w-4" />
                        Спальные места
                      </span>
                    </p>
                    <p className="min-w-0 text-xs text-olive/60">
                      Нужно набрать:{" "}
                      <span className="font-semibold text-olive">{formatPlacesLabel(beds)}</span>
                    </p>
                  </div>
                  <div className="space-y-3">
                    {bedSets.map((set, setIndex) => {
                      const summary = bedSetSummaries[setIndex];
                      const totalBedsInSet = summary?.totalBeds ?? 0;
                      const bedCapacityInSet = summary?.capacity ?? 0;
                      const hasCapacityMismatchInSet = summary?.hasCapacityMismatch ?? false;

                      return (
                        <div
                          key={set.id}
                          className="min-w-0 space-y-3 rounded-xl border border-olive/12 bg-white p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sage/20 text-xs font-bold text-olive">
                                {setIndex + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-olive">Набор кроватей</p>
                                <p className="text-xs text-olive/55">
                                  {formatBedsLabel(totalBedsInSet)} ·{" "}
                                  {formatPlacesLabel(bedCapacityInSet)}
                                </p>
                              </div>
                            </div>
                            {bedSets.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeBedSet(set.id)}
                                className="text-sm font-medium text-red-500 transition hover:text-red-700"
                              >
                                Удалить набор
                              </button>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            {set.rows.map((row) => {
                              const bedsWithoutRow = set.rows.reduce(
                                (sum, item) => (item.id === row.id ? sum : sum + item.count),
                                0,
                              );
                              const placesWithoutRow = set.rows.reduce(
                                (sum, item) =>
                                  item.id === row.id
                                    ? sum
                                    : sum + item.count * (bedTypePlacesById[item.type] ?? 0),
                                0,
                              );
                              const maxBySet = Math.max(1, MAX_BEDS_PER_SET - bedsWithoutRow);
                              const maxByType = bedTypeMaxCountById[row.type];
                              const placesPerBed = bedTypePlacesById[row.type] ?? 0;
                              const maxByDeclaredBeds =
                                placesPerBed > 0
                                  ? Math.max(
                                      1,
                                      Math.floor((beds - placesWithoutRow) / placesPerBed),
                                    )
                                  : 1;
                              const maxCountForRow = Math.min(
                                maxBySet,
                                maxByType,
                                maxByDeclaredBeds,
                              );
                              return (
                                <div
                                  key={row.id}
                                  className="grid min-w-0 gap-2 rounded-xl border border-olive/10 bg-cream/50 p-2.5 md:grid-cols-[minmax(0,1fr)_150px_auto]"
                                >
                                  <label className="min-w-0 space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-olive/50">
                                      Тип кровати
                                    </span>
                                    <Select
                                      value={row.type}
                                      onChange={(v) =>
                                        changeBedRowType(set.id, row.id, v as BedTypeId)
                                      }
                                      options={bedTypeOptions
                                        .filter(
                                          (option) =>
                                            option.id !== "no_bed" &&
                                            (option.id === row.type ||
                                              allowedBedTypeIdsForType === null ||
                                              allowedBedTypeIdsForType.includes(option.id)),
                                        )
                                        .map((option) => ({
                                          value: option.id,
                                          label:
                                            option.id === "no_bed"
                                              ? option.label
                                              : `${option.label} · ${formatPlacesLabel(option.places)}`,
                                        }))}
                                    />
                                  </label>

                                  <div className="min-w-0 space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-olive/50">
                                      Количество
                                    </span>
                                    <div className="flex items-center gap-1 rounded-lg bg-cream/80 px-2 py-1.5">
                                      <Button
                                        variant="ghost"
                                        className="h-7 w-7 rounded-lg px-0 py-0"
                                        disabled={row.count <= 1}
                                        onClick={() =>
                                          changeBedRowCount(set.id, row.id, row.count - 1)
                                        }
                                      >
                                        −
                                      </Button>
                                      <span className="flex-1 text-center text-base font-bold text-olive">
                                        {row.count}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        className="h-7 w-7 rounded-lg px-0 py-0"
                                        disabled={row.count >= maxCountForRow}
                                        onClick={() =>
                                          changeBedRowCount(set.id, row.id, row.count + 1)
                                        }
                                      >
                                        +
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="flex justify-start sm:items-end">
                                    <button
                                      type="button"
                                      onClick={() => removeBedRow(set.id, row.id)}
                                      disabled={set.rows.length <= 1}
                                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => addBedRow(set.id)}
                            disabled={
                              set.rows.length >= MAX_BED_ROWS_PER_SET ||
                              totalBedsInSet >= MAX_BEDS_PER_SET ||
                              bedCapacityInSet >= beds
                            }
                            className="text-sm font-semibold text-primary transition hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            + Добавить кровать
                          </button>

                          {hasCapacityMismatchInSet ? (
                            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                              <span aria-hidden className="shrink-0 text-base leading-snug">
                                ⚠️
                              </span>
                              <p>
                                {bedCapacityInSet < beds
                                  ? `Не хватает ${formatPlacesLabel(beds - bedCapacityInSet)} — добавьте кровати или уменьшите основные места.`
                                  : `Лишних ${formatPlacesLabel(bedCapacityInSet - beds)} — уберите кровати или увеличьте основные места.`}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={addBedSet}
                    disabled={bedSets.length >= MAX_BED_SETS}
                    className="text-sm font-semibold text-primary transition hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Добавить комбинацию кроватей
                  </button>
                </div>

                {/* Additional places */}
                <div
                  ref={(node) => registerEditorSectionRef("extra", node)}
                  data-room-editor-section="extra"
                  className="min-w-0 scroll-mt-32 rounded-2xl border border-olive/12 bg-cream/30 p-3 sm:p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/50">
                        Дополнительные места
                      </p>
                    </div>
                    <SeaToggle
                      pressed={hasAdditionalPlaces}
                      onPressedChange={(nextEnabled) => {
                        setHasAdditionalPlaces(nextEnabled);
                        if (!nextEnabled) {
                          setExtraBeds(0);
                          setSelectedAdditionalPlaceTypes([]);
                        }
                      }}
                      aria-label={
                        hasAdditionalPlaces
                          ? "Отключить дополнительные места"
                          : "Включить дополнительные места"
                      }
                    />
                  </div>
                  {hasAdditionalPlaces ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {additionalPlaceTypeOptions.map((option) => (
                        <label
                          key={option.id}
                          className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-olive/12 bg-white px-3 py-2.5 text-sm text-olive transition hover:border-olive/25"
                        >
                          <Checkbox
                            checked={selectedAdditionalPlaceTypes.includes(option.id)}
                            onChange={() =>
                              toggleStringValue(
                                selectedAdditionalPlaceTypes,
                                setSelectedAdditionalPlaceTypes,
                                option.id,
                              )
                            }
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Bathroom */}
                <div
                  ref={(node) => registerEditorSectionRef("bathroom", node)}
                  data-room-editor-section="bathroom"
                  className="min-w-0 scroll-mt-32 rounded-2xl border border-olive/12 bg-cream/30 p-3 sm:p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/50">
                        <span className="inline-flex items-center gap-1.5">
                          <AppIcon icon={Bath} className="h-4 w-4" />
                          Ванная комната
                        </span>
                      </p>
                    </div>
                    <SeaToggle
                      pressed
                      onPressedChange={() => {}}
                      aria-label={
                        isBathroomSectionEnabled
                          ? "Отключить ванную комнату"
                          : "Включить ванную комнату"
                      }
                    />
                  </div>

                  {isBathroomSectionEnabled ? (
                    <>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (hasPrivateBathroom) {
                              return;
                            }
                            setHasPrivateBathroom(true);
                            setHasSharedBathroom(false);
                          }}
                          className={cn(
                            "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                            hasPrivateBathroom
                              ? "border-primary/40 bg-primary/5 text-olive shadow-sm"
                              : "border-olive/15 bg-white text-olive/70 hover:border-olive/25",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs",
                              hasPrivateBathroom
                                ? "border-primary bg-primary text-white"
                                : "border-olive/30 bg-white text-transparent",
                            )}
                          >
                            ✓
                          </span>
                          <span className="text-sm font-medium">Собственная ванная в номере</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (hasSharedBathroom) {
                              return;
                            }
                            setHasSharedBathroom(true);
                            setHasPrivateBathroom(false);
                          }}
                          className={cn(
                            "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                            hasSharedBathroom
                              ? "border-primary/40 bg-primary/5 text-olive shadow-sm"
                              : "border-olive/15 bg-white text-olive/70 hover:border-olive/25",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs",
                              hasSharedBathroom
                                ? "border-primary bg-primary text-white"
                                : "border-olive/30 bg-white text-transparent",
                            )}
                          >
                            ✓
                          </span>
                          <span className="text-sm font-medium">Общая ванная комната</span>
                        </button>
                      </div>

                      {hasPrivateBathroom ? (
                        <div className="mt-3 min-w-0 space-y-3 rounded-xl border border-olive/12 bg-white p-3">
                          <label className="min-w-0 space-y-1.5">
                            <span className="text-sm font-semibold text-olive">Туалет</span>
                            <Select
                              value={privateToiletLocations[0] ?? ""}
                              onChange={(v) => {
                                setPrivateToiletLocations([v as BathroomToiletId]);
                                setPrivateBathroomLocations([v as BathroomLocationId]);
                              }}
                              options={bathroomLocationOptions.map((o) => ({
                                value: o.id,
                                label: o.label,
                              }))}
                              placeholder="Выберите, где находится туалет"
                            />
                          </label>

                          <div className="rounded-xl border border-olive/12 bg-cream/40 p-3">
                            <p className="text-sm font-semibold text-olive/80">
                              Количество ванных комнат
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <Button
                                variant="ghost"
                                className="h-8 w-8 rounded-lg px-0 py-0"
                                disabled={privateBathroomCount <= 1}
                                onClick={() =>
                                  setPrivateBathroomCount((prev) => Math.max(1, prev - 1))
                                }
                              >
                                −
                              </Button>
                              <span className="min-w-8 text-center text-base font-bold text-olive">
                                {privateBathroomCount}
                              </span>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 rounded-lg px-0 py-0"
                                disabled={privateBathroomCount >= 10}
                                onClick={() =>
                                  setPrivateBathroomCount((prev) => Math.min(10, prev + 1))
                                }
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {hasSharedBathroom ? (
                        <div className="mt-3 min-w-0 space-y-3 rounded-xl border border-olive/12 bg-white p-3">
                          <label className="min-w-0 space-y-1.5">
                            <span className="text-sm font-semibold text-olive">
                              Общая ванная комната
                            </span>
                            <Select
                              value={sharedBathroomLocations[0] ?? ""}
                              onChange={(v) =>
                                setSharedBathroomLocations([v as BathroomLocationId])
                              }
                              options={bathroomLocationOptions.map((o) => ({
                                value: o.id,
                                label: o.label,
                              }))}
                              placeholder="Выберите, где находится общая ванная комната"
                            />
                          </label>

                          <label className="min-w-0 space-y-1.5">
                            <span className="text-sm font-semibold text-olive">Туалет</span>
                            <Select
                              value={sharedToiletLocations[0] ?? ""}
                              onChange={(v) => setSharedToiletLocations([v as BathroomToiletId])}
                              options={bathroomLocationOptions.map((o) => ({
                                value: o.id,
                                label: o.label,
                              }))}
                              placeholder="Выберите, где находится туалет"
                            />
                          </label>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {/* Photo */}
                {editingRoom ? (
                  <details
                    ref={(node) => registerEditorSectionRef("photo", node)}
                    data-room-editor-section="photo"
                    open
                    className="min-w-0 scroll-mt-32 rounded-2xl border border-olive/12 bg-cream/30 p-4"
                  >
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-olive/50">
                      <span className="inline-flex items-center gap-1.5">
                        <AppIcon icon={ImageIcon} className="h-4 w-4" />
                        Фото ({editingRoom.mediaStats.imageCount} из {mediaLimits.room.images})
                      </span>
                    </summary>
                    <p className="mt-2 text-sm text-olive/65">
                      Требование: минимум 3 фото, максимум {mediaLimits.room.images} фото.
                    </p>
                    {editingRoom.mediaStats.imageCount < 3 ? (
                      <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Добавьте ещё фото: сейчас {editingRoom.mediaStats.imageCount} из 3
                        обязательных.
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <RoomMediaManager
                        propertyId={propertyId}
                        roomId={editingRoom.id}
                        initialMedia={editingRoom.media}
                        onChanged={async () => {
                          await refreshRooms();
                          await notifyChanged();
                        }}
                      />
                    </div>
                  </details>
                ) : (
                  <div
                    ref={(node) => registerEditorSectionRef("photo", node)}
                    data-room-editor-section="photo"
                    className="min-w-0 scroll-mt-32 rounded-2xl border border-olive/12 bg-cream/30 p-4 text-center sm:p-5"
                  >
                    <p className="text-sm font-semibold text-olive">
                      {isCreatingRoom ? "Создаём номер..." : "Загрузка фото пока недоступна"}
                    </p>
                    <p className="mt-1 text-sm text-olive/55">
                      {isCreatingRoom
                        ? "Сейчас откроется управление фотографиями."
                        : "Закройте форму и попробуйте открыть создание номера ещё раз."}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="hidden flex-wrap items-center gap-3 border-t border-olive/8 pt-4 sm:flex">
                  <Button onClick={() => void saveRoom()} disabled={!canSaveRoom} className="px-6">
                    {saveRoomLabel}
                  </Button>
                  <Button variant="ghost" onClick={closeEditor}>
                    Отменить
                  </Button>
                </div>
              </div>

              {/* Checklist sidebar */}
              <aside className="hidden h-auto w-full rounded-2xl border border-olive/12 bg-cream/40 p-3 sm:block xl:sticky xl:top-20 xl:w-[220px]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-olive/50">
                    Чек-лист
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-olive/60">
                    {completedChecklistCount}/{checklistItems.length}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-olive/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sage to-primary transition-all duration-500"
                    style={{ width: `${editorCompletionPercent}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-1">
                  {checklistItems.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm leading-snug transition",
                        item.done ? "bg-green-50 text-olive" : "bg-white text-olive",
                      )}
                    >
                      <span>{item.label}</span>
                      <span
                        className={cn(
                          "ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none",
                          item.done ? "bg-green-500 text-white" : "bg-olive/10 text-olive/40",
                        )}
                      >
                        {item.done ? "✓" : "·"}
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            <div className="sticky-bottom-enter sticky bottom-0 z-30 -mx-4 mt-5 border-t border-olive/10 glass-mobile-bar px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:-mx-5 sm:px-5 sm:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/45">
                    Действия
                  </p>
                  <p className="truncate text-sm font-semibold text-olive">
                    {isCreatingRoom ? "Создание номера" : "Редактирование номера"}
                  </p>
                  <p className="mt-0.5 text-xs text-olive/60">
                    Сохраните изменения или закройте форму
                  </p>
                </div>
                <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {completedChecklistCount}/{checklistItems.length}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={closeEditor} className="min-h-11 w-full">
                  Закрыть
                </Button>
                <Button
                  onClick={() => void saveRoom()}
                  disabled={!canSaveRoom}
                  className="min-h-11 w-full"
                >
                  {saveRoomLabel}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {showCreateButton && !isEditorOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold text-olive">Номера</p>
          <Button variant="secondary" onClick={openCreateForm} className="rounded-2xl">
            Создать номер
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-base text-red-600">{error}</p> : null}

      {roomsLoadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-base text-red-700">
          <p>Не удалось загрузить номера.</p>
          <Button variant="ghost" onClick={() => void refreshRooms()} className="mt-2">
            Повторить
          </Button>
        </div>
      ) : null}

      {!isEditorOpen && isLoadingRooms && rooms.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`room-skeleton-${index}`}
              className="min-h-[132px] animate-pulse rounded-2xl border border-olive/10 bg-white p-3"
            >
              <div className="flex items-start gap-3">
                <div className="h-24 w-36 rounded-xl bg-cream" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-4/5 rounded bg-cream" />
                  <div className="h-4 w-3/5 rounded bg-cream" />
                  <div className="h-3 w-full rounded bg-cream" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isEditorOpen && !isLoadingRooms && rooms.length === 0 && showCreateButton ? (
        <section className="rounded-2xl border border-dashed border-olive/30 bg-white p-5 text-center">
          <p className="text-base text-olive/65">Номеров пока нет.</p>
          <Button variant="secondary" onClick={openCreateForm} className="mt-3 rounded-2xl">
            Создать номер
          </Button>
        </section>
      ) : null}

      {!isEditorOpen && rooms.length > 0 ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-olive/10 bg-white/95 p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-olive">
                  Создано номеров: {roomCards.length}
                </p>
                <p className="mt-1 text-xs text-olive/60">
                  Показаны {roomsRangeStart}-{roomsRangeEnd} из {roomCards.length}
                </p>
                {isReorderingRooms ? (
                  <p className="mt-1 text-xs font-medium text-primary">Сохраняем порядок...</p>
                ) : null}
              </div>

              {totalRoomsPages > 1 ? (
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => goToRoomsPage(currentRoomsPage - 1)}
                    disabled={currentRoomsPage === 1}
                    className="min-h-10 rounded-xl px-3 py-2 text-xs sm:text-sm"
                  >
                    Назад
                  </Button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {visibleRoomsPageNumbers.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => goToRoomsPage(pageNumber)}
                        aria-current={pageNumber === currentRoomsPage ? "page" : undefined}
                        className={cn(
                          "inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          pageNumber === currentRoomsPage
                            ? "border-primary bg-primary text-white shadow-sm"
                            : "border-olive/15 bg-white text-olive hover:border-olive/30 hover:bg-cream",
                        )}
                      >
                        {pageNumber}
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => goToRoomsPage(currentRoomsPage + 1)}
                    disabled={currentRoomsPage === totalRoomsPages}
                    className="min-h-10 rounded-xl px-3 py-2 text-xs sm:text-sm"
                  >
                    Далее
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            {paginatedRoomCards.map((roomCard) => {
              const { room, cardDetails, instanceNumber } = roomCard;
              const globalRoomIndex = rooms.findIndex((item) => item.id === room.id);
              const firstImage = room.media.find((mediaItem) => mediaItem.type === "IMAGE") ?? null;
              const roomInstanceLabel = instanceNumber === null ? null : `Номер ${instanceNumber}`;
              const deleteLabel =
                roomInstanceLabel === null
                  ? cardDetails.title
                  : `${cardDetails.title}, ${roomInstanceLabel.toLowerCase()}`;
              const isFirstRoom = globalRoomIndex <= 0;
              const isLastRoom = globalRoomIndex < 0 || globalRoomIndex >= rooms.length - 1;

              return (
                <article
                  key={room.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openRoomCard(room)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openRoomCard(room);
                    }
                  }}
                  className="group relative min-h-[180px] w-full cursor-pointer rounded-2xl border border-olive/10 bg-white p-3 transition hover:-translate-y-0.5 hover:border-olive/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/25 sm:h-[180px] sm:min-h-[180px] sm:max-w-[480px]"
                >
                  <div
                    className="absolute right-3 top-3 z-20"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenedRoomMenuId((current) => (current === room.id ? null : room.id))
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-olive/20 bg-white/95 text-lg text-olive shadow-sm hover:bg-cream"
                      aria-label="Меню номера"
                    >
                      ⋯
                    </button>
                    {openedRoomMenuId === room.id ? (
                      <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-olive/15 bg-white p-1 shadow-xl">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEdit(room);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-base text-olive hover:bg-cream"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const confirmed = window.confirm(`Удалить номер «${deleteLabel}»?`);
                            if (!confirmed) {
                              return;
                            }
                            void removeRoom(room.id);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-base text-red-700 hover:bg-red-50"
                        >
                          Удалить
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex h-full flex-col gap-3 pr-10 sm:flex-row sm:items-start">
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-cream ring-1 ring-olive/10 sm:h-[145.87px] sm:w-[198px] sm:shrink-0 sm:aspect-auto">
                      {firstImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstImage.url}
                          alt={cardDetails.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-base text-olive/55">
                          Без фото
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className="flex flex-wrap items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          Позиция {globalRoomIndex + 1}
                        </span>
                        {roomInstanceLabel ? (
                          <span className="inline-flex rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-olive/65">
                            {roomInstanceLabel}
                          </span>
                        ) : null}
                        <div className="inline-flex overflow-hidden rounded-lg border border-olive/15 bg-white">
                          <button
                            type="button"
                            onClick={() => moveRoom(room.id, -1)}
                            disabled={isFirstRoom || isReorderingRooms}
                            aria-label="Поднять номер выше"
                            title="Поднять выше"
                            className="inline-flex h-8 w-8 items-center justify-center text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <AppIcon icon={ChevronUp} className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRoom(room.id, 1)}
                            disabled={isLastRoom || isReorderingRooms}
                            aria-label="Опустить номер ниже"
                            title="Опустить ниже"
                            className="inline-flex h-8 w-8 items-center justify-center border-l border-olive/10 text-olive transition hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <AppIcon icon={ChevronDown} className="h-4 w-4" />
                          </button>
                        </div>
                        <select
                          value={globalRoomIndex + 1}
                          onChange={(event) =>
                            moveRoomToPosition(room.id, Number.parseInt(event.target.value, 10))
                          }
                          disabled={isReorderingRooms}
                          aria-label="Позиция номера в карточке объекта"
                          className="h-8 rounded-lg border border-olive/15 bg-white px-2 text-xs font-semibold text-olive outline-none transition hover:bg-cream focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {rooms.map((item, index) => (
                            <option key={item.id} value={index + 1}>
                              {index + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                      <h4
                        title={cardDetails.title}
                        className="mt-2 overflow-hidden pr-2 text-base font-semibold leading-5 text-olive text-ellipsis [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]"
                      >
                        {cardDetails.title}
                      </h4>
                      <p className="mt-1 text-sm text-olive/78">{cardDetails.bedsText}</p>
                      {cardDetails.areaText ? (
                        <p className="mt-0.5 text-xs text-olive/65">{cardDetails.areaText}</p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
