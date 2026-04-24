const publicMessengerLinks = {
  telegram: "https://t.me/Krymvokrug",
  max: "https://max.ru/u/f9LHodD0cOLyN2QyxqIDSy5C61Q5pbdVPR_SE7Y8wJ5pDMcqTlYxVpPSzSs",
} as const;

export const companyConfig = {
  brandName: "Крым Вокруг",
  domain: "krymvokrug.ru",
  baseUrl: "https://krymvokrug.ru",
  logoPath: "/favicon.svg",
  shortDescription:
    "Крым Вокруг — маркетплейс жилья у моря и экскурсий по Крыму. Сервис берет оплату только за размещение объявления на платформе и не удерживает комиссию с каждого клиента или бронирования.",
  region: "Республика Крым",
  countryName: "Россия",
  countryCode: "RU",
  ownerName: "Гаврисюк Александр Дмитриевич",
  legalName: "Гаврисюк Александр Дмитриевич",
  taxId: "910524018609",
  supportEmail: "krymvokrug@mail.ru",
  phone: "+7 (979) 047-53-36",
  addressLine: null as string | null,
  locality: null as string | null,
  postalCode: null as string | null,
  publicMessengerLinks,
  workingHoursLabel: "Ежедневно, с 09:00 до 21:00",
  socialLinks: Object.values(publicMessengerLinks),
  legalDocumentPublishedAt: "2026-04-04",
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
