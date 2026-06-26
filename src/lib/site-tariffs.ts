import { companyConfig } from "@/config/company";
import { getPlacementPromoPrice } from "@/lib/placement-promo";
import { OBJECT_TARIFF_PRICE_TABLE, OBJECT_YEARLY_PRICE_RUB } from "@/lib/object-placement-tariffs";
import { placementTariffs } from "@/lib/placement-tariffs";

export const EXCURSION_PUBLICATION_FEE_RUB = placementTariffs.excursion.yearPrice;
export const TOUR_PUBLICATION_FEE_RUB = placementTariffs.tour.yearPrice;
export const TRANSFER_PUBLICATION_FEE_RUB = placementTariffs.transfer.yearPrice;
export const TRANSFER_EXTRA_VEHICLE_FEE_RUB = placementTariffs.transfer.additionalCarPrice;
export const SERVICES_AND_TARIFFS_PATH = "/uslugi-i-tarify";
export const OFFER_PATH = "/oferta";

export type PublicServiceTariffRow = {
  id: string;
  serviceName: string;
  serviceNote: string;
  priceRub: number;
  conditionsLabel: string;
  durationLabel: string;
  extraLabel?: string;
};

export type PublicObjectTariffCard = {
  id: "season" | "yearly";
  title: string;
  priceLabel: string;
  priceNote?: string;
  description: string;
  periodLabel: string;
  monthlyLabel: string;
  buttonLabel: string;
  badgeLabel?: string;
  savingsLabel?: string;
  comparisonLabel?: string;
  recommended?: boolean;
  priceRows?: Array<{ label: string; amountRub: number }>;
};

export function calculateTransferPublicationFeeRub(vehicleCount: number, now = new Date()): number {
  return getPlacementPromoPrice(calculateTransferPublicationOriginalFeeRub(vehicleCount), now)
    .finalAmountRub;
}

export function calculateTransferPublicationOriginalFeeRub(vehicleCount: number): number {
  const normalizedVehicleCount = Number.isFinite(vehicleCount)
    ? Math.max(1, Math.round(vehicleCount))
    : 1;
  return (
    TRANSFER_PUBLICATION_FEE_RUB +
    Math.max(0, normalizedVehicleCount - 1) * TRANSFER_EXTRA_VEHICLE_FEE_RUB
  );
}

export const publicServiceTariffRows: PublicServiceTariffRow[] = [
  {
    id: "excursion_standard",
    serviceName: "Экскурсия",
    serviceNote: "Размещение карточки экскурсии. Комиссию с заказов мы не берём.",
    priceRub: EXCURSION_PUBLICATION_FEE_RUB,
    conditionsLabel: "Размещение и продление действуют 12 месяцев без комиссии с запросов.",
    durationLabel: "12 месяцев",
  },
  {
    id: "tour_standard",
    serviceName: "Тур",
    serviceNote: "Размещение карточки тура. Комиссию с заказов мы не берём.",
    priceRub: TOUR_PUBLICATION_FEE_RUB,
    conditionsLabel: "Размещение и продление действуют 12 месяцев без комиссии с запросов.",
    durationLabel: "12 месяцев",
  },
  {
    id: "transfer_standard",
    serviceName: "Трансфер",
    serviceNote: "Размещение карточки трансфера. Один автомобиль входит в стоимость размещения.",
    priceRub: TRANSFER_PUBLICATION_FEE_RUB,
    conditionsLabel: "Размещение и продление действуют 12 месяцев без комиссии с запросов.",
    durationLabel: "12 месяцев",
    extraLabel: `Дополнительный автомобиль действует до окончания основной карточки: +${formatTariffPrice(TRANSFER_EXTRA_VEHICLE_FEE_RUB)}`,
  },
];

export const publicObjectTariffCards: PublicObjectTariffCard[] = [
  {
    id: "season",
    title: "Сезонное размещение",
    priceLabel: "от 990 ₽ до 4 600 ₽",
    priceNote: "Цена зависит от месяца подключения",
    description:
      "Размещение объекта с момента оплаты до 31 октября. Сезонное размещение можно подключить заранее — с января, чтобы карточка уже показывалась туристам в период раннего бронирования на лето.",
    periodLabel: "Размещение до 31 октября",
    monthlyLabel:
      "Можно подключиться заранее — с января, чтобы получать заявки на лето в период раннего бронирования",
    buttonLabel: "Выбрать сезон",
    priceRows: [...OBJECT_TARIFF_PRICE_TABLE],
  },
  {
    id: "yearly",
    title: "Годовое размещение",
    priceLabel: formatTariffPrice(OBJECT_YEARLY_PRICE_RUB),
    priceNote: "около 417 ₽ в месяц",
    description:
      "Размещение объекта на 12 месяцев с даты оплаты. Подходит для тех, кто хочет быть на сайте круглый год: в сезон, в период раннего бронирования, осенью, зимой и весной.",
    periodLabel: "12 месяцев с даты оплаты",
    monthlyLabel: "Для круглогодичного присутствия на сайте",
    buttonLabel: "Выбрать годовой тариф",
    recommended: true,
  },
];

export type AdditionalServiceRow = {
  id: string;
  serviceName: string;
  serviceNote: string;
  priceLabel: string;
  conditionsLabel: string;
};

export const additionalServiceRows: AdditionalServiceRow[] = [
  {
    id: "card_creation",
    serviceName: "Создание карточки объекта за вас",
    serviceNote:
      "Владелец может добавить объект сам, либо администрация поможет и создаст карточку по предоставленным данным",
    priceLabel: "Бесплатно",
    conditionsLabel: "Сама карточка создаётся бесплатно; оплачивается только период размещения",
  },
  {
    id: "photo_in_city",
    serviceName: "Фотосъёмка объекта",
    serviceNote:
      "Профессиональная фотосъёмка номеров вашего объекта для размещения на сайте — выезд в пределах города",
    priceLabel: "300 ₽ / номер",
    conditionsLabel: "Выезд в пределах города, от 1 номера",
  },
  {
    id: "photo_out_of_city",
    serviceName: "Фотосъёмка объекта",
    serviceNote: "Профессиональная фотосъёмка номеров вашего объекта — выезд за пределы города",
    priceLabel: "300 ₽ / номер + 300 ₽ за выезд",
    conditionsLabel: "Минимум 3 номера при выезде за город",
  },
];

export const publicTariffHighlights = [
  "Сезонные тарифы рассчитаны для размещения до 31 октября.",
  "Годовой тариф действует 12 месяцев с даты оплаты.",
  "Новые карточки получают 1 год бесплатного размещения с даты публикации после модерации.",
  "Дополнительные опции, например дополнительные автомобили в трансфере, оплачиваются отдельно.",
  "Годовое размещение включает сезон, период раннего бронирования и межсезонье.",
];

export const annualTariffBenefitText =
  "После бесплатного периода действует базовая стоимость выбранного тарифа без комиссии с заявок и бронирований.";

export function formatTariffPrice(priceRub: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(priceRub)} ₽`;
}

export function getServicesAndTariffsDocumentUrl(): string {
  return `${companyConfig.baseUrl}${SERVICES_AND_TARIFFS_PATH}`;
}
