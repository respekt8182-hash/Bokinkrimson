// Domain/service module for occupancy.
import { toIsoDate } from "@/lib/pricing";

export type SerializedRoomOccupancy = {
  id: string;
  roomId: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string | null;
  timeTo: string | null;
  status: "CONFIRMED" | "CHECKED_IN";
  statusLabel: string;
  tag: string | null;
  source: string | null;
  color: string | null;
  adultsCount: number;
  childrenCount: number;
  guestName: string | null;
  guestPhone: string | null;
  guestContacts: string | null;
  description: string | null;
  guestLabel: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function serializeRoomOccupancy(input: {
  id: string;
  roomId: string;
  dateFrom: Date;
  dateTo: Date;
  timeFrom: string | null;
  timeTo: string | null;
  status: "CONFIRMED" | "CHECKED_IN";
  tag: string | null;
  source: string | null;
  color: string | null;
  adultsCount: number;
  childrenCount: number;
  guestName: string | null;
  guestPhone: string | null;
  guestContacts: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SerializedRoomOccupancy {
  const guestName = normalizeOptionalText(input.guestName);
  const guestPhone = normalizeOptionalText(input.guestPhone);
  const guestContacts = normalizeOptionalText(input.guestContacts);

  return {
    id: input.id,
    roomId: input.roomId,
    dateFrom: toIsoDate(input.dateFrom),
    dateTo: toIsoDate(input.dateTo),
    timeFrom: normalizeOptionalText(input.timeFrom),
    timeTo: normalizeOptionalText(input.timeTo),
    status: input.status,
    statusLabel: input.status === "CHECKED_IN" ? "Заселен" : "Подтверждено",
    tag: normalizeOptionalText(input.tag),
    source: normalizeOptionalText(input.source),
    color: normalizeOptionalText(input.color),
    adultsCount: input.adultsCount,
    childrenCount: input.childrenCount,
    guestName,
    guestPhone,
    guestContacts,
    description: normalizeOptionalText(input.description),
    guestLabel: guestName ?? "Гость",
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  };
}
