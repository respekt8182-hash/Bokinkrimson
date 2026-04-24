import { describe, expect, it } from "vitest";
import {
  buildExcursionLeadMessage,
  buildPropertyLeadMessage,
  getOfferLabels,
} from "@/lib/lead-message-author";

describe("lead message author wording", () => {
  it("builds a male property message by default wording", () => {
    const message = buildPropertyLeadMessage({
      authorGender: "male",
      propertyName: "У моря домик",
      roomTitle: "Секси пекси номер",
      checkIn: "2026-04-21",
      checkOut: "2026-04-22",
      nightsLabel: "1 ночь",
      totalGuests: 1,
      adults: 1,
      childrenCount: 0,
      priceLabel: "2 500 ₽ (2 500 ₽ / ночь)",
      extra: "",
    });

    expect(message).toContain('Добрый день! Нашел ваше объявление на сайте "Крым Вокруг".');
    expect(message).toContain("Хотел бы уточнить наличие свободных мест:");
    expect(message).toContain("Буду благодарен за ответ!");
  });

  it("builds a female excursion message with matching phrasing", () => {
    const message = buildExcursionLeadMessage({
      authorGender: "female",
      offerType: "TOUR",
      organizerName: "Мария",
      excursionTitle: "Горный Крым",
      locationName: "Ялта",
      date: "2026-05-02",
      guests: "2",
      message: "Нужен трансфер.",
    });

    expect(message).toContain('Здравствуйте, Мария!');
    expect(message).toContain('Хотела бы забронировать тур "Горный Крым", Ялта.');
    expect(message).toContain("Буду благодарна за ответ.");
  });

  it("returns labels for tours and excursions", () => {
    expect(getOfferLabels("TOUR")).toEqual({ badge: "Тур", accusative: "тур" });
    expect(getOfferLabels("EXCURSION")).toEqual({
      badge: "Экскурсия",
      accusative: "экскурсию",
    });
  });
});
