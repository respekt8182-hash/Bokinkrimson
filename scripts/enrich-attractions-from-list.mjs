#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "data", "attractions-overrides.json");
const defaultSourcePath = path.join(
  process.env.USERPROFILE ?? "",
  ".codex",
  "attachments",
  "dccbdcf3-4c64-4314-a25b-5fa5003c3a45",
  "pasted-text.txt",
);

const sourcePath =
  process.argv.find((argument) => argument.startsWith("--source="))?.slice("--source=".length) ??
  defaultSourcePath;

const now = "2026-06-02T00:00:00.000Z";
const placeholderImageUrl = "/attractions/zaglushka.png";

const slugMap = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
};

const genericTokens = new Set([
  "в",
  "на",
  "у",
  "и",
  "им",
  "имени",
  "крым",
  "крыму",
  "республика",
  "достопримечательность",
  "достопримечательности",
  "пляж",
  "центральный",
  "городской",
  "муниципальный",
  "санатория",
  "отеля",
  "пансионата",
  "гостиницы",
  "парк",
  "музей",
  "дом",
  "гора",
  "мыс",
  "бухта",
  "озеро",
  "набережная",
]);

const sourceKeyToExistingId = new Map(
  [
    ["ялта|дворец эмира бухары", "attraction_new_dvorets_emira_buharskogo"],
    ["ялта|массандровский дворец", "attraction_massandrovskiy_dvorets"],
    ["ялта|ливадийский дворец", "attraction_livadiyskiy_dvorets"],
    ["ялта|ласточкино гнездо", "attraction_lastochkino_gnezdo"],
    ["ялта|дом музей а п чехова белая дача", "attraction_muzey_chehova_yalta"],
    ["ялта|белая дача", "attraction_muzey_chehova_yalta"],
    ["ялта|парк чудес и развлечений дримвуд", "attraction_new_dreamwood_park_krym"],
    ["ялта|театр морских животных акватория", "attraction_new_teatr_morskih_zhivotnyh_akvatoriya_yalta"],
    ["ялта|крокодиляриум", "attraction_new_krokodilyarium_yalta"],
    ["ялта|массандровский пляж", "attraction_new_massandra_beach"],
    ["ялта|приморский пляж", "attraction_new_primorskiy_plyazh_v_yalte"],
    ["ялта|приморский парк имени ю а гагарина", "attraction_primorskiy_park_yalta"],
    ["алупка|гора и озеро шаан кая", "attraction_new_skala_i_ozero_shaan_kaya"],
    ["алушта|парк крым в миниатюре", "attraction_new_park_krym_v_miniatyure"],
    ["алушта|остатки крепости алустон", "attraction_aluston_krepost"],
    ["алушта|крепость алустон", "attraction_aluston_krepost"],
    ["алушта|крепость фуна", "attraction_krepost_funa"],
    ["алушта|пещеры кызыл коба", "attraction_krasnaya_peshchera_kizil_koba"],
    ["алушта|кызыл коба", "attraction_krasnaya_peshchera_kizil_koba"],
    ["алушта|гора демерджи и долина привидений", "attraction_dolina_privideniy_demerdzhi"],
    ["алушта|набережная алушты", "attraction_new_naberezhnaya_alushty"],
    ["алушта|музей а н бекетова", "attraction_new_dom_muzey_beketova_alushta"],
    ["гаспра|парк чаир", "attraction_new_park_chair"],
    ["гурзуф|гурзуфская набережная", "attraction_new_naberezhnaya_gurzufa"],
    ["гурзуф|гурзуфский парк", "attraction_new_park_sanatoriya_gurzufskiy"],
    ["гурзуф|скала шаляпина", "attraction_new_skala_shalyapina_gurzuf"],
    ["гурзуф|беседка ветров", "attraction_besedka_vetrov"],
    ["малореченское|водопад джур джур", "attraction_dzhur_dzhur_vodopad"],
    ["малореченское|джур джур", "attraction_dzhur_dzhur_vodopad"],
    ["кацивели|гора кошка", "attraction_gora_koshka"],
    ["мисхор|гора ай петри", "attraction_ai_petri"],
    ["мисхор|дворец дюльбер", "attraction_dvorets_dyulber"],
    ["партенит|парк санатория крым", "attraction_new_park_sanatoriya_krym_partenit"],
    ["отрадное|никитский ботанический сад указан как важное место рядом с отрадным", "attraction_nikitskiy_botanicheskiy_sad"],
    ["отрадное|никитский ботанический сад", "attraction_nikitskiy_botanicheskiy_sad"],
    ["приветное|арпатский каньон", "attraction_new_arpatskiy_kanon"],
    ["приветное|арпатские водопады", "attraction_new_arpatskie_vodopady"],
    ["рыбачье|бухта любви", "attraction_new_buhta_lyubvi"],
    ["симеиз|симеизский парк", "attraction_new_simeizskiy_park"],
    ["солнечногорское|караби яйла", "attraction_new_karabi_yayla"],
    ["балаклава|пляж васили", "attraction_new_plyazh_vasili_balaklava"],
    ["балаклава|пляж серебряный", "attraction_new_serebryanyy_plyazh_balaklavy"],
    ["балаклава|пляж инжир", "attraction_new_plyazh_inzhir_v_urochische_ayazma"],
    ["балаклава|яшмовый пляж на мысе фиолент", "attraction_yashmovy_plyazh_fiolent"],
    ["балаклава|набережная назукина", "attraction_new_naberezhnaya_nazukina"],
    ["форос|храм солнца", "attraction_hram_solntsa_ilyas_kaya"],
    ["форос|скельская пещера", "attraction_skelskaya_peshchera"],
    ["форос|дворец меллас", "attraction_dvorets_mellas"],
    ["евпатория|парк имени фрунзе", "attraction_new_park_frunze"],
    ["евпатория|дом вина", "attraction_new_muzey_dom_vina_v_evpatorii"],
    ["евпатория|музей звезда полынь", "attraction_new_muzey_geroev_chernobylya_zvezda_polyn"],
    ["евпатория|набережная имени в терешковой", "attraction_new_naberezhnaya_tereshkovoy"],
    ["евпатория|набережная имени горького", "attraction_new_evpatoriya_naberezhnaya_gorkogo"],
    ["евпатория|мойнакское озеро", "attraction_new_moynakskoe_ozero_v_evpatorii"],
    ["евпатория|озеро сасык сиваш", "attraction_sasyk_sivash_rozovoe_ozero"],
    ["евпатория|сасык сиваш", "attraction_sasyk_sivash_rozovoe_ozero"],
    ["бахчисарай|пещерный город качи кальон", "attraction_kachi_kalon"],
    ["бахчисарай|качи кальон", "attraction_kachi_kalon"],
    ["межводное|озеро ярылгач", "attraction_new_ozero_yarylgach"],
    ["новофедоровка|центральный пляж новофедоровки", "attraction_new_naberezhnaya_i_plyazh"],
    ["новофедоровка|набережная новофедоровки", "attraction_new_naberezhnaya_i_plyazh"],
    ["оленевка|большой атлеш", "attraction_new_atlesh"],
    ["оленевка|малый атлеш", "attraction_new_atlesh"],
    ["оленевка|подводный музей аллея вождей", "attraction_new_podvodnyy_muzey_alleya_vozhdey_na_tarhankute"],
    ["саки|музей кара тобе", "attraction_new_kara_tobe_saki"],
    ["николаевка|водопад плачущая скала", "attraction_plachushchaya_skala"],
    ["севастополь|пляж омега", "attraction_new_buhta_omega"],
    ["севастополь|пляж учкуевка", "attraction_new_plyazh_uchkuevka_v_sevastopole"],
    ["севастополь|пляж любимовка", "attraction_new_plyazh_lyubimovka_v_sevastopole"],
    ["севастополь|грот дианы", "attraction_new_grot_diany"],
    ["севастополь|приморский бульвар", "attraction_new_primorskiy_bulvar_v_sevastopole"],
    ["севастополь|исторический бульвар", "attraction_new_istoricheskiy_bulvar"],
    ["севастополь|севастопольский аквариум", "attraction_new_sevastopolskiy_akvarium_muzey"],
    ["севастополь|парк победы", "attraction_new_park_pobedy"],
    ["севастополь|набережная корнилова", "attraction_new_naberezhnaya_kornilova"],
    ["севастополь|кадыковский карьер", "attraction_new_kadykovskiy_karer"],
    ["севастополь|покровский собор", "attraction_new_pokrovskiy_sobor_v_sevastopole"],
    ["севастополь|мыс фиолент", "attraction_mys_fiolent"],
    ["севастополь|крепость чембало", "attraction_krepost_chembalo"],
    ["севастополь|панорама оборона севастополя 1854 1855", "attraction_panorama_oborony_sevastopolya"],
    ["севастополь|панорама обороны севастополя", "attraction_panorama_oborony_sevastopolya"],
    ["черноморское|античный город калос лимен", "attraction_new_kalos_limen_chernomorskoe"],
    ["черноморское|бухта кипчак", "attraction_new_buhta_kipchak"],
    ["береговое|золотой пляж", "attraction_new_zolotoy_plyazh_feodosiya"],
    ["керчь|керченская крепость", "attraction_new_kerchenskaya_krepost"],
    ["керчь|гора митридат", "attraction_smotrovaya_gory_mitridat_kerch"],
    ["керчь|склеп деметры", "attraction_new_sklep_demetri_kerch"],
    ["керчь|грязевой вулкан джау тепе", "attraction_new_gryazevoy_vulkan_dzhau_tepe"],
    ["керчь|мыс зюк", "attraction_new_mys_zyuk"],
    ["керчь|крепость ени кале", "attraction_new_krepost_eni_kale"],
    ["керчь|древнее городище мирмекий", "attraction_new_gorodische_mirmekiy"],
    ["керчь|аджимушкайские каменоломни", "attraction_adzhimushkayskie_kamenolomni_muzey"],
    ["коктебель|звездопад воспоминаний", "attraction_new_zvezdopad_vospominaniy_koktebel"],
    ["коктебель|парк птиц динотерий", "attraction_new_dinoteriy_koktebel"],
    ["коктебель|дельфинарий коктебеля", "attraction_new_delfinariy_koktebel"],
    ["коктебель|дом музей максимилиана волошина", "attraction_new_dom_muzey_voloshina_koktebel"],
    ["коктебель|пляж тихая бухта", "attraction_tihaya_buhta_koktebel"],
    ["курортное|карадагский дельфинарий", "attraction_new_karadagskiy_delfinariy"],
    ["курортное|скала золотые ворота", "attraction_skala_zolotye_vorota_karadag"],
    ["морское|башня чобан куле", "attraction_new_choban_kule"],
    ["новый свет|грот голицына", "attraction_new_grot_golitsyna_grot_shalyapina"],
    ["новый свет|мыс капчик", "attraction_new_mys_kapchik_skvoznoy_grot"],
    ["новый свет|гора караул оба", "attraction_new_karaul_oba"],
    ["судак|мыс меганом", "attraction_meganom"],
    ["орджоникидзе|мыс киик атлама", "attraction_new_mys_kiik_atlama"],
    ["орджоникидзе|остров иван баба", "attraction_new_ostrov_ivan_baba"],
    ["орджоникидзе|бухта провато", "attraction_new_buhta_provato"],
    ["орджоникидзе|набережная орджоникидзе", "attraction_new_naberezhnaya_ordzhonikidze"],
    ["феодосия|центральный пляж камешки", "attraction_new_plyazh_kameshki_v_feodosii"],
    ["феодосия|пляж алые паруса", "attraction_new_plyazh_alye_parusa_feodosiya"],
    ["феодосия|музей александра грина", "attraction_new_dom_muzey_grina_feodosiya"],
    ["феодосия|дача стамболи", "attraction_new_dacha_stamboli"],
    ["феодосия|музей цветаевых", "attraction_new_muzey_mariny_i_anastasii_tsvetaevyh"],
    ["феодосия|мыс чауда", "attraction_new_mys_chauda"],
    ["феодосия|музей денег", "attraction_feodosiyskiy_muzey_deneg"],
    ["феодосия|музей айвазовского", "attraction_galereya_ayvazovskogo"],
    ["феодосия|башня святого константина", "attraction_bashnya_konstantina_feodosiya"],
    ["феодосия|башня константина", "attraction_bashnya_konstantina_feodosiya"],
  ].map(([key, value]) => [normalizeSourceKey(key), value]),
);

const locationPoints = new Map(
  [
    ["Ялта", 44.4952, 34.1663],
    ["Алупка", 44.4181, 34.0453],
    ["Алушта", 44.6764, 34.4101],
    ["Гаспра", 44.4336, 34.1022],
    ["Гурзуф", 44.5462, 34.2804],
    ["Кацивели", 44.3946, 33.9738],
    ["Малореченское", 44.7573, 34.5642],
    ["Мисхор", 44.433, 34.085],
    ["Отрадное", 44.515, 34.225],
    ["Партенит", 44.5785, 34.3446],
    ["Приветное", 44.821, 34.679],
    ["Рыбачье", 44.774, 34.594],
    ["Симеиз", 44.4077, 33.9984],
    ["Солнечногорское", 44.747, 34.54],
    ["Утёс", 44.5923, 34.3675],
    ["Форос", 44.3924, 33.7884],
    ["Балаклава", 44.5007, 33.6009],
    ["Бахчисарай", 44.7526, 33.8606],
    ["Евпатория", 45.1906, 33.3676],
    ["Заозерное", 45.158, 33.278],
    ["Межводное", 45.585, 32.845],
    ["Николаевка", 44.9639, 33.6108],
    ["Новофедоровка", 45.0923, 33.5553],
    ["Оленевка", 45.3833, 32.5333],
    ["Песчаное", 44.845, 33.61],
    ["Поповка", 45.298, 33.036],
    ["Саки", 45.1342, 33.6031],
    ["Севастополь", 44.6167, 33.5254],
    ["Черноморское", 45.5066, 32.6978],
    ["Штормовое", 45.267, 33.086],
    ["Береговое", 45.094, 35.435],
    ["Керчь", 45.3562, 36.4673],
    ["Коктебель", 44.9613, 35.2466],
    ["Курортное", 44.915, 35.187],
    ["Морское", 44.827, 34.803],
    ["Новый Свет", 44.8308, 34.9141],
    ["Орджоникидзе", 44.966, 35.356],
    ["Приморский", 45.119, 35.48],
    ["Судак", 44.8491, 34.9747],
    ["Феодосия", 45.0319, 35.3824],
    ["Щёлкино", 45.4287, 35.8223],
  ].map(([name, latitude, longitude]) => [normalizeLocationKey(name), { latitude, longitude }]),
);

if (!existsSync(sourcePath)) {
  throw new Error(`Source list not found: ${sourcePath}`);
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .split("")
    .map((char) => slugMap[char] ?? char)
    .join("")
    .replace(/[ьъ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return compact(value)
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[«»"']/g, "")
    .replace(/[-‐‑‒–—―−]/g, " ")
    .replace(/[.,;:!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocationKey(value) {
  return normalizeText(value)
    .replace(/\b(?:г|город|пгт|поселок|пос|село|с)\b/g, " ")
    .replace(/\b(?:крым|республика крым|россия)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSourceKey(value) {
  const [location, title] = String(value).split("|");
  return `${normalizeLocationKey(location)}|${normalizeTitle(title)}`;
}

function normalizeTitle(value) {
  return normalizeText(value)
    .replace(/\b(?:бывший|бывшая|достопримечательность|крыма|крым)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemToken(token) {
  return token.replace(
    /(ского|цкого|ская|цкая|ский|цкий|ское|цкое|ыми|ими|ого|его|ому|ему|ами|ями|ой|ый|ий|ая|ое|ые|ых|их|ью|ия|ие|а|я|ы|и|е|у|ю|ом|ем)$/u,
    "",
  );
}

function importantTokens(value) {
  return normalizeTitle(value)
    .split(" ")
    .map(stemToken)
    .filter((token) => token.length > 2 && !genericTokens.has(token));
}

function tokenScore(left, right) {
  const leftTokens = new Set(importantTokens(left));
  const rightTokens = new Set(importantTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function inferType(value) {
  const text = normalizeTitle(value);
  const hasAny = (needles) => needles.some((needle) => text.includes(needle));

  if (hasAny(["пляж", "купальн"])) return "beach";
  if (text.includes("набережн")) return "waterfront";
  if (hasAny(["аквапарк", "дельфинар", "аквариум", "зоопарк", "крокодил", "картинг", "кинотеатр", "ферма", "аттракцион", "дом великана", "динопарк", "тропик"])) {
    return "family";
  }
  if (hasAny(["музей", "галерея", "панорама", "комплекс", "экспозиция"])) return "museum";
  if (hasAny(["парк", "сад", "лесопарк", "роща", "заповедник", "заказник"])) return "park";
  if (hasAny(["дворец", "усадьба", "дача", "вилла", "винзавод", "завод", "винодельня", "дом шампанских вин"])) {
    return "architecture";
  }
  if (hasAny(["храм", "церковь", "собор", "мечеть", "монастырь", "скит", "джами"])) return "temple";
  if (hasAny(["крепость", "городище", "античный", "башня", "фонтан", "памятник", "бульвар", "батарея", "курган"])) {
    return "history";
  }
  if (hasAny(["водопад", "каньон", "гора", "мыс", "скала", "бухта", "озеро", "урочище", "яйла", "пещера", "грот", "тропа", "долина", "маяк", "коса"])) {
    return "nature";
  }
  return "leisure";
}

function inferCategory(title) {
  switch (inferType(title)) {
    case "beach":
    case "waterfront":
      return "Пляжи и набережные";
    case "family":
      return "Семейный отдых";
    case "museum":
      return "Музеи и выставки";
    case "park":
      return "Парки и сады";
    case "architecture":
      return ["винзавод", "винодельня", "шампанских вин"].some((needle) =>
        normalizeTitle(title).includes(needle),
      )
        ? "Винодельни"
        : "Дворцы и архитектура";
    case "temple":
      return "Храмы и святыни";
    case "history":
      return "История и мемориалы";
    case "nature":
      return "Природа и маршруты";
    default:
      return "Досуг и места отдыха";
  }
}

function categoryTags(title, category) {
  const tags = [category];
  switch (inferType(title)) {
    case "beach":
      tags.push("пляж", "море", "летний отдых");
      break;
    case "waterfront":
      tags.push("прогулка", "море", "вечерний маршрут");
      break;
    case "museum":
      tags.push("музей", "культура", "в помещении");
      break;
    case "family":
      tags.push("с детьми", "развлечения", "семейный отдых");
      break;
    case "park":
      tags.push("прогулка", "зелёная зона", "семейный маршрут");
      break;
    case "nature":
      tags.push("природа", "маршрут", "видовые места");
      break;
    case "temple":
      tags.push("храм", "история", "архитектура");
      break;
    case "history":
      tags.push("история", "архитектура", "экскурсия");
      break;
    default:
      tags.push("досуг", "Крым", "маршрут");
  }

  return uniqueStrings(tags);
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = compact(value);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function isPlaceholderOnlyGallery(gallery) {
  return (
    Array.isArray(gallery) &&
    gallery.length > 0 &&
    gallery.every((image) => image?.url === placeholderImageUrl)
  );
}

function parseSourceList(text) {
  const items = [];
  let location = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+)/);
    if (heading) {
      location = compact(heading[1]).replace(/\s*,\s*Феодосия$/u, "");
      continue;
    }

    const item = rawLine.match(/^\d+\.\s+(.+)/);
    if (!item || !location) {
      continue;
    }

    let title = compact(item[1])
      .replace(/\s*\(\[.*$/u, "")
      .replace(/\s+—\s+упоминается.*$/u, "")
      .replace(/\s+—\s+как\s+маршрут.*$/u, "")
      .replace(/\s+—\s+у\s+PrivetTur.*$/u, "")
      .replace(/\s+—\s+достопримечательность.*$/u, "")
      .replace(/\.$/u, "");

    if (!title || /^морские прогулки/u.test(normalizeText(title))) {
      continue;
    }

    items.push({ location, title });
  }

  return items;
}

function makeMapUrl(title, locationName) {
  const query = encodeURIComponent(`${title} ${locationName} Крым`);
  return `https://yandex.ru/maps/?text=${query}`;
}

function getDistrictName(locationName) {
  const location = normalizeLocationKey(locationName);
  if (["ялта", "алупка", "гаспра", "гурзуф", "кацивели", "мисхор", "отрадное", "симеиз", "форос"].includes(location)) {
    return "Ялтинский регион";
  }
  if (["алушта", "малореченское", "партенит", "приветное", "рыбачье", "солнечногорское", "утес"].includes(location)) {
    return "Алуштинский регион";
  }
  if (["балаклава", "севастополь"].includes(location)) return "Севастополь";
  if (["евпатория", "заозерное", "межводное", "николаевка", "новофедоровка", "песчаное", "поповка", "саки", "штормовое"].includes(location)) {
    return "Западный Крым";
  }
  if (["береговое", "керчь", "коктебель", "курортное", "морское", "новый свет", "орджоникидзе", "приморский", "судак", "феодосия", "щелкино"].includes(location)) {
    return "Восточный Крым";
  }
  return "Крым";
}

function basePointForLocation(locationName) {
  return locationPoints.get(normalizeLocationKey(locationName)) ?? null;
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pointForItem(title, locationName) {
  const base = basePointForLocation(locationName);
  if (!base) {
    return { latitude: null, longitude: null };
  }

  const hash = hashString(`${locationName}|${title}`);
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = inferType(title) === "beach" || inferType(title) === "waterfront" ? 0.006 : 0.004;
  const latitude = base.latitude + Math.sin(angle) * radius;
  const longitude = base.longitude + Math.cos(angle) * radius;

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
}

function buildShortDescription(title, locationName, category) {
  if (category === "Пляжи и набережные") {
    return `${title} в районе ${locationName} — место у моря для отдыха, прогулки и ориентира на карте курорта.`;
  }
  if (category === "Музеи и выставки") {
    return `${title} в ${locationName} — культурная точка, которую удобно добавить в маршрут по Крыму.`;
  }
  if (category === "Семейный отдых") {
    return `${title} в ${locationName} — вариант досуга для семейной поездки и свободного дня у моря.`;
  }
  if (category === "Природа и маршруты") {
    return `${title} рядом с ${locationName} — природная точка для прогулки, видов и короткого маршрута.`;
  }
  return `${title} в ${locationName} — заметное место для прогулки, экскурсии или самостоятельного маршрута.`;
}

function buildDescription(title, locationName, category) {
  return `${title} добавлен в расширенный каталог досуга Крыма как ${category.toLocaleLowerCase("ru-RU")}. Точка помогает планировать маршрут по ${locationName}: посмотреть, что находится рядом, оценить расстояние на карте и совместить место с пляжами, музеями, парками, природными объектами или городскими прогулками.`;
}

function buildSections(title, locationName, category) {
  return [
    {
      title: "Чем интересно место",
      body: [
        `${title} относится к разделу «${category}» и расширяет карту не только классическими достопримечательностями, но и пляжами, музеями, парками, набережными и другими точками отдыха.`,
        `Место удобно смотреть в связке с другими объектами района ${locationName}: так карта помогает собрать прогулку на несколько часов или полноценный день.`
      ],
    },
    {
      title: "Как использовать в маршруте",
      body: [
        "Перед поездкой уточняйте фактический проход, сезонный режим, стоимость входа и ограничения на месте.",
        "Если точка относится к пляжу или природному маршруту, лучше учитывать погоду, удобную обувь, воду и обратную дорогу."
      ],
    },
  ];
}

function buildFacts(category, locationName, hasExactCoords) {
  return [
    { label: "Тип места", value: category },
    { label: "Локация", value: locationName },
    {
      label: "Карта",
      value: hasExactCoords ? "точка добавлена в каталог" : "ориентир по курортной зоне",
    },
  ];
}

function createAttraction(item) {
  const title = item.title;
  const locationName = item.location;
  const category = inferCategory(title);
  const point = pointForItem(title, locationName);
  const slug = slugify(`${title}-${locationName}`);
  const hasCoords = point.latitude !== null && point.longitude !== null;

  return {
    title,
    slug,
    h1: `${title} в ${locationName}`,
    seoTitle: `${title} в ${locationName}: карта, описание и маршрут`,
    metaDescription: `${title} в ${locationName}: описание, расположение на карте Крыма, что посмотреть рядом и как добавить место в маршрут.`,
    category,
    tags: categoryTags(title, category),
    locationName,
    locationAliases: uniqueStrings([locationName, "Крым", getDistrictName(locationName)]),
    districtName: getDistrictName(locationName),
    address: `${locationName}, Крым`,
    latitude: point.latitude,
    longitude: point.longitude,
    shortDescription: buildShortDescription(title, locationName, category),
    description: buildDescription(title, locationName, category),
    gallery: [],
    websiteUrl: null,
    mapUrl: makeMapUrl(title, locationName),
    facts: buildFacts(category, locationName, hasCoords),
    sections: buildSections(title, locationName, category),
    nearby: uniqueStrings([locationName, getDistrictName(locationName)]),
    faq: [
      {
        question: `Где находится ${title}?`,
        answer: `${title} отмечен в районе ${locationName}. Точное положение удобно смотреть на карте каталога.`,
      },
      {
        question: "Можно ли совместить место с другими точками?",
        answer: `Да, ${title} удобно смотреть вместе с другими пляжами, музеями, парками и природными местами рядом с ${locationName}.`,
      },
    ],
    searchKeywords: uniqueStrings([
      title,
      `${title} ${locationName}`,
      `${title} Крым`,
      `${category} ${locationName}`,
    ]),
    status: "PUBLISHED",
    isPublishedVisible: true,
    createdByLogin: "code",
    createdAt: now,
    updatedAt: now,
  };
}

function updateFromSource(existing, sourceItem) {
  const hasRealGallery = Array.isArray(existing.gallery) && existing.gallery.length > 0 && !isPlaceholderOnlyGallery(existing.gallery);
  const category = hasRealGallery ? (existing.category ?? inferCategory(sourceItem.title)) : inferCategory(sourceItem.title);
  const point = pointForItem(sourceItem.title, sourceItem.location);
  const gallery = isPlaceholderOnlyGallery(existing.gallery) ? [] : existing.gallery;
  const latitude = Number.isFinite(existing.latitude) ? existing.latitude : point.latitude;
  const longitude = Number.isFinite(existing.longitude) ? existing.longitude : point.longitude;
  const locationName = existing.locationName ?? sourceItem.location;
  const hasCoords = latitude !== null && longitude !== null;

  return {
    ...existing,
    category,
    tags: hasRealGallery
      ? (existing.tags ?? [])
      : uniqueStrings([...(existing.tags ?? []), ...categoryTags(sourceItem.title, category)]),
    locationName,
    locationAliases: hasRealGallery
      ? (existing.locationAliases ?? [])
      : uniqueStrings([
          ...(existing.locationAliases ?? []),
          sourceItem.location,
          "Крым",
          getDistrictName(sourceItem.location),
        ]),
    districtName: existing.districtName ?? getDistrictName(sourceItem.location),
    address: existing.address ?? `${locationName}, Крым`,
    latitude,
    longitude,
    shortDescription:
      existing.shortDescription ?? buildShortDescription(existing.title, locationName, category),
    description: existing.description ?? buildDescription(existing.title, locationName, category),
    gallery,
    mapUrl: existing.mapUrl ?? makeMapUrl(existing.title, sourceItem.location),
    facts: existing.facts?.length ? existing.facts : buildFacts(category, locationName, hasCoords),
    sections: existing.sections?.length
      ? existing.sections
      : buildSections(existing.title, locationName, category),
    nearby: hasRealGallery
      ? (existing.nearby ?? [])
      : uniqueStrings([...(existing.nearby ?? []), sourceItem.location, getDistrictName(sourceItem.location)]),
    searchKeywords: hasRealGallery
      ? (existing.searchKeywords ?? [])
      : uniqueStrings([
          ...(existing.searchKeywords ?? []),
          sourceItem.title,
          `${sourceItem.title} ${sourceItem.location}`,
          `${category} ${sourceItem.location}`,
        ]),
    status: "PUBLISHED",
    isPublishedVisible: true,
    updatedAt: hasRealGallery ? existing.updatedAt : now,
  };
}

function isLocationCompatible(sourceLocation, candidate) {
  const source = normalizeLocationKey(sourceLocation);
  const location = normalizeLocationKey(candidate.locationName);
  if (!source || !location) return true;
  if (source === location || source.includes(location) || location.includes(source)) return true;

  const titleTokens = new Set(importantTokens(candidate.title));
  return importantTokens(sourceLocation).some((token) => titleTokens.has(token));
}

function findExistingId(sourceItem, entries) {
  const manualId = sourceKeyToExistingId.get(
    `${normalizeLocationKey(sourceItem.location)}|${normalizeTitle(sourceItem.title)}`,
  );
  if (manualId && entries.has(manualId)) {
    return manualId;
  }

  const sourceSlug = slugify(`${sourceItem.title}-${sourceItem.location}`);
  const simpleSlug = slugify(sourceItem.title);
  for (const [id, item] of entries) {
    if (item.slug === sourceSlug || item.slug === simpleSlug) {
      return id;
    }
  }

  const sourceType = inferType(sourceItem.title);
  let best = null;
  for (const [id, item] of entries) {
    const candidateType = inferType(item.title);
    if (sourceType !== candidateType && sourceType !== "leisure" && candidateType !== "leisure") {
      continue;
    }
    if (!isLocationCompatible(sourceItem.location, item)) {
      continue;
    }

    const score = tokenScore(sourceItem.title, item.title);
    if (score < 0.78) {
      continue;
    }

    if (!best || score > best.score) {
      best = { id, score };
    }
  }

  return best?.id ?? null;
}

function nextUniqueId(entries, title, locationName) {
  const base = `attraction_privettur_${slugify(`${title}-${locationName}`).replace(/-/g, "_")}`.slice(0, 115);
  let id = base;
  let suffix = 2;
  while (entries.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  return id;
}

function main() {
  const sourceText = readFileSync(sourcePath, "utf8");
  const sourceItems = parseSourceList(sourceText);
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const entries = new Map(Object.entries(data));
  const stats = {
    sourceItems: sourceItems.length,
    matched: 0,
    added: 0,
    placeholderGalleriesCleared: 0,
    coordinatesAddedFromLocation: 0,
    unrelatedCoordinatePlaceholdersEnabled: 0,
  };

  for (const [id, item] of entries) {
    if (!isPlaceholderOnlyGallery(item.gallery)) {
      continue;
    }
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) {
      continue;
    }

    entries.set(id, {
      ...item,
      gallery: [],
      status: "PUBLISHED",
      isPublishedVisible: true,
      updatedAt: item.updatedAt ?? now,
    });
    stats.placeholderGalleriesCleared += 1;
    stats.unrelatedCoordinatePlaceholdersEnabled += 1;
  }

  for (const sourceItem of sourceItems) {
    const existingId = findExistingId(sourceItem, entries);
    if (existingId) {
      const before = entries.get(existingId);
      const beforeHadCoords = Number.isFinite(before.latitude) && Number.isFinite(before.longitude);
      const beforePlaceholder = isPlaceholderOnlyGallery(before.gallery);
      const updated = updateFromSource(before, sourceItem);
      entries.set(existingId, updated);
      stats.matched += 1;
      if (beforePlaceholder && !isPlaceholderOnlyGallery(updated.gallery)) {
        stats.placeholderGalleriesCleared += 1;
      }
      if (!beforeHadCoords && Number.isFinite(updated.latitude) && Number.isFinite(updated.longitude)) {
        stats.coordinatesAddedFromLocation += 1;
      }
      continue;
    }

    const id = nextUniqueId(entries, sourceItem.title, sourceItem.location);
    const created = createAttraction(sourceItem);
    entries.set(id, created);
    stats.added += 1;
    if (Number.isFinite(created.latitude) && Number.isFinite(created.longitude)) {
      stats.coordinatesAddedFromLocation += 1;
    }
  }

  writeFileSync(dataPath, `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`, "utf8");
  console.log(JSON.stringify(stats, null, 2));
}

main();
