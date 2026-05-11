import { describe, expect, it } from "vitest";
import {
  buildExcursionLeadMessage,
  buildPropertyLeadMessage,
  buildTransferLeadMessage,
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

  it("adds lead and public listing ids to generated messages", () => {
    const propertyMessage = buildPropertyLeadMessage({
      authorGender: "male",
      propertyName: "Test property",
      roomTitle: "Test room",
      checkIn: "2026-04-21",
      checkOut: "2026-04-22",
      nightsLabel: "1 night",
      totalGuests: 2,
      adults: 2,
      childrenCount: 0,
      priceLabel: null,
      extra: "",
      leadNumber: "KV-000123",
      entityPublicId: 1001,
    });
    const excursionMessage = buildExcursionLeadMessage({
      authorGender: "female",
      offerType: "EXCURSION",
      organizerName: "Test",
      excursionTitle: "Test excursion",
      locationName: "Test city",
      date: "",
      guests: "",
      message: "",
      leadNumber: "KV-000124",
      entityPublicId: 3001,
    });
    const transferMessage = buildTransferLeadMessage({
      authorGender: "male",
      transferTitle: "Test transfer",
      locationName: "Test city",
      priceLabel: null,
      vehicleOption: null,
      extra: "",
      leadNumber: "KV-000125",
      entityPublicId: 4001,
    });

    expect(propertyMessage).toContain("KV-000123");
    expect(propertyMessage).toContain("1001");
    expect(excursionMessage).toContain("KV-000124");
    expect(excursionMessage).toContain("3001");
    expect(transferMessage).toContain("KV-000125");
    expect(transferMessage).toContain("4001");
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

  it("builds a transfer message with author wording and extra details", () => {
    const message = buildTransferLeadMessage({
      authorGender: "female",
      transferTitle: "Такси по городу - Ялта - Седан",
      locationName: "Ялта",
      priceLabel: "от 1 000 ₽ / поездка",
      vehicleOption: "Быстро и чётко",
      extra: "Нужно детское кресло.",
    });

    expect(message).toContain('Добрый день! Нашла ваше объявление на сайте "Крым Вокруг".');
    expect(message).toContain("Хотела бы уточнить возможность заказать трансфер:");
    expect(message).toContain('- Трансфер: "Такси по городу - Ялта - Седан"');
    expect(message).toContain("- Транспорт: Быстро и чётко");
    expect(message).toContain("(Дополнительно: Нужно детское кресло.)");
    expect(message).toContain("Буду благодарна за ответ!");
  });
});
