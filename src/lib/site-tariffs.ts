import { companyConfig } from "@/config/company";
import { getPlacementPromoPrice } from "@/lib/placement-promo";
import {
  OBJECT_OFFSEASON_PRICE_RUB,
  OBJECT_SEASON_OFFSEASON_SEPARATE_TOTAL_RUB,
  OBJECT_TARIFF_PRICE_TABLE,
  OBJECT_YEARLY_PRICE_RUB,
  OBJECT_YEARLY_SAVINGS_RUB,
} from "@/lib/object-placement-tariffs";
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
  repeatYearPriceRub?: number;
  conditionsLabel: string;
  durationLabel: string;
  extraLabel?: string;
};

export type PublicObjectTariffCard = {
  id: "season" | "offseason" | "yearly";
  title: string;
  priceLabel: string;
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
    repeatYearPriceRub: calculateDiscountedPlacementPrice(
      EXCURSION_PUBLICATION_FEE_RUB,
      placementTariffs.excursion.repeatYearDiscountPercent,
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
    repeatYearPriceRub: calculateDiscountedPlacementPrice(
      TOUR_PUBLICATION_FEE_RUB,
      placementTariffs.tour.repeatYearDiscountPercent,
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
    repeatYearPriceRub: calculateDiscountedPlacementPrice(
      TRANSFER_PUBLICATION_FEE_RUB,
      placementTariffs.transfer.repeatYearDiscountPercent,
    ),
    conditionsLabel: "Дополнительные автомобили считаются без скидки.",
    durationLabel: "Сезон до 31 октября или 365 дней",
    extraLabel: `Дополнительный автомобиль: +${formatTariffPrice(
      TRANSFER_EXTRA_VEHICLE_FEE_RUB,
    )}`,
  },
];

export const publicObjectTariffCards: PublicObjectTariffCard[] = [
  {
    id: "season",
    title: "Сезон",
    priceLabel: "от 990 ₽ до 3 000 ₽",
    description:
      "Размещение до 31 октября. Цена зависит от месяца подключения, дополнительные скидки не применяются.",
    periodLabel: "с даты оплаты до 31 октября",
    monthlyLabel: "в мае-июне примерно 500-600 ₽ в месяц",
    buttonLabel: "Выбрать сезон",
    priceRows: [...OBJECT_TARIFF_PRICE_TABLE],
  },
  {
    id: "offseason",
    title: "Межсезонье",
    priceLabel: formatTariffPrice(OBJECT_OFFSEASON_PRICE_RUB),
    description:
      "Размещение с ноября по апрель. Это краткосрочный тариф без дополнительных скидок.",
    periodLabel: "с 1 ноября до 30 апреля",
    monthlyLabel: "около 467 ₽ в месяц",
    buttonLabel: "Выбрать межсезонье",
  },
  {
    id: "yearly",
    title: "Годовое размещение",
    priceLabel: formatTariffPrice(OBJECT_YEARLY_PRICE_RUB),
    description:
      "Самый выгодный тариф: для первого годового размещения в категории доступна стартовая скидка 20%, для повторного — 10%.",
    periodLabel: "12 месяцев с даты оплаты",
    monthlyLabel: "375 ₽ в месяц до персональной скидки",
    buttonLabel: "Выбрать годовой тариф",
    badgeLabel: "Скидки 20% / 10%",
    savingsLabel: `Первое годовое размещение: ${formatTariffPrice(
      calculateDiscountedPlacementPrice(
        OBJECT_YEARLY_PRICE_RUB,
        placementTariffs.object.firstYearDiscountPercent,
      ),
    )}`,
    comparisonLabel: `Сезон + межсезонье отдельно — ${formatTariffPrice(
      OBJECT_SEASON_OFFSEASON_SEPARATE_TOTAL_RUB,
    )}. Годовой тариф — ${formatTariffPrice(OBJECT_YEARLY_PRICE_RUB)} до персональной скидки.`,
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
    serviceNote:
      "Профессиональная фотосъёмка номеров вашего объекта — выезд за пределы города",
    priceLabel: "300 ₽ / номер + 300 ₽ за выезд",
    conditionsLabel: "Минимум 3 номера при выезде за город",
  },
];

export const publicTariffHighlights = [
  "Скидки действуют только на годовое размещение. Месячные и сезонные тарифы уже рассчитаны как краткосрочные, поэтому дополнительные скидки на них не применяются.",
  "Скидка действует отдельно для каждой категории: объект, экскурсия, тур и трансфер.",
  "Один пользователь может получить стартовую скидку 20% на первое годовое размещение в каждой категории.",
  "Для повторного годового размещения в той же категории применяется скидка 10%.",
  "Дополнительные опции, например дополнительные автомобили в трансфере, добавляются после скидки.",
  `Годовой тариф объекта выгоднее на ${formatTariffPrice(OBJECT_YEARLY_SAVINGS_RUB)} до персональной скидки.`,
];

export const annualTariffBenefitText =
  "Скидки 20% и 10% применяются только к годовому размещению. Месячные и сезонные тарифы уже снижены, поэтому дополнительные скидки на них не применяются.";

export function formatTariffPrice(priceRub: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(priceRub)} ₽`;
}

export function getServicesAndTariffsDocumentUrl(): string {
  return `${companyConfig.baseUrl}${SERVICES_AND_TARIFFS_PATH}`;
}
