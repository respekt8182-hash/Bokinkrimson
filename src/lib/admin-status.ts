import { ExcursionStatus, PropertyStatus } from "@prisma/client";

export function getAdminPropertyBaseStatusLabel(status: PropertyStatus): string {
  switch (status) {
    case PropertyStatus.DRAFT:
      return "Черновик";
    case PropertyStatus.PENDING_MODERATION:
      return "На модерации";
    case PropertyStatus.PUBLISHED:
      return "Опубликован";
    case PropertyStatus.REJECTED:
      return "Отклонён";
    default:
      return status;
  }
}

export function getAdminPropertyPendingEditLabel(
  pendingEditStatus: PropertyStatus | null,
  moderationNotes: string | null,
): string | null {
  if (!pendingEditStatus) {
    return null;
  }

  if (pendingEditStatus === PropertyStatus.DRAFT) {
    return "Есть новые правки";
  }

  if (pendingEditStatus === PropertyStatus.PENDING_MODERATION) {
    return "Изменения на модерации";
  }

  if (pendingEditStatus === PropertyStatus.REJECTED) {
    return moderationNotes?.trim() ? "Изменения отклонены" : "Есть новые правки";
  }

  return null;
}

export function getAdminExcursionStatusLabel(status: ExcursionStatus): string {
  switch (status) {
    case ExcursionStatus.DRAFT:
      return "Черновик";
    case ExcursionStatus.PENDING_MODERATION:
      return "На модерации";
    case ExcursionStatus.PUBLISHED:
      return "Опубликована";
    case ExcursionStatus.NEEDS_FIX:
      return "Нужна доработка";
    case ExcursionStatus.REJECTED:
      return "Отклонена";
    default:
      return status;
  }
}
