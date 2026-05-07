import { companyConfig } from "@/config/company";
import { getPlacementPromoPrice } from "@/lib/placement-promo";
import {
  OBJECT_OFFSEASON_PRICE_RUB,
  OBJECT_SEASON_OFFSEASON_SEPARATE_TOTAL_RUB,
  OBJECT_TARIFF_PRICE_TABLE,
  OBJECT_YEARLY_PRICE_RUB,
  OBJECT_YEARLY_SAVINGS_RUB,
} from "@/lib/object-placement-tariffs";

export const EXCURSION_PUBLICATION_FEE_RUB = 1990;
export const TRANSFER_PUBLICATION_FEE_RUB = 1900;
export const TRANSFER_EXTRA_VEHICLE_FEE_RUB = 500;
export const SERVICES_AND_TARIFFS_PATH = "/uslugi-i-tarify";
export const OFFER_PATH = "/oferta";

export type PublicServiceTariffRow = {
  id: string;
  serviceName: string;
  serviceNote: string;
  priceRub: number;
  conditionsLabel: string;
  durationLabel: string;
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
    serviceName: "Размещение информации об экскурсии",
    serviceNote: "Единоразовая публикация карточки экскурсии",
    priceRub: EXCURSION_PUBLICATION_FEE_RUB,
    conditionsLabel: "Количество номеров не применяется",
    durationLabel: "365 дней с момента публикации",
  },
  {
    id: "tour_standard",
    serviceName: "Размещение информации о туре",
    serviceNote: "Единоразовая публикация карточки тура",
    priceRub: EXCURSION_PUBLICATION_FEE_RUB,
    conditionsLabel: "Количество номеров не применяется",
    durationLabel: "365 дней с момента публикации",
  },
  {
    id: "transfer_standard",
    serviceName: "Размещение информации о трансфере",
    serviceNote:
      "Публикация карточки трансфера с автопарком. До 20 июня 2026 включительно размещение бесплатно.",
    priceRub: TRANSFER_PUBLICATION_FEE_RUB,
    conditionsLabel: `После бесплатного периода: 1 автомобиль включен, каждый следующий +${formatTariffPrice(
      TRANSFER_EXTRA_VEHICLE_FEE_RUB,
    )}`,
    durationLabel: "365 дней с момента публикации",
  },
];

export const publicObjectTariffCards: PublicObjectTariffCard[] = [
  {
    id: "season",
    title: "Сезон",
    priceLabel: "от 990 ₽ до 3 000 ₽",
    description: "Размещение до 31 октября. Цена зависит от месяца подключения.",
    periodLabel: "с даты оплаты до 31 октября",
    monthlyLabel: "в мае-июне примерно 500-600 ₽ в месяц",
    buttonLabel: "Выбрать сезон",
    priceRows: [...OBJECT_TARIFF_PRICE_TABLE],
  },
  {
    id: "offseason",
    title: "Межсезонье",
    priceLabel: formatTariffPrice(OBJECT_OFFSEASON_PRICE_RUB),
    description: "Размещение с ноября по апрель.",
    periodLabel: "с 1 ноября до 30 апреля",
    monthlyLabel: "около 467 ₽ в месяц",
    buttonLabel: "Выбрать межсезонье",
  },
  {
    id: "yearly",
    title: "Годовой",
    priceLabel: formatTariffPrice(OBJECT_YEARLY_PRICE_RUB),
    description: "12 месяцев размещения. Самый выгодный вариант.",
    periodLabel: "12 месяцев с даты оплаты",
    monthlyLabel: "375 ₽ в месяц",
    buttonLabel: "Выбрать годовой тариф",
    badgeLabel: "Рекомендуем",
    savingsLabel: `Экономия ${formatTariffPrice(OBJECT_YEARLY_SAVINGS_RUB)}`,
    comparisonLabel: `Сезон + межсезонье отдельно — ${formatTariffPrice(
      OBJECT_SEASON_OFFSEASON_SEPARATE_TOTAL_RUB,
    )}. Годовой тариф — ${formatTariffPrice(OBJECT_YEARLY_PRICE_RUB)}.`,
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
    conditionsLabel: "Сама карточка создается бесплатно; оплачивается только период размещения",
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
  "Мы не берем оплату за количество номеров. Стоимость зависит только от периода размещения одного объекта.",
  "В одном объявлении можно добавить любое количество номеров, комнат или вариантов проживания.",
  "Создание карточки объекта за вас — бесплатно.",
  "Комиссию с бронирований мы не берем. Гости связываются с владельцем напрямую.",
  "Можно выбрать сезонное, межсезонное или годовое размещение.",
  `Годовой тариф выгоднее на ${formatTariffPrice(OBJECT_YEARLY_SAVINGS_RUB)}.`,
];

export const annualTariffBenefitText = `Годовой тариф выгоднее: при оплате сезона и межсезонья отдельно получится ${formatTariffPrice(
  OBJECT_SEASON_OFFSEASON_SEPARATE_TOTAL_RUB,
)}, а при оплате сразу на год — ${formatTariffPrice(
  OBJECT_YEARLY_PRICE_RUB,
)}. Экономия — ${formatTariffPrice(OBJECT_YEARLY_SAVINGS_RUB)}.`;

export function formatTariffPrice(priceRub: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(priceRub)} ₽`;
}

export function getServicesAndTariffsDocumentUrl(): string {
  return `${companyConfig.baseUrl}${SERVICES_AND_TARIFFS_PATH}`;
}
