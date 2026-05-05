import { companyConfig } from "@/config/company";
import { placementTariffsByGroup } from "@/lib/constants";
import { PLACEMENT_VALIDITY_DAYS } from "@/lib/payments";
import { getPlacementPromoPrice } from "@/lib/placement-promo";

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

function formatRoomRange(min: number, max: number | null): string {
  if (max === null) {
    return `От ${min} номеров`;
  }

  if (min === max) {
    return `От ${min} номера`;
  }

  return `${min}-${max} номеров`;
}

const placementDurationLabel = `${PLACEMENT_VALIDITY_DAYS} дней с момента публикации`;

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
  ...placementTariffsByGroup.SINGLE_UNIT.map((tariff) => ({
    id: tariff.code,
    serviceName: "Размещение объекта",
    serviceNote: "Квартира, дом, коттедж или частный сектор",
    priceRub: tariff.amountRub,
    conditionsLabel: "От 1 номера / объекта",
    durationLabel: placementDurationLabel,
  })),
  ...placementTariffsByGroup.MULTI_ROOM.map((tariff) => ({
    id: tariff.code,
    serviceName: "Размещение объекта",
    serviceNote: tariff.title,
    priceRub: tariff.amountRub,
    conditionsLabel: formatRoomRange(tariff.roomCountMin, tariff.roomCountMax),
    durationLabel: placementDurationLabel,
  })),
  {
    id: "excursion_standard",
    serviceName: "Размещение информации об экскурсии",
    serviceNote: "Единоразовая публикация карточки экскурсии",
    priceRub: EXCURSION_PUBLICATION_FEE_RUB,
    conditionsLabel: "Количество номеров не применяется",
    durationLabel: placementDurationLabel,
  },
  {
    id: "tour_standard",
    serviceName: "Размещение информации о туре",
    serviceNote: "Единоразовая публикация карточки тура",
    priceRub: EXCURSION_PUBLICATION_FEE_RUB,
    conditionsLabel: "Количество номеров не применяется",
    durationLabel: placementDurationLabel,
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
    durationLabel: placementDurationLabel,
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
      "Мы сами заполним и оформим карточку вашего объекта на сайте по предоставленным вами данным",
    priceLabel: "699 ₽",
    conditionsLabel: "Разовая услуга за 1 объект",
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
  "До 20 июня 2026 включительно размещение объектов, экскурсий, туров и трансферов бесплатно.",
  "Пользователи, которые разместятся в бесплатный период, получат скидку 20% на дальнейшее продление размещения.",
  "После бесплатного периода сервис берет оплату только за размещение карточки и не удерживает комиссию с каждого бронирования.",
  "Для объектов размещения тариф рассчитывается по количеству активных номеров и типу объекта.",
  "Для экскурсий, туров и трансферов действует единоразовая публикация карточки перед модерацией; после бесплатного периода в трансферах один автомобиль включен в базовую стоимость, каждый следующий стоит 500 ₽.",
  "Если карточка возвращена на доработку в рамках оплаченного периода, повторная оплата не требуется.",
];

export function formatTariffPrice(priceRub: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(priceRub)} ₽`;
}

export function getServicesAndTariffsDocumentUrl(): string {
  return `${companyConfig.baseUrl}${SERVICES_AND_TARIFFS_PATH}`;
}
