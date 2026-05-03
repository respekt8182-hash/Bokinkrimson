#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "Dosto premet krym");
const overridesPath = path.join(root, "data", "attractions-overrides.json");
const publicAttractionsRoot = path.join(root, "public", "attractions");
const importedAt = "2026-04-30T06:45:00.000Z";

const seoFilePaths = [
  path.join(sourceRoot, "101-110.txt"),
  path.join(sourceRoot, "121-129.txt"),
  path.join(sourceRoot, "162-171.txt"),
];

const entries = [
  {
    id: "attraction_buhta_laspi",
    sourceTitle: "Бухта Ласпи",
    sourceDir: "101 Бухта Ласпи",
    title: "Бухта Ласпи",
    slug: "buhta-laspi",
    category: "Природа и пляжи",
    locationName: "Ласпи",
    locationAliases: ["Форос", "Батилиман", "мыс Айя", "Севастопольский регион"],
    districtName: "Севастопольский регион",
    address: "район бухты Ласпи, трасса Ялта - Севастополь",
    latitude: 44.410184,
    longitude: 33.702472,
    tags: ["бухта", "море", "пляжи", "Ласпи", "Южный берег"],
    nearby: ["Батилиман", "Ласпинский перевал", "мыс Айя", "Куш-Кая", "Форос"],
  },
  {
    id: "attraction_buhta_batiliman",
    sourceTitle: "Бухта Батилиман",
    sourceDir: "102 Бухта Батилиман",
    title: "Бухта Батилиман",
    slug: "buhta-batiliman",
    category: "Природа и пляжи",
    locationName: "Батилиман",
    locationAliases: ["Ласпи", "Куш-Кая", "мыс Айя", "Севастопольский регион"],
    districtName: "Севастопольский регион",
    address: "урочище Батилиман, между бухтой Ласпи и мысом Айя",
    latitude: 44.420163,
    longitude: 33.68349,
    tags: ["бухта", "урочище", "пляжи", "сосны", "Батилиман"],
    nearby: ["бухта Ласпи", "Куш-Кая", "мыс Айя", "Большая Севастопольская тропа"],
  },
  {
    id: "attraction_buhty_novogo_sveta",
    sourceTitle: "Бухты Нового Света",
    sourceDir: "104 Бухты Нового Света",
    title: "Бухты Нового Света",
    slug: "buhty-novogo-sveta",
    category: "Природа и пляжи",
    locationName: "Новый Свет",
    locationAliases: ["Судак", "Зелёная бухта", "Синяя бухта", "Голубая бухта", "мыс Капчик"],
    districtName: "Судакский регион",
    address: "посёлок Новый Свет, бухты у тропы Голицына",
    latitude: 44.821834,
    longitude: 34.9116,
    tags: ["бухты", "Новый Свет", "море", "тропа Голицына", "мыс Капчик"],
    nearby: ["Голицынская тропа", "грот Шаляпина", "мыс Капчик", "гора Сокол", "Судак"],
  },
  {
    id: "attraction_ozero_donuzlav",
    sourceTitle: "Озеро Донузлав",
    sourceDir: "106 Озеро Донузлав",
    title: "Озеро Донузлав",
    slug: "ozero-donuzlav",
    category: "Природа и озёра",
    locationName: "Донузлав",
    locationAliases: ["Мирный", "Черноморский район", "Евпатория", "Западный Крым"],
    districtName: "Черноморский район",
    address: "озеро Донузлав, западный Крым",
    latitude: 45.351048,
    longitude: 33.024427,
    tags: ["озеро", "лиман", "кайтинг", "рыбалка", "Западный Крым"],
    nearby: ["Мирный", "Поповка", "Оленевка", "Тарханкут", "Евпатория"],
  },
  {
    id: "attraction_cherepashye_ozero_yalta",
    sourceTitle: "Черепашье озеро, Ялта — дорога на Ай-Петри",
    sourceDir: "107 Черепашье озеро (Ялта)",
    title: "Черепашье озеро",
    slug: "cherepashye-ozero-yalta",
    category: "Природа и озёра",
    locationName: "Ялта",
    locationAliases: ["Ай-Петри", "Бахчисарайское шоссе", "Ялтинский заповедник", "Большая Ялта"],
    districtName: "Ялтинский регион",
    address: "Бахчисарайское шоссе, дорога Ялта - Ай-Петри",
    latitude: 44.47515,
    longitude: 34.08556,
    tags: ["озеро", "черепахи", "экотропа", "Ай-Петри", "Ялта"],
    nearby: ["Ай-Петри", "Учан-Су", "Штангеевская тропа", "Серебряная беседка"],
  },
  {
    id: "attraction_goluboe_ozero_bolshoy_kanon",
    sourceTitle: "Голубое озеро, Большой каньон Крыма",
    sourceDir: "108 Голубое озеро (Большой каньон)",
    title: "Голубое озеро",
    slug: "goluboe-ozero-bolshoy-kanon",
    category: "Природа и озёра",
    locationName: "Большой каньон Крыма",
    locationAliases: ["Соколиное", "Бахчисарайский район", "Аузун-Узень", "Ванна Молодости"],
    districtName: "Бахчисарайский район",
    address: "Большой каньон Крыма, район села Соколиное",
    latitude: 44.527965,
    longitude: 34.021912,
    tags: ["озеро", "Большой каньон", "горный маршрут", "Соколиное", "природа"],
    nearby: ["Ванна Молодости", "источник Пания", "Большой каньон Крыма", "Соколиное"],
  },
  {
    id: "attraction_vanna_molodosti_bolshoy_kanon",
    sourceTitle: "Ванна Молодости, Большой каньон Крыма",
    sourceDir: "109 Ванна Молодости (Большой каньон)",
    title: "Ванна Молодости",
    slug: "vanna-molodosti-bolshoy-kanon",
    category: "Природа и водопады",
    locationName: "Большой каньон Крыма",
    locationAliases: ["Соколиное", "Аузун-Узень", "Кара-Голь", "Бахчисарайский район"],
    districtName: "Бахчисарайский район",
    address: "Большой каньон Крыма, район села Соколиное",
    latitude: 44.525559,
    longitude: 34.007805,
    tags: ["купель", "Большой каньон", "горная вода", "Соколиное", "маршрут"],
    nearby: ["Голубое озеро", "источник Пания", "Соколиное", "Ай-Петри"],
  },
  {
    id: "attraction_mangupskoe_ozero",
    sourceTitle: "Мангупское озеро, или Девичье озеро",
    sourceDir: "110 Мангупское озеро",
    title: "Мангупское озеро",
    slug: "mangupskoe-ozero",
    category: "Природа и озёра",
    locationName: "Ходжа-Сала",
    locationAliases: ["Мангуп-Кале", "Девичье озеро", "Залесное", "Бахчисарайский район"],
    districtName: "Бахчисарайский район",
    address: "село Ходжа-Сала, у подножия Мангуп-Кале",
    latitude: 44.608543,
    longitude: 33.787639,
    tags: ["озеро", "Мангуп-Кале", "Ходжа-Сала", "пикник", "Бахчисарай"],
    nearby: ["Мангуп-Кале", "Сфинксы Каралезской долины", "Эски-Кермен", "Залесное"],
  },
  {
    id: "attraction_aktashskoe_ozero",
    sourceDir: "111 Акташское озеро",
    title: "Акташское озеро",
    slug: "aktashskoe-ozero",
    category: "Природа и озёра",
    locationName: "Щёлкино",
    locationAliases: ["Мысовое", "Казантип", "Ленинский район", "Керченский полуостров"],
    districtName: "Ленинский район",
    address: "север Керченского полуострова, район Щёлкино и Мысового",
    latitude: 45.372511,
    longitude: 35.802703,
    tags: ["озеро", "Казантип", "Азовское море", "степь", "Щёлкино"],
    nearby: ["мыс Казантип", "Казантипский заповедник", "Щёлкино", "Мысовое"],
  },
  {
    id: "attraction_chokrakskoe_ozero",
    sourceDir: "112 Чокракское озеро (грязелечебное)",
    title: "Чокракское озеро",
    slug: "chokrakskoe-ozero",
    category: "Природа и озёра",
    locationName: "Курортное",
    locationAliases: ["Керченский полуостров", "Азовское море", "Багерово", "Ленинский район"],
    districtName: "Ленинский район",
    address: "район села Курортное, север Керченского полуострова",
    latitude: 45.456222,
    longitude: 36.295861,
    tags: ["озеро", "лечебные грязи", "Азовское море", "Курортное", "Керчь"],
    nearby: ["Курортное", "Генеральские пляжи", "Керчь", "мыс Зюк"],
  },
  {
    id: "attraction_ozero_liman_saki",
    sourceDir: "113 Озеро Лиман (Саки)",
    title: "Озеро Лиман",
    slug: "ozero-liman-saki",
    category: "Природа и озёра",
    locationName: "Саки",
    locationAliases: ["Сакское озеро", "Прибрежное", "Евпатория", "Западный Крым"],
    districtName: "Сакский район",
    address: "район города Саки и посёлка Прибрежное",
    latitude: 45.11939,
    longitude: 33.556262,
    tags: ["озеро", "лиман", "лечебные грязи", "Саки", "Западный Крым"],
    nearby: ["Саки", "Сакское озеро", "Евпатория", "Прибрежное"],
  },
  {
    id: "attraction_bolshoy_kanon_kryma",
    sourceDir: "114 Большой каньон Крыма",
    title: "Большой каньон Крыма",
    slug: "bolshoy-kanon-kryma",
    category: "Горы и смотровые",
    locationName: "Соколиное",
    locationAliases: ["Бахчисарайский район", "Аузун-Узень", "Ай-Петри", "Большой каньон"],
    districtName: "Бахчисарайский район",
    address: "район села Соколиное, северные склоны Ай-Петринской яйлы",
    latitude: 44.527778,
    longitude: 34.016667,
    tags: ["каньон", "горы", "маршрут", "водопады", "Соколиное"],
    nearby: ["Ванна Молодости", "Голубое озеро", "источник Пания", "Соколиное"],
  },
  {
    id: "attraction_skala_zolotye_vorota_karadag",
    sourceDir: "115 Скала Золотые Ворота (Кара-Даг)",
    title: "Скала Золотые Ворота",
    slug: "skala-zolotye-vorota-karadag",
    category: "Природа и пляжи",
    locationName: "Кара-Даг",
    locationAliases: ["Коктебель", "Курортное", "Карадагский заповедник", "Золотые ворота"],
    districtName: "Феодосийский регион",
    address: "акватория Кара-Дага, между Коктебелем и Курортным",
    latitude: 44.914635,
    longitude: 35.231485,
    tags: ["скала", "арка", "Кара-Даг", "море", "Коктебель"],
    nearby: ["Кара-Даг", "Коктебель", "Курортное", "Тихая бухта"],
  },
  {
    id: "attraction_skaly_adalary_gurzuf",
    sourceDir: "116 Скалы Адалары (Гурзуф)",
    title: "Скалы Адалары",
    slug: "skaly-adalary-gurzuf",
    category: "Природа и пляжи",
    locationName: "Гурзуф",
    locationAliases: ["Аю-Даг", "Гурзуфская бухта", "Артек", "Ялта"],
    districtName: "Ялтинский регион",
    address: "акватория Гурзуфской бухты",
    latitude: 44.543867,
    longitude: 34.293888,
    tags: ["скалы", "островки", "Гурзуф", "море", "дайвинг"],
    nearby: ["Гурзуф", "Аю-Даг", "Артек", "дача Чехова"],
  },
  {
    id: "attraction_skala_diva_simeiz",
    sourceDir: "117 Скала Дива (Симеиз)",
    title: "Скала Дива",
    slug: "skala-diva-simeiz",
    category: "Горы и смотровые",
    locationName: "Симеиз",
    locationAliases: ["гора Кошка", "Панеа", "Кацивели", "Большая Ялта"],
    districtName: "Ялтинский регион",
    address: "посёлок Симеиз, у центрального пляжа",
    latitude: 44.400785,
    longitude: 34.001045,
    tags: ["скала", "Симеиз", "море", "смотровая", "гора Кошка"],
    nearby: ["гора Кошка", "скала Панеа", "Крыло Лебедя", "Симеизский парк"],
  },
  {
    id: "attraction_skala_monah_simeiz",
    sourceDir: "118 Скала Монах (Симеиз)",
    title: "Скала Монах",
    slug: "skala-monah-simeiz",
    category: "Горы и смотровые",
    locationName: "Симеиз",
    locationAliases: ["скала Дива", "Панеа", "гора Кошка", "Большая Ялта"],
    districtName: "Ялтинский регион",
    address: "Симеиз, каменный хаос между скалами Дива и Панеа",
    latitude: 44.40069,
    longitude: 34.00072,
    tags: ["скала", "историческое место", "Симеиз", "море", "Дива"],
    nearby: ["скала Дива", "скала Панеа", "гора Кошка", "Симеизский парк"],
  },
  {
    id: "attraction_skala_parus_gaspra",
    sourceDir: "119 Скала Парус (Симеиз)",
    title: "Скала Парус",
    slug: "skala-parus-gaspra",
    category: "Природа и пляжи",
    locationName: "Гаспра",
    locationAliases: ["мыс Ай-Тодор", "Ласточкино гнездо", "Ялта", "Лимен-Бурун"],
    districtName: "Ялтинский регион",
    address: "Гаспра, район мыса Ай-Тодор и санатория «Парус»",
    latitude: 44.433452,
    longitude: 34.130806,
    tags: ["скала", "Парус", "Гаспра", "море", "Ай-Тодор"],
    nearby: ["Ласточкино гнездо", "мыс Ай-Тодор", "Харакский парк", "Солнечная тропа"],
  },
  {
    id: "attraction_hram_solntsa_ilyas_kaya",
    sourceDir: "120 Храм Солнца (скальное образование)",
    title: "Храм Солнца",
    slug: "hram-solntsa-ilyas-kaya",
    category: "Горы и смотровые",
    locationName: "Ласпи",
    locationAliases: ["Ильяс-Кая", "Тышлар", "Байдарская яйла", "Форос"],
    districtName: "Севастопольский регион",
    address: "скальный комплекс Тышлар у горы Ильяс-Кая, район Ласпи",
    latitude: 44.4239,
    longitude: 33.7412,
    tags: ["скалы", "Ильяс-Кая", "Тышлар", "маршрут", "Ласпи"],
    nearby: ["гора Ильяс-Кая", "бухта Ласпи", "Байдарские ворота", "Форос"],
  },
  {
    id: "attraction_dolina_privideniy_demerdzhi",
    sourceTitle: "Долина Привидений — гора Демерджи",
    sourceDir: "121 Долина Привидений (гора Демерджи)",
    title: "Долина Привидений",
    slug: "dolina-privideniy-demerdzhi",
    category: "Горы и смотровые",
    locationName: "Лучистое",
    locationAliases: ["Демерджи", "Алушта", "Южная Демерджи", "крепость Фуна"],
    districtName: "Алуштинский регион",
    address: "склоны Южной Демерджи, район села Лучистое",
    latitude: 44.7306,
    longitude: 34.4111,
    tags: ["Демерджи", "скалы", "маршрут", "смотровые", "Алушта"],
    nearby: ["крепость Фуна", "Лучистое", "Алушта", "Демерджи-яйла"],
  },
  {
    id: "attraction_sfinksy_karalezskoy_doliny",
    sourceTitle: "Сфинксы Каралезской долины",
    sourceDir: "122 Сфинксы Каралезской долины",
    title: "Сфинксы Каралезской долины",
    slug: "sfinksy-karalezskoy-doliny",
    category: "Горы и смотровые",
    locationName: "Залесное",
    locationAliases: ["Бахчисарайский район", "Мангуп-Кале", "Ходжа-Сала", "Каралезская долина"],
    districtName: "Бахчисарайский район",
    address: "село Залесное, Каралезская долина",
    latitude: 44.628427,
    longitude: 33.792013,
    tags: ["скалы", "сфинксы", "Бахчисарай", "Залесное", "природа"],
    nearby: ["Мангуп-Кале", "Мангупское озеро", "Эски-Кермен", "Ходжа-Сала"],
  },
  {
    id: "attraction_ushchele_gyaur_bah_karadag",
    sourceTitle: "Ущелье Гяур-Бах — Карадаг",
    sourceDir: "124 Ущелье Гяур-Бах",
    title: "Ущелье Гяур-Бах",
    slug: "ushchele-gyaur-bah-karadag",
    category: "Горы и смотровые",
    locationName: "Курортное",
    locationAliases: ["Кара-Даг", "Коктебель", "Карадагский заповедник", "Биостанция"],
    districtName: "Феодосийский регион",
    address: "район Карадагской биостанции, пгт Курортное",
    latitude: 44.9102,
    longitude: 35.2058,
    tags: ["ущелье", "Кара-Даг", "заповедник", "маршрут", "Курортное"],
    nearby: ["Карадагский заповедник", "Курортное", "Коктебель", "Золотые Ворота"],
  },
  {
    id: "attraction_bulganakskie_gryazevye_vulkany",
    sourceTitle: "Долина грязевых вулканов Булганак",
    sourceDir: "125 Долина грязевых вулканов Булганак",
    title: "Булганакские грязевые вулканы",
    slug: "bulganakskie-gryazevye-vulkany",
    category: "Природа и озёра",
    locationName: "Бондаренково",
    locationAliases: ["Булганак", "Керчь", "Ленинский район", "Осовинская степь"],
    districtName: "Ленинский район",
    address: "долина Булганак, район Бондаренково и Керчи",
    latitude: 45.425,
    longitude: 36.4736,
    tags: ["грязевые вулканы", "Булганак", "Керчь", "степь", "природа"],
    nearby: ["Керчь", "Аджимушкайские каменоломни", "гора Митридат", "Керченский полуостров"],
  },
  {
    id: "attraction_skala_krylo_lebedya_simeiz",
    sourceTitle: "Скала Крыло Лебедя — Симеиз",
    sourceDir: "126 Скала Крыло Лебедя (Новый Свет)",
    title: "Скала Крыло Лебедя",
    slug: "skala-krylo-lebedya-simeiz",
    category: "Горы и смотровые",
    locationName: "Симеиз",
    locationAliases: ["Кауша-Кая", "гора Кошка", "Кацивели", "Большая Ялта"],
    districtName: "Ялтинский регион",
    address: "юго-западные окрестности Симеиза, между Симеизом и Голубым Заливом",
    latitude: 44.400462,
    longitude: 33.994272,
    tags: ["скала", "Крыло Лебедя", "Симеиз", "альпинизм", "море"],
    nearby: ["гора Кошка", "скала Дива", "Кацивели", "Симеизский парк"],
  },
  {
    id: "attraction_nikitskiy_botanicheskiy_sad",
    sourceTitle: "Никитский ботанический сад",
    sourceDir: "127 Никитский ботанический сад",
    title: "Никитский ботанический сад",
    slug: "nikitskiy-botanicheskiy-sad",
    category: "Парки и сады",
    locationName: "Никита",
    locationAliases: ["Ялта", "Монтедор", "Мыс Мартьян", "Южный берег Крыма"],
    districtName: "Ялтинский регион",
    address: "посёлок Никита, Никитский спуск, 52",
    latitude: 44.5092,
    longitude: 34.2396,
    tags: ["ботанический сад", "парк", "Никита", "Ялта", "растения"],
    nearby: ["Парк Монтедор", "мыс Мартьян", "Массандра", "Ялта"],
    websiteUrl: "https://nikitasad.ru/",
  },
  {
    id: "attraction_vorontsovskiy_park",
    sourceTitle: "Воронцовский парк — Алупка",
    sourceDir: "128 Воронцовский парк",
    title: "Воронцовский парк",
    slug: "vorontsovskiy-park-alupka",
    category: "Парки и сады",
    locationName: "Алупка",
    locationAliases: ["Воронцовский дворец", "Ай-Петри", "Ялта", "Южный берег Крыма"],
    districtName: "Ялтинский регион",
    address: "Алупка, территория Воронцовского дворцово-паркового музея",
    latitude: 44.422177,
    longitude: 34.058462,
    tags: ["парк", "Алупка", "Воронцовский дворец", "озёра", "Ай-Петри"],
    nearby: ["Воронцовский дворец", "Кипарисовая аллея", "гора Ай-Петри", "Мисхор"],
  },
  {
    id: "attraction_forosskiy_park",
    sourceTitle: "Форосский парк",
    sourceDir: "129 Форосский парк",
    title: "Форосский парк",
    slug: "forosskiy-park",
    category: "Парки и сады",
    locationName: "Форос",
    locationAliases: ["Форосская церковь", "мыс Сарыч", "Байдарские ворота", "Южный берег Крыма"],
    districtName: "Ялтинский регион",
    address: "посёлок Форос, территория Форосского парка",
    latitude: 44.3897,
    longitude: 33.7819,
    tags: ["парк", "Форос", "море", "аллеи", "ЮБК"],
    nearby: ["Форосская церковь", "мыс Сарыч", "Байдарские ворота", "Ласпи"],
  },
  {
    id: "attraction_park_montedor_nikita",
    sourceTitle: "Парк Монтедор — Никита, Ялта",
    sourceDir: "131 Парк Монтедор (Никита)",
    title: "Парк Монтедор",
    slug: "park-montedor-nikita",
    category: "Парки и сады",
    locationName: "Никита",
    locationAliases: ["Никитский ботанический сад", "Ялта", "Мыс Мартьян", "Массандра"],
    districtName: "Ялтинский регион",
    address: "посёлок Никита, территория Никитского ботанического сада",
    latitude: 44.51092,
    longitude: 34.232649,
    tags: ["парк", "Монтедор", "Никитский сад", "кактусовая оранжерея", "Никита"],
    nearby: ["Никитский ботанический сад", "мыс Мартьян", "Ялта", "Массандра"],
  },
  {
    id: "attraction_massandrovskiy_park",
    sourceDir: "132 Массандровский парк",
    title: "Массандровский парк",
    slug: "massandrovskiy-park",
    category: "Парки и сады",
    locationName: "Массандра",
    locationAliases: ["Ялта", "Массандровский дворец", "Южный берег Крыма", "Никита"],
    districtName: "Ялтинский регион",
    address: "Массандра, территория Массандровского дворца и парка",
    latitude: 44.5163,
    longitude: 34.2014,
    tags: ["парк", "Массандра", "дворец", "Ялта", "аллеи"],
    nearby: ["Массандровский дворец", "центр виноделия Массандра", "Ялта", "Никитский сад"],
  },
  {
    id: "attraction_harakskiy_park_gaspra",
    sourceDir: "133 Харакский парк (Гаспра)",
    title: "Харакский парк",
    slug: "harakskiy-park-gaspra",
    category: "Парки и сады",
    locationName: "Гаспра",
    locationAliases: ["Дворец Харакс", "мыс Ай-Тодор", "Ялта", "Солнечная тропа"],
    districtName: "Ялтинский регион",
    address: "Гаспра, территория дворца Харакс",
    latitude: 44.4307,
    longitude: 34.1167,
    tags: ["парк", "Харакс", "Гаспра", "дворец", "ЮБК"],
    nearby: ["Дворец Харакс", "Солнечная тропа", "Ласточкино гнездо", "Мисхор"],
  },
  {
    id: "attraction_miskhorskiy_park",
    sourceDir: "134 Мисхорский парк",
    title: "Мисхорский парк",
    slug: "miskhorskiy-park",
    category: "Парки и сады",
    locationName: "Мисхор",
    locationAliases: ["Кореиз", "Гаспра", "Ялта", "канатная дорога Ай-Петри"],
    districtName: "Ялтинский регион",
    address: "Мисхор, между Алупкинским шоссе и побережьем",
    latitude: 44.4297,
    longitude: 34.0919,
    tags: ["парк", "Мисхор", "море", "Русалка", "ЮБК"],
    nearby: ["Кореиз", "канатная дорога Ай-Петри", "Юсуповский дворец", "Воронцовский парк"],
  },
  {
    id: "attraction_simferopolskiy_botanicheskiy_sad",
    sourceDir: "135 Симферопольский ботанический сад",
    title: "Симферопольский ботанический сад",
    slug: "simferopolskiy-botanicheskiy-sad",
    category: "Парки и сады",
    locationName: "Симферополь",
    locationAliases: ["Салгирка", "Ботанический сад им. Багрова", "КФУ", "Воронцовка"],
    districtName: "Симферополь",
    address: "проспект Академика Вернадского, 2, Симферополь",
    latitude: 44.942524,
    longitude: 34.131095,
    tags: ["ботанический сад", "Салгирка", "Симферополь", "парк", "КФУ"],
    nearby: ["парк Салгирка", "Неаполь Скифский", "центр Симферополя", "Детский парк"],
  },
  {
    id: "attraction_primorskiy_park_yalta",
    sourceDir: "136 Приморский парк (Ялта)",
    title: "Приморский парк",
    slug: "primorskiy-park-yalta",
    category: "Парки и сады",
    locationName: "Ялта",
    locationAliases: ["набережная Ялты", "Южный берег Крыма", "Приморский пляж", "центр Ялты"],
    districtName: "Ялтинский регион",
    address: "Ялта, западная часть набережной",
    latitude: 44.4893,
    longitude: 34.1589,
    tags: ["парк", "Ялта", "набережная", "море", "прогулка"],
    nearby: ["набережная Ялты", "канатная дорога Ялта-Горка", "театр Чехова", "Массандра"],
  },
  {
    id: "attraction_park_molodezhnyy_evpatoriya",
    sourceDir: "137 Парк «Молодёжный» (Евпатория)",
    title: "Парк «Молодёжный»",
    slug: "park-molodezhnyy-evpatoriya",
    category: "Парки и сады",
    locationName: "Евпатория",
    locationAliases: ["Мойнаки", "Западный Крым", "Евпаторийский регион", "городской парк"],
    districtName: "Евпаторийский регион",
    address: "Евпатория, район городских жилых кварталов и озера Мойнаки",
    latitude: 45.1984,
    longitude: 33.3549,
    tags: ["парк", "Евпатория", "детям", "прогулка", "городской отдых"],
    nearby: ["озеро Мойнаки", "Малый Иерусалим", "набережная Евпатории", "Джума-Джами"],
  },
  {
    id: "attraction_mozhzhevelovaya_roshcha_novyy_svet",
    sourceDir: "139 Можжевеловая роща (Новый Свет, заказник)",
    title: "Можжевеловая роща",
    slug: "mozhzhevelovaya-roshcha-novyy-svet",
    category: "Парки и сады",
    locationName: "Новый Свет",
    locationAliases: ["заказник Новый Свет", "тропа Голицына", "Судак", "мыс Капчик"],
    districtName: "Судакский регион",
    address: "посёлок Новый Свет, природный заказник",
    latitude: 44.8206,
    longitude: 34.909,
    tags: ["можжевельник", "роща", "Новый Свет", "заказник", "экотропа"],
    nearby: ["Голицынская тропа", "бухты Нового Света", "мыс Капчик", "гора Сокол"],
  },
  {
    id: "attraction_olivkovaya_roshcha_partenit",
    sourceDir: "140 Оливковая роща (Партенит)",
    title: "Оливковая роща",
    slug: "olivkovaya-roshcha-partenit",
    category: "Парки и сады",
    locationName: "Партенит",
    locationAliases: ["Парк Айвазовское", "Аю-Даг", "Гурзуф", "Алушта"],
    districtName: "Алуштинский регион",
    address: "Партенит, район парка Айвазовское",
    latitude: 44.5828,
    longitude: 34.3442,
    tags: ["оливы", "роща", "Партенит", "парк", "ЮБК"],
    nearby: ["Парк Айвазовское", "Аю-Даг", "Партенит", "Гурзуф"],
  },
  {
    id: "attraction_bukovyy_les_haphal",
    sourceDir: "141 Буковый лес (урочище Хапхал)",
    title: "Буковый лес Хапхала",
    slug: "bukovyy-les-haphal",
    category: "Природа и заповедники",
    locationName: "Хапхал",
    locationAliases: ["Демерджи-яйла", "Джур-Джур", "Генеральское", "Алуштинский регион"],
    districtName: "Алуштинский регион",
    address: "урочище Хапхал, район водопада Джур-Джур",
    latitude: 44.807,
    longitude: 34.458,
    tags: ["лес", "бук", "Хапхал", "Джур-Джур", "маршрут"],
    nearby: ["водопад Джур-Джур", "урочище Хапхал", "Генеральское", "Демерджи-яйла"],
  },
  {
    id: "attraction_lavandovye_polya_bakhchisaray",
    sourceDir: "143 Лавандовые поля (Бахчисарайский р-н)",
    title: "Лавандовые поля",
    slug: "lavandovye-polya-bakhchisaray",
    category: "Парки и сады",
    locationName: "Тургеневка",
    locationAliases: ["Бахчисарай", "Бахчисарайский район", "лавандовое поле", "Крым"],
    districtName: "Бахчисарайский район",
    address: "район села Тургеневка, Бахчисарайский район",
    latitude: 44.703068,
    longitude: 33.852679,
    tags: ["лаванда", "поля", "Тургеневка", "фотосессия", "Бахчисарай"],
    nearby: ["Бахчисарай", "Ханский дворец", "Чуфут-Кале", "Сфинксы Каралезской долины"],
  },
  {
    id: "attraction_kiparisovaya_alleya_alupka",
    sourceDir: "145 Кипарисовая аллея (Алупка)",
    title: "Кипарисовая аллея",
    slug: "kiparisovaya-alleya-alupka",
    category: "Парки и сады",
    locationName: "Алупка",
    locationAliases: ["Воронцовский парк", "Воронцовский дворец", "Ай-Петри", "Южный берег"],
    districtName: "Ялтинский регион",
    address: "Алупка, территория Воронцовского парка",
    latitude: 44.4204,
    longitude: 34.0582,
    tags: ["аллея", "кипарисы", "Алупка", "Воронцовский парк", "ЮБК"],
    nearby: ["Воронцовский парк", "Воронцовский дворец", "гора Ай-Петри", "Мисхор"],
  },
  {
    id: "attraction_staryy_dub_ak_kaya",
    sourceDir: "148 Старый дуб (Ак-Кая, вековое дерево)",
    title: "Старый дуб у Ак-Кая",
    slug: "staryy-dub-ak-kaya",
    category: "Природа и заповедники",
    locationName: "Ак-Кая",
    locationAliases: ["Белая скала", "Белогорск", "Вишенное", "Белогорский район"],
    districtName: "Белогорский район",
    address: "район Белой скалы Ак-Кая, Белогорский район",
    latitude: 45.1048,
    longitude: 34.626,
    tags: ["дуб", "Ак-Кая", "Белая скала", "вековое дерево", "Белогорск"],
    nearby: ["Белая скала", "Белогорск", "Биюк-Карасу", "степные маршруты"],
  },
  {
    id: "attraction_krymskiy_prirodnyy_zapovednik",
    sourceDir: "149 Крымский природный заповедник",
    title: "Крымский природный заповедник",
    slug: "krymskiy-prirodnyy-zapovednik",
    category: "Природа и заповедники",
    locationName: "Крымский заповедник",
    locationAliases: ["Романовское шоссе", "Бабуган-яйла", "Алушта", "Чатыр-Даг"],
    districtName: "Алуштинский регион",
    address: "горно-лесная часть Главной гряды Крыма",
    latitude: 44.666667,
    longitude: 34.35,
    tags: ["заповедник", "горы", "лес", "Бабуган", "природа"],
    nearby: ["Бабуган-яйла", "Роман-Кош", "Косьмо-Дамиановский монастырь", "Алушта"],
  },
  {
    id: "attraction_yaltinskiy_gorno_lesnoy_zapovednik",
    sourceDir: "150 Ялтинский горно-лесной заповедник",
    title: "Ялтинский горно-лесной заповедник",
    slug: "yaltinskiy-gorno-lesnoy-zapovednik",
    category: "Природа и заповедники",
    locationName: "Ялта",
    locationAliases: ["Ай-Петри", "Учан-Су", "Ставри-Кая", "Большая Ялта"],
    districtName: "Ялтинский регион",
    address: "горно-лесная зона над Ялтой, от Фороса до Гурзуфа",
    latitude: 44.475,
    longitude: 34.09,
    tags: ["заповедник", "Ялта", "Ай-Петри", "лес", "горы"],
    nearby: ["Ай-Петри", "Учан-Су", "Штангеевская тропа", "Боткинская тропа"],
  },
  {
    id: "attraction_karadagskiy_prirodnyy_zapovednik",
    sourceDir: "151 Карадагский природный заповедник",
    title: "Карадагский природный заповедник",
    slug: "karadagskiy-prirodnyy-zapovednik",
    category: "Природа и заповедники",
    locationName: "Курортное",
    locationAliases: ["Кара-Даг", "Коктебель", "Золотые Ворота", "Биостанция"],
    districtName: "Феодосийский регион",
    address: "между Коктебелем и Курортным, Карадагская биостанция",
    latitude: 44.9137,
    longitude: 35.2036,
    tags: ["заповедник", "Кара-Даг", "вулкан", "Коктебель", "море"],
    nearby: ["Золотые Ворота", "Коктебель", "Курортное", "Тихая бухта"],
    websiteUrl: "https://karadag.com.ru/",
  },
  {
    id: "attraction_kazantipskiy_prirodnyy_zapovednik",
    sourceDir: "152 Казантипский природный заповедник",
    title: "Казантипский природный заповедник",
    slug: "kazantipskiy-prirodnyy-zapovednik",
    category: "Природа и заповедники",
    locationName: "Мысовое",
    locationAliases: ["мыс Казантип", "Щёлкино", "Азовское море", "Ленинский район"],
    districtName: "Ленинский район",
    address: "мыс Казантип, район Мысового и Щёлкино",
    latitude: 45.45745,
    longitude: 35.83978,
    tags: ["заповедник", "Казантип", "мыс", "Азовское море", "степь"],
    nearby: ["мыс Казантип", "Акташское озеро", "Щёлкино", "Мысовое"],
  },
  {
    id: "attraction_hersones_tavricheskiy",
    sourceDir: "156 Херсонес Таврический",
    title: "Херсонес Таврический",
    slug: "hersones-tavricheskiy",
    category: "История и археология",
    locationName: "Севастополь",
    locationAliases: ["Гераклейский полуостров", "Владимирский собор", "Новый Херсонес", "античный город"],
    districtName: "Севастопольский регион",
    address: "Древняя улица, 1, Севастополь",
    latitude: 44.613611,
    longitude: 33.492778,
    tags: ["Херсонес", "археология", "античность", "Севастополь", "музей"],
    nearby: ["Новый Херсонес", "Владимирский собор", "Севастополь", "Песочная бухта"],
    websiteUrl: "https://chersonesos-sev.ru/",
  },
  {
    id: "attraction_novyy_hersones",
    sourceDir: "157 Новый Херсонес (музейно-храмовый комплекс)",
    title: "Новый Херсонес",
    slug: "novyy-hersones",
    category: "История и археология",
    locationName: "Севастополь",
    locationAliases: ["Херсонес Таврический", "музейно-храмовый комплекс", "Гераклейский полуостров", "Владимирский собор"],
    districtName: "Севастопольский регион",
    address: "район Херсонеса Таврического, Севастополь",
    latitude: 44.6075,
    longitude: 33.490556,
    tags: ["Новый Херсонес", "музей", "Севастополь", "парк", "история"],
    nearby: ["Херсонес Таврический", "Песочная бухта", "центр Севастополя", "Владимирский собор"],
    websiteUrl: "https://xn--e1aaxdjgdz.xn--p1ai/",
  },
  {
    id: "attraction_panorama_oborony_sevastopolya",
    sourceDir: "158 Панорама обороны Севастополя",
    title: "Панорама обороны Севастополя",
    slug: "panorama-oborony-sevastopolya",
    category: "История и мемориалы",
    locationName: "Севастополь",
    locationAliases: ["Исторический бульвар", "Крымская война", "Панорама", "центр Севастополя"],
    districtName: "Севастопольский регион",
    address: "Исторический бульвар, Севастополь",
    latitude: 44.5956,
    longitude: 33.5238,
    tags: ["панорама", "музей", "Севастополь", "Крымская война", "мемориал"],
    nearby: ["Исторический бульвар", "Приморский бульвар", "Владимирский собор", "Малахов курган"],
  },
  {
    id: "attraction_mihaylovskaya_batareya",
    sourceDir: "160 Михайловская батарея",
    title: "Михайловская батарея",
    slug: "mihaylovskaya-batareya",
    category: "История и мемориалы",
    locationName: "Севастополь",
    locationAliases: ["Северная сторона", "Севастопольская бухта", "военно-морской музей", "фортификация"],
    districtName: "Севастопольский регион",
    address: "ул. Громова, 35/1, Северная сторона, Севастополь",
    latitude: 44.627778,
    longitude: 33.525833,
    tags: ["батарея", "музей", "фортификация", "Севастополь", "история"],
    nearby: ["Северная сторона", "Константиновская батарея", "Графская пристань", "центр Севастополя"],
  },
  {
    id: "attraction_galereya_ayvazovskogo",
    sourceDir: "161 Галерея Айвазовского",
    title: "Галерея Айвазовского",
    slug: "galereya-ayvazovskogo-feodosiya",
    category: "Музеи",
    locationName: "Феодосия",
    locationAliases: ["картинная галерея", "Айвазовский", "Феодосийская галерея", "набережная Феодосии"],
    districtName: "Феодосийский регион",
    address: "ул. Галерейная, 2, Феодосия",
    latitude: 45.0311,
    longitude: 35.3828,
    tags: ["музей", "Айвазовский", "живопись", "Феодосия", "галерея"],
    nearby: ["набережная Феодосии", "дача Стамболи", "музей Грина", "Карантинные ворота"],
    websiteUrl: "https://feogallery.org/",
  },
  {
    id: "attraction_muzey_chehova_yalta",
    sourceTitle: "Музей А. П. Чехова в Ялте",
    sourceDir: "163 Музей А.П. Чехова (Ялта)",
    title: "Музей А. П. Чехова",
    slug: "muzey-chehova-yalta",
    category: "Музеи",
    locationName: "Ялта",
    locationAliases: ["Белая дача", "дом-музей Чехова", "Южный берег Крыма", "Аутка"],
    districtName: "Ялтинский регион",
    address: "ул. Кирова, 112, Ялта",
    latitude: 44.5006,
    longitude: 34.144,
    tags: ["музей", "Чехов", "Ялта", "литература", "Белая дача"],
    nearby: ["набережная Ялты", "Приморский парк", "Массандра", "Ливадийский дворец"],
  },
  {
    id: "attraction_kerchenskiy_istoriko_arheologicheskiy_muzey",
    sourceTitle: "Историко-археологический музей в Керчи",
    sourceDir: "164 Историко-археологический музей (Керчь)",
    title: "Историко-археологический музей",
    slug: "kerchenskiy-istoriko-arheologicheskiy-muzey",
    category: "Музеи",
    locationName: "Керчь",
    locationAliases: ["гора Митридат", "Пантикапей", "Керченский музей", "центр Керчи"],
    districtName: "Керченский регион",
    address: "ул. Свердлова, 22, Керчь",
    latitude: 45.3517,
    longitude: 36.4756,
    tags: ["музей", "археология", "Керчь", "Боспор", "история"],
    nearby: ["гора Митридат", "Пантикапей", "Большая Митридатская лестница", "храм Иоанна Предтечи"],
  },
  {
    id: "attraction_feodosiyskiy_muzey_deneg",
    sourceTitle: "Феодосийский музей денег",
    sourceDir: "165 Феодосийский музей денег",
    title: "Феодосийский музей денег",
    slug: "feodosiyskiy-muzey-deneg",
    category: "Музеи",
    locationName: "Феодосия",
    locationAliases: ["музей нумизматики", "центр Феодосии", "галерея Айвазовского", "Кафа"],
    districtName: "Феодосийский регион",
    address: "Феодосия, исторический центр",
    latitude: 45.0299,
    longitude: 35.3799,
    tags: ["музей", "деньги", "нумизматика", "Феодосия", "история"],
    nearby: ["галерея Айвазовского", "набережная Феодосии", "музей Грина", "дача Стамболи"],
  },
  {
    id: "attraction_centralnyy_muzey_tavridy",
    sourceTitle: "Центральный музей Тавриды",
    sourceDir: "166 Центральный музей Тавриды",
    title: "Центральный музей Тавриды",
    slug: "centralnyy-muzey-tavridy",
    category: "Музеи",
    locationName: "Симферополь",
    locationAliases: ["Таврида", "краеведческий музей", "центр Симферополя", "Крым"],
    districtName: "Симферополь",
    address: "ул. Гоголя, 14, Симферополь",
    latitude: 44.9507,
    longitude: 34.1025,
    tags: ["музей", "Таврида", "Симферополь", "краеведение", "история"],
    nearby: ["центр Симферополя", "Детский парк", "Салгирка", "Неаполь Скифский"],
    websiteUrl: "https://tavrida-museum.ru/",
  },
  {
    id: "attraction_adzhimushkayskie_kamenolomni_muzey",
    sourceTitle: "Аджимушкайские каменоломни — музей",
    sourceDir: "167 Аджимушкайские каменоломни — музей",
    title: "Аджимушкайские каменоломни",
    slug: "adzhimushkayskie-kamenolomni-muzey",
    category: "История и мемориалы",
    locationName: "Аджимушкай",
    locationAliases: ["Керчь", "Керченский регион", "музей обороны", "каменоломни"],
    districtName: "Керченский регион",
    address: "посёлок Аджимушкай, район Керчи",
    latitude: 45.3823,
    longitude: 36.5207,
    tags: ["музей", "каменоломни", "Керчь", "мемориал", "война"],
    nearby: ["Керчь", "Царский курган", "гора Митридат", "Булганакские вулканы"],
  },
  {
    id: "attraction_morskoy_muzey_balaklava",
    sourceTitle: "Морской музей в Балаклаве",
    sourceDir: "168 Морской музей (Балаклава)",
    title: "Морской музей",
    slug: "morskoy-muzey-balaklava",
    category: "Музеи",
    locationName: "Балаклава",
    locationAliases: ["Объект 825 ГТС", "подземный музей", "Севастополь", "Балаклавская бухта"],
    districtName: "Севастопольский регион",
    address: "Таврическая набережная, 22, Балаклава",
    latitude: 44.5011,
    longitude: 33.5966,
    tags: ["музей", "Балаклава", "подземная база", "подводные лодки", "Севастополь"],
    nearby: ["Балаклавская бухта", "крепость Чембало", "мыс Фиолент", "Севастополь"],
  },
  {
    id: "attraction_solnechnaya_tsarskaya_tropa",
    sourceTitle: "Солнечная, или Царская, тропа",
    sourceDir: "169 Солнечная (Царская) тропа",
    title: "Солнечная тропа",
    slug: "solnechnaya-tsarskaya-tropa",
    category: "Маршруты и тропы",
    locationName: "Ливадия",
    locationAliases: ["Царская тропа", "Ореанда", "Гаспра", "Ялта"],
    districtName: "Ялтинский регион",
    address: "маршрут от Ливадийского дворца в сторону Ореанды и Гаспры",
    latitude: 44.450975,
    longitude: 34.1268,
    tags: ["тропа", "Ливадия", "Царская тропа", "Ялта", "прогулка"],
    nearby: ["Ливадийский дворец", "Ореанда", "Гаспра", "Ласточкино гнездо"],
  },
  {
    id: "attraction_golicynskaya_tropa",
    sourceTitle: "Голицынская тропа",
    sourceDir: "170 Голицынская тропа",
    title: "Голицынская тропа",
    slug: "golicynskaya-tropa-novyy-svet",
    category: "Маршруты и тропы",
    locationName: "Новый Свет",
    locationAliases: ["Судак", "тропа Голицына", "грот Шаляпина", "мыс Капчик"],
    districtName: "Судакский регион",
    address: "посёлок Новый Свет, начало у набережной",
    latitude: 44.8219,
    longitude: 34.9142,
    tags: ["тропа", "Новый Свет", "Голицын", "бухты", "маршрут"],
    nearby: ["бухты Нового Света", "грот Шаляпина", "мыс Капчик", "Судакская крепость"],
  },
  {
    id: "attraction_botkinskaya_tropa",
    sourceTitle: "Боткинская тропа",
    sourceDir: "171 Боткинская тропа",
    title: "Боткинская тропа",
    slug: "botkinskaya-tropa-yalta",
    category: "Маршруты и тропы",
    locationName: "Ялта",
    locationAliases: ["Ставри-Кая", "Учан-Су", "Штангеевская тропа", "Ялтинский заповедник"],
    districtName: "Ялтинский регион",
    address: "горно-лесная зона над Ялтой, маршрут к Ставри-Кая",
    latitude: 44.49632,
    longitude: 34.118948,
    tags: ["тропа", "Ялта", "Ставри-Кая", "лес", "маршрут"],
    nearby: ["Штангеевская тропа", "Учан-Су", "Ставри-Кая", "Поляна сказок"],
  },
];

const coordinateFixes = {
  attraction_smotrovaya_simferopol_holm: {
    latitude: 44.9526,
    longitude: 34.108,
    address: "район Макуриной горки и Студенческой улицы, Симферополь",
  },
};

function splitSeoPages(markdown) {
  const headingRegex = /^#{1,3}\s+(\d+)\.\s+(.+)$/gm;
  const pages = [];
  let match;
  let current = null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const number = Number(match[1]);
    if (number < 100) {
      continue;
    }
    if (current) {
      current.markdown = markdown.slice(current.start, match.index);
      pages.push(current);
    }
    current = {
      number,
      title: match[2].trim(),
      start: headingRegex.lastIndex,
      markdown: "",
    };
  }

  if (current) {
    current.markdown = markdown.slice(current.start);
    pages.push(current);
  }

  return pages;
}

function field(markdown, label) {
  const match = markdown.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
  return cleanup(match?.[1] ?? "");
}

function section(markdown, number, nextNumber) {
  const regex = new RegExp(
    `^#{2,3}\\s+${number}\\.[^\\n]*\\r?\\n\\r?\\n([\\s\\S]*?)(?=^#{2,3}\\s+${nextNumber}\\.)`,
    "m",
  );
  return markdown.match(regex)?.[1]?.trim() ?? "";
}

function cleanup(value) {
  return value
    .replace(/\r/g, "")
    .replace(/\s*\(\[[^\]]+\]\[\d+\]\)/g, "")
    .replace(/\s*\[[^\]]+\]\[\d+\]/g, "")
    .replace(/^\[\d+\]:.+$/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function shorten(value, maxLength) {
  const text = cleanup(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }
  const slice = text.slice(0, maxLength);
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceEnd > Math.floor(maxLength * 0.55)) {
    return slice.slice(0, sentenceEnd + 1);
  }
  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : maxLength).trim()}...`;
}

function parseSection(markdown, number, nextNumber) {
  const raw = cleanup(section(markdown, number, nextNumber));
  const list = [];
  const nonListLines = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.+)/) ?? trimmed.match(/^\d+\.\s+(.+)/);
    if (bullet) {
      list.push(cleanup(bullet[1]).replace(/\.$/, ""));
      continue;
    }
    nonListLines.push(line);
  }

  const body = nonListLines
    .join("\n")
    .split(/\n{2,}/)
    .map((item) => cleanup(item).replace(/\n+/g, " "))
    .filter(Boolean);

  return { body, list };
}

function parseFacts(markdown, entry) {
  const raw = section(markdown, 13, 14);
  const facts = [];
  const preferred = new Set([
    "Где находится",
    "Координаты",
    "Режим работы",
    "Стоимость входа",
    "Парковка",
    "Общественный транспорт",
    "Время на посещение",
    "Лучший сезон",
    "Что рядом",
    "Подходит ли для детей",
    "Подходит ли для пожилых",
    "Подходит ли для пожилых людей",
  ]);

  for (const line of raw.split("\n")) {
    const match =
      line.trim().match(/^\*\s+\*\*(.+?):\*\*\s*(.+)$/) ??
      line.trim().match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (!match) {
      continue;
    }
    const label = cleanup(match[1]);
    const value = cleanup(match[2]).replace(/\.$/, ".");
    if (preferred.has(label) && value) {
      facts.push({ label, value });
    }
  }

  return withCoordinateFact(facts, entry);
}

function manualFacts(entry) {
  return withCoordinateFact(
    [
      { label: "Время на посещение", value: entry.time ?? defaultTime(entry.category) },
      { label: "Лучший сезон", value: entry.season ?? defaultSeason(entry.category) },
      { label: "Где находится", value: entry.address },
      { label: "Что рядом", value: entry.nearby.join(", ") },
    ],
    entry,
  );
}

function withCoordinateFact(facts, entry) {
  const result = facts.filter((fact) => fact.label !== "Координаты");
  result.push({
    label: "Координаты",
    value: `${entry.latitude}, ${entry.longitude}`,
  });

  const order = [
    "Время на посещение",
    "Лучший сезон",
    "Где находится",
    "Координаты",
    "Режим работы",
    "Стоимость входа",
    "Парковка",
    "Общественный транспорт",
    "Что рядом",
    "Подходит ли для детей",
    "Подходит ли для пожилых",
    "Подходит ли для пожилых людей",
  ];

  return result.sort((left, right) => {
    const leftIndex = order.indexOf(left.label);
    const rightIndex = order.indexOf(right.label);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
}

function parseFaq(markdown) {
  const raw = section(markdown, 14, 15);
  const faq = [];

  for (const line of raw.split(/\r?\n/)) {
    const inline = line.trim().match(/^\*\*([^*?]+?\?)\*\*\s*(.+)$/);
    if (inline) {
      const question = cleanup(inline[1]);
      const answer = cleanup(inline[2]);
      if (question && answer) {
        faq.push({ question, answer });
      }
    }
  }

  if (faq.length > 0) {
    return faq.slice(0, 6);
  }

  const regex = /\*\*([^*?]+?\?)\*\*\s*\r?\n([\s\S]*?)(?=\r?\n\r?\n\*\*|$)/g;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    const question = cleanup(match[1]);
    const answer = cleanup(match[2]).replace(/\n+/g, " ");
    if (question && answer) {
      faq.push({ question, answer });
    }
  }

  return faq.slice(0, 6);
}

function parseAltTexts(markdown, title) {
  const block =
    markdown.match(/\*\*Alt-тексты:\*\*([\s\S]*?)(?=\*\*Корот(?:кие|кое) описан|\n#{2,3}\s+2\.)/)?.[1] ?? "";
  const alts = [];

  for (const line of block.split(/\r?\n/)) {
    const numbered = line.trim().match(/^\d+\.\s+(.+)/);
    if (numbered) {
      alts.push(cleanup(numbered[1]));
      continue;
    }
    const sentenceList = line
      .split(";")
      .map((item) => cleanup(item))
      .filter(Boolean);
    if (sentenceList.length > 1) {
      alts.push(...sentenceList);
    }
  }

  return alts.length > 0 ? alts : [`${title} в Крыму`];
}

function buildParsedSections(markdown) {
  const sourceSections = [
    { title: "Обзор", parsed: parseSection(markdown, 2, 3) },
    { title: "История и особенности", parsed: parseSection(markdown, 4, 5) },
    { title: "Что посмотреть на месте", parsed: parseSection(markdown, 5, 6) },
    { title: "Как добраться", parsed: parseSection(markdown, 6, 7) },
    { title: "Когда лучше ехать", parsed: parseSection(markdown, 7, 8) },
    { title: "Что посмотреть рядом", parsed: parseSection(markdown, 11, 12) },
  ];

  return sourceSections
    .map(({ title, parsed }) => ({
      title,
      body: parsed.body.map((item) => shorten(item, 850)),
      ...(parsed.list.length > 0 ? { list: parsed.list.map((item) => shorten(item, 240)) } : {}),
    }))
    .filter((item) => item.body.length > 0 || item.list?.length);
}

function defaultTime(category) {
  if (category === "Музеи" || category === "История и мемориалы") {
    return "1-2 часа";
  }
  if (category === "Маршруты и тропы" || category === "Горы и смотровые") {
    return "2-4 часа";
  }
  if (category === "Парки и сады") {
    return "1-3 часа";
  }
  return "1-2 часа";
}

function defaultSeason(category) {
  if (category === "Природа и пляжи") {
    return "май-июнь и сентябрь-октябрь, летом лучше утром или к вечеру";
  }
  if (category === "Музеи" || category === "История и мемориалы") {
    return "круглый год, график лучше проверить перед поездкой";
  }
  return "весна, начало лета и осень";
}

function manualDescription(entry) {
  const place = entry.locationName ? ` в районе ${entry.locationName}` : "";
  const nearby = entry.nearby.slice(0, 3).join(", ");

  return `${entry.title}${place} — достопримечательность Крыма, которую удобно включить в самостоятельный маршрут, экскурсию или поездку на несколько часов. Место интересно своим ландшафтом, историей и возможностью увидеть рядом ${nearby}. Перед поездкой стоит сверить доступность прохода, погоду и сезонные ограничения, особенно если маршрут проходит по природной или заповедной территории.`;
}

function manualSections(entry) {
  const nearby = entry.nearby.join(", ");
  return [
    {
      title: "Обзор",
      body: [
        manualDescription(entry),
        `${entry.title} подходит для прогулки, фотографий и знакомства с этой частью Крыма. Точка на карте указана по проверенному ориентиру объекта, а не по центру ближайшего населённого пункта.`,
      ],
    },
    {
      title: "Что посмотреть на месте",
      body: [
        `Главное впечатление здесь дают сам объект, окружающий ландшафт и видовые точки. Для природных мест важны удобная обувь, запас воды и аккуратность у обрывов, воды или каменных участков.`,
      ],
      list: entry.nearby.slice(0, 5),
    },
    {
      title: "Как добраться",
      body: [
        `Удобнее ориентироваться по адресу: ${entry.address}. На автомобиле заранее проверьте подъезд и парковку, а без машины планируйте маршрут через ближайший населённый пункт: ${entry.locationName}.`,
      ],
    },
    {
      title: "Когда лучше ехать",
      body: [
        entry.season ?? defaultSeason(entry.category),
        "Для прогулок на открытой местности лучше выбирать утро или предзакатные часы: мягче свет, меньше жары и проще фотографировать.",
      ],
    },
    {
      title: "Что посмотреть рядом",
      body: [`Маршрут легко расширить: рядом находятся ${nearby}.`],
    },
  ];
}

function manualFaq(entry) {
  return [
    {
      question: `Где находится ${entry.title}?`,
      answer: `${entry.address}.`,
    },
    {
      question: "Сколько времени заложить?",
      answer: entry.time ?? defaultTime(entry.category),
    },
    {
      question: "Когда лучше ехать?",
      answer: entry.season ?? defaultSeason(entry.category),
    },
    {
      question: "Что посмотреть рядом?",
      answer: entry.nearby.join(", "),
    },
  ];
}

async function imageFiles(sourceDir) {
  const files = await readdir(sourceDir, { withFileTypes: true });
  return files
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(webp|png|jpe?g)$/i.test(name))
    .sort((left, right) => left.localeCompare(right, "ru", { numeric: true, sensitivity: "base" }));
}

async function convertGalleryImages(entry, altTexts) {
  const sourceDir = path.join(sourceRoot, entry.sourceDir);
  const targetDir = path.join(publicAttractionsRoot, entry.slug);
  const files = await imageFiles(sourceDir);

  if (files.length === 0) {
    throw new Error(`No images found: ${entry.sourceDir}`);
  }

  await mkdir(targetDir, { recursive: true });

  const gallery = [];
  for (let index = 0; index < files.length; index += 1) {
    const fileName = `image-${String(index + 1).padStart(2, "0")}.webp`;
    const sourcePath = path.join(sourceDir, files[index]);
    const targetPath = path.join(targetDir, fileName);

    await sharp(sourcePath, { failOn: "none" })
      .rotate()
      .resize({
        width: 1800,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toFile(targetPath);

    gallery.push({
      url: `/attractions/${entry.slug}/${fileName}`,
      alt: altTexts[index] ?? `${entry.title}: фото ${index + 1}`,
    });
  }

  return gallery;
}

async function readInfoMapUrl(entry) {
  const infoPath = path.join(sourceRoot, entry.sourceDir, "info.txt");
  try {
    const infoText = await readFile(infoPath, "utf8");
    return infoText.match(/https:\/\/(?:yandex\.ru|yandex\.com)\/maps\/\S+/)?.[0] ?? null;
  } catch {
    return null;
  }
}

async function buildAttraction(entry, page, existingOverride) {
  const mainDescription = page ? section(page.markdown, 3, 4) || section(page.markdown, 2, 3) : "";
  const altTexts = page ? parseAltTexts(page.markdown, entry.title) : [`${entry.title} в Крыму`];
  const gallery = await convertGalleryImages(entry, altTexts);
  const shortSource = page ? section(page.markdown, 2, 3) : manualDescription(entry);

  return {
    title: entry.title,
    slug: entry.slug,
    h1: (page ? field(page.markdown, "H1") : "") || entry.title,
    seoTitle: (page ? field(page.markdown, "SEO Title") : "") || `${entry.title} в Крыму: как добраться и что посмотреть`,
    metaDescription:
      (page ? field(page.markdown, "Meta Description") : "") ||
      shorten(`${entry.title}: расположение, координаты, фото, маршрут, что посмотреть рядом и советы для поездки.`, 180),
    category: entry.category,
    tags: [...new Set([...entry.tags, entry.category, entry.locationName])],
    locationName: entry.locationName,
    locationAliases: entry.locationAliases,
    districtName: entry.districtName,
    address: entry.address,
    latitude: entry.latitude,
    longitude: entry.longitude,
    shortDescription: shorten(shortSource, 360),
    description: shorten(mainDescription || manualDescription(entry), 720),
    gallery,
    websiteUrl: entry.websiteUrl ?? null,
    mapUrl: await readInfoMapUrl(entry),
    facts: page ? parseFacts(page.markdown, entry) : manualFacts(entry),
    sections: page ? buildParsedSections(page.markdown) : manualSections(entry),
    nearby: entry.nearby,
    faq: page ? parseFaq(page.markdown) : manualFaq(entry),
    searchKeywords: [
      entry.title,
      `${entry.title} Крым`,
      entry.locationName,
      entry.districtName,
      ...entry.locationAliases,
      ...entry.tags,
      ...entry.nearby,
    ],
    status: "PUBLISHED",
    isPublishedVisible: true,
    createdByLogin: existingOverride?.createdByLogin ?? "code",
    createdAt: existingOverride?.createdAt ?? importedAt,
    updatedAt: importedAt,
  };
}

async function main() {
  const [overridesRaw, ...seoMarkdownFiles] = await Promise.all([
    readFile(overridesPath, "utf8"),
    ...seoFilePaths.map((filePath) => readFile(filePath, "utf8")),
  ]);
  const pages = new Map(seoMarkdownFiles.flatMap(splitSeoPages).map((page) => [page.title, page]));
  const overrides = JSON.parse(overridesRaw);

  const missingPages = [];
  for (const entry of entries) {
    const page = entry.sourceTitle ? pages.get(entry.sourceTitle) : null;
    if (entry.sourceTitle && !page) {
      missingPages.push(entry.sourceTitle);
    }
    overrides[entry.id] = await buildAttraction(entry, page, overrides[entry.id]);
  }

  if (missingPages.length > 0) {
    throw new Error(`SEO pages not found: ${missingPages.join(", ")}`);
  }

  for (const [id, patch] of Object.entries(coordinateFixes)) {
    if (overrides[id]) {
      overrides[id] = {
        ...overrides[id],
        ...patch,
        updatedAt: importedAt,
      };
    }
  }

  await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
  console.log(`Imported ${entries.length} attractions, image galleries, and ${Object.keys(coordinateFixes).length} coordinate fix.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
