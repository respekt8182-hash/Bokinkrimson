export const LEGAL_DOCUMENT_EFFECTIVE_DATE = "2026-06-24";

function envOrFallback(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const legalConfig = {
  owner: {
    fullName: "Гаврисюк Александр Дмитриевич",
    inn: "910524018609",
    taxStatus: "SELF_EMPLOYED_NPD",
    claimsPostalAddress: envOrFallback(
      "LEGAL_CLAIMS_POSTAL_ADDRESS",
      "[ПОЧТОВЫЙ АДРЕС ДЛЯ ПРЕТЕНЗИЙ]",
    ),
    contactEmail: "krymvokrug@mail.ru",
    contactPhone: "+7 (979) 047-53-36",
    supportContact: "krymvokrug@mail.ru",
  },
  business: {
    brandName: "Крым Вокруг",
    domain: "https://krymvokrug.ru",
    platformMode: "LEAD_DIRECTORY",
    accommodationPaymentsEnabled: false,
    platformServicePaymentsEnabled: true,
    vatStatus:
      "НДС не облагается в связи с применением специального налогового режима «Налог на профессиональный доход»",
    paidPlatformServices: [
      "размещение карточки",
      "продление размещения",
      "продвижение карточки",
      "фотосъемка",
      "размещение дополнительного автомобиля",
      "иные отдельно описанные услуги платформы",
    ],
  },
  personalData: {
    rknNotificationNumber: envOrFallback(
      "LEGAL_RKN_NOTIFICATION_NUMBER",
      "[НОМЕР ЗАПИСИ ИЛИ TODO]",
    ),
    primaryDatabaseCountry: envOrFallback("LEGAL_PRIMARY_DATABASE_COUNTRY", "[СТРАНА]"),
    primaryDatabaseRegion: envOrFallback("LEGAL_PRIMARY_DATABASE_REGION", "[РЕГИОН ИЛИ ЦОД]"),
  },
  documents: {
    offerVersion: "2026-06-24",
    privacyVersion: "2026-06-24",
    personalDataConsentVersion: "2026-06-24",
    publicDataConsentVersion: "2026-06-24",
    marketingConsentVersion: "2026-06-24",
    cookiePolicyVersion: "2026-06-24",
    termsVersion: "2026-06-24",
    refundVersion: "2026-06-24",
    copyrightComplaintVersion: "2026-06-24",
    reviewPublicationConsentVersion: "2026-06-24",
  },
  processors: {
    payment: "YooKassa",
    analytics: "Yandex Metrika после opt-in",
    maps: "Yandex Maps / Geocoder",
    email: "SMTP через nodemailer или log mode",
    storage: "Local uploads или S3-compatible storage",
    rateLimit: "In-memory или Upstash Redis",
  },
} as const;

export type LegalConfig = typeof legalConfig;
export type LegalOwnerTaxStatus = LegalConfig["owner"]["taxStatus"];
export type LegalConfigLike = typeof legalConfig;

const placeholderPattern =
  /\[(?=[^\]]*(?:TODO|ФИО|ИНН|EMAIL|ТЕЛЕФОН|СТРАНА|РЕГИОН|ЦОД|ПОЧТОВЫЙ|НОМЕР|ВЕРСИЯ))[^\]]+\]/i;

function collectStringValues(value: unknown, path: string[] = []): Array<{ path: string; value: string }> {
  if (typeof value === "string") {
    return [{ path: path.join("."), value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStringValues(item, [...path, String(index)]));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectStringValues(item, [...path, key]));
  }

  return [];
}

export function getOwnerNpdStatement(): string {
  return `Исполнитель: ${legalConfig.owner.fullName}, физическое лицо, применяющее специальный налоговый режим «Налог на профессиональный доход», ИНН ${legalConfig.owner.inn}. ${legalConfig.business.vatStatus}.`;
}

export function getDocumentMeta(version: string, pathname: string) {
  return [
    { label: "Версия", value: version },
    { label: "Вступает в силу", value: LEGAL_DOCUMENT_EFFECTIVE_DATE },
    { label: "Последнее изменение", value: LEGAL_DOCUMENT_EFFECTIVE_DATE },
    { label: "Постоянный URL", value: `${legalConfig.business.domain}${pathname}` },
  ];
}

export function validateLegalConfig(config: LegalConfigLike): string[] {
  const errors: string[] = [];

  if (!config.owner.fullName.trim()) {
    errors.push("owner.fullName is required");
  }

  if (!config.owner.inn.trim()) {
    errors.push("owner.inn is required");
  }

  if (!config.owner.claimsPostalAddress.trim()) {
    errors.push("owner.claimsPostalAddress is required");
  }

  if (!config.owner.contactEmail.trim()) {
    errors.push("owner.contactEmail is required");
  }

  if (
    config.business.platformServicePaymentsEnabled &&
    config.owner.taxStatus !== "SELF_EMPLOYED_NPD"
  ) {
    errors.push("platform service payments require SELF_EMPLOYED_NPD tax status");
  }

  if (config.business.accommodationPaymentsEnabled) {
    errors.push("accommodation payments must be disabled for LEAD_DIRECTORY mode");
  }

  if (!config.personalData.primaryDatabaseCountry.trim()) {
    errors.push("personalData.primaryDatabaseCountry is required");
  }

  for (const key of [
    "offerVersion",
    "privacyVersion",
    "personalDataConsentVersion",
    "publicDataConsentVersion",
    "cookiePolicyVersion",
    "termsVersion",
  ] as const) {
    if (!config.documents[key].trim()) {
      errors.push(`documents.${key} is required`);
    }
  }

  for (const item of collectStringValues(config)) {
    if (placeholderPattern.test(item.value)) {
      errors.push(`${item.path} contains placeholder value`);
    }
  }

  return errors;
}

export function getLegalValidationErrors(): string[] {
  return validateLegalConfig(legalConfig);
}

export function assertLegalConfigForProduction(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const errors = getLegalValidationErrors();
  if (errors.length > 0) {
    throw new Error(`Legal production configuration is incomplete:\n${errors.join("\n")}`);
  }
}
