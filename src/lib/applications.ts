// Domain/service module for applications.
import { ApplicationEntityType, ApplicationStatus } from "@prisma/client";
import { formatPublicContactName, formatPublicPersonName } from "@/lib/public-display-name";

export type SerializedApplication = {
  id: string;
  entityType: ApplicationEntityType;
  entityTypeLabel: string;
  propertyId: string | null;
  propertyName: string | null;
  excursionId: string | null;
  excursionTitle: string | null;
  entityTitle: string | null;
  roomId: string | null;
  roomTitle: string | null;
  guestUserId: string;
  guestName: string;
  dateFrom: string;
  dateTo: string;
  guestsCount: number;
  message: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  status: ApplicationStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export function getApplicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case ApplicationStatus.NEW:
      return "Новая";
    case ApplicationStatus.IN_PROGRESS:
      return "В работе";
    case ApplicationStatus.CLOSED:
      return "Закрыта";
    default:
      return status;
  }
}

export function getApplicationEntityTypeLabel(type: ApplicationEntityType): string {
  switch (type) {
    case ApplicationEntityType.PROPERTY:
      return "Жилье";
    case ApplicationEntityType.EXCURSION:
      return "Экскурсия";
    default:
      return type;
  }
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function serializeApplication(application: {
  id: string;
  entityType: ApplicationEntityType;
  propertyId: string | null;
  excursionId: string | null;
  roomId: string | null;
  guestUserId: string;
  dateFrom: Date;
  dateTo: Date;
  guestsCount: number;
  message: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
  property?: { name: string | null } | null;
  excursion?: { title: string | null } | null;
  room?: { title: string } | null;
  guestUser?: { firstName: string; lastName?: string | null };
}): SerializedApplication {
  const entityTitle =
    application.entityType === ApplicationEntityType.PROPERTY
      ? (application.property?.name ?? null)
      : (application.excursion?.title ?? null);

  return {
    id: application.id,
    entityType: application.entityType,
    entityTypeLabel: getApplicationEntityTypeLabel(application.entityType),
    propertyId: application.propertyId,
    propertyName: application.property?.name ?? null,
    excursionId: application.excursionId,
    excursionTitle: application.excursion?.title ?? null,
    entityTitle,
    roomId: application.roomId,
    roomTitle: application.room?.title ?? null,
    guestUserId: application.guestUserId,
    guestName: application.guestUser
      ? formatPublicPersonName(application.guestUser, "Гость")
      : "Гость",
    dateFrom: toIsoDate(application.dateFrom),
    dateTo: toIsoDate(application.dateTo),
    guestsCount: application.guestsCount,
    message: application.message,
    contactName: formatPublicContactName(application.contactName, application.contactName),
    contactPhone: application.contactPhone,
    contactEmail: application.contactEmail,
    status: application.status,
    statusLabel: getApplicationStatusLabel(application.status),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}
