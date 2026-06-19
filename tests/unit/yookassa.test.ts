import { describe, expect, it } from "vitest";
import {
  buildYooKassaPaymentReceipt,
  buildYooKassaReceiptItemDescription,
} from "../../src/lib/yookassa";

describe("YooKassa receipts", () => {
  it("builds a clear fiscal receipt item with customer contacts", () => {
    const itemDescription = buildYooKassaReceiptItemDescription({
      serviceLabel: "Размещение объекта на сайте Крым Вокруг",
      listingName: "Гостевой дом у моря",
      tariffLabel: "Сезон",
      paidFrom: new Date("2026-05-23T09:00:00.000Z"),
      paidUntil: new Date("2026-10-31T20:59:59.999Z"),
    });
    const receipt = buildYooKassaPaymentReceipt({
      amountRub: 3400,
      itemDescription,
      customer: {
        email: " OWNER@EXAMPLE.RU ",
        phone: "+7 (999) 111-22-33",
        fullName: " Иван Иванов ",
      },
    });

    expect(receipt).toEqual({
      customer: {
        email: "owner@example.ru",
        phone: "79991112233",
        full_name: "Иван Иванов",
      },
      items: [
        {
          description: itemDescription,
          quantity: 1,
          amount: {
            value: "3400.00",
            currency: "RUB",
          },
          vat_code: 1,
          payment_mode: "full_payment",
          payment_subject: "service",
        },
      ],
    });
    expect(itemDescription).toContain("Размещение объекта");
    expect(itemDescription).toContain("Сезон");
    expect(itemDescription).toContain("период: 23.05.2026-31.10.2026");
    expect(itemDescription).toContain("объявление: Гостевой дом у моря");
    expect(receipt?.items[0]?.amount.value).toBe("3400.00");
  });

  it.each([
    ["Размещение объекта на сайте Крым Вокруг", "Гостевой дом", 5000],
    ["Размещение экскурсии на сайте Крым Вокруг", "Ай-Петри", 1490],
    ["Размещение трансфера на сайте Крым Вокруг", "Аэропорт - Ялта", 990],
  ])("describes the paid service and period for %s", (serviceLabel, listingName, amountRub) => {
    const itemDescription = buildYooKassaReceiptItemDescription({
      serviceLabel,
      listingName,
      tariffLabel: "Годовое размещение",
      paidFrom: new Date("2026-06-19T09:00:00.000Z"),
      paidUntil: new Date("2027-06-19T09:00:00.000Z"),
    });
    const receipt = buildYooKassaPaymentReceipt({
      amountRub,
      itemDescription,
      customer: { phone: "+7 999 111-22-33" },
    });

    expect(itemDescription).toContain(serviceLabel);
    expect(itemDescription).toContain("Годовое размещение");
    expect(itemDescription).toContain("период: 19.06.2026-19.06.2027");
    expect(receipt?.items[0]).toMatchObject({
      description: itemDescription,
      quantity: 1,
      amount: { value: `${amountRub.toFixed(2)}`, currency: "RUB" },
      payment_mode: "full_payment",
      payment_subject: "service",
    });
  });

  it("does not build a receipt without customer email or phone", () => {
    expect(
      buildYooKassaPaymentReceipt({
        amountRub: 1000,
        itemDescription: "Размещение",
        customer: {},
      }),
    ).toBeNull();
  });
});
