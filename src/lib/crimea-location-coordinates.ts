export type CrimeaLocationCenter = {
  name: string;
  latitude: number;
  longitude: number;
  zoom: number;
  keys: string[];
};

const locationTypePrefixPattern =
  /^(?:г\.?|город|пгт\.?|пос[её]лок\s+городского\s+типа|пос\.?|пос[её]лок|с\.?|село|д\.?|деревня)\s+/i;

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCrimeaLocationKey(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return compact(value)
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[«»"']/g, "")
    .replace(/\b(?:республика\s+крым|крым|россия)\b/g, " ")
    .replace(/\b(?:городской\s+округ|муниципальный\s+округ|район)\b/g, " ")
    .replace(/[.,;:()]/g, " ")
    .replace(locationTypePrefixPattern, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createCenter(input: Omit<CrimeaLocationCenter, "keys"> & { keys?: string[] }) {
  const keys = new Set([input.name, ...(input.keys ?? [])].map(normalizeCrimeaLocationKey).filter(Boolean));

  return {
    ...input,
    keys: Array.from(keys),
  } satisfies CrimeaLocationCenter;
}

export const CRIMEA_LOCATION_CENTERS: CrimeaLocationCenter[] = [
  createCenter({
    name: "Симферополь",
    latitude: 44.9521,
    longitude: 34.1024,
    zoom: 12,
    keys: ["simferopol"],
  }),
  createCenter({
    name: "Севастополь",
    latitude: 44.6167,
    longitude: 33.5254,
    zoom: 11,
    keys: ["sevastopol"],
  }),
  createCenter({
    name: "Ялта",
    latitude: 44.4952,
    longitude: 34.1663,
    zoom: 12,
    keys: ["yalta", "Большая Ялта"],
  }),
  createCenter({
    name: "Алушта",
    latitude: 44.6764,
    longitude: 34.4101,
    zoom: 12,
    keys: ["alushta"],
  }),
  createCenter({
    name: "Алупка",
    latitude: 44.4181,
    longitude: 34.0453,
    zoom: 13,
    keys: ["alupka"],
  }),
  createCenter({
    name: "Евпатория",
    latitude: 45.1906,
    longitude: 33.3676,
    zoom: 12,
    keys: ["evpatoria", "yevpatoria"],
  }),
  createCenter({
    name: "Керчь",
    latitude: 45.3562,
    longitude: 36.4673,
    zoom: 12,
    keys: ["kerch"],
  }),
  createCenter({
    name: "Судак",
    latitude: 44.8491,
    longitude: 34.9747,
    zoom: 12,
    keys: ["sudak"],
  }),
  createCenter({
    name: "Феодосия",
    latitude: 45.0319,
    longitude: 35.3824,
    zoom: 12,
    keys: ["feodosiya", "feodosia"],
  }),
  createCenter({
    name: "Бахчисарай",
    latitude: 44.7526,
    longitude: 33.8606,
    zoom: 12,
    keys: ["bakhchisaray", "bakhchysarai", "Бахчисарайский"],
  }),
  createCenter({
    name: "Саки",
    latitude: 45.1342,
    longitude: 33.6031,
    zoom: 12,
    keys: ["saki"],
  }),
  createCenter({
    name: "Белогорск",
    latitude: 45.0546,
    longitude: 34.601,
    zoom: 12,
    keys: ["belogorsk"],
  }),
  createCenter({
    name: "Джанкой",
    latitude: 45.7086,
    longitude: 34.3934,
    zoom: 12,
    keys: ["dzhankoy", "djankoy"],
  }),
  createCenter({
    name: "Армянск",
    latitude: 46.1092,
    longitude: 33.6921,
    zoom: 12,
    keys: ["armyansk"],
  }),
  createCenter({
    name: "Красноперекопск",
    latitude: 45.9572,
    longitude: 33.7965,
    zoom: 12,
    keys: ["krasnoperekopsk"],
  }),
  createCenter({
    name: "Старый Крым",
    latitude: 45.0289,
    longitude: 35.0917,
    zoom: 12,
    keys: ["stary krym", "staryi krym"],
  }),
  createCenter({
    name: "Щёлкино",
    latitude: 45.4287,
    longitude: 35.8223,
    zoom: 12,
    keys: ["Щелкино", "schelkino", "shchyolkino"],
  }),
  createCenter({
    name: "Инкерман",
    latitude: 44.6139,
    longitude: 33.6098,
    zoom: 13,
    keys: ["inkerman"],
  }),
  createCenter({
    name: "Балаклава",
    latitude: 44.5007,
    longitude: 33.6009,
    zoom: 13,
    keys: ["balaklava"],
  }),
  createCenter({
    name: "Гаспра",
    latitude: 44.4336,
    longitude: 34.1022,
    zoom: 13,
    keys: ["gaspra"],
  }),
  createCenter({
    name: "Кореиз",
    latitude: 44.433,
    longitude: 34.085,
    zoom: 13,
    keys: ["koreiz", "Мисхор", "miskhor"],
  }),
  createCenter({
    name: "Симеиз",
    latitude: 44.4077,
    longitude: 33.9984,
    zoom: 13,
    keys: ["simeiz"],
  }),
  createCenter({
    name: "Гурзуф",
    latitude: 44.5462,
    longitude: 34.2804,
    zoom: 13,
    keys: ["gurzuf"],
  }),
  createCenter({
    name: "Партенит",
    latitude: 44.5785,
    longitude: 34.3446,
    zoom: 13,
    keys: ["partenit"],
  }),
  createCenter({
    name: "Массандра",
    latitude: 44.517,
    longitude: 34.203,
    zoom: 13,
    keys: ["massandra"],
  }),
  createCenter({
    name: "Ливадия",
    latitude: 44.4678,
    longitude: 34.1436,
    zoom: 13,
    keys: ["livadia"],
  }),
  createCenter({
    name: "Форос",
    latitude: 44.3924,
    longitude: 33.7884,
    zoom: 13,
    keys: ["foros"],
  }),
  createCenter({
    name: "Коктебель",
    latitude: 44.9613,
    longitude: 35.2466,
    zoom: 13,
    keys: ["koktebel"],
  }),
  createCenter({
    name: "Новый Свет",
    latitude: 44.8308,
    longitude: 34.9141,
    zoom: 13,
    keys: ["novy svet", "novyy svet"],
  }),
  createCenter({
    name: "Черноморское",
    latitude: 45.5066,
    longitude: 32.6978,
    zoom: 12,
    keys: ["chernomorskoe"],
  }),
  createCenter({
    name: "Оленевка",
    latitude: 45.3833,
    longitude: 32.5333,
    zoom: 13,
    keys: ["olenevka"],
  }),
  createCenter({
    name: "Николаевка",
    latitude: 44.9639,
    longitude: 33.6108,
    zoom: 13,
    keys: ["nikolaevka"],
  }),
  createCenter({
    name: "Молочное",
    latitude: 45.225,
    longitude: 33.1549,
    zoom: 13,
    keys: ["molochnoe"],
  }),
  createCenter({
    name: "Ленино",
    latitude: 45.2984,
    longitude: 35.7778,
    zoom: 12,
    keys: ["lenino"],
  }),
  createCenter({
    name: "Кировское",
    latitude: 45.2298,
    longitude: 35.1999,
    zoom: 12,
    keys: ["kirovskoe"],
  }),
  createCenter({
    name: "Нижнегорский",
    latitude: 45.4473,
    longitude: 34.7384,
    zoom: 12,
    keys: ["nizhnegorsky", "nizhnegorskiy"],
  }),
  createCenter({
    name: "Первомайское",
    latitude: 45.7176,
    longitude: 33.8556,
    zoom: 12,
    keys: ["pervomayskoe"],
  }),
  createCenter({
    name: "Раздольное",
    latitude: 45.7711,
    longitude: 33.4874,
    zoom: 12,
    keys: ["razdolnoe"],
  }),
  createCenter({
    name: "Советский",
    latitude: 45.3428,
    longitude: 34.9267,
    zoom: 12,
    keys: ["sovetsky", "sovetskiy"],
  }),
];

const centerByKey = new Map<string, CrimeaLocationCenter>();

for (const center of CRIMEA_LOCATION_CENTERS) {
  for (const key of center.keys) {
    centerByKey.set(key, center);
  }
}

export function getKnownCrimeaLocationCenter(
  value: string | null | undefined,
): CrimeaLocationCenter | null {
  const normalized = normalizeCrimeaLocationKey(value);
  if (!normalized) {
    return null;
  }

  const exact = centerByKey.get(normalized);
  if (exact) {
    return exact;
  }

  const parts = normalized
    .split(/\s*[,/|-]\s*|\s+-\s+/)
    .map(normalizeCrimeaLocationKey)
    .filter(Boolean);

  for (const part of parts) {
    const matched = centerByKey.get(part);
    if (matched) {
      return matched;
    }
  }

  return null;
}
