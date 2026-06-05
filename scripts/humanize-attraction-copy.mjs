import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "data", "attractions-overrides.json");
const dryRun = process.argv.includes("--dry-run");
const listChanged = process.argv.includes("--list-changed");
const now = "2026-06-05T12:00:00.000Z";

const categoryProfiles = [
  {
    key: "beach",
    match: /пляж|купани/i,
    short:
      "береговая остановка для неспешного отдыха: оцените заход в воду, покрытие, тень и общий ритм места.",
    description:
      "Лучше смотреть на это место глазами отдыхающего: где удобнее зайти в воду, куда лечь с полотенцем, когда становится людно и есть ли смысл задержаться на пару часов.",
    why:
      "Сюда идут за морем без сложного маршрута. Пройдитесь вдоль берега, оцените заход в воду и посмотрите, где комфортнее устроиться именно в ваш день.",
    see: "Обратите внимание на покрытие пляжа, глубину у берега, тень, подходы к воде и вид вдоль побережья.",
    plan: "В сезон приходите утром или ближе к вечеру. Днём на популярных пляжах быстро становится жарко и тесно.",
  },
  {
    key: "mountain",
    match: /гор|скал|пещер/i,
    short:
      "природная точка для видов, воздуха и прогулки, где Крым раскрывается не пляжем, а рельефом.",
    description:
      "Здесь лучше не торопиться: поднять взгляд от тропы, поймать линию гор или моря и оставить время на остановки. Такая прогулка ценится не только финальной точкой, а дорогой к ней.",
    why:
      "Это место выбирают за простор, рельеф и ощущение настоящей прогулки. Даже короткий маршрут здесь лучше проходить без спешки.",
    see: "Ищите видовые точки, необычные формы скал, тропы, перепады высоты и ракурсы, которые не видны из города.",
    plan: "Нужны удобная обувь, вода и защита от солнца. После дождя камни и грунт могут быть скользкими.",
  },
  {
    key: "sea",
    match: /море|бухт|мыс|маяк/i,
    short:
      "морская точка для прогулки, фотографий и ощущения открытого берега без лишней суеты.",
    description:
      "Главное здесь - горизонт, ветер и смена ракурсов. Идите не только к одной точке на карте: пройдитесь чуть дальше, посмотрите берег с разных сторон и выберите свой вид.",
    why:
      "Сюда едут за открытым берегом и кадрами, где море занимает почти всё внимание. Место хорошо работает как короткая остановка в маршруте.",
    see: "Смотрите линию берега, скальные выступы, бухты, маяки, цвет воды и точки для безопасной фотографии.",
    plan: "На открытом берегу часто ветрено. Возьмите воду, головной убор и не подходите к обрывам ради кадра.",
  },
  {
    key: "water",
    match: /водопад|озер|водоём|водоем/i,
    short:
      "природное место у воды, куда стоит идти за прохладой, тишиной и сменой темпа после моря или города.",
    description:
      "У воды место воспринимается особенно живо: шум, тень, влажный воздух и тропа вокруг дают совсем другой ритм отдыха. Лучшие впечатления обычно не у самой шумной точки, а на спокойной прогулке рядом.",
    why:
      "Это хороший выбор, когда хочется сменить пляжный день на прохладную природную прогулку.",
    see: "Обратите внимание на подход к воде, тропы вокруг, камни, тень, сезонность потока и безопасные места для остановки.",
    plan: "После дождей воды обычно больше, но тропы сложнее. В жаркий сезон часть водопадов и ручьёв может быть слабее.",
  },
  {
    key: "museum",
    match: /музе|культур|памятник/i,
    short:
      "место для спокойного знакомства с историей и деталями, которые легко пропустить на обычной прогулке.",
    description:
      "Сюда лучше заходить не галочкой, а с любопытством. Внимание держится на деталях: предметах, подписях, историях людей и маленьких вещах, из которых складывается образ места.",
    why:
      "Хорошая остановка, если хочется разбавить море и прогулки содержательным часом в городе.",
    see: "Смотрите экспозиции, подписи, редкие детали, архитектуру здания и то, как место связано с городом вокруг.",
    plan: "Перед визитом проверьте график и формат посещения. В музеях режим работы и доступные залы могут меняться.",
  },
  {
    key: "history",
    match: /истор|археолог|военн/i,
    short:
      "историческая остановка, где маршрут становится понятнее, если смотреть не только на камни, а на события за ними.",
    description:
      "Здесь важна не парадность, а контекст. Даже если на месте сохранилось немного, оно помогает представить, как менялся Крым и почему эта точка до сих пор остаётся в маршрутах.",
    why:
      "Такое место лучше смотреть с небольшим запасом времени: здесь ценны не только виды, но и история под ногами.",
    see: "Ищите сохранившиеся фрагменты, памятные знаки, рельеф местности, музейные пояснения и видовые точки.",
    plan: "Если есть экскурсия или информационные стенды, воспользуйтесь ими. Без контекста часть смысла легко проскочить.",
  },
  {
    key: "religion",
    match: /храм|монастыр|религи/i,
    short:
      "тихая остановка с архитектурой, историей и особым настроением, где лучше сбавить темп.",
    description:
      "Это место стоит воспринимать спокойнее, чем обычную смотровую. Здесь важны тишина, детали архитектуры, положение в ландшафте и уважительный темп прогулки.",
    why:
      "Сюда приходят за атмосферой, архитектурой и паузой в насыщенном маршруте.",
    see: "Обратите внимание на фасады, росписи, двор, вид вокруг и то, как здание вписано в местность.",
    plan: "Одевайтесь уместно для религиозного места и заранее уточняйте, какие зоны открыты для туристов.",
  },
  {
    key: "family",
    match: /развлеч|семейн/i,
    short:
      "формат для отдыха без сложного маршрута, особенно если хочется переключиться с экскурсий на лёгкие впечатления.",
    description:
      "Здесь не нужно искать глубокий исторический подтекст. Это место про простую радость: прийти, посмотреть, попробовать формат и дать себе передышку от дорог и длинных прогулок.",
    why:
      "Хороший вариант для семейного дня или паузы между более серьёзными достопримечательностями.",
    see: "Смотрите программу, зоны отдыха, удобство для детей, очереди и места, где можно спокойно перевести дух.",
    plan: "Лучше заранее проверить расписание, билеты и ограничения по возрасту или росту, если они есть.",
  },
  {
    key: "palace",
    match: /дворц|дач|архитект/i,
    short:
      "архитектурная прогулка с фасадами, дворами, историей владельцев и деталями, которые лучше рассматривать без спешки.",
    description:
      "Здесь интереснее всего идти медленно: смотреть фасады, террасы, лестницы, старые деревья, дворики и виды, ради которых место вписали именно в этот ландшафт.",
    why:
      "Сюда едут за архитектурой и прогулкой, где здание работает вместе с парком и пейзажем.",
    see: "Обратите внимание на фасады, лестницы, террасы, парк, видовые точки и небольшие архитектурные детали.",
    plan: "Если есть музейная часть, заложите время отдельно на интерьеры и отдельно на прогулку снаружи.",
  },
  {
    key: "city",
    match: /городск|парк|инфраструктур/i,
    short:
      "городская прогулка, где можно почувствовать место без дальнего переезда и сложной подготовки.",
    description:
      "Это не точка для гонки по маршруту, а удобный способ почувствовать город. Пройдитесь пешком, загляните в боковые места и оставьте время на кофе, лавочку или вид, который случайно понравится.",
    why:
      "Место подходит для лёгкой прогулки, когда хочется посмотреть город в спокойном темпе.",
    see: "Смотрите аллеи, набережные, памятники, видовые точки, кафе рядом и маршруты, которые удобно продолжить пешком.",
    plan: "Лучше приходить в комфортное время дня. В жару городские прогулки приятнее утром или вечером.",
  },
  {
    key: "route",
    match: /смотров|маршрут/i,
    short:
      "видовая прогулка для тех, кто хочет не просто приехать к точке, а пройти путь и собрать несколько ракурсов.",
    description:
      "Маршрут хорош тем, что впечатление накапливается постепенно. Не спешите к финальной точке: часто самые удачные виды появляются по дороге.",
    why:
      "Сюда стоит идти ради самого пути: смены видов, воздуха и маленьких остановок по дороге.",
    see: "Смотрите повороты тропы, просветы между деревьями, безопасные смотровые точки и места для короткой паузы.",
    plan: "Оцените длину маршрута заранее, возьмите воду и не выходите на тропу в неподходящей обуви.",
  },
  {
    key: "reserve",
    match: /заповед|урочищ|природн/i,
    short:
      "природная территория для спокойной прогулки, где ценны тишина, тропы и ощущение дикого Крыма.",
    description:
      "Здесь лучше держать мягкий темп: прислушаться к лесу или ветру, смотреть по сторонам и не пытаться превратить прогулку в чек-лист. Такие места раскрываются в деталях.",
    why:
      "Хороший вариант для тех, кто хочет уйти от курортного шума и провести часть дня на природе.",
    see: "Смотрите тропы, растительность, рельеф, видовые просветы и природные ориентиры.",
    plan: "Берегите территорию, не сходите с разрешённых маршрутов и заранее уточняйте правила посещения.",
  },
  {
    key: "wine",
    match: /вин|гастро|производ/i,
    short:
      "гастрономическая остановка, где интересно посмотреть производство, попробовать местные вкусы и замедлиться.",
    description:
      "Такие места хороши не только дегустацией. Здесь интересно увидеть, как устроено производство, чем живёт территория и почему локальный вкус часто запоминается сильнее сувенира.",
    why:
      "Сюда едут за вкусом, атмосферой и понятной паузой в маршруте.",
    see: "Обратите внимание на экскурсионный формат, дегустации, территорию, магазин и видовые места рядом.",
    plan: "Бронируйте экскурсию заранее и продумайте транспорт, если планируете дегустацию.",
  },
];

const fallbackProfile = {
  key: "default",
  short:
    "интересная остановка для маршрута по Крыму, если хочется увидеть место своими глазами, а не только на карте.",
  description:
    "Сюда лучше ехать без ожидания парадной открытки: посмотрите место вживую, оцените детали, вид вокруг и то, как оно вписывается в маршрут.",
  why:
    "Место хорошо подходит для короткой остановки или спокойной прогулки, если вы уже планируете маршрут по этому району.",
  see: "Смотрите окружение, видовые точки, детали на месте и удобство подхода.",
  plan: "Заранее проверьте дорогу, сезонность и время, которое хотите провести на месте.",
};

const replacements = [
  [/официальный сайт[^.!?]*(?:[.!?]|$)/giu, ""],
  [/туристические справочники[^.!?]*(?:[.!?]|$)/giu, ""],
  [/по данным[^.!?]*(?:[.!?]|$)/giu, ""],
  [/туристических описаниях[^.!?]*(?:[.!?]|$)/giu, ""],
  [/официальный очерк[^.!?]*(?:[.!?]|$)/giu, ""],
  [/для карточки используется базовое описание[^.!?]*(?:[.!?]|$)/giu, ""],
  [/подробный текстовый блок[^.!?]*(?:[.!?]|$)/giu, ""],
  [/место, которое легко запомнить Крыма/giu, "место Крыма, которое запоминается с первого взгляда"],
  [/Здесь интереснее всего идти медленно: смотреть фасады, террасы, лестницы, старые деревья и виды, ради которых такие места строили именно на Южном берегу\./giu, "Здесь интереснее всего идти медленно: смотреть фасады, террасы, лестницы, старые деревья и то, как место вписано в ландшафт."],
  [/Главная ценность поездки - не только сам дворец, но и его окружение\./giu, "Главная ценность поездки - связка дворца, парка и пейзажа."],
  [/одно из самых узнаваемых мест/giu, "место, которое легко запомнить"],
  [/одна из самых узнаваемых мест/giu, "место, которое легко запомнить"],
  [/одно из самых эффектных мест/giu, "очень выразительное место"],
  [/один из самых эффектных ландшафтов/giu, "очень выразительный ландшафт"],
  [/одна из самых эффектных локаций/giu, "очень выразительная локация"],
  [/и заметный видов/giu, "и вид, который легко узнать"],
  [/заметный видов/giu, "вид, который легко узнать"],
  [/очень выразительный ландшафтов/giu, "очень выразительный ландшафт"],
  [/один из самых узнаваемых видов/giu, "вид, который легко узнать"],
  [/одна из самых узнаваемых достопримечательностей/giu, "заметная достопримечательность"],
  [/один из самых эффектных/giu, "очень выразительный"],
  [/одна из самых эффектных/giu, "очень выразительная"],
  [/один из самых известных/giu, "известный"],
  [/одна из самых известных/giu, "известная"],
  [/один из самых узнаваемых/giu, "заметный"],
  [/одна из самых узнаваемых/giu, "заметная"],
  [/один из главных/giu, "важный"],
  [/одна из главных/giu, "важная"],
  [/главная особенность\s*-\s*/giu, "Больше всего цепляет "],
  [/главная особенность\s*:\s*/giu, "Больше всего цепляет "],
  [/место стоит посещения ради/giu, "сюда стоит заглянуть ради"],
  [/туристы едут сюда ради/giu, "сюда едут ради"],
  [/туристам здесь интересны/giu, "здесь интересны"],
  [/\bВ\s+Главная особенность/giu, "Главная особенность"],
  [/\bВ\s+Больше всего/giu, "Больше всего"],
  [/место интересно сочетанием/giu, "место цепляет сочетанием"],
  [/место интересно не только/giu, "место интересно"],
  [/сочетает музей, архитектурный памятник и/giu, "объединяет музейную часть и"],
  [/ценится не только финальной точкой, а дорогой к ней/giu, "ценится и финальной точкой, и дорогой к ней"],
  [/Место удобно включать в маршрут по региону «([^»]+)» и соседним достопримечательностям: ([^.]+)\./gu, "Хорошо ложится в маршрут по региону «$1». Рядом: $2."],
];

const customCopy = [
  {
    match: (item) => /ласточкино гнездо/i.test(item.title ?? ""),
    short:
      "Миниатюрный замок на Аврориной скале у Гаспры: море под обрывом, смотровые площадки и кадр, ради которого сюда едут.",
    description:
      "Ласточкино гнездо (Гаспра) стоит на Аврориной скале мыса Ай-Тодор. Сюда идут за резким видом: маленький замок, отвесная скала и море прямо под ногами.\n\nДаже короткая остановка работает хорошо. Пройдитесь по смотровым площадкам, посмотрите замок сбоку и оставьте время на фотографии без спешки.",
    sections: [
      {
        title: "Почему сюда едут",
        body: [
          "Ласточкино гнездо стоит на Аврориной скале над морем. Главное впечатление здесь простое и сильное: маленький замок будто держится на краю обрыва, а под ним открывается Южный берег.",
        ],
      },
      {
        title: "Что посмотреть на месте",
        body: [
          "Пройдитесь по смотровым площадкам, посмотрите замок сбоку, поймайте кадр со скалой и морем и оставьте немного времени на прогулку вокруг.",
        ],
      },
    ],
  },
];

function getProfile(item) {
  const source = `${item.category ?? ""} ${item.title ?? ""}`;
  return categoryProfiles.find((profile) => profile.match.test(source)) ?? fallbackProfile;
}

function titleWithPlace(item) {
  return `${item.title}${item.locationName ? ` (${item.locationName})` : ""}`;
}

function nearbySentence(item) {
  const nearby = Array.isArray(item.nearby) ? item.nearby.filter(Boolean).slice(0, 4) : [];
  if (nearby.length === 0) {
    return "";
  }
  return `Если хочется продолжить день, рядом удобно посмотреть: ${nearby.join(", ")}.`;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return value;
  }

  let text = value
    .replace(/[—–]/g, "-")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s*;\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  text = text
    .split(/(?<=[.!?])\s+/u)
    .filter((sentence) => !/(официальн|туристическ[^.!?]*описан|справочник|по данным)/iu.test(sentence))
    .filter((sentence) => sentence.trim().length > 2)
    .join(" ");

  text = text
    .replace(/В Главная особенность/giu, "Главная особенность")
    .replace(/В Больше всего/giu, "Больше всего")
    .replace(/не только ([^,.]+), но и ([^,.]+)/giu, "$1 и $2");

  text = text
    .replace(/\s+\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text;
}

function isProbablyTruncated(value) {
  if (typeof value !== "string") {
    return false;
  }
  const text = value.trim();
  return text.length >= 240 && !/[.!?…"»)\]]$/.test(text);
}

function limitSentence(value, maxLength) {
  const text = normalizeText(value);
  if (text.length <= maxLength) {
    return text;
  }

  const cut = text.slice(0, maxLength + 1);
  const lastPunctuation = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  if (lastPunctuation >= 80) {
    return cut.slice(0, lastPunctuation + 1).trim();
  }

  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : maxLength).trim()}...`;
}

function getCustomCopy(item) {
  return customCopy.find((entry) => entry.match(item));
}

function isGenericProfileText(text, item, profile) {
  const normalized = normalizeText(text);
  return normalized.includes(normalizeText(`${titleWithPlace(item)} - ${profile.short}`));
}

function isBadNarrative(text) {
  return /заметный видов|официальн|туристическ[^.!?]*описан|справочник|по данным|южнобережным ощущением|строили именно на Южном берегу|очень выразительный ландшафтов|базовое описание|исходной папке|удобно добавить|достопримечательность Крыма для самостоятельной поездки/i.test(text);
}

function sectionNarrative(item) {
  const sections = Array.isArray(item.sections) ? item.sections : [];
  const bannedTitle = /как добраться|когда|рядом|практичес|спланировать|карте/i;
  const paragraphs = sections
    .filter((section) => !bannedTitle.test(section.title ?? ""))
    .flatMap((section) => (Array.isArray(section.body) ? section.body : []))
    .map((paragraph) => normalizeText(paragraph))
    .filter((paragraph) => paragraph.length >= 120 && !isProbablyTruncated(paragraph));

  return paragraphs.slice(0, 2).join("\n\n");
}

function buildShortDescription(item, profile) {
  const custom = getCustomCopy(item);
  if (custom?.short) {
    return custom.short;
  }

  const current = normalizeText(item.shortDescription ?? "");
  const narrative = sectionNarrative(item);
  const narrativeLead = narrative.split(/(?<=[.!?])\s+/u).find((sentence) => sentence.length >= 70);
  const shouldReplace =
    !current ||
    isProbablyTruncated(item.shortDescription) ||
    isGenericProfileText(current, item, profile) ||
    isBadNarrative(current) ||
    /официальн|справочник|один из самых|одна из самых|символ/.test(current.toLowerCase());

  if (!shouldReplace && current.length <= 210) {
    return current;
  }

  if (narrativeLead) {
    return limitSentence(narrativeLead, 210);
  }

  return limitSentence(`${titleWithPlace(item)} - ${profile.short}`, 210);
}

function buildDescription(item, profile) {
  const custom = getCustomCopy(item);
  if (custom?.description) {
    return custom.description;
  }

  const current = normalizeText(item.description ?? "");
  const near = nearbySentence(item);
  const narrative = sectionNarrative(item);
  const generated = [
    `${titleWithPlace(item)} - ${profile.short}`,
    [profile.description, near].filter(Boolean).join(" "),
  ].join("\n\n");
  const shouldUseNarrative =
    narrative &&
    (isProbablyTruncated(item.description) ||
      isGenericProfileText(current, item, profile) ||
      isBadNarrative(current) ||
      current.length < 180);

  if (shouldUseNarrative) {
    const paragraphs = [narrative];
    if (near && !narrative.includes(near)) {
      paragraphs.push(near);
    }
    return paragraphs.join("\n\n");
  }

  if (isGenericProfileText(current, item, profile)) {
    return generated;
  }

  if (isBadNarrative(current)) {
    return generated;
  }

  if (!current || isProbablyTruncated(item.description)) {
    return generated;
  }

  const hasSecondParagraph = current.includes("\n\n");
  const needsWarmth =
    current.length < 620 &&
    !/лучше|сюда|здесь|пройдитесь|обратите внимание|без спешки/i.test(current);
  const paragraphs = [current];

  if (!hasSecondParagraph && needsWarmth) {
    paragraphs.push([profile.description, near].filter(Boolean).join(" "));
  }

  return paragraphs.join("\n\n");
}

function buildDefaultSections(item, profile) {
  const near = nearbySentence(item);
  const sections = [
    {
      title: "Почему сюда едут",
      body: [profile.why],
    },
    {
      title: "Что посмотреть на месте",
      body: [profile.see],
    },
    {
      title: "Как спланировать визит",
      body: [profile.plan],
    },
  ];

  if (near) {
    sections.push({
      title: "Что посмотреть рядом",
      body: [near],
    });
  }

  return sections;
}

function cleanSectionTitle(title) {
  const normalized = normalizeText(title);
  const titleMap = new Map([
    ["Обзор", "Почему сюда едут"],
    ["История и особенности", "Чем интересно место"],
    ["Практическая информация", "Как спланировать визит"],
  ]);
  return titleMap.get(normalized) ?? normalized;
}

function cleanParagraph(value, item, profile) {
  const text = normalizeText(value);
  if (!text || isProbablyTruncated(value)) {
    return profile.description;
  }
  return text;
}

function cleanSections(item, profile) {
  const custom = getCustomCopy(item);
  const source = Array.isArray(item.sections) ? item.sections : [];
  const cleaned = source
    .map((section) => {
      const body = Array.isArray(section.body)
        ? section.body
            .map((paragraph) => cleanParagraph(paragraph, item, profile))
            .filter((paragraph) => paragraph.length > 0)
        : [];
      const list = Array.isArray(section.list)
        ? section.list.map((entry) => normalizeText(entry)).filter(Boolean)
        : undefined;

      return {
        ...section,
        title: cleanSectionTitle(section.title ?? ""),
        body,
        ...(list && list.length > 0 ? { list } : {}),
      };
    })
    .filter((section) => section.title && section.body.length > 0);

  if (custom?.sections) {
    const customTitles = new Set(custom.sections.map((section) => section.title));
    return [...custom.sections, ...cleaned.filter((section) => !customTitles.has(section.title))];
  }

  if (cleaned.length >= 3) {
    return cleaned;
  }

  return buildDefaultSections(item, profile);
}

function cleanFacts(item) {
  if (!Array.isArray(item.facts)) {
    return [];
  }
  return item.facts
    .map((fact) => ({
      label: normalizeText(fact.label ?? ""),
      value: normalizeText(fact.value ?? ""),
    }))
    .filter((fact) => fact.label && fact.value);
}

function cleanFaq(item, profile) {
  if (!Array.isArray(item.faq)) {
    return [];
  }
  return item.faq
    .map((faqItem) => ({
      question: normalizeText(faqItem.question ?? ""),
      answer: cleanParagraph(faqItem.answer ?? "", item, profile),
    }))
    .filter((faqItem) => faqItem.question && faqItem.answer);
}

function cleanMetaDescription(item, profile) {
  const current = normalizeText(item.metaDescription ?? "");
  if (!current) {
    return limitSentence(`${titleWithPlace(item)}: ${profile.short}`, 170);
  }
  return limitSentence(current, 180);
}

function normalizeAllDashes(value) {
  if (typeof value === "string") {
    return value.replace(/[—–]/g, "-");
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeAllDashes(entry));
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      value[key] = normalizeAllDashes(value[key]);
    }
  }
  return value;
}

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const stats = {
  changed: 0,
  generatedDescriptions: 0,
  cleanedSections: 0,
  cleanedFaq: 0,
};
const changedIds = [];

for (const [id, item] of Object.entries(data)) {
  const before = JSON.stringify(item);
  const profile = getProfile(item);
  const descriptionWasGenerated = !item.description || isProbablyTruncated(item.description);

  item.facts = cleanFacts(item);
  item.sections = cleanSections(item, profile);
  item.shortDescription = buildShortDescription(item, profile);
  item.description = buildDescription(item, profile);
  item.metaDescription = cleanMetaDescription(item, profile);
  item.faq = cleanFaq(item, profile);
  item.updatedAt = now;
  normalizeAllDashes(item);

  if (descriptionWasGenerated) {
    stats.generatedDescriptions += 1;
  }
  if (Array.isArray(item.sections)) {
    stats.cleanedSections += 1;
  }
  if (Array.isArray(item.faq) && item.faq.length > 0) {
    stats.cleanedFaq += 1;
  }
  if (before !== JSON.stringify(item)) {
    stats.changed += 1;
    changedIds.push(id);
  }

  data[id] = item;
}

if (!dryRun) {
  fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({ dryRun, ...stats, ...(listChanged ? { changedIds } : {}) }, null, 2));
