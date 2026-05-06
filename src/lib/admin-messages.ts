// Domain/service module for support messages sent to admins.
import { AdminMessageSourceType } from "@prisma/client";

export type SerializedAdminMessage = {
  id: string;
  sourceType: AdminMessageSourceType;
  sourceTypeLabel: string;
  message: string;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    email: string | null;
  };
  context: {
    propertyId: string | null;
    propertyName: string | null;
    excursionId: string | null;
    excursionTitle: string | null;
  };
};

export function getAdminMessageSourceLabel(sourceType: AdminMessageSourceType): string {
  switch (sourceType) {
    case AdminMessageSourceType.OBJECT:
      return "Объект";
    case AdminMessageSourceType.EXCURSION:
      return "Экскурсия";
    default:
      return sourceType;
  }
}

export function serializeAdminMessage(message: {
  id: string;
  sourceType: AdminMessageSourceType;
  message: string;
  createdAt: Date;
  senderUser: {
    id: string;
    firstName: string;
    email: string | null;
  };
  property?: {
    id: string;
    name: string | null;
  } | null;
  excursion?: {
    id: string;
    title: string | null;
  } | null;
}): SerializedAdminMessage {
  return {
    id: message.id,
    sourceType: message.sourceType,
    sourceTypeLabel: getAdminMessageSourceLabel(message.sourceType),
    message: message.message,
    createdAt: message.createdAt.toISOString(),
    sender: {
      id: message.senderUser.id,
      firstName: message.senderUser.firstName,
      email: message.senderUser.email,
    },
    context: {
      propertyId: message.property?.id ?? null,
      propertyName: message.property?.name ?? null,
      excursionId: message.excursion?.id ?? null,
      excursionTitle: message.excursion?.title ?? null,
    },
  };
}
