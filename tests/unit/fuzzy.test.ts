// Unit tests for fuzzy matching and similarity scoring helpers.
import { describe, expect, it } from "vitest";
import { fuzzySearch, rankByTrigram } from "../../src/lib/fuzzy";

describe("trigram search", () => {
  it("finds close typo matches", () => {
    const result = fuzzySearch("Ятла", ["Ялта", "Судак", "Евпатория"], 3);
    expect(result[0]).toBe("Ялта");
  });

  it("ranks object-like records by text relevance", () => {
    const rows = [
      { id: "1", name: "Отель Море", location: "Ялта" },
      { id: "2", name: "Гостевой дом Горный", location: "Судак" },
      { id: "3", name: "Апартаменты Лазурь", location: "Евпатория" },
    ];

    const ranked = rankByTrigram(
      "отел море",
      rows,
      (item) => [item.name, item.location],
      { limit: rows.length, minScore: 0.05 },
    );

    expect(ranked[0]?.id).toBe("1");
  });
});
