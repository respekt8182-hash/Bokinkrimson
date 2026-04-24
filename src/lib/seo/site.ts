import { companyConfig } from "@/config/company";

const localHostnameSet = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function normalizeLocationName(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

const prepositionalLocationByName: Record<string, string> = {
  алупка: "Алупке",
  алушта: "Алуште",
  бахчисарай: "Бахчисарае",
  евпатория: "Евпатории",
  керчь: "Керчи",
  коктебель: "Коктебеле",
  севастополь: "Севастополе",
  симферополь: "Симферополе",
  судак: "Судаке",
  феодосия: "Феодосии",
  щелкино: "Щёлкино",
  ялта: "Ялте",
};

export const siteConfig = {
  name: companyConfig.brandName,
  shortDescription: companyConfig.shortDescription,
  defaultTitle: companyConfig.brandName,
  titleTemplate: "%s | Крым Вокруг",
  organizationIdPath: "/#organization",
};

export function resolveBaseUrl(): string {
  const fallbackUrl = new URL(companyConfig.baseUrl);
  const rawValue = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!rawValue) {
    return fallbackUrl.toString().replace(/\/$/, "");
  }

  try {
    const parsed = new URL(rawValue);
    if (localHostnameSet.has(parsed.hostname)) {
      return fallbackUrl.toString().replace(/\/$/, "");
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallbackUrl.toString().replace(/\/$/, "");
  }
}

export function resolveMetadataBase(): URL {
  return new URL(resolveBaseUrl());
}

export function absoluteUrl(path = "/"): string {
  return new URL(path, resolveBaseUrl()).toString();
}

export function formatLocationInPrepositional(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const inflected = prepositionalLocationByName[normalizeLocationName(normalized)];
  if (inflected) {
    return `в ${inflected}`;
  }

  return `в городе ${normalized}`;
}
