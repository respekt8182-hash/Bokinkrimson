import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  calculateDistanceKm,
  isWithinRadiusKm,
  roundDistanceKm,
} from "@/lib/catalog-radius";
import { resolveCrimeaLocationCenter } from "@/lib/crimea-location-centers";
import { rankByTrigramWithScores } from "@/lib/fuzzy";
import { slugify } from "@/lib/public-properties";

export type StaticAttractionStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";

export type StaticAttractionGalleryImage = {
  url: string;
  alt: string;
};

export type StaticAttractionFact = {
  label: string;
  value: string;
};

export type StaticAttractionSection = {
  title: string;
  body: string[];
  list?: string[];
};

export type StaticAttractionFaqItem = {
  question: string;
  answer: string;
};

export type StaticAttraction = {
  id: string;
  slug: string;
  title: string;
  h1: string;
  seoTitle: string;
  metaDescription: string;
  category: string | null;
  tags: string[];
  locationName: string | null;
  locationAliases: string[];
  districtName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  shortDescription: string | null;
  description: string | null;
  gallery: StaticAttractionGalleryImage[];
  websiteUrl: string | null;
  mapUrl: string | null;
  facts: StaticAttractionFact[];
  sections: StaticAttractionSection[];
  nearby: string[];
  faq: StaticAttractionFaqItem[];
  searchKeywords: string[];
  status: StaticAttractionStatus;
  isPublishedVisible: boolean;
  createdByLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaticAttractionEditablePatch = Partial<
  Omit<StaticAttraction, "id" | "createdAt" | "createdByLogin">
> & {
  createdByLogin?: string | null;
  createdAt?: string;
};

type StaticAttractionOverrideFile = Record<string, StaticAttractionEditablePatch>;

const overridesFilePath = path.join(process.cwd(), "data", "attractions-overrides.json");

const BASE_STATIC_ATTRACTIONS: StaticAttraction[] = [
  {
    id: "attraction_lastochkino_gnezdo",
    slug: "lastochkino-gnezdo-krym",
    title: "Замок «Ласточкино гнездо»",
    h1: "Замок «Ласточкино гнездо» в Крыму",
    seoTitle: "Ласточкино гнездо в Крыму: как добраться, цены и фото",
    metaDescription:
      "Замок Ласточкино гнездо в Гаспре: описание, история, режим работы, цены, маршруты из Ялты и что посмотреть рядом.",
    category: "Дворцы и архитектура",
    tags: ["символ Крыма", "море", "смотровые площадки", "маршрут на полдня"],
    locationName: "Гаспра",
    locationAliases: ["Ялта", "Большая Ялта", "Мисхор", "Кореиз", "Южный берег Крыма"],
    districtName: "Ялтинский регион",
    address: "Алупкинское шоссе, 9А",
    latitude: 44.43066,
    longitude: 34.12847,
    shortDescription:
      "Миниатюрный замок на отвесной скале у моря, один из самых узнаваемых символов Южного берега Крыма.",
    description:
      "«Ласточкино гнездо» стоит на Аврориной скале мыса Ай-Тодор в посёлке Гаспра. Сюда едут за видом на Чёрное море, открыткой с южнобережным настроением и короткой прогулкой, которую легко совместить с Ливадией, Ай-Петри, Мисхором или Воронцовским дворцом.",
    gallery: [
      {
        url: "/attractions/lastochkino-gnezdo-krym/hero.webp",
        alt: "Замок Ласточкино гнездо на скале в Крыму",
      },
      {
        url: "/attractions/lastochkino-gnezdo-krym/sea-view.webp",
        alt: "Вид на Ласточкино гнездо и Чёрное море в Гаспре",
      },
      {
        url: "/attractions/lastochkino-gnezdo-krym/cliff.webp",
        alt: "Ласточкино гнездо на отвесной Аврориной скале",
      },
      {
        url: "/attractions/lastochkino-gnezdo-krym/square-view.webp",
        alt: "Смотровая площадка у замка Ласточкино гнездо",
      },
      {
        url: "/attractions/lastochkino-gnezdo-krym/detail.webp",
        alt: "Архитектурные детали замка Ласточкино гнездо",
      },
    ],
    websiteUrl: "https://xn-----6kcbqggkggtcllvchedg5cwa0j.xn--p1ai/",
    mapUrl:
      "https://yandex.ru/maps/?text=%D0%97%D0%B0%D0%BC%D0%BE%D0%BA%20%C2%AB%D0%9B%D0%B0%D1%81%D1%82%D0%BE%D1%87%D0%BA%D0%B8%D0%BD%D0%BE%20%D0%B3%D0%BD%D0%B5%D0%B7%D0%B4%D0%BE%C2%BB%20%D0%9A%D1%80%D1%8B%D0%BC",
    facts: [
      { label: "Время на месте", value: "30-90 минут" },
      { label: "Лучший сезон", value: "весна, начало лета, сентябрь-октябрь" },
      { label: "Формат", value: "самостоятельная прогулка, фото, экскурсия" },
      { label: "Подходит детям", value: "да, но у смотровых площадок нужна осторожность" },
    ],
    sections: [
      {
        title: "Почему стоит поехать",
        body: [
          "Главная ценность места не в размере здания, а в его положении: замок буквально нависает над морем и сразу даёт тот самый открыточный вид Южного берега.",
          "На месте можно прогуляться по территории, сделать фотографии у ограждений, посмотреть выставочные залы на первом этаже и спуститься к видовым точкам.",
        ],
      },
      {
        title: "Как добраться",
        body: [
          "На автомобиле удобнее ехать по направлению Ялта - Гаспра - Алупкинское шоссе. Из Ялты дорога обычно занимает около 20-40 минут, но летом время зависит от трафика.",
          "Без машины можно доехать общественным транспортом в сторону Гаспры, Мисхора или Алупки, затем пройти пешком до территории замка. Для семьи или маршрута на несколько остановок удобен индивидуальный трансфер.",
        ],
      },
      {
        title: "Что посмотреть рядом",
        body: [
          "Ласточкино гнездо легко добавить в маршрут по Большой Ялте. В один день с ним часто смотрят Ливадийский дворец, Солнечную тропу, Мисхор, Ай-Петри и Воронцовский дворец.",
        ],
        list: [
          "мыс Ай-Тодор и Ай-Тодорский маяк",
          "Харакский парк и дворец Харакс",
          "Ливадийский дворец",
          "Ай-Петри и Мисхор",
        ],
      },
      {
        title: "Практическая информация",
        body: [
          "Для быстрого осмотра хватит 30-40 минут, а для спокойной прогулки и выставок лучше заложить 1-1,5 часа. Летом комфортнее приезжать утром или ближе к вечеру.",
          "Возьмите удобную обувь, воду, головной убор и заряженный телефон. Цены, график и ограничения лучше уточнять перед поездкой, особенно в непогоду и высокий сезон.",
        ],
      },
    ],
    nearby: ["Ливадийский дворец", "Воронцовский дворец", "Ай-Петри", "Солнечная тропа", "Мисхор"],
    faq: [
      {
        question: "Где находится Ласточкино гнездо?",
        answer:
          "Замок находится в посёлке Гаспра, в Ялтинском регионе Крыма, по адресу Алупкинское шоссе, 9А.",
      },
      {
        question: "Сколько времени нужно на посещение?",
        answer:
          "Для быстрого осмотра хватит 30-40 минут. Для спокойной прогулки и выставочных залов лучше заложить 1-1,5 часа.",
      },
      {
        question: "Можно ли добраться без машины?",
        answer:
          "Да, из Ялты ходит транспорт в сторону Гаспры и Алупки, но маршруты и расписание лучше проверить перед поездкой.",
      },
    ],
    searchKeywords: [
      "Ласточкино гнездо Крым",
      "Ласточкино гнездо Ялта",
      "как добраться до Ласточкиного гнезда",
      "замок Ласточкино гнездо Гаспра",
    ],
    status: "PUBLISHED",
    isPublishedVisible: true,
    createdByLogin: "code",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  },
  {
    id: "attraction_vorontsovskiy_dvorets",
    slug: "vorontsovskiy-dvorets-alupka",
    title: "Воронцовский дворец",
    h1: "Воронцовский дворец в Алупке",
    seoTitle: "Воронцовский дворец в Алупке - как добраться и что посмотреть",
    metaDescription:
      "Воронцовский дворец в Алупке: история, парк, билеты, режим работы, как добраться из Ялты и что посмотреть рядом.",
    category: "Дворцы и парки",
    tags: ["музей", "парк", "Ай-Петри", "архитектура", "семейная прогулка"],
    locationName: "Алупка",
    locationAliases: ["Ялта", "Мисхор", "Кореиз", "Симеиз", "Южный берег Крыма"],
    districtName: "Ялтинский регион",
    address: "Дворцовое шоссе, 18",
    latitude: 44.419886,
    longitude: 34.055884,
    shortDescription:
      "Дворец XIX века в Алупке с парком, террасами, видами на Ай-Петри и морем рядом.",
    description:
      "Воронцовский дворец - дворцово-парковый ансамбль на Южном берегу Крыма. Сюда едут ради необычной архитектуры, мраморных львов, парадных залов, прогулочного парка и видов, где горы встречаются с морем.",
    gallery: [
      {
        url: "/attractions/vorontsovskiy-dvorets-alupka/hero.jpg",
        alt: "Воронцовский дворец в Алупке на фоне Ай-Петри",
      },
      {
        url: "/attractions/vorontsovskiy-dvorets-alupka/facade.jpg",
        alt: "Фасад Воронцовского дворца в Крыму",
      },
      {
        url: "/attractions/vorontsovskiy-dvorets-alupka/terrace.png",
        alt: "Южная терраса Воронцовского дворца",
      },
      {
        url: "/attractions/vorontsovskiy-dvorets-alupka/park.png",
        alt: "Алупкинский парк у Воронцовского дворца",
      },
      {
        url: "/attractions/vorontsovskiy-dvorets-alupka/aerial.jpg",
        alt: "Воронцовский дворец и парк с высоты",
      },
    ],
    websiteUrl: "https://worontsovpalace.ru/",
    mapUrl:
      "https://yandex.ru/maps/?text=%D0%92%D0%BE%D1%80%D0%BE%D0%BD%D1%86%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9%20%D0%B4%D0%B2%D0%BE%D1%80%D0%B5%D1%86%20%D0%9A%D1%80%D1%8B%D0%BC",
    facts: [
      { label: "Время на месте", value: "1,5-4 часа" },
      { label: "Лучший сезон", value: "апрель-июнь и сентябрь-октябрь" },
      { label: "Формат", value: "музей, парк, фотомаршрут" },
      { label: "Подходит детям", value: "да, особенно парк и внешняя прогулка" },
    ],
    sections: [
      {
        title: "Почему стоит поехать",
        body: [
          "Дворец соединяет английские, готические и восточные мотивы, а его южные террасы открываются к морю и Ай-Петри. Это не только музей, но и цельный прогулочный маршрут.",
          "Внутри можно посетить парадные залы и отдельные экспозиции, снаружи - пройти к мраморным львам, фонтанам, смотровым точкам и дорожкам Алупкинского парка.",
        ],
      },
      {
        title: "Как добраться",
        body: [
          "Из Ялты удобнее ехать через Ливадию, Ореанду, Гаспру и Кореиз. Время в пути обычно около 30-40 минут, но летом и в выходные возможны пробки.",
          "На общественном транспорте из Ялты используют маршруты до остановки «Воронцовский дворец» или до автостанции Алупки с пешим участком. Если хочется совместить дворец с Ай-Петри или Ласточкиным гнездом, удобнее брать экскурсию или трансфер.",
        ],
      },
      {
        title: "Что посмотреть на месте",
        body: [
          "Главные точки - парадные залы, Южная терраса, мраморные львы и Алупкинский парк. Для короткого знакомства хватит внешней прогулки, а для полноценного посещения лучше заложить несколько часов.",
        ],
        list: [
          "Главный корпус и парадные залы",
          "Южная терраса и мраморные львы",
          "Шуваловский корпус",
          "Воронцовская кухня",
          "Верхний и Нижний Алупкинский парк",
        ],
      },
      {
        title: "Практическая информация",
        body: [
          "Короткий осмотр занимает 1-1,5 часа, спокойная прогулка с парком - 2-3 часа, а экскурсия по залам с прогулкой - до 4 часов.",
          "Парк рельефный, поэтому лучше надеть удобную обувь. Летом приезжайте утром или ближе к вечеру: так меньше жары и проще с парковкой.",
        ],
      },
    ],
    nearby: [
      "Алупкинский парк",
      "Скала Айвазовского",
      "Ай-Петри",
      "Ласточкино гнездо",
      "Ливадийский дворец",
    ],
    faq: [
      {
        question: "Где находится Воронцовский дворец?",
        answer:
          "Воронцовский дворец находится в Алупке, на Южном берегу Крыма, по адресу Дворцовое шоссе, 18.",
      },
      {
        question: "Сколько времени нужно на посещение?",
        answer:
          "Минимум 1-1,5 часа, комфортно - 2-3 часа, с экскурсией по залам и парком - до 4 часов.",
      },
      {
        question: "Что посмотреть рядом?",
        answer:
          "Рядом находятся Алупкинский парк, Скала Айвазовского, пляжи Алупки, Ай-Петри, Ласточкино гнездо и Ливадийский дворец.",
      },
    ],
    searchKeywords: [
      "Воронцовский дворец Крым",
      "Воронцовский дворец Алупка",
      "Воронцовский дворец как добраться",
      "что посмотреть рядом с Воронцовским дворцом",
    ],
    status: "PUBLISHED",
    isPublishedVisible: true,
    createdByLogin: "code",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  },
];

let hasLoggedOverridesReadError = false;
let hasLoggedOverridesWriteError = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim().replace(/\s+/g, " ");
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? uniqueStrings(value.filter((item): item is string => typeof item === "string"))
    : [];
}

function normalizeGallery(value: unknown): StaticAttractionGalleryImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!url) {
        return null;
      }

      return {
        url,
        alt: typeof item.alt === "string" && item.alt.trim() ? item.alt.trim() : "Фото места",
      };
    })
    .filter((item): item is StaticAttractionGalleryImage => Boolean(item));
}

function normalizeFacts(value: unknown): StaticAttractionFact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const label = typeof item.label === "string" ? item.label.trim() : "";
      const factValue = typeof item.value === "string" ? item.value.trim() : "";
      return label && factValue ? { label, value: factValue } : null;
    })
    .filter((item): item is StaticAttractionFact => Boolean(item));
}

function normalizeSections(value: unknown): StaticAttractionSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const title = typeof item.title === "string" ? item.title.trim() : "";
      const body = normalizeStringArray(item.body);
      const list = normalizeStringArray(item.list);

      if (!title || (body.length === 0 && list.length === 0)) {
        return null;
      }

      return {
        title,
        body,
        ...(list.length > 0 ? { list } : {}),
      };
    })
    .filter((item): item is StaticAttractionSection => Boolean(item));
}

function normalizeFaq(value: unknown): StaticAttractionFaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const question = typeof item.question === "string" ? item.question.trim() : "";
      const answer = typeof item.answer === "string" ? item.answer.trim() : "";
      return question && answer ? { question, answer } : null;
    })
    .filter((item): item is StaticAttractionFaqItem => Boolean(item));
}

function normalizeStatus(value: unknown): StaticAttractionStatus {
  return value === "PUBLISHED" || value === "HIDDEN" ? value : "DRAFT";
}

function normalizeNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function normalizeAttraction(input: Partial<StaticAttraction> & { id: string }): StaticAttraction {
  const now = new Date().toISOString();
  const title = normalizeNullableString(input.title) ?? "Достопримечательность";
  const slug = normalizeNullableString(input.slug) ?? (slugify(title) || `attraction-${input.id}`);
  const h1 = normalizeNullableString(input.h1) ?? title;
  const seoTitle = normalizeNullableString(input.seoTitle) ?? `${title} - досуг в Крыму`;
  const metaDescription =
    normalizeNullableString(input.metaDescription) ??
    normalizeNullableString(input.shortDescription) ??
    `Описание места ${title} в каталоге Крым Вокруг.`;

  return {
    id: input.id,
    slug,
    title,
    h1,
    seoTitle,
    metaDescription,
    category: normalizeNullableString(input.category),
    tags: uniqueStrings(input.tags ?? []),
    locationName: normalizeNullableString(input.locationName),
    locationAliases: uniqueStrings(input.locationAliases ?? []),
    districtName: normalizeNullableString(input.districtName),
    address: normalizeNullableString(input.address),
    latitude: normalizeNumberOrNull(input.latitude),
    longitude: normalizeNumberOrNull(input.longitude),
    shortDescription: normalizeNullableString(input.shortDescription),
    description: normalizeNullableString(input.description),
    gallery: normalizeGallery(input.gallery),
    websiteUrl: normalizeNullableString(input.websiteUrl),
    mapUrl: normalizeNullableString(input.mapUrl),
    facts: normalizeFacts(input.facts),
    sections: normalizeSections(input.sections),
    nearby: uniqueStrings(input.nearby ?? []),
    faq: normalizeFaq(input.faq),
    searchKeywords: uniqueStrings(input.searchKeywords ?? []),
    status: normalizeStatus(input.status),
    isPublishedVisible: input.isPublishedVisible !== false,
    createdByLogin: normalizeNullableString(input.createdByLogin),
    createdAt: normalizeIsoDate(input.createdAt, now),
    updatedAt: normalizeIsoDate(input.updatedAt, now),
  };
}

async function readOverrideFile(): Promise<StaticAttractionOverrideFile> {
  try {
    const raw = await readFile(overridesFilePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as StaticAttractionOverrideFile) : {};
  } catch (error) {
    const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
    if (code !== "ENOENT" && !hasLoggedOverridesReadError) {
      hasLoggedOverridesReadError = true;
      console.error("Failed to read attraction overrides", error);
    }
    return {};
  }
}

async function writeOverrideFile(value: StaticAttractionOverrideFile): Promise<void> {
  try {
    await mkdir(path.dirname(overridesFilePath), { recursive: true });
    await writeFile(overridesFilePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch (error) {
    if (!hasLoggedOverridesWriteError) {
      hasLoggedOverridesWriteError = true;
      console.error("Failed to write attraction overrides", error);
    }
    throw error;
  }
}

function applyOverride(
  base: StaticAttraction,
  override: StaticAttractionEditablePatch,
): StaticAttraction {
  return normalizeAttraction({
    ...base,
    ...override,
    id: base.id,
    createdAt: override.createdAt ?? base.createdAt,
    createdByLogin: override.createdByLogin ?? base.createdByLogin,
  });
}

function createCustomAttraction(
  id: string,
  override: StaticAttractionEditablePatch,
): StaticAttraction {
  return normalizeAttraction({
    id,
    title: override.title ?? "Новая достопримечательность",
    slug: override.slug,
    h1: override.h1,
    seoTitle: override.seoTitle,
    metaDescription: override.metaDescription,
    category: override.category ?? null,
    tags: override.tags ?? [],
    locationName: override.locationName ?? null,
    locationAliases: override.locationAliases ?? [],
    districtName: override.districtName ?? null,
    address: override.address ?? null,
    latitude: override.latitude ?? null,
    longitude: override.longitude ?? null,
    shortDescription: override.shortDescription ?? null,
    description: override.description ?? null,
    gallery: override.gallery ?? [],
    websiteUrl: override.websiteUrl ?? null,
    mapUrl: override.mapUrl ?? null,
    facts: override.facts ?? [],
    sections: override.sections ?? [],
    nearby: override.nearby ?? [],
    faq: override.faq ?? [],
    searchKeywords: override.searchKeywords ?? [],
    status: override.status ?? "DRAFT",
    isPublishedVisible: override.isPublishedVisible ?? true,
    createdByLogin: override.createdByLogin ?? null,
    createdAt: override.createdAt ?? new Date().toISOString(),
    updatedAt: override.updatedAt ?? new Date().toISOString(),
  });
}

export async function getStaticAttractions(options?: {
  includeUnpublished?: boolean;
}): Promise<StaticAttraction[]> {
  const overrides = await readOverrideFile();
  const baseById = new Map(BASE_STATIC_ATTRACTIONS.map((item) => [item.id, item]));
  const result: StaticAttraction[] = BASE_STATIC_ATTRACTIONS.map((base) => {
    const override = overrides[base.id];
    return override ? applyOverride(base, override) : base;
  });

  for (const [id, override] of Object.entries(overrides)) {
    if (!baseById.has(id)) {
      result.push(createCustomAttraction(id, override));
    }
  }

  return result
    .filter((item) =>
      options?.includeUnpublished ? true : item.status === "PUBLISHED" && item.isPublishedVisible,
    )
    .sort((left, right) => {
      if (left.status !== right.status) {
        const statusOrder: Record<StaticAttractionStatus, number> = {
          PUBLISHED: 0,
          DRAFT: 1,
          HIDDEN: 2,
        };
        return statusOrder[left.status] - statusOrder[right.status];
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

export async function getStaticAttractionById(id: string): Promise<StaticAttraction | null> {
  const items = await getStaticAttractions({ includeUnpublished: true });
  return items.find((item) => item.id === id) ?? null;
}

export async function getStaticAttractionByIdentifier(
  identifier: string,
  options?: { includeUnpublished?: boolean },
): Promise<StaticAttraction | null> {
  const clean = identifier.trim().replace(/^\/+|\/+$/g, "");
  const items = await getStaticAttractions({
    includeUnpublished: options?.includeUnpublished,
  });

  return (
    items.find(
      (item) =>
        item.id === clean ||
        item.slug === clean ||
        `${slugify(item.title)}-${item.id}` === clean ||
        clean.endsWith(`-${item.id}`),
    ) ?? null
  );
}

export async function saveStaticAttraction(
  id: string,
  patch: StaticAttractionEditablePatch,
): Promise<StaticAttraction> {
  const current = await getStaticAttractionById(id);
  const now = new Date().toISOString();
  const normalizedPatch: StaticAttractionEditablePatch = {
    ...patch,
    updatedAt: now,
  };
  const overrides = await readOverrideFile();
  overrides[id] = normalizedPatch;
  await writeOverrideFile(overrides);

  return current
    ? applyOverride(current, normalizedPatch)
    : createCustomAttraction(id, normalizedPatch);
}

export async function createStaticAttractionDraft(input: {
  title?: string | null;
  createdByLogin?: string | null;
}): Promise<StaticAttraction> {
  const id = `attraction_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const title = input.title?.trim() || "Новая достопримечательность";
  const now = new Date().toISOString();

  return saveStaticAttraction(id, {
    title,
    h1: title,
    slug: slugify(title) || id,
    seoTitle: `${title} - досуг в Крыму`,
    metaDescription: `Описание места ${title} в каталоге Крым Вокруг.`,
    status: "DRAFT",
    isPublishedVisible: true,
    createdByLogin: input.createdByLogin ?? null,
    createdAt: now,
    updatedAt: now,
    tags: [],
    locationAliases: [],
    gallery: [],
    facts: [],
    sections: [],
    nearby: [],
    faq: [],
    searchKeywords: [],
  });
}

export async function getStaticAttractionCategories(): Promise<string[]> {
  const items = await getStaticAttractions();
  const categories = new Set<string>();
  for (const item of items) {
    if (item.category) {
      categories.add(item.category);
    }
  }

  return [...categories].sort((a, b) => a.localeCompare(b, "ru"));
}

function getPoint(item: Pick<StaticAttraction, "latitude" | "longitude">): {
  latitude: number;
  longitude: number;
} | null {
  return item.latitude !== null && item.longitude !== null
    ? { latitude: item.latitude, longitude: item.longitude }
    : null;
}

function getDistanceKm(
  center: { latitude: number; longitude: number } | null,
  point: { latitude: number; longitude: number } | null,
): number | null {
  return calculateDistanceKm(center, point);
}

async function resolveStaticLocationCenter(
  locationQuery: string,
  items: StaticAttraction[],
): Promise<{
  name: string;
  latitude: number;
  longitude: number;
} | null> {
  const normalizedQuery = normalizeText(locationQuery);
  if (!normalizedQuery) {
    return null;
  }

  const known = await resolveCrimeaLocationCenter(locationQuery);
  if (known) {
    return {
      name: known.name,
      latitude: known.latitude,
      longitude: known.longitude,
    };
  }

  const item = items.find((attraction) =>
    [attraction.locationName, attraction.districtName, ...attraction.locationAliases].some(
      (value) => normalizeText(value) === normalizedQuery,
    ),
  );

  if (item && item.latitude !== null && item.longitude !== null) {
    return {
      name: item.locationName ?? locationQuery,
      latitude: item.latitude,
      longitude: item.longitude,
    };
  }

  return null;
}

function containsQuery(query: string, candidates: Array<string | null | undefined>): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  return candidates.some((candidate) => normalizeText(candidate).includes(normalizedQuery));
}

export type StaticAttractionCatalogQuery = {
  query?: string;
  location?: string;
  category?: string;
  radiusKm?: number;
  sort?: "relevance" | "distance_asc" | "newest" | "name_asc";
  page?: number;
  pageSize?: number;
  allowLargePageSize?: boolean;
};

export type StaticAttractionCatalogEntry = {
  item: StaticAttraction;
  distanceKm: number | null;
};

export type StaticAttractionCatalogResult = {
  entries: StaticAttractionCatalogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    query: string | null;
    locationName: string | null;
    centerLat: number | null;
    centerLng: number | null;
    category: string | null;
    radiusKm: number;
    sort: "relevance" | "distance_asc" | "newest" | "name_asc";
  };
};

function parsePage(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value ?? 1)) : 1;
}

function parsePageSize(value: number | undefined, allowLargePageSize = false): number {
  const cap = allowLargePageSize ? 5000 : 30;
  return Number.isFinite(value) ? Math.min(cap, Math.max(1, Math.round(value ?? 30))) : 30;
}

function parseRadiusKm(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(5, Math.min(100, Math.round(value ?? 30))) : 30;
}

function parseSort(value: StaticAttractionCatalogQuery["sort"]) {
  return value === "distance_asc" || value === "newest" || value === "name_asc"
    ? value
    : "relevance";
}

export async function getStaticAttractionCatalog(
  query: StaticAttractionCatalogQuery,
): Promise<StaticAttractionCatalogResult> {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize, query.allowLargePageSize === true);
  const searchQuery = query.query?.trim() ?? "";
  const locationQuery = query.location?.trim() ?? "";
  const category = query.category?.trim() ?? "";
  const radiusKm = parseRadiusKm(query.radiusKm);
  const sort = parseSort(query.sort);
  const rows = await getStaticAttractions();
  const locationCenter = await resolveStaticLocationCenter(locationQuery, rows);
  const center = locationCenter
    ? { latitude: locationCenter.latitude, longitude: locationCenter.longitude }
    : null;
  const searchScores =
    searchQuery.length >= 2
      ? new Map(
          rankByTrigramWithScores(
            searchQuery,
            rows,
            (item) => [
              item.title,
              item.h1,
              item.category,
              item.locationName,
              item.districtName,
              item.address,
              item.shortDescription,
              item.description,
              ...item.tags,
              ...item.locationAliases,
              ...item.searchKeywords,
              ...item.nearby,
              ...item.sections.flatMap((section) => [
                section.title,
                ...section.body,
                ...(section.list ?? []),
              ]),
              ...item.faq.flatMap((faq) => [faq.question, faq.answer]),
            ],
            {
              limit: rows.length,
              minScore: 0.08,
            },
          ).map((entry) => [entry.item.id, entry.score]),
        )
      : new Map<string, number>();

  const filtered = rows
    .map((item) => {
      const point = getPoint(item);
      const distanceKm = getDistanceKm(center, point);
      const locationMatch = locationCenter
        ? isWithinRadiusKm(distanceKm, radiusKm)
        : !locationQuery ||
          containsQuery(locationQuery, [
            item.locationName,
            item.districtName,
            item.address,
            ...item.locationAliases,
          ]);

      if (!locationMatch) {
        return null;
      }

      if (category && normalizeText(item.category) !== normalizeText(category)) {
        return null;
      }

      const searchScore = searchScores.get(item.id) ?? 0;
      if (
        searchQuery &&
        searchScore <= 0 &&
        !containsQuery(searchQuery, [
          item.title,
          item.h1,
          item.category,
          item.locationName,
          item.districtName,
          item.address,
          item.shortDescription,
          item.description,
          ...item.tags,
          ...item.locationAliases,
          ...item.searchKeywords,
          ...item.nearby,
        ])
      ) {
        return null;
      }

      const distanceScore =
        distanceKm === null
          ? 0
          : Math.max(0, (1 - distanceKm / Math.max(radiusKm * 2, 30)) * 20);
      const locationAliasScore =
        locationQuery &&
        containsQuery(locationQuery, [
          item.locationName,
          item.districtName,
          ...item.locationAliases,
        ])
          ? 24
          : 0;
      const relevance = searchScore * 70 + distanceScore + locationAliasScore;

      return { item, distanceKm, relevance };
    })
    .filter((entry): entry is StaticAttractionCatalogEntry & { relevance: number } =>
      Boolean(entry),
    );

  filtered.sort((left, right) => {
    if (sort === "distance_asc") {
      if (left.distanceKm === null && right.distanceKm === null) return 0;
      if (left.distanceKm === null) return 1;
      if (right.distanceKm === null) return -1;
      return left.distanceKm - right.distanceKm;
    }

    if (sort === "name_asc") {
      return left.item.title.localeCompare(right.item.title, "ru");
    }

    if (sort === "newest") {
      return new Date(right.item.updatedAt).getTime() - new Date(left.item.updatedAt).getTime();
    }

    const byRelevance = right.relevance - left.relevance;
    if (Math.abs(byRelevance) > 0.00001) return byRelevance;
    return new Date(right.item.updatedAt).getTime() - new Date(left.item.updatedAt).getTime();
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const entries = filtered
    .slice((safePage - 1) * pageSize, safePage * pageSize)
    .map(({ item, distanceKm }) => ({ item, distanceKm: roundDistanceKm(distanceKm) }));

  return {
    entries,
    total,
    page: safePage,
    pageSize,
    totalPages,
    filters: {
      query: searchQuery || null,
      locationName: locationCenter?.name ?? (locationQuery || null),
      centerLat: center?.latitude ?? null,
      centerLng: center?.longitude ?? null,
      category: category || null,
      radiusKm,
      sort,
    },
  };
}
