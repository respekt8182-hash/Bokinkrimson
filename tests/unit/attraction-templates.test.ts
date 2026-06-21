import { describe, expect, it } from "vitest";
import { determineAttractionTemplate } from "@/lib/attraction-templates";
import { getSmartAttractionFaq, normalizeAttractionText } from "@/lib/normalize-attraction-text";

describe("attraction templates", () => {
  it.each([
    ["Центральный пляж Орджоникидзе", "beach"],
    ["Воронцовский дворец", "palace_architecture"],
    ["35-я береговая батарея", "museum_history"],
    ["Гора Кастель", "nature_route"],
    ["Мраморная пещера", "cave"],
    ["Водопад Учан-Су", "waterfall_water"],
    ["Свято-Успенский монастырь", "religious"],
  ] as const)("classifies %s", (title, expected) => {
    expect(determineAttractionTemplate({ title })).toBe(expected);
  });

  it("prioritizes caves over the broad nature category", () => {
    expect(determineAttractionTemplate({ category: "Горы, скалы и пещеры", title: "Красная пещера" })).toBe("cave");
  });

  it("does not let nearby mentions override object identity", () => {
    expect(determineAttractionTemplate({
      title: "Воронцовский дворец",
      category: "Дворцы, дачи и архитектура",
      description: "Рядом есть пляж и море.",
    })).toBe("palace_architecture");
    expect(determineAttractionTemplate({
      title: "Гора Кастель",
      category: "Горы, скалы и пещеры",
      description: "По соседству расположена пещера.",
    })).toBe("nature_route");
  });

  it("falls back without inventing a type", () => {
    expect(determineAttractionTemplate({ title: "Небольшая точка" })).toBe("generic_place");
  });
});

describe("attraction text quality", () => {
  it("removes source trails and raw markdown", () => {
    expect(normalizeAttractionText("**Описание**  места [Источник: архив] https://example.com")).toBe("Описание места");
  });

  it("removes FAQ answers already present in visible copy", () => {
    expect(getSmartAttractionFaq([{ question: "Где?", answer: "В Алупке." }], "Объект находится в Алупке.")).toEqual([]);
  });
});
