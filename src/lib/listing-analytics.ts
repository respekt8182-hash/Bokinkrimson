export const LISTING_ENTITY_TYPES = ["property", "excursion", "transfer"] as const;

export type ListingEntityType = (typeof LISTING_ENTITY_TYPES)[number];

export const LISTING_ACTION_TYPES = [
  "phone_primary",
  "phone_secondary",
  "phone_third",
  "booking",
  "lead_phrase",
  "lead_form",
  "lead_copy",
  "request",
  "website",
  "email",
  "whatsapp",
  "telegram",
  "vk",
  "vk_bot",
  "max",
  "ok",
  "other",
] as const;

export type ListingActionType = (typeof LISTING_ACTION_TYPES)[number];

export const PHONE_ACTION_TYPES = ["phone_primary", "phone_secondary", "phone_third"] as const;

export const MESSENGER_ACTION_TYPES = [
  "whatsapp",
  "telegram",
  "vk",
  "vk_bot",
  "max",
  "ok",
] as const;

export const LEAD_ACTION_TYPES = ["lead_phrase", "lead_form", "lead_copy", "request"] as const;

export const BOOKING_ACTION_TYPES = ["booking"] as const;

export const LISTING_ACTION_LABELS: Record<ListingActionType, string> = {
  phone_primary: "Основной номер телефона",
  phone_secondary: "Дополнительный номер телефона",
  phone_third: "Третий телефон",
  booking: "Бронирование",
  lead_phrase: "Лид-фраза",
  lead_form: "Лид-форма",
  lead_copy: "Копирование лида",
  request: "Заявка",
  website: "Сайт",
  email: "Email",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  vk: "VK",
  vk_bot: "Бот ВКонтакте",
  max: "Max",
  ok: "Одноклассники",
  other: "Другое",
};

export const LISTING_ACTION_BOOST_OPTIONS = [
  "phone_primary",
  "phone_secondary",
  "whatsapp",
  "telegram",
  "vk",
  "vk_bot",
  "website",
  "email",
  "lead_form",
  "booking",
  "request",
  "other",
] as const satisfies readonly ListingActionType[];

const LISTING_ACTION_ALIASES: Record<string, ListingActionType> = {
  phoneMain: "phone_primary",
  phoneSecondary: "phone_secondary",
  vkBot: "vk_bot",
  leadForm: "lead_form",
  leadCopy: "lead_copy",
};

export type ListingActionCounterGroup = {
  phones: number;
  messengers: number;
  leads: number;
  website: number;
  booking: number;
  other: number;
};

export function normalizeListingEntityType(value: unknown): ListingEntityType | null {
  return typeof value === "string" && LISTING_ENTITY_TYPES.includes(value as ListingEntityType)
    ? (value as ListingEntityType)
    : null;
}

export function normalizeListingActionType(value: unknown): ListingActionType | null {
  if (typeof value !== "string") {
    return null;
  }

  const alias = LISTING_ACTION_ALIASES[value];
  if (alias) {
    return alias;
  }

  return LISTING_ACTION_TYPES.includes(value as ListingActionType)
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

export function sumListingActionTypes(
  actionBreakdown: Map<string, number>,
  actionTypes: readonly ListingActionType[],
): number {
  return actionTypes.reduce((sum, actionType) => sum + (actionBreakdown.get(actionType) ?? 0), 0);
}

export function buildListingActionCounterGroup(
  actionBreakdown: Map<string, number>,
): ListingActionCounterGroup {
  const phones = sumListingActionTypes(actionBreakdown, PHONE_ACTION_TYPES);
  const messengers = sumListingActionTypes(actionBreakdown, MESSENGER_ACTION_TYPES);
  const leads = sumListingActionTypes(actionBreakdown, LEAD_ACTION_TYPES);
  const booking = sumListingActionTypes(actionBreakdown, BOOKING_ACTION_TYPES);
  const website = actionBreakdown.get("website") ?? 0;
  const grouped = phones + messengers + leads + website + booking;
  const total = [...actionBreakdown.values()].reduce((sum, count) => sum + Math.max(0, count), 0);

  return {
    phones,
    messengers,
    leads,
    website,
    booking,
    other: Math.max(0, total - grouped),
  };
}
