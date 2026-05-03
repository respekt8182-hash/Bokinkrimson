import { describe, expect, it } from "vitest";
import { cleanFaqItems, cleanPublicText, cleanPublicTextList } from "@/lib/public-content-quality";

describe("public content quality cleanup", () => {
  it("keeps normal Russian copy intact", () => {
    expect(
      cleanPublicText(
        "Уютный гостевой дом рядом с набережной. До моря можно дойти пешком за несколько минут.",
      ),
    ).toBe(
      "Уютный гостевой дом рядом с набережной. До моря можно дойти пешком за несколько минут.",
    );
  });

  it("cuts text before mojibake or service placeholders", () => {
    expect(
      cleanPublicText(
        "Светлый номер рядом с морем. РџРѕСЃР»Рµ СЌС‚РѕРіРѕ РЅР°С‡РёРЅР°РµС‚СЃСЏ РјСѓСЃРѕСЂ.",
      ),
    ).toBe("Светлый номер рядом с морем.");

    expect(
      cleanPublicText(
        "Маршрут проходит по старому городу. Тестовая карточка маршрута нужна для оценки заполненного сайта.",
      ),
    ).toBe("Маршрут проходит по старому городу.");
  });

  it("drops low-quality FAQ items and deduplicates the rest", () => {
    expect(
      cleanFaqItems([
        {
          q: "Где встречаемся?",
          a: "Точную точку встречи организатор пришлёт после подтверждения.",
        },
        { q: "Где встречаемся?", a: "Повтор не нужен." },
        { q: "РџРѕС‡РµРјСѓ?", a: "РџР»РѕС…РѕР№ С‚РµРєСЃС‚." },
      ]),
    ).toEqual([
      {
        q: "Где встречаемся?",
        a: "Точную точку встречи организатор пришлёт после подтверждения.",
      },
    ]);
  });

  it("normalizes short public lists", () => {
    expect(
      cleanPublicTextList([" Wi-Fi ", "wi-fi", "Тестовая карточка удобства", "Парковка"], {
        minLength: 2,
        maxLength: 40,
      }),
    ).toEqual(["Wi-Fi", "Парковка"]);
  });
});
