export const LISTING_ENTITY_TYPES = ["property", "excursion", "transfer"] as const;

export type ListingEntityType = (typeof LISTING_ENTITY_TYPES)[number];

export const LISTING_ACTION_TYPES = [
  "phone_primary",
  "phone_secondary",
  "phone_third",
  "lead_phrase",
  "website",
  "whatsapp",
  "telegram",
  "vk",
  "max",
  "ok",
] as const;

export type ListingActionType = (typeof LISTING_ACTION_TYPES)[number];

export const PHONE_ACTION_TYPES = ["phone_primary", "phone_secondary", "phone_third"] as const;

export const MESSENGER_ACTION_TYPES = ["whatsapp", "telegram", "vk", "max", "ok"] as const;

export const LEAD_ACTION_TYPES = ["lead_phrase"] as const;

export const LISTING_ACTION_LABELS: Record<ListingActionType, string> = {
  phone_primary: "Основной номер",
  phone_secondary: "Второй номер",
  phone_third: "Третий номер",
  lead_phrase: "Лид-фраза",
  website: "Сайт",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  vk: "VK",
  max: "Max",
  ok: "Одноклассники",
};

export const LISTING_ACTION_BOOST_OPTIONS = [
  "phone_primary",
  "phone_secondary",
  "lead_phrase",
  "whatsapp",
  "telegram",
  "website",
  "max",
  "vk",
  "ok",
] as const satisfies readonly ListingActionType[];

export function normalizeListingEntityType(value: unknown): ListingEntityType | null {
  return typeof value === "string" && LISTING_ENTITY_TYPES.includes(value as ListingEntityType)
    ? (value as ListingEntityType)
    : null;
}

export function normalizeListingActionType(value: unknown): ListingActionType | null {
  return typeof value === "string" && LISTING_ACTION_TYPES.includes(value as ListingActionType)
    ? (value as ListingActionType)
    : null;
}

export function getPhoneListingActionType(phoneIndex: number): ListingActionType {
  if (phoneIndex <= 0) {
    return "phone_primary";
  }

  if (phoneIndex === 1) {
    return "phone_secondary";
  }

  return "phone_third";
}

export function getContactActionTypeFromChannel(value: string): ListingActionType | null {
  if (value === "phone") {
    return "phone_primary";
  }

  return normalizeListingActionType(value);
}
