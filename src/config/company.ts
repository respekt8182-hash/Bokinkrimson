import { LEGAL_DOCUMENT_EFFECTIVE_DATE, legalConfig } from "@/config/legal";

const publicMessengerLinks = {
  telegram: "https://t.me/Krymvokrug",
  max: "https://max.ru/u/f9LHodD0cOLyN2QyxqIDSy5C61Q5pbdVPR_SE7Y8wJ5pDMcqTlYxVpPSzSs",
} as const;

export const companyConfig = {
  brandName: legalConfig.business.brandName,
  domain: new URL(legalConfig.business.domain).hostname,
  baseUrl: legalConfig.business.domain,
  logoPath: "/krymvokrug-logo.svg",
  shortDescription:
    "Крым Вокруг — каталог жилья, экскурсий, туров и трансферов по Крыму. Сайт передает запросы владельцам и организаторам, не подтверждает бронирование проживания и не принимает оплату проживания.",
  region: "Республика Крым",
  countryName: "Россия",
  countryCode: "RU",
  ownerName: legalConfig.owner.fullName,
  legalName: legalConfig.owner.fullName,
  taxId: legalConfig.owner.inn,
  supportEmail: legalConfig.owner.contactEmail,
  phone: legalConfig.owner.contactPhone,
  addressLine: legalConfig.owner.claimsPostalAddress,
  locality: null as string | null,
  postalCode: null as string | null,
  publicMessengerLinks,
  workingHoursLabel: "Ежедневно, с 09:00 до 21:00",
  socialLinks: Object.values(publicMessengerLinks),
  legalDocumentPublishedAt: LEGAL_DOCUMENT_EFFECTIVE_DATE,
  publicContactNote:
    "По общим вопросам сервиса используйте публичные контакты, указанные на этой странице.",
} as const;

export function hasPublicCompanyContacts(): boolean {
  return Boolean(
    companyConfig.supportEmail ||
    companyConfig.phone ||
    companyConfig.addressLine ||
    companyConfig.socialLinks.length > 0,
  );
}
