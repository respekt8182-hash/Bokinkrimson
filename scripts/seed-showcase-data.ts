import bcrypt from "bcryptjs";
import {
  BathroomType,
  ExcursionAvailabilityMode,
  ExcursionDifficulty,
  ExcursionFormat,
  ExcursionOfferType,
  ExcursionPriceType,
  ExcursionScheduleMode,
  ExcursionSessionStatus,
  ExcursionStatus,
  MediaType,
  PetsPolicy,
  Prisma,
  PropertyStatus,
  ReviewEntityType,
  ReviewStatus,
  SmokingPolicy,
} from "@prisma/client";
import { db } from "@/lib/db";

const now = new Date();
const currentYear = now.getUTCFullYear();

const CITY_MEDIA = {
  alupka: "/Foto/Alupka.webp",
  alushta: "/Foto/Alushta.webp",
  evpatoria: "/Foto/Yevpatoria.webp",
  kerch: "/Foto/Kerch.webp",
  sevastopol: "/Foto/Sevastopol.webp",
  sudak: "/Foto/Sudak.webp",
  feodosiya: "/Foto/Feodosia.webp",
  schelkino: "/Foto/Shchyolkino.webp",
  yalta: "/Foto/Yalta.webp",
};

const MULTI_ROOM_TYPES = new Set([
  "hotel",
  "hostel",
  "camping",
  "tour_base",
  "sanatorium",
  "guest_house",
]);

const CLASSIFICATION_TYPES = new Set([
  "hotel",
  "hostel",
  "camping",
  "tour_base",
  "sanatorium",
  "guest_house",
]);

const owners = [
  {
    key: "marina",
    phone: "+79990000001",
    firstName: "Марина",
    lastName: "Соколова",
    email: "marina.owner@example.test",
  },
  {
    key: "oleg",
    phone: "+79990000002",
    firstName: "Олег",
    lastName: "Журавлев",
    email: "oleg.owner@example.test",
  },
  {
    key: "irina",
    phone: "+79990000003",
    firstName: "Ирина",
    lastName: "Павлова",
    email: "irina.owner@example.test",
  },
  {
    key: "dmitriy",
    phone: "+79990000004",
    firstName: "Дмитрий",
    lastName: "Миронов",
    email: "dmitriy.owner@example.test",
  },
  {
    key: "anna",
    phone: "+79990000005",
    firstName: "Анна",
    lastName: "Лебедева",
    email: "anna.owner@example.test",
  },
  {
    key: "sergey",
    phone: "+79990000006",
    firstName: "Сергей",
    lastName: "Беликов",
    email: "sergey.owner@example.test",
  },
];

const reviewers = [
  ["elena", "+79990000101", "Елена", "Воронова"],
  ["ivan", "+79990000102", "Иван", "Киреев"],
  ["sveta", "+79990000103", "Светлана", "Лукина"],
  ["maksim", "+79990000104", "Максим", "Орлов"],
  ["natalya", "+79990000105", "Наталья", "Борисова"],
  ["andrey", "+79990000106", "Андрей", "Суханов"],
  ["olga", "+79990000107", "Ольга", "Семенова"],
  ["pavel", "+79990000108", "Павел", "Егоров"],
  ["ulia", "+79990000109", "Юлия", "Плотникова"],
  ["roman", "+79990000110", "Роман", "Коваленко"],
  ["ksenia", "+79990000111", "Ксения", "Якушева"],
  ["denis", "+79990000112", "Денис", "Грачев"],
  ["alisa", "+79990000113", "Алиса", "Тимофеева"],
  ["artem", "+79990000114", "Артем", "Шестаков"],
  ["vera", "+79990000115", "Вера", "Никитина"],
].map(([key, phone, firstName, lastName]) => ({
  key,
  phone,
  firstName,
  lastName,
  email: `${key}.reviewer@example.test`,
}));

const propertySeeds = [
  [
    "demo_property_01",
    "yalta",
    "guest_house",
    "marina",
    "Гостевой дом Южный Бриз",
    "Ялта, улица Дражинского, 12",
    "7 минут пешком до моря",
    5400,
    3,
    PetsPolicy.ON_REQUEST,
    true,
    "тихие вечера на террасе",
    ["wifi", "parking", "transfer", "room_cleaning"],
    ["терраса с лежаками", "кофе-зона на веранде"],
    ["view_sea", "air_conditioner", "balcony"],
  ],
  [
    "demo_property_02",
    "yalta",
    "apartment",
    "irina",
    "Апартаменты Маяк у Набережной",
    "Ялта, улица Игнатенко, 6",
    "3 минуты пешком до пляжа",
    6900,
    4,
    PetsPolicy.FORBIDDEN,
    true,
    "центр и прогулки без машины",
    ["wifi", "parking", "laundry"],
    ["панорамное окно", "рабочее место у окна"],
    ["view_city", "air_conditioner", "private_kitchen"],
  ],
  [
    "demo_property_03",
    "yalta",
    "hotel",
    "oleg",
    "Бутик-отель Глициния Хилл",
    "Ялта, улица Щербака, 21",
    "12 минут до Приморского пляжа",
    8200,
    4,
    PetsPolicy.ON_REQUEST,
    true,
    "сад и спокойный отельный сервис",
    ["wifi", "parking", "breakfast", "transfer"],
    ["винтажное лобби", "зеленый внутренний двор"],
    ["view_sea", "air_conditioner", "panoramic_windows"],
  ],
  [
    "demo_property_04",
    "sevastopol",
    "hotel",
    "sergey",
    "Отель Артиллерийская Бухта",
    "Севастополь, улица Ленина, 17",
    "10 минут до набережной",
    6100,
    3,
    PetsPolicy.FORBIDDEN,
    true,
    "городской темп и удобная логистика",
    ["wifi", "breakfast", "parking", "room_cleaning"],
    ["небольшой коворкинг", "вид на исторический центр"],
    ["view_city", "air_conditioner", "desk"],
  ],
  [
    "demo_property_05",
    "sevastopol",
    "apartment",
    "anna",
    "Апартаменты Панорама Херсонеса",
    "Севастополь, улица Древняя, 4",
    "8 минут до пляжа Солнечный",
    7300,
    4,
    PetsPolicy.ON_REQUEST,
    true,
    "просторное размещение для поездки на несколько дней",
    ["wifi", "parking", "laundry"],
    ["зона для чтения", "вид на закат"],
    ["private_kitchen", "washing_machine", "view_landmark"],
  ],
  [
    "demo_property_06",
    "sevastopol",
    "guest_house",
    "dmitriy",
    "Гостевой дом Балаклавский Рейд",
    "Севастополь, Балаклава, улица Крестовского, 9",
    "5 минут до бухты",
    5600,
    3,
    PetsPolicy.ON_REQUEST,
    true,
    "морская атмосфера и спокойный вечер",
    ["wifi", "parking", "breakfast", "transfer"],
    ["виноградная беседка", "панорама бухты"],
    ["view_landmark", "balcony", "air_conditioner"],
  ],
  [
    "demo_property_07",
    "alushta",
    "guest_house",
    "anna",
    "Гостевой дом Кипарисовая Аллея",
    "Алушта, улица Горького, 18",
    "9 минут до набережной",
    4700,
    3,
    PetsPolicy.ON_REQUEST,
    true,
    "зеленый двор и размеренный семейный отдых",
    ["wifi", "parking", "breakfast", "playground"],
    ["двор с кипарисами", "вечерний чай на веранде"],
    ["view_mountain", "air_conditioner", "balcony"],
  ],
  [
    "demo_property_08",
    "alushta",
    "apartment",
    "marina",
    "Апартаменты Утро у Демерджи",
    "Алушта, улица Ленина, 35",
    "11 минут до моря",
    6400,
    4,
    PetsPolicy.FORBIDDEN,
    true,
    "вид на горы и тихий двор",
    ["wifi", "parking", "laundry"],
    ["мини-библиотека", "уютная лоджия"],
    ["view_mountain", "private_kitchen", "washing_machine"],
  ],
  [
    "demo_property_09",
    "alupka",
    "hotel",
    "oleg",
    "Мини-отель Воронцовский Сад",
    "Алупка, улица Фрунзе, 3",
    "6 минут до пляжа и парка",
    5900,
    3,
    PetsPolicy.FORBIDDEN,
    true,
    "прогулки к парку и дворцам",
    ["wifi", "breakfast", "parking", "room_cleaning"],
    ["сад с инжиром", "тихая веранда"],
    ["view_mountain", "air_conditioner", "balcony"],
  ],
  [
    "demo_property_10",
    "alupka",
    "private_sector",
    "irina",
    "Домики Ай-Петри View",
    "Алупка, улица Ленина, 41",
    "14 минут до моря",
    5200,
    2,
    PetsPolicy.ALLOWED,
    true,
    "домашний формат и вид на вершины",
    ["wifi", "shared_kitchen", "parking"],
    ["мангал", "площадка для вечернего чая"],
    ["view_mountain", "private_entrance", "balcony"],
  ],
  [
    "demo_property_11",
    "evpatoria",
    "sanatorium",
    "sergey",
    "Санаторий Лазурный Берег",
    "Евпатория, улица Киевская, 60",
    "4 минуты до песчаного пляжа",
    7600,
    4,
    PetsPolicy.FORBIDDEN,
    true,
    "просторная территория и курортный формат",
    ["wifi", "parking", "full_board", "pool", "playground"],
    ["лечебные программы", "песчаный пляж"],
    ["view_sea", "air_conditioner", "safe"],
  ],
  [
    "demo_property_12",
    "evpatoria",
    "guest_house",
    "dmitriy",
    "Гостевой дом Песчаная Линия",
    "Евпатория, улица Симферопольская, 28",
    "5 минут до пляжа",
    4500,
    3,
    PetsPolicy.ON_REQUEST,
    true,
    "семейный сценарий у моря",
    ["wifi", "parking", "breakfast", "playground"],
    ["летняя веранда", "душ для пляжных вещей"],
    ["balcony", "air_conditioner", "view_courtyard"],
  ],
  [
    "demo_property_13",
    "sudak",
    "guest_house",
    "anna",
    "Гостевой дом Крепостной Склон",
    "Судак, улица Морская, 14",
    "8 минут до набережной",
    5000,
    3,
    PetsPolicy.ON_REQUEST,
    true,
    "вид на крепость и вечерние прогулки",
    ["wifi", "parking", "breakfast", "transfer"],
    ["летний киносеанс во дворе", "просторная терраса"],
    ["view_landmark", "balcony", "air_conditioner"],
  ],
  [
    "demo_property_14",
    "sudak",
    "house",
    "oleg",
    "Дом Солнечная Долина",
    "Судак, улица Айвазовского, 33",
    "15 минут до моря",
    8700,
    4,
    PetsPolicy.ALLOWED,
    true,
    "отдельный дом для семьи или компании",
    ["wifi", "parking", "laundry"],
    ["зона барбекю", "сад с виноградом"],
    ["private_entrance", "private_kitchen", "washing_machine"],
  ],
  [
    "demo_property_15",
    "feodosiya",
    "hotel",
    "marina",
    "Отель Айвазовский Причал",
    "Феодосия, проспект Айвазовского, 7",
    "2 минуты до набережной",
    6300,
    3,
    PetsPolicy.FORBIDDEN,
    true,
    "короткие остановки у моря и центра",
    ["wifi", "breakfast", "parking", "room_cleaning"],
    ["вид на набережную", "кофейный бар"],
    ["view_embankment", "air_conditioner", "tv"],
  ],
  [
    "demo_property_16",
    "feodosiya",
    "apartment",
    "irina",
    "Апартаменты Галерея Моря",
    "Феодосия, улица Земская, 10",
    "6 минут до пляжа",
    6100,
    4,
    PetsPolicy.ON_REQUEST,
    true,
    "современный городской формат без гостиничной суеты",
    ["wifi", "laundry", "parking"],
    ["станция для ноутбука", "проектор для кино"],
    ["private_kitchen", "washing_machine", "view_city"],
  ],
  [
    "demo_property_17",
    "kerch",
    "guest_house",
    "sergey",
    "Гостевой дом Керченская Волна",
    "Керчь, улица Свердлова, 22",
    "10 минут до набережной",
    4300,
    3,
    PetsPolicy.ON_REQUEST,
    true,
    "подходит для автопутешественников и коротких остановок",
    ["wifi", "parking", "breakfast"],
    ["чайная веранда", "место для хранения сапбордов"],
    ["view_city", "air_conditioner", "balcony"],
  ],
  [
    "demo_property_18",
    "kerch",
    "house",
    "dmitriy",
    "Дом Боспорский Двор",
    "Керчь, улица Айвазовского, 51",
    "12 минут до моря",
    7800,
    4,
    PetsPolicy.ALLOWED,
    true,
    "приватный двор и семейный формат",
    ["wifi", "parking", "laundry"],
    ["внутренний двор", "зона для семейных ужинов"],
    ["private_entrance", "private_kitchen", "washing_machine"],
  ],
  [
    "demo_property_19",
    "schelkino",
    "tour_base",
    "anna",
    "Турбаза Азовский Ветер",
    "Щёлкино, улица Приморская, 8",
    "4 минуты до Азовского моря",
    3900,
    2,
    PetsPolicy.ON_REQUEST,
    true,
    "летний активный отдых и простая инфраструктура",
    ["wifi", "parking", "breakfast", "playground"],
    ["зона для сапов", "вечерний костер"],
    ["private_entrance", "view_sea", "fan"],
  ],
  [
    "demo_property_20",
    "schelkino",
    "apartment",
    "oleg",
    "Апартаменты Тёплый Азов",
    "Щёлкино, 3-й микрорайон, 15",
    "6 минут до пляжа",
    4800,
    3,
    PetsPolicy.ON_REQUEST,
    true,
    "спокойный формат рядом с азовским пляжем",
    ["wifi", "parking", "laundry"],
    ["лоджия с креслами", "небольшая библиотека"],
    ["partial_sea_view", "private_kitchen", "air_conditioner"],
  ],
].map(
  ([
    id,
    city,
    type,
    ownerKey,
    name,
    address,
    seaDistance,
    basePrice,
    starRating,
    petsPolicy,
    childrenAllowed,
    mood,
    amenityIds,
    customAmenities,
    keyFeatureIds,
  ]) => ({
    id,
    city,
    type,
    ownerKey,
    name,
    address,
    seaDistance,
    basePrice,
    starRating,
    petsPolicy,
    childrenAllowed,
    mood,
    amenityIds,
    customAmenities,
    keyFeatureIds,
  }),
);

const excursionSeeds = [
  [
    "demo_excursion_01",
    "marina",
    "Вечерняя Ялта и Ласточкино гнездо",
    "yalta",
    ["yalta", "alupka"],
    ["yalta", "alupka"],
    "cat_history",
    "Автомобильная",
    300,
    2400,
    3200,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "вечерние панорамы и короткие переезды",
    ["обзорная", "закат", "история"],
  ],
  [
    "demo_excursion_02",
    "oleg",
    "Ай-Петри без очередей: рассветный выезд",
    "alupka",
    ["alupka", "yalta"],
    ["yalta", "alupka"],
    "cat_mountains",
    "Авторская",
    360,
    3100,
    3900,
    ExcursionFormat.PRIVATE,
    ExcursionDifficulty.MEDIUM,
    "рассветные виды и мягкий треккинг",
    ["горы", "рассвет", "фото"],
  ],
  [
    "demo_excursion_03",
    "irina",
    "Винная тропа Алушты с дегустацией",
    "alushta",
    ["alushta", "yalta"],
    ["alushta"],
    "cat_wine",
    "Гастрономическая",
    330,
    2800,
    3600,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "гастро-паузы и виды Южного берега",
    ["вино", "гастро", "южный берег"],
  ],
  [
    "demo_excursion_04",
    "sergey",
    "Севастополь морской: катер и береговые батареи",
    "sevastopol",
    ["sevastopol"],
    ["sevastopol"],
    "cat_history",
    "Морская",
    270,
    2300,
    2900,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "морская история и вид на город с воды",
    ["море", "история", "севастополь"],
  ],
  [
    "demo_excursion_05",
    "dmitriy",
    "Балаклава на закате и ужин у бухты",
    "sevastopol",
    ["sevastopol"],
    ["sevastopol"],
    "cat_photo",
    "Вечерняя",
    240,
    2600,
    3200,
    ExcursionFormat.PRIVATE,
    ExcursionDifficulty.EASY,
    "вечерние огни и фототочки у бухты",
    ["закат", "фото", "балаклава"],
  ],
  [
    "demo_excursion_06",
    "anna",
    "Песчаная Евпатория для всей семьи",
    "evpatoria",
    ["evpatoria"],
    ["evpatoria"],
    "cat_family",
    "Семейная",
    210,
    1700,
    2200,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "спокойная прогулка и задания для детей",
    ["семья", "дети", "прогулка"],
  ],
  [
    "demo_excursion_07",
    "oleg",
    "Генуэзская крепость и винные виды Судака",
    "sudak",
    ["sudak", "feodosiya"],
    ["sudak"],
    "cat_history",
    "Обзорная",
    300,
    2200,
    2900,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "крепость, бухта и видовые остановки",
    ["крепость", "обзорная", "судак"],
  ],
  [
    "demo_excursion_08",
    "irina",
    "Феодосия художников и набережных историй",
    "feodosiya",
    ["feodosiya"],
    ["feodosiya"],
    "cat_history",
    "Пешеходная",
    180,
    1500,
    2100,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "город художников и прогулка у моря",
    ["искусство", "город", "море"],
  ],
  [
    "demo_excursion_09",
    "sergey",
    "Керчь античная и современная",
    "kerch",
    ["kerch"],
    ["kerch"],
    "cat_history",
    "Авторская",
    240,
    1800,
    2500,
    ExcursionFormat.PRIVATE,
    ExcursionDifficulty.EASY,
    "античный слой города и панорамные точки",
    ["античность", "керчь", "виды"],
  ],
  [
    "demo_excursion_10",
    "anna",
    "Азовский ветер: кайт-споты Щёлкино",
    "schelkino",
    ["schelkino", "kerch"],
    ["schelkino"],
    "cat_photo",
    "Активная",
    260,
    2100,
    2800,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.MEDIUM,
    "ветер, просторные пляжи и активный формат",
    ["азов", "актив", "фото"],
  ],
  [
    "demo_excursion_11",
    "dmitriy",
    "Морская рыбалка у берегов Евпатории",
    "evpatoria",
    ["evpatoria"],
    ["evpatoria"],
    "cat_sea",
    "Морская",
    240,
    3500,
    4200,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "катер, море и простой сценарий для новичков",
    ["море", "рыбалка", "катер"],
  ],
  [
    "demo_excursion_12",
    "marina",
    "Фото-утро на набережной Ялты",
    "yalta",
    ["yalta"],
    ["yalta"],
    "cat_photo",
    "Фото-прогулка",
    150,
    1900,
    2600,
    ExcursionFormat.PRIVATE,
    ExcursionDifficulty.EASY,
    "пустая набережная и красивый утренний свет",
    ["фото", "утро", "ялта"],
  ],
].map(
  ([
    id,
    ownerKey,
    title,
    city,
    route,
    pickup,
    categoryId,
    subtypeLabel,
    durationMinutes,
    priceFrom,
    priceTo,
    format,
    difficulty,
    vibe,
    tags,
  ]) => ({
    id,
    ownerKey,
    title,
    city,
    route,
    pickup,
    categoryId,
    subtypeLabel,
    durationMinutes,
    priceFrom,
    priceTo,
    format,
    difficulty,
    vibe,
    tags,
    offerType: ExcursionOfferType.EXCURSION,
  }),
);

const tourSeeds = [
  [
    "demo_tour_01",
    "marina",
    "Южнобережный уикенд: Ялта, Ай-Петри и Алупка",
    "yalta",
    ["yalta", "alupka"],
    ["yalta"],
    "cat_mountains",
    "Уикенд",
    3,
    2,
    16900,
    19900,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "мягкий южнобережный маршрут с проживанием",
    "WEEKEND",
    ["BUS", "WALKING"],
    ["уикенд", "южный берег", "панорамы"],
  ],
  [
    "demo_tour_02",
    "oleg",
    "Винный маршрут Восточного Крыма",
    "sudak",
    ["sudak", "feodosiya", "kerch"],
    ["sudak", "feodosiya"],
    "cat_wine",
    "Гастро-тур",
    4,
    3,
    23800,
    27900,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "дегустации и морские виды восточного побережья",
    "MULTI_DAY",
    ["BUS", "WALKING"],
    ["вино", "гастро", "восточный крым"],
  ],
  [
    "demo_tour_03",
    "sergey",
    "Морские ворота Севастополя и Балаклавы",
    "sevastopol",
    ["sevastopol"],
    ["sevastopol"],
    "cat_history",
    "Авторский",
    2,
    1,
    12900,
    14900,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "город, бухта и короткий тур с ночевкой",
    "ONE_DAY",
    ["BUS", "BOAT", "WALKING"],
    ["город", "море", "севастополь"],
  ],
  [
    "demo_tour_04",
    "anna",
    "Семейный тур по Евпатории и песчаным пляжам",
    "evpatoria",
    ["evpatoria"],
    ["evpatoria"],
    "cat_family",
    "Семейный",
    3,
    2,
    15400,
    18700,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "песчаные пляжи и спокойный семейный ритм",
    "WEEKEND",
    ["BUS", "WALKING"],
    ["семья", "дети", "пляж"],
  ],
  [
    "demo_tour_05",
    "dmitriy",
    "Джип-тур по пещерным городам Крыма",
    "sevastopol",
    ["sevastopol", "alushta"],
    ["sevastopol"],
    "cat_jeep",
    "Джип-тур",
    2,
    1,
    18900,
    22900,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.MEDIUM,
    "внедорожники, скалы и насыщенный актив",
    "JEEP",
    ["JEEP", "WALKING"],
    ["джип", "горы", "актив"],
  ],
  [
    "demo_tour_06",
    "irina",
    "Фото-тур по рассветам Южного берега",
    "yalta",
    ["yalta", "alupka", "alushta"],
    ["yalta", "alushta"],
    "cat_photo",
    "Фото-тур",
    3,
    2,
    17600,
    21400,
    ExcursionFormat.PRIVATE,
    ExcursionDifficulty.EASY,
    "ранние выезды и лучший свет для кадров",
    "MULTI_DAY",
    ["CAR", "WALKING"],
    ["фото", "рассвет", "авторский"],
  ],
  [
    "demo_tour_07",
    "sergey",
    "Античная Керчь и Азовское побережье",
    "kerch",
    ["kerch", "schelkino"],
    ["kerch"],
    "cat_history",
    "Исторический",
    3,
    2,
    16200,
    19300,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "археология, история и просторные азовские линии",
    "MULTI_DAY",
    ["BUS", "WALKING"],
    ["керчь", "история", "азов"],
  ],
  [
    "demo_tour_08",
    "anna",
    "Морской weekend в Балаклаве",
    "sevastopol",
    ["sevastopol"],
    ["sevastopol"],
    "cat_sea",
    "Морской",
    2,
    1,
    14800,
    17100,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "катер, бухта и короткая перезагрузка у воды",
    "BOAT",
    ["BOAT", "WALKING"],
    ["море", "weekend", "балаклава"],
  ],
  [
    "demo_tour_09",
    "oleg",
    "Пеший трек по водопадам и каньонам",
    "alushta",
    ["alushta", "yalta"],
    ["alushta"],
    "cat_mountains",
    "Треккинг",
    2,
    1,
    14100,
    16800,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.MEDIUM,
    "походный уикенд с природными локациями",
    "HIKING",
    ["BUS", "WALKING"],
    ["поход", "горы", "водопады"],
  ],
  [
    "demo_tour_10",
    "irina",
    "Гастро-тур Ялта - Алушта - Судак",
    "yalta",
    ["yalta", "alushta", "sudak"],
    ["yalta", "alushta"],
    "cat_wine",
    "Гастрономический",
    4,
    3,
    24900,
    28900,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "гастро-маршрут по двум берегам Крыма",
    "MULTI_DAY",
    ["BUS", "WALKING"],
    ["гастро", "вино", "маршрут"],
  ],
  [
    "demo_tour_11",
    "dmitriy",
    "Азовский семейный отдых в Щёлкино",
    "schelkino",
    ["schelkino", "kerch"],
    ["schelkino"],
    "cat_family",
    "Семейный",
    3,
    2,
    13200,
    15800,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "пляж, короткие прогулки и проживание рядом с морем",
    "WEEKEND",
    ["BUS", "WALKING"],
    ["семья", "азов", "пляж"],
  ],
  [
    "demo_tour_12",
    "marina",
    "Судак и Феодосия: крепости, галереи, море",
    "sudak",
    ["sudak", "feodosiya"],
    ["sudak", "feodosiya"],
    "cat_history",
    "Культурный",
    3,
    2,
    15800,
    18900,
    ExcursionFormat.GROUP,
    ExcursionDifficulty.EASY,
    "история, искусство и море восточного побережья",
    "MULTI_DAY",
    ["BUS", "WALKING"],
    ["история", "искусство", "восточное побережье"],
  ],
].map(
  ([
    id,
    ownerKey,
    title,
    city,
    route,
    pickup,
    categoryId,
    subtypeLabel,
    durationDays,
    durationNights,
    priceFrom,
    priceTo,
    format,
    difficulty,
    vibe,
    tourKind,
    transportModes,
    tags,
  ]) => ({
    id,
    ownerKey,
    title,
    city,
    route,
    pickup,
    categoryId,
    subtypeLabel,
    durationDays,
    durationNights,
    priceFrom,
    priceTo,
    format,
    difficulty,
    vibe,
    tourKind,
    transportModes,
    tags,
    offerType: ExcursionOfferType.TOUR,
  }),
);

const reviewTextPool = [
  "Брали для короткого отдыха и в итоге остались еще на день. Все выглядело аккуратно, описание совпало, общение было быстрым и без суеты.",
  "Хороший тестовый вариант для витрины: карточка выглядит живо, фото пусть и простые, но по описанию сразу понятно, чего ожидать.",
  "Понравилась коммуникация и то, что быстро ответили в мессенджере. По месту все было спокойно, без неприятных сюрпризов.",
  "Маршрут оказался комфортнее, чем ожидали. Было достаточно времени и на прогулку, и на фото, и на небольшой отдых по пути.",
  "Для семьи формат удобный: ничего лишнего, понятная логистика, нормальный темп.",
  "Брали скорее для проверки сайта, но сама карточка и наполнение воспринимаются уже как полноценное предложение.",
];

const ownerReplyPool = [
  "Спасибо за отзыв. Для нас было важно сделать понятную карточку и удобную коммуникацию.",
  "Благодарим за обратную связь. Постепенно дополняем детали, чтобы карточка смотрелась максимально живо.",
  "Спасибо, что отметили описание и контакт. Именно такого эффекта и добиваемся в наполнении витрины.",
];

const propertyFaqItems = [
  {
    q: "Можно ли заселиться поздно вечером?",
    a: "Да, поздний заезд возможен по согласованию. После брони отправим инструкцию и контакт менеджера.",
  },
  {
    q: "Есть ли рядом магазины и кафе?",
    a: "Да, рядом есть кафе, продуктовые магазины и сезонные точки питания.",
  },
  {
    q: "Подходит ли вариант для поездки на машине?",
    a: "Да, в карточке указана парковка или удобный подъезд, чтобы заранее оценить логистику.",
  },
];

const excursionFaqItems = [
  {
    q: "Нужна ли специальная подготовка?",
    a: "Для большинства программ нет. Если маршрут активный, это отдельно указано в карточке.",
  },
  {
    q: "Можно ли поехать с детьми?",
    a: "Да, спокойные и семейные маршруты подходят для поездки с детьми. Возрастные ограничения указываем заранее.",
  },
  {
    q: "Как происходит подтверждение после заявки?",
    a: "Организатор связывается по телефону или в мессенджере и подтверждает детали, время сбора и точку встречи.",
  },
];

const userByKey = new Map();

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function dateWithMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function mimeTypeFromUrl(url: string) {
  return url.endsWith(".png") ? "image/png" : "image/webp";
}

function mediaFileNameFromUrl(url: string) {
  const parts = url.split("/");
  return parts[parts.length - 1] ?? "demo.webp";
}

function createMediaRecords(ownerType: string, entityId: string, urls: string[]) {
  return urls.map((url, index) => ({
    id: `${entityId}_media_${index + 1}`,
    type: MediaType.IMAGE,
    url,
    storageKey: `demo/${ownerType}/${entityId}/${index + 1}-${mediaFileNameFromUrl(url)}`,
    mimeType: mimeTypeFromUrl(url),
    fileSize: 150_000 + index * 5_000,
    originalName: mediaFileNameFromUrl(url),
    sortOrder: index + 1,
  }));
}

function getCityMedia(city: keyof typeof CITY_MEDIA) {
  const primary = CITY_MEDIA[city] ?? CITY_MEDIA.yalta;
  return [primary, primary, primary];
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlStringArray(values) {
  if (!values || values.length === 0) {
    return "ARRAY[]::TEXT[]";
  }

  return `ARRAY[${values.map((value) => sqlQuote(value)).join(", ")}]::TEXT[]`;
}

const ENUM_DB_VALUES = {
  PetsPolicy: {
    FORBIDDEN: "forbidden",
    ON_REQUEST: "on_request",
    ALLOWED: "allowed",
  },
  SmokingPolicy: {
    FORBIDDEN: "forbidden",
    ON_REQUEST: "on_request",
    ALLOWED: "allowed",
  },
  PropertyStatus: {
    DRAFT: "draft",
    PENDING_MODERATION: "pending_moderation",
    PUBLISHED: "published",
    REJECTED: "rejected",
  },
  ExcursionStatus: {
    DRAFT: "draft",
    PENDING_MODERATION: "pending_moderation",
    PUBLISHED: "published",
    NEEDS_FIX: "needs_fix",
    REJECTED: "rejected",
  },
  ExcursionOfferType: {
    EXCURSION: "excursion",
    TOUR: "tour",
  },
  ExcursionPriceType: {
    PER_PERSON: "per_person",
    PER_GROUP: "per_group",
  },
  ExcursionDifficulty: {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard",
  },
  ExcursionScheduleMode: {
    TEXT: "text",
    RULES: "rules",
    SESSIONS: "sessions",
  },
  ExcursionAvailabilityMode: {
    REGULAR: "regular",
    DATED: "dated",
    ON_REQUEST: "on_request",
  },
  ExcursionFormat: {
    GROUP: "group",
    PRIVATE: "private",
    INDIVIDUAL: "individual",
    VIP: "vip",
  },
} satisfies Record<string, Record<string, string>>;

function sqlValue(value, typeHint) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeHint === "json") {
    return `${sqlQuote(JSON.stringify(value))}::jsonb`;
  }

  if (typeHint === "string[]") {
    return sqlStringArray(value);
  }

  if (typeHint) {
    const mappedValue = ENUM_DB_VALUES[typeHint]?.[String(value)] ?? value;
    return `${sqlQuote(mappedValue)}::"${typeHint}"`;
  }

  if (value instanceof Date) {
    return `${sqlQuote(value.toISOString())}::timestamptz`;
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  return sqlQuote(value);
}

function buildInsertSql(tableName, row, typeHints = {}) {
  const entries = Object.entries(row);
  const columns = entries.map(([key]) => `"${key}"`).join(", ");
  const values = entries.map(([key, value]) => sqlValue(value, typeHints[key])).join(", ");
  return `INSERT INTO "public"."${tableName}" (${columns}) VALUES (${values})`;
}

function buildContactBundle(seed, owner) {
  const baseLabel = seed.name ?? seed.title ?? "demo";
  const slugBase = baseLabel
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return {
    phone: owner.phone,
    phoneName: owner.firstName,
    phone2: `+7 978 600 ${String(((seed.id.length * 7) % 90) + 10).padStart(2, "0")} ${String(
      seed.id.length * 13,
    ).padStart(2, "0")}`,
    phone2Name: "Ресепшен",
    phone3: `+7 978 700 ${String(((seed.id.length * 9) % 90) + 10).padStart(2, "0")} ${String(
      seed.id.length * 17,
    ).padStart(2, "0")}`,
    phone3Name: "Бронирование",
    websiteUrl: null,
    contactEmail: `${seed.city}-${slugBase || "demo"}@example.test`,
    whatsappUrl: `https://wa.me/79${owner.phone.replace(/\D/g, "").slice(-9)}`,
    telegramUrl: null,
    vkUrl: null,
    maxUrl: null,
    okUrl: null,
  };
}

function getPropertyRoomFeatureIds(seed) {
  const common = MULTI_ROOM_TYPES.has(seed.type)
    ? ["tv", "wifi", "refrigerator", "kettle", "private_bathroom", "hair_dryer"]
    : ["tv", "wifi", "refrigerator", "kettle", "private_bathroom"];

  if (seed.type === "apartment" || seed.type === "house") {
    common.push("private_kitchen", "washing_machine");
  }

  if (seed.type === "private_sector" || seed.type === "tour_base") {
    common.push("private_entrance");
  }

  return Array.from(new Set([...common, ...seed.keyFeatureIds]));
}

function buildPropertyDescription(seed, cityName) {
  const typeLabel =
    seed.type === "apartment"
      ? "апартаментов"
      : seed.type === "house"
        ? "дома"
        : seed.type === "private_sector"
          ? "частного размещения"
          : "объекта";

  return `Тестовая карточка ${typeLabel} в ${cityName.toLowerCase()} для оценки наполненного каталога. Внутри акцент на ${seed.mood}, понятные контакты, отзывы и базовую структуру контента без пустых блоков.`;
}

function buildPropertyRooms(seed, propertyIndex, imageUrls) {
  const isMultiRoom = MULTI_ROOM_TYPES.has(seed.type);
  const roomFeatureIds = getPropertyRoomFeatureIds(seed);
  const customFeatures = ["чайный набор", "плотные шторы"];
  if (seed.type === "house" || seed.type === "apartment") {
    customFeatures.push("полный набор посуды");
  }

  const seasonStart = startOfUtcDay(now);
  const autumnStart = dateUtc(currentYear, 10, 1);
  const nextSpring = dateUtc(currentYear + 1, 4, 1);

  if (!isMultiRoom) {
    const roomId = `${seed.id}_room_1`;
    return [
      {
        id: roomId,
        title: seed.type === "house" ? "Дом целиком" : "Апартаменты целиком",
        beds: seed.type === "house" ? 4 : 2,
        extraBeds: seed.type === "house" ? 2 : 1,
        roomsCount: seed.type === "house" ? 4 : 2,
        areaSqm: seed.type === "house" ? 82 : 44,
        bathroomType: BathroomType.IN_ROOM,
        featureIds: roomFeatureIds,
        customFeatures,
        media: createMediaRecords("rooms", roomId, imageUrls.slice(0, 2)),
        prices: [
          {
            id: `${roomId}_price_1`,
            dateFrom: seasonStart,
            dateTo: addDays(autumnStart, -1),
            price: seed.basePrice,
            minGuests: 1,
            currency: "RUB",
          },
          {
            id: `${roomId}_price_2`,
            dateFrom: autumnStart,
            dateTo: addDays(nextSpring, -1),
            price: Math.max(2800, seed.basePrice - 700),
            minGuests: 1,
            currency: "RUB",
          },
        ],
      },
    ];
  }

  return [
    {
      id: `${seed.id}_room_1`,
      title: "Стандарт с балконом",
      beds: 2,
      extraBeds: 1,
      roomsCount: 1,
      areaSqm: 22,
      bathroomType: BathroomType.IN_ROOM,
      featureIds: roomFeatureIds,
      customFeatures,
      media: createMediaRecords("rooms", `${seed.id}_room_1`, imageUrls.slice(0, 2)),
      prices: [
        {
          id: `${seed.id}_room_1_price_1`,
          dateFrom: seasonStart,
          dateTo: addDays(autumnStart, -1),
          price: seed.basePrice,
          minGuests: 1,
          currency: "RUB",
        },
        {
          id: `${seed.id}_room_1_price_2`,
          dateFrom: autumnStart,
          dateTo: addDays(nextSpring, -1),
          price: Math.max(2600, seed.basePrice - 900),
          minGuests: 1,
          currency: "RUB",
        },
      ],
    },
    {
      id: `${seed.id}_room_2`,
      title: "Семейный номер",
      beds: 3,
      extraBeds: 2,
      roomsCount: 2,
      areaSqm: 32,
      bathroomType: BathroomType.IN_ROOM,
      featureIds: roomFeatureIds,
      customFeatures: [...customFeatures, "дополнительный шкаф"],
      media: createMediaRecords("rooms", `${seed.id}_room_2`, [imageUrls[2], imageUrls[1]]),
      prices: [
        {
          id: `${seed.id}_room_2_price_1`,
          dateFrom: seasonStart,
          dateTo: addDays(autumnStart, -1),
          price: seed.basePrice + 1200 + (propertyIndex % 4) * 150,
          minGuests: 2,
          currency: "RUB",
        },
        {
          id: `${seed.id}_room_2_price_2`,
          dateFrom: autumnStart,
          dateTo: addDays(nextSpring, -1),
          price: seed.basePrice + 400,
          minGuests: 2,
          currency: "RUB",
        },
      ],
    },
  ];
}

function buildPropertyPayload(seed, cityRow, owner, index) {
  const imageUrls = getCityMedia(seed.city);
  const contact = buildContactBundle(seed, owner);
  const rooms = buildPropertyRooms(seed, index, imageUrls);

  return {
    id: seed.id,
    ownerId: owner.id,
    type: seed.type,
    locationId: seed.city,
    locationName: cityRow.name,
    name: seed.name,
    address: seed.address,
    seaDistance: seed.seaDistance,
    latitude: roundToSingleDecimal(Number(cityRow.latitude) + index * 0.0011),
    longitude: roundToSingleDecimal(Number(cityRow.longitude) + index * 0.001),
    phone: contact.phone,
    phoneName: contact.phoneName,
    phone2: contact.phone2,
    phone2Name: contact.phone2Name,
    phone3: contact.phone3,
    phone3Name: contact.phone3Name,
    websiteUrl: contact.websiteUrl,
    contactEmail: contact.contactEmail,
    contactPersonName: `${owner.firstName} ${owner.lastName}`,
    contactPersonRole: "управляющий",
    whatsappUrl: contact.whatsappUrl,
    telegramUrl: contact.telegramUrl,
    vkUrl: contact.vkUrl,
    maxUrl: contact.maxUrl,
    okUrl: contact.okUrl,
    receiveRequests: true,
    showEmail: index % 2 === 0,
    description: buildPropertyDescription(seed, cityRow.name),
    faqItems: propertyFaqItems,
    checkInFrom: "14:00",
    checkOutUntil: "12:00",
    childrenAllowed: seed.childrenAllowed,
    childrenMinAge: seed.childrenAllowed ? (index % 3 === 0 ? 0 : 5) : null,
    petsPolicy: seed.petsPolicy,
    smokingPolicy: SmokingPolicy.FORBIDDEN,
    quietHoursEnabled: true,
    quietHoursFrom: "23:00",
    quietHoursTo: "08:00",
    parkingInfo: "Парковка указана в описании, место подтверждаем после заявки.",
    mealOptions:
      seed.type === "apartment" || seed.type === "house"
        ? "Самостоятельное питание, кухня укомплектована."
        : "Завтрак или чайная станция доступны по формату объекта.",
    prepaymentPolicy: "Предоплата 15% для фиксации дат. Остаток при заселении.",
    classificationApplicable: CLASSIFICATION_TYPES.has(seed.type),
    starRating: seed.starRating,
    registryNumber: CLASSIFICATION_TYPES.has(seed.type)
      ? `KR-${index + 101}-${String(index + 11).padStart(3, "0")}`
      : null,
    registryDetails: CLASSIFICATION_TYPES.has(seed.type)
      ? "Тестовая карточка для визуальной оценки наполненного каталога."
      : null,
    status: PropertyStatus.PUBLISHED,
    isPublishedVisible: true,
    createdAt: addDays(now, -45 - index * 3),
    media: createMediaRecords("properties", seed.id, imageUrls),
    amenityIds: seed.amenityIds,
    customAmenities: seed.customAmenities,
    keyFeatureIds: seed.keyFeatureIds,
    rooms,
    favoritesCount: 3 + (index % 6),
    profileViews: 25 + index * 8,
  };
}

function buildTimeline(routeNames, isTour) {
  const first = routeNames[0] ?? "точка встречи";
  const second = routeNames[1] ?? first;
  const last = routeNames[routeNames.length - 1] ?? first;

  return [
    {
      step: 1,
      time: isTour ? "09:00" : "10:00",
      duration: "30 мин",
      title: "Сбор и вводная часть",
      description: "Встречаемся, знакомимся с программой и согласуем темп маршрута.",
      location: first,
      icon: "meeting_point",
    },
    {
      step: 2,
      time: isTour ? "10:00" : "10:40",
      duration: isTour ? "2 ч" : "1.5 ч",
      title: "Основной маршрут",
      description: "Проходим ключевые точки программы и делаем видовые остановки.",
      location: second,
      icon: isTour ? "bus" : "sightseeing",
    },
    {
      step: 3,
      time: isTour ? "13:00" : "12:20",
      duration: "1 ч",
      title: "Пауза и свободное время",
      description: "Время на фото, кофе и небольшую передышку в комфортном темпе.",
      location: second,
      icon: "free_time",
    },
    {
      step: 4,
      time: isTour ? "17:30" : "14:00",
      duration: "30 мин",
      title: isTour ? "Завершение дня" : "Финиш маршрута",
      description: "Подводим итоги, отвечаем на вопросы и рекомендуем, куда пойти дальше.",
      location: last,
      icon: "finish",
    },
  ];
}

function buildPricingTiers(seed) {
  if (seed.offerType === ExcursionOfferType.TOUR) {
    return [
      { label: "Взрослый", code: "adult", price: seed.priceFrom, currency: "RUB", isDefault: true },
      {
        label: "Ребенок 6-12",
        code: "child",
        price: Math.max(1000, seed.priceFrom - 1800),
        currency: "RUB",
      },
      {
        label: "Одноместное размещение",
        code: "single",
        price: seed.priceTo + 2600,
        currency: "RUB",
      },
    ];
  }

  return [
    { label: "Взрослый", code: "adult", price: seed.priceFrom, currency: "RUB", isDefault: true },
    {
      label: "Ребенок 7-12",
      code: "child",
      price: Math.max(900, seed.priceFrom - 600),
      currency: "RUB",
    },
  ];
}

function buildExtraOptions(seed) {
  return seed.offerType === ExcursionOfferType.TOUR
    ? [
        {
          title: "Одноместное размещение",
          description: "Если не хотите подселение в стандартных турах.",
          included: false,
          price: 2600,
        },
        {
          title: "Фото-пакет маршрута",
          description: "Подборка кадров и короткий ролик после поездки.",
          included: false,
          price: 1800,
        },
      ]
    : [
        {
          title: "Индивидуальный формат",
          description: "Можно закрыть маршрут только под вашу компанию.",
          included: false,
          price: seed.priceTo,
        },
        {
          title: "Фото-сопровождение",
          description: "Подходит для прогулок на закате и видовых маршрутов.",
          included: false,
          price: 1500,
        },
      ];
}

function buildItineraryDays(seed, routeNames) {
  const dayCount = seed.durationDays ?? 1;
  const fallbackLocation = routeNames[0] ?? "Крым";

  return Array.from({ length: dayCount }, (_, index) => {
    const primaryLocation = routeNames[index % routeNames.length] ?? fallbackLocation;
    const secondaryLocation = routeNames[(index + 1) % routeNames.length] ?? primaryLocation;
    const day = index + 1;

    return {
      day,
      title: day === 1 ? "Старт программы" : day === dayCount ? "Финальный день" : `День ${day}`,
      teaser:
        day === 1
          ? "Знакомство с маршрутом и главными точками"
          : "Переезд, прогулки и новые видовые остановки",
      description:
        day === 1
          ? `Начинаем программу в ${primaryLocation}, знакомимся с маршрутом и первыми локациями.`
          : `Продолжаем маршрут через ${primaryLocation} и ${secondaryLocation}, чередуя прогулки, смотровые и свободное время.`,
      locations: [primaryLocation, secondaryLocation],
      startTime: "09:00",
      endTime: "19:00",
      included: ["сопровождение", "транспорт"],
      meals: "По программе",
      accommodation: day < dayCount ? "Гостиница / гостевой дом по программе" : "",
      activities: ["прогулка", "видовые остановки", "время на фото"],
      mealsIncluded: ["завтрак"],
      transportModes: seed.transportModes ?? ["BUS"],
      overnightLocation: day < dayCount ? secondaryLocation : undefined,
      accommodationName: day < dayCount ? "Отель по программе" : undefined,
    };
  });
}

function buildSessions(seed, index) {
  const baseStart = addDays(startOfUtcDay(now), 4 + index * 2);
  const durationMinutes =
    seed.offerType === ExcursionOfferType.TOUR
      ? (seed.durationDays ?? 2) * 24 * 60
      : (seed.durationMinutes ?? 240);

  return Array.from({ length: 3 }, (_, sessionIndex) => {
    const startAt = dateWithMinutes(addDays(baseStart, sessionIndex * 7), 9 * 60);
    return {
      id: `${seed.id}_session_${sessionIndex + 1}`,
      startAt,
      endAt: dateWithMinutes(startAt, durationMinutes),
      capacity: seed.offerType === ExcursionOfferType.TOUR ? 14 : 18,
      priceOverride: sessionIndex === 1 ? seed.priceFrom + 300 : null,
      status:
        sessionIndex === 2 && index % 4 === 0
          ? ExcursionSessionStatus.SOLD_OUT
          : ExcursionSessionStatus.AVAILABLE,
      bookingDeadlineMinutes: seed.offerType === ExcursionOfferType.TOUR ? 720 : 180,
    };
  });
}

function buildExcursionPayload(seed, cityRow, owner, locationMap, index) {
  const routeLocations = seed.route.map((slug) => locationMap.get(slug)).filter(Boolean);
  const pickupLocations = seed.pickup.map((slug) => locationMap.get(slug)).filter(Boolean);
  const routeNames = routeLocations.map((item) => item.name);
  const contact = buildContactBundle(seed, owner);
  const isTour = seed.offerType === ExcursionOfferType.TOUR;
  const imageUrls = seed.route.flatMap((slug) => getCityMedia(slug).slice(0, 1));

  return {
    id: seed.id,
    ownerId: owner.id,
    offerType: seed.offerType,
    subtypeLabel: seed.subtypeLabel,
    title: seed.title,
    locationId: seed.city,
    locationName: cityRow.name,
    mainLocationId: cityRow.id,
    anchorLocationId: cityRow.id,
    districtId: cityRow.districtId,
    categoryId: seed.categoryId,
    address: `${cityRow.name}, сбор в центральной части города`,
    latitude: roundToSingleDecimal(Number(cityRow.latitude) + index * 0.0007),
    longitude: roundToSingleDecimal(Number(cityRow.longitude) + index * 0.0007),
    startPoint: `${cityRow.name}, точка сбора уточняется после заявки`,
    finishPoint: routeNames[routeNames.length - 1] ?? cityRow.name,
    meetingPointText: `Точную точку в ${cityRow.name} отправим в мессенджере после подтверждения.`,
    meetingLocationId: cityRow.id,
    description: `Тестовая карточка маршрута в ${cityRow.name.toLowerCase()} с акцентом на ${seed.vibe}. Нужна для оценки того, как экскурсии и туры выглядят на заполненном сайте.`,
    shortDescription: `${seed.vibe.charAt(0).toUpperCase()}${seed.vibe.slice(1)}.`,
    fullDescription: `Программа собрана в комфортном темпе и показывает, как на сайте смотрятся заполненные карточки с описанием, контактами, блоком программы, отзывами и датами. Маршрут проходит через ${routeNames.join(", ")} и подходит для демонстрации насыщенного контента.`,
    routeDescription: `Маршрут проходит через ${routeNames.join(" - ")} и собран в комфортном темпе с остановками на виды, прогулки и фото.`,
    highlights: [
      "Красивые видовые точки",
      "Понятная логистика без перегруза",
      "Живые истории от локального организатора",
      isTour ? "Продуманная программа по дням" : "Комфортный темп для прогулки",
    ],
    durationMinutes: seed.durationMinutes ?? null,
    durationDays: seed.durationDays ?? null,
    durationNights: seed.durationNights ?? null,
    itineraryDays: isTour ? buildItineraryDays(seed, routeNames) : [],
    scheduleMode: ExcursionScheduleMode.SESSIONS,
    availabilityMode: ExcursionAvailabilityMode.DATED,
    availabilityNote: "Даты подтверждаем быстро, после заявки связываемся в выбранном мессенджере.",
    format: seed.format,
    groupSizeMin: isTour ? 4 : 2,
    groupSizeMax: isTour ? 16 : seed.format === ExcursionFormat.PRIVATE ? 6 : 18,
    languageCodes: ["ru"],
    ageLimit: isTour ? 8 : 5,
    isKidFriendly: seed.difficulty === ExcursionDifficulty.EASY || seed.categoryId === "cat_family",
    difficulty: seed.difficulty,
    priceType: ExcursionPriceType.PER_PERSON,
    priceFrom: seed.priceFrom,
    priceTo: seed.priceTo,
    currency: "RUB",
    includedText: isTour
      ? "Транспорт, сопровождение, проживание и базовые организационные расходы."
      : "Сопровождение, маршрут и организационная часть по программе.",
    notIncludedText: isTour
      ? "Обеды, личные покупки и дополнительные активности вне программы."
      : "Личные расходы, кафе по пути и индивидуальные опции.",
    cancellationPolicy:
      "Бесплатная отмена за 48 часов до старта. При поздней отмене переносим заявку на ближайшую доступную дату.",
    physicalRequirements:
      seed.difficulty === ExcursionDifficulty.MEDIUM
        ? ["удобная обувь", "готовность к прогулкам по пересеченной местности"]
        : ["удобная обувь", "готовность к прогулке в среднем темпе"],
    whatToBring: ["вода", "головной убор", "заряженный телефон", "наличные на личные расходы"],
    meetingPointLat: Number(cityRow.latitude),
    meetingPointLng: Number(cityRow.longitude),
    minBookingNoticeHours: isTour ? 24 : 3,
    hasGuideLicense: true,
    pickupAvailable: pickupLocations.length > 0,
    receiveRequests: true,
    tags: seed.tags,
    instantConfirmation: index % 3 !== 0,
    contactFirstName: owner.firstName,
    contactLastName: owner.lastName,
    contactPhone: contact.phone,
    contactEmail: contact.contactEmail,
    websiteUrl: contact.websiteUrl,
    whatsappUrl: contact.whatsappUrl,
    telegramUrl: contact.telegramUrl,
    vkUrl: contact.vkUrl,
    maxUrl: contact.maxUrl,
    okUrl: contact.okUrl,
    photoUrls: [...imageUrls, ...imageUrls.slice(0, 1)],
    videoUrls: [],
    timeline: buildTimeline(routeNames, isTour),
    pricingTiers: buildPricingTiers(seed),
    faqItems: excursionFaqItems,
    extraOptions: buildExtraOptions(seed),
    includedItems: isTour
      ? ["транспорт", "сопровождение", "проживание", "завтраки"]
      : ["сопровождение", "организация маршрута", "видовые остановки"],
    excludedItems: isTour
      ? ["обеды", "личные расходы", "дополнительные дегустации"]
      : ["личные расходы", "кафе по маршруту"],
    transferDetails:
      pickupLocations.length > 0
        ? `Организуем посадку в ${pickupLocations.map((item) => item.name).join(", ")}.`
        : "До точки старта гости добираются самостоятельно, подробности отправляем заранее.",
    cancellationPolicyType: index % 2 === 0 ? "FLEXIBLE" : "MODERATE",
    priceUnitLabel: "чел",
    tourKind: seed.tourKind ?? null,
    transportModes: seed.transportModes ?? ["BUS"],
    departureMode: isTour ? "FIXED_DATES" : "DAILY",
    arrivalInfo: isTour ? "Заселение в первый день после основной программы." : null,
    departureInfo: isTour ? "Выезд после завтрака и финального блока маршрута." : null,
    accommodationProvided: isTour,
    accommodationType: isTour ? "HOTEL" : null,
    accommodationNights: isTour ? seed.durationNights : null,
    accommodationFormat: isTour ? "двухместное размещение по программе" : null,
    accommodationStars: isTour ? "3*" : null,
    roomTypes: isTour ? ["DOUBLE", "TWIN"] : [],
    singleSupplementAvailable: isTour,
    singleSupplementPrice: isTour ? 2600 : null,
    accommodationComment: isTour
      ? "Размещаем в проверенных небольших отелях или гостевых домах по маршруту."
      : null,
    mealPlan: isTour ? "BREAKFAST" : null,
    mealDetails: isTour ? "Завтраки включены, обеды и ужины по маршруту." : null,
    documentsRequired: isTour ? ["Паспорт РФ"] : [],
    insuranceIncluded: isTour ? true : null,
    insuranceComment: isTour ? "Базовая страховка включена в стоимость." : null,
    equipmentProvided:
      seed.tourKind === "JEEP"
        ? ["дождевик", "аптечка", "рации"]
        : seed.tourKind === "HIKING"
          ? ["аптечка", "сидушка"]
          : [],
    safetyInfo:
      seed.tourKind === "JEEP"
        ? "Перед стартом проводим обязательный инструктаж по посадке и движению по маршруту."
        : seed.tourKind === "HIKING"
          ? "Гид следит за темпом группы и подстраивает остановки под состояние участников."
          : null,
    routeConditions:
      seed.difficulty === ExcursionDifficulty.MEDIUM
        ? "Часть маршрута проходит по грунтовым дорогам и тропам."
        : "Маршрут проходит по благоустроенным локациям и коротким прогулочным участкам.",
    profileViews: 20 + index * 6,
    moderationNotes: "Демо-наполнение для оценки визуальной плотности каталога.",
    status: ExcursionStatus.PUBLISHED,
    isPublishedVisible: true,
    createdAt: addDays(now, -30 - index * 2),
    pickupLocations: pickupLocations.map((item) => ({ locationId: item.id })),
    routeLocations: routeLocations.map((item, routeIndex) => ({
      locationId: item.id,
      sortOrder: routeIndex,
    })),
    sessions: buildSessions(seed, index),
  };
}

function buildReviewsForEntities(entities, entityType) {
  const reviewerPool = reviewers.map((item) => item.key);

  return entities.flatMap((entity, entityIndex) =>
    Array.from({ length: 2 }, (_, reviewIndex) => {
      const reviewerKey = reviewerPool[(entityIndex * 2 + reviewIndex) % reviewerPool.length];
      const reviewer = userByKey.get(reviewerKey);
      const rating =
        reviewIndex === 0 ? 4.8 - (entityIndex % 3) * 0.1 : 4.4 - (entityIndex % 2) * 0.1;

      return {
        id: `${entity.id}_review_${reviewIndex + 1}`,
        entityType,
        propertyId: entityType === ReviewEntityType.PROPERTY ? entity.id : null,
        excursionId: entityType === ReviewEntityType.EXCURSION ? entity.id : null,
        userId: reviewer.id,
        rating: Number(rating.toFixed(1)),
        text:
          reviewTextPool[(entityIndex + reviewIndex * 2) % reviewTextPool.length] +
          (entityType === ReviewEntityType.EXCURSION
            ? " Отдельно удобно, что программа и даты читаются сразу."
            : " Контакты и описание тоже выглядят уместно."),
        likesCount: 1 + ((entityIndex + reviewIndex) % 5),
        dislikesCount: reviewIndex === 0 ? 0 : entityIndex % 2,
        ownerReply:
          entityIndex % 3 === 0 ? ownerReplyPool[entityIndex % ownerReplyPool.length] : null,
        ownerRepliedAt: entityIndex % 3 === 0 ? addDays(now, -(entityIndex + 2)) : null,
        status: ReviewStatus.ACTIVE,
        createdAt: addDays(now, -(entityIndex + reviewIndex + 5)),
      };
    }),
  );
}

async function upsertUsers(passwordHash) {
  for (const user of [...owners, ...reviewers]) {
    const rows = await db.$queryRaw(
      Prisma.sql`
        INSERT INTO "User" (
          "id",
          "phone",
          "firstName",
          "lastName",
          "email",
          "passwordHash",
          "role",
          "createdAt",
          "updatedAt",
          "chat_consent_given"
        )
        VALUES (
          ${`demo_user_${user.key}`},
          ${user.phone},
          ${user.firstName},
          ${user.lastName},
          ${user.email},
          ${passwordHash},
          'USER',
          NOW(),
          NOW(),
          false
        )
        ON CONFLICT ("phone")
        DO UPDATE SET
          "firstName" = EXCLUDED."firstName",
          "lastName" = EXCLUDED."lastName",
          "email" = EXCLUDED."email",
          "passwordHash" = EXCLUDED."passwordHash",
          "updatedAt" = NOW()
        RETURNING "id", "phone", "firstName", "lastName", "email"
      `,
    );

    const record = rows[0];

    userByKey.set(user.key, record);
  }
}

async function refreshPropertyReviewStats(propertyId) {
  const aggregate = await db.review.aggregate({
    where: {
      entityType: ReviewEntityType.PROPERTY,
      propertyId,
      status: ReviewStatus.ACTIVE,
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await db.property.updateMany({
    where: { id: propertyId },
    data: {
      avgRating: Number(aggregate._avg.rating ?? 0),
      reviewsCount: aggregate._count._all,
    },
  });
}

async function refreshExcursionReviewStats(excursionId) {
  const aggregate = await db.review.aggregate({
    where: {
      entityType: ReviewEntityType.EXCURSION,
      excursionId,
      status: ReviewStatus.ACTIVE,
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await db.excursion.updateMany({
    where: { id: excursionId },
    data: {
      avgRating: Number(aggregate._avg.rating ?? 0),
      reviewsCount: aggregate._count._all,
    },
  });
}
async function main() {
  const [locationRows, categoryRows] = await Promise.all([
    db.excursionLocation.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        latitude: true,
        longitude: true,
        districtId: true,
      },
    }),
    db.excursionCategory.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
      },
    }),
  ]);

  const locationMap = new Map(locationRows.map((row) => [row.slug, row]));
  const categoryMap = new Map(categoryRows.map((row) => [row.id, row]));
  const allExcursionSeeds = [...excursionSeeds, ...tourSeeds];
  const missingCities = [
    ...new Set([
      ...propertySeeds.map((item) => item.city),
      ...allExcursionSeeds.map((item) => item.city),
    ]),
  ].filter((slug) => !locationMap.has(slug));
  const missingCategories = [...new Set(allExcursionSeeds.map((item) => item.categoryId))].filter(
    (id) => !categoryMap.has(id),
  );

  if (missingCities.length > 0) {
    throw new Error(`В БД не хватает локаций для demo-сида: ${missingCities.join(", ")}`);
  }

  if (missingCategories.length > 0) {
    throw new Error(`В БД не хватает категорий для demo-сида: ${missingCategories.join(", ")}`);
  }

  const passwordHash = await bcrypt.hash("DemoContent!2026", 10);
  await upsertUsers(passwordHash);

  const propertyIds = propertySeeds.map((item) => item.id);
  const excursionIds = allExcursionSeeds.map((item) => item.id);

  await db.excursion.deleteMany({
    where: { id: { in: excursionIds } },
  });
  await db.property.deleteMany({
    where: { id: { in: propertyIds } },
  });

  const createdProperties = [];
  for (const [index, seed] of propertySeeds.entries()) {
    const owner = userByKey.get(seed.ownerKey);
    const cityRow = locationMap.get(seed.city);
    const payload = buildPropertyPayload(seed, cityRow, owner, index);

    await db.$executeRawUnsafe(
      buildInsertSql(
        "Property",
        {
          id: payload.id,
          ownerId: payload.ownerId,
          type: payload.type,
          locationId: payload.locationId,
          locationName: payload.locationName,
          name: payload.name,
          address: payload.address,
          seaDistance: payload.seaDistance,
          latitude: payload.latitude,
          longitude: payload.longitude,
          phone: payload.phone,
          phoneName: payload.phoneName,
          phone2: payload.phone2,
          phone2Name: payload.phone2Name,
          phone3: payload.phone3,
          phone3Name: payload.phone3Name,
          websiteUrl: payload.websiteUrl,
          contactEmail: payload.contactEmail,
          contactPersonName: payload.contactPersonName,
          contactPersonRole: payload.contactPersonRole,
          whatsappUrl: payload.whatsappUrl,
          telegramUrl: payload.telegramUrl,
          vkUrl: payload.vkUrl,
          maxUrl: payload.maxUrl,
          okUrl: payload.okUrl,
          receiveRequests: payload.receiveRequests,
          showEmail: payload.showEmail,
          description: payload.description,
          faqItems: payload.faqItems,
          checkInFrom: payload.checkInFrom,
          checkOutUntil: payload.checkOutUntil,
          childrenAllowed: payload.childrenAllowed,
          childrenMinAge: payload.childrenMinAge,
          petsPolicy: payload.petsPolicy,
          smokingPolicy: payload.smokingPolicy,
          quietHoursEnabled: payload.quietHoursEnabled,
          quietHoursFrom: payload.quietHoursFrom,
          quietHoursTo: payload.quietHoursTo,
          parkingInfo: payload.parkingInfo,
          mealOptions: payload.mealOptions,
          prepaymentPolicy: payload.prepaymentPolicy,
          classificationApplicable: payload.classificationApplicable,
          starRating: payload.starRating,
          registryNumber: payload.registryNumber,
          registryDetails: payload.registryDetails,
          favoritesCount: payload.favoritesCount,
          profileViews: payload.profileViews,
          status: payload.status,
          createdAt: payload.createdAt,
          updatedAt: new Date(),
        },
        {
          faqItems: "json",
          petsPolicy: "PetsPolicy",
          smokingPolicy: "SmokingPolicy",
          status: "PropertyStatus",
        },
      ),
    );

    await db.media.createMany({
      data: payload.media.map((item) => ({
        ...item,
        propertyId: payload.id,
        roomId: null,
      })),
    });
    await db.propertyAmenity.createMany({
      data: payload.amenityIds.map((amenityId) => ({
        propertyId: payload.id,
        amenityId,
      })),
    });
    await db.propertyCustomAmenity.createMany({
      data: payload.customAmenities.map((name, amenityIndex) => ({
        id: `${payload.id}_custom_amenity_${amenityIndex + 1}`,
        propertyId: payload.id,
        name,
      })),
    });
    await db.objectRoomAmenitySetting.createMany({
      data: payload.keyFeatureIds.map((featureId, featureIndex) => ({
        id: `${payload.id}_key_feature_${featureIndex + 1}`,
        propertyId: payload.id,
        featureId,
        enabled: true,
        isKeyAmenity: true,
        applyToAllCategories: true,
      })),
    });
    await db.room.createMany({
      data: payload.rooms.map((room) => ({
        id: room.id,
        propertyId: payload.id,
        title: room.title,
        beds: room.beds,
        extraBeds: room.extraBeds,
        roomsCount: room.roomsCount,
        areaSqm: room.areaSqm,
        bathroomType: room.bathroomType,
        isActive: true,
      })),
    });
    await db.roomFeatureOnRoom.createMany({
      data: payload.rooms.flatMap((room) =>
        room.featureIds.map((featureId) => ({
          roomId: room.id,
          featureId,
        })),
      ),
    });
    await db.roomCustomFeature.createMany({
      data: payload.rooms.flatMap((room) =>
        room.customFeatures.map((name, customIndex) => ({
          id: `${room.id}_custom_${customIndex + 1}`,
          roomId: room.id,
          name,
        })),
      ),
    });
    await db.media.createMany({
      data: payload.rooms.flatMap((room) =>
        room.media.map((item) => ({
          ...item,
          propertyId: payload.id,
          roomId: room.id,
        })),
      ),
    });
    await db.roomPrice.createMany({
      data: payload.rooms.flatMap((room) =>
        room.prices.map((price) => ({
          ...price,
          roomId: room.id,
        })),
      ),
    });

    createdProperties.push({ id: payload.id });
  }

  const createdExcursions = [];
  for (const [index, seed] of allExcursionSeeds.entries()) {
    const owner = userByKey.get(seed.ownerKey);
    const cityRow = locationMap.get(seed.city);
    const payload = buildExcursionPayload(seed, cityRow, owner, locationMap, index);

    await db.$executeRawUnsafe(
      buildInsertSql(
        "Excursion",
        {
          id: payload.id,
          ownerId: payload.ownerId,
          offerType: payload.offerType,
          subtypeLabel: payload.subtypeLabel,
          title: payload.title,
          locationId: payload.locationId,
          locationName: payload.locationName,
          mainLocationId: payload.mainLocationId,
          anchorLocationId: payload.anchorLocationId,
          districtId: payload.districtId,
          categoryId: payload.categoryId,
          address: payload.address,
          latitude: payload.latitude,
          longitude: payload.longitude,
          startPoint: payload.startPoint,
          finishPoint: payload.finishPoint,
          meetingPointText: payload.meetingPointText,
          meetingLocationId: payload.meetingLocationId,
          description: payload.description,
          shortDescription: payload.shortDescription,
          fullDescription: payload.fullDescription,
          routeDescription: payload.routeDescription,
          highlights: payload.highlights,
          durationMinutes: payload.durationMinutes,
          durationDays: payload.durationDays,
          durationNights: payload.durationNights,
          itineraryDays: payload.itineraryDays,
          scheduleMode: payload.scheduleMode,
          availabilityMode: payload.availabilityMode,
          availabilityNote: payload.availabilityNote,
          format: payload.format,
          groupSizeMin: payload.groupSizeMin,
          groupSizeMax: payload.groupSizeMax,
          languageCodes: payload.languageCodes,
          ageLimit: payload.ageLimit,
          isKidFriendly: payload.isKidFriendly,
          difficulty: payload.difficulty,
          priceType: payload.priceType,
          priceFrom: payload.priceFrom,
          priceTo: payload.priceTo,
          currency: payload.currency,
          includedText: payload.includedText,
          notIncludedText: payload.notIncludedText,
          cancellationPolicy: payload.cancellationPolicy,
          physicalRequirements: payload.physicalRequirements,
          whatToBring: payload.whatToBring,
          meetingPointLat: payload.meetingPointLat,
          meetingPointLng: payload.meetingPointLng,
          minBookingNoticeHours: payload.minBookingNoticeHours,
          hasGuideLicense: payload.hasGuideLicense,
          pickupAvailable: payload.pickupAvailable,
          receiveRequests: payload.receiveRequests,
          tags: payload.tags,
          instantConfirmation: payload.instantConfirmation,
          contactFirstName: payload.contactFirstName,
          contactLastName: payload.contactLastName,
          contactPhone: payload.contactPhone,
          contactEmail: payload.contactEmail,
          websiteUrl: payload.websiteUrl,
          whatsappUrl: payload.whatsappUrl,
          telegramUrl: payload.telegramUrl,
          vkUrl: payload.vkUrl,
          maxUrl: payload.maxUrl,
          okUrl: payload.okUrl,
          photoUrls: payload.photoUrls,
          videoUrls: payload.videoUrls,
          timeline: payload.timeline,
          pricingTiers: payload.pricingTiers,
          faqItems: payload.faqItems,
          extraOptions: payload.extraOptions,
          includedItems: payload.includedItems,
          excludedItems: payload.excludedItems,
          transferDetails: payload.transferDetails,
          cancellationPolicyType: payload.cancellationPolicyType,
          priceUnitLabel: payload.priceUnitLabel,
          accommodationComment: payload.accommodationComment,
          accommodationFormat: payload.accommodationFormat,
          accommodationNights: payload.accommodationNights,
          accommodationProvided: payload.accommodationProvided,
          accommodationType: payload.accommodationType,
          mealPlan: payload.mealPlan,
          profileViews: payload.profileViews,
          moderationNotes: payload.moderationNotes,
          status: payload.status,
          createdAt: payload.createdAt,
          updatedAt: new Date(),
        },
        {
          offerType: "ExcursionOfferType",
          highlights: "json",
          itineraryDays: "json",
          scheduleMode: "ExcursionScheduleMode",
          availabilityMode: "ExcursionAvailabilityMode",
          format: "ExcursionFormat",
          languageCodes: "string[]",
          difficulty: "ExcursionDifficulty",
          priceType: "ExcursionPriceType",
          physicalRequirements: "string[]",
          whatToBring: "string[]",
          tags: "string[]",
          photoUrls: "string[]",
          videoUrls: "string[]",
          timeline: "json",
          pricingTiers: "json",
          faqItems: "json",
          extraOptions: "json",
          includedItems: "string[]",
          excludedItems: "string[]",
          status: "ExcursionStatus",
        },
      ),
    );

    await db.excursionPickupLocation.createMany({
      data: payload.pickupLocations.map((item) => ({
        excursionId: payload.id,
        locationId: item.locationId,
      })),
    });
    await db.excursionRouteLocation.createMany({
      data: payload.routeLocations.map((item) => ({
        excursionId: payload.id,
        locationId: item.locationId,
        sortOrder: item.sortOrder,
      })),
    });
    await db.excursionSession.createMany({
      data: payload.sessions.map((item) => ({
        ...item,
        excursionId: payload.id,
      })),
    });

    createdExcursions.push({ id: payload.id });
  }

  await db.review.createMany({
    data: [
      ...buildReviewsForEntities(createdProperties, ReviewEntityType.PROPERTY),
      ...buildReviewsForEntities(createdExcursions, ReviewEntityType.EXCURSION),
    ],
  });

  for (const property of createdProperties) {
    await refreshPropertyReviewStats(property.id);
  }
  for (const excursion of createdExcursions) {
    await refreshExcursionReviewStats(excursion.id);
  }

  const [propertiesCount, excursionsCount, toursCount, reviewsCount] = await Promise.all([
    db.property.count({ where: { id: { in: propertyIds } } }),
    db.excursion.count({ where: { id: { in: excursionSeeds.map((item) => item.id) } } }),
    db.excursion.count({ where: { id: { in: tourSeeds.map((item) => item.id) } } }),
    db.review.count({
      where: {
        OR: [{ propertyId: { in: propertyIds } }, { excursionId: { in: excursionIds } }],
      },
    }),
  ]);

  console.log("Showcase seed complete.");
  console.log(`Properties created: ${propertiesCount}`);
  console.log(`Excursions created: ${excursionsCount}`);
  console.log(`Tours created: ${toursCount}`);
  console.log(`Reviews created: ${reviewsCount}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed showcase marketplace data.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
