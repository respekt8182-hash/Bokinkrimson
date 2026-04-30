export type LeadMessageAuthorGender = "male" | "female";

export const DEFAULT_LEAD_MESSAGE_AUTHOR_GENDER: LeadMessageAuthorGender = "male";

const LEAD_MESSAGE_AUTHOR_GENDER_STORAGE_KEY = "boking_lead_message_author_gender_v1";

type PropertyLeadMessageParams = {
  authorGender: LeadMessageAuthorGender;
  propertyName: string;
  roomTitle: string;
  checkIn?: string | null;
  checkOut?: string | null;
  nightsLabel?: string | null;
  totalGuests: number;
  adults: number;
  childrenCount: number;
  priceLabel?: string | null;
  extra?: string | null;
};

type ExcursionLeadMessageParams = {
  authorGender: LeadMessageAuthorGender;
  offerType?: string | null;
  organizerName: string;
  excursionTitle: string;
  locationName: string | null;
  date: string;
  guests: string;
  message: string;
};

type TransferLeadMessageParams = {
  authorGender: LeadMessageAuthorGender;
  transferTitle: string;
  locationName: string | null;
  priceLabel?: string | null;
  vehicleOption?: string | null;
  extra?: string | null;
};

function isLeadMessageAuthorGender(value: unknown): value is LeadMessageAuthorGender {
  return value === "male" || value === "female";
}

function formatSelectedDate(value: string): string {
  if (!value) {
    return "";
  }

  const normalized = value.includes("-") ? value : "";
  const [year, month, day] = normalized.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function getAuthorPhrases(authorGender: LeadMessageAuthorGender): {
  foundListing: string;
  wouldLike: string;
  grateful: string;
} {
  if (authorGender === "female") {
    return {
      foundListing: "Нашла",
      wouldLike: "Хотела бы",
      grateful: "благодарна",
    };
  }

  return {
    foundListing: "Нашел",
    wouldLike: "Хотел бы",
    grateful: "благодарен",
  };
}

export function readLeadMessageAuthorGender(): LeadMessageAuthorGender {
  if (typeof window === "undefined") {
    return DEFAULT_LEAD_MESSAGE_AUTHOR_GENDER;
  }

  const raw = window.localStorage.getItem(LEAD_MESSAGE_AUTHOR_GENDER_STORAGE_KEY);
  return isLeadMessageAuthorGender(raw) ? raw : DEFAULT_LEAD_MESSAGE_AUTHOR_GENDER;
}

export function writeLeadMessageAuthorGender(authorGender: LeadMessageAuthorGender): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LEAD_MESSAGE_AUTHOR_GENDER_STORAGE_KEY, authorGender);
}

export function buildPropertyLeadMessage(params: PropertyLeadMessageParams): string {
  const phrases = getAuthorPhrases(params.authorGender);
  const lines: string[] = [
    `Добрый день! ${phrases.foundListing} ваше объявление на сайте "Крым Вокруг".`,
    "",
    `${phrases.wouldLike} уточнить наличие свободных мест:`,
  ];

  if (params.checkIn && params.checkOut) {
    const nightsSuffix = params.nightsLabel ? ` (${params.nightsLabel})` : "";
    lines.push(
      `- Даты: ${formatSelectedDate(params.checkIn)} - ${formatSelectedDate(params.checkOut)}${nightsSuffix}`,
    );
  }

  lines.push(
    `- Гостей: ${params.totalGuests} (взрослых: ${params.adults}${params.childrenCount > 0 ? `, детей: ${params.childrenCount}` : ""})`,
  );
  lines.push(`- Номер: "${params.roomTitle}"`);
  lines.push(`- Объект: "${params.propertyName}"`);

  if (params.priceLabel?.trim()) {
    lines.push(`- Стоимость: ${params.priceLabel.trim()}`);
  }

  lines.push("");
  lines.push("Прошу подтвердить актуальность цены и наличие свободных мест.");

  const extraTrimmed = params.extra?.trim() ?? "";
  if (extraTrimmed) {
    lines.push("");
    lines.push(`(Дополнительно: ${extraTrimmed})`);
  }

  lines.push("");
  lines.push(`Буду ${phrases.grateful} за ответ!`);

  return lines.join("\n");
}

export function getOfferLabels(offerType?: string | null): {
  badge: string;
  accusative: string;
} {
  const isTour = offerType === "TOUR";

  return {
    badge: isTour ? "Тур" : "Экскурсия",
    accusative: isTour ? "тур" : "экскурсию",
  };
}

export function buildExcursionLeadMessage(params: ExcursionLeadMessageParams): string {
  const phrases = getAuthorPhrases(params.authorGender);
  const offer = getOfferLabels(params.offerType);
  const guestsLabel = params.guests.trim();
  const extraMessage = params.message.trim();
  const lines: string[] = [
    `Здравствуйте, ${params.organizerName}!`,
    `${phrases.wouldLike} забронировать ${offer.accusative} "${params.excursionTitle}"${params.locationName ? `, ${params.locationName}` : ""}.`,
  ];

  const tripDetails = [
    params.date ? `- Дата: ${formatSelectedDate(params.date)}` : null,
    guestsLabel ? `- Количество человек: ${guestsLabel}` : null,
  ].filter((item): item is string => Boolean(item));

  if (tripDetails.length > 0) {
    lines.push("");
    lines.push("Планирую:");
    lines.push(...tripDetails);
  }

  if (extraMessage) {
    lines.push("");
    lines.push("Дополнительно:");
    lines.push(extraMessage);
  }

  lines.push("");
  lines.push("Подскажите, пожалуйста, есть ли свободные места и как лучше оформить бронирование?");
  lines.push(`Буду ${phrases.grateful} за ответ.`);

  return lines.join("\n");
}

export function buildTransferLeadMessage(params: TransferLeadMessageParams): string {
  const phrases = getAuthorPhrases(params.authorGender);
  const transferTitle = params.transferTitle.trim() || "Трансфер";
  const locationName = params.locationName?.trim() ?? "";
  const priceLabel = params.priceLabel?.trim() ?? "";
  const vehicleOption = params.vehicleOption?.trim() ?? "";
  const extraTrimmed = params.extra?.trim() ?? "";
  const lines: string[] = [
    `Добрый день! ${phrases.foundListing} ваше объявление на сайте "Крым Вокруг".`,
    "",
    `${phrases.wouldLike} уточнить возможность заказать трансфер:`,
    `- Трансфер: "${transferTitle}"`,
  ];

  if (locationName) {
    lines.push(`- Город: ${locationName}`);
  }

  if (vehicleOption) {
    lines.push(`- Транспорт: ${vehicleOption}`);
  }

  if (priceLabel) {
    lines.push(`- Стоимость: ${priceLabel}`);
  }

  lines.push("");
  lines.push("Прошу подтвердить актуальность цены и возможность поездки.");

  if (extraTrimmed) {
    lines.push("");
    lines.push(`(Дополнительно: ${extraTrimmed})`);
  }

  lines.push("");
  lines.push(`Буду ${phrases.grateful} за ответ!`);

  return lines.join("\n");
}
