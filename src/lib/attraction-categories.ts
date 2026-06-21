export const ATTRACTION_CATEGORIES = [
  { id: "beach", label: "Море и пляжи" },
  { id: "nature", label: "Природа и маршруты" },
  { id: "history", label: "История и археология" },
  { id: "palace", label: "Дворцы и архитектура" },
  { id: "culture", label: "Музеи и культура" },
  { id: "religion", label: "Храмы и религия" },
  { id: "city", label: "Парки и городские прогулки" },
  { id: "entertainment", label: "Развлечения и семья" },
] as const;

export type AttractionCategoryId = (typeof ATTRACTION_CATEGORIES)[number]["id"];
export type AttractionCategory = (typeof ATTRACTION_CATEGORIES)[number];

const categoryAliases: Record<AttractionCategoryId, string[]> = {
  beach: [
    "Море и пляжи",
    "Пляжи и купание",
    "Море, бухты, мысы и маяки",
    "Маяки и виды",
    "Пляжи и набережные",
    "Природа и пляжи",
  ],
  nature: [
    "Природа и маршруты",
    "Горы, скалы и пещеры",
    "Водопады, озёра и водоёмы",
    "Смотровые и маршруты",
    "Заповедники, урочища и природные парки",
    "Природа и водопады",
    "Природа и озёра",
    "Природа и заповедники",
    "Горы и смотровые",
    "Маршруты и тропы",
  ],
  history: [
    "История и археология",
    "История, археология и военные объекты",
    "История и мемориалы",
    "Крепости и древности",
    "Крепости",
    "Пещерные города",
    "Пещерные города и монастыри",
  ],
  palace: ["Дворцы и архитектура", "Дворцы, дачи и архитектура", "Дворцы и парки"],
  culture: [
    "Музеи и культура",
    "Музеи, культура и памятники",
    "Музеи и выставки",
    "Винодельни, гастро и производства",
  ],
  religion: [
    "Храмы и религия",
    "Храмы, монастыри и религия",
    "Храмы и святыни",
    "Храмы и исторические места",
  ],
  city: [
    "Парки и городские прогулки",
    "Городские прогулки, парки и инфраструктура",
    "Парки и сады",
    "Парки и дворцы",
    "Инженерные объекты",
  ],
  entertainment: [
    "Развлечения и семья",
    "Развлечения и семейный отдых",
    "Семейный отдых",
    "Досуг и места отдыха",
  ],
};

function normalizeCategory(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const categoryByAlias = new Map<string, AttractionCategory>(
  ATTRACTION_CATEGORIES.flatMap((category) =>
    categoryAliases[category.id].map((alias) => [normalizeCategory(alias), category] as const),
  ),
);

export function getAttractionCategory(value: string | null | undefined): AttractionCategory | null {
  const normalized = normalizeCategory(value?.trim() ?? "");
  if (!normalized) {
    return null;
  }

  const exact = categoryByAlias.get(normalized);
  if (exact) {
    return exact;
  }

  if (/пляж|море|бухт|мыс|маяк/.test(normalized)) return ATTRACTION_CATEGORIES[0];
  if (/гор|скал|пещер|водопад|озер|водоем|маршрут|троп|смотров|заповед|урочищ/.test(normalized)) {
    return ATTRACTION_CATEGORIES[1];
  }
  if (/истор|археолог|военн|мемориал|крепост|древност/.test(normalized))
    return ATTRACTION_CATEGORIES[2];
  if (/двор|дач|архитект/.test(normalized)) return ATTRACTION_CATEGORIES[3];
  if (/музе|культур|памятник|выстав|винодел|гастро|производств/.test(normalized))
    return ATTRACTION_CATEGORIES[4];
  if (/храм|монастыр|религи|святын|церк|собор|мечет/.test(normalized))
    return ATTRACTION_CATEGORIES[5];
  if (/город|парк|сад|прогул|инфраструктур|инженер/.test(normalized))
    return ATTRACTION_CATEGORIES[6];
  if (/развлеч|семейн|досуг|аквапарк|зоопарк|театр|цирк/.test(normalized))
    return ATTRACTION_CATEGORIES[7];

  return null;
}

export function getAttractionCategoryLabel(value: string | null | undefined): string | null {
  return getAttractionCategory(value)?.label ?? null;
}

export function isAttractionInCategory(
  itemCategory: string | null | undefined,
  selectedCategory: string | null | undefined,
): boolean {
  const selected = getAttractionCategory(selectedCategory);
  if (!selected) {
    return normalizeCategory(itemCategory ?? "") === normalizeCategory(selectedCategory ?? "");
  }

  return getAttractionCategory(itemCategory)?.id === selected.id;
}
