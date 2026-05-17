import { companyConfig } from "@/config/company";
import { getPlacementPromoPrice } from "@/lib/placement-promo";
import { OBJECT_TARIFF_PRICE_TABLE, OBJECT_YEARLY_PRICE_RUB } from "@/lib/object-placement-tariffs";
import { calculateDiscountedPlacementPrice, placementTariffs } from "@/lib/placement-tariffs";

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
  seasonPriceRub?: number;
  firstYearPriceRub?: number;
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
    seasonPriceRub: placementTariffs.excursion.seasonPrice,
    firstYearPriceRub: calculateDiscountedPlacementPrice(
      EXCURSION_PUBLICATION_FEE_RUB,
      placementTariffs.excursion.firstYearDiscountPercent,
    ),
    conditionsLabel: "Скидки применяются только к годовому размещению.",
    durationLabel: "Сезон до 31 октября или 365 дней",
  },
  {
    id: "tour_standard",
    serviceName: "Тур",
    serviceNote: "Размещение карточки тура. Комиссию с заказов мы не берём.",
    priceRub: TOUR_PUBLICATION_FEE_RUB,
    seasonPriceRub: placementTariffs.tour.seasonPrice,
    firstYearPriceRub: calculateDiscountedPlacementPrice(
      TOUR_PUBLICATION_FEE_RUB,
      placementTariffs.tour.firstYearDiscountPercent,
    ),
    conditionsLabel: "Скидки применяются только к годовому размещению.",
    durationLabel: "Сезон до 31 октября или 365 дней",
  },
  {
    id: "transfer_standard",
    serviceName: "Трансфер",
    serviceNote: "Размещение карточки трансфера. Один автомобиль входит в стоимость размещения.",
    priceRub: TRANSFER_PUBLICATION_FEE_RUB,
    seasonPriceRub: placementTariffs.transfer.seasonPrice,
    firstYearPriceRub: calculateDiscountedPlacementPrice(
      TRANSFER_PUBLICATION_FEE_RUB,
      placementTariffs.transfer.firstYearDiscountPercent,
    ),
    conditionsLabel: "Дополнительные автомобили считаются без скидки.",
    durationLabel: "Сезон до 31 октября или 365 дней",
    extraLabel: `Дополнительный автомобиль: +${formatTariffPrice(TRANSFER_EXTRA_VEHICLE_FEE_RUB)}`,
  },
];

export const publicObjectTariffCards: PublicObjectTariffCard[] = [
  {
    id: "season",
    title: "Сезонное размещение",
    priceLabel: "от 990 ₽ до 3 900 ₽",
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
    priceNote: "375 ₽ в месяц",
    description:
      "Размещение объекта на 12 месяцев с даты оплаты. Подходит для тех, кто хочет быть на сайте круглый год: в сезон, в период раннего бронирования, осенью, зимой и весной.",
    periodLabel: "12 месяцев с даты оплаты",
    monthlyLabel: "Для круглогодичного присутствия на сайте",
    buttonLabel: "Выбрать годовой тариф",
    badgeLabel: "Скидка 20% после теста",
    savingsLabel: `Для участников бесплатного периода первое годовое размещение — ${formatTariffPrice(
      calculateDiscountedPlacementPrice(
        OBJECT_YEARLY_PRICE_RUB,
        placementTariffs.object.firstYearDiscountPercent,
      ),
    )}.`,
    comparisonLabel: "Скидка 20% на первое годовое размещение после бесплатного периода.",
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
  "Скидки действуют только на годовое размещение. Месячные и сезонные тарифы уже рассчитаны как краткосрочные, поэтому дополнительные скидки на них не применяются.",
  "Скидка действует отдельно для каждой категории: объект, экскурсия, тур и трансфер.",
  "Участники тестового периода получают скидку 20% на первое годовое продление в каждой категории.",
  "Новые карточки после 20 июня получают пробный месяц без дополнительных скидок на дальнейшие тарифы.",
  "Дополнительные опции, например дополнительные автомобили в трансфере, добавляются после скидки.",
  "Годовое размещение включает сезон, период раннего бронирования и межсезонье.",
];

export const annualTariffBenefitText =
  "Для участников бесплатного периода первое годовое размещение — 3 600 ₽. Скидка 20% применяется только к первому годовому продлению после бесплатного периода.";

export function formatTariffPrice(priceRub: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(priceRub)} ₽`;
}

export function getServicesAndTariffsDocumentUrl(): string {
  return `${companyConfig.baseUrl}${SERVICES_AND_TARIFFS_PATH}`;
}
